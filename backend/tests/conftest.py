"""
Pytest configuration and fixtures for WintEHR backend tests

This module provides common test fixtures for database sessions,
mocked services, and test data.
"""

import pytest
import asyncio
from typing import AsyncGenerator, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import sessionmaker
from httpx import AsyncClient
from unittest.mock import AsyncMock, MagicMock

# Test database URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def test_db() -> AsyncGenerator[AsyncSession, None]:
    """Create test database session"""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        future=True
    )

    async_session = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False
    )

    async with async_session() as session:
        yield session

    await engine.dispose()


@pytest.fixture
def mock_hapi_client():
    """Mock HAPI FHIR client"""
    client = AsyncMock()

    # Mock search response
    client.search.return_value = {
        "resourceType": "Bundle",
        "type": "searchset",
        "total": 1,
        "entry": []
    }

    # Mock read response
    client.read.return_value = {
        "resourceType": "PlanDefinition",
        "id": "test-service",
        "status": "active"
    }

    # Mock create response
    client.create.return_value = {
        "resourceType": "PlanDefinition",
        "id": "new-service",
        "status": "active"
    }

    return client


@pytest.fixture
def sample_plan_definition() -> Dict[str, Any]:
    """Sample PlanDefinition resource for testing"""
    return {
        "resourceType": "PlanDefinition",
        "id": "diabetes-screening",
        "status": "active",
        "title": "Diabetes Screening Reminder",
        "description": "Reminds clinicians about diabetes screening guidelines",
        "extension": [
            {
                "url": "http://wintehr.local/fhir/StructureDefinition/service-origin",
                "valueString": "built-in"
            },
            {
                "url": "http://wintehr.local/fhir/StructureDefinition/hook-type",
                "valueCode": "patient-view"
            },
            {
                "url": "http://wintehr.local/fhir/StructureDefinition/hook-service-id",
                "valueString": "diabetes-screening-reminder"
            },
            {
                "url": "http://wintehr.local/fhir/StructureDefinition/python-class",
                "valueString": "cds_services.DiabetesScreeningService"
            }
        ],
        "action": [
            {
                "title": "Check diabetes screening status",
                "input": [
                    {
                        "type": "DataRequirement",
                        "profile": ["http://hl7.org/fhir/StructureDefinition/Patient"]
                    },
                    {
                        "type": "DataRequirement",
                        "profile": ["http://hl7.org/fhir/StructureDefinition/Observation"]
                    }
                ]
            }
        ]
    }


@pytest.fixture
def external_plan_definition() -> Dict[str, Any]:
    """Sample external PlanDefinition for testing"""
    return {
        "resourceType": "PlanDefinition",
        "id": "external-diabetes-cds",
        "status": "active",
        "title": "External Diabetes CDS",
        "description": "External diabetes management service",
        "extension": [
            {
                "url": "http://wintehr.local/fhir/StructureDefinition/service-origin",
                "valueString": "external"
            },
            {
                "url": "http://wintehr.local/fhir/StructureDefinition/hook-type",
                "valueCode": "patient-view"
            },
            {
                "url": "http://wintehr.local/fhir/StructureDefinition/hook-service-id",
                "valueString": "external-diabetes-management"
            },
            {
                "url": "http://wintehr.local/fhir/StructureDefinition/external-service-id",
                "valueInteger": 1
            }
        ]
    }


@pytest.fixture
def sample_cds_request() -> Dict[str, Any]:
    """Sample CDS Hooks request for testing"""
    return {
        "hookInstance": "test-hook-123",
        "fhirServer": "http://localhost:8888/fhir",
        "hook": "patient-view",
        "context": {
            "patientId": "Patient/123",
            "userId": "Practitioner/456"
        },
        "prefetch": {
            "patient": {
                "resourceType": "Patient",
                "id": "123",
                "name": [{"family": "Test", "given": ["Patient"]}]
            }
        }
    }


@pytest.fixture
def external_service_metadata() -> Dict[str, Any]:
    """Sample external service metadata for testing"""
    return {
        "id": 1,
        "base_url": "https://example.com/cds",
        "auth_type": "api_key",
        "credentials_encrypted": "encrypted_api_key_value",
        "auto_disabled": False,
        "consecutive_failures": 0,
        "last_error_message": None
    }


@pytest.fixture
def mock_local_service():
    """Mock local CDS service implementation"""
    service = AsyncMock()
    service.should_execute.return_value = True
    service.execute.return_value = {
        "cards": [
            {
                "summary": "Test card",
                "indicator": "info",
                "detail": "Test detail",
                "source": {"label": "Test Service"}
            }
        ]
    }
    return service


@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP client for testing API endpoints"""
    async with AsyncClient(base_url="http://test") as client:
        yield client
