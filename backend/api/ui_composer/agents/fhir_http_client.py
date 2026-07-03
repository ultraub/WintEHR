"""
FHIR HTTP Client for Agent Pipeline
Uses the FHIR REST API instead of direct database access
"""

import os
import httpx
import logging
from typing import Dict, Any, Optional
from urllib.parse import urlencode

logger = logging.getLogger(__name__)

class FHIRHTTPClient:
    """HTTP client for FHIR REST API calls"""

    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url or f"{os.getenv('BACKEND_BASE_URL', 'http://localhost:8000')}/fhir/R4"
        self.client = None
    
    async def __aenter__(self):
        self.client = httpx.AsyncClient()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.client:
            await self.client.aclose()
    
    async def search_resources(self, resource_type: str, search_params: Dict[str, Any]) -> Dict[str, Any]:
        """Search for FHIR resources using the REST API"""
        try:
            # Build URL with query parameters
            url = f"{self.base_url}/{resource_type}"
            
            logger.info(f"FHIR search: {url} with params: {search_params}")
            
            response = await self.client.get(url, params=search_params)
            
            if response.status_code == 200:
                bundle = response.json()
                logger.info(f"FHIR search returned {bundle.get('total', 0)} results")
                return bundle
            else:
                logger.error(f"FHIR search failed: {response.status_code} - {response.text}")
                return {
                    "resourceType": "Bundle",
                    "type": "searchset",
                    "total": 0,
                    "entry": []
                }
                    
        except Exception as e:
            logger.error(f"Error in FHIR HTTP search: {e}")
            return {
                "resourceType": "Bundle",
                "type": "searchset",
                "total": 0,
                "entry": []
            }