#!/usr/bin/env python3
"""
CDS Hooks Migration Script: 1.0 to 2.0
Migrates existing CDS Hooks services to the 2.0 specification
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
import uuid
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database configuration
DATABASE_URL = "postgresql+asyncpg://emr_user:emr_password@localhost:5432/emr_db"

# Hook name mappings from 1.0 to 2.0
HOOK_NAME_MAPPINGS = {
    "medication-order": "medication-prescribe",
    "order-review": "order-sign",
    "patient-admit": "encounter-start",
    "patient-discharge": "encounter-discharge"
}

# New 2.0 hooks
NEW_HOOKS = [
    "allergyintolerance-create",
    "appointment-book",
    "problem-list-item-create",
    "order-dispatch",
    "medication-refill"
]


class CDSHooksMigrator:
    """Handles migration from CDS Hooks 1.0 to 2.0"""
    
    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self.migration_report = {
            "started_at": datetime.utcnow().isoformat(),
            "services_migrated": 0,
            "cards_updated": 0,
            "feedback_table_created": False,
            "system_actions_enabled": False,
            "new_hooks_added": [],
            "errors": []
        }
    
    async def migrate(self) -> Dict[str, Any]:
        """Run the complete migration process"""
        logger.info("Starting CDS Hooks 1.0 to 2.0 migration...")
        
        try:
            # Step 1: Create new database tables
            await self._create_v2_tables()
            
            # Step 2: Migrate existing services
            await self._migrate_existing_services()
            
            # Step 3: Add new 2.0 hooks
            await self._add_new_hooks()
            
            # Step 4: Update service configurations
            await self._update_service_configurations()
            
            # Step 5: Enable system actions
            await self._enable_system_actions()
            
            # Step 6: Validate migration
            await self._validate_migration()
            
            self.migration_report["completed_at"] = datetime.utcnow().isoformat()
            self.migration_report["status"] = "success"
            
        except Exception as e:
            logger.error(f"Migration failed: {str(e)}")
            self.migration_report["errors"].append(str(e))
            self.migration_report["status"] = "failed"
        
        return self.migration_report
    
    async def _create_v2_tables(self):
        """Create new tables required for CDS Hooks 2.0"""
        logger.info("Creating CDS Hooks 2.0 tables...")
        
        try:
            # Create feedback table
            await self.db.execute(text("""
                CREATE TABLE IF NOT EXISTS cds.feedback (
                    id SERIAL PRIMARY KEY,
                    feedback_id UUID DEFAULT gen_random_uuid(),
                    service_id VARCHAR(255) NOT NULL,
                    hook_instance UUID,
                    card_uuid UUID NOT NULL,
                    outcome VARCHAR(50) NOT NULL CHECK (outcome IN ('accepted', 'overridden')),
                    outcome_timestamp TIMESTAMP NOT NULL,
                    override_reason_code VARCHAR(255),
                    override_reason_comment TEXT,
                    accepted_suggestions JSONB,
                    user_id VARCHAR(255),
                    patient_id VARCHAR(255),
                    encounter_id VARCHAR(255),
                    context JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_feedback_service (service_id),
                    INDEX idx_feedback_card (card_uuid),
                    INDEX idx_feedback_outcome (outcome),
                    INDEX idx_feedback_timestamp (outcome_timestamp)
                )
            """))
            
            # Create system actions audit table
            await self.db.execute(text("""
                CREATE TABLE IF NOT EXISTS cds.system_actions (
                    id SERIAL PRIMARY KEY,
                    action_id UUID DEFAULT gen_random_uuid(),
                    hook_instance UUID NOT NULL,
                    service_id VARCHAR(255) NOT NULL,
                    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('create', 'update', 'delete')),
                    resource_type VARCHAR(100) NOT NULL,
                    resource_id VARCHAR(255),
                    resource_data JSONB,
                    applied_at TIMESTAMP,
                    status VARCHAR(50) DEFAULT 'pending',
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_actions_hook (hook_instance),
                    INDEX idx_actions_service (service_id),
                    INDEX idx_actions_status (status)
                )
            """))
            
            # Create override reasons reference table
            await self.db.execute(text("""
                CREATE TABLE IF NOT EXISTS cds.override_reasons (
                    id SERIAL PRIMARY KEY,
                    code VARCHAR(255) UNIQUE NOT NULL,
                    display VARCHAR(500) NOT NULL,
                    system VARCHAR(500),
                    active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            
            # Insert standard override reasons
            await self.db.execute(text("""
                INSERT INTO cds.override_reasons (code, display) VALUES
                ('patient-preference', 'Patient preference'),
                ('benefit-outweighs-risk', 'Benefits outweigh risks'),
                ('will-monitor', 'Will monitor patient closely'),
                ('not-applicable', 'Not applicable to this patient'),
                ('alternative-treatment', 'Using alternative treatment'),
                ('clinician-judgment', 'Clinical judgment override')
                ON CONFLICT (code) DO NOTHING
            """))
            
            await self.db.commit()
            self.migration_report["feedback_table_created"] = True
            logger.info("CDS Hooks 2.0 tables created successfully")
            
        except Exception as e:
            logger.error(f"Error creating tables: {str(e)}")
            self.migration_report["errors"].append(f"Table creation failed: {str(e)}")
            raise
    
    async def _migrate_existing_services(self):
        """Migrate existing CDS services to 2.0 format"""
        logger.info("Migrating existing services...")
        
        try:
            # Get all existing services
            result = await self.db.execute(text("""
                SELECT id, hook_type, configuration 
                FROM cds.hook_configurations
                WHERE deleted = false
            """))
            
            services = result.fetchall()
            
            for service in services:
                service_id = service.id
                hook_type = service.hook_type
                config = service.configuration or {}
                
                # Update hook name if needed
                if hook_type in HOOK_NAME_MAPPINGS:
                    new_hook_type = HOOK_NAME_MAPPINGS[hook_type]
                    await self.db.execute(text("""
                        UPDATE cds.hook_configurations
                        SET hook_type = :new_hook_type
                        WHERE id = :id
                    """), {"new_hook_type": new_hook_type, "id": service_id})
                    logger.info(f"Updated hook type {hook_type} to {new_hook_type}")
                
                # Update configuration for 2.0
                config["version"] = "2.0"
                config["usageRequirements"] = config.get("usageRequirements", 
                    "Requires CDS Hooks 2.0 client with feedback support")
                
                # Add prefetch if missing
                if "prefetch" not in config:
                    config["prefetch"] = self._get_default_prefetch(hook_type)
                
                await self.db.execute(text("""
                    UPDATE cds.hook_configurations
                    SET configuration = :config,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = :id
                """), {"config": json.dumps(config), "id": service_id})
                
                self.migration_report["services_migrated"] += 1
            
            await self.db.commit()
            logger.info(f"Migrated {self.migration_report['services_migrated']} services")
            
        except Exception as e:
            logger.error(f"Error migrating services: {str(e)}")
            self.migration_report["errors"].append(f"Service migration failed: {str(e)}")
            raise
    
    async def _add_new_hooks(self):
        """Add new CDS Hooks 2.0 hook types"""
        logger.info("Adding new 2.0 hooks...")
        
        new_hook_configs = [
            {
                "id": "allergy-alert",
                "hook": "allergyintolerance-create",
                "title": "Allergy Alert Service",
                "description": "Alerts when creating allergies that may conflict with active medications",
                "prefetch": {
                    "patient": "Patient/{{context.patientId}}",
                    "medications": "MedicationRequest?patient={{context.patientId}}&status=active"
                }
            },
            {
                "id": "appointment-conflict-check",
                "hook": "appointment-book",
                "title": "Appointment Conflict Checker",
                "description": "Checks for scheduling conflicts when booking appointments",
                "prefetch": {
                    "patient": "Patient/{{context.patientId}}",
                    "appointments": "Appointment?patient={{context.patientId}}&date=ge{{context.appointmentStartDate}}"
                }
            },
            {
                "id": "problem-list-advisor",
                "hook": "problem-list-item-create",
                "title": "Problem List Advisor",
                "description": "Provides guidance when adding problems to patient problem list",
                "prefetch": {
                    "patient": "Patient/{{context.patientId}}",
                    "conditions": "Condition?patient={{context.patientId}}"
                }
            },
            {
                "id": "order-dispatch-validator",
                "hook": "order-dispatch",
                "title": "Order Dispatch Validator",
                "description": "Validates orders before dispatch",
                "prefetch": {
                    "order": "ServiceRequest/{{context.orderId}}"
                }
            },
            {
                "id": "medication-refill-advisor",
                "hook": "medication-refill",
                "title": "Medication Refill Advisor",
                "description": "Provides guidance for medication refills",
                "prefetch": {
                    "medicationRequest": "MedicationRequest/{{context.medicationRequestId}}",
                    "patient": "Patient/{{context.patientId}}"
                }
            }
        ]
        
        try:
            for hook_config in new_hook_configs:
                # Check if already exists
                result = await self.db.execute(text("""
                    SELECT id FROM cds.hook_configurations
                    WHERE id = :id
                """), {"id": hook_config["id"]})
                
                if not result.first():
                    await self.db.execute(text("""
                        INSERT INTO cds.hook_configurations (
                            id, hook_type, title, description, 
                            configuration, enabled, created_at
                        ) VALUES (
                            :id, :hook, :title, :description,
                            :config, true, CURRENT_TIMESTAMP
                        )
                    """), {
                        "id": hook_config["id"],
                        "hook": hook_config["hook"],
                        "title": hook_config["title"],
                        "description": hook_config["description"],
                        "config": json.dumps({
                            "version": "2.0",
                            "prefetch": hook_config["prefetch"],
                            "usageRequirements": "CDS Hooks 2.0 compliant"
                        })
                    })
                    
                    self.migration_report["new_hooks_added"].append(hook_config["id"])
                    logger.info(f"Added new hook: {hook_config['id']}")
            
            await self.db.commit()
            
        except Exception as e:
            logger.error(f"Error adding new hooks: {str(e)}")
            self.migration_report["errors"].append(f"New hook addition failed: {str(e)}")
            raise
    
    async def _update_service_configurations(self):
        """Update service configurations for 2.0 compliance"""
        logger.info("Updating service configurations...")
        
        try:
            # Add UUID to all cards in execution history
            result = await self.db.execute(text("""
                SELECT id, response_data 
                FROM cds.hook_executions
                WHERE response_data IS NOT NULL
                AND response_data::text NOT LIKE '%"uuid":%'
            """))
            
            executions = result.fetchall()
            
            for execution in executions:
                exec_id = execution.id
                response_data = execution.response_data
                
                if "cards" in response_data:
                    for card in response_data["cards"]:
                        if "uuid" not in card:
                            card["uuid"] = str(uuid.uuid4())
                            self.migration_report["cards_updated"] += 1
                    
                    await self.db.execute(text("""
                        UPDATE cds.hook_executions
                        SET response_data = :data
                        WHERE id = :id
                    """), {"data": json.dumps(response_data), "id": exec_id})
            
            await self.db.commit()
            logger.info(f"Updated {self.migration_report['cards_updated']} cards with UUIDs")
            
        except Exception as e:
            logger.error(f"Error updating configurations: {str(e)}")
            self.migration_report["errors"].append(f"Configuration update failed: {str(e)}")
    
    async def _enable_system_actions(self):
        """Enable system actions support"""
        logger.info("Enabling system actions...")
        
        try:
            # Add system actions configuration
            await self.db.execute(text("""
                INSERT INTO cds.system_configuration (
                    key, value, description, created_at
                ) VALUES (
                    'systemActionsEnabled', 
                    'true',
                    'Enable CDS Hooks 2.0 system actions',
                    CURRENT_TIMESTAMP
                )
                ON CONFLICT (key) DO UPDATE
                SET value = 'true',
                    updated_at = CURRENT_TIMESTAMP
            """))
            
            await self.db.commit()
            self.migration_report["system_actions_enabled"] = True
            logger.info("System actions enabled")
            
        except Exception as e:
            logger.error(f"Error enabling system actions: {str(e)}")
            self.migration_report["errors"].append(f"System actions enablement failed: {str(e)}")
    
    async def _validate_migration(self):
        """Validate the migration was successful"""
        logger.info("Validating migration...")
        
        validations = []
        
        try:
            # Check feedback table exists
            result = await self.db.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'cds' 
                    AND table_name = 'feedback'
                )
            """))
            feedback_exists = result.scalar()
            validations.append(("Feedback table exists", feedback_exists))
            
            # Check system actions table exists  
            result = await self.db.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'cds' 
                    AND table_name = 'system_actions'
                )
            """))
            actions_exists = result.scalar()
            validations.append(("System actions table exists", actions_exists))
            
            # Check new hooks added
            result = await self.db.execute(text("""
                SELECT COUNT(*) FROM cds.hook_configurations
                WHERE hook_type IN :new_hooks
            """), {"new_hooks": tuple(NEW_HOOKS)})
            new_hook_count = result.scalar()
            validations.append(("New hooks added", new_hook_count >= len(NEW_HOOKS)))
            
            # Check no legacy hook names remain
            result = await self.db.execute(text("""
                SELECT COUNT(*) FROM cds.hook_configurations
                WHERE hook_type IN :old_hooks
                AND deleted = false
            """), {"old_hooks": tuple(HOOK_NAME_MAPPINGS.keys())})
            legacy_count = result.scalar()
            validations.append(("Legacy hook names removed", legacy_count == 0))
            
            all_valid = all(v[1] for v in validations)
            self.migration_report["validations"] = validations
            self.migration_report["validation_passed"] = all_valid
            
            if all_valid:
                logger.info("Migration validation passed")
            else:
                logger.warning("Migration validation failed")
                failed = [v[0] for v in validations if not v[1]]
                self.migration_report["errors"].append(f"Validation failed: {failed}")
            
        except Exception as e:
            logger.error(f"Error during validation: {str(e)}")
            self.migration_report["errors"].append(f"Validation error: {str(e)}")
    
    def _get_default_prefetch(self, hook_type: str) -> Dict[str, str]:
        """Get default prefetch for a hook type"""
        prefetch_templates = {
            "patient-view": {
                "patient": "Patient/{{context.patientId}}"
            },
            "medication-prescribe": {
                "patient": "Patient/{{context.patientId}}",
                "medications": "MedicationRequest?patient={{context.patientId}}&status=active"
            },
            "order-sign": {
                "patient": "Patient/{{context.patientId}}",
                "draftOrders": "ServiceRequest?patient={{context.patientId}}&status=draft"
            },
            "encounter-start": {
                "patient": "Patient/{{context.patientId}}",
                "encounter": "Encounter/{{context.encounterId}}"
            },
            "encounter-discharge": {
                "patient": "Patient/{{context.patientId}}",
                "encounter": "Encounter/{{context.encounterId}}"
            }
        }
        
        return prefetch_templates.get(hook_type, {
            "patient": "Patient/{{context.patientId}}"
        })


async def run_migration():
    """Run the CDS Hooks migration"""
    # Create async engine
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    # Create async session
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        migrator = CDSHooksMigrator(session)
        report = await migrator.migrate()
        
        # Print migration report
        print("\n" + "="*60)
        print("CDS HOOKS MIGRATION REPORT")
        print("="*60)
        print(f"Status: {report['status']}")
        print(f"Started: {report['started_at']}")
        print(f"Completed: {report.get('completed_at', 'N/A')}")
        print(f"\nServices migrated: {report['services_migrated']}")
        print(f"Cards updated with UUIDs: {report['cards_updated']}")
        print(f"New hooks added: {len(report['new_hooks_added'])}")
        if report['new_hooks_added']:
            for hook in report['new_hooks_added']:
                print(f"  - {hook}")
        
        print(f"\nFeedback table created: {report['feedback_table_created']}")
        print(f"System actions enabled: {report['system_actions_enabled']}")
        
        if "validations" in report:
            print("\nValidation Results:")
            for check, passed in report["validations"]:
                status = "✓" if passed else "✗"
                print(f"  {status} {check}")
        
        if report['errors']:
            print("\nErrors encountered:")
            for error in report['errors']:
                print(f"  - {error}")
        
        print("="*60)
        
        # Save report to file
        with open("cds_hooks_migration_report.json", "w") as f:
            json.dump(report, f, indent=2)
        print("\nFull report saved to: cds_hooks_migration_report.json")
    
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run_migration())