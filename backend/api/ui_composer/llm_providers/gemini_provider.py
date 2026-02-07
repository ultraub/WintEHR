"""
Google Gemini Provider Implementation
"""

import os
import logging
from typing import Dict, Any, Optional
import google.generativeai as genai

from .base_provider import BaseLLMProvider, LLMProvider

logger = logging.getLogger(__name__)

class GeminiProvider(BaseLLMProvider):
    """Google Gemini API provider"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        api_key = config.get('api_key') or os.environ.get('GEMINI_API_KEY')

        if not api_key:
            raise ValueError("Gemini API key not provided")

        genai.configure(api_key=api_key)
        self.model_name = config.get('model', 'gemini-1.5-pro')
        self.model = genai.GenerativeModel(self.model_name)

    async def check_availability(self) -> Dict[str, Any]:
        """Check if Gemini is available"""
        try:
            response = await self.model.generate_content_async("Say 'OK'")
            return {
                "available": True,
                "provider": LLMProvider.GEMINI,
                "model": self.model_name
            }
        except Exception as e:
            return {
                "available": False,
                "provider": LLMProvider.GEMINI,
                "error": str(e)
            }

    async def complete(self,
                      prompt: str,
                      system_prompt: Optional[str] = None,
                      max_tokens: int = 4096,
                      temperature: float = 0.0,
                      **kwargs) -> str:
        """Generate completion using Gemini"""
        full_prompt = prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n{prompt}"

        generation_config = {
            "temperature": temperature,
            "max_output_tokens": max_tokens,
        }

        response = await self.model.generate_content_async(
            full_prompt,
            generation_config=generation_config
        )

        return response.text

    def get_model_info(self) -> Dict[str, Any]:
        """Get Gemini model info"""
        return {
            "provider": "Google Gemini",
            "model": self.model_name,
            "supports_json_mode": False,
            "max_tokens": 32768
        }
