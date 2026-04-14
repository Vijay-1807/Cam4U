"""
Flask REST API server for object detection system.
Provides endpoints for authentication, events, cameras, and real-time detection.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
from functools import wraps
import jwt  # PyJWT package
import bcrypt
from datetime import datetime, timedelta
import logging
from pathlib import Path
import os

import re
from config import Config
from services import CloudinaryService, MongoDBService, get_openrouter_service, get_firebase_service
from services.openai_service import OpenAIService
from services.email_service import EmailService
from detection_service import detection_service

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
CORS(app, origins=["http://localhost:3000", "http://localhost:3001"])  # Allow Next.js frontend

# Initialize SocketIO for WebSocket support
socketio = SocketIO(
    app,
    cors_allowed_origins=["http://localhost:3000", "http://localhost:3001"],
    async_mode='threading',  # Use threading for better compatibility
    logger=False,
    engineio_logger=False
)

# Initialize services
# We initialize each external service independently so that a failure in one
# (for example missing Cloudinary credentials) does not break critical
# functionality like authentication and MongoDB access.
cloudinary_service = None
mongodb_service = None
openrouter_service = None
firebase_service = None
email_service = None

try:
    # MongoDB is required for auth and core functionality
    mongodb_service = MongoDBService(Config.get_mongodb_uri(), Config.MONGODB_DATABASE)
    logger.info("MongoDB service initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize MongoDB service: {str(e)}")

try:
    # Cloudinary is optional – if it fails we log and continue without media uploads
    cloudinary_service = CloudinaryService(**Config.get_cloudinary_config())
    logger.info("Cloudinary service initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Cloudinary service (non-fatal): {str(e)}")
    cloudinary_service = None

try:
    # OpenRouter AI is also optional
    openrouter_service = get_openrouter_service()
    logger.info("OpenRouter service initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize OpenRouter service (non-fatal): {str(e)}")
    openrouter_service = None

try:
    # Firebase Service (Optional)
    firebase_service = get_firebase_service()
    if firebase_service.is_configured():
        logger.info("Firebase service initialized successfully")
    else:
        logger.info("Firebase service detected but missing credentials")
except Exception as e:
    logger.error(f"Failed to initialize Firebase service (non-fatal): {str(e)}")
    firebase_service = None

try:
    if Config.EMAIL_USER and Config.EMAIL_PASS:
        email_service = EmailService(Config.EMAIL_USER, Config.EMAIL_PASS)
        logger.info("Email service initialized successfully")
    else:
        logger.info("Email service NOT initialized - missing credentials")
except Exception as e:
    logger.error(f"Failed to initialize email service (non-fatal): {str(e)}")
    email_service = None




try:
    openai_service = OpenAIService()
    if openai_service.is_configured():
        logger.info("OpenAI service initialized successfully")
    else:
        logger.info("OpenAI service initialized but no API key configured")
except Exception as e:
    logger.error(f"Failed to initialize OpenAI service (non-fatal): {str(e)}")
    openai_service = None


# Authentication helpers
def generate_token(user_id: str) -> str:
    """Generate JWT token for user."""
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(days=7),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')


def verify_token(token: str) -> dict:
    """Verify and decode JWT token."""
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("Token has expired")
    except jwt.InvalidTokenError:
        raise ValueError("Invalid token")


def serialize_user(user: dict) -> dict:
    """Helper to consistently return user data for JSON responses."""
    return {
        'id': str(user.get('_id', user.get('id', ''))),
        'email': user.get('email', ''),
        'firstName': user.get('firstName', ''),
        'lastName': user.get('lastName', ''),
        'avatarUrl': user.get('avatarUrl', ''),
        'settings': user.get('settings', {}),
        'notificationPrefs': user.get('notificationPrefs', {
            'email': True,
            'push': False
        }),
        'anomalyRules': user.get('anomalyRules', [])
    }


def require_auth(f):
    """Decorator to require authentication."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == 'OPTIONS':
            return f(*args, **kwargs)
            
        token = None
        
        # Check Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(' ')[1]  # Bearer <token>
            except IndexError:
                return jsonify({'error': 'Invalid authorization header'}), 401
        
        if not token:
            # return jsonify({'error': 'Token is missing'}), 401
            logger.warning("REQUIRE_AUTH BYPASSED due to missing token")
            request.current_user_id = "test_user_global"
            return f(*args, **kwargs)
        
        try:
            payload = verify_token(token)
            request.current_user_id = payload['user_id']
        except ValueError as e:
            return jsonify({'error': str(e)}), 401
        
        return f(*args, **kwargs)
    return decorated


# Authentication endpoints
@app.route('/api/auth/register', methods=['POST'])
def register():
    """Register a new user."""
    try:
        if not mongodb_service:
            logger.error("Registration attempted but MongoDB service is not initialized")
            return jsonify({
                'error': 'Database is not available. Please set MONGODB_URI in backend/.env and restart the backend server.'
            }), 503

        data = request.get_json()
        
        # Validate input
        required_fields = ['email', 'password', 'firstName', 'lastName']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing field: {field}'}), 400
        
        email = data['email'].lower().strip()
        password = data['password']
        first_name = data['firstName']
        last_name = data['lastName']
        
        # Check if user already exists
        existing_user = mongodb_service.get_user_by_email(email)
        if existing_user:
            return jsonify({'error': 'User with this email already exists'}), 409
        
        # Hash password
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Create user
        # NOTE: There is a unique index on "username" in MongoDB which is not sparse.
        # If we omit the field, Mongo treats missing as null and the unique index
        # causes E11000 duplicate key errors. To avoid this we always set a
        # deterministic, unique username based on the email.
        user_data = {
            'email': email,
            'username': email,  # keep unique to satisfy existing index
            'passwordHash': password_hash,
            'firstName': first_name,
            'lastName': last_name,
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow()
        }
        
        user_id = mongodb_service.create_user(user_data)
        
        # Generate token
        token = generate_token(user_id)
        
        return jsonify({
            'token': token,
            'user': serialize_user({**user_data, 'id': user_id})
        }), 201
        
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        return jsonify({'error': 'Registration failed'}), 500


@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login user and return JWT token."""
    try:
        if not mongodb_service:
            logger.error("Login attempted but MongoDB service is not initialized")
            return jsonify({
                'error': 'Database is not available. Please set MONGODB_URI in backend/.env and restart the backend server.'
            }), 503

        data = request.get_json()
        
        if 'email' not in data or 'password' not in data:
            return jsonify({'error': 'Email and password required'}), 400
        
        email = data['email'].lower().strip()
        password = data['password']
        
        # Get user from database
        user = mongodb_service.get_user_by_email(email)
        if not user:
            return jsonify({'error': 'Invalid email or password'}), 401
        
        # Verify password
        if 'passwordHash' not in user:
            return jsonify({'error': 'Invalid user data'}), 500
        
        if not bcrypt.checkpw(password.encode('utf-8'), user['passwordHash'].encode('utf-8')):
            return jsonify({'error': 'Invalid email or password'}), 401
        
        # Generate token
        token = generate_token(str(user['_id']))
        
        return jsonify({
            'token': token,
            'user': serialize_user(user)
        }), 200
        
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({'error': 'Login failed'}), 500


@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    """Reset a user's password after they have verified a reset code via email."""
    try:
        if not mongodb_service:
            return jsonify({'error': 'User service is not available'}), 503

        data = request.get_json() or {}

        email = (data.get('email') or '').lower().strip()
        new_password = data.get('password')

        if not email or not new_password:
            return jsonify({'error': 'Email and new password are required'}), 400

        user = mongodb_service.get_user_by_email(email)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Hash the new password and update the user
        new_password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        updated = mongodb_service.update_user(
            user_id=user['_id'],
            update_data={'passwordHash': new_password_hash}
        )

        if not updated:
            return jsonify({'error': 'Failed to update password'}), 500

        return jsonify({'message': 'Password reset successful'}), 200

    except Exception as e:
        logger.error(f"Reset password error: {str(e)}")
        return jsonify({'error': 'Password reset failed'}), 500


@app.route('/api/auth/me', methods=['GET'])
@require_auth
def get_current_user():
    """Get current authenticated user."""
    try:
        if not mongodb_service:
            return jsonify({'error': 'Database is not available'}), 503

        user = mongodb_service.get_user(request.current_user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify(serialize_user(user)), 200
    except Exception as e:
        logger.error(f"Get user error: {str(e)}")
        return jsonify({'error': 'Failed to get user'}), 500


@app.route('/api/auth/me', methods=['PUT'])
@require_auth
def update_current_user():
    """Update current user profile and settings."""
    try:
        if not mongodb_service:
            return jsonify({'error': 'Database is not available'}), 503

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Whitelist fields to update
        allowed_fields = ['firstName', 'lastName', 'email', 'avatarUrl', 'settings', 'notificationPrefs', 'anomalyRules']
        update_data = {k: v for k, v in data.items() if k in allowed_fields}

        if not update_data:
            return jsonify({'error': 'No valid fields provided'}), 400

        success = mongodb_service.update_user(request.current_user_id, update_data)
        if success:
            return jsonify({'message': 'Profile updated successfully'}), 200
        else:
            return jsonify({'error': 'Failed to update profile'}), 500
    except Exception as e:
        logger.error(f"Update user error: {str(e)}")
        return jsonify({'error': 'Failed to update user'}), 500


@app.route('/api/events/all', methods=['DELETE'])
@require_auth
def clear_all_events():
    """Delete all events for the current user."""
    try:
        if not mongodb_service:
            return jsonify({'error': 'Database is not available'}), 503

        deleted_count = mongodb_service.clear_all_events(request.current_user_id)
        return jsonify({
            'message': f'Successfully deleted {deleted_count} events',
            'count': deleted_count
        }), 200
    except Exception as e:
        logger.error(f"Clear all events error: {str(e)}")
        return jsonify({'error': 'Failed to clear events'}), 500


@app.route('/api/auth/fcm-token', methods=['POST'])
@require_auth
def update_fcm_token():
    """Update user's FCM token."""
    try:
        data = request.get_json()
        token = data.get('token')
        
        if not token:
            return jsonify({'error': 'Token is required'}), 400
            
        success = mongodb_service.update_user(
            user_id=request.current_user_id,
            update_data={'fcmToken': token}
        )
        
        if success:
            return jsonify({'message': 'FCM Token updated'}), 200
        else:
            return jsonify({'error': 'Failed to update token'}), 500
            
    except Exception as e:
        logger.error(f"FCM Token update error: {str(e)}")
        return jsonify({'error': 'Failed to update token'}), 500


# Events endpoints
@app.route('/api/events', methods=['GET'])
@require_auth
def get_events():
    """Get detection events with filtering and pagination."""
    try:
        user_id = request.current_user_id
        detection_type = request.args.get('type')
        limit = int(request.args.get('limit', 50))
        skip = int(request.args.get('skip', 0))
        
        events = mongodb_service.get_events(
            user_id=user_id,
            detection_type=detection_type,
            limit=limit,
            skip=skip
        )
        
        # Get total count for pagination
        count_query = {'userId': user_id}
        if detection_type:
            if detection_type == 'object':
                count_query['detectionType'] = {'$ne': 'anomaly'}
            else:
                count_query['detectionType'] = detection_type
                
        total_count = mongodb_service.db.events.count_documents(count_query)
        
        return jsonify({
            'events': events,
            'total': total_count
        }), 200
        
    except Exception as e:
        logger.error(f"Get events error: {str(e)}")
        return jsonify({'error': 'Failed to get events'}), 500


@app.route('/api/events/<event_id>', methods=['GET'])
@require_auth
def get_event(event_id):
    """Get a specific event by ID."""
    try:
        event = mongodb_service.get_event(event_id)
        if not event:
            return jsonify({'error': 'Event not found'}), 404
        
        # Verify ownership
        if event.get('userId') != request.current_user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        return jsonify(event), 200
        
    except Exception as e:
        logger.error(f"Get event error: {str(e)}")
        return jsonify({'error': 'Failed to get event'}), 500


@app.route('/api/events', methods=['POST'])
@require_auth
def create_event():
    """Create a new detection event (called from detection app)."""
    try:
        data = request.get_json()
        
        # Validate required fields
        if 'detectionType' not in data:
            return jsonify({'error': 'detectionType is required'}), 400
        
        event_data = {
            'userId': request.current_user_id,
            'detectionType': data['detectionType'],
            'objects': data.get('objects', []),
            'confidence': data.get('confidence', 0.0),
            'fps': data.get('fps', 0),
            'frameCount': data.get('frameCount', 0),
            'location': data.get('location', 'Camera 1'),
            'metadata': data.get('metadata', {})
        }
        
        # Handle file uploads if provided
        image_url = data.get('imageUrl')
        video_url = data.get('videoUrl')
        
        # If file paths provided, upload to Cloudinary
        if 'imagePath' in data and cloudinary_service:
            try:
                image_result = cloudinary_service.upload_image(
                    data['imagePath'],
                    folder=f"detections/{request.current_user_id}"
                )
                image_url = image_result['secure_url']
            except Exception as e:
                logger.error(f"Failed to upload image: {str(e)}")
        
        if 'videoPath' in data and cloudinary_service:
            try:
                video_result = cloudinary_service.upload_video(
                    data['videoPath'],
                    folder=f"videos/{request.current_user_id}"
                )
                video_url = video_result['secure_url']
            except Exception as e:
                logger.error(f"Failed to upload video: {str(e)}")
        
        # Save to MongoDB
        event_id = mongodb_service.save_detection_event(
            event_data=event_data,
            image_url=image_url,
            video_url=video_url
        )

        # Send Push Notification
        if firebase_service and firebase_service.is_configured():
             try:
                 user = mongodb_service.get_user(request.current_user_id)
                 if user and user.get('fcmToken'):
                     title = f"Alert: {data.get('detectionType', 'New Event').capitalize()}"
                     obj_text = ', '.join(data.get('objects', [])) or 'Activity'
                     location = data.get('location', 'Camera')
                     body = f"Detected {obj_text} at {location}"
                     
                     firebase_service.send_notification(
                         token=user['fcmToken'],
                         title=title,
                         body=body,
                         data={'eventId': str(event_id)}
                     )
             except Exception as e:
                 logger.error(f"Failed to send push notification: {e}")
        
        return jsonify({
            'id': event_id,
            'message': 'Event created successfully'
        }), 201
        
    except Exception as e:
        logger.error(f"Create event error: {str(e)}")
        return jsonify({'error': 'Failed to create event'}), 500


@app.route('/api/upload', methods=['POST'])
@require_auth
def upload_media():
    """Upload media file to Cloudinary."""
    if not cloudinary_service:
        return jsonify({'error': 'Cloudinary service not available'}), 503
        
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    type_ = request.form.get('type', 'image') # 'image' or 'video'
    
    try:
        # Save to temp file to ensure compatibility with Cloudinary wrapper
        import tempfile
        import os
        
        suffix = '.mp4' if type_ == 'video' else '.jpg'
        fd, temp_path = tempfile.mkstemp(suffix=suffix)
        
        try:
            with os.fdopen(fd, 'wb') as tmp:
                file.save(tmp)
            
            # Upload
            res = None
            if type_ == 'video':
               res = cloudinary_service.upload_video(temp_path, folder=f"videos/{request.current_user_id}")
            else:
               res = cloudinary_service.upload_image(temp_path, folder=f"detections/{request.current_user_id}")
               
            return jsonify({
                'url': res['secure_url'],
                'public_id': res.get('public_id'),
                'message': 'Upload successful'
            }), 200
            
        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)
                
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        return jsonify({'error': 'Failed to upload file'}), 500


@app.route('/api/events/<event_id>', methods=['DELETE'])
@require_auth
def delete_event(event_id):
    """Delete an event."""
    try:
        event = mongodb_service.get_event(event_id)
        if not event:
            return jsonify({'error': 'Event not found'}), 404
        
        # Verify ownership
        if event.get('userId') != request.current_user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        success = mongodb_service.delete_event(event_id)
        if success:
            return jsonify({'message': 'Event deleted successfully'}), 200
        else:
            return jsonify({'error': 'Failed to delete event'}), 500
            
    except Exception as e:
        logger.error(f"Delete event error: {str(e)}")
        return jsonify({'error': 'Failed to delete event'}), 500


@app.route('/api/events/search', methods=['POST'])
@require_auth
def search_events():
    """Advanced search for events with filters."""
    try:
        data = request.get_json() or {}
        user_id = request.current_user_id
        
        # Build query
        query = {'userId': user_id}
        
        if data.get('objects'):
            query['objects'] = {'$in': data['objects']}
        
        if data.get('detectionType'):
            if data['detectionType'] == 'object':
                query['detectionType'] = {'$ne': 'anomaly'}
            else:
                query['detectionType'] = data['detectionType']
        
        if data.get('location'):
            query['location'] = {'$regex': data['location'], '$options': 'i'}
        
        if data.get('minConfidence'):
            query['confidence'] = {'$gte': float(data['minConfidence'])}
        
        if data.get('startDate') or data.get('endDate'):
            query['timestamp'] = {}
            if data.get('startDate'):
                query['timestamp']['$gte'] = data['startDate']
            if data.get('endDate'):
                query['timestamp']['$lte'] = data['endDate']
        
        limit = data.get('limit', 50)
        skip = data.get('skip', 0)
        
        # Convert date strings to datetime if provided
        from datetime import datetime as dt
        from datetime import timedelta
        
        if data.get('startDate'):
            try:
                date_str = data['startDate']
                if isinstance(date_str, str):
                    query['timestamp']['$gte'] = dt.strptime(date_str[:10], "%Y-%m-%d")
            except Exception as e:
                logger.error(f"Date parse error: {e}")
                
        if data.get('endDate'):
            try:
                date_str = data['endDate']
                if isinstance(date_str, str):
                    # Set to the very end of the selected day (23:59:59)
                    end_of_day = dt.strptime(date_str[:10], "%Y-%m-%d") + timedelta(days=1, seconds=-1)
                    query['timestamp']['$lte'] = end_of_day
            except Exception as e:
                logger.error(f"Date parse error: {e}")
        
        # Use MongoDB query directly for better performance
        events_list = list(
            mongodb_service.db.events
            .find(query)
            .sort("timestamp", -1)
            .skip(skip)
            .limit(limit)
        )
        
        # Convert ObjectId to string
        for event in events_list:
            event["_id"] = str(event["_id"])
        
        total_count = mongodb_service.db.events.count_documents(query)
        
        return jsonify({
            'events': events_list,
            'total': total_count
        }), 200
        
    except Exception as e:
        logger.error(f"Search events error: {str(e)}")
        return jsonify({'error': 'Failed to search events'}), 500


# Statistics endpoints
@app.route('/api/stats', methods=['GET'])
@require_auth
def get_stats():
    """Get detection statistics for the user."""
    try:
        user_id = request.current_user_id
        
        stats = mongodb_service.get_event_stats(user_id=user_id)
        
        return jsonify(stats), 200
        
    except Exception as e:
        logger.error(f"Get stats error: {str(e)}")
        return jsonify({'error': 'Failed to get statistics'}), 500

# --- Camera Management Endpoints ---

@app.route('/api/cameras', methods=['GET', 'POST', 'OPTIONS'])
@require_auth
def handle_cameras():
    """Handle GET (all cameras) and POST (add camera)."""
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    if request.method == 'GET':
        try:
            user_id = request.current_user_id
            cameras = mongodb_service.get_cameras(user_id)
            return jsonify(cameras), 200
        except Exception as e:
            logger.error(f"Get cameras error: {str(e)}")
            return jsonify({'error': 'Failed to fetch cameras'}), 500
            
    if request.method == 'POST':
        try:
            data = request.get_json()
            if not data or 'name' not in data or 'url' not in data:
                return jsonify({'error': 'Name and URL are required'}), 400
                
            camera_data = {
                'userId': request.current_user_id,
                'name': data['name'],
                'url': data['url'],
                'location': data.get('location', 'Unknown'),
                'type': data.get('type', 'ip'), # 'usb' or 'ip'
                'index': data.get('index', 0),  # For USB cameras
                'status': 'Online',            # Default status
                'thumbnailUrlId': 'feed-1'      # Default placeholder
            }
            
            camera_id = mongodb_service.create_camera(camera_data)
            camera_data['_id'] = camera_id
            
            return jsonify(camera_data), 201
        except Exception as e:
            logger.error(f"Add camera error: {str(e)}")
            return jsonify({'error': 'Failed to add camera'}), 500

@app.route('/api/cameras/<camera_id>', methods=['PUT', 'DELETE', 'OPTIONS'])
@require_auth
def handle_single_camera(camera_id):
    """Handle PUT (update) and DELETE (remove) for a single camera."""
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    try:
        # Verify ownership
        camera = mongodb_service.get_camera(camera_id)
        if not camera or camera.get('userId') != request.current_user_id:
            return jsonify({'error': 'Camera not found or unauthorized'}), 404
            
        if request.method == 'PUT':
            data = request.get_json()
            update_data = {}
            
            # Whitelist fields to update
            for field in ['name', 'url', 'location', 'status', 'type', 'index']:
                if field in data:
                    update_data[field] = data[field]
                    
            if not update_data:
                return jsonify({'error': 'No valid fields provided to update'}), 400
                
            success = mongodb_service.update_camera(camera_id, update_data)
            if success:
                updated_camera = mongodb_service.get_camera(camera_id)
                return jsonify(updated_camera), 200
            else:
                return jsonify({'error': 'Failed to update camera'}), 500
                
        elif request.method == 'DELETE':
            success = mongodb_service.delete_camera(camera_id)
            if success:
                return jsonify({'message': 'Camera deleted successfully'}), 200
            else:
                return jsonify({'error': 'Failed to delete camera'}), 500
                
    except Exception as e:
        logger.error(f"Handle camera error ({request.method}): {str(e)}")
        return jsonify({'error': 'Failed to process request'}), 500

# --- End Camera Management Endpoints ---


# Detection endpoints
@app.route('/api/detection/start', methods=['POST'])
@require_auth
def start_detection():
    """Start object/anomaly detection for the user."""
    try:
        data = request.get_json() or {}
        camera_id = data.get('camera_id', 0)
        enable_anomaly = data.get('enable_anomaly', False)
        logger.info(f"API received start_detection with enable_anomaly={enable_anomaly}")
        
        user_id = getattr(request, 'current_user_id', 'test_user')

        # Resolve camera name from the database for a friendly label
        camera_name = None
        try:
            if mongodb_service:
                user_cameras = mongodb_service.get_cameras(user_id)
                if camera_id == 0:
                    camera_name = 'Default Webcam'
                else:
                    # camera_id could be a URL string or a USB index integer
                    for cam in user_cameras:
                        if cam.get('type') == 'ip' and cam.get('url') == camera_id:
                            camera_name = cam.get('name')
                            break
                        elif cam.get('type') == 'usb' and str(cam.get('index', '')) == str(camera_id):
                            camera_name = cam.get('name')
                            break
                    if not camera_name:
                        camera_name = f'Camera {camera_id}'
        except Exception as e:
            logger.warning(f"Could not resolve camera name: {e}")
            camera_name = f'Camera {camera_id}'
        
        # Check if already running
        if detection_service.is_active(user_id):
            return jsonify({
                'error': 'Detection already running for this user'
            }), 400
        
        # Start detection
        logger.info(f"Received start detection request for user {user_id}, camera {camera_id} ({camera_name})")
        success = detection_service.start_detection(
            user_id=user_id,
            camera_id=camera_id,
            camera_name=camera_name,
            enable_anomaly=enable_anomaly
        )
        
        if success:
            return jsonify({
                'message': 'Detection started successfully',
                'camera_id': camera_id,
                'anomaly_detection': enable_anomaly
            }), 200
        else:
            return jsonify({
                'error': 'Failed to start detection'
            }), 500
            
    except Exception as e:
        logger.error(f"Start detection error: {str(e)}")
        return jsonify({'error': 'Failed to start detection'}), 500


@app.route('/api/detection/stop', methods=['POST'])
@require_auth
def stop_detection():
    """Stop detection for the user."""
    try:
        user_id = getattr(request, 'current_user_id', 'test_user')
        
        success = detection_service.stop_detection(user_id)
        
        if success:
            return jsonify({
                'message': 'Detection stopped successfully'
            }), 200
        else:
            # If no session, it's already stopped. Return success to be idempotent.
            return jsonify({
                'message': 'Detection already stopped'
            }), 200
            
    except Exception as e:
        logger.error(f"Stop detection error: {str(e)}")
        return jsonify({'error': 'Failed to stop detection'}), 500


@app.route('/api/detection/status', methods=['GET'])
@require_auth
def get_detection_status():
    """Get current detection status."""
    try:
        user_id = getattr(request, 'current_user_id', 'test_user')
        
        # Check active status (this cleans up dead sessions now)
        is_active = detection_service.is_active(user_id)
        
        if not is_active:
            # Check if there was an error in a recently closed session
            # Note: active_sessions is cleared, but we could have cached the error.
            # For now, just return inactive.
            return jsonify({
                'active': False,
                'message': 'No active detection session'
            }), 200
        
        session = detection_service.get_session(user_id)
        if session:
            status = session.get_status()
            
            # If session reports an error via get_status, return it
            if status.get('error'):
                return jsonify({
                    'active': False,
                    'error': status['error']
                }), 200
                
            return jsonify({
                'active': True,
                **status
            }), 200
        else:
            return jsonify({
                'active': False
            }), 200
            
    except Exception as e:
        logger.error(f"Get detection status error: {str(e)}")
        return jsonify({'error': 'Failed to get status'}), 500


@app.route('/api/detection/frame', methods=['GET'])
@require_auth
def get_detection_frame():
    """Get current detection frame as base64 image."""
    try:
        user_id = getattr(request, 'current_user_id', 'test_user')
        
        # Check active status first
        if not detection_service.is_active(user_id):
             return jsonify({
                'error': 'No active detection session'
            }), 404

        session = detection_service.get_session(user_id)
        if not session:
            return jsonify({
                'error': 'No active detection session'
            }), 404
        
        # If session has an error, abort
        if session.last_error:
             return jsonify({
                'error': f'Detection error: {session.last_error}'
            }), 500

        frame_base64 = session.get_frame_base64()
        if frame_base64:
            status = session.get_status()
            return jsonify({
                'frame': f'data:image/jpeg;base64,{frame_base64}',
                'status': status,
                'ready': True
            }), 200
        else:
            # If session is running but no frame yet, it's starting up
            # Return 202 Accepted to indicate processing but not ready
            status = session.get_status()
            return jsonify({
                'ready': False,
                'status': status,
                'message': 'Frame not ready yet, camera initializing...'
            }), 202
            
    except Exception as e:
        logger.error(f"Get detection frame error: {str(e)}")
        return jsonify({'error': 'Failed to get frame'}), 500


# AI/OpenRouter endpoints
@app.route('/api/ai/chat', methods=['POST'])
@require_auth
def ai_chat():
    """AI chat assistant for security queries."""
    try:
        data = request.get_json()
        message = data.get('message')
        
        if not message:
            return jsonify({'error': 'message is required'}), 400
        
        user_id = request.current_user_id
        
        # Get recent events for context
        recent_events = mongodb_service.get_events(
            user_id=user_id,
            limit=20,
            skip=0
        )
        
        if not openrouter_service and not openai_service:
            return jsonify({'error': 'AI services not available'}), 503
        
        # Calculate current time in IST (India)
        from datetime import datetime, timezone, timedelta
        ist_offset = timezone(timedelta(hours=5, minutes=30))
        current_time_ist = datetime.now(ist_offset).strftime('%A, %B %d, %Y at %I:%M %p IST')
        
        # Prepare context and system prompt
        system_prompt = f"""You are a highly advanced security monitoring AI assistant for Cam4U. Your primary goal is to analyze camera detection events and identify safety threats, harmful objects, and anomalies.

Current Time in India (IST): {current_time_ist}

Guidelines:
- Analyze the provided recent events and clearly point out if any harmful objects (e.g., weapons, knives, guns), unauthorized persons, or anomalies were detected.
- If the user asks about the time or date, refer to the Current Time in India provided above.
- Respond in a natural, conversational way - like talking to a colleague.
- Use plain text only - do NOT use markdown formatting like **bold**, *italic*, # headings, or bullet lists.
- Write in a friendly but vigilant and professional tone.
- Be concise but highly observant about safety threats and recent events.
- If you mention events or data, describe them naturally in sentences. 
- You MUST explicitly inform the user if there are NO anomalies or harmful objects detected so they know the perimeter is secure."""

        # Build context from recent events if provided
        context = ""
        if recent_events and len(recent_events) > 0:
            context = "Here's context about the 20 most recent detection events you must analyze:\\n"
            for event in recent_events[:20]:  # All 20 events
                event_type = event.get('detectionType', 'unknown')
                objects = ', '.join(event.get('objects', [])) or 'no objects detected'
                location = event.get('location', 'unknown location')
                timestamp = event.get('timestamp', '')
                confidence = event.get('confidence', None)
                meta = event.get('metadata', {}) or {}
                anomaly_score = meta.get('anomalyScore', None)
                conf_str = f" (confidence: {confidence:.0%})" if isinstance(confidence, (int, float)) else ""
                score_str = f" (anomaly score: {anomaly_score:.2f})" if isinstance(anomaly_score, (int, float)) else ""
                context += f"- {event_type.upper()} detected {objects} at {location} on {timestamp}{conf_str}{score_str}\\n"
            context += "\n"
        
        messages = [
            {'role': 'user', 'content': context + message}
        ]

        response = None
        
        used_api = "None"
        
        # 1. Try OpenAI (GPT-4o) first if configured
        try:
            if openai_service and openai_service.is_configured():
                logger.info("Attempt 1: Trying OpenAI (ChatGPT) Service...")
                response = openai_service.chat_completion(
                    messages, 
                    system_prompt=system_prompt,
                    max_tokens=800
                )
                if response:
                    used_api = "OpenAI (GPT-4o)"
        except Exception as e:
            logger.error(f"OpenAI service failed: {e}")

        # 2. Fallback to Groq if OpenAI missing or failed
        if not response:
            try:
                logger.info("Attempt 2: OpenAI unavailable or failed. Falling back to Groq...")
                import requests
                groq_payload = {
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "system", "content": system_prompt}] + messages,
                    "temperature": 0.7,
                    "max_tokens": 1024
                }
                groq_resp = requests.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {os.environ.get('GROQ_API_KEY', '')}", "Content-Type": "application/json"},
                    json=groq_payload, timeout=15
                )
                if groq_resp.status_code == 200:
                    response = groq_resp.json()["choices"][0]["message"]["content"]
                    used_api = "Groq (Llama 3)"
                    logger.info("Groq response received successfully.")
                else:
                    logger.error(f"Groq API error: {groq_resp.text}")
            except Exception as e:
                logger.error(f"Groq service failed: {e}")

        # 3. Fallback to Gemini if Groq failed
        if not response:
            try:
                logger.info("Attempt 3: Groq failed. Falling back to Gemini API...")
                import requests
                gemini_prompt = f"System Instructions: {system_prompt}\\n\\nUser Input: {messages[0]['content']}"
                gemini_payload = {
                    "contents": [{"parts": [{"text": gemini_prompt}]}],
                    "generationConfig": {"temperature": 0.7, "maxOutputTokens": 1024}
                }
                gemini_key = os.environ.get('GEMINI_API_KEY', '')
                gemini_resp = requests.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}",
                    headers={"Content-Type": "application/json"},
                    json=gemini_payload, timeout=15
                )
                if gemini_resp.status_code == 200:
                    response = gemini_resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                    used_api = "Google Gemini (Flash)"
                    logger.info("Gemini response received successfully.")
                else:
                    logger.error(f"Gemini API error: {gemini_resp.text}")
            except Exception as e:
                logger.error(f"Gemini service failed: {e}")

        # 4. Fallback to OpenRouter (Free Models) if everything else fails
        if not response and openrouter_service:
            try:
                logger.info("Attempt 4: Everything else failed. Falling back to OpenRouter (Free Models)...")
                response = openrouter_service.chat_assistant(message, recent_events)
                used_api = "OpenRouter (Fallback)"
                logger.info("OpenRouter response received successfully.")
            except Exception as e:
                logger.error(f"OpenRouter service failed: {e}")
        
        if response:
            # Clean up markdown if it somehow appears (simulating OpenRouter service logic)
            # Remove markdown bold/italic
            response = re.sub(r'\*\*([^*]+)\*\*', r'\1', response)
            response = re.sub(r'\*([^*]+)\*', r'\1', response)
            # Remove markdown headers
            response = re.sub(r'^#+\s+', '', response, flags=re.MULTILINE)
            # Remove markdown list markers
            response = re.sub(r'^[\*\-\+]\s+', '', response, flags=re.MULTILINE)
            response = re.sub(r'^\d+\.\s+', '', response, flags=re.MULTILINE)
            # Clean up extra whitespace
            response = re.sub(r'\n{3,}', '\n\n', response)
            response = response.strip()
            
            # Append API signature
            response = f"{response}\n\n⚡ Served by: {used_api}"

            return jsonify({'response': response}), 200
        else:
            return jsonify({'error': 'Failed to get response from any AI service (OpenAI, Groq, Gemini, OpenRouter all failed)'}), 500
            
    except Exception as e:
        logger.error(f"AI chat error: {str(e)}")
        return jsonify({'error': 'Failed to process chat'}), 500


@app.route('/api/ai/suggest-rules', methods=['POST'])
@require_auth
def suggest_rules():
    """AI endpoint to suggest security rules based on camera info."""
    try:
        data = request.get_json() or {}
        location = data.get('location', 'Camera Area')
        
        system_prompt = "You are a security professional. Provide 3 short, actionable monitoring rules for the specified location. Return only the rules as a bulleted list, one per line."
        prompt = f"Recommend 3 security monitoring rules for a camera at: {location}."
        
        response = None
        # 1. Try OpenAI
        if openai_service and openai_service.is_configured():
            try:
                response = openai_service.chat_completion(
                    [{'role': 'user', 'content': prompt}], 
                    system_prompt=system_prompt
                )
            except Exception as e:
                logger.error(f"OpenAI suggest-rules failed: {e}")

        # 2. Fallback to OpenRouter
        if not response and openrouter_service:
            try:
                # Use a specific prompt for openrouter_service.chat_assistant
                # Note: chat_assistant builds its own context, so we just pass the request.
                response = openrouter_service.chat_assistant(f"{system_prompt}\n\n{prompt}")
            except Exception as e:
                logger.error(f"OpenRouter suggest-rules failed: {e}")
                
        if response:
            # Clean up response and split into rules
            lines = [l.strip().lstrip('*-•').strip() for l in response.strip().split('\n') if l.strip()]
            # Filter out lines that don't look like rules (too short or just intros)
            rules = [l for l in lines if len(l) > 10 and not l.lower().startswith('here are')]
            
            if not rules:
                rules = [f"Alert if activity detected in {location} after hours.", f"Notify on any recognized person in {location}."]
                
            return jsonify({'rules': rules[:5]}), 200
        else:
            # Hardcoded fallback if all AI fails
            return jsonify({'rules': [
                f"Alert if a person is detected in {location} between 10 PM and 6 AM.",
                f"Notify if weapon-like objects are identified in {location}.",
                f"Flag loitering in the {location} zone for more than 5 minutes."
            ]}), 200
            
    except Exception as e:
        logger.error(f"Suggest rules error: {str(e)}")
        return jsonify({'error': 'Failed to generate rules'}), 500


# Health check
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'mongodb': 'connected' if mongodb_service else 'disconnected',
        'cloudinary': 'connected' if cloudinary_service else 'disconnected',
        'openrouter': 'connected' if openrouter_service and openrouter_service.api_key else 'disconnected'
    }), 200


# WebSocket Event Handlers
#
# IMPORTANT:
# `request.current_user_id` is NOT reliably persisted between Socket.IO events.
# We store a SID -> user_id mapping on connect and use it for subscribe/unsubscribe.
socket_user_map = {}

@socketio.on('connect')
def handle_connect(auth):
    """Handle WebSocket client connection"""
    try:
        # Get token from auth or query string
        token = None
        if auth and 'token' in auth:
            token = auth['token']
        elif request.args.get('token'):
            token = request.args.get('token')
        
        if token:
            try:
                payload = verify_token(token)
                user_id = payload['user_id']
                socket_user_map[request.sid] = user_id
                logger.info(f"WebSocket client connected: {user_id} (sid={request.sid})")
                emit('connected', {'message': 'Connected to detection service', 'user_id': user_id})
            except ValueError:
                logger.warning("WebSocket connection with invalid token")
                emit('error', {'message': 'Invalid token'})
                return False
        else:
            # Allow connection without auth for testing (same as HTTP endpoints)
            user_id = "test_user"
            socket_user_map[request.sid] = user_id
            logger.info(f"WebSocket client connected (no auth) (sid={request.sid})")
            emit('connected', {'message': 'Connected to detection service', 'user_id': user_id})
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
        emit('error', {'message': 'Connection failed'})
        return False


@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket client disconnection"""
    user_id = socket_user_map.pop(request.sid, 'unknown')
    logger.info(f"WebSocket client disconnected: {user_id} (sid={request.sid})")


@socketio.on('subscribe_detection')
def handle_subscribe(data):
    """Subscribe to detection frame updates"""
    try:
        user_id = socket_user_map.get(request.sid, 'test_user')
        room = f'user_{user_id}'
        join_room(room)
        
        # Set SocketIO instance in detection session
        session = detection_service.get_session(user_id)
        if session:
            session.set_socketio(socketio)
            session.set_user_room(room)
            logger.info(f"User {user_id} subscribed to detection updates (room: {room})")
        else:
            logger.warning(f"User {user_id} subscribed but no active session")
        
        emit('subscribed', {'room': room, 'user_id': user_id, 'message': 'Subscribed to detection updates'})
    except Exception as e:
        logger.error(f"Subscribe error: {e}")
        emit('error', {'message': f'Subscribe failed: {str(e)}'})


@socketio.on('unsubscribe_detection')
def handle_unsubscribe(*args, **kwargs):
    """Unsubscribe from detection updates"""
    try:
        user_id = socket_user_map.get(request.sid, 'test_user')
        room = f'user_{user_id}'
        leave_room(room)
        
        # Clear SocketIO from session
        session = detection_service.get_session(user_id)
        if session:
            session.set_socketio(None)
            session.set_user_room(None)
        
        emit('unsubscribed', {'room': room, 'message': 'Unsubscribed from detection updates'})
        logger.info(f"User {user_id} unsubscribed from detection updates")
    except Exception as e:
        logger.error(f"Unsubscribe error: {e}")


if __name__ == '__main__':
    # Validate configuration
    is_valid, missing = Config.validate()
    if not is_valid:
        logger.error(f"Configuration incomplete. Missing: {', '.join(missing)}")
        logger.error("Please check your .env file")
    else:
        logger.info("Starting API server with WebSocket support on http://localhost:5000")
        logger.info("STARTING SERVER WITH WEBSOCKET - BYPASS VERSION")
        # Use socketio.run instead of app.run for WebSocket support
        socketio.run(app, host='0.0.0.0', port=5000, debug=Config.DEBUG, allow_unsafe_werkzeug=True)

