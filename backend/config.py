"""
Configuration management for the application.
Loads environment variables and provides configuration settings.
"""

import os
from pathlib import Path
from typing import Optional, Tuple
from dotenv import load_dotenv

# Load environment variables from .env file
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)


class Config:
    """Application configuration class."""
    
    # MongoDB Configuration
    MONGODB_URI: str = os.getenv("MONGODB_URI", "")
    MONGODB_DATABASE: str = os.getenv("MONGODB_DATABASE", "securecam")
    
    # Cloudinary Configuration
    CLOUDINARY_CLOUD_NAME: str = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    CLOUDINARY_API_KEY: str = os.getenv("CLOUDINARY_API_KEY", "")
    CLOUDINARY_API_SECRET: str = os.getenv("CLOUDINARY_API_SECRET", "")
    
    # Application Configuration
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    APP_URL: str = os.getenv("APP_URL", "http://localhost:3000")
    
    # OpenRouter AI Configuration
    OPENROUTER_API: str = os.getenv("OPENROUTER_API", "")

    # OpenAI Configuration
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

    # Email Configuration
    EMAIL_USER: str = os.getenv("EMAIL_USER", "")
    EMAIL_PASS: str = os.getenv("EMAIL_PASS", "")
    
    # Output Configuration
    OUTPUT_DIR: Path = Path(__file__).parent.parent / "outputs" / "detections_output"
    
    @classmethod
    def validate(cls) -> Tuple[bool, list[str]]:
        """
        Validate that all required configuration is present.
        
        Returns:
            Tuple of (is_valid, list_of_missing_keys)
        """
        required_keys = [
            ("MONGODB_URI", cls.MONGODB_URI),
            ("CLOUDINARY_CLOUD_NAME", cls.CLOUDINARY_CLOUD_NAME),
            ("CLOUDINARY_API_KEY", cls.CLOUDINARY_API_KEY),
            ("CLOUDINARY_API_SECRET", cls.CLOUDINARY_API_SECRET),
        ]
        
        missing = []
        for key, value in required_keys:
            if not value:
                missing.append(key)
        
        return len(missing) == 0, missing
    
    @classmethod
    def get_mongodb_uri(cls) -> str:
        """Get MongoDB connection URI."""
        if not cls.MONGODB_URI:
            raise ValueError("MONGODB_URI is not set in environment variables")
        return cls.MONGODB_URI
    
    @classmethod
    def get_cloudinary_config(cls) -> dict:
        """Get Cloudinary configuration dictionary."""
        if not all([cls.CLOUDINARY_CLOUD_NAME, cls.CLOUDINARY_API_KEY, cls.CLOUDINARY_API_SECRET]):
            raise ValueError("Cloudinary credentials are not fully set in environment variables")
        
        return {
            "cloud_name": cls.CLOUDINARY_CLOUD_NAME,
            "api_key": cls.CLOUDINARY_API_KEY,
            "api_secret": cls.CLOUDINARY_API_SECRET
        }

