#!/usr/bin/env python3
"""
Setup FHIR storage tables in PostgreSQL
"""

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Database connection parameters
DB_PARAMS = {
    'host': 'localhost',
    'port': 5432,
    'database': 'emr_db',
    'user': 'emr_user',
    'password': 'emr_password'
}

def setup_fhir_storage():
    """Create FHIR storage schema and tables."""
    
    conn = psycopg2.connect(**DB_PARAMS)
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()
    
    print("🏗️  Setting up FHIR storage schema...")
    
    # Create FHIR schema
    cur.execute("""
        CREATE SCHEMA IF NOT EXISTS fhir;
    """)
    print("✅ Created FHIR schema")
    
    # Create main resources table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS fhir.resources (
            id SERIAL PRIMARY KEY,
            resource_type VARCHAR(50) NOT NULL,
            fhir_id VARCHAR(255) NOT NULL,
            version_id INTEGER NOT NULL DEFAULT 1,
            last_updated TIMESTAMP WITH TIME ZONE NOT NULL,
            resource JSONB NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(resource_type, fhir_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_resources_type ON fhir.resources(resource_type);
        CREATE INDEX IF NOT EXISTS idx_resources_fhir_id ON fhir.resources(fhir_id);
        CREATE INDEX IF NOT EXISTS idx_resources_type_id ON fhir.resources(resource_type, fhir_id);
        CREATE INDEX IF NOT EXISTS idx_resources_last_updated ON fhir.resources(last_updated);
        CREATE INDEX IF NOT EXISTS idx_resources_jsonb ON fhir.resources USING gin(resource);
    """)
    print("✅ Created resources table")
    
    # Create history table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS fhir.resource_history (
            id SERIAL PRIMARY KEY,
            resource_id INTEGER NOT NULL REFERENCES fhir.resources(id) ON DELETE CASCADE,
            version_id INTEGER NOT NULL,
            operation VARCHAR(20) NOT NULL,
            resource JSONB NOT NULL,
            modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            modified_by VARCHAR(255),
            UNIQUE(resource_id, version_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_history_resource_id ON fhir.resource_history(resource_id);
        CREATE INDEX IF NOT EXISTS idx_history_version ON fhir.resource_history(version_id);
        CREATE INDEX IF NOT EXISTS idx_history_modified ON fhir.resource_history(modified_at);
    """)
    print("✅ Created resource history table")
    
    # Create search parameters table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS fhir.search_parameters (
            id SERIAL PRIMARY KEY,
            resource_id INTEGER NOT NULL REFERENCES fhir.resources(id) ON DELETE CASCADE,
            parameter_name VARCHAR(100) NOT NULL,
            parameter_type VARCHAR(20) NOT NULL,
            value_string TEXT,
            value_number NUMERIC,
            value_date DATE,
            value_datetime TIMESTAMP WITH TIME ZONE,
            value_token VARCHAR(500),
            value_reference VARCHAR(500),
            value_quantity JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_search_params_resource ON fhir.search_parameters(resource_id);
        CREATE INDEX IF NOT EXISTS idx_search_params_name ON fhir.search_parameters(parameter_name);
        CREATE INDEX IF NOT EXISTS idx_search_params_string ON fhir.search_parameters(value_string);
        CREATE INDEX IF NOT EXISTS idx_search_params_number ON fhir.search_parameters(value_number);
        CREATE INDEX IF NOT EXISTS idx_search_params_date ON fhir.search_parameters(value_date);
        CREATE INDEX IF NOT EXISTS idx_search_params_datetime ON fhir.search_parameters(value_datetime);
        CREATE INDEX IF NOT EXISTS idx_search_params_token ON fhir.search_parameters(value_token);
        CREATE INDEX IF NOT EXISTS idx_search_params_reference ON fhir.search_parameters(value_reference);
    """)
    print("✅ Created search parameters table")
    
    # Create references table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS fhir.resource_references (
            id SERIAL PRIMARY KEY,
            source_id INTEGER NOT NULL REFERENCES fhir.resources(id) ON DELETE CASCADE,
            target_type VARCHAR(50) NOT NULL,
            target_id VARCHAR(255) NOT NULL,
            path VARCHAR(500) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_refs_source ON fhir.resource_references(source_id);
        CREATE INDEX IF NOT EXISTS idx_refs_target ON fhir.resource_references(target_type, target_id);
        CREATE INDEX IF NOT EXISTS idx_refs_path ON fhir.resource_references(path);
    """)
    print("✅ Created references table")
    
    # Grant permissions to emr_user
    cur.execute("""
        GRANT ALL ON SCHEMA fhir TO emr_user;
        GRANT ALL ON ALL TABLES IN SCHEMA fhir TO emr_user;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA fhir TO emr_user;
    """)
    print("✅ Granted permissions to emr_user")
    
    cur.close()
    conn.close()
    
    print("🎉 FHIR storage setup completed!")


if __name__ == "__main__":
    setup_fhir_storage()