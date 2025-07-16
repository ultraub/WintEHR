#\!/bin/bash
# Complete initialization script for WintEHR with all features

set -e  # Exit on error

echo "🚀 WintEHR Complete System Initialization"
echo "==========================================="

# Database initialization with proper permissions
echo -e "\n🗄️  Initializing database..."
PGPASSWORD=emr_password psql -h localhost -p 5432 -U emr_user -d emr_db <<SQL
-- Create FHIR schema if not exists
CREATE SCHEMA IF NOT EXISTS fhir;

-- Add deleted column to resources if missing
DO \$\$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'fhir' 
        AND table_name = 'resources' 
        AND column_name = 'deleted'
    ) THEN
        ALTER TABLE fhir.resources ADD COLUMN deleted BOOLEAN DEFAULT FALSE;
    END IF;
END\$\$;

-- Create search_params table if not exists
CREATE TABLE IF NOT EXISTS fhir.search_params (
    id SERIAL PRIMARY KEY,
    resource_id UUID NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    param_name VARCHAR(100) NOT NULL,
    param_type VARCHAR(20) NOT NULL,
    value_string TEXT,
    value_token VARCHAR(500),
    value_reference VARCHAR(500),
    value_date TIMESTAMP,
    value_number NUMERIC,
    value_quantity_value NUMERIC,
    value_quantity_unit VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resource_id) REFERENCES fhir.resources(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_search_params_resource ON fhir.search_params(resource_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_search_params_token ON fhir.search_params(param_name, value_token) WHERE value_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_search_params_reference ON fhir.search_params(param_name, value_reference) WHERE value_reference IS NOT NULL;

-- Create resource_history table for tracking FHIR resource changes
CREATE TABLE IF NOT EXISTS fhir.resource_history (
    id SERIAL PRIMARY KEY,
    resource_id INTEGER NOT NULL,
    version_id INTEGER NOT NULL,
    operation VARCHAR(20) NOT NULL, -- 'create', 'update', 'delete'
    resource JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key to resources table
    CONSTRAINT fk_resource_history_resource 
        FOREIGN KEY (resource_id) 
        REFERENCES fhir.resources(id) 
        ON DELETE CASCADE,
    
    -- Index for efficient queries
    CONSTRAINT idx_resource_history_unique 
        UNIQUE (resource_id, version_id)
);

-- Create indexes for resource_history
CREATE INDEX IF NOT EXISTS idx_resource_history_resource_id ON fhir.resource_history(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_history_created_at ON fhir.resource_history(created_at);
CREATE INDEX IF NOT EXISTS idx_resource_history_operation ON fhir.resource_history(operation);

-- Create CDS Hooks schema
CREATE SCHEMA IF NOT EXISTS cds_hooks;

-- Show table counts
SELECT 'Resources table count: ' || COUNT(*) FROM fhir.resources WHERE deleted = FALSE OR deleted IS NULL;
SELECT 'Search params count: ' || COUNT(*) FROM fhir.search_params;
SELECT 'Resource history count: ' || COUNT(*) FROM fhir.resource_history;
SQL

echo "✅ Database initialized"

# Clean and generate fresh data
echo -e "\n🧹 Cleaning existing data..."
rm -rf ../synthea/output/fhir/*.json 2>/dev/null || true
rm -rf data/generated_dicoms/* 2>/dev/null || true

echo -e "\n🏥 Running full Synthea workflow with 20 patients..."
python scripts/synthea_master.py full --count 20 --include-dicom

# Enhance lab results
echo -e "\n🧪 Enhancing lab results with reference ranges..."
python scripts/enhance_lab_results.py

# Clean patient and provider names
echo -e "\n🏷️  Cleaning patient and provider names..."
python scripts/clean_fhir_names.py

echo -e "\n✅ Complete initialization finished\!"
