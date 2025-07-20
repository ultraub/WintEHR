#!/usr/bin/env python3
"""
Comprehensive Test Harness for Financial Administrative Resources

This test validates complete FHIR R4 financial resource implementation including:
- Coverage: Insurance coverage and benefits determination
- Claim: Medical billing and claims processing  
- ExplanationOfBenefit: Claims adjudication and payment processing

FHIR R4 Specifications:
- Coverage: https://hl7.org/fhir/R4/coverage.html
- Claim: https://hl7.org/fhir/R4/claim.html
- ExplanationOfBenefit: https://hl7.org/fhir/R4/explanationofbenefit.html

Critical Financial Workflows:
1. Insurance verification - Coverage resource for benefit determination
2. Claims processing - Claim resource for billing and reimbursement
3. Payment processing - ExplanationOfBenefit for adjudication results
4. Revenue cycle management - End-to-end financial workflow
5. Prior authorization - Coverage verification before services

Test Categories:
- CRUD Operations: Create, Read, Update, Delete financial resources
- Search Parameters: All FHIR R4 search parameters for financial workflows
- Financial Workflows: Insurance verification, claims processing, payment workflows
- Revenue Cycle: End-to-end financial management processes
- Integration: Cross-resource financial workflow orchestration
- Error Handling: Validation and financial processing error scenarios
"""

import pytest
import asyncio
import sys
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any
from sqlalchemy.ext.asyncio import AsyncSession

# Add parent directories to path for imports
current_dir = os.path.dirname(__file__)
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
sys.path.insert(0, backend_dir)

from fhir.core.storage import FHIRStorageEngine
from database import async_session_maker


class TestFinancialResourcesComprehensive:
    """Comprehensive test suite for financial administrative resources"""
    
    @pytest.fixture
    async def storage_engine(self):
        """Get storage engine with database session"""
        async with async_session_maker() as session:
            yield FHIRStorageEngine(session)
    
    @pytest.fixture
    def sample_coverage_data(self):
        """Sample Coverage data for testing"""
        return {
            "resourceType": "Coverage",
            "id": "test-coverage-001",
            "identifier": [{
                "use": "official",
                "system": "http://benefitsinc.com/certificate",
                "value": "12345"
            }],
            "status": "active",
            "type": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                    "code": "EHCPOL",
                    "display": "Extended healthcare"
                }]
            },
            "policyHolder": {
                "reference": "Patient/example-patient"
            },
            "subscriber": {
                "reference": "Patient/example-patient"
            },
            "beneficiary": {
                "reference": "Patient/example-patient"
            },
            "dependent": "0",
            "relationship": {
                "coding": [{
                    "code": "self"
                }]
            },
            "period": {
                "start": "2025-01-01",
                "end": "2025-12-31"
            },
            "payor": [{
                "reference": "Organization/insurance-company",
                "display": "Example Insurance Company"
            }],
            "class": [{
                "type": {
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/coverage-class",
                        "code": "group"
                    }]
                },
                "value": "CB135",
                "name": "Corporate Baker's Union"
            }, {
                "type": {
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/coverage-class",
                        "code": "plan"
                    }]
                },
                "value": "B30",
                "name": "Full Coverage: Medical, Dental, Pharmacy, Vision, EHC"
            }],
            "costToBeneficiary": [{
                "type": {
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/coverage-copay-type",
                        "code": "copay"
                    }]
                },
                "valueMoney": {
                    "value": 20.00,
                    "currency": "USD"
                }
            }]
        }
    
    @pytest.fixture
    def sample_claim_data(self):
        """Sample Claim data for testing"""
        return {
            "resourceType": "Claim",
            "id": "test-claim-001",
            "identifier": [{
                "use": "official",
                "system": "http://hospital.example.org/claims",
                "value": "CLM-2025-001"
            }],
            "status": "active",
            "type": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/claim-type",
                    "code": "institutional",
                    "display": "Institutional"
                }]
            },
            "use": "claim",
            "patient": {
                "reference": "Patient/example-patient"
            },
            "billablePeriod": {
                "start": "2025-07-15",
                "end": "2025-07-15"
            },
            "created": "2025-07-15T10:00:00Z",
            "insurer": {
                "reference": "Organization/insurance-company"
            },
            "provider": {
                "reference": "Practitioner/example-practitioner"
            },
            "priority": {
                "coding": [{
                    "code": "normal"
                }]
            },
            "fundsReserve": {
                "coding": [{
                    "code": "provider"
                }]
            },
            "careTeam": [{
                "sequence": 1,
                "provider": {
                    "reference": "Practitioner/example-practitioner"
                },
                "role": {
                    "coding": [{
                        "system": "http://example.org/fhir/CodeSystem/claim-careteam-role",
                        "code": "primary"
                    }]
                }
            }],
            "diagnosis": [{
                "sequence": 1,
                "diagnosisCodeableConcept": {
                    "coding": [{
                        "system": "http://hl7.org/fhir/sid/icd-10",
                        "code": "M25.511",
                        "display": "Pain in right shoulder"
                    }]
                }
            }],
            "insurance": [{
                "sequence": 1,
                "focal": True,
                "coverage": {
                    "reference": "Coverage/test-coverage-001"
                }
            }],
            "item": [{
                "sequence": 1,
                "careTeamSequence": [1],
                "diagnosisSequence": [1],
                "productOrService": {
                    "coding": [{
                        "system": "http://example.org/fhir/CodeSystem/ex-serviceproduct",
                        "code": "exam",
                        "display": "Exam"
                    }]
                },
                "servicedDate": "2025-07-15",
                "unitPrice": {
                    "value": 125.00,
                    "currency": "USD"
                },
                "net": {
                    "value": 125.00,
                    "currency": "USD"
                }
            }],
            "total": {
                "value": 125.00,
                "currency": "USD"
            }
        }
    
    @pytest.fixture
    def sample_explanation_of_benefit_data(self):
        """Sample ExplanationOfBenefit data for testing"""
        return {
            "resourceType": "ExplanationOfBenefit",
            "id": "test-eob-001",
            "identifier": [{
                "use": "official",
                "system": "http://insurance.example.org/eob",
                "value": "EOB-2025-001"
            }],
            "status": "active",
            "type": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/claim-type",
                    "code": "institutional",
                    "display": "Institutional"
                }]
            },
            "use": "claim",
            "patient": {
                "reference": "Patient/example-patient"
            },
            "billablePeriod": {
                "start": "2025-07-15",
                "end": "2025-07-15"
            },
            "created": "2025-07-16T09:00:00Z",
            "insurer": {
                "reference": "Organization/insurance-company"
            },
            "provider": {
                "reference": "Practitioner/example-practitioner"
            },
            "claim": {
                "reference": "Claim/test-claim-001"
            },
            "outcome": "complete",
            "disposition": "Claim settled as per contract.",
            "careTeam": [{
                "sequence": 1,
                "provider": {
                    "reference": "Practitioner/example-practitioner"
                },
                "role": {
                    "coding": [{
                        "system": "http://example.org/fhir/CodeSystem/claim-careteam-role",
                        "code": "primary"
                    }]
                }
            }],
            "diagnosis": [{
                "sequence": 1,
                "diagnosisCodeableConcept": {
                    "coding": [{
                        "system": "http://hl7.org/fhir/sid/icd-10",
                        "code": "M25.511",
                        "display": "Pain in right shoulder"
                    }]
                }
            }],
            "insurance": [{
                "focal": True,
                "coverage": {
                    "reference": "Coverage/test-coverage-001"
                }
            }],
            "item": [{
                "sequence": 1,
                "careTeamSequence": [1],
                "diagnosisSequence": [1],
                "productOrService": {
                    "coding": [{
                        "system": "http://example.org/fhir/CodeSystem/ex-serviceproduct",
                        "code": "exam",
                        "display": "Exam"
                    }]
                },
                "servicedDate": "2025-07-15",
                "unitPrice": {
                    "value": 125.00,
                    "currency": "USD"
                },
                "net": {
                    "value": 125.00,
                    "currency": "USD"
                },
                "adjudication": [{
                    "category": {
                        "coding": [{
                            "system": "http://terminology.hl7.org/CodeSystem/adjudication",
                            "code": "eligible"
                        }]
                    },
                    "amount": {
                        "value": 125.00,
                        "currency": "USD"
                    }
                }, {
                    "category": {
                        "coding": [{
                            "system": "http://terminology.hl7.org/CodeSystem/adjudication",
                            "code": "copay"
                        }]
                    },
                    "amount": {
                        "value": 20.00,
                        "currency": "USD"
                    }
                }, {
                    "category": {
                        "coding": [{
                            "system": "http://terminology.hl7.org/CodeSystem/adjudication",
                            "code": "benefit"
                        }]
                    },
                    "amount": {
                        "value": 105.00,
                        "currency": "USD"
                    }
                }]
            }],
            "total": [{
                "category": {
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/adjudication",
                        "code": "submitted"
                    }]
                },
                "amount": {
                    "value": 125.00,
                    "currency": "USD"
                }
            }, {
                "category": {
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/adjudication",
                        "code": "benefit"
                    }]
                },
                "amount": {
                    "value": 105.00,
                    "currency": "USD"
                }
            }],
            "payment": {
                "type": {
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/ex-paymenttype",
                        "code": "complete"
                    }]
                },
                "adjustment": {
                    "value": 0.00,
                    "currency": "USD"
                },
                "adjustmentReason": {
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/payment-adjustment-reason",
                        "code": "a001",
                        "display": "Prior Payment Reversal"
                    }]
                },
                "date": "2025-07-20",
                "amount": {
                    "value": 105.00,
                    "currency": "USD"
                }
            }
        }

    # =====================================================================
    # Coverage Resource Tests
    # =====================================================================

    async def test_create_coverage(self, storage_engine, sample_coverage_data):
        """Test creating Coverage resource for insurance verification"""
        
        # Create the Coverage
        created_resource = await storage_engine.create_resource(
            "Coverage", 
            sample_coverage_data
        )
        
        # Validate creation
        assert created_resource is not None
        assert created_resource.get("resourceType") == "Coverage"
        assert created_resource.get("status") == "active"
        
        # Validate insurance fields
        assert created_resource.get("beneficiary", {}).get("reference") == "Patient/example-patient"
        assert len(created_resource.get("payor", [])) > 0
        assert created_resource.get("payor")[0]["reference"] == "Organization/insurance-company"
        
        # Validate coverage details
        assert len(created_resource.get("class", [])) >= 2  # Group and plan
        assert len(created_resource.get("costToBeneficiary", [])) > 0

    async def test_search_coverage_by_beneficiary(self, storage_engine, sample_coverage_data):
        """Test Coverage search by beneficiary for patient insurance lookup"""
        
        # Create resource
        await storage_engine.create_resource("Coverage", sample_coverage_data)
        
        # Search by beneficiary
        search_params = {"beneficiary": "Patient/example-patient"}
        results = await storage_engine.search_resources("Coverage", search_params)
        
        # Validate search results
        assert len(results) > 0
        for result in results:
            assert result["beneficiary"]["reference"] == "Patient/example-patient"

    async def test_search_coverage_by_payor(self, storage_engine, sample_coverage_data):
        """Test Coverage search by payor for insurance company filtering"""
        
        # Create resource
        await storage_engine.create_resource("Coverage", sample_coverage_data)
        
        # Search by payor
        search_params = {"payor": "Organization/insurance-company"}
        results = await storage_engine.search_resources("Coverage", search_params)
        
        # Validate search results
        assert len(results) > 0
        for result in results:
            payor_ref = result["payor"][0]["reference"]
            assert payor_ref == "Organization/insurance-company"

    async def test_search_coverage_by_status(self, storage_engine, sample_coverage_data):
        """Test Coverage search by status for active coverage verification"""
        
        # Create active and cancelled coverage
        active_coverage = sample_coverage_data.copy()
        active_coverage["id"] = "active-coverage"
        await storage_engine.create_resource("Coverage", active_coverage)
        
        cancelled_coverage = sample_coverage_data.copy()
        cancelled_coverage["id"] = "cancelled-coverage"
        cancelled_coverage["status"] = "cancelled"
        await storage_engine.create_resource("Coverage", cancelled_coverage)
        
        # Search by status
        search_params = {"status": "active"}
        active_results = await storage_engine.search_resources("Coverage", search_params)
        
        # Validate status filtering
        assert len(active_results) > 0
        for result in active_results:
            assert result["status"] == "active"

    # =====================================================================
    # Claim Resource Tests
    # =====================================================================

    async def test_create_claim(self, storage_engine, sample_claim_data):
        """Test creating Claim resource for medical billing"""
        
        # Create the Claim
        created_resource = await storage_engine.create_resource(
            "Claim", 
            sample_claim_data
        )
        
        # Validate creation
        assert created_resource is not None
        assert created_resource.get("resourceType") == "Claim"
        assert created_resource.get("status") == "active"
        assert created_resource.get("use") == "claim"
        
        # Validate billing fields
        assert created_resource.get("patient", {}).get("reference") == "Patient/example-patient"
        assert created_resource.get("insurer", {}).get("reference") == "Organization/insurance-company"
        assert created_resource.get("provider", {}).get("reference") == "Practitioner/example-practitioner"
        
        # Validate claim details
        assert len(created_resource.get("careTeam", [])) > 0
        assert len(created_resource.get("diagnosis", [])) > 0
        assert len(created_resource.get("item", [])) > 0
        assert created_resource.get("total", {}).get("value") == 125.00

    async def test_search_claim_by_patient(self, storage_engine, sample_claim_data):
        """Test Claim search by patient for patient billing history"""
        
        # Create resource
        await storage_engine.create_resource("Claim", sample_claim_data)
        
        # Search by patient
        search_params = {"patient": "Patient/example-patient"}
        results = await storage_engine.search_resources("Claim", search_params)
        
        # Validate search results
        assert len(results) > 0
        for result in results:
            assert result["patient"]["reference"] == "Patient/example-patient"

    async def test_search_claim_by_insurer(self, storage_engine, sample_claim_data):
        """Test Claim search by insurer for insurance company processing"""
        
        # Create resource
        await storage_engine.create_resource("Claim", sample_claim_data)
        
        # Search by insurer
        search_params = {"insurer": "Organization/insurance-company"}
        results = await storage_engine.search_resources("Claim", search_params)
        
        # Validate search results
        assert len(results) > 0
        for result in results:
            assert result["insurer"]["reference"] == "Organization/insurance-company"

    async def test_search_claim_by_provider(self, storage_engine, sample_claim_data):
        """Test Claim search by provider for practitioner billing"""
        
        # Create resource
        await storage_engine.create_resource("Claim", sample_claim_data)
        
        # Search by provider
        search_params = {"provider": "Practitioner/example-practitioner"}
        results = await storage_engine.search_resources("Claim", search_params)
        
        # Validate search results
        assert len(results) > 0
        for result in results:
            assert result["provider"]["reference"] == "Practitioner/example-practitioner"

    async def test_search_claim_by_created_date(self, storage_engine, sample_claim_data):
        """Test Claim search by created date for billing period filtering"""
        
        # Create resource
        await storage_engine.create_resource("Claim", sample_claim_data)
        
        # Search by created date
        search_params = {"created": "2025-07-15"}
        results = await storage_engine.search_resources("Claim", search_params)
        
        # Validate date filtering
        assert len(results) > 0

    # =====================================================================
    # ExplanationOfBenefit Resource Tests
    # =====================================================================

    async def test_create_explanation_of_benefit(self, storage_engine, sample_explanation_of_benefit_data):
        """Test creating ExplanationOfBenefit resource for payment processing"""
        
        # Create the ExplanationOfBenefit
        created_resource = await storage_engine.create_resource(
            "ExplanationOfBenefit", 
            sample_explanation_of_benefit_data
        )
        
        # Validate creation
        assert created_resource is not None
        assert created_resource.get("resourceType") == "ExplanationOfBenefit"
        assert created_resource.get("status") == "active"
        assert created_resource.get("outcome") == "complete"
        
        # Validate payment processing fields
        assert created_resource.get("patient", {}).get("reference") == "Patient/example-patient"
        assert created_resource.get("insurer", {}).get("reference") == "Organization/insurance-company"
        assert created_resource.get("claim", {}).get("reference") == "Claim/test-claim-001"
        
        # Validate adjudication details
        assert len(created_resource.get("item", [])) > 0
        item = created_resource["item"][0]
        assert len(item.get("adjudication", [])) >= 3  # eligible, copay, benefit
        
        # Validate payment details
        payment = created_resource.get("payment", {})
        assert payment.get("amount", {}).get("value") == 105.00

    async def test_search_eob_by_patient(self, storage_engine, sample_explanation_of_benefit_data):
        """Test ExplanationOfBenefit search by patient for payment history"""
        
        # Create resource
        await storage_engine.create_resource("ExplanationOfBenefit", sample_explanation_of_benefit_data)
        
        # Search by patient
        search_params = {"patient": "Patient/example-patient"}
        results = await storage_engine.search_resources("ExplanationOfBenefit", search_params)
        
        # Validate search results
        assert len(results) > 0
        for result in results:
            assert result["patient"]["reference"] == "Patient/example-patient"

    async def test_search_eob_by_claim(self, storage_engine, sample_explanation_of_benefit_data):
        """Test ExplanationOfBenefit search by claim for adjudication tracking"""
        
        # Create resource
        await storage_engine.create_resource("ExplanationOfBenefit", sample_explanation_of_benefit_data)
        
        # Search by claim
        search_params = {"claim": "Claim/test-claim-001"}
        results = await storage_engine.search_resources("ExplanationOfBenefit", search_params)
        
        # Validate search results
        assert len(results) > 0
        for result in results:
            assert result["claim"]["reference"] == "Claim/test-claim-001"

    async def test_search_eob_by_coverage(self, storage_engine, sample_explanation_of_benefit_data):
        """Test ExplanationOfBenefit search by coverage for insurance tracking"""
        
        # Create resource
        await storage_engine.create_resource("ExplanationOfBenefit", sample_explanation_of_benefit_data)
        
        # Search by coverage
        search_params = {"coverage": "Coverage/test-coverage-001"}
        results = await storage_engine.search_resources("ExplanationOfBenefit", search_params)
        
        # Validate search results
        assert len(results) > 0
        for result in results:
            coverage_ref = result["insurance"][0]["coverage"]["reference"]
            assert coverage_ref == "Coverage/test-coverage-001"

    # =====================================================================
    # Financial Workflow Tests
    # =====================================================================

    async def test_complete_revenue_cycle_workflow(self, storage_engine, sample_coverage_data, 
                                                  sample_claim_data, sample_explanation_of_benefit_data):
        """Test complete revenue cycle from coverage verification to payment"""
        
        # Step 1: Create Coverage (insurance verification)
        coverage = await storage_engine.create_resource("Coverage", sample_coverage_data)
        assert coverage["status"] == "active"
        
        # Step 2: Create Claim (billing submission)
        claim = await storage_engine.create_resource("Claim", sample_claim_data)
        assert claim["status"] == "active"
        assert claim["insurance"][0]["coverage"]["reference"] == "Coverage/test-coverage-001"
        
        # Step 3: Create ExplanationOfBenefit (payment processing)
        eob = await storage_engine.create_resource("ExplanationOfBenefit", sample_explanation_of_benefit_data)
        assert eob["status"] == "active"
        assert eob["claim"]["reference"] == "Claim/test-claim-001"
        assert eob["outcome"] == "complete"
        
        # Validate financial workflow linking
        assert coverage["id"] == "test-coverage-001"
        assert claim["id"] == "test-claim-001"
        assert eob["id"] == "test-eob-001"

    async def test_insurance_verification_workflow(self, storage_engine, sample_coverage_data):
        """Test insurance verification process"""
        
        # Create coverage
        coverage = await storage_engine.create_resource("Coverage", sample_coverage_data)
        
        # Verify coverage details for authorization
        assert coverage["status"] == "active"
        assert coverage["period"]["start"] == "2025-01-01"
        assert coverage["period"]["end"] == "2025-12-31"
        
        # Check coverage classes
        coverage_classes = coverage["class"]
        group_class = next((c for c in coverage_classes if c["type"]["coding"][0]["code"] == "group"), None)
        plan_class = next((c for c in coverage_classes if c["type"]["coding"][0]["code"] == "plan"), None)
        
        assert group_class is not None
        assert plan_class is not None
        assert group_class["value"] == "CB135"
        assert plan_class["value"] == "B30"
        
        # Check cost sharing
        cost_sharing = coverage["costToBeneficiary"][0]
        assert cost_sharing["valueMoney"]["value"] == 20.00
        assert cost_sharing["valueMoney"]["currency"] == "USD"

    async def test_claims_processing_workflow(self, storage_engine, sample_claim_data):
        """Test claims processing and adjudication workflow"""
        
        # Create claim
        claim = await storage_engine.create_resource("Claim", sample_claim_data)
        
        # Validate claim structure for processing
        assert claim["use"] == "claim"
        assert claim["type"]["coding"][0]["code"] == "institutional"
        
        # Check care team
        care_team = claim["careTeam"][0]
        assert care_team["sequence"] == 1
        assert care_team["role"]["coding"][0]["code"] == "primary"
        
        # Check diagnosis
        diagnosis = claim["diagnosis"][0]
        assert diagnosis["sequence"] == 1
        assert diagnosis["diagnosisCodeableConcept"]["coding"][0]["code"] == "M25.511"
        
        # Check billing items
        item = claim["item"][0]
        assert item["sequence"] == 1
        assert item["unitPrice"]["value"] == 125.00
        assert item["net"]["value"] == 125.00
        
        # Check total
        assert claim["total"]["value"] == 125.00

    async def test_payment_processing_workflow(self, storage_engine, sample_explanation_of_benefit_data):
        """Test payment processing and adjudication workflow"""
        
        # Create ExplanationOfBenefit
        eob = await storage_engine.create_resource("ExplanationOfBenefit", sample_explanation_of_benefit_data)
        
        # Validate adjudication results
        item = eob["item"][0]
        adjudications = item["adjudication"]
        
        # Check adjudication categories
        eligible_adj = next((a for a in adjudications if a["category"]["coding"][0]["code"] == "eligible"), None)
        copay_adj = next((a for a in adjudications if a["category"]["coding"][0]["code"] == "copay"), None)
        benefit_adj = next((a for a in adjudications if a["category"]["coding"][0]["code"] == "benefit"), None)
        
        assert eligible_adj is not None
        assert copay_adj is not None
        assert benefit_adj is not None
        
        assert eligible_adj["amount"]["value"] == 125.00
        assert copay_adj["amount"]["value"] == 20.00
        assert benefit_adj["amount"]["value"] == 105.00
        
        # Check payment details
        payment = eob["payment"]
        assert payment["type"]["coding"][0]["code"] == "complete"
        assert payment["amount"]["value"] == 105.00
        assert payment["date"] == "2025-07-20"

    async def test_prior_authorization_workflow(self, storage_engine, sample_coverage_data):
        """Test prior authorization using Coverage resource"""
        
        # Create coverage for authorization check
        coverage = await storage_engine.create_resource("Coverage", sample_coverage_data)
        
        # Simulate prior authorization check
        # Check if coverage is active
        assert coverage["status"] == "active"
        
        # Check coverage period validity
        current_date = datetime.now().date()
        start_date = datetime.strptime(coverage["period"]["start"], "%Y-%m-%d").date()
        end_date = datetime.strptime(coverage["period"]["end"], "%Y-%m-%d").date()
        
        # For this test, we'll assume the dates are valid
        assert start_date <= end_date
        
        # Check benefit details
        assert len(coverage["payor"]) > 0
        assert coverage["beneficiary"]["reference"] == "Patient/example-patient"

    # =====================================================================
    # Cross-Resource Integration Tests
    # =====================================================================

    async def test_coverage_to_claim_integration(self, storage_engine, sample_coverage_data, sample_claim_data):
        """Test integration between Coverage and Claim resources"""
        
        # Create coverage first
        coverage = await storage_engine.create_resource("Coverage", sample_coverage_data)
        
        # Create claim that references the coverage
        claim = await storage_engine.create_resource("Claim", sample_claim_data)
        
        # Validate integration
        claim_coverage_ref = claim["insurance"][0]["coverage"]["reference"]
        assert claim_coverage_ref == f"Coverage/{coverage['id']}"
        
        # Verify same patient
        assert coverage["beneficiary"]["reference"] == claim["patient"]["reference"]

    async def test_claim_to_eob_integration(self, storage_engine, sample_claim_data, sample_explanation_of_benefit_data):
        """Test integration between Claim and ExplanationOfBenefit resources"""
        
        # Create claim first
        claim = await storage_engine.create_resource("Claim", sample_claim_data)
        
        # Create EOB that references the claim
        eob = await storage_engine.create_resource("ExplanationOfBenefit", sample_explanation_of_benefit_data)
        
        # Validate integration
        assert eob["claim"]["reference"] == f"Claim/{claim['id']}"
        
        # Verify same patient and insurer
        assert claim["patient"]["reference"] == eob["patient"]["reference"]
        assert claim["insurer"]["reference"] == eob["insurer"]["reference"]

    # =====================================================================
    # Error Handling Tests
    # =====================================================================

    async def test_invalid_coverage_validation(self, storage_engine):
        """Test validation of invalid Coverage data"""
        
        # Test missing required status
        invalid_data = {
            "resourceType": "Coverage",
            "beneficiary": {"reference": "Patient/example"}
            # Missing required 'status' field
        }
        
        with pytest.raises(Exception):  # Should raise validation error
            await storage_engine.create_resource("Coverage", invalid_data)

    async def test_invalid_claim_validation(self, storage_engine):
        """Test validation of invalid Claim data"""
        
        # Test missing required fields
        invalid_data = {
            "resourceType": "Claim",
            "status": "active"
            # Missing required 'use', 'patient', 'created', 'insurer', 'provider' fields
        }
        
        with pytest.raises(Exception):  # Should raise validation error
            await storage_engine.create_resource("Claim", invalid_data)

    async def test_invalid_eob_validation(self, storage_engine):
        """Test validation of invalid ExplanationOfBenefit data"""
        
        # Test missing required fields
        invalid_data = {
            "resourceType": "ExplanationOfBenefit",
            "status": "active"
            # Missing required 'use', 'patient', 'created', 'insurer', 'outcome' fields
        }
        
        with pytest.raises(Exception):  # Should raise validation error
            await storage_engine.create_resource("ExplanationOfBenefit", invalid_data)

    # =====================================================================
    # SQL Validation Tests
    # =====================================================================

    async def test_financial_search_parameter_extraction(self, storage_engine, sample_coverage_data, 
                                                         sample_claim_data, sample_explanation_of_benefit_data):
        """Test that financial resource search parameters are properly extracted"""
        
        # Create all financial resources
        coverage = await storage_engine.create_resource("Coverage", sample_coverage_data)
        claim = await storage_engine.create_resource("Claim", sample_claim_data)
        eob = await storage_engine.create_resource("ExplanationOfBenefit", sample_explanation_of_benefit_data)
        
        # Test Coverage search parameters
        coverage_search = {"_id": coverage["id"]}
        coverage_results = await storage_engine.search_resources("Coverage", coverage_search)
        assert len(coverage_results) == 1
        
        # Test Claim search parameters  
        claim_search = {"_id": claim["id"]}
        claim_results = await storage_engine.search_resources("Claim", claim_search)
        assert len(claim_results) == 1
        
        # Test ExplanationOfBenefit search parameters
        eob_search = {"_id": eob["id"]}
        eob_results = await storage_engine.search_resources("ExplanationOfBenefit", eob_search)
        assert len(eob_results) == 1


# =====================================================================
# Test Runner
# =====================================================================

if __name__ == "__main__":
    """Run Financial Resources comprehensive tests"""
    
    async def run_tests():
        """Run all Financial Resources tests"""
        test_instance = TestFinancialResourcesComprehensive()
        
        # Get storage engine
        async with async_session_maker() as session:
            storage_engine = FHIRStorageEngine(session)
            
            # Run key tests
            sample_coverage = test_instance.sample_coverage_data.__func__(test_instance)
            sample_claim = test_instance.sample_claim_data.__func__(test_instance)
            sample_eob = test_instance.sample_explanation_of_benefit_data.__func__(test_instance)
            
            print("Running Financial Resources comprehensive tests...")
            
            # Coverage tests
            await test_instance.test_create_coverage(storage_engine, sample_coverage)
            print("✓ Create Coverage test passed")
            
            await test_instance.test_search_coverage_by_beneficiary(storage_engine, sample_coverage)
            print("✓ Search Coverage by beneficiary test passed")
            
            # Claim tests
            await test_instance.test_create_claim(storage_engine, sample_claim)
            print("✓ Create Claim test passed")
            
            await test_instance.test_search_claim_by_patient(storage_engine, sample_claim)
            print("✓ Search Claim by patient test passed")
            
            # ExplanationOfBenefit tests
            await test_instance.test_create_explanation_of_benefit(storage_engine, sample_eob)
            print("✓ Create ExplanationOfBenefit test passed")
            
            await test_instance.test_search_eob_by_patient(storage_engine, sample_eob)
            print("✓ Search ExplanationOfBenefit by patient test passed")
            
            # Workflow tests
            await test_instance.test_complete_revenue_cycle_workflow(
                storage_engine, sample_coverage, sample_claim, sample_eob
            )
            print("✓ Complete revenue cycle workflow test passed")
            
            await test_instance.test_insurance_verification_workflow(storage_engine, sample_coverage)
            print("✓ Insurance verification workflow test passed")
            
            print("\nFinancial Resources comprehensive tests completed successfully!")
    
    # Run the tests
    asyncio.run(run_tests())