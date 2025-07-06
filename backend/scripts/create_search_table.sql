-- Create FHIR search parameters table
-- Run this SQL script to create the missing search_params table

-- Create fhir schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS fhir;

-- Check if search_params table exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'fhir' 
        AND table_name = 'search_params'
    ) THEN
        -- Create search_params table
        CREATE TABLE fhir.search_params (
            id BIGSERIAL PRIMARY KEY,
            resource_id BIGINT NOT NULL,
            param_name VARCHAR(255) NOT NULL,
            param_type VARCHAR(50) NOT NULL,
            value_string TEXT,
            value_number DECIMAL,
            value_date TIMESTAMP WITH TIME ZONE,
            value_token_system VARCHAR(255),
            value_token_code VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            
            -- Foreign key to resources table
            CONSTRAINT fk_search_params_resource 
                FOREIGN KEY (resource_id) 
                REFERENCES fhir.resources(id) 
                ON DELETE CASCADE
        );
        
        RAISE NOTICE 'Created fhir.search_params table';
        
        -- Create indexes for better search performance
        CREATE INDEX idx_search_params_resource_id ON fhir.search_params (resource_id);
        CREATE INDEX idx_search_params_param_name ON fhir.search_params (param_name);
        CREATE INDEX idx_search_params_param_type ON fhir.search_params (param_type);
        CREATE INDEX idx_search_params_value_string ON fhir.search_params (value_string);
        CREATE INDEX idx_search_params_token_code ON fhir.search_params (value_token_code);
        
        -- Create composite indexes for common search patterns
        CREATE INDEX idx_search_params_patient_lookup 
            ON fhir.search_params (param_name, value_string) 
            WHERE param_name IN ('patient', 'subject');
            
        CREATE INDEX idx_search_params_token_lookup 
            ON fhir.search_params (param_name, value_token_system, value_token_code) 
            WHERE param_type = 'token';
        
        RAISE NOTICE 'Created search parameter indexes';
        
    ELSE
        RAISE NOTICE 'fhir.search_params table already exists';
    END IF;
END
$$;

-- Show table info
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'fhir' 
AND tablename = 'search_params';

-- Show current record count
SELECT COUNT(*) as search_param_count FROM fhir.search_params;