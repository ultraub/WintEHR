"""
Initialize CDS Hooks 2.0 Database Schema
Creates all necessary tables for CDS Hooks 2.0 implementation
"""

import asyncio
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import os
import sys

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import DATABASE_URL

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def create_cds_schema(db: AsyncSession):
    """Create CDS schema and tables"""
    
    try:
        # Create schema
        await db.execute(text("CREATE SCHEMA IF NOT EXISTS cds"))
        logger.info("Created cds schema")
        
        # Create CDS services table
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS cds.cds_services (
                id VARCHAR PRIMARY KEY,
                hook VARCHAR NOT NULL,
                title VARCHAR,
                description TEXT NOT NULL,
                enabled BOOLEAN DEFAULT TRUE,
                prefetch JSONB,
                usage_requirements TEXT,
                implementation_type VARCHAR DEFAULT 'config',
                implementation_code TEXT,
                implementation_url VARCHAR,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE,
                created_by VARCHAR,
                version VARCHAR DEFAULT '1.0'
            )
        """))
        logger.info("Created cds_services table")
        
        # Create CDS feedback table
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS cds.cds_feedback (
                id SERIAL PRIMARY KEY,
                service_id VARCHAR NOT NULL REFERENCES cds.cds_services(id),
                card_uuid VARCHAR NOT NULL,
                outcome VARCHAR NOT NULL,
                outcome_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
                accepted_suggestions TEXT[],
                override_reason_key VARCHAR,
                override_reason_comment TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                patient_id VARCHAR,
                user_id VARCHAR
            )
        """))
        logger.info("Created cds_feedback table")
        
        # Create indexes for feedback table
        await db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_cds_feedback_service_id 
            ON cds.cds_feedback(service_id)
        """))
        await db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_cds_feedback_outcome_timestamp 
            ON cds.cds_feedback(outcome_timestamp)
        """))
        await db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_cds_feedback_card_uuid 
            ON cds.cds_feedback(card_uuid)
        """))
        
        # Create CDS executions table
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS cds.cds_executions (
                id SERIAL PRIMARY KEY,
                service_id VARCHAR NOT NULL REFERENCES cds.cds_services(id),
                hook_instance VARCHAR NOT NULL,
                hook VARCHAR NOT NULL,
                patient_id VARCHAR,
                user_id VARCHAR,
                encounter_id VARCHAR,
                fhir_server VARCHAR,
                cards_returned INTEGER DEFAULT 0,
                system_actions_returned INTEGER DEFAULT 0,
                execution_time_ms INTEGER,
                request_context JSONB,
                response_cards JSONB,
                response_system_actions JSONB,
                executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                error_message TEXT
            )
        """))
        logger.info("Created cds_executions table")
        
        # Create indexes for executions table
        await db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_cds_executions_service_id 
            ON cds.cds_executions(service_id)
        """))
        await db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_cds_executions_executed_at 
            ON cds.cds_executions(executed_at)
        """))
        await db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_cds_executions_hook_instance 
            ON cds.cds_executions(hook_instance)
        """))
        
        # Create CDS card templates table
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS cds.cds_card_templates (
                id VARCHAR PRIMARY KEY,
                name VARCHAR NOT NULL,
                description TEXT,
                category VARCHAR,
                card_template JSONB NOT NULL,
                override_reasons JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE,
                created_by VARCHAR,
                is_public BOOLEAN DEFAULT TRUE
            )
        """))
        logger.info("Created cds_card_templates table")
        
        # Create CDS override reasons table
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS cds.cds_override_reasons (
                id SERIAL PRIMARY KEY,
                service_id VARCHAR NOT NULL REFERENCES cds.cds_services(id),
                key VARCHAR NOT NULL,
                display VARCHAR NOT NULL,
                code VARCHAR,
                system VARCHAR,
                usage_count INTEGER DEFAULT 0,
                last_used TIMESTAMP WITH TIME ZONE,
                UNIQUE(service_id, key)
            )
        """))
        logger.info("Created cds_override_reasons table")
        
        # Create CDS system actions audit table
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS cds.cds_system_actions_audit (
                id SERIAL PRIMARY KEY,
                service_id VARCHAR NOT NULL,
                hook_instance VARCHAR NOT NULL,
                action_type VARCHAR NOT NULL,
                resource_type VARCHAR NOT NULL,
                resource_id VARCHAR,
                status VARCHAR NOT NULL,
                user_id VARCHAR,
                patient_id VARCHAR,
                executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                request_data JSONB,
                response_data JSONB,
                error_message TEXT
            )
        """))
        logger.info("Created cds_system_actions_audit table")
        
        # Create indexes for system actions audit
        await db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_cds_system_actions_service_id 
            ON cds.cds_system_actions_audit(service_id)
        """))
        await db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_cds_system_actions_hook_instance 
            ON cds.cds_system_actions_audit(hook_instance)
        """))
        
        await db.commit()
        logger.info("Successfully created all CDS Hooks 2.0 tables")
        
    except Exception as e:
        logger.error(f"Error creating CDS schema: {str(e)}")
        await db.rollback()
        raise


async def insert_sample_services(db: AsyncSession):
    """Insert sample CDS services for testing"""
    
    try:
        # Check if services already exist
        result = await db.execute(text("SELECT COUNT(*) FROM cds.cds_services"))
        count = result.scalar()
        
        if count > 0:
            logger.info(f"Found {count} existing services, skipping sample data")
            return
        
        # Insert sample services
        sample_services = [
            {
                "id": "diabetes-screening-reminder",
                "hook": "patient-view",
                "title": "Diabetes Screening Reminder",
                "description": "Reminds clinicians to screen eligible patients for diabetes",
                "enabled": True,
                "prefetch": {
                    "patient": "Patient/{{context.patientId}}",
                    "conditions": "Condition?patient={{context.patientId}}&code=44054006"
                },
                "implementation_type": "code"
            },
            {
                "id": "drug-interaction-checker",
                "hook": "medication-prescribe",
                "title": "Drug Interaction Checker",
                "description": "Checks for drug-drug interactions when prescribing medications",
                "enabled": True,
                "prefetch": {
                    "patient": "Patient/{{context.patientId}}",
                    "medications": "MedicationRequest?patient={{context.patientId}}&status=active"
                },
                "implementation_type": "code"
            },
            {
                "id": "allergy-alert",
                "hook": "order-select",
                "title": "Allergy Alert Service",
                "description": "Alerts when orders may conflict with patient allergies",
                "enabled": True,
                "prefetch": {
                    "patient": "Patient/{{context.patientId}}",
                    "allergies": "AllergyIntolerance?patient={{context.patientId}}"
                },
                "implementation_type": "code"
            }
        ]
        
        for service in sample_services:
            await db.execute(text("""
                INSERT INTO cds.cds_services 
                (id, hook, title, description, enabled, prefetch, implementation_type)
                VALUES (:id, :hook, :title, :description, :enabled, :prefetch::jsonb, :implementation_type)
            """), service)
        
        # Insert sample override reasons
        override_reasons = [
            {
                "service_id": "drug-interaction-checker",
                "key": "patient-preference",
                "display": "Patient preference/refusal"
            },
            {
                "service_id": "drug-interaction-checker",
                "key": "clinical-judgment",
                "display": "Clinical judgment - benefit outweighs risk"
            },
            {
                "service_id": "drug-interaction-checker",
                "key": "already-monitored",
                "display": "Already monitoring this interaction"
            }
        ]
        
        for reason in override_reasons:
            await db.execute(text("""
                INSERT INTO cds.cds_override_reasons 
                (service_id, key, display)
                VALUES (:service_id, :key, :display)
            """), reason)
        
        await db.commit()
        logger.info("Successfully inserted sample CDS services")
        
    except Exception as e:
        logger.error(f"Error inserting sample services: {str(e)}")
        await db.rollback()


async def main():
    """Main function to initialize CDS Hooks 2.0 schema"""
    
    # Create async engine
    engine = create_async_engine(DATABASE_URL, echo=True)
    
    # Create async session
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        logger.info("Initializing CDS Hooks 2.0 database schema...")
        
        # Create schema and tables
        await create_cds_schema(session)
        
        # Insert sample data
        await insert_sample_services(session)
        
        logger.info("CDS Hooks 2.0 schema initialization complete!")
    
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())