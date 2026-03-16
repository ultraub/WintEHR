#!/usr/bin/env python3
"""
Seed SMART on FHIR Applications

Populates the smart_auth.registered_apps table with sample SMART applications
for educational and demonstration purposes.

Usage:
    python scripts/active/seed_smart_apps.py [--force]

Options:
    --force: Update existing apps even if they already exist
"""

import asyncio
import argparse
import logging
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from sqlalchemy import text
from database import get_db_session, async_session_factory

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# =============================================================================
# SMART App Definitions
# =============================================================================

# Base URL for SMART app redirect/launch URIs
# Override with SMART_BASE_URL env var for non-localhost deployments
SMART_BASE_URL = os.getenv("SMART_BASE_URL", "http://localhost")

def _smart_url(port, path=""):
    """Build a SMART app URL from base URL and port."""
    return f"{SMART_BASE_URL}:{port}{path}"


SMART_APPS = [
    # Clinical Tools
    {
        "client_id": "growth-chart-app",
        "name": "Growth Chart",
        "description": "Pediatric growth chart visualization for tracking patient development over time. Displays height, weight, and BMI percentiles.",
        "client_type": "public",
        "redirect_uris": [_smart_url(9000, "/"), _smart_url(9000, "/callback")],
        "scopes": [
            "launch", "launch/patient",
            "patient/Patient.read", "patient/Observation.read",
            "openid", "fhirUser"
        ],
        "launch_uri": _smart_url(9000, "/launch.html"),
        "logo_uri": "/assets/smart-apps/growth-chart.svg",
        "category": "clinical",
        "is_active": True
    },
    {
        "client_id": "demo-patient-viewer",
        "name": "Patient Summary Viewer",
        "description": "Comprehensive patient clinical summary including conditions, medications, allergies, and recent observations.",
        "client_type": "public",
        "redirect_uris": [_smart_url(3001, "/callback"), _smart_url(3000, "/smart-callback")],
        "scopes": [
            "launch", "launch/patient",
            "patient/Patient.read", "patient/Observation.read",
            "patient/Condition.read", "patient/MedicationRequest.read",
            "patient/AllergyIntolerance.read", "patient/Procedure.read",
            "openid", "fhirUser"
        ],
        "launch_uri": _smart_url(3001, "/launch"),
        "logo_uri": "/assets/smart-apps/patient-viewer.svg",
        "category": "clinical",
        "is_active": True
    },
    {
        "client_id": "ascvd-risk-calculator",
        "name": "ASCVD Risk Calculator",
        "description": "Atherosclerotic Cardiovascular Disease 10-year risk calculator based on ACC/AHA guidelines.",
        "client_type": "public",
        "redirect_uris": [_smart_url(9001, "/"), _smart_url(9001, "/callback")],
        "scopes": [
            "launch", "launch/patient",
            "patient/Patient.read", "patient/Observation.read",
            "patient/Condition.read", "patient/MedicationRequest.read",
            "openid", "fhirUser"
        ],
        "launch_uri": _smart_url(9001, "/launch.html"),
        "logo_uri": "/assets/smart-apps/ascvd-calculator.svg",
        "category": "clinical",
        "is_active": True
    },
    {
        "client_id": "medication-list",
        "name": "Medication List Manager",
        "description": "View and manage patient medication lists with drug interaction checking and adherence tracking.",
        "client_type": "public",
        "redirect_uris": [_smart_url(9002, "/callback")],
        "scopes": [
            "launch", "launch/patient",
            "patient/Patient.read", "patient/MedicationRequest.read",
            "patient/MedicationStatement.read", "patient/AllergyIntolerance.read",
            "openid", "fhirUser"
        ],
        "launch_uri": _smart_url(9002, "/launch"),
        "logo_uri": "/assets/smart-apps/medication-list.svg",
        "category": "clinical",
        "is_active": True
    },
    # Analytics Tools
    {
        "client_id": "lab-trends",
        "name": "Lab Trend Analyzer",
        "description": "Visualize laboratory result trends over time with customizable charts and comparison tools.",
        "client_type": "public",
        "redirect_uris": [_smart_url(9003, "/callback")],
        "scopes": [
            "launch", "launch/patient",
            "patient/Patient.read", "patient/Observation.read",
            "patient/DiagnosticReport.read",
            "openid", "fhirUser"
        ],
        "launch_uri": _smart_url(9003, "/launch"),
        "logo_uri": "/assets/smart-apps/lab-trends.svg",
        "category": "analytics",
        "is_active": True
    },
    {
        "client_id": "population-health",
        "name": "Population Health Dashboard",
        "description": "Population-level analytics for care gap identification and quality measure tracking.",
        "client_type": "confidential",
        "redirect_uris": [_smart_url(9004, "/callback")],
        "scopes": [
            "launch",
            "user/Patient.read", "user/Observation.read",
            "user/Condition.read", "user/MedicationRequest.read",
            "openid", "fhirUser"
        ],
        "launch_uri": _smart_url(9004, "/launch"),
        "logo_uri": "/assets/smart-apps/population-health.svg",
        "category": "analytics",
        "is_active": True
    },
    # Educational Tools
    {
        "client_id": "fhir-resource-viewer",
        "name": "FHIR Resource Viewer",
        "description": "Educational tool for exploring raw FHIR resources with syntax highlighting and validation.",
        "client_type": "public",
        "redirect_uris": [_smart_url(9005, "/callback")],
        "scopes": [
            "launch", "launch/patient",
            "patient/*.read",
            "openid", "fhirUser"
        ],
        "launch_uri": _smart_url(9005, "/launch"),
        "logo_uri": "/assets/smart-apps/fhir-viewer.svg",
        "category": "educational",
        "is_active": True
    },
    {
        "client_id": "oauth-flow-visualizer",
        "name": "OAuth Flow Visualizer",
        "description": "Step-by-step visualization of the SMART on FHIR OAuth2 authorization flow for learning purposes.",
        "client_type": "public",
        "redirect_uris": [_smart_url(3000, "/smart-callback")],
        "scopes": [
            "launch", "launch/patient",
            "patient/Patient.read",
            "openid", "fhirUser"
        ],
        "launch_uri": _smart_url(3000, "/smart-education"),
        "logo_uri": "/assets/smart-apps/oauth-visualizer.svg",
        "category": "educational",
        "is_active": True
    },
    # Specialty Tools
    {
        "client_id": "diabetes-management",
        "name": "Diabetes Management",
        "description": "Diabetes care management with glucose trend analysis, HbA1c tracking, and medication optimization.",
        "client_type": "public",
        "redirect_uris": [_smart_url(9006, "/callback")],
        "scopes": [
            "launch", "launch/patient",
            "patient/Patient.read", "patient/Observation.read",
            "patient/Condition.read", "patient/MedicationRequest.read",
            "patient/CarePlan.read",
            "openid", "fhirUser"
        ],
        "launch_uri": _smart_url(9006, "/launch"),
        "logo_uri": "/assets/smart-apps/diabetes-mgmt.svg",
        "category": "clinical",
        "is_active": True
    },
    {
        "client_id": "care-plan-viewer",
        "name": "Care Plan Viewer",
        "description": "View and track patient care plans with goals, activities, and progress monitoring.",
        "client_type": "public",
        "redirect_uris": [_smart_url(9007, "/callback")],
        "scopes": [
            "launch", "launch/patient",
            "patient/Patient.read", "patient/CarePlan.read",
            "patient/Goal.read", "patient/Condition.read",
            "openid", "fhirUser"
        ],
        "launch_uri": _smart_url(9007, "/launch"),
        "logo_uri": "/assets/smart-apps/care-plan.svg",
        "category": "clinical",
        "is_active": True
    }
]


# =============================================================================
# Seeding Functions
# =============================================================================

async def seed_smart_apps(force: bool = False) -> dict:
    """
    Seed SMART applications to database

    Args:
        force: If True, update existing apps

    Returns:
        Summary of operations
    """
    logger.info("=" * 80)
    logger.info("Seeding SMART on FHIR Applications")
    logger.info("=" * 80)

    summary = {
        "created": 0,
        "updated": 0,
        "skipped": 0,
        "errors": 0
    }

    async with async_session_factory() as session:
        for app in SMART_APPS:
            try:
                # Check if app exists
                check_query = text("""
                    SELECT client_id FROM smart_auth.registered_apps
                    WHERE client_id = :client_id
                """)
                result = await session.execute(check_query, {"client_id": app["client_id"]})
                exists = result.fetchone() is not None

                if exists and not force:
                    logger.info(f"  ⏭️  Skipping {app['name']} (already exists)")
                    summary["skipped"] += 1
                    continue

                # Upsert the app
                upsert_query = text("""
                    INSERT INTO smart_auth.registered_apps (
                        client_id, name, description, client_type,
                        redirect_uris, scopes, launch_uri, logo_uri, is_active
                    ) VALUES (
                        :client_id, :name, :description, :client_type,
                        :redirect_uris, :scopes, :launch_uri, :logo_uri, :is_active
                    )
                    ON CONFLICT (client_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        description = EXCLUDED.description,
                        redirect_uris = EXCLUDED.redirect_uris,
                        scopes = EXCLUDED.scopes,
                        launch_uri = EXCLUDED.launch_uri,
                        logo_uri = EXCLUDED.logo_uri,
                        is_active = EXCLUDED.is_active,
                        updated_at = CURRENT_TIMESTAMP
                """)

                await session.execute(upsert_query, {
                    "client_id": app["client_id"],
                    "name": app["name"],
                    "description": app["description"],
                    "client_type": app["client_type"],
                    "redirect_uris": app["redirect_uris"],
                    "scopes": app["scopes"],
                    "launch_uri": app["launch_uri"],
                    "logo_uri": app["logo_uri"],
                    "is_active": app["is_active"]
                })

                if exists:
                    logger.info(f"  ✏️  Updated {app['name']}")
                    summary["updated"] += 1
                else:
                    logger.info(f"  ✅ Created {app['name']}")
                    summary["created"] += 1

            except Exception as e:
                logger.error(f"  ❌ Error processing {app.get('name', 'unknown')}: {e}")
                summary["errors"] += 1

        await session.commit()

    # Print summary
    logger.info("")
    logger.info("=" * 80)
    logger.info("Summary")
    logger.info("=" * 80)
    logger.info(f"  Created: {summary['created']}")
    logger.info(f"  Updated: {summary['updated']}")
    logger.info(f"  Skipped: {summary['skipped']}")
    logger.info(f"  Errors:  {summary['errors']}")

    return summary


async def list_smart_apps() -> None:
    """List all registered SMART apps"""
    async with async_session_factory() as session:
        query = text("""
            SELECT client_id, name, is_active, array_length(scopes, 1) as scope_count
            FROM smart_auth.registered_apps
            ORDER BY name
        """)
        result = await session.execute(query)
        apps = result.fetchall()

        logger.info("")
        logger.info("Registered SMART Apps:")
        logger.info("-" * 60)
        for app in apps:
            status = "✅" if app.is_active else "❌"
            logger.info(f"  {status} {app.name} ({app.client_id}) - {app.scope_count} scopes")


# =============================================================================
# Main
# =============================================================================

async def main():
    parser = argparse.ArgumentParser(description="Seed SMART on FHIR applications")
    parser.add_argument("--force", action="store_true", help="Update existing apps")
    parser.add_argument("--list", action="store_true", help="List existing apps")
    args = parser.parse_args()

    if args.list:
        await list_smart_apps()
    else:
        await seed_smart_apps(force=args.force)
        await list_smart_apps()


if __name__ == "__main__":
    asyncio.run(main())
