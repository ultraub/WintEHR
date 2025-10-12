"""
Provider Directory API endpoints
Adapts FHIR Practitioner resources to provider directory format
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List, Dict, Any
from database import get_async_session
from sqlalchemy.ext.asyncio import AsyncSession
from services.fhir_client_config import get_resource, search_resources

router = APIRouter(prefix="/api/provider-directory", tags=["provider-directory"])

@router.get("/providers/search")
async def search_providers(
    specialty: Optional[str] = Query(None),
    location_id: Optional[str] = Query(None),
    organization_id: Optional[str] = Query(None),
    name: Optional[str] = Query(None),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_async_session)
):
    """Search for providers based on various criteria."""
    try:
        # Search Practitioner resources from HAPI FHIR
        search_params = {}
        if name:
            search_params['name'] = name
        if active_only:
            search_params['active'] = 'true'

        practitioners = search_resources('Practitioner', search_params)

        providers = []
        if practitioners:
            for resource in practitioners:
                # Extract provider info
                provider_name = resource.name[0] if hasattr(resource, 'name') and resource.name else None

                provider = {
                    'id': resource.id if hasattr(resource, 'id') else None,
                    'name': {
                        'given': provider_name.given if provider_name and hasattr(provider_name, 'given') else [],
                        'family': provider_name.family if provider_name and hasattr(provider_name, 'family') else '',
                        'prefix': provider_name.prefix if provider_name and hasattr(provider_name, 'prefix') else [],
                        'suffix': provider_name.suffix if provider_name and hasattr(provider_name, 'suffix') else []
                    },
                    'active': resource.active if hasattr(resource, 'active') else True,
                    'gender': resource.gender if hasattr(resource, 'gender') else None,
                    'qualification': [q.as_json() if hasattr(q, 'as_json') else q for q in resource.qualification] if hasattr(resource, 'qualification') and resource.qualification else [],
                    'telecom': [t.as_json() if hasattr(t, 'as_json') else t for t in resource.telecom] if hasattr(resource, 'telecom') and resource.telecom else [],
                    'address': [a.as_json() if hasattr(a, 'as_json') else a for a in resource.address] if hasattr(resource, 'address') and resource.address else []
                }

                providers.append(provider)

        return {
            'providers': providers,
            'total': len(providers)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/providers/{practitioner_id}/profile")
async def get_provider_profile(
    practitioner_id: str,
    db: AsyncSession = Depends(get_async_session)
):
    """Get detailed profile for a specific provider."""
    try:
        # Get Practitioner from HAPI FHIR
        resource = get_resource('Practitioner', practitioner_id)

        if not resource:
            raise HTTPException(status_code=404, detail="Provider not found")

        # Convert to JSON
        profile = resource.as_json() if hasattr(resource, 'as_json') else resource

        return {
            'profile': profile,
            'roles': []  # Roles fetched via separate endpoint
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/providers/{practitioner_id}/roles")
async def get_provider_roles(
    practitioner_id: str,
    db: AsyncSession = Depends(get_async_session)
):
    """Get roles for a specific provider."""
    try:
        # Search for PractitionerRole resources from HAPI FHIR
        practitioner_roles = search_resources('PractitionerRole', {
            'practitioner': f'Practitioner/{practitioner_id}'
        })

        roles = []
        if practitioner_roles:
            for role in practitioner_roles:
                # Convert to JSON
                role_data = role.as_json() if hasattr(role, 'as_json') else role
                roles.append(role_data)

        return {'roles': roles}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/specialties")
async def get_specialties(db: AsyncSession = Depends(get_async_session)):
    """Get list of available specialties."""
    try:
        # Get all PractitionerRole resources from HAPI FHIR
        practitioner_roles = search_resources('PractitionerRole', {})

        # Extract unique specialties
        specialties_set = set()
        if practitioner_roles:
            for role in practitioner_roles:
                if hasattr(role, 'specialty') and role.specialty:
                    for specialty in role.specialty:
                        if hasattr(specialty, 'text'):
                            specialties_set.add(specialty.text)
                        elif hasattr(specialty, 'coding') and specialty.coding:
                            for coding in specialty.coding:
                                if hasattr(coding, 'display'):
                                    specialties_set.add(coding.display)

        specialties = sorted(list(specialties_set))

        return {
            'specialties': specialties,
            'total': len(specialties)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/organizations")
async def get_organizations(db: AsyncSession = Depends(get_async_session)):
    """Get list of available organizations."""
    try:
        # Get Organization resources from HAPI FHIR
        org_resources = search_resources('Organization', {})

        organizations = []
        if org_resources:
            for resource in org_resources:
                org_data = {
                    'id': resource.id if hasattr(resource, 'id') else None,
                    'name': resource.name if hasattr(resource, 'name') else None,
                    'type': [],
                    'active': resource.active if hasattr(resource, 'active') else True
                }

                # Extract organization types
                if hasattr(resource, 'type') and resource.type:
                    org_data['type'] = [t.as_json() if hasattr(t, 'as_json') else t for t in resource.type]

                organizations.append(org_data)

        return {
            'organizations': organizations,
            'total': len(organizations)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))