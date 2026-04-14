"""
OpenAI API Service
Provides AI-powered features using OpenAI's official API (GPT-4o)
"""

import os
import requests
import logging
import json
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

class OpenAIService:
    """Service for interacting with OpenAI API directly"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('OPENAI_API_KEY')
        self.base_url = 'https://api.openai.com/v1'
        self.model = 'gpt-4o'
        
        if not self.api_key:
            logger.info("OpenAI API key not configured")

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def _make_request(self, endpoint: str, data: Dict[str, Any]) -> Optional[Dict]:
        """Make API request to OpenAI"""
        if not self.api_key:
            return None
            
        try:
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }
            
            response = requests.post(
                f'{self.base_url}/{endpoint}',
                headers=headers,
                json=data,
                timeout=30
            )
            
            if response.status_code == 401:
                logger.error("OpenAI API key is invalid")
                return None
                
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            logger.error(f"OpenAI API request failed: {e}")
            return None

    def chat_completion(
        self, 
        messages: List[Dict[str, str]], 
        system_prompt: Optional[str] = None,
        max_tokens: int = 500,
        temperature: float = 0.7
    ) -> Optional[str]:
        """Generate chat completion using OpenAI GPT-4o"""
        
        if system_prompt:
            final_messages = [{'role': 'system', 'content': system_prompt}] + messages
        else:
            final_messages = messages
            
        try:
            payload = {
                'model': self.model,
                'messages': final_messages,
                'max_tokens': max_tokens,
                'temperature': temperature,
            }
            
            response = self._make_request('chat/completions', payload)
            
            if response and 'choices' in response and len(response['choices']) > 0:
                return response['choices'][0]['message']['content']
                
        except Exception as e:
            logger.error(f"OpenAI completion failed: {e}")
            
        return None
