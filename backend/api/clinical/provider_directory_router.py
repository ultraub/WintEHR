"""
Provider Directory API Router

FastAPI router for provider directory operations including provider search,
geographic search, and organizational hierarchy management.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from datetime import datetime

from database import get_db_session as get_session
from fhir.core.storage import FHIRStorageEngine
from api.services.clinical.provider_directory_service import ProviderDirectoryService
from api.auth.service import get_optional_current_user, get_current_user_or_demo
from api.auth.models import User

router = APIRouter(prefix="/provider-directory", tags=["provider-directory"])


# ============================================================================
# Request/Response Models
# ============================================================================

class ProviderSearchResponse(BaseModel):
    """Response model for provider search operations."""
    providers: List[Dict[str, Any]]
    total: int
    search_parameters: Dict[str, Any]


class LocationSearchResponse(BaseModel):
    """Response model for location search operations."""
    locations: List[Dict[str, Any]]
    total: int
    center_coordinates: Optional[Dict[str, float]] = None
    search_radius_km: Optional[float] = None


class OrganizationHierarchyResponse(BaseModel):
    """Response model for organizational hierarchy."""
    organization: Dict[str, Any]
    hierarchy: Dict[str, Any]


class GeographicSearchRequest(BaseModel):
    """Request model for geographic searches."""
    latitude: float = Field(..., ge=-90, le=90, description="Latitude coordinate")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude coordinate")
    distance_km: float = Field(50, ge=1, le=500, description="Search radius in kilometers")
    specialty_code: Optional[str] = Field(None, description="Optional specialty filter")


# ============================================================================
# Provider Search Endpoints
# ============================================================================

@router.get("/providers/search", response_model=ProviderSearchResponse)
async def search_providers(
    specialty: Optional[str] = Query(None, description="Specialty code filter"),
    location_id: Optional[str] = Query(None, description="Location ID filter"),
    organization_id: Optional[str] = Query(None, description="Organization ID filter"),
    name: Optional[str] = Query(None, description="Provider name search"),
    active_only: bool = Query(True, description="Only return active providers"),
    session: AsyncSession = Depends(get_session),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Search for healthcare providers with various filters.
    """
    try:
        storage = FHIRStorageEngine(session)
        provider_service = ProviderDirectoryService(storage)
        
        providers = []
        search_params = {
            "specialty": specialty,
            "location_id": location_id,
            "organization_id": organization_id,
            "name": name,
            "active_only": active_only
        }
        
        if specialty:
            providers = await provider_service.search_practitioners_by_specialty(
                specialty, location_id
            )
        elif organization_id:
            providers = await provider_service.search_providers_by_organization(
                organization_id
            )
        else:
            # Generic provider search - implement as needed
            providers = []
        
        # Filter by active status if requested
        if active_only:
            providers = [p for p in providers if p.get('active', True)]
        
        # Filter by name if provided
        if name:
            name_lower = name.lower()
            providers = [
                p for p in providers 
                if name_lower in p.get('name', '').lower()
            ]
        
        return ProviderSearchResponse(
            providers=providers,
            total=len(providers),
            search_parameters=search_params
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching providers: {str(e)}")


@router.get("/providers/{practitioner_id}/profile")
async def get_provider_profile(
    practitioner_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Get complete provider profile including roles, specialties, and locations.
    """
    try:
        storage = FHIRStorageEngine(session)
        provider_service = ProviderDirectoryService(storage)
        
        profile = await provider_service.get_provider_profile(practitioner_id)
        
        if not profile:
            raise HTTPException(status_code=404, detail="Provider not found")
        
        return profile
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting provider profile: {str(e)}")


@router.get("/providers/current-user/profile")
async def get_current_user_provider_profile(
    session: AsyncSession = Depends(get_session),
    current_user: Dict[str, Any] = Depends(get_current_user_or_demo)
):
    """
    Get provider profile for the current user.
    Returns a mock profile for demo purposes.
    """
    try:
        # In a real implementation, this would map the current user to their practitioner resource
        # For now, return a simple mock profile to prevent 404 errors
        
        profile = {
            "resourceType": "Practitioner",
            "id": f"practitioner-{current_user.get('username', 'demo')}",
            "active": True,
            "name": [{
                "use": "official",
                "text": current_user.get('display_name', 'Current User'),
                "family": "User",
                "given": ["Current"]
            }],
            "identifier": [{
                "system": "internal",
                "value": current_user.get('username', 'demo')
            }],
            "qualification": [{
                "code": {
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/v3-EducationLevel",
                        "code": "MD",
                        "display": "Doctor of Medicine"
                    }]
                }
            }]
        }
        
        return profile
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting current user profile: {str(e)}")


@router.get("/providers/{practitioner_id}/roles")
async def get_provider_roles(
    practitioner_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Get all roles for a practitioner across organizations and locations.
    """
    try:
        storage = FHIRStorageEngine(session)
        provider_service = ProviderDirectoryService(storage)
        
        roles = await provider_service.get_practitioner_roles(practitioner_id)
        
        return {
            "practitioner_id": practitioner_id,
            "roles": roles,
            "total": len(roles)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting provider roles: {str(e)}")


@router.get("/providers/{practitioner_id}/specialties")
async def get_provider_specialties(
    practitioner_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Get all specialties for a practitioner.
    """
    try:
        storage = FHIRStorageEngine(session)
        provider_service = ProviderDirectoryService(storage)
        
        specialties = await provider_service.get_provider_specialties(practitioner_id)
        
        return {
            "practitioner_id": practitioner_id,
            "specialties": specialties,
            "total": len(specialties)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting provider specialties: {str(e)}")


@router.get("/providers/{practitioner_id}/locations")
async def get_provider_locations(
    practitioner_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Get all locations where a practitioner provides services.
    """
    try:
        storage = FHIRStorageEngine(session)
        provider_service = ProviderDirectoryService(storage)
        
        locations = await provider_service.get_provider_locations(practitioner_id)
        
        return {
            "practitioner_id": practitioner_id,
            "locations": locations,
            "total": len(locations)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting provider locations: {str(e)}")


# ============================================================================
# Geographic Search Endpoints
# ============================================================================

@router.get("/providers/near", response_model=ProviderSearchResponse)
async def search_providers_near_location(
    latitude: float = Query(..., ge=-90, le=90, description="Latitude coordinate"),
    longitude: float = Query(..., ge=-180, le=180, description="Longitude coordinate"),
    distance_km: float = Query(50, ge=1, le=500, description="Search radius in kilometers"),
    specialty_code: Optional[str] = Query(None, description="Optional specialty filter"),
    session: AsyncSession = Depends(get_session),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Search for providers within geographic distance with optional specialty filtering.
    """
    try:
        storage = FHIRStorageEngine(session)
        provider_service = ProviderDirectoryService(storage)
        
        providers = await provider_service.search_providers_near_location(
            latitude, longitude, distance_km, specialty_code
        )
        
        search_params = {
            "latitude": latitude,
            "longitude": longitude,
            "distance_km": distance_km,
            "specialty_code": specialty_code
        }
        
        return ProviderSearchResponse(
            providers=providers,
            total=len(providers),
            search_parameters=search_params
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching providers near location: {str(e)}")


@router.post("/providers/near", response_model=ProviderSearchResponse)
async def search_providers_near_location_post(
    request: GeographicSearchRequest,
    session: AsyncSession = Depends(get_session),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Search for providers within geographic distance (POST version with request body).
    """
    try:
        storage = FHIRStorageEngine(session)
        provider_service = ProviderDirectoryService(storage)
        
        providers = await provider_service.search_providers_near_location(
            request.latitude, request.longitude, request.distance_km, request.specialty_code
        )
        
        search_params = request.dict()
        
        return ProviderSearchResponse(
            providers=providers,
            total=len(providers),
            search_parameters=search_params
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching providers near location: {str(e)}")


@router.get("/locations/near", response_model=LocationSearchResponse)
async def search_locations_near(
    latitude: float = Query(..., ge=-90, le=90, description="Latitude coordinate"),
    longitude: float = Query(..., ge=-180, le=180, description="Longitude coordinate"),
    distance_km: float = Query(50, ge=1, le=500, description="Search radius in kilometers"),
    location_type: Optional[str] = Query(None, description="Location type filter"),
    session: AsyncSession = Depends(get_session),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Search for locations within geographic distance.
    """
    try:
        storage = FHIRStorageEngine(session)
        provider_service = ProviderDirectoryService(storage)
        
        locations = await provider_service.geographic_location_search(
            latitude, longitude, distance_km
        )
        
        # Filter by location type if provided
        if location_type:
            locations = [
                loc for loc in locations
                if any(
                    type_coding.get('coding', [{}])[0].get('code') == location_type
                    for type_coding in loc.get('type', [])
                )
            ]
        
        return LocationSearchResponse(
            locations=locations,
            total=len(locations),
            center_coordinates={"latitude": latitude, "longitude": longitude},
            search_radius_km=distance_km
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching locations near coordinates: {str(e)}")


# ============================================================================
# Organization and Location Hierarchy Endpoints
# ============================================================================

@router.get("/organizations/{organization_id}/hierarchy", response_model=OrganizationHierarchyResponse)
async def get_organization_hierarchy(
    organization_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Get organizational hierarchy for an organization.
    """
    try:
        storage = FHIRStorageEngine(session)
        provider_service = ProviderDirectoryService(storage)
        
        hierarchy = await provider_service.get_organizational_hierarchy(organization_id)
        
        if not hierarchy:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        return OrganizationHierarchyResponse(
            organization=hierarchy['organization'],
            hierarchy=hierarchy
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting organization hierarchy: {str(e)}")


@router.get("/organizations/{organization_id}/providers")
async def get_organization_providers(
    organization_id: str,
    active_only: bool = Query(True, description="Only return active providers"),
    session: AsyncSession = Depends(get_session),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Get all providers associated with an organization.
    """
    try:
        storage = FHIRStorageEngine(session)
        provider_service = ProviderDirectoryService(storage)
        
        providers = await provider_service.search_providers_by_organization(organization_id)
        
        # Filter by active status if requested
        if active_only:
            providers = [p for p in providers if p.get('active', True)]
        
        return {
            "organization_id": organization_id,
            "providers": providers,
            "total": len(providers)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting organization providers: {str(e)}")


@router.get("/locations/{location_id}/hierarchy")
async def get_location_hierarchy(
    location_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Get location hierarchy for a location.
    """
    try:
        storage = FHIRStorageEngine(session)
        provider_service = ProviderDirectoryService(storage)
        
        hierarchy = await provider_service.get_location_hierarchy(location_id)
        
        if not hierarchy:
            raise HTTPException(status_code=404, detail="Location not found")
        
        return hierarchy
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting location hierarchy: {str(e)}")


@router.get("/locations/{location_id}/providers")
async def get_location_providers(
    location_id: str,
    active_only: bool = Query(True, description="Only return active providers"),
    session: AsyncSession = Depends(get_session),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Get all providers who provide services at a specific location.
    """
    try:
        storage = FHIRStorageEngine(session)
        provider_service = ProviderDirectoryService(storage)
        
        # Search for practitioner roles at this location
        search_params = {
            'location': f"Location/{location_id}"
        }
        
        roles_response = await storage.search_resources('PractitionerRole', search_params)
        providers = []
        
        for entry in roles_response.get('entry', []):
            role_resource = entry['resource']
            
            practitioner_ref = role_resource.get('practitioner', {}).get('reference', '')
            if practitioner_ref:
                practitioner_id = practitioner_ref.split('/')[-1]
                provider_profile = await provider_service.get_provider_profile(practitioner_id)
                
                if provider_profile:
                    # Filter by active status if requested
                    if not active_only or provider_profile.get('active', True):
                        providers.append(provider_profile)
        
        return {
            "location_id": location_id,
            "providers": providers,
            "total": len(providers)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting location providers: {str(e)}")


# ============================================================================
# Utility Endpoints
# ============================================================================

@router.get("/specialties")
async def get_available_specialties(
    session: AsyncSession = Depends(get_session),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Get all available provider specialties in the system.
    """
    try:
        storage = FHIRStorageEngine(session)
        
        # Search all PractitionerRole resources to get unique specialties
        roles_response = await storage.search_resources('PractitionerRole', {})
        
        # Handle different response formats from search_resources
        entries = []
        if isinstance(roles_response, tuple):
            # If it's a tuple, first element might be the data
            data = roles_response[0] if roles_response else []
            if isinstance(data, dict) and 'entry' in data:
                entries = data.get('entry', [])
            elif isinstance(data, list):
                entries = data
        elif isinstance(roles_response, dict) and 'entry' in roles_response:
            entries = roles_response.get('entry', [])
        elif isinstance(roles_response, list):
            entries = roles_response
            
        specialties = []
        specialty_codes = set()
        
        for entry in entries:
            # Handle both direct resources and bundle entries
            if isinstance(entry, dict):
                role_resource = entry.get('resource', entry)
            
            for specialty in role_resource.get('specialty', []):
                for coding in specialty.get('coding', []):
                    code = coding.get('code')
                    if code and code not in specialty_codes:
                        specialty_codes.add(code)
                        specialties.append({
                            'code': code,
                            'display': coding.get('display', code),
                            'system': coding.get('system', '')
                        })
        
        return {
            "specialties": sorted(specialties, key=lambda x: x['display']),
            "total": len(specialties)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting available specialties: {str(e)}")


@router.get("/organizations")
async def get_available_organizations(
    active_only: bool = Query(True, description="Only return active organizations"),
    session: AsyncSession = Depends(get_session),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Get all available organizations in the system.
    """
    try:
        storage = FHIRStorageEngine(session)
        
        # For now, don't filter by active status
        # TODO: Fix search parameter handling
        search_params = {}
        
        orgs_response = await storage.search_resources('Organization', search_params)
        
        # Handle different response formats from search_resources
        entries = []
        if isinstance(orgs_response, tuple):
            # If it's a tuple, first element might be the data
            data = orgs_response[0] if orgs_response else []
            if isinstance(data, dict) and 'entry' in data:
                entries = data.get('entry', [])
            elif isinstance(data, list):
                entries = data
        elif isinstance(orgs_response, dict) and 'entry' in orgs_response:
            entries = orgs_response.get('entry', [])
        elif isinstance(orgs_response, list):
            entries = orgs_response
            
        organizations = []
        
        for entry in entries:
            try:
                # Handle both direct resources and bundle entries
                org = None
                if isinstance(entry, dict):
                    org = entry.get('resource', entry)
                else:
                    # Skip non-dict entries
                    continue
                    
                # Skip if not a proper dict
                if not isinstance(org, dict) or 'id' not in org:
                    continue
                    
                organizations.append({
                    'id': org.get('id', ''),
                    'name': org.get('name', ''),
                    'active': org.get('active', True),
                    'type': org.get('type', []),
                    'address': org.get('address', [])
                })
            except Exception:
                # Skip entries that cause errors
                continue
        
        return {
            "organizations": sorted(organizations, key=lambda x: x.get('name', '')),
            "total": len(organizations)
        }
        
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        raise HTTPException(status_code=500, detail=f"Error getting available organizations: {str(e)} - Traceback: {tb}")


@router.get("/health")
async def provider_directory_health():
    """Health check endpoint for provider directory service."""
    return {
        "status": "healthy",
        "service": "provider-directory",
        "version": "1.0.0",
        "timestamp": str(datetime.utcnow())
    }