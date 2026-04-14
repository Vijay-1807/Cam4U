"""
OpenRouter API Service
Provides AI-powered features using OpenRouter's unified API
Using Xiaomi MiMo-V2-Flash (free tier) model
"""

import os
import requests
import json
import logging
import re
from typing import Optional, Dict, List, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class OpenRouterService:
    """Service for interacting with OpenRouter API"""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize OpenRouter service
        
        Args:
            api_key: OpenRouter API key (defaults to OPENROUTER_API env var)
        """
        self.api_key = api_key or os.getenv('OPENROUTER_API')
        self.base_url = 'https://openrouter.ai/api/v1'
        
        # Primary model: OpenAI GPT-4o
        self.default_model = 'openai/gpt-4o'
        
        # Fallback models (free tier alternatives)
        self.fallback_models = [
            'thudm/glm-4-9b-chat:free',
            'google/gemini-2.0-flash-exp:free',
            'meta-llama/llama-3.2-3b-instruct:free',
        ]
        
        if not self.api_key:
            logger.warning("OpenRouter API key not found. Some AI features will be disabled.")
    
    def _make_request(self, endpoint: str, data: Dict[str, Any]) -> Optional[Dict]:
        """Make API request to OpenRouter"""
        if not self.api_key:
            logger.error("OpenRouter API key not configured")
            return None
        
        try:
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json',
                'HTTP-Referer': os.getenv('APP_URL', 'http://localhost:3000'),
                'X-Title': 'SecureCam AI Assistant'
            }
            
            response = requests.post(
                f'{self.base_url}/{endpoint}',
                headers=headers,
                json=data,
                timeout=30
            )
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            logger.error(f"OpenRouter API request failed: {e}")
            return None
    
    def chat_completion(
        self, 
        messages: List[Dict[str, str]], 
        system_prompt: Optional[str] = None,
        max_tokens: int = 500,
        temperature: float = 0.7,
        use_fallback: bool = True
    ) -> Optional[str]:
        """
        Generate chat completion using OpenRouter with fallback support
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            system_prompt: Optional system prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0-1)
            use_fallback: Whether to try fallback models if primary fails
        """
        models_to_try = [self.default_model]
        if use_fallback:
            models_to_try.extend(self.fallback_models)
        
        if system_prompt:
            final_messages = [{'role': 'system', 'content': system_prompt}] + messages
        else:
            final_messages = messages
        
        for model in models_to_try:
            try:
                payload = {
                    'model': model,
                    'messages': final_messages,
                    'max_tokens': max_tokens,
                    'temperature': temperature,
                }
                
                response = self._make_request('chat/completions', payload)
                
                if response and 'choices' in response and len(response['choices']) > 0:
                    content = response['choices'][0]['message']['content']
                    if content:
                        logger.info(f"Successfully got response from model: {model}")
                        return content
                        
            except Exception as e:
                logger.warning(f"Model {model} failed: {e}")
                continue
        
        logger.error("All models failed to generate response")
        return None
    
    def chat_assistant(self, user_message: str, recent_events: List[Dict[str, Any]] = None) -> Optional[str]:
        """
        AI chat assistant for security queries
        
        Args:
            user_message: User's message/question
            recent_events: Optional list of recent detection events for context
        """
        system_prompt = """You are a helpful security monitoring assistant. You help users understand their camera detection events and answer questions about their surveillance system.

Guidelines:
- Respond in a natural, conversational way - like talking to a colleague
- Use plain text only - do NOT use markdown formatting like **bold**, *italic*, # headings, or bullet lists
- Write in a friendly but professional tone
- Be concise but thorough
- If you mention events or data, describe them naturally in sentences
- Keep responses focused and helpful"""

        # Build context from recent events if provided
        context = ""
        if recent_events and len(recent_events) > 0:
            context = "Here's context about the 10 most recent detection events:\n"
            for event in recent_events[:10]:  # All 10 events
                event_type = event.get('detectionType', 'unknown')
                objects = ', '.join(event.get('objects', [])) or 'no objects detected'
                location = event.get('location', 'unknown location')
                timestamp = event.get('timestamp', '')
                confidence = event.get('confidence', None)
                meta = event.get('metadata', {}) or {}
                anomaly_score = meta.get('anomalyScore', None)
                conf_str = f" (confidence: {confidence:.0%})" if isinstance(confidence, (int, float)) else ""
                score_str = f" (anomaly score: {anomaly_score:.2f})" if isinstance(anomaly_score, (int, float)) else ""
                context += f"- {event_type.upper()} detected {objects} at {location} on {timestamp}{conf_str}{score_str}\n"
            context += "\n"
        
        messages = [
            {'role': 'user', 'content': context + user_message}
        ]
        
        response = self.chat_completion(messages, system_prompt=system_prompt, max_tokens=800, use_fallback=True)
        
        # Clean up markdown if it somehow appears
        if response:
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
        
        return response


# Global instance
_openrouter_service = None

def get_openrouter_service() -> OpenRouterService:
    """Get or create OpenRouter service instance"""
    global _openrouter_service
    if _openrouter_service is None:
        _openrouter_service = OpenRouterService()
    return _openrouter_service

