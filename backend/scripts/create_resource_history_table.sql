-- Create resource_history table for tracking FHIR resource changes
-- This table is required for resource update operations

-- Create the table in the fhir schema
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_resource_history_resource_id 
    ON fhir.resource_history(resource_id);

CREATE INDEX IF NOT EXISTS idx_resource_history_created_at 
    ON fhir.resource_history(created_at);

CREATE INDEX IF NOT EXISTS idx_resource_history_operation 
    ON fhir.resource_history(operation);

-- Add comment to table
COMMENT ON TABLE fhir.resource_history IS 'History table for tracking changes to FHIR resources';
COMMENT ON COLUMN fhir.resource_history.resource_id IS 'Foreign key to fhir.resources table';
COMMENT ON COLUMN fhir.resource_history.version_id IS 'Version number of the resource';
COMMENT ON COLUMN fhir.resource_history.operation IS 'Type of operation: create, update, or delete';
COMMENT ON COLUMN fhir.resource_history.resource IS 'Full FHIR resource JSON at this version';
COMMENT ON COLUMN fhir.resource_history.created_at IS 'Timestamp when this version was created';