#!/usr/bin/env python3
"""
Create Demo Practitioner Resources

Creates FHIR Practitioner resources for demo users (demo, nurse, pharmacist, admin)
in HAPI FHIR with consistent IDs and proper role assignments.

This script should be run during deployment to ensure demo users have valid
Practitioner references for all clinical operations.
"""

import asyncio
import sys
import os
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from services.hapi_fhir_client import HAPIFHIRClient


# Demo Practitioner configurations
DEMO_PRACTITIONERS = [
    {
        "id": "demo-physician",
        "identifier_value": "DEMO001",
        "name": {
            "family": "Physician",
            "given": ["Demo"],
            "prefix": ["Dr."]
        },
        "role": "physician",
        "specialty": "General Practice",
        "email": "demo@wintehr.example.com",
        "phone": "555-0001"
    },
    {
        "id": "demo-nurse",
        "identifier_value": "DEMO002",
        "name": {
            "family": "Nurse",
            "given": ["Demo"],
            "prefix": ["RN"]
        },
        "role": "nurse",
        "specialty": "Medical-Surgical Nursing",
        "email": "nurse@wintehr.example.com",
        "phone": "555-0002"
    },
    {
        "id": "demo-pharmacist",
        "identifier_value": "DEMO003",
        "name": {
            "family": "Pharmacist",
            "given": ["Demo"],
            "prefix": ["PharmD"]
        },
        "role": "pharmacist",
        "specialty": "Clinical Pharmacy",
        "email": "pharmacist@wintehr.example.com",
        "phone": "555-0003"
    },
    {
        "id": "demo-admin",
        "identifier_value": "DEMO004",
        "name": {
            "family": "Administrator",
            "given": ["Demo"],
            "prefix": ["Dr."]
        },
        "role": "admin",
        "specialty": "Hospital Administration",
        "email": "admin@wintehr.example.com",
        "phone": "555-0004"
    }
]


def create_practitioner_resource(config: dict) -> dict:
    """
    Create a FHIR Practitioner resource from configuration.

    Args:
        config: Practitioner configuration dict

    Returns:
        FHIR Practitioner resource
    """
    return {
        "resourceType": "Practitioner",
        "id": config["id"],
        "meta": {
            "profile": [
                "http://hl7.org/fhir/us/core/StructureDefinition/us-core-practitioner"
            ],
            "tag": [
                {
                    "system": "http://wintehr.org/fhir/tags",
                    "code": "demo-user",
                    "display": "Demo User"
                }
            ]
        },
        "identifier": [
            {
                "system": "http://wintehr.org/fhir/identifier/demo-user",
                "value": config["identifier_value"]
            },
            {
                "system": "http://wintehr.org/fhir/identifier/username",
                "value": config["id"].replace("demo-", "")
            }
        ],
        "active": True,
        "name": [
            {
                "use": "official",
                "family": config["name"]["family"],
                "given": config["name"]["given"],
                "prefix": config["name"]["prefix"]
            }
        ],
        "telecom": [
            {
                "system": "phone",
                "value": config["phone"],
                "use": "work"
            },
            {
                "system": "email",
                "value": config["email"],
                "use": "work"
            }
        ],
        "address": [
            {
                "use": "work",
                "line": ["123 Demo Street"],
                "city": "Demo City",
                "state": "MA",
                "postalCode": "01234",
                "country": "US"
            }
        ],
        "gender": "unknown",
        "qualification": [
            {
                "code": {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v2-0360",
                            "code": "MD" if config["role"] in ["physician", "admin"] else "RN",
                            "display": config["specialty"]
                        }
                    ],
                    "text": config["specialty"]
                }
            }
        ]
    }


async def create_demo_practitioners():
    """
    Create all demo Practitioner resources in HAPI FHIR.

    Returns:
        Dict with creation results
    """
    hapi_client = HAPIFHIRClient()
    results = {
        "created": [],
        "updated": [],
        "errors": []
    }

    print("=" * 80)
    print("Creating Demo Practitioner Resources")
    print("=" * 80)
    print()

    for config in DEMO_PRACTITIONERS:
        practitioner_id = config["id"]
        name = f"{' '.join(config['name']['prefix'])} {' '.join(config['name']['given'])} {config['name']['family']}"

        print(f"Processing: {name} ({practitioner_id})")

        try:
            # Create FHIR resource
            practitioner = create_practitioner_resource(config)

            # Try to read existing first
            try:
                existing = await hapi_client.read("Practitioner", practitioner_id)
                if existing:
                    print(f"  ℹ️  Practitioner {practitioner_id} already exists")
                    # Update it
                    updated = await hapi_client.update("Practitioner", practitioner_id, practitioner)
                    results["updated"].append({
                        "id": practitioner_id,
                        "name": name,
                        "operation": "updated"
                    })
                    print(f"  ✅ Updated Practitioner/{practitioner_id}")
            except Exception:
                # Doesn't exist, create it
                # Use PUT with explicit ID for demo practitioners
                created = await hapi_client.update("Practitioner", practitioner_id, practitioner)
                results["created"].append({
                    "id": practitioner_id,
                    "name": name,
                    "operation": "created"
                })
                print(f"  ✅ Created Practitioner/{practitioner_id}")

        except Exception as e:
            error_msg = str(e)
            results["errors"].append({
                "id": practitioner_id,
                "name": name,
                "error": error_msg
            })
            print(f"  ❌ Error: {error_msg}")

        print()

    return results


async def verify_demo_practitioners():
    """
    Verify all demo Practitioners exist and are accessible.

    Returns:
        Dict with verification results
    """
    hapi_client = HAPIFHIRClient()
    results = {
        "verified": [],
        "missing": [],
        "errors": []
    }

    print("=" * 80)
    print("Verifying Demo Practitioner Resources")
    print("=" * 80)
    print()

    for config in DEMO_PRACTITIONERS:
        practitioner_id = config["id"]
        name = f"{' '.join(config['name']['prefix'])} {' '.join(config['name']['given'])} {config['name']['family']}"

        try:
            practitioner = await hapi_client.read("Practitioner", practitioner_id)

            if practitioner:
                results["verified"].append({
                    "id": practitioner_id,
                    "name": name,
                    "active": practitioner.get("active", False)
                })
                print(f"✅ {name} (Practitioner/{practitioner_id}) - VERIFIED")
            else:
                results["missing"].append(practitioner_id)
                print(f"❌ {name} (Practitioner/{practitioner_id}) - MISSING")

        except Exception as e:
            results["errors"].append({
                "id": practitioner_id,
                "error": str(e)
            })
            print(f"❌ {name} (Practitioner/{practitioner_id}) - ERROR: {e}")

    print()
    return results


async def main():
    """Main execution"""
    print()
    print("=" * 80)
    print("Demo Practitioner Setup")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 80)
    print()

    try:
        # Create demo practitioners
        creation_results = await create_demo_practitioners()

        # Verify they exist
        verification_results = await verify_demo_practitioners()

        # Summary
        print("=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(f"Created: {len(creation_results['created'])}")
        print(f"Updated: {len(creation_results['updated'])}")
        print(f"Verified: {len(verification_results['verified'])}")
        print(f"Errors: {len(creation_results['errors']) + len(verification_results['errors'])}")
        print()

        if creation_results["errors"] or verification_results["errors"]:
            print("⚠️  Some operations had errors. See details above.")
            return 1

        print("✅ All demo Practitioners created and verified successfully!")
        print()
        print("Demo Practitioner IDs for auth configuration:")
        for config in DEMO_PRACTITIONERS:
            username = config["id"].replace("demo-", "")
            print(f"  {username:12} → Practitioner/{config['id']}")
        print()

        return 0

    except Exception as e:
        print(f"❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
