"""
Pytest configuration and fixtures for FHIR API comprehensive tests

Created: 2025-01-20
"""

import pytest
import asyncio
import httpx
import asyncpg
import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Test configuration
BASE_URL = os.getenv("FHIR_BASE_URL", "http://localhost:8000/fhir/R4")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://emr_user:emr_password@localhost:5432/emr_db")
TEST_TIMEOUT = 30  # seconds

# Common headers
FHIR_JSON_HEADERS = {
    "Accept": "application/fhir+json",
    "Content-Type": "application/fhir+json"
}


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def http_client():
    """Async HTTP client for API testing."""
    async with httpx.AsyncClient(
        base_url=BASE_URL,
        timeout=TEST_TIMEOUT,
        headers=FHIR_JSON_HEADERS
    ) as client:
        yield client


@pytest.fixture(scope="session")
async def db_connection():
    """Database connection for test data verification."""
    conn = await asyncpg.connect(DATABASE_URL)
    yield conn
    await conn.close()


@pytest.fixture(scope="session")
async def test_patients(db_connection) -> List[Dict[str, Any]]:
    """Get a list of test patients from the database."""
    query = """
    SELECT 
        fhir_id,
        resource->>'birthDate' as birth_date,
        resource->'name'->0->>'family' as family_name,
        resource->'name'->0->'given'->0 as given_name,
        resource
    FROM fhir.resources
    WHERE resource_type = 'Patient'
    AND deleted = false
    ORDER BY created_at DESC
    LIMIT 5
    """
    
    rows = await db_connection.fetch(query)
    patients = []
    
    for row in rows:
        patients.append({
            "id": row["fhir_id"],
            "birthDate": row["birth_date"],
            "familyName": row["family_name"],
            "givenName": str(row["given_name"]) if row["given_name"] else None,
            "resource": dict(row["resource"])
        })
    
    if not patients:
        pytest.skip("No test patients available. Run synthea_master.py first.")
    
    return patients


@pytest.fixture
async def test_patient(test_patients) -> Dict[str, Any]:
    """Get a single test patient."""
    return test_patients[0]


@pytest.fixture(scope="session")
async def resource_counts(db_connection) -> Dict[str, int]:
    """Get counts of all resource types in the database."""
    query = """
    SELECT resource_type, COUNT(*) as count
    FROM fhir.resources
    WHERE deleted = false OR deleted IS NULL
    GROUP BY resource_type
    """
    
    rows = await db_connection.fetch(query)
    return {row["resource_type"]: row["count"] for row in rows}


@pytest.fixture
async def sample_condition() -> Dict[str, Any]:
    """Sample Condition resource for testing."""
    return {
        "resourceType": "Condition",
        "clinicalStatus": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                "code": "active"
            }]
        },
        "verificationStatus": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                "code": "confirmed"
            }]
        },
        "code": {
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": "59621000",
                "display": "Essential hypertension"
            }],
            "text": "Essential hypertension"
        },
        "subject": {
            "reference": "Patient/placeholder"  # Will be replaced in tests
        },
        "onsetDateTime": "2024-01-15T10:00:00Z"
    }


@pytest.fixture
async def sample_observation() -> Dict[str, Any]:
    """Sample Observation resource for testing."""
    return {
        "resourceType": "Observation",
        "status": "final",
        "category": [{
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                "code": "vital-signs",
                "display": "Vital Signs"
            }]
        }],
        "code": {
            "coding": [{
                "system": "http://loinc.org",
                "code": "85354-9",
                "display": "Blood pressure panel"
            }]
        },
        "subject": {
            "reference": "Patient/placeholder"  # Will be replaced in tests
        },
        "effectiveDateTime": "2024-01-15T10:00:00Z",
        "component": [
            {
                "code": {
                    "coding": [{
                        "system": "http://loinc.org",
                        "code": "8480-6",
                        "display": "Systolic blood pressure"
                    }]
                },
                "valueQuantity": {
                    "value": 120,
                    "unit": "mmHg",
                    "system": "http://unitsofmeasure.org",
                    "code": "mm[Hg]"
                }
            },
            {
                "code": {
                    "coding": [{
                        "system": "http://loinc.org",
                        "code": "8462-4",
                        "display": "Diastolic blood pressure"
                    }]
                },
                "valueQuantity": {
                    "value": 80,
                    "unit": "mmHg",
                    "system": "http://unitsofmeasure.org",
                    "code": "mm[Hg]"
                }
            }
        ]
    }


@pytest.fixture
async def sample_medication_request() -> Dict[str, Any]:
    """Sample MedicationRequest resource for testing."""
    return {
        "resourceType": "MedicationRequest",
        "status": "active",
        "intent": "order",
        "medicationCodeableConcept": {
            "coding": [{
                "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                "code": "314076",
                "display": "lisinopril 10 MG Oral Tablet"
            }]
        },
        "subject": {
            "reference": "Patient/placeholder"  # Will be replaced in tests
        },
        "authoredOn": "2024-01-15T10:00:00Z",
        "dosageInstruction": [{
            "text": "Take 1 tablet by mouth daily",
            "timing": {
                "repeat": {
                    "frequency": 1,
                    "period": 1,
                    "periodUnit": "d"
                }
            },
            "doseAndRate": [{
                "doseQuantity": {
                    "value": 1,
                    "unit": "tablet"
                }
            }]
        }]
    }


@pytest.fixture
async def invalid_resources() -> Dict[str, Dict[str, Any]]:
    """Invalid resources for error testing."""
    return {
        "missing_required": {
            "resourceType": "Patient"
            # Missing required fields like name, gender, etc.
        },
        "invalid_reference": {
            "resourceType": "Condition",
            "subject": {
                "reference": "InvalidType/123"  # Invalid reference format
            }
        },
        "invalid_code": {
            "resourceType": "Observation",
            "status": "invalid-status",  # Invalid status code
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "invalid"
                }]
            }
        },
        "malformed_json": "{invalid json}",
        "wrong_type": {
            "resourceType": "NotAResource",
            "id": "123"
        }
    }


@pytest.fixture
def performance_thresholds() -> Dict[str, float]:
    """Performance thresholds for different operations (in seconds)."""
    return {
        "single_read": 0.1,           # 100ms
        "simple_search": 0.5,         # 500ms
        "complex_search": 2.0,        # 2 seconds
        "patient_everything": 3.0,    # 3 seconds
        "bundle_transaction": 1.0,    # 1 second per 10 resources
        "history": 1.0,              # 1 second
    }


@pytest.fixture
async def cleanup_resources(http_client, db_connection):
    """Cleanup function to delete test-created resources."""
    created_resources = []
    
    def track_resource(resource_type: str, resource_id: str):
        created_resources.append((resource_type, resource_id))
    
    yield track_resource
    
    # Cleanup after test
    for resource_type, resource_id in created_resources:
        try:
            await http_client.delete(f"/{resource_type}/{resource_id}")
        except Exception as e:
            logger.warning(f"Failed to cleanup {resource_type}/{resource_id}: {e}")


class TestDataValidator:
    """Utility class for validating test data and responses."""
    
    @staticmethod
    def is_valid_bundle(data: Dict[str, Any], expected_type: str = "searchset") -> bool:
        """Validate FHIR Bundle structure."""
        if not isinstance(data, dict):
            return False
        
        if data.get("resourceType") != "Bundle":
            return False
        
        if data.get("type") != expected_type:
            return False
        
        if "entry" not in data and "total" not in data:
            return False
        
        return True
    
    @staticmethod
    def is_valid_operation_outcome(data: Dict[str, Any]) -> bool:
        """Validate OperationOutcome structure."""
        if not isinstance(data, dict):
            return False
        
        if data.get("resourceType") != "OperationOutcome":
            return False
        
        if "issue" not in data or not isinstance(data["issue"], list):
            return False
        
        return True
    
    @staticmethod
    def has_search_parameter(bundle: Dict[str, Any], param: str, value: str) -> bool:
        """Check if all bundle entries match a search parameter."""
        if not bundle.get("entry"):
            return True  # Empty results are valid
        
        for entry in bundle["entry"]:
            resource = entry.get("resource", {})
            
            # Handle different parameter types
            if param == "patient" or param == "subject":
                ref = resource.get(param, {}).get("reference", "")
                if not ref.endswith(f"/{value}"):
                    return False
            
            elif param == "status":
                if resource.get("status") != value:
                    return False
            
            # Add more parameter handlers as needed
        
        return True


@pytest.fixture
def test_validator():
    """Test data validator instance."""
    return TestDataValidator()


# Markers for test categorization
def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line("markers", "crud: CRUD operation tests")
    config.addinivalue_line("markers", "search: Search functionality tests")
    config.addinivalue_line("markers", "compliance: FHIR compliance tests")
    config.addinivalue_line("markers", "performance: Performance tests")
    config.addinivalue_line("markers", "security: Security tests")
    config.addinivalue_line("markers", "slow: Slow running tests")
    config.addinivalue_line("markers", "integration: Integration tests requiring full stack")


# Test report helpers
@pytest.fixture(scope="session")
def test_report(request):
    """Generate test execution report."""
    report_data = {
        "start_time": datetime.now().isoformat(),
        "test_results": [],
        "summary": {}
    }
    
    def add_result(test_name: str, status: str, duration: float, details: Dict = None):
        report_data["test_results"].append({
            "test": test_name,
            "status": status,
            "duration": duration,
            "timestamp": datetime.now().isoformat(),
            "details": details or {}
        })
    
    yield add_result
    
    # Generate summary report after all tests
    report_data["end_time"] = datetime.now().isoformat()
    report_data["summary"] = {
        "total": len(report_data["test_results"]),
        "passed": sum(1 for r in report_data["test_results"] if r["status"] == "passed"),
        "failed": sum(1 for r in report_data["test_results"] if r["status"] == "failed"),
        "skipped": sum(1 for r in report_data["test_results"] if r["status"] == "skipped")
    }
    
    # Save report
    report_dir = Path(__file__).parent / "reports"
    report_dir.mkdir(exist_ok=True)
    
    report_file = report_dir / f"test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_file, "w") as f:
        json.dump(report_data, f, indent=2)
    
    logger.info(f"Test report saved to: {report_file}")


# Utility functions
async def wait_for_resource(
    http_client: httpx.AsyncClient,
    resource_type: str,
    resource_id: str,
    max_wait: int = 5
) -> Optional[Dict[str, Any]]:
    """Wait for a resource to become available (useful for async operations)."""
    for _ in range(max_wait):
        try:
            response = await http_client.get(f"/{resource_type}/{resource_id}")
            if response.status_code == 200:
                return response.json()
        except Exception:
            pass
        await asyncio.sleep(1)
    
    return None


async def create_test_bundle(resources: List[Dict[str, Any]], bundle_type: str = "transaction") -> Dict[str, Any]:
    """Create a FHIR Bundle from a list of resources."""
    entries = []
    
    for resource in resources:
        entry = {
            "resource": resource,
            "request": {
                "method": "POST",
                "url": resource["resourceType"]
            }
        }
        
        if bundle_type == "transaction":
            entry["fullUrl"] = f"urn:uuid:{resource.get('id', 'temp-id')}"
        
        entries.append(entry)
    
    return {
        "resourceType": "Bundle",
        "type": bundle_type,
        "entry": entries
    }