"""
FHIR Reference Normalizer Middleware

Normalizes URN format references to standard FHIR references in API responses.
This ensures frontend compatibility by converting references like:
  urn:uuid:patient-uuid -> Patient/patient-id
"""

import json
import re
from typing import Dict, Any, Optional
import asyncpg
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, StreamingResponse
import logging

logger = logging.getLogger(__name__)


class ReferenceNormalizerMiddleware(BaseHTTPMiddleware):
    """Middleware to normalize URN references in FHIR responses."""
    
    def __init__(self, app, db_url: str):
        super().__init__(app)
        self.db_url = db_url
        self._uuid_to_id_cache = {}
        
    async def dispatch(self, request: Request, call_next):
        # Only process FHIR API responses
        if not request.url.path.startswith("/fhir/"):
            return await call_next(request)
            
        # Process the request normally
        response = await call_next(request)
        
        # Only process successful JSON responses
        if response.status_code != 200 or not self._is_json_response(response):
            return response
            
        # Read the response body
        body = b''
        async for chunk in response.body_iterator:
            body += chunk
            
        try:
            # Parse JSON
            data = json.loads(body.decode('utf-8'))
            
            # Normalize references in the response
            normalized_data = await self._normalize_references(data)
            
            # Create new response with normalized data
            normalized_body = json.dumps(normalized_data).encode('utf-8')
            
            return Response(
                content=normalized_body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type="application/json"
            )
            
        except Exception as e:
            logger.error(f"Error normalizing references: {e}")
            # Return original response if normalization fails
            return Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers)
            )
    
    def _is_json_response(self, response: Response) -> bool:
        """Check if response is JSON."""
        content_type = response.headers.get('content-type', '')
        return 'application/json' in content_type or 'application/fhir+json' in content_type
    
    async def _normalize_references(self, data: Any) -> Any:
        """Recursively normalize URN references in FHIR data."""
        if isinstance(data, dict):
            # Check if this is a reference object
            if 'reference' in data and isinstance(data['reference'], str):
                if data['reference'].startswith('urn:uuid:'):
                    # Normalize the URN reference
                    normalized_ref = await self._normalize_urn_reference(data['reference'])
                    if normalized_ref:
                        data['reference'] = normalized_ref
            
            # Recursively process all values
            for key, value in data.items():
                data[key] = await self._normalize_references(value)
                
        elif isinstance(data, list):
            # Process each item in the list
            for i, item in enumerate(data):
                data[i] = await self._normalize_references(item)
                
        return data
    
    async def _normalize_urn_reference(self, urn_reference: str) -> Optional[str]:
        """Convert URN reference to standard FHIR reference."""
        # Extract UUID from URN
        match = re.match(r'urn:uuid:([a-f0-9\-]+)', urn_reference, re.IGNORECASE)
        if not match:
            return None
            
        uuid = match.group(1)
        
        # Check cache first
        if uuid in self._uuid_to_id_cache:
            resource_type, resource_id = self._uuid_to_id_cache[uuid]
            return f"{resource_type}/{resource_id}"
        
        # Look up in database
        try:
            conn = await asyncpg.connect(self.db_url)
            
            # Query to find resource by UUID identifier
            query = """
                SELECT id::text as resource_id, resource_type
                FROM fhir.resources
                WHERE deleted = false
                AND resource->'identifier' @> %s::jsonb
                LIMIT 1
            """
            
            # Build identifier search pattern
            identifier_pattern = json.dumps([{"value": uuid}])
            
            result = await conn.fetchrow(query, identifier_pattern)
            await conn.close()
            
            if result:
                resource_type = result['resource_type']
                resource_id = result['resource_id']
                
                # Cache the mapping
                self._uuid_to_id_cache[uuid] = (resource_type, resource_id)
                
                return f"{resource_type}/{resource_id}"
                
        except Exception as e:
            logger.error(f"Error looking up UUID {uuid}: {e}")
            
        return None


def setup_reference_normalizer(app, db_url: str):
    """Setup the reference normalizer middleware."""
    app.add_middleware(ReferenceNormalizerMiddleware, db_url=db_url)