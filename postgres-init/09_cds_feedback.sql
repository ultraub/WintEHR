-- ========================================================================
-- CDS Hooks Feedback Tables
-- ========================================================================
-- Creates feedback and feedback_analytics tables in the cds_hooks schema
-- for tracking CDS card acceptance/override/ignore outcomes.
-- ========================================================================

\echo 'Creating CDS Hooks feedback tables...'

-- Ensure schema exists (should already be created by 01-init-wintehr.sql)
CREATE SCHEMA IF NOT EXISTS cds_hooks;

-- ========================================================================
-- Feedback Table
-- ========================================================================
-- Stores individual feedback events for CDS cards (accepted, overridden, ignored)

CREATE TABLE IF NOT EXISTS cds_hooks.feedback (
    id BIGSERIAL PRIMARY KEY,
    feedback_id VARCHAR(255) NOT NULL UNIQUE,
    hook_instance_id VARCHAR(255),
    service_id VARCHAR(255) NOT NULL,
    card_uuid VARCHAR(255) NOT NULL,
    outcome VARCHAR(50) NOT NULL CHECK (outcome IN ('accepted', 'overridden', 'ignored')),
    override_reason TEXT,
    accepted_suggestions TEXT,
    user_id VARCHAR(255),
    patient_id VARCHAR(255),
    encounter_id VARCHAR(255),
    context JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================================
-- Feedback Analytics Table
-- ========================================================================
-- Aggregated analytics per service per time period (hourly buckets)

CREATE TABLE IF NOT EXISTS cds_hooks.feedback_analytics (
    id BIGSERIAL PRIMARY KEY,
    service_id VARCHAR(255) NOT NULL,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    total_cards INTEGER DEFAULT 0,
    accepted_count INTEGER DEFAULT 0,
    overridden_count INTEGER DEFAULT 0,
    ignored_count INTEGER DEFAULT 0,
    acceptance_rate NUMERIC(5,2) DEFAULT 0,
    common_override_reasons JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (service_id, period_start, period_end)
);

-- ========================================================================
-- Indexes
-- ========================================================================

\echo 'Creating feedback indexes...'

-- Feedback table indexes
CREATE INDEX IF NOT EXISTS idx_cds_feedback_service ON cds_hooks.feedback(service_id);
CREATE INDEX IF NOT EXISTS idx_cds_feedback_patient ON cds_hooks.feedback(patient_id);
CREATE INDEX IF NOT EXISTS idx_cds_feedback_user ON cds_hooks.feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_cds_feedback_outcome ON cds_hooks.feedback(outcome);
CREATE INDEX IF NOT EXISTS idx_cds_feedback_created ON cds_hooks.feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_cds_feedback_card ON cds_hooks.feedback(card_uuid);

-- Feedback analytics indexes
CREATE INDEX IF NOT EXISTS idx_cds_feedback_analytics_service ON cds_hooks.feedback_analytics(service_id);
CREATE INDEX IF NOT EXISTS idx_cds_feedback_analytics_period ON cds_hooks.feedback_analytics(period_start, period_end);

-- ========================================================================
-- Grants
-- ========================================================================

\echo 'Granting permissions on feedback tables...'

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cds_hooks TO emr_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA cds_hooks TO emr_user;

-- ========================================================================
-- Verification
-- ========================================================================

\echo 'Verifying CDS feedback tables...'

DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'cds_hooks'
    AND table_name IN ('feedback', 'feedback_analytics');

    IF table_count = 2 THEN
        RAISE NOTICE 'CDS feedback tables created successfully (2/2)';
    ELSE
        RAISE WARNING 'Expected 2 feedback tables, found %', table_count;
    END IF;
END $$;

\echo 'CDS feedback table initialization complete.'
