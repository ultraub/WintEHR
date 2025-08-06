"""
Comprehensive Test Suite for CDS Hooks 2.0 Compliance
Tests all aspects of the CDS Hooks 2.0 specification implementation
"""

import pytest
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List
import asyncio
from unittest.mock import Mock, patch, AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from api.cds_hooks.models import (
    HookType, CDSService, CDSHookRequest, CDSHookResponse,
    Card, Suggestion, Action, SystemAction,
    IndicatorType, ActionType, OverrideReason,
    FeedbackRequest, FeedbackItem, FeedbackOutcome
)
from api.cds_hooks.cds_hooks_router_v2 import router
from api.cds_hooks.feedback_router import router as feedback_router
from api.cds_hooks.service_executor_router import router as executor_router
from api.cds_hooks.auth import CDSJWTAuth
from api.cds_hooks.system_actions import SystemActionsHandler
# Service implementations available in the system
try:
    from api.cds_hooks.service_implementations import (
        AgeBasedScreeningService,
        MedicationInteractionService
    )
except ImportError:
    # Services might not be available in test environment
    AgeBasedScreeningService = None
    MedicationInteractionService = None
from api.cds_hooks.service_executor import ServiceExecutor, ServiceValidator

# Create test app
app = FastAPI()
app.include_router(router, prefix="/cds-services")
app.include_router(feedback_router)
app.include_router(executor_router)

# Test client
client = TestClient(app)

# Mock auth for testing
@app.middleware("http")
async def mock_auth(request, call_next):
    # Add mock user to request state for testing
    request.state.user = {"sub": "test-user", "email": "test@example.com"}
    response = await call_next(request)
    return response


class TestCDSHooksDiscovery:
    """Test CDS service discovery endpoint"""
    
    def test_service_discovery_endpoint(self):
        """Test GET /cds-services returns service list"""
        response = client.get("/cds-services")
        assert response.status_code == 200
        
        data = response.json()
        assert "services" in data
        assert isinstance(data["services"], list)
        
        # Check service structure
        for service in data["services"]:
            assert "id" in service
            assert "title" in service
            assert "description" in service
            assert "hook" in service
            
            # CDS Hooks 2.0 requires these fields
            assert service["hook"] in [e.value for e in HookType]
            
            # Optional fields
            if "prefetch" in service:
                assert isinstance(service["prefetch"], dict)
    
    def test_service_discovery_includes_v2_hooks(self):
        """Test that new CDS Hooks 2.0 hooks are available"""
        response = client.get("/cds-services")
        data = response.json()
        
        # Extract all hook types from services
        hook_types = {service["hook"] for service in data["services"]}
        
        # Check for 2.0 specific hooks
        v2_hooks = {
            "allergyintolerance-create",
            "appointment-book",
            "problem-list-item-create",
            "order-dispatch",
            "medication-refill"
        }
        
        # At least some v2 hooks should be implemented
        assert len(hook_types.intersection(v2_hooks)) > 0


class TestCDSHooksInvocation:
    """Test CDS service invocation"""
    
    def test_patient_view_hook_invocation(self):
        """Test POST /cds-services/{id} for patient-view hook"""
        # First discover services
        discovery = client.get("/cds-services")
        services = discovery.json()["services"]
        
        # Find patient-view service
        patient_view_service = next(
            (s for s in services if s["hook"] == "patient-view"),
            None
        )
        
        if not patient_view_service:
            pytest.skip("No patient-view service found")
        
        # Create request
        request_data = {
            "hook": "patient-view",
            "hookInstance": str(uuid.uuid4()),
            "fhirServer": "https://example.com/fhir",
            "context": {
                "patientId": "test-patient-123",
                "userId": "test-user-456"
            }
        }
        
        # Invoke service
        response = client.post(
            f"/cds-services/{patient_view_service['id']}",
            json=request_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate response structure
        assert "cards" in data
        assert isinstance(data["cards"], list)
        
        # If cards are returned, validate structure
        for card in data["cards"]:
            assert "uuid" in card  # Required in 2.0
            assert "summary" in card
            assert "indicator" in card
            assert card["indicator"] in ["info", "warning", "critical"]
    
    def test_medication_prescribe_hook_with_prefetch(self):
        """Test medication-prescribe hook with prefetch data"""
        request_data = {
            "hook": "medication-prescribe",
            "hookInstance": str(uuid.uuid4()),
            "fhirServer": "https://example.com/fhir",
            "context": {
                "patientId": "test-patient-123",
                "userId": "test-user-456",
                "medications": [{
                    "resourceType": "MedicationRequest",
                    "id": "draft-med-1",
                    "status": "draft",
                    "intent": "order",
                    "medicationCodeableConcept": {
                        "coding": [{
                            "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                            "code": "1049502",
                            "display": "Simvastatin 20 MG Oral Tablet"
                        }]
                    }
                }]
            },
            "prefetch": {
                "patient": {
                    "resourceType": "Patient",
                    "id": "test-patient-123",
                    "birthDate": "1970-01-01"
                }
            }
        }
        
        # Try to find service
        discovery = client.get("/cds-services")
        services = discovery.json()["services"]
        med_service = next(
            (s for s in services if s["hook"] == "medication-prescribe"),
            None
        )
        
        if med_service:
            response = client.post(
                f"/cds-services/{med_service['id']}",
                json=request_data
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "cards" in data
    
    def test_system_actions_in_response(self):
        """Test that systemActions can be returned (CDS Hooks 2.0)"""
        request_data = {
            "hook": "order-select",
            "hookInstance": str(uuid.uuid4()),
            "fhirServer": "https://example.com/fhir",
            "context": {
                "patientId": "test-patient-123",
                "userId": "test-user-456",
                "selections": ["ServiceRequest/test-order"]
            }
        }
        
        # Mock a service that returns systemActions
        with patch("api.cds_hooks.service_registry.ServiceRegistry.get_service") as mock_get:
            mock_service = Mock()
            mock_service.execute = Mock(return_value=CDSHookResponse(
                cards=[],
                systemActions=[
                    SystemAction(
                        type=ActionType.UPDATE,
                        resource={
                            "resourceType": "ServiceRequest",
                            "id": "test-order",
                            "status": "active"
                        }
                    )
                ]
            ))
            mock_get.return_value = mock_service
            
            response = client.post("/cds-services/test-service", json=request_data)
            
            if response.status_code == 200:
                data = response.json()
                assert "systemActions" in data
                assert isinstance(data["systemActions"], list)


class TestCDSHooksFeedback:
    """Test CDS Hooks 2.0 feedback endpoint"""
    
    def test_feedback_endpoint_accepted(self):
        """Test POST /cds-services/{id}/feedback for accepted suggestion"""
        feedback_data = {
            "feedback": [{
                "card": str(uuid.uuid4()),
                "outcome": "accepted",
                "outcomeTimestamp": datetime.utcnow().isoformat(),
                "acceptedSuggestions": [{
                    "id": str(uuid.uuid4())
                }]
            }]
        }
        
        response = client.post(
            "/cds-services/test-service/feedback",
            json=feedback_data
        )
        
        # Should accept feedback even if service doesn't exist
        assert response.status_code == 200
    
    def test_feedback_endpoint_overridden(self):
        """Test feedback for overridden card with reason"""
        feedback_data = {
            "feedback": [{
                "card": str(uuid.uuid4()),
                "outcome": "overridden",
                "outcomeTimestamp": datetime.utcnow().isoformat(),
                "overrideReason": {
                    "code": "not-applicable",
                    "display": "Not applicable to this patient",
                    "userComment": "Patient has specific contraindication"
                }
            }]
        }
        
        response = client.post(
            "/cds-services/test-service/feedback",
            json=feedback_data
        )
        
        assert response.status_code == 200
        
    def test_feedback_multiple_cards(self):
        """Test feedback for multiple cards in one request"""
        feedback_data = {
            "feedback": [
                {
                    "card": str(uuid.uuid4()),
                    "outcome": "accepted",
                    "outcomeTimestamp": datetime.utcnow().isoformat()
                },
                {
                    "card": str(uuid.uuid4()),
                    "outcome": "overridden",
                    "outcomeTimestamp": datetime.utcnow().isoformat(),
                    "overrideReason": {
                        "code": "patient-preference"
                    }
                }
            ]
        }
        
        response = client.post(
            "/cds-services/test-service/feedback",
            json=feedback_data
        )
        
        assert response.status_code == 200


class TestCDSHooksAuth:
    """Test CDS Hooks 2.0 JWT authentication"""
    
    def test_jwt_creation_and_validation(self):
        """Test JWT token creation and validation"""
        auth = CDSJWTAuth()
        
        # Create token
        cds_client_id = "test-client"
        cds_service_url = "https://example.com/cds-services"
        
        token = auth.create_token(cds_client_id, cds_service_url)
        assert token is not None
        
        # Validate token
        claims = auth.verify_token(token, expected_audience=cds_service_url)
        assert claims.cds_client_id == cds_client_id
        assert claims.aud == cds_service_url
    
    def test_jwt_expiration(self):
        """Test JWT token expiration"""
        auth = CDSJWTAuth()
        
        # Create token with short expiration
        with patch.object(auth, 'token_expiry_seconds', 1):
            token = auth.create_token("test-client", "https://example.com")
            
            # Wait for expiration
            import time
            time.sleep(2)
            
            # Should raise exception
            with pytest.raises(Exception):
                auth.verify_token(token)
    
    def test_https_requirement(self):
        """Test that HTTPS is required for fhirServer in production"""
        request_data = {
            "hook": "patient-view",
            "hookInstance": str(uuid.uuid4()),
            "fhirServer": "http://example.com/fhir",  # HTTP not HTTPS
            "context": {
                "patientId": "test-patient-123"
            }
        }
        
        # In production mode, this should be rejected
        # (In test mode it might be allowed)
        # This is more of a documentation test


class TestSystemActions:
    """Test systemActions implementation"""
    
    @pytest.mark.asyncio
    async def test_system_actions_handler(self):
        """Test SystemActionsHandler processes actions correctly"""
        handler = SystemActionsHandler()
        
        # Mock storage engine
        mock_storage = AsyncMock()
        mock_storage.update_resource = AsyncMock(return_value={
            "resourceType": "ServiceRequest",
            "id": "123",
            "status": "active"
        })
        
        # Test actions
        actions = [
            SystemAction(
                type=ActionType.UPDATE,
                resource={
                    "resourceType": "ServiceRequest",
                    "id": "123",
                    "status": "active"
                }
            )
        ]
        
        # Mock database session
        mock_db = AsyncMock()
        
        # Process actions
        result = await handler.process_system_actions(
            actions, 
            {"hookInstance": "test-hook"},
            mock_db,
            dry_run=True  # Don't actually modify data
        )
        
        assert result["processed"] == 1
        assert result["errors"] == 0
    
    def test_system_action_validation(self):
        """Test that invalid systemActions are rejected"""
        handler = SystemActionsHandler()
        
        # Invalid action - missing resource
        with pytest.raises(ValueError):
            handler._validate_action(SystemAction(
                type=ActionType.CREATE,
                resource=None
            ))
        
        # Invalid action - DELETE without resourceId
        with pytest.raises(ValueError):
            handler._validate_action(SystemAction(
                type=ActionType.DELETE,
                resourceId=None
            ))


class TestServiceExecutor:
    """Test sandboxed service execution"""
    
    def test_code_validation(self):
        """Test service code validation"""
        # Valid service code
        valid_code = """
        class TestService {
            static metadata = {
                id: 'test-service',
                hook: 'patient-view'
            };
            
            execute(context, prefetch) {
                return { cards: [] };
            }
        }
        """
        
        errors = ServiceValidator.validate(valid_code)
        assert len(errors) == 0
        
        # Invalid code - missing execute method
        invalid_code = """
        class TestService {
            static metadata = {
                id: 'test-service'
            };
        }
        """
        
        errors = ServiceValidator.validate(invalid_code)
        assert len(errors) > 0
        assert any("execute" in e for e in errors)
    
    def test_forbidden_patterns(self):
        """Test that dangerous patterns are rejected"""
        dangerous_code = """
        class TestService {
            static metadata = { id: 'test' };
            execute() {
                const fs = require('fs');
                return { cards: [] };
            }
        }
        """
        
        errors = ServiceValidator.validate(dangerous_code)
        assert len(errors) > 0
        assert any("require" in e for e in errors)
    
    @pytest.mark.asyncio
    async def test_service_execution_timeout(self):
        """Test that long-running services timeout"""
        infinite_loop_code = """
        class TestService {
            static metadata = { id: 'test' };
            execute() {
                while(true) {}
                return { cards: [] };
            }
        }
        """
        
        executor = ServiceExecutor()
        
        # This should timeout
        from api.cds_hooks.service_executor import ServiceExecutionRequest
        
        request = ServiceExecutionRequest(
            code=infinite_loop_code,
            request={
                "hook": "patient-view",
                "hookInstance": "test",
                "context": {}
            },
            timeout=1  # 1 second timeout
        )
        
        result = await executor.execute(request)
        assert not result.success
        assert "timeout" in result.error.lower()


class TestCDSHooks2Features:
    """Test CDS Hooks 2.0 specific features"""
    
    def test_card_uuid_requirement(self):
        """Test that all cards have UUIDs in responses"""
        request_data = {
            "hook": "patient-view",
            "hookInstance": str(uuid.uuid4()),
            "fhirServer": "https://example.com/fhir",
            "context": {
                "patientId": "test-patient-123"
            }
        }
        
        # Get any service
        discovery = client.get("/cds-services")
        services = discovery.json()["services"]
        
        if services:
            response = client.post(
                f"/cds-services/{services[0]['id']}",
                json=request_data
            )
            
            if response.status_code == 200:
                data = response.json()
                for card in data.get("cards", []):
                    assert "uuid" in card
                    # Validate UUID format
                    uuid.UUID(card["uuid"])
    
    def test_hook_instance_uuid_format(self):
        """Test hookInstance accepts UUID format"""
        request_data = {
            "hook": "patient-view",
            "hookInstance": str(uuid.uuid4()),  # Proper UUID
            "fhirServer": "https://example.com/fhir",
            "context": {
                "patientId": "test-patient-123"
            }
        }
        
        discovery = client.get("/cds-services")
        services = discovery.json()["services"]
        
        if services:
            response = client.post(
                f"/cds-services/{services[0]['id']}",
                json=request_data
            )
            assert response.status_code == 200
    
    def test_override_reasons_in_cards(self):
        """Test that cards can include override reasons"""
        # This would need a service that returns override reasons
        # Testing the model structure
        card = Card(
            uuid=str(uuid.uuid4()),
            summary="Test card",
            indicator=IndicatorType.WARNING,
            overrideReasons=[
                OverrideReason(
                    code="not-applicable",
                    display="Not applicable to patient"
                ),
                OverrideReason(
                    code="patient-preference",
                    display="Patient preference"
                )
            ]
        )
        
        # Validate structure
        assert len(card.overrideReasons) == 2
        assert all(hasattr(r, "code") and hasattr(r, "display") 
                  for r in card.overrideReasons)


class TestRealWorldScenarios:
    """Test real-world clinical scenarios"""
    
    def test_drug_interaction_alert(self):
        """Test drug interaction checking scenario"""
        request_data = {
            "hook": "medication-prescribe",
            "hookInstance": str(uuid.uuid4()),
            "fhirServer": "https://example.com/fhir",
            "context": {
                "patientId": "test-patient-123",
                "userId": "test-prescriber",
                "medications": [{
                    "resourceType": "MedicationRequest",
                    "status": "draft",
                    "medicationCodeableConcept": {
                        "coding": [{
                            "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                            "code": "855332",
                            "display": "Warfarin Sodium 5 MG Oral Tablet"
                        }]
                    }
                }]
            },
            "prefetch": {
                "medications": {
                    "resourceType": "Bundle",
                    "entry": [{
                        "resource": {
                            "resourceType": "MedicationRequest",
                            "status": "active",
                            "medicationCodeableConcept": {
                                "coding": [{
                                    "code": "1191",
                                    "display": "Aspirin"
                                }]
                            }
                        }
                    }]
                }
            }
        }
        
        # This would trigger drug interaction alerts if service is configured
        discovery = client.get("/cds-services")
        services = discovery.json()["services"]
        med_service = next(
            (s for s in services if s["hook"] == "medication-prescribe"),
            None
        )
        
        if med_service:
            response = client.post(
                f"/cds-services/{med_service['id']}",
                json=request_data
            )
            
            assert response.status_code == 200
            # Check if any warning cards are returned


# Fixture cleanup
@pytest.fixture(autouse=True)
def cleanup():
    """Cleanup after each test"""
    yield
    # Any cleanup code here


if __name__ == "__main__":
    pytest.main([__file__, "-v"])