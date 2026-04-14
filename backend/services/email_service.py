import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self, smtp_user: str, smtp_pass: str):
        self.smtp_user = smtp_user
        self.smtp_pass = smtp_pass
        self.smtp_server = "smtp.gmail.com"
        self.smtp_port = 587
        logger.info(f"Email service initialized for {smtp_user}")

    def send_email(self, recipient: str, subject: str, html_content: str) -> bool:
        if not self.smtp_user or not self.smtp_pass:
            logger.warning("Email credentials missing, cannot send email")
            return False

        try:
            msg = MIMEMultipart()
            msg['From'] = f"Cam4U <{self.smtp_user}>"
            msg['To'] = recipient
            msg['Subject'] = subject

            msg.attach(MIMEText(html_content, 'html'))

            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            server.starttls()
            server.login(self.smtp_user, self.smtp_pass)
            server.send_message(msg)
            server.quit()

            logger.info(f"Email sent successfully to {recipient}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email to {recipient}: {str(e)}")
            return False

    def send_alert_email(self, recipient: str, name: str, alert_type: str, location: str, confidence: float):
        subject = f"🚨 Cam4U Alert: {alert_type.capitalize()} Detected!"
        
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <div style="background: #ef4444; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Security Alert</h1>
          </div>
          <div style="padding: 20px; background: #fff;">
            <h2 style="color: #333;">Hi {name},</h2>
            <p style="color: #555; font-size: 16px;">
              Our AI system has detected a potential security event:
            </p>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Event Type:</strong> <span style="color: #ef4444;">{alert_type.capitalize()}</span></p>
              <p style="margin: 5px 0;"><strong>Location:</strong> {location}</p>
              <p style="margin: 5px 0;"><strong>Confidence:</strong> {confidence * 100:.1f}%</p>
              <p style="margin: 5px 0;"><strong>Time:</strong> {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            </div>
            <p style="color: #666; font-size: 14px;">
              Please check your live monitoring feed for more details.
            </p>
            <div style="text-align: center; margin-top: 30px;">
              <a href="http://localhost:3000/dashboard/monitoring" 
                 style="background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                View Live Feed
              </a>
            </div>
          </div>
          <div style="padding: 15px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee;">
            This is an automated security alert from Cam4U.
          </div>
        </div>
        """
        return self.send_email(recipient, subject, html)
