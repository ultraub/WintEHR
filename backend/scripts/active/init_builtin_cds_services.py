#!/usr/bin/env python3
"""
Initialize Built-in CDS Services in HAPI FHIR

Migrates built-in CDS Hooks services from in-memory ServiceRegistry to HAPI FHIR
as PlanDefinition resources, making them manageable via CDS Studio UI.

Purpose:
- Populate CDS Studio with default clinical decision support services
- Convert ServiceRegistry entries to PlanDefinition FHIR resources
- Enable version management and UI configuration of built-in services

Usage:
    python scripts/active/init_builtin_cds_services.py [--force] [--dry-run]

Options:
    --force: Recreate all services even if they already exist
    --dry-run: Show what would be created without making changes
"""

import asyncio
import argparse
import logging
import sys
import os
from typing import List, Dict, Any
from datetime import datetime
import uuid

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

import httpx
from services.hapi_fhir_client import HAPIFHIRClient

# v3.0 Architecture imports
from api.cds_hooks.registry import get_registry, ServiceRegistry
from api.cds_hooks.services import get_builtin_services, register_builtin_services

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class BuiltinCDSServiceInitializer:
    """Initialize built-in CDS services in HAPI FHIR"""

    def __init__(self, dry_run: bool = False, force: bool = False):
        self.dry_run = dry_run
        self.force = force
        self.hapi_client = HAPIFHIRClient()
        self.created_count = 0
        self.skipped_count = 0
        self.updated_count = 0
        self.error_count = 0

    async def initialize_all_services(self) -> Dict[str, Any]:
        """
        Initialize all built-in CDS services in HAPI FHIR

        Returns:
            Summary dict with initialization results
        """
        logger.info("=" * 80)
        logger.info("Initializing Built-in CDS Services in HAPI FHIR")
        logger.info("=" * 80)

        if self.dry_run:
            logger.info("🔍 DRY RUN MODE - No changes will be made")

        # Register all built-in services using v3.0 Architecture
        logger.info("📋 Loading built-in services from ServiceRegistry (v3.0)...")
        registry = get_registry()
        register_builtin_services(registry)

        # Get all registered services from the v3.0 registry
        services = registry.list_services()

        if not services:
            logger.warning("⚠️  No services found in ServiceRegistry")
            return self._build_summary()

        logger.info(f"✓ Found {len(services)} services in ServiceRegistry")
        logger.info("")

        # Convert and create each service (v3.0 uses CDSService instances)
        for service in services:
            try:
                await self._create_or_update_service(service)
            except Exception as e:
                logger.error(f"❌ Error processing service {service.service_id}: {e}")
                self.error_count += 1

        # Return summary
        logger.info("")
        summary = self._build_summary()
        self._print_summary(summary)
        return summary

    async def _create_or_update_service(self, service):
        """Create or update a single service in HAPI FHIR (v3.0 CDSService)"""
        service_id = service.service_id

        logger.info(f"Processing: {service_id}")
        logger.info(f"  Title: {service.title}")
        logger.info(f"  Hook: {service.hook_type.value}")

        # Check if PlanDefinition already exists
        try:
            existing = await self._find_existing_plandefinition(service_id)

            if existing and not self.force:
                logger.info(f"  ⏭️  Skipped - Already exists (use --force to recreate)")
                self.skipped_count += 1
                return

            if existing and self.force:
                logger.info(f"  🔄 Updating existing PlanDefinition")
                action = "update"
            else:
                logger.info(f"  ✨ Creating new PlanDefinition")
                action = "create"

        except Exception as e:
            logger.warning(f"  ⚠️  Error checking existing: {e}")
            action = "create"

        # Convert to PlanDefinition (v3.0 CDSService to FHIR PlanDefinition)
        plan_definition = self._convert_to_plandefinition(service)

        # Create/Update in HAPI FHIR
        if not self.dry_run:
            try:
                if action == "create":
                    result = await self.hapi_client.create("PlanDefinition", plan_definition)
                    self.created_count += 1
                    logger.info(f"  ✅ Created: PlanDefinition/{result['id']}")
                else:
                    result = await self.hapi_client.update("PlanDefinition", existing['id'], plan_definition)
                    self.updated_count += 1
                    logger.info(f"  ✅ Updated: PlanDefinition/{result['id']}")

            except Exception as e:
                logger.error(f"  ❌ Failed to {action}: {e}")
                self.error_count += 1
        else:
            logger.info(f"  [DRY RUN] Would {action} PlanDefinition")
            if action == "create":
                self.created_count += 1
            else:
                self.updated_count += 1

        logger.info("")

    async def _find_existing_plandefinition(self, service_id: str) -> Dict[str, Any]:
        """Find existing PlanDefinition by service ID"""
        try:
            # Search for PlanDefinition with this service ID in identifier
            bundle = await self.hapi_client.search("PlanDefinition", {
                "identifier": f"http://wintehr.org/cds-service|{service_id}",
                "_count": 1
            })

            entries = bundle.get("entry", [])
            if entries:
                return entries[0]["resource"]

            return None

        except Exception as e:
            logger.debug(f"Error searching for existing PlanDefinition: {e}")
            return None

    def _convert_to_plandefinition(self, service) -> Dict[str, Any]:
        """
        Convert v3.0 CDSService to FHIR PlanDefinition

        Maps CDS Hooks concepts to PlanDefinition:
        - service.service_id → identifier
        - service.hook_type → action.trigger
        - service.title → title
        - service.description → description
        - service.prefetch_templates → action.input (data requirements)
        """
        hook_value = service.hook_type.value

        plan_definition = {
            "resourceType": "PlanDefinition",
            "identifier": [{
                "system": "http://wintehr.org/cds-service",
                "value": service.service_id
            }],
            "name": self._to_camel_case(service.service_id),
            "title": service.title or service.service_id,
            "type": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/plan-definition-type",
                    "code": "clinical-protocol",
                    "display": "Clinical Protocol"
                }]
            },
            "status": "active",
            "date": datetime.utcnow().isoformat(),
            "publisher": "WintEHR Educational Platform",
            "description": service.description,
            "purpose": f"CDS Hooks service for {hook_value} hook",
            "usage": service.usageRequirements or f"Triggered by {hook_value} hook",

            # CDS Hooks specific extensions
            "extension": [
                {
                    "url": "http://wintehr.org/fhir/StructureDefinition/cds-hooks-service",
                    "extension": [
                        {
                            "url": "hook",
                            "valueString": hook_value
                        },
                        {
                            "url": "serviceId",
                            "valueString": service.service_id
                        },
                        {
                            "url": "origin",
                            "valueString": "built-in"
                        }
                    ]
                }
            ],

            # Define the clinical action
            "action": [{
                "title": service.title or service.service_id,
                "description": service.description,

                # Hook trigger
                "trigger": [{
                    "type": "named-event",
                    "name": hook_value
                }],

                # Prefetch as input data requirements
                "input": self._convert_prefetch_to_inputs(service.prefetch_templates) if service.prefetch_templates else []
            }]
        }

        return plan_definition

    def _convert_prefetch_to_inputs(self, prefetch: Dict[str, str]) -> List[Dict[str, Any]]:
        """Convert CDS Hooks prefetch templates to FHIR DataRequirement inputs"""
        inputs = []

        for key, query_template in prefetch.items():
            # Parse FHIR query to extract resource type
            resource_type = query_template.split("/")[0].split("?")[0]

            input_def = {
                "type": "DataRequirement",
                "profile": [f"http://hl7.org/fhir/StructureDefinition/{resource_type}"],
                "extension": [{
                    "url": "http://wintehr.org/fhir/StructureDefinition/prefetch-key",
                    "valueString": key
                }, {
                    "url": "http://wintehr.org/fhir/StructureDefinition/prefetch-query",
                    "valueString": query_template
                }]
            }

            inputs.append(input_def)

        return inputs

    def _to_camel_case(self, text: str) -> str:
        """Convert kebab-case to CamelCase"""
        parts = text.replace("-", " ").replace("_", " ").split()
        return "".join(word.capitalize() for word in parts)

    def _build_summary(self) -> Dict[str, Any]:
        """Build summary of initialization results"""
        return {
            "created": self.created_count,
            "updated": self.updated_count,
            "skipped": self.skipped_count,
            "errors": self.error_count,
            "total_processed": self.created_count + self.updated_count + self.skipped_count + self.error_count,
            "dry_run": self.dry_run
        }

    def _print_summary(self, summary: Dict[str, Any]):
        """Print initialization summary"""
        logger.info("=" * 80)
        logger.info("Initialization Summary")
        logger.info("=" * 80)
        logger.info(f"✨ Created:  {summary['created']}")
        logger.info(f"🔄 Updated:  {summary['updated']}")
        logger.info(f"⏭️  Skipped:  {summary['skipped']}")
        logger.info(f"❌ Errors:   {summary['errors']}")
        logger.info(f"📊 Total:    {summary['total_processed']}")

        if summary['dry_run']:
            logger.info("")
            logger.info("🔍 This was a DRY RUN - no changes were made")

        logger.info("=" * 80)


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Initialize built-in CDS services in HAPI FHIR"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Recreate services even if they already exist"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be created without making changes"
    )

    args = parser.parse_args()

    # Initialize services
    initializer = BuiltinCDSServiceInitializer(
        dry_run=args.dry_run,
        force=args.force
    )

    try:
        summary = await initializer.initialize_all_services()

        # Exit with error code if there were errors
        if summary['errors'] > 0:
            sys.exit(1)

    except KeyboardInterrupt:
        logger.info("\n\n⚠️  Interrupted by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"\n\n❌ Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
