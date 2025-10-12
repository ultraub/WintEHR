"""
Test conditional FHIR operations (If-None-Exist and If-Match).
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
import json


@pytest.mark.asyncio
async def test_conditional_create_if_none_exist(client: AsyncClient, db_session: AsyncSession):
    """Test conditional create with If-None-Exist header."""
    # Create a test patient
    patient_data = {
        "resourceType": "Patient",
        "identifier": [{
            "system": "http://test.org/mrn",
            "value": "COND-TEST-123"
        }],
        "name": [{
            "family": "ConditionalTest",
            "given": ["Patient"]
        }],
        "gender": "female",
        "birthDate": "1985-05-15"
    }
    
    # First create with If-None-Exist
    response = await client.post(
        "/fhir/R4/Patient",
        json=patient_data,
        headers={
            "Content-Type": "application/fhir+json",
            "If-None-Exist": "identifier=http://test.org/mrn|COND-TEST-123"
        }
    )
    assert response.status_code == 201
    location1 = response.headers.get("Location")
    assert location1 is not None
    patient_id1 = location1.split("/")[-1]
    
    # Second create with same identifier should return existing
    response = await client.post(
        "/fhir/R4/Patient",
        json=patient_data,
        headers={
            "Content-Type": "application/fhir+json",
            "If-None-Exist": "identifier=http://test.org/mrn|COND-TEST-123"
        }
    )
    # Should return 200 OK with existing resource
    assert response.status_code == 200
    location2 = response.headers.get("Location")
    assert location2 is not None
    patient_id2 = location2.split("/")[-1]
    
    # Should be the same patient
    assert patient_id1 == patient_id2
    
    # Create with different identifier should create new
    patient_data["identifier"][0]["value"] = "COND-TEST-456"
    response = await client.post(
        "/fhir/R4/Patient",
        json=patient_data,
        headers={
            "Content-Type": "application/fhir+json",
            "If-None-Exist": "identifier=http://test.org/mrn|COND-TEST-456"
        }
    )
    assert response.status_code == 201
    location3 = response.headers.get("Location")
    patient_id3 = location3.split("/")[-1]
    assert patient_id3 != patient_id1
    
    # Cleanup
    await client.delete(f"/fhir/R4/Patient/{patient_id1}")
    await client.delete(f"/fhir/R4/Patient/{patient_id3}")


@pytest.mark.asyncio
async def test_conditional_update_if_match(client: AsyncClient, db_session: AsyncSession):
    """Test conditional update with If-Match header."""
    # Create a test patient
    patient_data = {
        "resourceType": "Patient",
        "name": [{
            "family": "MatchTest",
            "given": ["Patient"]
        }],
        "gender": "male",
        "birthDate": "1990-01-01"
    }
    
    # Create patient
    response = await client.post(
        "/fhir/R4/Patient",
        json=patient_data,
        headers={"Content-Type": "application/fhir+json"}
    )
    assert response.status_code == 201
    location = response.headers.get("Location")
    patient_id = location.split("/")[-1]
    etag1 = response.headers.get("ETag")
    assert etag1 is not None
    
    # Read to get full resource
    response = await client.get(f"/fhir/R4/Patient/{patient_id}")
    assert response.status_code == 200
    patient = response.json()
    current_etag = response.headers.get("ETag")
    
    # Update with correct ETag should succeed
    patient["name"][0]["family"] = "UpdatedMatchTest"
    response = await client.put(
        f"/fhir/R4/Patient/{patient_id}",
        json=patient,
        headers={
            "Content-Type": "application/fhir+json",
            "If-Match": current_etag
        }
    )
    assert response.status_code == 200
    etag2 = response.headers.get("ETag")
    assert etag2 != etag1
    
    # Update with old ETag should fail
    patient["name"][0]["family"] = "ShouldFailUpdate"
    response = await client.put(
        f"/fhir/R4/Patient/{patient_id}",
        json=patient,
        headers={
            "Content-Type": "application/fhir+json",
            "If-Match": etag1  # Using old ETag
        }
    )
    assert response.status_code == 409  # Conflict
    
    # Update without If-Match should succeed
    response = await client.put(
        f"/fhir/R4/Patient/{patient_id}",
        json=patient,
        headers={"Content-Type": "application/fhir+json"}
    )
    assert response.status_code == 200
    
    # Cleanup
    await client.delete(f"/fhir/R4/Patient/{patient_id}")


@pytest.mark.asyncio
async def test_conditional_create_with_multiple_parameters(client: AsyncClient, db_session: AsyncSession):
    """Test conditional create with multiple search parameters."""
    patient_data = {
        "resourceType": "Patient",
        "identifier": [{
            "system": "http://test.org/mrn",
            "value": "MULTI-TEST-789"
        }],
        "name": [{
            "family": "MultiParam",
            "given": ["Test"]
        }],
        "gender": "other",
        "birthDate": "2000-01-01"
    }
    
    # Create with multiple parameters
    response = await client.post(
        "/fhir/R4/Patient",
        json=patient_data,
        headers={
            "Content-Type": "application/fhir+json",
            "If-None-Exist": "identifier=http://test.org/mrn|MULTI-TEST-789&family=MultiParam&birthdate=2000-01-01"
        }
    )
    assert response.status_code == 201
    location1 = response.headers.get("Location")
    patient_id1 = location1.split("/")[-1]
    
    # Same request should return existing
    response = await client.post(
        "/fhir/R4/Patient",
        json=patient_data,
        headers={
            "Content-Type": "application/fhir+json",
            "If-None-Exist": "identifier=http://test.org/mrn|MULTI-TEST-789&family=MultiParam&birthdate=2000-01-01"
        }
    )
    assert response.status_code == 200
    
    # Different birthdate should create new
    patient_data["birthDate"] = "2000-01-02"
    response = await client.post(
        "/fhir/R4/Patient",
        json=patient_data,
        headers={
            "Content-Type": "application/fhir+json",
            "If-None-Exist": "identifier=http://test.org/mrn|MULTI-TEST-789&family=MultiParam&birthdate=2000-01-02"
        }
    )
    assert response.status_code == 201
    location2 = response.headers.get("Location")
    patient_id2 = location2.split("/")[-1]
    assert patient_id2 != patient_id1
    
    # Cleanup
    await client.delete(f"/fhir/R4/Patient/{patient_id1}")
    await client.delete(f"/fhir/R4/Patient/{patient_id2}")


@pytest.mark.asyncio 
async def test_if_match_etag_formats(client: AsyncClient, db_session: AsyncSession):
    """Test different ETag formats for If-Match."""
    # Create patient
    patient_data = {
        "resourceType": "Patient",
        "name": [{"family": "ETagTest"}],
        "gender": "female"
    }
    
    response = await client.post(
        "/fhir/R4/Patient",
        json=patient_data,
        headers={"Content-Type": "application/fhir+json"}
    )
    assert response.status_code == 201
    location = response.headers.get("Location")
    patient_id = location.split("/")[-1]
    
    # Read to get ETag
    response = await client.get(f"/fhir/R4/Patient/{patient_id}")
    patient = response.json()
    etag = response.headers.get("ETag")  # Should be W/"1"
    version = patient["meta"]["versionId"]
    
    # Test different ETag formats
    patient["name"][0]["family"] = "Updated1"
    
    # Format 1: W/"version"
    response = await client.put(
        f"/fhir/R4/Patient/{patient_id}",
        json=patient,
        headers={
            "Content-Type": "application/fhir+json",
            "If-Match": f'W/"{version}"'
        }
    )
    assert response.status_code == 200
    
    # Format 2: Just "version"
    patient["name"][0]["family"] = "Updated2"
    response = await client.put(
        f"/fhir/R4/Patient/{patient_id}",
        json=patient,
        headers={
            "Content-Type": "application/fhir+json",
            "If-Match": f'"{int(version)+1}"'
        }
    )
    assert response.status_code == 200
    
    # Format 3: Just version number (no quotes)
    patient["name"][0]["family"] = "Updated3"
    response = await client.put(
        f"/fhir/R4/Patient/{patient_id}",
        json=patient,
        headers={
            "Content-Type": "application/fhir+json",
            "If-Match": str(int(version)+2)
        }
    )
    assert response.status_code == 200
    
    # Cleanup
    await client.delete(f"/fhir/R4/Patient/{patient_id}")