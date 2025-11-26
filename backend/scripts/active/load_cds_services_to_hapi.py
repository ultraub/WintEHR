"""
Load CDS Services as FHIR PlanDefinition Resources to HAPI FHIR (v3.0 Architecture)

This script converts registered CDS Hooks services to FHIR PlanDefinition resources
and posts them to HAPI FHIR. This makes them visible in the CDS Studio UI.

Educational purpose: Demonstrates bridging CDS Hooks services with FHIR-based service registry.

Updated for v3.0 Architecture:
- Uses CDSService base class pattern
- Uses ServiceRegistry from registry module
- Uses get_builtin_services from services module
"""

import asyncio
import httpx
import logging
import sys
from pathlib import Path
from datetime import datetime

# Add parent directories to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# v3.0 Architecture imports
from api.cds_hooks.registry import get_registry, ServiceRegistry
from api.cds_hooks.services import get_builtin_services, register_builtin_services

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

HAPI_FHIR_URL = "http://hapi-fhir:8080/fhir"


def service_to_plandefinition(service) -> dict:
    """
    Convert a v3.0 CDSService to a FHIR PlanDefinition resource.

    Educational notes:
    - PlanDefinition is the FHIR resource for clinical protocols/guidelines
    - Maps CDS Hooks metadata to FHIR structure
    - Stores prefetch templates as extensions
    """
    hook_value = service.hook_type.value

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
        "id": service.service_id,
        "meta": {
            "profile": ["http://hl7.org/fhir/StructureDefinition/PlanDefinition"],
            "tag": [{
                "system": "http://wintehr.org/cds-studio",
                "code": "cds-hook-service",
                "display": "CDS Hook Service"
            }]
        },
        "url": f"http://wintehr.org/PlanDefinition/{service.service_id}",
        "identifier": [{
            "system": "http://wintehr.org/cds-services",
            "value": service.service_id
        }],
        "version": "1.0.0",
        "name": service.service_id.replace("-", "_"),
        "title": service.title or service.service_id,
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
        "description": service.description,
        "purpose": "Clinical decision support via CDS Hooks integration",
        "usage": service.usageRequirements or "Triggered by clinical workflow hooks"
    }

    # Add hook type as topic
    topic_code = hook_type_mapping.get(hook_value, "other")
    plan_def["topic"] = [{
        "coding": [{
            "system": "http://terminology.hl7.org/CodeSystem/definition-topic",
            "code": topic_code,
            "display": topic_code.title()
        }],
        "text": f"CDS Hook: {hook_value}"
    }]

    # Store CDS Hooks metadata as extensions
    plan_def["extension"] = [
        {
            "url": "http://wintehr.org/fhir/StructureDefinition/cds-hook-type",
            "valueString": hook_value
        },
        {
            "url": "http://wintehr.org/fhir/StructureDefinition/cds-service-id",
            "valueString": service.service_id
        }
    ]

    # Store prefetch templates
    if service.prefetch_templates:
        plan_def["extension"].append({
            "url": "http://wintehr.org/fhir/StructureDefinition/cds-prefetch-templates",
            "valueString": str(service.prefetch_templates)
        })

    # Add action to represent the service execution
    plan_def["action"] = [{
        "id": "execute-cds-service",
        "title": f"Execute {service.title or service.service_id}",
        "description": service.description,
        "type": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/action-type",
                "code": "fire-event",
                "display": "Fire Event"
            }]
        },
        "trigger": [{
            "type": "named-event",
            "name": hook_value
        }]
    }]

    return plan_def


async def load_services_to_hapi():
    """Load all registered CDS services to HAPI FHIR as PlanDefinitions (v3.0)"""

    # Register all built-in services using v3.0 architecture
    logger.info("Registering CDS services (v3.0 Architecture)...")
    registry = get_registry()
    register_builtin_services(registry)

    # Get all registered services
    services = registry.list_services()
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
                # Convert to PlanDefinition (v3.0 uses CDSService directly)
                plan_def = service_to_plandefinition(service)

                logger.info(f"Loading service: {service.service_id} ({service.title})")

                # Post to HAPI FHIR
                url = f"{HAPI_FHIR_URL}/PlanDefinition/{plan_def['id']}"
                response = await client.put(
                    url,
                    json=plan_def,
                    headers={"Content-Type": "application/fhir+json"}
                )

                if response.status_code in [200, 201]:
                    logger.info(f"✓ Successfully loaded: {service.service_id}")
                    loaded_count += 1
                else:
                    logger.error(f"✗ Failed to load {service.service_id}: {response.status_code} - {response.text[:200]}")
                    failed_count += 1

            except Exception as e:
                logger.error(f"✗ Error loading service {service.service_id}: {e}")
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
    logger.info("Starting CDS Services to HAPI FHIR loader (v3.0 Architecture)...")
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
