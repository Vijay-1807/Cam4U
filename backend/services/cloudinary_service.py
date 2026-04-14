"""
Cloudinary Service for uploading and managing images and videos.
"""

import cloudinary
import cloudinary.uploader
import cloudinary.api
from cloudinary.utils import cloudinary_url
import logging
from typing import Dict, Optional, Tuple
import os

logger = logging.getLogger(__name__)


class CloudinaryService:
    """Service for handling Cloudinary media uploads and transformations."""
    
    def __init__(self, cloud_name: str, api_key: str, api_secret: str):
        """
        Initialize Cloudinary service.
        
        Args:
            cloud_name: Cloudinary cloud name
            api_key: Cloudinary API key
            api_secret: Cloudinary API secret
        """
        cloudinary.config(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
            secure=True  # Use HTTPS
        )
        logger.info("Cloudinary service initialized")
    
    def upload_image(
        self,
        file_path: any,
        folder: str = "detections",
        public_id: Optional[str] = None,
        overwrite: bool = True
    ) -> Dict[str, any]:
        """
        Upload an image to Cloudinary.
        
        Args:
            file_path: Path to the image file OR file-like object (bytes)
            folder: Folder name in Cloudinary
            public_id: Custom public ID (optional)
            overwrite: Whether to overwrite if exists
            
        Returns:
            Dictionary with upload result including 'secure_url'
            
        Raises:
            Exception: If upload fails
        """
        try:
            logger.info(f"Uploading image: {file_path} to folder: {folder}")
            
            result = cloudinary.uploader.upload(
                file_path,
                folder=folder,
                public_id=public_id,
                overwrite=overwrite,
                resource_type="image",
                transformation=[
                    {"quality": "auto", "fetch_format": "auto"},
                    {"width": 1920, "crop": "limit"}  # Limit max width
                ],
                eager=[  # Generate optimized versions
                    {"width": 640, "crop": "scale", "quality": "auto"},
                    {"width": 1280, "crop": "scale", "quality": "auto"}
                ]
            )
            
            logger.info(f"Image uploaded successfully: {result.get('secure_url')}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to upload image: {str(e)}")
            raise
    
    def upload_video(
        self,
        file_path: str,
        folder: str = "videos",
        public_id: Optional[str] = None,
        overwrite: bool = True
    ) -> Dict[str, any]:
        """
        Upload a video to Cloudinary.
        
        Args:
            file_path: Path to the video file
            folder: Folder name in Cloudinary
            public_id: Custom public ID (optional)
            overwrite: Whether to overwrite if exists
            
        Returns:
            Dictionary with upload result including 'secure_url'
            
        Raises:
            Exception: If upload fails
        """
        try:
            logger.info(f"Uploading video: {file_path} to folder: {folder}")
            
            result = cloudinary.uploader.upload(
                file_path,
                folder=folder,
                public_id=public_id,
                overwrite=overwrite,
                resource_type="video",
                eager=[  # Generate optimized versions
                    {"quality": "auto", "format": "mp4", "video_codec": "h264"},
                    {"width": 1280, "height": 720, "crop": "limit", "format": "mp4"}
                ],
                eager_async=False
            )
            
            logger.info(f"Video uploaded successfully: {result.get('secure_url')}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to upload video: {str(e)}")
            raise
    
    def get_signed_url(
        self,
        public_id: str,
        resource_type: str = "image",
        expires_at: Optional[int] = None,
        transformation: Optional[list] = None
    ) -> str:
        """
        Generate a signed URL for private media access.
        
        Args:
            public_id: Public ID of the media
            resource_type: 'image' or 'video'
            expires_at: Unix timestamp for expiration (optional)
            transformation: List of transformations to apply
            
        Returns:
            Signed URL string
        """
        try:
            url, _ = cloudinary_url(
                public_id,
                resource_type=resource_type,
                sign_url=True,
                expires_at=expires_at,
                transformation=transformation
            )
            return url
        except Exception as e:
            logger.error(f"Failed to generate signed URL: {str(e)}")
            raise
    
    def delete_media(self, public_id: str, resource_type: str = "image") -> Dict[str, any]:
        """
        Delete media from Cloudinary.
        
        Args:
            public_id: Public ID of the media to delete
            resource_type: 'image' or 'video'
            
        Returns:
            Deletion result dictionary
        """
        try:
            result = cloudinary.uploader.destroy(
                public_id,
                resource_type=resource_type
            )
            logger.info(f"Media deleted: {public_id}")
            return result
        except Exception as e:
            logger.error(f"Failed to delete media: {str(e)}")
            raise
    
    def get_thumbnail_url(self, public_id: str, width: int = 300) -> str:
        """
        Get thumbnail URL for an image or video.
        
        Args:
            public_id: Public ID of the media
            width: Thumbnail width
            
        Returns:
            Thumbnail URL
        """
        url, _ = cloudinary_url(
            public_id,
            transformation=[{"width": width, "crop": "scale", "quality": "auto"}]
        )
        return url

