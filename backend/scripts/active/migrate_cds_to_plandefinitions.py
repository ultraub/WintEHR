#!/usr/bin/env python3
"""
Migrate CDS Hooks Services to HAPI FHIR PlanDefinitions

This script migrates existing CDS Hooks services to PlanDefinition resources in HAPI FHIR.

Purpose:
- Convert legacy CDS services to FHIR-native PlanDefinitions
- Enable CDS services to be managed through HAPI FHIR's Clinical Reasoning module
- Maintain backward compatibility during migration

Usage:
    python migrate_cds_to_plandefinitions.py [--dry-run] [--service-id SERVICE_ID]

Options:
    --dry-run: Show what would be migrated without making changes
    --service-id: Migrate only a specific service (by ID or hook ID)
    --force: Force re-migration even if PlanDefinition already exists
"""

import asyncio
import argparse
import logging
import sys
import os
from typing import List, Dict, Any, Optional
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

import httpx
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from database import get_db_session
from services.hapi_fhir_client import HAPIFHIRClient
# v3.0 Architecture imports
from api.cds_hooks.registry import get_registry, ServiceRegistry
from api.cds_hooks.services import register_builtin_services

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class CDSToPlanDefinitionMigrator:
    """Migrate CDS Hooks services to HAPI FHIR PlanDefinitions"""

    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.hapi_client = HAPIFHIRClient()
        # v3.0: Use get_registry() to get singleton registry
        self.service_registry = get_registry()
        # Register builtin services
        register_builtin_services(self.service_registry)
        self.migrated_count = 0
        self.skipped_count = 0
        self.error_count = 0

    async def migrate_all_services(self) -> Dict[str, Any]:
        """
        Migrate all registered CDS Hooks services to PlanDefinitions

        Returns:
            Summary dict with migration results
        """
        logger.info("Starting CDS Hooks to PlanDefinition migration")

        if self.dry_run:
            logger.info("DRY RUN MODE - No changes will be made")

        # Get all registered CDS services (v3.0: use list_services())
        services = self.service_registry.list_services()

        if not services:
            logger.info("No CDS services found to migrate")
            return self._build_summary()

        logger.info(f"Found {len(services)} CDS services to migrate")

        # Migrate each service (v3.0: services are CDSService instances)
        for service in services:
            try:
                await self._migrate_service(service)
            except Exception as e:
                logger.error(f"Error migrating service {service.service_id}: {e}")
                self.error_count += 1

        # Return summary
        summary = self._build_summary()
        self._print_summary(summary)
        return summary

    async def migrate_service(self, service_id: str, force: bool = False) -> bool:
        """
        Migrate a specific CDS service to PlanDefinition

        Args:
            service_id: Service ID or hook service ID
            force: Force re-migration even if exists

        Returns:
            True if migration successful
        """
        # Find service (v3.0: use get_service())
        service = self.service_registry.get_service(service_id)
        if not service:
            # Try finding by service_id in list
            for svc in self.service_registry.list_services():
                if svc.service_id == service_id:
                    service = svc
                    break

        if not service:
            logger.error(f"Service not found: {service_id}")
            return False

        try:
            return await self._migrate_service(service, force=force)
        except Exception as e:
            logger.error(f"Error migrating service {service_id}: {e}")
            self.error_count += 1
            return False

    async def _migrate_service(
        self,
        service: Any,
        force: bool = False
    ) -> bool:
        """
        Migrate a single CDS service to PlanDefinition (v3.0 CDSService)

        Args:
            service: CDSService instance from registry
            force: Force re-migration

        Returns:
            True if migrated successfully
        """
        # v3.0: Use service_id attribute
        service_id = service.service_id
        logger.info(f"Migrating service: {service_id} - {service.title}")

        # Check if already migrated (has FHIR resource ID)
        if hasattr(service, 'fhir_resource_id') and service.fhir_resource_id and not force:
            logger.info(f"Service {service_id} already has PlanDefinition: {service.fhir_resource_id}")
            self.skipped_count += 1
            return False

        # Build PlanDefinition resource (v3.0: pass CDSService)
        plan_definition = self._build_plan_definition(service)

        if self.dry_run:
            logger.info(f"DRY RUN: Would create PlanDefinition for {service_id}")
            logger.debug(f"PlanDefinition: {plan_definition}")
            self.migrated_count += 1
            return True

        try:
            # Create PlanDefinition in HAPI FHIR
            created = await self.hapi_client.create("PlanDefinition", plan_definition)
            fhir_resource_id = created.get("id")

            logger.info(f"✓ Created PlanDefinition/{fhir_resource_id} for service {service_id}")

            # Update service registry with FHIR resource ID
            await self._update_service_fhir_id(service_id, fhir_resource_id)

            self.migrated_count += 1
            return True

        except Exception as e:
            logger.error(f"Failed to create PlanDefinition for {service_id}: {e}")
            self.error_count += 1
            return False

    def _build_plan_definition(self, service: Any) -> Dict[str, Any]:
        """
        Build PlanDefinition resource from CDS service (v3.0 CDSService)

        Args:
            service: CDSService instance from registry

        Returns:
            PlanDefinition resource dict
        """
        # Extract service metadata (v3.0 attribute names)
        service_id = service.service_id
        hook_type = service.hook_type.value if hasattr(service.hook_type, 'value') else str(service.hook_type)
        title = getattr(service, 'title', service_id)
        description = getattr(service, 'description', '')
        prefetch = getattr(service, 'prefetch_templates', {}) or {}

        # Build PlanDefinition
        plan_definition = {
            "resourceType": "PlanDefinition",
            "url": f"http://wintehr.com/fhir/PlanDefinition/{service_id}",
            "version": "1.0.0",
            "name": service_id.replace('-', '_'),
            "title": title,
            "type": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/plan-definition-type",
                    "code": "eca-rule",
                    "display": "Event-Condition-Action (ECA) Rule"
                }]
            },
            "status": "active",
            "experimental": False,
            "date": datetime.utcnow().isoformat(),
            "publisher": "WintEHR",
            "description": description or f"CDS Hooks service for {hook_type}",
            "purpose": f"Clinical decision support for {hook_type} workflow",
            "usage": getattr(service, 'usageRequirements', ''),

            # Extensions for CDS Hooks metadata
            "extension": [
                {
                    "url": "http://wintehr.com/fhir/StructureDefinition/cds-hooks-service-id",
                    "valueString": service_id
                },
                {
                    "url": "http://wintehr.com/fhir/StructureDefinition/cds-hooks-hook-type",
                    "valueString": hook_type
                }
            ],

            # Action triggered by hook event
            "action": [{
                "title": f"Execute {title}",
                "description": f"Invoke CDS service for {hook_type}",
                "trigger": [{
                    "type": "named-event",
                    "name": hook_type,
                    "data": prefetch
                }],
                "condition": [{
                    "kind": "applicability",
                    "expression": {
                        "language": "text/cql",
                        "expression": "true"  # Always applicable for now
                    }
                }]
            }]
        }

        # Add prefetch as data requirements if present
        if prefetch:
            plan_definition["action"][0]["input"] = [
                {
                    "type": "DataRequirement",
                    "profile": [f"http://hl7.org/fhir/StructureDefinition/{resource_type}"],
                    "codeFilter": []
                }
                for key, query in prefetch.items()
                if (resource_type := self._extract_resource_type_from_query(query))
            ]

        return plan_definition

    def _extract_resource_type_from_query(self, query: str) -> Optional[str]:
        """
        Extract FHIR resource type from prefetch query string

        Args:
            query: FHIR query string (e.g., "Patient/{{context.patientId}}")

        Returns:
            Resource type or None
        """
        if not query:
            return None

        # Simple extraction - get first path segment
        parts = query.strip('/').split('/')
        if parts:
            resource_type = parts[0].split('?')[0]
            # Basic validation
            if resource_type and resource_type[0].isupper():
                return resource_type

        return None

    async def _update_service_fhir_id(self, service_id: str, fhir_resource_id: str):
        """
        Update service registry with FHIR resource ID

        Args:
            service_id: Service ID
            fhir_resource_id: Created PlanDefinition ID
        """
        # This would update the external_services table if using that system
        # For now, just log it
        logger.info(f"Would update service {service_id} with FHIR resource ID: {fhir_resource_id}")

        # TODO: If using external_services table, update it here:
        # await self.db.execute(
        #     update(external_services.services)
        #     .where(external_services.services.c.id == service_id)
        #     .values(fhir_resource_id=fhir_resource_id, fhir_resource_type='PlanDefinition')
        # )

    def _build_summary(self) -> Dict[str, Any]:
        """Build migration summary"""
        return {
            "migrated": self.migrated_count,
            "skipped": self.skipped_count,
            "errors": self.error_count,
            "total": self.migrated_count + self.skipped_count + self.error_count,
            "dry_run": self.dry_run,
            "timestamp": datetime.utcnow().isoformat()
        }

    def _print_summary(self, summary: Dict[str, Any]):
        """Print migration summary to console"""
        logger.info("=" * 60)
        logger.info("Migration Summary")
        logger.info("=" * 60)
        logger.info(f"Total services: {summary['total']}")
        logger.info(f"Migrated: {summary['migrated']}")
        logger.info(f"Skipped: {summary['skipped']}")
        logger.info(f"Errors: {summary['error_count']}")
        logger.info(f"Dry run: {summary['dry_run']}")
        logger.info("=" * 60)


async def main():
    """Main migration script"""
    parser = argparse.ArgumentParser(
        description="Migrate CDS Hooks services to HAPI FHIR PlanDefinitions"
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be migrated without making changes'
    )
    parser.add_argument(
        '--service-id',
        type=str,
        help='Migrate only a specific service (by ID or hook ID)'
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Force re-migration even if PlanDefinition already exists'
    )

    args = parser.parse_args()

    # Create migrator
    migrator = CDSToPlanDefinitionMigrator(dry_run=args.dry_run)

    try:
        # Migrate services
        if args.service_id:
            logger.info(f"Migrating service: {args.service_id}")
            success = await migrator.migrate_service(args.service_id, force=args.force)
            if success:
                logger.info(f"✓ Successfully migrated service {args.service_id}")
            else:
                logger.error(f"✗ Failed to migrate service {args.service_id}")
                sys.exit(1)
        else:
            # Migrate all services
            summary = await migrator.migrate_all_services()
            if summary['errors'] > 0:
                logger.warning(f"Migration completed with {summary['errors']} errors")
                sys.exit(1)
            else:
                logger.info("✓ Migration completed successfully")

    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
