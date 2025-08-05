#!/usr/bin/env python3
"""
CDS Hooks v2.0 Complete Database Schema Initialization
Creates all necessary tables for CDS Hooks 2.0 specification compliance
"""

import asyncio
import logging
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database configuration
DATABASE_URL = "postgresql+asyncpg://emr_user:emr_password@localhost:5432/emr_db"


async def create_cds_hooks_v2_schema(db: AsyncSession):
    """Create complete CDS Hooks 2.0 database schema"""
    
    logger.info("Creating CDS Hooks v2.0 schema...")
    
    # Create CDS schema if it doesn't exist
    await db.execute(text("CREATE SCHEMA IF NOT EXISTS cds"))
    
    # 1. Hook Configurations Table (Enhanced for v2.0)
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS cds.hook_configurations_v2 (
            id VARCHAR(255) PRIMARY KEY,
            hook_type VARCHAR(100) NOT NULL,
            title VARCHAR(500) NOT NULL,
            description TEXT,
            version VARCHAR(20) DEFAULT '2.0',
            enabled BOOLEAN DEFAULT true,
            configuration JSONB,
            prefetch JSONB,
            usage_requirements TEXT,
            system_actions_config JSONB,
            override_reasons JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by VARCHAR(255),
            updated_by VARCHAR(255),
            deleted BOOLEAN DEFAULT false
        )
    """))
    
    # 2. Hook Executions Table (Enhanced for v2.0)
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS cds.hook_executions_v2 (
            id SERIAL PRIMARY KEY,
            execution_id UUID DEFAULT gen_random_uuid(),
            service_id VARCHAR(255) NOT NULL,
            hook_instance UUID,
            hook_type VARCHAR(100) NOT NULL,
            patient_id VARCHAR(255),
            user_id VARCHAR(255),
            encounter_id VARCHAR(255),
            client_id VARCHAR(255),
            fhir_server VARCHAR(1000),
            version VARCHAR(20) DEFAULT '2.0',
            context JSONB,
            prefetch JSONB,
            request_data JSONB,
            response_data JSONB,
            cards_returned INTEGER DEFAULT 0,
            system_actions_count INTEGER DEFAULT 0,
            execution_time_ms INTEGER,
            success BOOLEAN DEFAULT true,
            error_message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    
    # 3. Feedback Table (CDS Hooks 2.0 Feedback API)
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS cds.feedback_v2 (
            id SERIAL PRIMARY KEY,
            feedback_id UUID DEFAULT gen_random_uuid(),
            service_id VARCHAR(255) NOT NULL,
            hook_instance UUID,
            card_uuid UUID NOT NULL,
            outcome VARCHAR(50) NOT NULL CHECK (outcome IN ('accepted', 'overridden')),
            outcome_timestamp TIMESTAMP NOT NULL,
            override_reason_code VARCHAR(255),
            override_reason_display VARCHAR(500),
            override_reason_system VARCHAR(500),
            user_comment TEXT,
            accepted_suggestions JSONB,
            user_id VARCHAR(255),
            patient_id VARCHAR(255),
            encounter_id VARCHAR(255),
            client_id VARCHAR(255),
            context JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    
    # 4. System Actions Table (CDS Hooks 2.0 System Actions)
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS cds.system_actions_v2 (
            id SERIAL PRIMARY KEY,
            action_id UUID DEFAULT gen_random_uuid(),
            hook_instance UUID NOT NULL,
            service_id VARCHAR(255) NOT NULL,
            action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('create', 'update', 'delete')),
            resource_type VARCHAR(100) NOT NULL,
            resource_id VARCHAR(255),
            resource_data JSONB,
            applied_at TIMESTAMP,
            status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'failed', 'skipped')),
            error_message TEXT,
            applied_by VARCHAR(255),
            client_id VARCHAR(255),
            dry_run BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    
    # 5. Override Reasons Reference Table
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS cds.override_reasons_v2 (
            id SERIAL PRIMARY KEY,
            code VARCHAR(255) UNIQUE NOT NULL,
            display VARCHAR(500) NOT NULL,
            system VARCHAR(500),
            definition TEXT,
            category VARCHAR(100),
            active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    
    # 6. CDS Clients Table (JWT Authentication)
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS cds.clients_v2 (
            id SERIAL PRIMARY KEY,
            client_id VARCHAR(255) UNIQUE NOT NULL,
            client_name VARCHAR(500) NOT NULL,
            client_description TEXT,
            public_key TEXT,
            secret_key TEXT,
            allowed_hooks JSONB,
            rate_limit INTEGER DEFAULT 1000,
            active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    
    # 7. Service Registry Table (Code-based Services)
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS cds.service_registry_v2 (
            id SERIAL PRIMARY KEY,
            service_id VARCHAR(255) UNIQUE NOT NULL,
            service_name VARCHAR(500) NOT NULL,
            hook_type VARCHAR(100) NOT NULL,
            description TEXT,
            code TEXT NOT NULL,
            language VARCHAR(50) DEFAULT 'javascript',
            version VARCHAR(20) DEFAULT '1.0',
            enabled BOOLEAN DEFAULT true,
            prefetch JSONB,
            test_context JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by VARCHAR(255),
            updated_by VARCHAR(255)
        )
    """))
    
    # 8. Analytics Summary Table
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS cds.analytics_summary_v2 (
            id SERIAL PRIMARY KEY,
            service_id VARCHAR(255) NOT NULL,
            date DATE NOT NULL,
            executions_count INTEGER DEFAULT 0,
            cards_shown INTEGER DEFAULT 0,
            cards_accepted INTEGER DEFAULT 0,
            cards_overridden INTEGER DEFAULT 0,
            system_actions_applied INTEGER DEFAULT 0,
            avg_execution_time_ms FLOAT,
            unique_patients INTEGER DEFAULT 0,
            unique_users INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(service_id, date)
        )
    """))
    
    # Create indexes for performance
    logger.info("Creating indexes...")
    
    # Hook executions indexes
    await db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_hook_executions_v2_service 
        ON cds.hook_executions_v2 (service_id)
    """))
    await db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_hook_executions_v2_hook_instance 
        ON cds.hook_executions_v2 (hook_instance)
    """))
    await db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_hook_executions_v2_patient 
        ON cds.hook_executions_v2 (patient_id)
    """))
    await db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_hook_executions_v2_timestamp 
        ON cds.hook_executions_v2 (created_at)
    """))
    
    # Feedback indexes
    await db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_feedback_v2_service 
        ON cds.feedback_v2 (service_id)
    """))
    await db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_feedback_v2_card 
        ON cds.feedback_v2 (card_uuid)
    """))
    await db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_feedback_v2_outcome 
        ON cds.feedback_v2 (outcome)
    """))
    await db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_feedback_v2_timestamp 
        ON cds.feedback_v2 (outcome_timestamp)
    """))
    
    # System actions indexes
    await db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_system_actions_v2_hook_instance 
        ON cds.system_actions_v2 (hook_instance)
    """))
    await db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_system_actions_v2_service 
        ON cds.system_actions_v2 (service_id)
    """))
    await db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_system_actions_v2_status 
        ON cds.system_actions_v2 (status)
    """))
    
    # Analytics indexes
    await db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_analytics_summary_v2_service_date 
        ON cds.analytics_summary_v2 (service_id, date)
    """))
    
    await db.commit()
    logger.info("Database schema created successfully")


async def insert_default_data(db: AsyncSession):
    """Insert default data for CDS Hooks 2.0"""
    
    logger.info("Inserting default data...")
    
    # Insert standard override reasons
    override_reasons = [
        ("patient-preference", "Patient preference", "http://terminology.hl7.org/CodeSystem/overridereason", 
         "Patient has expressed preference for alternative approach", "clinical"),
        ("benefit-outweighs-risk", "Benefits outweigh risks", "http://terminology.hl7.org/CodeSystem/overridereason",
         "Clinical benefits outweigh potential risks", "clinical"),
        ("will-monitor", "Will monitor patient closely", "http://terminology.hl7.org/CodeSystem/overridereason",
         "Will implement enhanced monitoring", "clinical"),
        ("not-applicable", "Not applicable to this patient", "http://terminology.hl7.org/CodeSystem/overridereason",
         "Clinical decision support not applicable", "clinical"),
        ("alternative-treatment", "Using alternative treatment", "http://terminology.hl7.org/CodeSystem/overridereason",
         "Alternative treatment approach selected", "clinical"),
        ("clinician-judgment", "Clinical judgment override", "http://terminology.hl7.org/CodeSystem/overridereason",
         "Override based on clinical expertise", "clinical"),
        ("patient-safety", "Patient safety concern", "http://terminology.hl7.org/CodeSystem/overridereason",
         "Override due to patient safety considerations", "safety"),
        ("system-error", "System error suspected", "http://terminology.hl7.org/CodeSystem/overridereason",
         "Potential error in decision support logic", "technical"),
        ("outdated-information", "Information outdated", "http://terminology.hl7.org/CodeSystem/overridereason",
         "Decision support based on outdated information", "technical"),
        ("emergency-situation", "Emergency situation", "http://terminology.hl7.org/CodeSystem/overridereason",
         "Emergency situation requires immediate action", "clinical")
    ]
    
    for code, display, system, definition, category in override_reasons:
        await db.execute(text("""
            INSERT INTO cds.override_reasons_v2 (code, display, system, definition, category)
            VALUES (:code, :display, :system, :definition, :category)
            ON CONFLICT (code) DO NOTHING
        """), {
            "code": code,
            "display": display,
            "system": system,
            "definition": definition,
            "category": category
        })
    
    # Insert sample CDS client
    await db.execute(text("""
        INSERT INTO cds.clients_v2 (
            client_id, client_name, client_description, 
            allowed_hooks, rate_limit, active
        ) VALUES (
            'wintehr-client', 
            'WintEHR CDS Client',
            'Default CDS Hooks client for WintEHR system',
            '["patient-view", "medication-prescribe", "order-sign", "allergyintolerance-create", "appointment-book", "problem-list-item-create", "order-dispatch", "medication-refill"]'::jsonb,
            10000,
            true
        )
        ON CONFLICT (client_id) DO NOTHING
    """))
    
    # Insert sample v2.0 hook configurations
    sample_hooks = [
        {
            "id": "allergy-interaction-checker-v2",
            "hook_type": "allergyintolerance-create",
            "title": "Allergy-Medication Interaction Checker v2.0",
            "description": "Checks for interactions between new allergies and active medications",
            "prefetch": {
                "patient": "Patient/{{context.patientId}}",
                "medications": "MedicationRequest?patient={{context.patientId}}&status=active"
            },
            "usage_requirements": "CDS Hooks 2.0 with allergyintolerance-create hook support"
        },
        {
            "id": "appointment-scheduler-v2",
            "hook_type": "appointment-book",
            "title": "Smart Appointment Scheduler v2.0",
            "description": "Provides scheduling guidance and conflict detection",
            "prefetch": {
                "patient": "Patient/{{context.patientId}}",
                "appointments": "Appointment?patient={{context.patientId}}&date=ge{{context.start}}"
            },
            "usage_requirements": "CDS Hooks 2.0 with appointment-book hook support"
        },
        {
            "id": "problem-list-assistant-v2",
            "hook_type": "problem-list-item-create",
            "title": "Problem List Clinical Assistant v2.0",
            "description": "Provides clinical guidance for problem list management",
            "prefetch": {
                "patient": "Patient/{{context.patientId}}",
                "conditions": "Condition?patient={{context.patientId}}"
            },
            "usage_requirements": "CDS Hooks 2.0 with problem-list-item-create hook support"
        }
    ]
    
    for hook in sample_hooks:
        await db.execute(text("""
            INSERT INTO cds.hook_configurations_v2 (
                id, hook_type, title, description, prefetch, usage_requirements, enabled
            ) VALUES (
                :id, :hook_type, :title, :description, :prefetch, :usage_requirements, true
            )
            ON CONFLICT (id) DO NOTHING
        """), {
            "id": hook["id"],
            "hook_type": hook["hook_type"],
            "title": hook["title"],
            "description": hook["description"],
            "prefetch": hook["prefetch"],
            "usage_requirements": hook["usage_requirements"]
        })
    
    await db.commit()
    logger.info("Default data inserted successfully")


async def create_functions_and_triggers(db: AsyncSession):
    """Create useful functions and triggers for CDS Hooks v2.0"""
    
    logger.info("Creating functions and triggers...")
    
    # Function to update analytics summary
    await db.execute(text("""
        CREATE OR REPLACE FUNCTION update_analytics_summary_v2()
        RETURNS TRIGGER AS $$
        BEGIN
            -- Update daily analytics when new execution is recorded
            INSERT INTO cds.analytics_summary_v2 (
                service_id, date, executions_count, cards_shown, system_actions_applied
            ) VALUES (
                NEW.service_id, 
                DATE(NEW.created_at), 
                1, 
                NEW.cards_returned,
                NEW.system_actions_count
            )
            ON CONFLICT (service_id, date) DO UPDATE SET
                executions_count = cds.analytics_summary_v2.executions_count + 1,
                cards_shown = cds.analytics_summary_v2.cards_shown + NEW.cards_returned,
                system_actions_applied = cds.analytics_summary_v2.system_actions_applied + NEW.system_actions_count;
            
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """))
    
    # Trigger for analytics updates
    await db.execute(text("""
        DROP TRIGGER IF EXISTS analytics_update_trigger_v2 ON cds.hook_executions_v2;
        CREATE TRIGGER analytics_update_trigger_v2
            AFTER INSERT ON cds.hook_executions_v2
            FOR EACH ROW EXECUTE FUNCTION update_analytics_summary_v2();
    """))
    
    # Function to update feedback analytics
    await db.execute(text("""
        CREATE OR REPLACE FUNCTION update_feedback_analytics_v2()
        RETURNS TRIGGER AS $$
        BEGIN
            -- Update analytics when feedback is received
            UPDATE cds.analytics_summary_v2 SET
                cards_accepted = cards_accepted + CASE WHEN NEW.outcome = 'accepted' THEN 1 ELSE 0 END,
                cards_overridden = cards_overridden + CASE WHEN NEW.outcome = 'overridden' THEN 1 ELSE 0 END
            WHERE service_id = NEW.service_id 
            AND date = DATE(NEW.outcome_timestamp);
            
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """))
    
    # Trigger for feedback analytics
    await db.execute(text("""
        DROP TRIGGER IF EXISTS feedback_analytics_trigger_v2 ON cds.feedback_v2;
        CREATE TRIGGER feedback_analytics_trigger_v2
            AFTER INSERT ON cds.feedback_v2
            FOR EACH ROW EXECUTE FUNCTION update_feedback_analytics_v2();
    """))
    
    await db.commit()
    logger.info("Functions and triggers created successfully")


async def main():
    """Main initialization function"""
    # Create async engine
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    # Create async session
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    try:
        async with async_session() as session:
            # Create schema
            await create_cds_hooks_v2_schema(session)
            
            # Insert default data
            await insert_default_data(session)
            
            # Create functions and triggers
            await create_functions_and_triggers(session)
            
            logger.info("CDS Hooks v2.0 database initialization completed successfully!")
            
    except Exception as e:
        logger.error(f"Error during initialization: {e}")
        raise
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())