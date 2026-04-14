import firebase_admin
from firebase_admin import credentials, messaging
import logging
import os

logger = logging.getLogger(__name__)

class FirebaseService:
    def __init__(self, credential_path: str = "serviceAccountKey.json"):
        # Check absolute path or relative to CWD
        if not os.path.exists(credential_path):
             # Try absolute path relative to current file if CWD is widely different
             current_dir = os.path.dirname(os.path.abspath(__file__))
             # One level up from services/ is backend/
             backend_dir = os.path.dirname(current_dir)
             potential_path = os.path.join(backend_dir, credential_path)
             if os.path.exists(potential_path):
                 credential_path = potential_path
             else:
                 logger.warning(f"Firebase Service Account Key not found at {credential_path}. Push notifications will not work.")
                 self.app = None
                 return

        try:
            # Check if already initialized to avoid error
            if not firebase_admin._apps:
                cred = credentials.Certificate(credential_path)
                self.app = firebase_admin.initialize_app(cred)
                logger.info("Firebase Admin SDK initialized successfully")
            else:
                self.app = firebase_admin.get_app()
        except Exception as e:
            logger.error(f"Failed to initialize Firebase Admin SDK: {e}")
            self.app = None

    def send_notification(self, token: str, title: str, body: str, data: dict = None):
        if not self.app:
            logger.warning("Firebase app not initialized, cannot send notification")
            return False

        try:
            # Ensure data values are strings
            if data:
                data = {k: str(v) for k, v in data.items()}

            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                data=data or {},
                token=token,
            )
            response = messaging.send(message)
            logger.info(f"Successfully sent message: {response}")
            return True
        except Exception as e:
            logger.error(f"Error sending message: {e}")
            return False
            
    def is_configured(self):
        return self.app is not None

_instance = None

def get_firebase_service():
    global _instance
    if not _instance:
        # Check if environment variable is set, else default to serviceAccountKey.json in root or backend
        path = os.getenv("FIREBASE_CREDENTIAL_PATH", "serviceAccountKey.json")
        _instance = FirebaseService(path)
    return _instance
