"""
Example integration of MongoDB and Cloudinary services with object detection.
This demonstrates how to save detection events and upload media files.
"""

import logging
from pathlib import Path
from config import Config
from services import CloudinaryService, MongoDBService

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def setup_services():
    """Initialize and return Cloudinary and MongoDB services."""
    # Validate configuration
    is_valid, missing = Config.validate()
    if not is_valid:
        raise ValueError(f"Missing required configuration: {', '.join(missing)}")
    
    # Initialize Cloudinary service
    cloudinary_config = Config.get_cloudinary_config()
    cloudinary_service = CloudinaryService(
        cloud_name=cloudinary_config["cloud_name"],
        api_key=cloudinary_config["api_key"],
        api_secret=cloudinary_config["api_secret"]
    )
    
    # Initialize MongoDB service
    mongodb_uri = Config.get_mongodb_uri()
    mongodb_service = MongoDBService(
        connection_string=mongodb_uri,
        database_name=Config.MONGODB_DATABASE
    )
    
    return cloudinary_service, mongodb_service


def save_detection_with_media(
    image_path: str,
    video_path: str,
    detection_data: dict,
    cloudinary_service: CloudinaryService,
    mongodb_service: MongoDBService
) -> str:
    """
    Upload media to Cloudinary and save detection event to MongoDB.
    
    Args:
        image_path: Path to snapshot image
        video_path: Path to video recording
        detection_data: Dictionary with detection metadata
        cloudinary_service: CloudinaryService instance
        mongodb_service: MongoDBService instance
        
    Returns:
        Event ID as string
    """
    try:
        # Upload image to Cloudinary
        logger.info(f"Uploading image: {image_path}")
        image_result = cloudinary_service.upload_image(
            file_path=image_path,
            folder="detections/snapshots"
        )
        image_url = image_result.get('secure_url')
        logger.info(f"Image uploaded: {image_url}")
        
        # Upload video to Cloudinary
        logger.info(f"Uploading video: {video_path}")
        video_result = cloudinary_service.upload_video(
            file_path=video_path,
            folder="detections/videos"
        )
        video_url = video_result.get('secure_url')
        logger.info(f"Video uploaded: {video_url}")
        
        # Save event to MongoDB
        event_id = mongodb_service.save_detection_event(
            event_data=detection_data,
            image_url=image_url,
            video_url=video_url
        )
        logger.info(f"Event saved to MongoDB with ID: {event_id}")
        
        return event_id
        
    except Exception as e:
        logger.error(f"Failed to save detection with media: {str(e)}")
        raise


def example_usage():
    """Example of how to use the services."""
    try:
        # Setup services
        cloudinary_service, mongodb_service = setup_services()
        
        # Example: Save a detection event
        # (In real usage, this would be called from your detection app)
        
        # Example detection data
        detection_data = {
            "userId": "user123",  # Replace with actual user ID
            "detectionType": "anomaly",
            "objects": ["person", "car"],
            "confidence": 0.95,
            "fps": 30,
            "frameCount": 150,
            "location": "Camera 1",
            "metadata": {
                "model": "YOLO11",
                "anomalyScore": 0.87
            }
        }
        
        # Example file paths (replace with actual paths)
        image_path = str(Config.OUTPUT_DIR / "snapshot_20251105_183656.jpg")
        video_path = str(Config.OUTPUT_DIR / "processed_20251105_211306.mp4")
        
        # Check if files exist
        if Path(image_path).exists() and Path(video_path).exists():
            event_id = save_detection_with_media(
                image_path=image_path,
                video_path=video_path,
                detection_data=detection_data,
                cloudinary_service=cloudinary_service,
                mongodb_service=mongodb_service
            )
            print(f"✅ Detection saved successfully! Event ID: {event_id}")
        else:
            print("⚠️  Example files not found. Please use actual detection output files.")
        
        # Example: Retrieve events
        events = mongodb_service.get_events(limit=10)
        print(f"\n📊 Retrieved {len(events)} recent events")
        
        # Close MongoDB connection
        mongodb_service.close()
        
    except Exception as e:
        logger.error(f"Example usage failed: {str(e)}")
        raise


if __name__ == "__main__":
    example_usage()

