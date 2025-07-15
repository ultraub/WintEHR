"""
Provider Directory Service

Comprehensive service for managing healthcare provider directory functionality
including PractitionerRole, Location, and Organization resources with geographic
search capabilities and multi-facility support.
"""

import math
import json
import logging
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timezone
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.fhir.storage import FHIRStorageEngine

logger = logging.getLogger(__name__)


class ProviderDirectoryService:
    """Service for provider directory operations with geographic and multi-facility support."""
    
    def __init__(self, storage_engine: FHIRStorageEngine):
        self.storage = storage_engine
        self.session = storage_engine.session
    
    # ============================================================================
    # Provider Search and Directory Operations
    # ============================================================================
    
    async def search_practitioners_by_specialty(self, specialty_code: str, location_id: str = None) -> List[Dict]:
        """
        Search practitioners by specialty with optional location filtering.
        
        Args:
            specialty_code: The specialty code to search for
            location_id: Optional location ID to filter by
            
        Returns:
            List of practitioner profiles with roles and specialties
        """
        try:
            # Build search query for PractitionerRole
            search_params = {
                'specialty': specialty_code
            }
            
            if location_id:
                search_params['location'] = f"Location/{location_id}"
            
            # Search PractitionerRole resources
            practitioner_roles = await self.storage.search_resources('PractitionerRole', search_params)
            
            # Resolve practitioner details for each role
            provider_profiles = []
            for role in practitioner_roles.get('entry', []):
                role_resource = role['resource']
                
                # Get practitioner details
                practitioner_ref = role_resource.get('practitioner', {}).get('reference', '')
                if practitioner_ref:
                    practitioner_id = practitioner_ref.split('/')[-1]
                    practitioner = await self.storage.read_resource('Practitioner', practitioner_id)
                    
                    # Get location details
                    locations = []
                    for loc_ref in role_resource.get('location', []):
                        location_ref = loc_ref.get('reference', '')
                        if location_ref:
                            location_id = location_ref.split('/')[-1]
                            location = await self.storage.read_resource('Location', location_id)
                            if location:
                                locations.append(location)
                    
                    # Get organization details
                    org_ref = role_resource.get('organization', {}).get('reference', '')
                    organization = None
                    if org_ref:
                        org_id = org_ref.split('/')[-1]
                        organization = await self.storage.read_resource('Organization', org_id)
                    
                    provider_profile = {
                        'practitioner': practitioner,
                        'role': role_resource,
                        'locations': locations,
                        'organization': organization,
                        'specialties': role_resource.get('specialty', []),
                        'active': role_resource.get('active', True)
                    }
                    
                    provider_profiles.append(provider_profile)
            
            return provider_profiles
            
        except Exception as e:
            logger.error(f"Error searching practitioners by specialty {specialty_code}: {e}")
            return []
    
    async def get_practitioner_roles(self, practitioner_id: str) -> List[Dict]:
        """
        Get all roles for a practitioner across organizations and locations.
        
        Args:
            practitioner_id: The practitioner ID
            
        Returns:
            List of practitioner roles with associated organizations and locations
        """
        try:
            # Search for all roles for this practitioner
            search_params = {
                'practitioner': f"Practitioner/{practitioner_id}"
            }
            
            roles_response = await self.storage.search_resources('PractitionerRole', search_params)
            roles = []
            
            for entry in roles_response.get('entry', []):
                role_resource = entry['resource']
                
                # Get organization details
                org_ref = role_resource.get('organization', {}).get('reference', '')
                organization = None
                if org_ref:
                    org_id = org_ref.split('/')[-1]
                    organization = await self.storage.read_resource('Organization', org_id)
                
                # Get location details
                locations = []
                for loc_ref in role_resource.get('location', []):
                    location_ref = loc_ref.get('reference', '')
                    if location_ref:
                        location_id = location_ref.split('/')[-1]
                        location = await self.storage.read_resource('Location', location_id)
                        if location:
                            locations.append(location)
                
                role_data = {
                    'role': role_resource,
                    'organization': organization,
                    'locations': locations,
                    'specialties': role_resource.get('specialty', []),
                    'code': role_resource.get('code', []),
                    'period': role_resource.get('period'),
                    'active': role_resource.get('active', True)
                }
                
                roles.append(role_data)
            
            return roles
            
        except Exception as e:
            logger.error(f"Error getting practitioner roles for {practitioner_id}: {e}")
            return []
    
    async def get_provider_profile(self, practitioner_id: str) -> Optional[Dict]:
        """
        Get complete provider profile with all roles, specialties, and locations.
        
        Args:
            practitioner_id: The practitioner ID
            
        Returns:
            Complete provider profile or None if not found
        """
        try:
            # Get practitioner resource
            practitioner = await self.storage.read_resource('Practitioner', practitioner_id)
            if not practitioner:
                return None
            
            # Get all roles for this practitioner
            roles = await self.get_practitioner_roles(practitioner_id)
            
            # Aggregate unique specialties and locations
            all_specialties = []
            all_locations = []
            all_organizations = []
            
            specialty_codes = set()
            location_ids = set()
            org_ids = set()
            
            for role_data in roles:
                # Collect unique specialties
                for specialty in role_data['specialties']:
                    specialty_code = specialty.get('coding', [{}])[0].get('code')
                    if specialty_code and specialty_code not in specialty_codes:
                        specialty_codes.add(specialty_code)
                        all_specialties.append(specialty)
                
                # Collect unique locations
                for location in role_data['locations']:
                    location_id = location.get('id')
                    if location_id and location_id not in location_ids:
                        location_ids.add(location_id)
                        all_locations.append(location)
                
                # Collect unique organizations
                if role_data['organization']:
                    org_id = role_data['organization'].get('id')
                    if org_id and org_id not in org_ids:
                        org_ids.add(org_id)
                        all_organizations.append(role_data['organization'])
            
            # Get primary location (first active location)
            primary_location = None
            for location in all_locations:
                if location.get('status') == 'active':
                    primary_location = location
                    break
            
            if not primary_location and all_locations:
                primary_location = all_locations[0]
            
            provider_profile = {
                'id': practitioner_id,
                'practitioner': practitioner,
                'roles': roles,
                'specialties': all_specialties,
                'locations': all_locations,
                'organizations': all_organizations,
                'primaryLocation': primary_location,
                'name': self._get_practitioner_display_name(practitioner),
                'active': any(role_data['active'] for role_data in roles)
            }
            
            return provider_profile
            
        except Exception as e:
            logger.error(f"Error getting provider profile for {practitioner_id}: {e}")
            return None
    
    # ============================================================================
    # Geographic Search Operations
    # ============================================================================
    
    async def search_providers_near_location(self, latitude: float, longitude: float, 
                                           distance_km: float = 50, specialty_code: str = None) -> List[Dict]:
        """
        Search for providers within geographic distance with optional specialty filtering.
        
        Args:
            latitude: Center latitude
            longitude: Center longitude
            distance_km: Search radius in kilometers
            specialty_code: Optional specialty filter
            
        Returns:
            List of provider profiles with distance information
        """
        try:
            # First find locations within the specified distance
            nearby_locations = await self.geographic_location_search(latitude, longitude, distance_km)
            
            if not nearby_locations:
                return []
            
            location_ids = [loc['id'] for loc in nearby_locations]
            
            # Search for practitioner roles at these locations
            providers = []
            for location_id in location_ids:
                search_params = {
                    'location': f"Location/{location_id}"
                }
                
                if specialty_code:
                    search_params['specialty'] = specialty_code
                
                roles_response = await self.storage.search_resources('PractitionerRole', search_params)
                
                for entry in roles_response.get('entry', []):
                    role_resource = entry['resource']
                    
                    # Get practitioner details
                    practitioner_ref = role_resource.get('practitioner', {}).get('reference', '')
                    if practitioner_ref:
                        practitioner_id = practitioner_ref.split('/')[-1]
                        provider_profile = await self.get_provider_profile(practitioner_id)
                        
                        if provider_profile:
                            # Add distance information for this location
                            location = next((loc for loc in nearby_locations if loc['id'] == location_id), None)
                            if location:
                                provider_profile['distance'] = location.get('distance')
                                provider_profile['searchLocation'] = location
                            
                            # Avoid duplicates
                            if not any(p['id'] == practitioner_id for p in providers):
                                providers.append(provider_profile)
            
            # Sort by distance
            providers.sort(key=lambda p: p.get('distance', float('inf')))
            
            return providers
            
        except Exception as e:
            logger.error(f"Error searching providers near location ({latitude}, {longitude}): {e}")
            return []
    
    async def geographic_location_search(self, center_lat: float, center_lon: float, 
                                       distance_km: float) -> List[Dict]:
        """
        Search for locations within geographic distance using Haversine calculation.
        
        Args:
            center_lat: Center latitude
            center_lon: Center longitude
            distance_km: Search radius in kilometers
            
        Returns:
            List of locations with distance information
        """
        try:
            # Use PostGIS-style calculation for better performance
            query = text("""
                SELECT 
                    id,
                    resource,
                    (6371 * acos(
                        cos(radians(:center_lat)) * 
                        cos(radians((resource->'position'->>'latitude')::float)) * 
                        cos(radians((resource->'position'->>'longitude')::float) - radians(:center_lon)) + 
                        sin(radians(:center_lat)) * 
                        sin(radians((resource->'position'->>'latitude')::float))
                    )) AS distance_km
                FROM location 
                WHERE 
                    resource->'position'->'latitude' IS NOT NULL 
                    AND resource->'position'->'longitude' IS NOT NULL
                    AND (6371 * acos(
                        cos(radians(:center_lat)) * 
                        cos(radians((resource->'position'->>'latitude')::float)) * 
                        cos(radians((resource->'position'->>'longitude')::float) - radians(:center_lon)) + 
                        sin(radians(:center_lat)) * 
                        sin(radians((resource->'position'->>'latitude')::float))
                    )) <= :distance_km
                ORDER BY distance_km
            """)
            
            result = await self.session.execute(query, {
                'center_lat': center_lat,
                'center_lon': center_lon,
                'distance_km': distance_km
            })
            
            locations = []
            for row in result:
                location_data = dict(row._mapping)
                location_resource = location_data['resource']
                location_resource['distance'] = float(location_data['distance_km'])
                
                locations.append(location_resource)
            
            return locations
            
        except Exception as e:
            logger.error(f"Error in geographic location search: {e}")
            # Fallback to Python-based calculation
            return await self._fallback_geographic_search(center_lat, center_lon, distance_km)
    
    async def _fallback_geographic_search(self, center_lat: float, center_lon: float, 
                                        distance_km: float) -> List[Dict]:
        """Fallback geographic search using Python Haversine calculation."""
        try:
            # Get all locations with coordinates
            locations_response = await self.storage.search_resources('Location', {})
            locations = []
            
            for entry in locations_response.get('entry', []):
                location = entry['resource']
                position = location.get('position', {})
                
                if 'latitude' in position and 'longitude' in position:
                    lat = float(position['latitude'])
                    lon = float(position['longitude'])
                    
                    # Calculate distance using Haversine formula
                    distance = self._calculate_haversine_distance(
                        center_lat, center_lon, lat, lon
                    )
                    
                    if distance <= distance_km:
                        location['distance'] = distance
                        locations.append(location)
            
            # Sort by distance
            locations.sort(key=lambda loc: loc['distance'])
            
            return locations
            
        except Exception as e:
            logger.error(f"Error in fallback geographic search: {e}")
            return []
    
    def _calculate_haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculate the Haversine distance between two points on Earth.
        
        Args:
            lat1, lon1: First point coordinates
            lat2, lon2: Second point coordinates
            
        Returns:
            Distance in kilometers
        """
        # Convert decimal degrees to radians
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
        
        # Haversine formula
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        # Radius of Earth in kilometers
        r = 6371
        
        return c * r
    
    # ============================================================================
    # Organization and Location Hierarchy Operations
    # ============================================================================
    
    async def get_organizational_hierarchy(self, org_id: str) -> Optional[Dict]:
        """
        Get organizational hierarchy using Organization.partOf relationships.
        
        Args:
            org_id: Organization ID to start from
            
        Returns:
            Hierarchical organization structure
        """
        try:
            organization = await self.storage.read_resource('Organization', org_id)
            if not organization:
                return None
            
            # Get parent organization if exists
            parent = None
            part_of = organization.get('partOf', {})
            if part_of and 'reference' in part_of:
                parent_id = part_of['reference'].split('/')[-1]
                parent = await self.get_organizational_hierarchy(parent_id)
            
            # Get child organizations
            children = await self._get_child_organizations(org_id)
            
            # Get facilities (locations) for this organization
            facilities = await self._get_organization_facilities(org_id)
            
            hierarchy = {
                'organization': organization,
                'parent': parent,
                'children': children,
                'facilities': facilities,
                'level': self._determine_organization_level(organization)
            }
            
            return hierarchy
            
        except Exception as e:
            logger.error(f"Error getting organizational hierarchy for {org_id}: {e}")
            return None
    
    async def _get_child_organizations(self, parent_org_id: str) -> List[Dict]:
        """Get child organizations that have this organization as partOf."""
        try:
            search_params = {
                'partof': f"Organization/{parent_org_id}"
            }
            
            children_response = await self.storage.search_resources('Organization', search_params)
            children = []
            
            for entry in children_response.get('entry', []):
                child_org = entry['resource']
                child_hierarchy = await self.get_organizational_hierarchy(child_org['id'])
                if child_hierarchy:
                    children.append(child_hierarchy)
            
            return children
            
        except Exception as e:
            logger.error(f"Error getting child organizations for {parent_org_id}: {e}")
            return []
    
    async def _get_organization_facilities(self, org_id: str) -> List[Dict]:
        """Get facilities (locations) managed by this organization."""
        try:
            search_params = {
                'organization': f"Organization/{org_id}"
            }
            
            facilities_response = await self.storage.search_resources('Location', search_params)
            facilities = []
            
            for entry in facilities_response.get('entry', []):
                facility = entry['resource']
                facilities.append(facility)
            
            return facilities
            
        except Exception as e:
            logger.error(f"Error getting facilities for organization {org_id}: {e}")
            return []
    
    def _determine_organization_level(self, organization: Dict) -> str:
        """Determine the organizational level based on type and structure."""
        org_type = organization.get('type', [])
        if org_type:
            # Check for common organization type codes
            for type_coding in org_type:
                for coding in type_coding.get('coding', []):
                    code = coding.get('code', '').lower()
                    if 'health-system' in code or 'hospital-system' in code:
                        return 'health-system'
                    elif 'hospital' in code or 'facility' in code:
                        return 'facility'
                    elif 'department' in code or 'unit' in code:
                        return 'department'
        
        # Fallback based on partOf relationships
        if organization.get('partOf'):
            return 'subsidiary'
        else:
            return 'root'
    
    async def get_location_hierarchy(self, location_id: str) -> Optional[Dict]:
        """
        Get location hierarchy using Location.partOf relationships.
        
        Args:
            location_id: Location ID
            
        Returns:
            Hierarchical location structure
        """
        try:
            location = await self.storage.read_resource('Location', location_id)
            if not location:
                return None
            
            # Get parent location if exists
            parent = None
            part_of = location.get('partOf', {})
            if part_of and 'reference' in part_of:
                parent_id = part_of['reference'].split('/')[-1]
                parent = await self.get_location_hierarchy(parent_id)
            
            # Get child locations
            children = await self._get_child_locations(location_id)
            
            # Get managing organization
            managing_org = None
            managing_org_ref = location.get('managingOrganization', {})
            if managing_org_ref and 'reference' in managing_org_ref:
                org_id = managing_org_ref['reference'].split('/')[-1]
                managing_org = await self.storage.read_resource('Organization', org_id)
            
            hierarchy = {
                'location': location,
                'parent': parent,
                'children': children,
                'managingOrganization': managing_org,
                'level': self._determine_location_level(location)
            }
            
            return hierarchy
            
        except Exception as e:
            logger.error(f"Error getting location hierarchy for {location_id}: {e}")
            return None
    
    async def _get_child_locations(self, parent_location_id: str) -> List[Dict]:
        """Get child locations that have this location as partOf."""
        try:
            search_params = {
                'partof': f"Location/{parent_location_id}"
            }
            
            children_response = await self.storage.search_resources('Location', search_params)
            children = []
            
            for entry in children_response.get('entry', []):
                child_location = entry['resource']
                child_hierarchy = await self.get_location_hierarchy(child_location['id'])
                if child_hierarchy:
                    children.append(child_hierarchy)
            
            return children
            
        except Exception as e:
            logger.error(f"Error getting child locations for {parent_location_id}: {e}")
            return []
    
    def _determine_location_level(self, location: Dict) -> str:
        """Determine the location level based on type and physical type."""
        physical_type = location.get('physicalType', {})
        location_type = location.get('type', [])
        
        # Check physical type first
        if physical_type:
            for coding in physical_type.get('coding', []):
                code = coding.get('code', '').lower()
                if 'building' in code or 'site' in code:
                    return 'building'
                elif 'floor' in code or 'level' in code:
                    return 'floor'
                elif 'room' in code or 'ward' in code:
                    return 'room'
                elif 'bed' in code:
                    return 'bed'
        
        # Check location type
        for type_coding in location_type:
            for coding in type_coding.get('coding', []):
                code = coding.get('code', '').lower()
                if 'hospital' in code or 'clinic' in code:
                    return 'facility'
                elif 'department' in code or 'unit' in code:
                    return 'department'
        
        return 'facility'  # Default
    
    # ============================================================================
    # Utility Functions
    # ============================================================================
    
    def _get_practitioner_display_name(self, practitioner: Dict) -> str:
        """Get display name for practitioner."""
        name = practitioner.get('name', [])
        if name:
            primary_name = name[0]  # Use first name entry
            given = primary_name.get('given', [])
            family = primary_name.get('family', '')
            
            given_str = ' '.join(given) if given else ''
            return f"{given_str} {family}".strip()
        
        return practitioner.get('id', 'Unknown Provider')
    
    async def get_provider_specialties(self, practitioner_id: str) -> List[Dict]:
        """Get all specialties for a practitioner across all roles."""
        try:
            roles = await self.get_practitioner_roles(practitioner_id)
            
            specialties = []
            specialty_codes = set()
            
            for role_data in roles:
                for specialty in role_data['specialties']:
                    specialty_code = specialty.get('coding', [{}])[0].get('code')
                    if specialty_code and specialty_code not in specialty_codes:
                        specialty_codes.add(specialty_code)
                        specialties.append(specialty)
            
            return specialties
            
        except Exception as e:
            logger.error(f"Error getting provider specialties for {practitioner_id}: {e}")
            return []
    
    async def get_provider_locations(self, practitioner_id: str) -> List[Dict]:
        """Get all locations where a practitioner provides services."""
        try:
            roles = await self.get_practitioner_roles(practitioner_id)
            
            locations = []
            location_ids = set()
            
            for role_data in roles:
                for location in role_data['locations']:
                    location_id = location.get('id')
                    if location_id and location_id not in location_ids:
                        location_ids.add(location_id)
                        locations.append(location)
            
            return locations
            
        except Exception as e:
            logger.error(f"Error getting provider locations for {practitioner_id}: {e}")
            return []
    
    async def search_providers_by_organization(self, organization_id: str) -> List[Dict]:
        """Search for all providers associated with an organization."""
        try:
            search_params = {
                'organization': f"Organization/{organization_id}"
            }
            
            roles_response = await self.storage.search_resources('PractitionerRole', search_params)
            providers = []
            
            for entry in roles_response.get('entry', []):
                role_resource = entry['resource']
                
                practitioner_ref = role_resource.get('practitioner', {}).get('reference', '')
                if practitioner_ref:
                    practitioner_id = practitioner_ref.split('/')[-1]
                    provider_profile = await self.get_provider_profile(practitioner_id)
                    
                    if provider_profile:
                        providers.append(provider_profile)
            
            return providers
            
        except Exception as e:
            logger.error(f"Error searching providers by organization {organization_id}: {e}")
            return []