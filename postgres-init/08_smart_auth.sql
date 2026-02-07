-- SMART on FHIR Authorization Tables
-- Purpose: Persist SMART authorization sessions, tokens, and app registrations
-- Version: 1.0
-- Last Updated: 2025-01-01
--
-- Educational Note:
-- These tables support the SMART on FHIR App Launch authorization flow.
-- In the current implementation, sessions are stored in-memory for simplicity.
-- For production use, switch to using these database tables.

-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS smart_auth;

-- ============================================================
-- SMART App Registration
-- ============================================================
-- Stores registered SMART applications that can authorize against this server

CREATE TABLE IF NOT EXISTS smart_auth.registered_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- OAuth2 Configuration
    client_type VARCHAR(20) NOT NULL DEFAULT 'public',  -- 'public' or 'confidential'
    client_secret_hash VARCHAR(255),  -- Hashed secret for confidential clients
    redirect_uris TEXT[] NOT NULL,  -- Array of allowed redirect URIs
    scopes TEXT[] NOT NULL,  -- Array of allowed scopes

    -- SMART Configuration
    launch_uri TEXT,  -- App's launch endpoint
    logo_uri TEXT,  -- App logo for consent screen

    -- Contact Information
    tos_uri TEXT,  -- Terms of service
    policy_uri TEXT,  -- Privacy policy
    contacts TEXT[],  -- Contact emails

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    approved_by VARCHAR(255),  -- User who approved this app
    approved_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT valid_client_type CHECK (client_type IN ('public', 'confidential'))
);

-- Index for fast client_id lookup
CREATE INDEX IF NOT EXISTS idx_smart_apps_client_id ON smart_auth.registered_apps(client_id);


-- ============================================================
-- Authorization Sessions
-- ============================================================
-- Tracks in-progress authorization flows

CREATE TABLE IF NOT EXISTS smart_auth.authorization_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL UNIQUE,

    -- OAuth2 Request Parameters
    client_id VARCHAR(255) NOT NULL REFERENCES smart_auth.registered_apps(client_id),
    redirect_uri TEXT NOT NULL,
    scope TEXT NOT NULL,  -- Space-separated scopes
    state VARCHAR(255) NOT NULL,
    response_type VARCHAR(20) NOT NULL DEFAULT 'code',

    -- PKCE (Proof Key for Code Exchange)
    code_challenge VARCHAR(255),
    code_challenge_method VARCHAR(10),  -- Should be 'S256'

    -- Launch Context
    launch_token VARCHAR(255),  -- EHR launch token if EHR launch
    patient_id VARCHAR(255),  -- Patient in context
    encounter_id VARCHAR(255),  -- Encounter in context
    user_id VARCHAR(255),  -- User who authorized

    -- Authorization Code
    authorization_code VARCHAR(255) UNIQUE,
    code_expires_at TIMESTAMP,

    -- Session State
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'authorized', 'completed', 'denied', 'expired'

    -- Educational Flow Tracking
    flow_steps JSONB DEFAULT '[]'::jsonb,  -- Array of flow steps for visualization

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    authorized_at TIMESTAMP,
    completed_at TIMESTAMP,

    -- Session expires after 1 hour
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 hour'),

    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('pending', 'authorized', 'completed', 'denied', 'expired'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_smart_sessions_code ON smart_auth.authorization_sessions(authorization_code);
CREATE INDEX IF NOT EXISTS idx_smart_sessions_status ON smart_auth.authorization_sessions(status);
CREATE INDEX IF NOT EXISTS idx_smart_sessions_expires ON smart_auth.authorization_sessions(expires_at);


-- ============================================================
-- Access Tokens
-- ============================================================
-- Tracks issued access tokens for revocation and auditing

CREATE TABLE IF NOT EXISTS smart_auth.access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Token Identification
    jti VARCHAR(255) NOT NULL UNIQUE,  -- JWT ID (for revocation)

    -- Token Metadata
    session_id UUID REFERENCES smart_auth.authorization_sessions(id),
    client_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255),
    patient_id VARCHAR(255),
    scope TEXT NOT NULL,

    -- Token Lifecycle
    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    revoked_by VARCHAR(255),
    revocation_reason TEXT,

    -- Status
    is_revoked BOOLEAN DEFAULT FALSE,

    -- Auditing
    created_from_ip VARCHAR(45),  -- IPv4 or IPv6
    user_agent TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_smart_tokens_jti ON smart_auth.access_tokens(jti);
CREATE INDEX IF NOT EXISTS idx_smart_tokens_client ON smart_auth.access_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_smart_tokens_user ON smart_auth.access_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_tokens_expires ON smart_auth.access_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_smart_tokens_revoked ON smart_auth.access_tokens(is_revoked) WHERE is_revoked = TRUE;


-- ============================================================
-- Refresh Tokens
-- ============================================================
-- Stores refresh tokens (hashed) for token refresh

CREATE TABLE IF NOT EXISTS smart_auth.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Token Identification (store hash, not the actual token)
    token_hash VARCHAR(255) NOT NULL UNIQUE,

    -- Token Metadata
    session_id UUID REFERENCES smart_auth.authorization_sessions(id),
    client_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255),
    patient_id VARCHAR(255),
    scope TEXT NOT NULL,

    -- Token Lifecycle
    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP,

    -- Revocation
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP,
    revoked_by VARCHAR(255),

    -- Usage tracking
    use_count INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_smart_refresh_hash ON smart_auth.refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_smart_refresh_expires ON smart_auth.refresh_tokens(expires_at);


-- ============================================================
-- Launch Contexts
-- ============================================================
-- Stores EHR launch contexts (short-lived)

CREATE TABLE IF NOT EXISTS smart_auth.launch_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    launch_id VARCHAR(255) NOT NULL UNIQUE,

    -- Context
    app_client_id VARCHAR(255) NOT NULL,
    patient_id VARCHAR(255) NOT NULL,
    encounter_id VARCHAR(255),
    user_id VARCHAR(255),
    intent VARCHAR(255),  -- e.g., 'reconcile-medications'

    -- Lifecycle (launch contexts are short-lived)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '5 minutes'),
    used_at TIMESTAMP,
    is_used BOOLEAN DEFAULT FALSE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_smart_launch_id ON smart_auth.launch_contexts(launch_id);
CREATE INDEX IF NOT EXISTS idx_smart_launch_expires ON smart_auth.launch_contexts(expires_at);


-- ============================================================
-- User Grants (Consent Records)
-- ============================================================
-- Remembers what users have consented to (optional, for "remember this app")

CREATE TABLE IF NOT EXISTS smart_auth.user_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    client_id VARCHAR(255) NOT NULL REFERENCES smart_auth.registered_apps(client_id),

    -- What was granted
    granted_scopes TEXT[] NOT NULL,

    -- Context (if patient-specific consent)
    patient_id VARCHAR(255),

    -- Lifecycle
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,  -- NULL = never expires
    revoked_at TIMESTAMP,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Unique constraint: one grant per user+client+patient
    CONSTRAINT unique_user_grant UNIQUE (user_id, client_id, patient_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_smart_grants_user ON smart_auth.user_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_grants_client ON smart_auth.user_grants(client_id);


-- ============================================================
-- Audit Log
-- ============================================================
-- Tracks all authorization events for security auditing

CREATE TABLE IF NOT EXISTS smart_auth.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Event Details
    event_type VARCHAR(50) NOT NULL,  -- 'authorization_started', 'consent_granted', 'token_issued', 'token_revoked', etc.
    event_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Actors
    user_id VARCHAR(255),
    client_id VARCHAR(255),

    -- Context
    session_id UUID,
    patient_id VARCHAR(255),

    -- Event Data
    details JSONB,

    -- Request Metadata
    ip_address VARCHAR(45),
    user_agent TEXT,

    -- Outcome
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_smart_audit_type ON smart_auth.audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_smart_audit_timestamp ON smart_auth.audit_log(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_smart_audit_user ON smart_auth.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_audit_client ON smart_auth.audit_log(client_id);


-- ============================================================
-- Cleanup Functions
-- ============================================================

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION smart_auth.cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    UPDATE smart_auth.authorization_sessions
    SET status = 'expired'
    WHERE status = 'pending'
      AND expires_at < CURRENT_TIMESTAMP;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired launch contexts
CREATE OR REPLACE FUNCTION smart_auth.cleanup_expired_launches()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM smart_auth.launch_contexts
    WHERE expires_at < CURRENT_TIMESTAMP;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- Seed Data: Demo SMART Apps
-- ============================================================

INSERT INTO smart_auth.registered_apps (
    client_id, name, description, client_type,
    redirect_uris, scopes, launch_uri, logo_uri, is_active
) VALUES
(
    'growth-chart-app',
    'Growth Chart',
    'Pediatric growth chart visualization for tracking patient development',
    'public',
    ARRAY['http://localhost:9000/', 'http://localhost:9000/callback'],
    ARRAY['launch', 'launch/patient', 'patient/Patient.read', 'patient/Observation.read', 'openid', 'fhirUser'],
    'http://localhost:9000/launch.html',
    '/static/smart-apps/growth-chart.png',
    TRUE
),
(
    'demo-patient-viewer',
    'Patient Summary Viewer',
    'View comprehensive patient clinical summary including conditions, medications, and allergies',
    'public',
    ARRAY['http://localhost:3001/callback', 'http://localhost:3000/smart-callback'],
    ARRAY['launch', 'launch/patient', 'patient/Patient.read', 'patient/Observation.read',
          'patient/Condition.read', 'patient/MedicationRequest.read', 'patient/AllergyIntolerance.read',
          'openid', 'fhirUser'],
    'http://localhost:3001/launch',
    '/static/smart-apps/patient-viewer.png',
    TRUE
)
ON CONFLICT (client_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    redirect_uris = EXCLUDED.redirect_uris,
    scopes = EXCLUDED.scopes,
    launch_uri = EXCLUDED.launch_uri,
    updated_at = CURRENT_TIMESTAMP;


-- Grant permissions
GRANT USAGE ON SCHEMA smart_auth TO emr_user;
GRANT ALL ON ALL TABLES IN SCHEMA smart_auth TO emr_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA smart_auth TO emr_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA smart_auth TO emr_user;
