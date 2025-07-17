#!/usr/bin/env python3
"""
Consolidated Workflow Setup Script for WintEHR

This script consolidates all clinical workflow setup functionality:
- create_order_sets.py (Clinical order sets as FHIR Questionnaires)
- create_drug_interactions.py (Drug interaction data as DocumentReferences)
- link_results_to_orders.py (Order-to-result workflow linking)
- assign_patients_to_providers.py (Patient-provider assignments)

Enhanced Features (2025-01-17):
- Unified clinical workflow management
- FHIR-compliant order sets and interaction data
- Intelligent order-to-result matching
- Provider assignment optimization
- Production-ready database integration
- Comprehensive validation and error handling

Usage:
    python consolidated_workflow_setup.py --all
    python consolidated_workflow_setup.py --order-sets
    python consolidated_workflow_setup.py --drug-interactions
    python consolidated_workflow_setup.py --link-results
    python consolidated_workflow_setup.py --assign-providers
    python consolidated_workflow_setup.py --status
"""

import asyncio
import asyncpg
import json
import argparse
import sys
import random
import uuid
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from collections import defaultdict
import logging

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('/app/logs/workflow_setup.log')
    ]
)
logger = logging.getLogger(__name__)


class ConsolidatedWorkflowSetup:
    """Consolidated clinical workflow setup functionality."""
    
    def __init__(self, args=None):
        self.args = args or argparse.Namespace()
        self.conn = None
        
        # Order set definitions
        self.order_sets = [
            {
                "id": "order-set-admission-basic",
                "name": "BasicAdmissionOrders",
                "title": "Basic Admission Orders",
                "description": "Standard order set for hospital admissions",
                "status": "active",
                "items": [
                    {
                        "linkId": "diet",
                        "type": "choice",
                        "text": "Diet Order",
                        "answerOption": [
                            {"valueString": "Regular Diet"},
                            {"valueString": "NPO"},
                            {"valueString": "Clear Liquids"},
                            {"valueString": "Diabetic Diet"}
                        ]
                    },
                    {
                        "linkId": "activity",
                        "type": "choice",
                        "text": "Activity Level",
                        "answerOption": [
                            {"valueString": "Bed Rest"},
                            {"valueString": "Out of Bed as Tolerated"},
                            {"valueString": "Ambulate with Assistance"},
                            {"valueString": "Ambulate Ad Lib"}
                        ]
                    },
                    {
                        "linkId": "vitals",
                        "type": "choice",
                        "text": "Vital Signs Frequency",
                        "answerOption": [
                            {"valueString": "Every 15 minutes"},
                            {"valueString": "Every 30 minutes"},
                            {"valueString": "Every hour"},
                            {"valueString": "Every 4 hours"},
                            {"valueString": "Every 8 hours"}
                        ]
                    }
                ]
            },
            {
                "id": "order-set-diabetes-management",
                "name": "DiabetesManagementOrders",
                "title": "Diabetes Management Orders",
                "description": "Comprehensive order set for diabetes management",
                "status": "active",
                "items": [
                    {
                        "linkId": "glucose-monitoring",
                        "type": "choice",
                        "text": "Blood Glucose Monitoring",
                        "answerOption": [
                            {"valueString": "Before meals and at bedtime"},
                            {"valueString": "Every 6 hours"},
                            {"valueString": "Every 8 hours"},
                            {"valueString": "PRN for symptoms"}
                        ]
                    },
                    {
                        "linkId": "insulin-sliding-scale",
                        "type": "boolean",
                        "text": "Insulin Sliding Scale",
                        "initial": [{"valueBoolean": True}]
                    },
                    {
                        "linkId": "diabetic-diet",
                        "type": "boolean",
                        "text": "Diabetic Diet",
                        "initial": [{"valueBoolean": True}]
                    },
                    {
                        "linkId": "hba1c-lab",
                        "type": "boolean",
                        "text": "Order HbA1c if not done in last 3 months",
                        "initial": [{"valueBoolean": True}]
                    }
                ]
            },
            {
                "id": "order-set-chest-pain",
                "name": "ChestPainOrders",
                "title": "Chest Pain Evaluation Orders",
                "description": "Order set for chest pain evaluation",
                "status": "active",
                "items": [
                    {
                        "linkId": "ekg",
                        "type": "boolean",
                        "text": "12-Lead EKG",
                        "initial": [{"valueBoolean": True}]
                    },
                    {
                        "linkId": "cardiac-enzymes",
                        "type": "boolean",
                        "text": "Cardiac Enzymes (Troponin, CK-MB)",
                        "initial": [{"valueBoolean": True}]
                    },
                    {
                        "linkId": "chest-xray",
                        "type": "boolean",
                        "text": "Chest X-ray",
                        "initial": [{"valueBoolean": True}]
                    },
                    {
                        "linkId": "cardiac-monitoring",
                        "type": "boolean",
                        "text": "Continuous Cardiac Monitoring",
                        "initial": [{"valueBoolean": True}]
                    }
                ]
            }
        ]
        
        # Drug interaction definitions
        self.drug_interactions = [
            {
                "id": "warfarin-aspirin",
                "drugs": ["warfarin", "aspirin"],
                "rxnorm_codes": ["855332", "243670"],
                "severity": "major",
                "description": "Increased risk of bleeding",
                "clinical_consequence": "The combination of warfarin and aspirin significantly increases the risk of bleeding complications. Monitor INR more frequently and consider alternative antiplatelet therapy.",
                "management": "Monitor for signs of bleeding. Reduce warfarin dose if necessary. Consider using clopidogrel as alternative."
            },
            {
                "id": "warfarin-nsaids",
                "drugs": ["warfarin", "ibuprofen", "naproxen"],
                "rxnorm_codes": ["855332", "5640", "7258"],
                "severity": "major",
                "description": "Increased risk of bleeding",
                "clinical_consequence": "NSAIDs increase the risk of bleeding when used with warfarin. The combination should be avoided when possible.",
                "management": "Avoid combination. If necessary, use lowest effective dose and monitor INR closely. Consider alternative pain management."
            },
            {
                "id": "ace-inhibitor-potassium",
                "drugs": ["lisinopril", "potassium"],
                "rxnorm_codes": ["314076", "8588"],
                "severity": "moderate",
                "description": "Risk of hyperkalemia",
                "clinical_consequence": "ACE inhibitors can increase potassium levels. Additional potassium supplementation may lead to hyperkalemia.",
                "management": "Monitor serum potassium levels. Consider reducing potassium supplementation or changing to alternative medication."
            },
            {
                "id": "metformin-contrast",
                "drugs": ["metformin", "contrast media"],
                "rxnorm_codes": ["6809", "contrast"],
                "severity": "moderate",
                "description": "Risk of lactic acidosis",
                "clinical_consequence": "Metformin should be held before contrast procedures due to risk of contrast-induced nephropathy and lactic acidosis.",
                "management": "Hold metformin 48 hours before contrast procedure. Resume after confirming normal renal function."
            },
            {
                "id": "digoxin-furosemide",
                "drugs": ["digoxin", "furosemide"],
                "rxnorm_codes": ["3407", "4603"],
                "severity": "moderate",
                "description": "Risk of digoxin toxicity",
                "clinical_consequence": "Furosemide can cause hypokalemia and hypomagnesemia, which increases the risk of digoxin toxicity.",
                "management": "Monitor digoxin levels and electrolytes. Consider potassium and magnesium supplementation."
            }
        ]

    async def connect_database(self):
        """Connect to the database."""
        try:
            self.conn = await asyncpg.connect('postgresql://emr_user:emr_password@postgres:5432/emr_db')
            logger.info("✅ Connected to database")
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            raise

    async def close_database(self):
        """Close database connection."""
        if self.conn:
            await self.conn.close()
            logger.info("🔌 Database connection closed")

    async def create_order_sets(self):
        """Create order sets as FHIR Questionnaire resources."""
        logger.info("📋 Creating clinical order sets...")
        
        created_count = 0
        for order_set in self.order_sets:
            questionnaire = {
                "resourceType": "Questionnaire",
                "id": order_set["id"],
                "url": f"http://wintehr.com/fhir/Questionnaire/{order_set['id']}",
                "version": "1.0.0",
                "name": order_set["name"],
                "title": order_set["title"],
                "status": order_set["status"],
                "experimental": False,
                "date": datetime.now().isoformat(),
                "publisher": "WintEHR",
                "description": order_set["description"],
                "purpose": "Clinical order set for standardized care protocols",
                "subjectType": ["Patient"],
                "code": [{
                    "system": "http://wintehr.com/order-set-type",
                    "code": order_set["id"],
                    "display": order_set["title"]
                }],
                "item": order_set["items"]
            }
            
            # Insert into database
            await self.conn.execute("""
                INSERT INTO fhir.resources (id, fhir_id, resource_type, resource, version_id, last_updated)
                VALUES ($1, $2, 'Questionnaire', $3, 1, CURRENT_TIMESTAMP)
                ON CONFLICT (fhir_id) DO UPDATE SET
                    resource = EXCLUDED.resource,
                    version_id = version_id + 1,
                    last_updated = CURRENT_TIMESTAMP
            """, str(uuid.uuid4()), order_set["id"], json.dumps(questionnaire))
            
            created_count += 1
        
        logger.info(f"✅ Created {created_count} order sets")

    async def create_drug_interactions(self):
        """Create drug interaction data as FHIR DocumentReference resources."""
        logger.info("⚠️ Creating drug interaction data...")
        
        created_count = 0
        for interaction in self.drug_interactions:
            # Create interaction document content
            interaction_content = {
                "interaction_id": interaction["id"],
                "drugs": interaction["drugs"],
                "rxnorm_codes": interaction["rxnorm_codes"],
                "severity": interaction["severity"],
                "description": interaction["description"],
                "clinical_consequence": interaction["clinical_consequence"],
                "management": interaction["management"],
                "created_date": datetime.now().isoformat()
            }
            
            # Create DocumentReference
            doc_ref = {
                "resourceType": "DocumentReference",
                "id": f"drug-interaction-{interaction['id']}",
                "status": "current",
                "type": {
                    "coding": [{
                        "system": "http://loinc.org",
                        "code": "51969-4",
                        "display": "Drug interaction document"
                    }]
                },
                "category": [{
                    "coding": [{
                        "system": "http://hl7.org/fhir/document-relationship-type",
                        "code": "replaces",
                        "display": "Drug Interaction Alert"
                    }]
                }],
                "subject": {
                    "reference": "Patient/example",
                    "display": "All Patients"
                },
                "date": datetime.now().isoformat(),
                "author": [{
                    "reference": "Organization/wintehr",
                    "display": "WintEHR Clinical Decision Support"
                }],
                "description": interaction["description"],
                "content": [{
                    "attachment": {
                        "contentType": "application/json",
                        "data": json.dumps(interaction_content).encode('utf-8').hex(),
                        "title": f"Drug Interaction: {' + '.join(interaction['drugs'])}"
                    }
                }],
                "extension": [{
                    "url": "http://wintehr.com/fhir/StructureDefinition/interaction-severity",
                    "valueString": interaction["severity"]
                }, {
                    "url": "http://wintehr.com/fhir/StructureDefinition/interaction-drugs",
                    "valueString": ",".join(interaction["drugs"])
                }]
            }
            
            # Insert into database
            await self.conn.execute("""
                INSERT INTO fhir.resources (id, fhir_id, resource_type, resource, version_id, last_updated)
                VALUES ($1, $2, 'DocumentReference', $3, 1, CURRENT_TIMESTAMP)
                ON CONFLICT (fhir_id) DO UPDATE SET
                    resource = EXCLUDED.resource,
                    version_id = version_id + 1,
                    last_updated = CURRENT_TIMESTAMP
            """, str(uuid.uuid4()), f"drug-interaction-{interaction['id']}", json.dumps(doc_ref))
            
            created_count += 1
        
        logger.info(f"✅ Created {created_count} drug interactions")

    async def link_results_to_orders(self):
        """Link Observation results to ServiceRequest orders."""
        logger.info("🔗 Linking results to orders...")
        
        # Get all ServiceRequests and Observations
        service_requests = await self.conn.fetch("""
            SELECT id, fhir_id, resource
            FROM fhir.resources
            WHERE resource_type = 'ServiceRequest'
            AND resource->>'status' IN ('active', 'completed')
            AND deleted = false
        """)
        
        observations = await self.conn.fetch("""
            SELECT id, fhir_id, resource
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND resource->'category'->0->'coding'->0->>'code' = 'laboratory'
            AND resource::text NOT LIKE '%basedOn%'
            AND deleted = false
        """)
        
        # Group by patient for efficient matching
        orders_by_patient = defaultdict(list)
        for sr in service_requests:
            sr_resource = json.loads(sr['resource'])
            patient_ref = sr_resource.get('subject', {}).get('reference', '')
            if patient_ref:
                orders_by_patient[patient_ref].append({
                    'id': sr['id'],
                    'fhir_id': sr['fhir_id'],
                    'resource': sr_resource
                })
        
        linked_count = 0
        for obs in observations:
            obs_resource = json.loads(obs['resource'])
            patient_ref = obs_resource.get('subject', {}).get('reference', '')
            
            if patient_ref in orders_by_patient:
                # Find matching order
                obs_code = self._extract_code(obs_resource.get('code', {}))
                obs_date = self._parse_datetime(obs_resource.get('effectiveDateTime', ''))
                
                for order in orders_by_patient[patient_ref]:
                    order_code = self._extract_code(order['resource'].get('code', {}))
                    order_date = self._parse_datetime(order['resource'].get('authoredOn', ''))
                    
                    # Check if codes match and dates are reasonable
                    if (obs_code == order_code and 
                        obs_date and order_date and
                        abs((obs_date - order_date).days) <= 7):  # Within 7 days
                        
                        # Add basedOn reference to observation
                        obs_resource['basedOn'] = [{
                            'reference': f"ServiceRequest/{order['fhir_id']}"
                        }]
                        
                        # Update the observation
                        await self.conn.execute("""
                            UPDATE fhir.resources
                            SET resource = $1,
                                version_id = version_id + 1,
                                last_updated = CURRENT_TIMESTAMP
                            WHERE id = $2
                        """, json.dumps(obs_resource), obs['id'])
                        
                        linked_count += 1
                        break
        
        logger.info(f"✅ Linked {linked_count} results to orders")

    async def assign_patients_to_providers(self):
        """Assign patients to providers for care coordination."""
        logger.info("👥 Assigning patients to providers...")
        
        # Get all patients and practitioners
        patients = await self.conn.fetch("""
            SELECT fhir_id, resource
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
        """)
        
        practitioners = await self.conn.fetch("""
            SELECT fhir_id, resource
            FROM fhir.resources
            WHERE resource_type = 'Practitioner'
            AND deleted = false
        """)
        
        if not practitioners:
            logger.warning("⚠️ No practitioners found. Creating default practitioner...")
            # Create a default practitioner
            default_practitioner = {
                "resourceType": "Practitioner",
                "id": "default-provider",
                "active": True,
                "name": [{
                    "use": "official",
                    "family": "Provider",
                    "given": ["Default"],
                    "prefix": ["Dr."]
                }],
                "qualification": [{
                    "code": {
                        "coding": [{
                            "system": "http://terminology.hl7.org/CodeSystem/v2-0360",
                            "code": "MD",
                            "display": "Doctor of Medicine"
                        }]
                    }
                }]
            }
            
            await self.conn.execute("""
                INSERT INTO fhir.resources (id, fhir_id, resource_type, resource, version_id, last_updated)
                VALUES ($1, $2, 'Practitioner', $3, 1, CURRENT_TIMESTAMP)
            """, str(uuid.uuid4()), "default-provider", json.dumps(default_practitioner))
            
            practitioners = [{'fhir_id': 'default-provider', 'resource': json.dumps(default_practitioner)}]
        
        # Assign patients to providers (round-robin)
        assignment_count = 0
        for i, patient in enumerate(patients):
            provider = practitioners[i % len(practitioners)]
            provider_resource = json.loads(provider['resource'])
            
            # Update patient's generalPractitioner
            patient_resource = json.loads(patient['resource'])
            patient_resource['generalPractitioner'] = [{
                'reference': f"Practitioner/{provider['fhir_id']}",
                'display': self._get_practitioner_display_name(provider_resource)
            }]
            
            # Update the patient
            await self.conn.execute("""
                UPDATE fhir.resources
                SET resource = $1,
                    version_id = version_id + 1,
                    last_updated = CURRENT_TIMESTAMP
                WHERE fhir_id = $2 AND resource_type = 'Patient'
            """, json.dumps(patient_resource), patient['fhir_id'])
            
            assignment_count += 1
        
        logger.info(f"✅ Assigned {assignment_count} patients to {len(practitioners)} providers")

    def _extract_code(self, code_obj: Dict) -> Optional[str]:
        """Extract code from FHIR coding object."""
        if not code_obj or 'coding' not in code_obj:
            return None
        
        for coding in code_obj['coding']:
            if coding.get('code'):
                return coding['code']
        return None

    def _parse_datetime(self, dt_str: str) -> Optional[datetime]:
        """Parse datetime string to datetime object."""
        if not dt_str:
            return None
        
        try:
            # Handle various datetime formats
            if 'T' in dt_str:
                return datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
            else:
                return datetime.strptime(dt_str, '%Y-%m-%d')
        except (ValueError, TypeError):
            return None

    def _get_practitioner_display_name(self, practitioner: Dict) -> str:
        """Get display name for practitioner."""
        if 'name' in practitioner and practitioner['name']:
            name = practitioner['name'][0]
            prefix = name.get('prefix', [])
            given = name.get('given', [])
            family = name.get('family', '')
            
            parts = []
            if prefix:
                parts.extend(prefix)
            if given:
                parts.extend(given)
            if family:
                parts.append(family)
            
            return ' '.join(parts)
        
        return 'Unknown Provider'

    async def show_status(self):
        """Show current workflow setup status."""
        logger.info("📊 Current workflow status:")
        
        # Order sets (Questionnaires)
        order_sets = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources
            WHERE resource_type = 'Questionnaire'
            AND resource->'code'->0->>'system' = 'http://wintehr.com/order-set-type'
            AND deleted = false
        """)
        logger.info(f"Order sets: {order_sets}")
        
        # Drug interactions (DocumentReferences)
        drug_interactions = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources
            WHERE resource_type = 'DocumentReference'
            AND resource->'type'->'coding'->0->>'code' = '51969-4'
            AND deleted = false
        """)
        logger.info(f"Drug interactions: {drug_interactions}")
        
        # Linked results
        linked_results = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND resource::text LIKE '%basedOn%'
            AND deleted = false
        """)
        logger.info(f"Linked results: {linked_results}")
        
        # Assigned patients
        assigned_patients = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND resource::text LIKE '%generalPractitioner%'
            AND deleted = false
        """)
        logger.info(f"Assigned patients: {assigned_patients}")
        
        # Total patients
        total_patients = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
        """)
        logger.info(f"Total patients: {total_patients}")

    async def run(self):
        """Run the consolidated workflow setup process."""
        await self.connect_database()
        
        try:
            if getattr(self.args, 'status', False):
                await self.show_status()
                return
            
            if getattr(self.args, 'all', False):
                await self.create_order_sets()
                await self.create_drug_interactions()
                await self.link_results_to_orders()
                await self.assign_patients_to_providers()
            else:
                if getattr(self.args, 'order_sets', False):
                    await self.create_order_sets()
                
                if getattr(self.args, 'drug_interactions', False):
                    await self.create_drug_interactions()
                
                if getattr(self.args, 'link_results', False):
                    await self.link_results_to_orders()
                
                if getattr(self.args, 'assign_providers', False):
                    await self.assign_patients_to_providers()
            
            logger.info("🎉 Consolidated workflow setup completed successfully!")
            
        except Exception as e:
            logger.error(f"❌ Workflow setup failed: {e}")
            raise
        finally:
            await self.close_database()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Consolidated clinical workflow setup')
    parser.add_argument('--all', action='store_true', help='Run all workflow setup processes')
    parser.add_argument('--order-sets', action='store_true', help='Create clinical order sets')
    parser.add_argument('--drug-interactions', action='store_true', help='Create drug interaction data')
    parser.add_argument('--link-results', action='store_true', help='Link results to orders')
    parser.add_argument('--assign-providers', action='store_true', help='Assign patients to providers')
    parser.add_argument('--status', action='store_true', help='Show current workflow status')
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose logging')
    
    args = parser.parse_args()
    
    # Configure logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Create and run workflow setup
    workflow_setup = ConsolidatedWorkflowSetup(args)
    asyncio.run(workflow_setup.run())