-- Optimize search_params table for faster indexing and querying

-- Create indexes for faster DELETE operations during re-indexing
CREATE INDEX IF NOT EXISTS idx_search_params_resource_id 
ON fhir.search_params(resource_id);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_search_params_resource_type_param 
ON fhir.search_params(resource_type, param_name);

-- Create index for token searches (most common)
CREATE INDEX IF NOT EXISTS idx_search_params_token_search 
ON fhir.search_params(param_name, value_token_code) 
WHERE param_type = 'token';

-- Create index for reference searches
CREATE INDEX IF NOT EXISTS idx_search_params_reference_search 
ON fhir.search_params(param_name, value_reference) 
WHERE param_type = 'reference';

-- Create index for string searches
CREATE INDEX IF NOT EXISTS idx_search_params_string_search 
ON fhir.search_params(param_name, value_string) 
WHERE param_type = 'string';

-- Analyze the table to update statistics
ANALYZE fhir.search_params;