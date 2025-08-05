"""
Provider Directory API endpoints
Adapts FHIR Practitioner resources to provider directory format
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List, Dict, Any
from database import get_async_session
from sqlalchemy.ext.asyncio import AsyncSession
import json

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
        # Build base query for Practitioner resources
        query = """
            SELECT id, fhir_id, resource
            FROM fhir.resources
            WHERE resource_type = 'Practitioner'
            AND deleted = false
        """
        
        # Add name filter if provided
        if name:
            query += f" AND resource::text ILIKE '%{name}%'"
        
        # Execute query
        result = await db.execute(query)
        rows = result.fetchall()
        
        providers = []
        for row in rows:
            resource = json.loads(row.resource) if isinstance(row.resource, str) else row.resource
            
            # Extract provider info
            provider_name = resource.get('name', [{}])[0]
            
            provider = {
                'id': row.fhir_id,
                'name': {
                    'given': provider_name.get('given', []),
                    'family': provider_name.get('family', ''),
                    'prefix': provider_name.get('prefix', []),
                    'suffix': provider_name.get('suffix', [])
                },
                'active': resource.get('active', True),
                'gender': resource.get('gender'),
                'qualification': resource.get('qualification', []),
                'telecom': resource.get('telecom', []),
                'address': resource.get('address', [])
            }
            
            # Filter by active status
            if active_only and not provider['active']:
                continue
                
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
        query = """
            SELECT resource
            FROM fhir.resources
            WHERE resource_type = 'Practitioner'
            AND fhir_id = :practitioner_id
            AND deleted = false
        """
        
        result = await db.execute(query, {'practitioner_id': practitioner_id})
        row = result.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Provider not found")
        
        resource = json.loads(row.resource) if isinstance(row.resource, str) else row.resource
        
        return {
            'profile': resource,
            'roles': []  # TODO: Fetch PractitionerRole resources
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
        # Query for PractitionerRole resources
        query = """
            SELECT resource
            FROM fhir.resources
            WHERE resource_type = 'PractitionerRole'
            AND resource::text LIKE :practitioner_ref
            AND deleted = false
        """
        
        practitioner_ref = f'%Practitioner/{practitioner_id}%'
        result = await db.execute(query, {'practitioner_ref': practitioner_ref})
        rows = result.fetchall()
        
        roles = []
        for row in rows:
            resource = json.loads(row.resource) if isinstance(row.resource, str) else row.resource
            roles.append(resource)
        
        return {'roles': roles}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/specialties")
async def get_specialties(db: AsyncSession = Depends(get_async_session)):
    """Get list of available specialties."""
    try:
        # Query for unique specialties from PractitionerRole resources
        query = """
            SELECT DISTINCT 
                jsonb_array_elements(resource::jsonb->'specialty')->>'text' as specialty
            FROM fhir.resources
            WHERE resource_type = 'PractitionerRole'
            AND deleted = false
            AND resource::jsonb->'specialty' IS NOT NULL
        """
        
        result = await db.execute(query)
        rows = result.fetchall()
        
        specialties = [row.specialty for row in rows if row.specialty]
        
        return {
            'specialties': sorted(list(set(specialties))),
            'total': len(specialties)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/organizations")
async def get_organizations(db: AsyncSession = Depends(get_async_session)):
    """Get list of available organizations."""
    try:
        query = """
            SELECT id, fhir_id, resource
            FROM fhir.resources
            WHERE resource_type = 'Organization'
            AND deleted = false
        """
        
        result = await db.execute(query)
        rows = result.fetchall()
        
        organizations = []
        for row in rows:
            resource = json.loads(row.resource) if isinstance(row.resource, str) else row.resource
            organizations.append({
                'id': row.fhir_id,
                'name': resource.get('name'),
                'type': resource.get('type', []),
                'active': resource.get('active', True)
            })
        
        return {
            'organizations': organizations,
            'total': len(organizations)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))