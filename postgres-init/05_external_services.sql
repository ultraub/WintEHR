-- External Services Management Tables
-- Purpose: Track external FHIR services registered with WintEHR
-- Version: 1.0
-- Last Updated: 2025-10-18

-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS external_services;

-- External Services Registry
CREATE TABLE IF NOT EXISTS external_services.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    service_type VARCHAR(50) NOT NULL,  -- 'cds_hooks', 'subscription', 'cql_library', 'smart_app'

    -- FHIR Resource linkage (services are represented as FHIR resources in HAPI)
    fhir_resource_type VARCHAR(50),  -- 'PlanDefinition', 'Subscription', 'Library', etc.
    fhir_resource_id VARCHAR(255),   -- ID of resource in HAPI FHIR

    -- Service endpoints
    base_url TEXT,
    discovery_endpoint TEXT,  -- For CDS Hooks
    webhook_url TEXT,  -- For subscriptions

    -- Authentication
    auth_type VARCHAR(50) DEFAULT 'none',  -- 'none', 'api_key', 'oauth2', 'hmac'
    credentials_encrypted TEXT,  -- Encrypted JSON with auth credentials

    -- Service status
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'active', 'inactive', 'suspended', 'error'
    health_status VARCHAR(20) DEFAULT 'unknown',  -- 'unknown', 'healthy', 'degraded', 'unhealthy'
    last_health_check TIMESTAMP,
    health_check_interval_seconds INTEGER DEFAULT 300,  -- 5 minutes

    -- Failure tracking (for auto-disable logic)
    consecutive_failures INTEGER DEFAULT 0,  -- Track consecutive execution failures
    last_failure_at TIMESTAMP,  -- Timestamp of last failure
    auto_disabled BOOLEAN DEFAULT FALSE,  -- Auto-disabled after consecutive failures threshold
    auto_disabled_at TIMESTAMP,  -- When service was auto-disabled
    last_error_message TEXT,  -- Last error message for debugging

    -- Metadata
    owner_user_id VARCHAR(255),  -- Who registered this service
    tags TEXT[],  -- For categorization
    version VARCHAR(50),

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,

    -- Constraints
    CONSTRAINT valid_service_type CHECK (service_type IN ('cds_hooks', 'subscription', 'cql_library', 'smart_app')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'active', 'inactive', 'suspended', 'error')),
    CONSTRAINT valid_health_status CHECK (health_status IN ('unknown', 'healthy', 'degraded', 'unhealthy')),
    CONSTRAINT valid_auth_type CHECK (auth_type IN ('none', 'api_key', 'oauth2', 'hmac'))
);

-- External Service Configurations (type-specific details)
CREATE TABLE IF NOT EXISTS external_services.service_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES external_services.services(id) ON DELETE CASCADE,
    config_key VARCHAR(100) NOT NULL,
    config_value JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(service_id, config_key)
);

-- CDS Hooks specific configuration
CREATE TABLE IF NOT EXISTS external_services.cds_hooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES external_services.services(id) ON DELETE CASCADE,
    hook_type VARCHAR(100) NOT NULL,  -- 'patient-view', 'medication-prescribe', etc.
    hook_service_id VARCHAR(255) NOT NULL,  -- The CDS service ID
    title VARCHAR(255),
    description TEXT,
    prefetch_template JSONB,  -- FHIR query templates
    usage_requirements TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(service_id, hook_service_id)
);

-- SMART App specific configuration
CREATE TABLE IF NOT EXISTS external_services.smart_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES external_services.services(id) ON DELETE CASCADE,
    client_id VARCHAR(255) NOT NULL UNIQUE,
    client_secret_encrypted TEXT,  -- Encrypted OAuth client secret
    redirect_uris TEXT[],
    scopes TEXT[],  -- Requested FHIR scopes
    launch_uri TEXT,
    logo_uri TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscription specific configuration
CREATE TABLE IF NOT EXISTS external_services.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES external_services.services(id) ON DELETE CASCADE,
    subscription_topic VARCHAR(255),  -- SubscriptionTopic canonical URL
    criteria TEXT,  -- FHIR search criteria
    channel_type VARCHAR(50) DEFAULT 'rest-hook',  -- 'rest-hook', 'websocket', etc.
    payload_type VARCHAR(50) DEFAULT 'id-only',  -- 'id-only', 'full-resource'
    hmac_secret_encrypted TEXT,  -- For webhook signature
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_channel_type CHECK (channel_type IN ('rest-hook', 'websocket', 'email', 'sms')),
    CONSTRAINT valid_payload_type CHECK (payload_type IN ('empty', 'id-only', 'full-resource'))
);

-- External Service Execution Log
CREATE TABLE IF NOT EXISTS external_services.executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES external_services.services(id) ON DELETE CASCADE,
    execution_type VARCHAR(50),  -- 'cds_hook', 'subscription_notification', 'health_check'

    -- Request/Response
    request_payload JSONB,
    response_payload JSONB,

    -- Performance
    execution_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    response_time_ms INTEGER,

    -- Status
    success BOOLEAN,
    error_message TEXT,
    error_code VARCHAR(50),
    http_status_code INTEGER,

    -- Context
    patient_id VARCHAR(255),  -- If applicable
    user_id VARCHAR(255),  -- If applicable
    encounter_id VARCHAR(255),  -- If applicable

    -- Indexes will be added below
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- External Service Analytics
CREATE TABLE IF NOT EXISTS external_services.analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES external_services.services(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,

    -- Usage metrics
    total_executions INTEGER DEFAULT 0,
    successful_executions INTEGER DEFAULT 0,
    failed_executions INTEGER DEFAULT 0,

    -- Performance metrics
    avg_response_time_ms NUMERIC(10,2),
    min_response_time_ms INTEGER,
    max_response_time_ms INTEGER,
    p95_response_time_ms INTEGER,

    -- Error analysis
    timeout_count INTEGER DEFAULT 0,
    error_4xx_count INTEGER DEFAULT 0,
    error_5xx_count INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(service_id, metric_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_services_type ON external_services.services(service_type);
CREATE INDEX IF NOT EXISTS idx_services_status ON external_services.services(status);
CREATE INDEX IF NOT EXISTS idx_services_health ON external_services.services(health_status);
CREATE INDEX IF NOT EXISTS idx_services_fhir_resource ON external_services.services(fhir_resource_type, fhir_resource_id);

CREATE INDEX IF NOT EXISTS idx_cds_hooks_type ON external_services.cds_hooks(hook_type);
CREATE INDEX IF NOT EXISTS idx_cds_hooks_service ON external_services.cds_hooks(service_id);

CREATE INDEX IF NOT EXISTS idx_executions_service ON external_services.executions(service_id);
CREATE INDEX IF NOT EXISTS idx_executions_time ON external_services.executions(execution_time);
CREATE INDEX IF NOT EXISTS idx_executions_success ON external_services.executions(success);
CREATE INDEX IF NOT EXISTS idx_executions_patient ON external_services.executions(patient_id) WHERE patient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_service_date ON external_services.analytics(service_id, metric_date);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION external_services.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON external_services.services
    FOR EACH ROW EXECUTE FUNCTION external_services.update_updated_at_column();

-- Grant permissions (adjust as needed for your user)
GRANT USAGE ON SCHEMA external_services TO emr_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA external_services TO emr_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA external_services TO emr_user;

-- Insert sample data for testing (commented out for production)
-- INSERT INTO external_services.services (name, service_type, status) VALUES
-- ('Example CDS Service', 'cds_hooks', 'pending'),
-- ('Example SMART App', 'smart_app', 'pending');

COMMENT ON SCHEMA external_services IS 'External FHIR service registration and management';
COMMENT ON TABLE external_services.services IS 'Registry of external FHIR services integrated with WintEHR';
COMMENT ON TABLE external_services.executions IS 'Execution log for monitoring external service performance';
COMMENT ON TABLE external_services.analytics IS 'Daily aggregated analytics for external services';
