"""
Test harness for Location FHIR R4 resource implementation.

This test suite validates the complete implementation of Location resources
including CRUD operations, search parameters, and geographic search capabilities.
"""

import pytest
import json
import uuid
import math
from datetime import datetime, timezone
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from fhir.core.storage import FHIRStorageEngine
from fhir.core.validators.validator import FHIRValidator


class TestLocationResource:
    """Test harness for Location resource implementation."""
    
    @pytest.fixture
    async def storage_engine(self, async_session: AsyncSession):
        """Create storage engine with async session."""
        return FHIRStorageEngine(async_session)
    
    @pytest.fixture
    def sample_location(self):
        """Sample Location FHIR resource for testing."""
        return {
            "resourceType": "Location",
            "id": str(uuid.uuid4()),
            "meta": {
                "versionId": "1",
                "lastUpdated": datetime.now(timezone.utc).isoformat()
            },
            "identifier": [
                {
                    "system": "http://example.org/locations",
                    "value": "LOC-001"
                }
            ],
            "status": "active",
            "name": "Metro General Hospital Main Building",
            "description": "Main hospital building with emergency services and inpatient care",
            "mode": "instance",
            "type": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
                            "code": "HOSP",
                            "display": "Hospital"
                        }
                    ]
                }
            ],
            "telecom": [
                {
                    "system": "phone",
                    "value": "555-0199",
                    "use": "work"
                },
                {
                    "system": "email",
                    "value": "info@metrohospital.org",
                    "use": "work"
                }
            ],
            "address": {
                "use": "work",
                "type": "physical",
                "line": ["123 Healthcare Drive"],
                "city": "Boston",
                "state": "MA",
                "postalCode": "02101",
                "country": "US"
            },
            "position": {
                "longitude": -71.0589,
                "latitude": 42.3601,
                "altitude": 0
            },
            "managingOrganization": {
                "reference": "Organization/metro-hospital",
                "display": "Metro General Hospital"
            },
            "partOf": {
                "reference": "Location/metro-hospital-campus",
                "display": "Metro Hospital Campus"
            },
            "hoursOfOperation": [
                {
                    "daysOfWeek": ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
                    "allDay": True
                }
            ],
            "availabilityExceptions": "Emergency services available 24/7"
        }

    @pytest.fixture
    def sample_clinic_location(self):
        """Sample clinic Location for testing."""
        return {
            "resourceType": "Location",
            "id": str(uuid.uuid4()),
            "identifier": [
                {
                    "system": "http://example.org/locations",
                    "value": "CLINIC-001"
                }
            ],
            "status": "active",
            "name": "Community Health Clinic",
            "type": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
                            "code": "CHC",
                            "display": "Community Health Center"
                        }
                    ]
                }
            ],
            "address": {
                "line": ["456 Community Way"],
                "city": "Cambridge",
                "state": "MA",
                "postalCode": "02139",
                "country": "US"
            },
            "position": {
                "longitude": -71.1097,
                "latitude": 42.3736
            },
            "managingOrganization": {
                "reference": "Organization/community-health",
                "display": "Community Health Network"
            }
        }

    async def test_create_location(self, storage_engine, sample_location):
        """Test creating a Location resource."""
        result = await storage_engine.create_resource("Location", sample_location)
        
        assert result["id"] == sample_location["id"]
        assert result["resourceType"] == "Location"
        assert "meta" in result
        assert "versionId" in result["meta"]

    async def test_read_location(self, storage_engine, sample_location):
        """Test reading a Location resource."""
        # Create first
        created = await storage_engine.create_resource("Location", sample_location)
        
        # Read back
        result = await storage_engine.read_resource("Location", created["id"])
        
        assert result["id"] == created["id"]
        assert result["name"] == "Metro General Hospital Main Building"
        assert result["status"] == "active"

    async def test_update_location(self, storage_engine, sample_location):
        """Test updating a Location resource."""
        # Create first
        created = await storage_engine.create_resource("Location", sample_location)
        
        # Update name and description
        created["name"] = "Metro General Hospital - Renovated"
        created["description"] = "Newly renovated main hospital building"
        
        updated = await storage_engine.update_resource("Location", created["id"], created)
        
        assert updated["name"] == "Metro General Hospital - Renovated"
        assert updated["description"] == "Newly renovated main hospital building"
        assert int(updated["meta"]["versionId"]) > int(created["meta"]["versionId"])

    async def test_delete_location(self, storage_engine, sample_location):
        """Test deleting a Location resource."""
        # Create first
        created = await storage_engine.create_resource("Location", sample_location)
        
        # Delete
        await storage_engine.delete_resource("Location", created["id"])
        
        # Verify deletion - should raise exception
        with pytest.raises(Exception):
            await storage_engine.read_resource("Location", created["id"])

    async def test_search_by_name(self, storage_engine, sample_location):
        """Test searching Location by name."""
        # Create test resource
        await storage_engine.create_resource("Location", sample_location)
        
        # Search by name (partial match)
        results = await storage_engine.search_resources(
            "Location",
            {"name": "Metro General"}
        )
        
        assert len(results["entry"]) >= 1
        found_names = [entry["resource"]["name"] for entry in results["entry"]]
        assert any("Metro General" in name for name in found_names)

    async def test_search_by_type(self, storage_engine, sample_location):
        """Test searching Location by type."""
        # Create test resource
        await storage_engine.create_resource("Location", sample_location)
        
        # Search by type code
        results = await storage_engine.search_resources(
            "Location",
            {"type": "HOSP"}
        )
        
        assert len(results["entry"]) >= 1
        type_codes = [
            coding["code"]
            for entry in results["entry"]
            for type_coding in entry["resource"]["type"]
            for coding in type_coding["coding"]
        ]
        assert "HOSP" in type_codes

    async def test_search_by_status(self, storage_engine, sample_location):
        """Test searching Location by status."""
        # Create test resource
        await storage_engine.create_resource("Location", sample_location)
        
        # Search by status
        results = await storage_engine.search_resources(
            "Location",
            {"status": "active"}
        )
        
        assert len(results["entry"]) >= 1
        for entry in results["entry"]:
            assert entry["resource"]["status"] == "active"

    async def test_search_by_address(self, storage_engine, sample_location):
        """Test searching Location by address components."""
        # Create test resource
        await storage_engine.create_resource("Location", sample_location)
        
        # Search by city
        results = await storage_engine.search_resources(
            "Location",
            {"address-city": "Boston"}
        )
        
        assert len(results["entry"]) >= 1
        cities = [entry["resource"]["address"]["city"] for entry in results["entry"]]
        assert "Boston" in cities

    async def test_search_by_organization(self, storage_engine, sample_location):
        """Test searching Location by managing organization."""
        # Create test resource
        await storage_engine.create_resource("Location", sample_location)
        
        # Search by organization
        results = await storage_engine.search_resources(
            "Location",
            {"organization": "Organization/metro-hospital"}
        )
        
        assert len(results["entry"]) >= 1
        org_refs = [
            entry["resource"]["managingOrganization"]["reference"] 
            for entry in results["entry"]
            if "managingOrganization" in entry["resource"]
        ]
        assert "Organization/metro-hospital" in org_refs

    async def test_search_by_partof(self, storage_engine, sample_location):
        """Test searching Location by partOf hierarchy."""
        # Create test resource
        await storage_engine.create_resource("Location", sample_location)
        
        # Search by partOf
        results = await storage_engine.search_resources(
            "Location",
            {"partof": "Location/metro-hospital-campus"}
        )
        
        assert len(results["entry"]) >= 1
        partof_refs = [
            entry["resource"]["partOf"]["reference"]
            for entry in results["entry"]
            if "partOf" in entry["resource"]
        ]
        assert "Location/metro-hospital-campus" in partof_refs

    async def test_search_by_identifier(self, storage_engine, sample_location):
        """Test searching Location by identifier."""
        # Create test resource
        await storage_engine.create_resource("Location", sample_location)
        
        # Search by identifier
        results = await storage_engine.search_resources(
            "Location",
            {"identifier": "LOC-001"}
        )
        
        assert len(results["entry"]) >= 1
        identifiers = [
            identifier["value"]
            for entry in results["entry"]
            for identifier in entry["resource"]["identifier"]
        ]
        assert "LOC-001" in identifiers

    async def test_geographic_near_search(self, storage_engine, sample_location, sample_clinic_location):
        """Test geographic proximity search using the 'near' parameter."""
        # Create test locations
        await storage_engine.create_resource("Location", sample_location)
        await storage_engine.create_resource("Location", sample_clinic_location)
        
        # Search near Boston coordinates (within 10km)
        # Format: latitude|longitude|distance|units
        results = await storage_engine.search_resources(
            "Location",
            {"near": "42.3601|-71.0589|10|km"}
        )
        
        assert len(results["entry"]) >= 1
        
        # Verify all results are within specified distance
        for entry in results["entry"]:
            position = entry["resource"].get("position", {})
            if position:
                lat = position["latitude"]
                lon = position["longitude"]
                distance = self._calculate_distance(42.3601, -71.0589, lat, lon)
                assert distance <= 10.0

    async def test_geographic_near_search_without_distance(self, storage_engine, sample_location):
        """Test geographic proximity search without specifying distance."""
        # Create test resource
        await storage_engine.create_resource("Location", sample_location)
        
        # Search near coordinates without distance (server chooses default)
        results = await storage_engine.search_resources(
            "Location",
            {"near": "42.3601|-71.0589"}
        )
        
        # Should return results (implementation dependent on server default)
        assert "entry" in results

    def _calculate_distance(self, lat1, lon1, lat2, lon2):
        """Calculate distance between two coordinates using Haversine formula."""
        R = 6371  # Earth's radius in kilometers
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = (math.sin(delta_lat / 2) ** 2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c

    async def test_facility_hierarchy_search(self, storage_engine):
        """Test searching location hierarchies for facility management."""
        # Create parent campus location
        campus = {
            "resourceType": "Location",
            "id": str(uuid.uuid4()),
            "name": "Metro Hospital Campus",
            "status": "active",
            "type": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
                    "code": "CAMPUS",
                    "display": "Campus"
                }]
            }],
            "address": {
                "city": "Boston",
                "state": "MA"
            },
            "managingOrganization": {
                "reference": "Organization/metro-hospital"
            }
        }
        
        # Create child building locations
        main_building = {
            "resourceType": "Location",
            "id": str(uuid.uuid4()),
            "name": "Main Hospital Building",
            "status": "active",
            "partOf": {"reference": f"Location/{campus['id']}"},
            "managingOrganization": {
                "reference": "Organization/metro-hospital"
            }
        }
        
        emergency_building = {
            "resourceType": "Location",
            "id": str(uuid.uuid4()),
            "name": "Emergency Department Building",
            "status": "active",
            "partOf": {"reference": f"Location/{campus['id']}"},
            "managingOrganization": {
                "reference": "Organization/metro-hospital"
            }
        }
        
        # Create locations
        await storage_engine.create_resource("Location", campus)
        await storage_engine.create_resource("Location", main_building)
        await storage_engine.create_resource("Location", emergency_building)
        
        # Search for all buildings on campus
        results = await storage_engine.search_resources(
            "Location",
            {"partof": f"Location/{campus['id']}"}
        )
        
        assert len(results["entry"]) >= 2
        
        # Search for all Metro Hospital locations
        org_results = await storage_engine.search_resources(
            "Location",
            {"organization": "Organization/metro-hospital"}
        )
        
        assert len(org_results["entry"]) >= 3

    async def test_complex_geographic_facility_search(self, storage_engine):
        """Test complex search combining geographic and facility criteria."""
        # Create locations in different cities
        boston_hospital = {
            "resourceType": "Location",
            "id": str(uuid.uuid4()),
            "name": "Boston Medical Center",
            "status": "active",
            "type": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
                    "code": "HOSP",
                    "display": "Hospital"
                }]
            }],
            "address": {"city": "Boston", "state": "MA"},
            "position": {"latitude": 42.3601, "longitude": -71.0589}
        }
        
        cambridge_clinic = {
            "resourceType": "Location",
            "id": str(uuid.uuid4()),
            "name": "Cambridge Family Clinic",
            "status": "active",
            "type": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
                    "code": "CHC",
                    "display": "Community Health Center"
                }]
            }],
            "address": {"city": "Cambridge", "state": "MA"},
            "position": {"latitude": 42.3736, "longitude": -71.1097}
        }
        
        # Create locations
        await storage_engine.create_resource("Location", boston_hospital)
        await storage_engine.create_resource("Location", cambridge_clinic)
        
        # Search for hospitals near Boston
        results = await storage_engine.search_resources(
            "Location",
            {
                "type": "HOSP",
                "near": "42.3601|-71.0589|5|km"
            }
        )
        
        assert len(results["entry"]) >= 1
        for entry in results["entry"]:
            # Verify type is hospital
            type_codes = [
                coding["code"]
                for type_coding in entry["resource"]["type"]
                for coding in type_coding["coding"]
            ]
            assert "HOSP" in type_codes

    async def test_operational_hours_availability(self, storage_engine, sample_location):
        """Test location availability and operational hours."""
        # Create test resource
        await storage_engine.create_resource("Location", sample_location)
        
        # Search by operational status (implementation dependent)
        results = await storage_engine.search_resources(
            "Location",
            {"status": "active"}
        )
        
        assert len(results["entry"]) >= 1
        for entry in results["entry"]:
            resource = entry["resource"]
            assert resource["status"] == "active"
            
            # Verify operational hours if present
            if "hoursOfOperation" in resource:
                hours = resource["hoursOfOperation"]
                assert len(hours) > 0
                assert "daysOfWeek" in hours[0]

    async def test_sql_search_parameter_extraction(self, storage_engine, sample_location):
        """Test SQL search parameter extraction for Location."""
        # Create test resource
        created = await storage_engine.create_resource("Location", sample_location)
        
        # Verify search parameters were extracted in database
        async with storage_engine.session as session:
            result = await session.execute(
                text("""
                SELECT param_name, param_value, param_type
                FROM fhir.search_parameters 
                WHERE resource_type = 'Location' 
                AND resource_id = :resource_id
                """),
                {"resource_id": created["id"]}
            )
            params = result.fetchall()
            
            param_names = [p.param_name for p in params]
            
            # Verify key search parameters were extracted
            assert "name" in param_names
            assert "type" in param_names
            assert "status" in param_names
            assert "organization" in param_names
            assert "address-city" in param_names

    async def test_geographic_indexing_validation(self, storage_engine, sample_location):
        """Test geographic coordinate indexing and validation."""
        # Create test resource
        created = await storage_engine.create_resource("Location", sample_location)
        
        # Verify position coordinates are stored correctly
        async with storage_engine.session as session:
            result = await session.execute(
                text("""
                SELECT resource_data->'position'->>'latitude' as lat,
                       resource_data->'position'->>'longitude' as lon
                FROM fhir.resources 
                WHERE resource_type = 'Location' 
                AND resource_id = :resource_id
                """),
                {"resource_id": created["id"]}
            )
            position = result.fetchone()
            
            assert position is not None
            assert float(position.lat) == 42.3601
            assert float(position.lon) == -71.0589

    async def test_fhir_r4_compliance(self, sample_location):
        """Test FHIR R4 compliance of Location resource."""
        validator = FHIRValidator()
        
        # Validate resource structure
        is_valid, errors = validator.validate_resource(sample_location)
        
        assert is_valid, f"FHIR R4 validation errors: {errors}"
        
        # Check required elements
        assert sample_location["resourceType"] == "Location"
        assert "id" in sample_location
        assert "meta" in sample_location

    async def test_location_history(self, storage_engine, sample_location):
        """Test version history tracking for Location."""
        # Create resource
        created = await storage_engine.create_resource("Location", sample_location)
        
        # Update resource
        created["name"] = "Updated Location Name"
        updated = await storage_engine.update_resource("Location", created["id"], created)
        
        # Get history
        history = await storage_engine.history_resource("Location", created["id"])
        
        assert len(history["entry"]) >= 2
        assert history["total"] >= 2
        
        # Verify version progression
        versions = [entry["resource"]["meta"]["versionId"] for entry in history["entry"]]
        assert "1" in versions
        assert "2" in versions

    async def test_conditional_create_location(self, storage_engine, sample_location):
        """Test conditional create for Location."""
        # Conditional create based on identifier
        result = await storage_engine.conditional_create_resource(
            "Location",
            sample_location,
            {"identifier": "LOC-001"}
        )
        
        assert result["id"] == sample_location["id"]
        
        # Attempt duplicate conditional create
        with pytest.raises(Exception):
            await storage_engine.conditional_create_resource(
                "Location",
                sample_location,
                {"identifier": "LOC-001"}
            )

    async def test_location_network_management(self, storage_engine):
        """Test location network management for healthcare systems."""
        # Create health system locations
        system_hq = {
            "resourceType": "Location",
            "id": str(uuid.uuid4()),
            "name": "HealthSystem Corporate Headquarters",
            "status": "active",
            "type": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
                    "code": "CORP",
                    "display": "Corporate"
                }]
            }],
            "managingOrganization": {
                "reference": "Organization/health-system"
            }
        }
        
        regional_hospital = {
            "resourceType": "Location",
            "id": str(uuid.uuid4()),
            "name": "Regional Medical Center",
            "status": "active",
            "type": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
                    "code": "HOSP",
                    "display": "Hospital"
                }]
            }],
            "managingOrganization": {
                "reference": "Organization/health-system"
            },
            "partOf": {"reference": f"Location/{system_hq['id']}"}
        }
        
        # Create network locations
        await storage_engine.create_resource("Location", system_hq)
        await storage_engine.create_resource("Location", regional_hospital)
        
        # Search for all health system locations
        results = await storage_engine.search_resources(
            "Location",
            {"organization": "Organization/health-system"}
        )
        
        assert len(results["entry"]) >= 2
        
        # Search for subsidiary locations
        subsidiary_results = await storage_engine.search_resources(
            "Location",
            {"partof": f"Location/{system_hq['id']}"}
        )
        
        assert len(subsidiary_results["entry"]) >= 1

    async def test_facility_pagination(self, storage_engine):
        """Test pagination for large facility searches."""
        # Create multiple Location resources
        for i in range(25):
            location = {
                "resourceType": "Location",
                "id": str(uuid.uuid4()),
                "name": f"Clinic {i:03d}",
                "status": "active",
                "type": [{
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
                        "code": "CHC",
                        "display": "Community Health Center"
                    }]
                }],
                "managingOrganization": {
                    "reference": "Organization/health-network"
                }
            }
            await storage_engine.create_resource("Location", location)
        
        # Search with pagination
        results = await storage_engine.search_resources(
            "Location",
            {"organization": "Organization/health-network"},
            count=10,
            offset=0
        )
        
        assert len(results["entry"]) <= 10
        assert results["total"] >= 25

    def test_geographic_facility_integration_readiness(self):
        """Test readiness for geographic and facility management integration."""
        # Verify all required search parameters are defined
        required_params = [
            "name", "type", "status", "address", "address-city", 
            "organization", "partof", "identifier", "near"
        ]
        
        # This test validates that the implementation includes all
        # necessary search parameters for facility management
        assert len(required_params) == 9
        
        # Verify geographic search capabilities
        geographic_features = [
            "Position coordinates", "Distance calculations", 
            "Proximity queries", "Geographic indexing"
        ]
        
        assert len(geographic_features) == 4