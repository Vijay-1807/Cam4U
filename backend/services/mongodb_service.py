"""
MongoDB Service for storing detection events and metadata.
"""

from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.database import Database
from datetime import datetime
from typing import Dict, List, Optional, Any
import logging
from bson import ObjectId

logger = logging.getLogger(__name__)


class MongoDBService:
    """Service for handling MongoDB database operations."""
    
    def __init__(self, connection_string: str, database_name: str = "securecam"):
        """
        Initialize MongoDB service.
        
        Args:
            connection_string: MongoDB connection string
            database_name: Name of the database to use
        """
        try:
            self.client = MongoClient(connection_string)
            self.db: Database = self.client[database_name]
            
            # Test connection
            self.client.admin.command('ping')
            logger.info(f"MongoDB connected to database: {database_name}")
            
            # Create indexes for better performance
            self._create_indexes()
            
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {str(e)}")
            raise
    
    def _create_indexes(self):
        """Create indexes on frequently queried fields."""
        try:
            # Events collection indexes
            events_collection = self.db.events
            events_collection.create_index("timestamp", background=True)
            events_collection.create_index("userId", background=True)
            events_collection.create_index("detectionType", background=True)
            events_collection.create_index([("timestamp", -1), ("userId", 1)], background=True)
            events_collection.create_index([("userId", 1), ("timestamp", -1)], background=True)
            events_collection.create_index("location", background=True)
            events_collection.create_index("objects", background=True)
            
            # Users collection indexes
            users_collection = self.db.users
            users_collection.create_index("email", unique=True, background=True)
            try:
                users_collection.create_index("username", unique=True, background=True, sparse=True)
            except:
                pass  # Index may already exist
            
            # Cameras collection indexes
            cameras_collection = self.db.cameras
            cameras_collection.create_index("userId", background=True)
            cameras_collection.create_index("status", background=True)
            
            logger.info("MongoDB indexes created successfully")
        except Exception as e:
            logger.warning(f"Failed to create indexes: {str(e)}")
    
    def save_detection_event(
        self,
        event_data: Dict[str, Any],
        image_url: Optional[str] = None,
        video_url: Optional[str] = None
    ) -> str:
        """
        Save a detection event to the database.
        
        Args:
            event_data: Dictionary containing event metadata
            image_url: URL of the snapshot image (Cloudinary URL)
            video_url: URL of the video recording (Cloudinary URL)
            
        Returns:
            Inserted document ID as string
        """
        try:
            event_document = {
                **event_data,
                "snapshotUrl": image_url,
                "videoUrl": video_url,
                "timestamp": datetime.utcnow(),
                "createdAt": datetime.utcnow()
            }
            
            result = self.db.events.insert_one(event_document)
            logger.info(f"Detection event saved with ID: {result.inserted_id}")
            return str(result.inserted_id)
            
        except Exception as e:
            logger.error(f"Failed to save detection event: {str(e)}")
            raise
    
    def get_event(self, event_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a single event by ID.
        
        Args:
            event_id: Event ID (string or ObjectId)
            
        Returns:
            Event document or None if not found
        """
        try:
            if isinstance(event_id, str):
                event_id = ObjectId(event_id)
            
            event = self.db.events.find_one({"_id": event_id})
            if event:
                event["_id"] = str(event["_id"])
            return event
        except Exception as e:
            logger.error(f"Failed to get event: {str(e)}")
            return None
    
    def get_events(
        self,
        user_id: Optional[str] = None,
        detection_type: Optional[str] = None,
        limit: int = 50,
        skip: int = 0,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Get multiple events with filtering and pagination.
        
        Args:
            user_id: Filter by user ID
            detection_type: Filter by detection type (e.g., 'anomaly', 'object')
            limit: Maximum number of results
            skip: Number of results to skip
            start_date: Filter events after this date
            end_date: Filter events before this date
            
        Returns:
            List of event documents
        """
        try:
            query = {}
            
            if user_id:
                query["userId"] = user_id
            
            if detection_type:
                if detection_type == "object":
                    query["detectionType"] = {"$ne": "anomaly"}
                else:
                    query["detectionType"] = detection_type
            
            if start_date or end_date:
                query["timestamp"] = {}
                if start_date:
                    query["timestamp"]["$gte"] = start_date
                if end_date:
                    query["timestamp"]["$lte"] = end_date
            
            events = list(
                self.db.events
                .find(query)
                .sort("timestamp", -1)
                .skip(skip)
                .limit(limit)
            )
            
            # Convert ObjectId to string
            for event in events:
                event["_id"] = str(event["_id"])
            
            return events
            
        except Exception as e:
            logger.error(f"Failed to get events: {str(e)}")
            return []
    
    def create_user(self, user_data: Dict[str, Any]) -> str:
        """
        Create a new user.
        
        Args:
            user_data: Dictionary containing user information
            
        Returns:
            Created user ID as string
        """
        try:
            user_document = {
                **user_data,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            }
            
            result = self.db.users.insert_one(user_document)
            logger.info(f"User created with ID: {result.inserted_id}")
            return str(result.inserted_id)
            
        except Exception as e:
            logger.error(f"Failed to create user: {str(e)}")
            raise
    
    def get_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user by ID.
        
        Args:
            user_id: User ID (string or ObjectId)
            
        Returns:
            User document or None if not found
        """
        try:
            if isinstance(user_id, str):
                user_id = ObjectId(user_id)
            
            user = self.db.users.find_one({"_id": user_id})
            if user:
                user["_id"] = str(user["_id"])
            return user
        except Exception as e:
            logger.error(f"Failed to get user: {str(e)}")
            return None
    
    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """
        Get user by email.
        
        Args:
            email: User email address
            
        Returns:
            User document or None if not found
        """
        try:
            user = self.db.users.find_one({"email": email})
            if user:
                user["_id"] = str(user["_id"])
            return user
        except Exception as e:
            logger.error(f"Failed to get user by email: {str(e)}")
            return None
    
    def update_user(self, user_id: str, update_data: Dict[str, Any]) -> bool:
        """
        Update user information.
        
        Args:
            user_id: User ID (string or ObjectId)
            update_data: Dictionary with fields to update
            
        Returns:
            True if update successful, False otherwise
        """
        try:
            if isinstance(user_id, str):
                user_id = ObjectId(user_id)
            
            update_data["updatedAt"] = datetime.utcnow()
            result = self.db.users.update_one(
                {"_id": user_id},
                {"$set": update_data}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Failed to update user: {str(e)}")
            return False
            
    # --- Camera Management Functions ---
    
    def create_camera(self, camera_data: Dict[str, Any]) -> str:
        """Create a new camera."""
        try:
            camera_document = {
                **camera_data,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            }
            result = self.db.cameras.insert_one(camera_document)
            logger.info(f"Camera created with ID: {result.inserted_id}")
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to create camera: {str(e)}")
            raise

    def get_cameras(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all cameras for a user."""
        try:
            cameras = list(self.db.cameras.find({"userId": user_id}).sort("createdAt", -1))
            for cam in cameras:
                cam["_id"] = str(cam["_id"])
            return cameras
        except Exception as e:
            logger.error(f"Failed to get cameras: {str(e)}")
            return []

    def get_camera(self, camera_id: str) -> Optional[Dict[str, Any]]:
        """Get a single camera by ID."""
        try:
            if isinstance(camera_id, str):
                camera_id = ObjectId(camera_id)
            camera = self.db.cameras.find_one({"_id": camera_id})
            if camera:
                camera["_id"] = str(camera["_id"])
            return camera
        except Exception as e:
            logger.error(f"Failed to get camera: {str(e)}")
            return None

    def update_camera(self, camera_id: str, update_data: Dict[str, Any]) -> bool:
        """Update a camera's information."""
        try:
            if isinstance(camera_id, str):
                camera_id = ObjectId(camera_id)
            
            update_data["updatedAt"] = datetime.utcnow()
            result = self.db.cameras.update_one(
                {"_id": camera_id},
                {"$set": update_data}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Failed to update camera: {str(e)}")
            return False

    def delete_camera(self, camera_id: str) -> bool:
        """Delete a camera."""
        try:
            if isinstance(camera_id, str):
                camera_id = ObjectId(camera_id)
            result = self.db.cameras.delete_one({"_id": camera_id})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Failed to delete camera: {str(e)}")
            return False
            
    # --- End Camera Management Functions ---
    
    def delete_event(self, event_id: str) -> bool:
        """
        Delete an event.
        
        Args:
            event_id: Event ID (string or ObjectId)
            
        Returns:
            True if deletion successful, False otherwise
        """
        try:
            if isinstance(event_id, str):
                event_id = ObjectId(event_id)
            
            result = self.db.events.delete_one({"_id": event_id})
            return result.deleted_count > 0
            
        except Exception as e:
            logger.error(f"Failed to delete event: {str(e)}")
            return False
    
    def clear_all_events(self, user_id: str) -> int:
        """
        Clear all events for a user.
        
        Args:
            user_id: User ID
            
        Returns:
            Number of deleted documents
        """
        try:
            result = self.db.events.delete_many({"userId": user_id})
            logger.info(f"Cleared {result.deleted_count} events for user {user_id}")
            return result.deleted_count
        except Exception as e:
            logger.error(f"Failed to clear events: {str(e)}")
            return 0
    
    def get_event_stats(
        self,
        user_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get statistics about events.
        
        Args:
            user_id: Filter by user ID
            start_date: Filter events after this date
            end_date: Filter events before this date
            
        Returns:
            Dictionary with statistics
        """
        try:
            query = {}
            
            if user_id:
                query["userId"] = user_id
            
            if start_date or end_date:
                query["timestamp"] = {}
                if start_date:
                    query["timestamp"]["$gte"] = start_date
                if end_date:
                    query["timestamp"]["$lte"] = end_date
            
            total_events = self.db.events.count_documents(query)
            
            # Count by detection type
            pipeline = [
                {"$match": query},
                {"$group": {"_id": "$detectionType", "count": {"$sum": 1}}}
            ]
            type_counts = list(self.db.events.aggregate(pipeline))
            
            return {
                "totalEvents": total_events,
                "byType": {item["_id"]: item["count"] for item in type_counts}
            }
            
        except Exception as e:
            logger.error(f"Failed to get event stats: {str(e)}")
            return {"totalEvents": 0, "byType": {}}
    
    def close(self):
        """Close MongoDB connection."""
        try:
            self.client.close()
            logger.info("MongoDB connection closed")
        except Exception as e:
            logger.error(f"Error closing MongoDB connection: {str(e)}")

