"""
FHIR Version-Aware API Router
Handles routing and content negotiation for multiple FHIR versions (R4, R5, R6)
"""

from fastapi import APIRouter, Request, Response, HTTPException, Header, Depends
from fastapi.responses import JSONResponse
from typing import Dict, Any, Optional, List
import logging
import json

from fhir.core.versioning.negotiator import FHIRVersion, version_negotiator, NegotiationResult
from fhir.core.versioning.transformer import fhir_transformer
from fhir.core.storage import FHIRStorageEngine
from database import get_db_session

logger = logging.getLogger(__name__)

class VersionAwareFHIRRouter:
    """
    Version-aware FHIR API router that handles content negotiation
    and automatic version transformation
    """
    
    def __init__(self):
        self.router = APIRouter()
        self.setup_routes()
    
    def setup_routes(self):
        """Setup version-aware FHIR routes"""
        
        # Multi-version endpoints
        self.router.add_api_route(
            "/fhir/{version}/{resource_type}",
            self.create_resource_versioned,
            methods=["POST"],
            summary="Create FHIR resource (version-specific)"
        )
        
        self.router.add_api_route(
            "/fhir/{version}/{resource_type}/{resource_id}",
            self.update_resource_versioned,
            methods=["PUT"],
            summary="Update FHIR resource (version-specific)"
        )
        
        self.router.add_api_route(
            "/fhir/{version}/{resource_type}/{resource_id}",
            self.get_resource_versioned,
            methods=["GET"],
            summary="Get FHIR resource (version-specific)"
        )
        
        self.router.add_api_route(
            "/fhir/{version}/{resource_type}",
            self.search_resources_versioned,
            methods=["GET"],
            summary="Search FHIR resources (version-specific)"
        )
        
        # Content negotiation endpoints (auto-detect version)
        self.router.add_api_route(
            "/fhir/{resource_type}",
            self.create_resource_negotiated,
            methods=["POST"],
            summary="Create FHIR resource (content negotiation)"
        )
        
        self.router.add_api_route(
            "/fhir/{resource_type}/{resource_id}",
            self.update_resource_negotiated,
            methods=["PUT"],
            summary="Update FHIR resource (content negotiation)"
        )
        
        self.router.add_api_route(
            "/fhir/{resource_type}/{resource_id}",
            self.get_resource_negotiated,
            methods=["GET"],
            summary="Get FHIR resource (content negotiation)"
        )
        
        self.router.add_api_route(
            "/fhir/{resource_type}",
            self.search_resources_negotiated,
            methods=["GET"],
            summary="Search FHIR resources (content negotiation)"
        )
    
    def _parse_version(self, version: str) -> FHIRVersion:
        """Parse version string to FHIRVersion enum"""
        version_map = {
            'R4': FHIRVersion.R4,
            'r4': FHIRVersion.R4,
            '4.0': FHIRVersion.R4,
            '4.0.1': FHIRVersion.R4,
            'R5': FHIRVersion.R5,
            'r5': FHIRVersion.R5,
            '5.0': FHIRVersion.R5,
            '5.0.0': FHIRVersion.R5,
            'R6': FHIRVersion.R6,
            'r6': FHIRVersion.R6,
            '6.0': FHIRVersion.R6,
            '6.0.0': FHIRVersion.R6
        }
        
        fhir_version = version_map.get(version)
        if not fhir_version:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported FHIR version: {version}. Supported versions: R4, R5, R6"
            )
        return fhir_version
    
    def _negotiate_version(self, request: Request, 
                          accept_header: Optional[str] = None) -> NegotiationResult:
        """Negotiate FHIR version based on request headers"""
        
        # Extract client preferences from Accept header
        if accept_header:
            client_preferences = version_negotiator.extract_version_from_accept_header(accept_header)
        else:
            client_preferences = [FHIRVersion.R4]  # Default to R4
        
        # Server capabilities (all versions supported)
        server_capabilities = [FHIRVersion.R4, FHIRVersion.R5, FHIRVersion.R6]
        
        # Negotiate version
        return version_negotiator.negotiate_version(
            client_preferences=client_preferences,
            server_capabilities=server_capabilities
        )
    
    def _transform_response(self, resource: Dict[str, Any], 
                           target_version: FHIRVersion) -> Dict[str, Any]:
        """Transform response to target FHIR version"""
        
        if not resource:
            return resource
        
        # Handle Bundle resources
        if resource.get('resourceType') == 'Bundle':
            return fhir_transformer.transform_bundle(resource, target_version)
        
        # Handle single resources
        transformation_result = fhir_transformer.transform_resource(resource, target_version)
        
        if not transformation_result.success:
            logger.warning(f"Response transformation failed: {transformation_result.warnings}")
        
        return transformation_result.transformed_resource
    
    def _create_fhir_response(self, data: Dict[str, Any], 
                             target_version: FHIRVersion,
                             status_code: int = 200) -> Response:
        """Create FHIR-compliant response with proper headers"""
        
        # Transform data to target version
        transformed_data = self._transform_response(data, target_version)
        
        # Set appropriate content type with version
        content_type = f"application/fhir+json; fhirVersion={target_version.value}"
        
        return JSONResponse(
            content=transformed_data,
            status_code=status_code,
            headers={
                "Content-Type": content_type,
                "X-FHIR-Version": target_version.value
            }
        )
    
    # Version-specific endpoints
    async def create_resource_versioned(
        self,
        version: str,
        resource_type: str,
        resource_data: Dict[str, Any],
        request: Request,
        session = Depends(get_db_session)
    ):
        """Create resource with explicit version"""
        
        target_version = self._parse_version(version)
        storage = FHIRStorageEngine(session, target_version)
        
        try:
            fhir_id, version_id, last_updated = await storage.create_resource(
                resource_type, resource_data, target_version=target_version
            )
            
            # Get created resource
            resource = await storage.get_resource(resource_type, fhir_id)
            
            return self._create_fhir_response(resource, target_version, 201)
            
        except Exception as e:
            logger.error(f"Failed to create {resource_type}: {e}")
            raise HTTPException(status_code=400, detail=str(e))
    
    async def update_resource_versioned(
        self,
        version: str,
        resource_type: str,
        resource_id: str,
        resource_data: Dict[str, Any],
        request: Request,
        session = Depends(get_db_session)
    ):
        """Update resource with explicit version"""
        
        target_version = self._parse_version(version)
        storage = FHIRStorageEngine(session, target_version)
        
        try:
            version_id, last_updated = await storage.update_resource(
                resource_type, resource_id, resource_data, target_version=target_version
            )
            
            # Get updated resource
            resource = await storage.get_resource(resource_type, resource_id)
            
            return self._create_fhir_response(resource, target_version)
            
        except Exception as e:
            logger.error(f"Failed to update {resource_type}/{resource_id}: {e}")
            raise HTTPException(status_code=400, detail=str(e))
    
    async def get_resource_versioned(
        self,
        version: str,
        resource_type: str,
        resource_id: str,
        request: Request,
        session = Depends(get_db_session)
    ):
        """Get resource with explicit version"""
        
        target_version = self._parse_version(version)
        storage = FHIRStorageEngine(session, target_version)
        
        try:
            resource = await storage.get_resource(resource_type, resource_id)
            
            if not resource:
                raise HTTPException(status_code=404, detail=f"{resource_type}/{resource_id} not found")
            
            return self._create_fhir_response(resource, target_version)
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to get {resource_type}/{resource_id}: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    async def search_resources_versioned(
        self,
        version: str,
        resource_type: str,
        request: Request,
        session = Depends(get_db_session)
    ):
        """Search resources with explicit version"""
        
        target_version = self._parse_version(version)
        storage = FHIRStorageEngine(session, target_version)
        
        try:
            # Extract search parameters from query string
            search_params = dict(request.query_params)
            
            # Get pagination parameters
            count = int(search_params.get('_count', 10))
            page = int(search_params.get('_page', 1))
            offset = (page - 1) * count
            
            # Search resources
            resources, total = await storage.search_resources(
                resource_type, 
                search_params,
                offset=offset,
                limit=count
            )
            
            # Build bundle
            bundle = {
                "resourceType": "Bundle",
                "type": "searchset",
                "total": total,
                "entry": [
                    {
                        "fullUrl": f"{resource_type}/{res.get('id')}",
                        "resource": res
                    }
                    for res in resources
                ]
            }
            
            return self._create_fhir_response(bundle, target_version)
            
        except Exception as e:
            logger.error(f"Failed to search {resource_type}: {e}")
            raise HTTPException(status_code=400, detail=str(e))
    
    # Content negotiation endpoints
    async def create_resource_negotiated(
        self,
        resource_type: str,
        resource_data: Dict[str, Any],
        request: Request,
        accept: Optional[str] = Header(None),
        session = Depends(get_db_session)
    ):
        """Create resource with content negotiation"""
        
        negotiation_result = self._negotiate_version(request, accept)
        target_version = negotiation_result.target_version
        
        storage = FHIRStorageEngine(session, target_version)
        
        try:
            fhir_id, version_id, last_updated = await storage.create_resource(
                resource_type, resource_data, target_version=target_version
            )
            
            resource = await storage.get_resource(resource_type, fhir_id)
            
            return self._create_fhir_response(resource, target_version, 201)
            
        except Exception as e:
            logger.error(f"Failed to create {resource_type}: {e}")
            raise HTTPException(status_code=400, detail=str(e))
    
    async def update_resource_negotiated(
        self,
        resource_type: str,
        resource_id: str,
        resource_data: Dict[str, Any],
        request: Request,
        accept: Optional[str] = Header(None),
        session = Depends(get_db_session)
    ):
        """Update resource with content negotiation"""
        
        negotiation_result = self._negotiate_version(request, accept)
        target_version = negotiation_result.target_version
        
        storage = FHIRStorageEngine(session, target_version)
        
        try:
            version_id, last_updated = await storage.update_resource(
                resource_type, resource_id, resource_data, target_version=target_version
            )
            
            resource = await storage.get_resource(resource_type, resource_id)
            
            return self._create_fhir_response(resource, target_version)
            
        except Exception as e:
            logger.error(f"Failed to update {resource_type}/{resource_id}: {e}")
            raise HTTPException(status_code=400, detail=str(e))
    
    async def get_resource_negotiated(
        self,
        resource_type: str,
        resource_id: str,
        request: Request,
        accept: Optional[str] = Header(None),
        session = Depends(get_db_session)
    ):
        """Get resource with content negotiation"""
        
        negotiation_result = self._negotiate_version(request, accept)
        target_version = negotiation_result.target_version
        
        storage = FHIRStorageEngine(session, target_version)
        
        try:
            resource = await storage.get_resource(resource_type, resource_id)
            
            if not resource:
                raise HTTPException(status_code=404, detail=f"{resource_type}/{resource_id} not found")
            
            return self._create_fhir_response(resource, target_version)
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to get {resource_type}/{resource_id}: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    async def search_resources_negotiated(
        self,
        resource_type: str,
        request: Request,
        accept: Optional[str] = Header(None),
        session = Depends(get_db_session)
    ):
        """Search resources with content negotiation"""
        
        negotiation_result = self._negotiate_version(request, accept)
        target_version = negotiation_result.target_version
        
        storage = FHIRStorageEngine(session, target_version)
        
        try:
            # Extract search parameters from query string
            search_params = dict(request.query_params)
            
            # Get pagination parameters
            count = int(search_params.get('_count', 10))
            page = int(search_params.get('_page', 1))
            offset = (page - 1) * count
            
            # Search resources - returns tuple (resources, total)
            resources, total = await storage.search_resources(
                resource_type, 
                search_params,
                offset=offset,
                limit=count
            )
            
            # Build bundle
            bundle = {
                "resourceType": "Bundle",
                "type": "searchset",
                "total": total,
                "entry": [
                    {
                        "fullUrl": f"{resource_type}/{res.get('id')}",
                        "resource": res
                    }
                    for res in resources
                ]
            }
            
            return self._create_fhir_response(bundle, target_version)
            
        except Exception as e:
            logger.error(f"Failed to search {resource_type}: {e}")
            raise HTTPException(status_code=400, detail=str(e))

# Global router instance
version_aware_router = VersionAwareFHIRRouter()
router = version_aware_router.router