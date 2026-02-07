"""
OpenAI Provider Implementation
Supports both OpenAI API and Azure OpenAI
"""

import os
import logging
from typing import Dict, Any, Optional
from openai import AsyncOpenAI, AsyncAzureOpenAI

from .base_provider import BaseLLMProvider, LLMProvider

logger = logging.getLogger(__name__)

class OpenAIProvider(BaseLLMProvider):
    """OpenAI API provider"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        api_key = config.get('api_key') or os.environ.get('OPENAI_API_KEY')

        if not api_key:
            raise ValueError("OpenAI API key not provided")

        self.client = AsyncOpenAI(api_key=api_key)
        self.model = config.get('model', 'gpt-4-turbo-preview')

    async def check_availability(self) -> Dict[str, Any]:
        """Check if OpenAI is available"""
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "Say 'OK'"}],
                max_tokens=10
            )
            return {
                "available": True,
                "provider": LLMProvider.OPENAI,
                "model": self.model
            }
        except Exception as e:
            return {
                "available": False,
                "provider": LLMProvider.OPENAI,
                "error": str(e)
            }

    async def complete(self,
                      prompt: str,
                      system_prompt: Optional[str] = None,
                      max_tokens: int = 4096,
                      temperature: float = 0.0,
                      **kwargs) -> str:
        """Generate completion using OpenAI"""
        messages = []

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            **kwargs
        )

        return response.choices[0].message.content

    def get_model_info(self) -> Dict[str, Any]:
        """Get OpenAI model info"""
        return {
            "provider": "OpenAI",
            "model": self.model,
            "supports_json_mode": True,
            "max_tokens": 128000 if "gpt-4" in self.model else 16384
        }


class AzureOpenAIProvider(OpenAIProvider):
    """Azure OpenAI provider"""

    def __init__(self, config: Dict[str, Any]):
        # Don't call parent __init__ yet
        self.config = config
        self.provider_name = self.__class__.__name__

        # Azure specific configuration
        api_key = config.get('api_key') or os.environ.get('AZURE_OPENAI_API_KEY')
        endpoint = config.get('endpoint') or os.environ.get('AZURE_OPENAI_ENDPOINT')
        deployment = config.get('deployment_name') or os.environ.get('AZURE_OPENAI_DEPLOYMENT')
        api_version = config.get('api_version', '2024-02-01')

        if not all([api_key, endpoint, deployment]):
            raise ValueError("Azure OpenAI requires api_key, endpoint, and deployment_name")

        self.client = AsyncAzureOpenAI(
            api_key=api_key,
            azure_endpoint=endpoint,
            azure_deployment=deployment,
            api_version=api_version
        )

        self.model = deployment  # In Azure, deployment name is used instead of model

    async def check_availability(self) -> Dict[str, Any]:
        """Check if Azure OpenAI is available"""
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "Say 'OK'"}],
                max_tokens=10
            )
            return {
                "available": True,
                "provider": LLMProvider.AZURE_OPENAI,
                "deployment": self.model
            }
        except Exception as e:
            return {
                "available": False,
                "provider": LLMProvider.AZURE_OPENAI,
                "error": str(e)
            }

    def get_model_info(self) -> Dict[str, Any]:
        """Get Azure OpenAI model info"""
        return {
            "provider": "Azure OpenAI",
            "deployment": self.model,
            "supports_json_mode": True,
            "api_version": self.client._api_version
        }
