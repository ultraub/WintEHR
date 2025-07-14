"""
Add FHIR authentication fields to Provider table
"""

from sqlalchemy import create_engine, Column, String, Boolean, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os
import logging


# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost/wintehr")

Base = declarative_base()

def add_fhir_auth_columns():
    """Add FHIR authentication columns to existing tables"""
    
    engine = create_engine(DATABASE_URL)
    
    # SQL to add columns if they don't exist
    add_columns_sql = """
    -- Add FHIR authentication fields to providers table
    DO $$ 
    BEGIN
        -- Add FHIR resource version tracking
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='providers' AND column_name='fhir_version_id') THEN
            ALTER TABLE providers ADD COLUMN fhir_version_id VARCHAR(50) DEFAULT '1';
        END IF;
        
        -- Add last FHIR update timestamp
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='providers' AND column_name='fhir_last_updated') THEN
            ALTER TABLE providers ADD COLUMN fhir_last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        END IF;
        
        -- Add FHIR identifiers JSON field for additional identifiers
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='providers' AND column_name='fhir_identifiers') THEN
            ALTER TABLE providers ADD COLUMN fhir_identifiers JSON;
        END IF;
        
        -- Add qualifications JSON field
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='providers' AND column_name='qualifications') THEN
            ALTER TABLE providers ADD COLUMN qualifications JSON;
        END IF;
        
        -- Add communication languages
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='providers' AND column_name='languages') THEN
            ALTER TABLE providers ADD COLUMN languages JSON DEFAULT '["en"]'::json;
        END IF;
        
        -- Add photo URL
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='providers' AND column_name='photo_url') THEN
            ALTER TABLE providers ADD COLUMN photo_url VARCHAR(500);
        END IF;
    END $$;
    
    -- Add indexes for FHIR queries
    CREATE INDEX IF NOT EXISTS idx_providers_fhir_last_updated ON providers(fhir_last_updated);
    CREATE INDEX IF NOT EXISTS idx_providers_active ON providers(active);
    
    -- Create FHIR audit log table
    CREATE TABLE IF NOT EXISTS fhir_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type VARCHAR(50) NOT NULL,
        event_subtype VARCHAR(50),
        event_action VARCHAR(20) NOT NULL,
        event_datetime TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        event_outcome VARCHAR(20) NOT NULL,
        
        -- Who performed the action
        agent_type VARCHAR(50),
        agent_id VARCHAR(255),
        agent_name VARCHAR(255),
        agent_requestor BOOLEAN DEFAULT true,
        
        -- What was accessed
        entity_type VARCHAR(50),
        entity_id VARCHAR(255),
        entity_name VARCHAR(255),
        entity_description TEXT,
        
        -- Additional context
        source_observer VARCHAR(255),
        source_type VARCHAR(50),
        patient_id VARCHAR(255),
        encounter_id VARCHAR(255),
        
        -- Request details
        request_method VARCHAR(10),
        request_url TEXT,
        request_headers JSON,
        response_status INTEGER,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_fhir_audit_event_datetime ON fhir_audit_log(event_datetime);
    CREATE INDEX IF NOT EXISTS idx_fhir_audit_agent_id ON fhir_audit_log(agent_id);
    CREATE INDEX IF NOT EXISTS idx_fhir_audit_patient_id ON fhir_audit_log(patient_id);
    CREATE INDEX IF NOT EXISTS idx_fhir_audit_entity_id ON fhir_audit_log(entity_id);
    
    -- Create FHIR person link table (maps different roles to same person)
    CREATE TABLE IF NOT EXISTS fhir_person_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        person_id VARCHAR(255) NOT NULL,
        target_type VARCHAR(50) NOT NULL, -- 'Practitioner', 'Patient', 'RelatedPerson'
        target_id VARCHAR(255) NOT NULL,
        assurance_level VARCHAR(20) DEFAULT 'level3', -- level1, level2, level3, level4
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(person_id, target_type, target_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_fhir_person_links_person ON fhir_person_links(person_id);
    CREATE INDEX IF NOT EXISTS idx_fhir_person_links_target ON fhir_person_links(target_type, target_id);
    """
    
    # Execute the migration
    with engine.connect() as conn:
        conn.execute(add_columns_sql)
        conn.commit()
    
    logging.info("FHIR authentication fields added successfully")
if __name__ == "__main__":
    add_fhir_auth_columns()