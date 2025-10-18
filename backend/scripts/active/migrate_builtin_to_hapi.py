"""
Migration Script: Convert Built-in CDS Services to HAPI PlanDefinitions

This script migrates WintEHR's built-in CDS Hooks services from in-memory registry
to HAPI FHIR PlanDefinition resources for unified service discovery and execution.

Architecture:
- HAPI FHIR becomes single source of truth for ALL CDS services
- PlanDefinitions use extensions to mark service origin and Python class
- Enables unified discovery endpoint querying only HAPI FHIR

Usage:
    python backend/scripts/active/migrate_builtin_to_hapi.py

    # Or via Docker:
    docker exec emr-backend python scripts/active/migrate_builtin_to_hapi.py
"""

import asyncio
import sys
import os
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from services.hapi_fhir_client import HAPIFHIRClient

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Built-in service definitions to migrate
BUILTIN_SERVICES = [
    {
        "service_id": "diabetes-management",
        "hook_type": "patient-view",
        "title": "Diabetes Management",
        "description": "Provides diabetes management recommendations including A1C monitoring, medication optimization, and annual screening reminders",
        "python_class": "api.cds_hooks.cds_services_fhir.DiabetesManagementService",
        "publisher": "WintEHR Educational Platform",
        "prefetch": {
            "patient": "Patient/{{context.patientId}}",
            "conditions": "Condition?patient={{context.patientId}}&clinical-status=active",
            "medications": "MedicationRequest?patient={{context.patientId}}&status=active",
            "observations": "Observation?patient={{context.patientId}}&code=http://loinc.org|4548-4&_sort=-date&_count=10"
        },
        "usage_requirements": "Requires access to patient demographics, active conditions, medications, and A1C lab results"
    },
    {
        "service_id": "allergy-check",
        "hook_type": "medication-prescribe",
        "title": "Allergy Checking Service",
        "description": "Checks for documented allergies when medications are prescribed to prevent adverse reactions",
        "python_class": "api.cds_hooks.cds_services_fhir.AllergyCheckService",
        "publisher": "WintEHR Educational Platform",
        "prefetch": {
            "patient": "Patient/{{context.patientId}}",
            "allergies": "AllergyIntolerance?patient={{context.patientId}}&clinical-status=active"
        },
        "usage_requirements": "Requires access to patient allergies and intolerances"
    },
    {
        "service_id": "drug-interaction",
        "hook_type": "medication-prescribe",
        "title": "Drug Interaction Checker",
        "description": "Identifies potential drug-drug interactions when new medications are prescribed against current active medications",
        "python_class": "api.cds_hooks.cds_services_fhir.DrugInteractionService",
        "publisher": "WintEHR Educational Platform",
        "prefetch": {
            "patient": "Patient/{{context.patientId}}",
            "medications": "MedicationRequest?patient={{context.patientId}}&status=active"
        },
        "usage_requirements": "Requires access to patient's current active medications"
    }
]


class BuiltinServiceMigrator:
    """Migrates built-in CDS services to HAPI FHIR PlanDefinitions"""

    def __init__(self):
        self.hapi_client = HAPIFHIRClient()
        self.migrated_count = 0
        self.failed_count = 0
        self.errors = []

    def create_plan_definition(self, service: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create PlanDefinition resource from service definition

        Args:
            service: Service definition dictionary

        Returns:
            PlanDefinition resource
        """
        plan_def = {
            "resourceType": "PlanDefinition",
            "id": service["service_id"],
            "url": f"http://wintehr.local/PlanDefinition/{service['service_id']}",
            "identifier": [
                {
                    "system": "http://wintehr.local/cds-services",
                    "value": service["service_id"]
                }
            ],
            "version": "1.0.0",
            "name": service["service_id"].replace("-", "_").title(),
            "title": service["title"],
            "type": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/plan-definition-type",
                        "code": "eca-rule",
                        "display": "ECA Rule"
                    }
                ]
            },
            "status": "active",
            "experimental": True,
            "date": datetime.utcnow().isoformat(),
            "publisher": service.get("publisher", "WintEHR Educational Platform"),
            "description": service["description"],
            "purpose": f"Educational CDS Hooks service for {service['hook_type']}",
            "usage": service.get("usage_requirements", ""),

            # WintEHR-specific extensions for service execution
            "extension": [
                {
                    "url": "http://wintehr.local/fhir/StructureDefinition/service-origin",
                    "valueCode": "built-in"
                },
                {
                    "url": "http://wintehr.local/fhir/StructureDefinition/python-class",
                    "valueString": service["python_class"]
                },
                {
                    "url": "http://wintehr.local/fhir/StructureDefinition/hook-type",
                    "valueCode": service["hook_type"]
                },
                {
                    "url": "http://wintehr.local/fhir/StructureDefinition/cds-hooks-version",
                    "valueString": "1.0"
                }
            ],

            # Action representing the CDS Hook
            "action": [
                {
                    "title": service["hook_type"],
                    "description": f"Execute {service['title']} for {service['hook_type']} hook",
                    "type": {
                        "coding": [
                            {
                                "system": "http://terminology.hl7.org/CodeSystem/action-type",
                                "code": "fire-event",
                                "display": "Fire Event"
                            }
                        ]
                    },
                    "trigger": [
                        {
                            "type": "named-event",
                            "name": service["hook_type"]
                        }
                    ]
                }
            ]
        }

        # Add prefetch template as contained Library resource if provided
        if service.get("prefetch"):
            import json
            import base64

            prefetch_json = json.dumps(service["prefetch"])
            prefetch_base64 = base64.b64encode(prefetch_json.encode()).decode()

            plan_def["contained"] = [
                {
                    "resourceType": "Library",
                    "id": "prefetch-template",
                    "status": "active",
                    "type": {
                        "coding": [
                            {
                                "system": "http://terminology.hl7.org/CodeSystem/library-type",
                                "code": "logic-library"
                            }
                        ]
                    },
                    "content": [
                        {
                            "contentType": "application/json",
                            "data": prefetch_base64,
                            "title": "CDS Hooks Prefetch Template"
                        }
                    ]
                }
            ]

            # Reference contained library in action
            plan_def["action"][0]["definitionCanonical"] = "#prefetch-template"

        return plan_def

    async def migrate_service(self, service: Dict[str, Any]) -> bool:
        """
        Migrate a single service to HAPI FHIR

        Args:
            service: Service definition

        Returns:
            True if successful, False otherwise
        """
        try:
            logger.info(f"Migrating service: {service['service_id']}")

            # Check if PlanDefinition already exists
            try:
                existing = await self.hapi_client.read("PlanDefinition", service["service_id"])
                logger.info(f"  PlanDefinition already exists, updating...")

                # Create updated PlanDefinition
                plan_def = self.create_plan_definition(service)

                # Update via PUT
                await self.hapi_client.update("PlanDefinition", service["service_id"], plan_def)
                logger.info(f"  ✅ Updated successfully")

            except Exception:
                # Doesn't exist, create new
                logger.info(f"  Creating new PlanDefinition...")

                # Create PlanDefinition
                plan_def = self.create_plan_definition(service)

                # POST to HAPI FHIR
                result = await self.hapi_client.create("PlanDefinition", plan_def)
                logger.info(f"  ✅ Created successfully: {result.get('id')}")

            self.migrated_count += 1
            return True

        except Exception as e:
            error_msg = f"Failed to migrate {service['service_id']}: {str(e)}"
            logger.error(f"  ❌ {error_msg}")
            self.errors.append(error_msg)
            self.failed_count += 1
            return False

    async def verify_migration(self, service_id: str) -> bool:
        """
        Verify a migrated service exists in HAPI FHIR

        Args:
            service_id: Service identifier

        Returns:
            True if exists and valid, False otherwise
        """
        try:
            plan_def = await self.hapi_client.read("PlanDefinition", service_id)

            # Verify required fields
            if not plan_def.get("id") == service_id:
                logger.error(f"  Verification failed: ID mismatch")
                return False

            if not plan_def.get("status") == "active":
                logger.error(f"  Verification failed: Status not active")
                return False

            # Verify extensions exist
            extensions = plan_def.get("extension", [])
            required_extensions = [
                "service-origin",
                "python-class",
                "hook-type"
            ]

            found_extensions = set()
            for ext in extensions:
                url = ext.get("url", "")
                for req_ext in required_extensions:
                    if req_ext in url:
                        found_extensions.add(req_ext)

            if len(found_extensions) < len(required_extensions):
                missing = set(required_extensions) - found_extensions
                logger.error(f"  Verification failed: Missing extensions: {missing}")
                return False

            logger.info(f"  ✅ Verification successful")
            return True

        except Exception as e:
            logger.error(f"  ❌ Verification failed: {str(e)}")
            return False

    async def migrate_all(self):
        """Migrate all built-in services to HAPI FHIR"""
        logger.info("=" * 80)
        logger.info("WintEHR Built-in CDS Services Migration")
        logger.info("=" * 80)
        logger.info(f"Migrating {len(BUILTIN_SERVICES)} built-in services to HAPI FHIR")
        logger.info("")

        # Migrate each service
        for service in BUILTIN_SERVICES:
            await self.migrate_service(service)
            logger.info("")

        # Verify all migrations
        logger.info("=" * 80)
        logger.info("Verification Phase")
        logger.info("=" * 80)

        verified_count = 0
        for service in BUILTIN_SERVICES:
            logger.info(f"Verifying: {service['service_id']}")
            if await self.verify_migration(service["service_id"]):
                verified_count += 1
            logger.info("")

        # Print summary
        logger.info("=" * 80)
        logger.info("Migration Summary")
        logger.info("=" * 80)
        logger.info(f"Total services: {len(BUILTIN_SERVICES)}")
        logger.info(f"Successfully migrated: {self.migrated_count}")
        logger.info(f"Failed migrations: {self.failed_count}")
        logger.info(f"Verified: {verified_count}")
        logger.info("")

        if self.errors:
            logger.error("Errors encountered:")
            for error in self.errors:
                logger.error(f"  - {error}")
            logger.info("")

        if verified_count == len(BUILTIN_SERVICES):
            logger.info("✅ All services successfully migrated and verified!")
        else:
            logger.warning(f"⚠️  Only {verified_count}/{len(BUILTIN_SERVICES)} services verified")

        logger.info("=" * 80)

        return self.migrated_count, self.failed_count


async def main():
    """Main migration function"""
    try:
        migrator = BuiltinServiceMigrator()
        migrated, failed = await migrator.migrate_all()

        # Exit with error code if any failed
        if failed > 0:
            sys.exit(1)

    except Exception as e:
        logger.error(f"Fatal error during migration: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
