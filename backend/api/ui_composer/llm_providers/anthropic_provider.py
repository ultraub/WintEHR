"""
Anthropic Claude Provider Implementation
Uses the existing claude_integration_service
"""

import logging
from typing import Dict, Any, Optional

from .base_provider import BaseLLMProvider, LLMProvider
from ..claude_integration_service import claude_integration_service

logger = logging.getLogger(__name__)

class AnthropicProvider(BaseLLMProvider):
    """Anthropic Claude provider using existing integration"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.service = claude_integration_service
        self.model = config.get('model', 'claude-3-5-sonnet-20241022')

    async def check_availability(self) -> Dict[str, Any]:
        """Check if Claude is available"""
        status = await self.service.get_status()
        return {
            "available": len(status.get("available_methods", [])) > 0,
            "provider": LLMProvider.ANTHROPIC,
            "model": self.model,
            "methods": status.get("available_methods", [])
        }

    async def complete(self,
                      prompt: str,
                      system_prompt: Optional[str] = None,
                      max_tokens: int = 4096,
                      temperature: float = 0.0,
                      **kwargs) -> str:
        """Generate completion using Claude"""
        full_prompt = prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n{prompt}"

        return await self.service.complete(
            prompt=full_prompt,
            options={
                "model": self.model,
                "max_tokens": max_tokens,
                "temperature": temperature
            }
        )

    def get_model_info(self) -> Dict[str, Any]:
        """Get Claude model info"""
        return {
            "provider": "Anthropic Claude",
            "model": self.model,
            "supports_json_mode": False,
            "max_tokens": 200000
        }
