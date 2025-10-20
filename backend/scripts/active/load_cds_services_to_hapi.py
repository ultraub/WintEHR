"""
Load CDS Services as FHIR PlanDefinition Resources to HAPI FHIR

This script converts registered CDS Hooks services to FHIR PlanDefinition resources
and posts them to HAPI FHIR. This makes them visible in the CDS Studio UI.

Educational purpose: Demonstrates bridging CDS Hooks services with FHIR-based service registry.
"""

import asyncio
import httpx
import logging
import sys
from pathlib import Path
from datetime import datetime

# Add parent directories to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from api.cds_hooks.service_registry import service_registry, register_builtin_services
from api.cds_hooks.service_implementations import register_example_services

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

HAPI_FHIR_URL = "http://hapi-fhir:8080/fhir"


def service_to_plandefinition(service_def) -> dict:
    """
    Convert a CDS service definition to a FHIR PlanDefinition resource.

    Educational notes:
    - PlanDefinition is the FHIR resource for clinical protocols/guidelines
    - Maps CDS Hooks metadata to FHIR structure
    - Stores prefetch templates as extensions
    """

    # Map hook type to FHIR jurisdiction/topic codes
    hook_type_mapping = {
        "patient-view": "encounter",
        "medication-prescribe": "medication",
        "order-select": "order",
        "order-sign": "order",
        "encounter-start": "encounter",
        "encounter-discharge": "encounter"
    }

    plan_def = {
        "resourceType": "PlanDefinition",
        "id": service_def.id,
        "meta": {
            "profile": ["http://hl7.org/fhir/StructureDefinition/PlanDefinition"],
            "tag": [{
                "system": "http://wintehr.org/cds-studio",
                "code": "cds-hook-service",
                "display": "CDS Hook Service"
            }]
        },
        "url": f"http://wintehr.org/PlanDefinition/{service_def.id}",
        "identifier": [{
            "system": "http://wintehr.org/cds-services",
            "value": service_def.id
        }],
        "version": "1.0.0",
        "name": service_def.id.replace("-", "_"),
        "title": service_def.title or service_def.id,
        "type": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/plan-definition-type",
                "code": "eca-rule",
                "display": "ECA Rule"
            }]
        },
        "status": "active",
        "experimental": True,
        "date": datetime.utcnow().isoformat() + "Z",
        "publisher": "WintEHR Educational Platform",
        "description": service_def.description,
        "purpose": "Clinical decision support via CDS Hooks integration",
        "usage": service_def.usageRequirements or "Triggered by clinical workflow hooks"
    }

    # Add hook type as topic
    topic_code = hook_type_mapping.get(service_def.hook, "other")
    plan_def["topic"] = [{
        "coding": [{
            "system": "http://terminology.hl7.org/CodeSystem/definition-topic",
            "code": topic_code,
            "display": topic_code.title()
        }],
        "text": f"CDS Hook: {service_def.hook}"
    }]

    # Store CDS Hooks metadata as extensions
    plan_def["extension"] = [
        {
            "url": "http://wintehr.org/fhir/StructureDefinition/cds-hook-type",
            "valueString": service_def.hook
        },
        {
            "url": "http://wintehr.org/fhir/StructureDefinition/cds-service-id",
            "valueString": service_def.id
        }
    ]

    # Store prefetch templates
    if service_def.prefetch:
        plan_def["extension"].append({
            "url": "http://wintehr.org/fhir/StructureDefinition/cds-prefetch-templates",
            "valueString": str(service_def.prefetch)
        })

    # Add action to represent the service execution
    plan_def["action"] = [{
        "id": "execute-cds-service",
        "title": f"Execute {service_def.title or service_def.id}",
        "description": service_def.description,
        "type": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/action-type",
                "code": "fire-event",
                "display": "Fire Event"
            }]
        },
        "trigger": [{
            "type": "named-event",
            "name": service_def.hook
        }]
    }]

    return plan_def


async def load_services_to_hapi():
    """Load all registered CDS services to HAPI FHIR as PlanDefinitions"""

    # Register all built-in and example services
    logger.info("Registering CDS services...")
    register_builtin_services()
    register_example_services(service_registry)

    # Get all registered services
    services = service_registry.list_services()
    logger.info(f"Found {len(services)} registered CDS services")

    if not services:
        logger.warning("No CDS services found to load!")
        return

    # Create HTTP client
    async with httpx.AsyncClient(timeout=30.0) as client:

        # Load each service to HAPI FHIR
        loaded_count = 0
        failed_count = 0

        for service in services:
            try:
                # Find service definition
                service_def = service_registry.get_service_definition(service.id)
                if not service_def:
                    logger.warning(f"No definition found for service: {service.id}")
                    continue

                # Convert to PlanDefinition
                plan_def = service_to_plandefinition(service_def)

                logger.info(f"Loading service: {service.id} ({service.title})")

                # Post to HAPI FHIR
                url = f"{HAPI_FHIR_URL}/PlanDefinition/{plan_def['id']}"
                response = await client.put(
                    url,
                    json=plan_def,
                    headers={"Content-Type": "application/fhir+json"}
                )

                if response.status_code in [200, 201]:
                    logger.info(f"✓ Successfully loaded: {service.id}")
                    loaded_count += 1
                else:
                    logger.error(f"✗ Failed to load {service.id}: {response.status_code} - {response.text[:200]}")
                    failed_count += 1

            except Exception as e:
                logger.error(f"✗ Error loading service {service.id}: {e}")
                failed_count += 1

        # Summary
        logger.info("\n" + "="*60)
        logger.info(f"CDS Services Loading Summary:")
        logger.info(f"  Total services: {len(services)}")
        logger.info(f"  Successfully loaded: {loaded_count}")
        logger.info(f"  Failed: {failed_count}")
        logger.info("="*60)

        # Verify count in HAPI FHIR
        try:
            count_response = await client.get(f"{HAPI_FHIR_URL}/PlanDefinition?_summary=count")
            if count_response.status_code == 200:
                bundle = count_response.json()
                total = bundle.get("total", 0)
                logger.info(f"\nTotal PlanDefinitions in HAPI FHIR: {total}")
        except Exception as e:
            logger.error(f"Could not verify PlanDefinition count: {e}")


async def main():
    """Main entry point"""
    logger.info("Starting CDS Services to HAPI FHIR loader...")
    logger.info(f"Target HAPI FHIR server: {HAPI_FHIR_URL}")

    try:
        await load_services_to_hapi()
        logger.info("\n✓ CDS services loading complete!")
        return 0
    except Exception as e:
        logger.error(f"\n✗ Error loading CDS services: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
