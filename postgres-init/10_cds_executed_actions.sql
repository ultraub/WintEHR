-- ========================================================================
-- CDS Hooks Executed Actions (Idempotency Ledger)
-- ========================================================================
-- When a clinician accepts a CDS card suggestion, the backend executes the
-- suggestion's actions[] (create/update/delete FHIR resources). To stay
-- idempotent under double-clicks, retries, or duplicate feedback events,
-- we dedup on (hook_instance_id, suggestion_uuid) — a UNIQUE constraint
-- gives us "first-writer wins" for free.
--
-- Each row also records what was actually written so the UI / audit can
-- replay or inspect the side effect.
-- ========================================================================

\echo 'Creating CDS Hooks executed_actions table...'

CREATE SCHEMA IF NOT EXISTS cds_hooks;

CREATE TABLE IF NOT EXISTS cds_hooks.executed_actions (
    id BIGSERIAL PRIMARY KEY,

    -- Idempotency key: the same (hookInstance, suggestion) pair never
    -- executes twice. INSERT ... ON CONFLICT DO NOTHING short-circuits.
    hook_instance_id VARCHAR(255) NOT NULL,
    suggestion_uuid  VARCHAR(255) NOT NULL,

    -- Provenance
    service_id   VARCHAR(255) NOT NULL,
    card_uuid    VARCHAR(255),
    patient_id   VARCHAR(255),
    user_id      VARCHAR(255),

    -- What happened
    actions_count     INTEGER DEFAULT 0,
    resources_created JSONB   DEFAULT '[]'::jsonb,  -- [{resourceType, id}]
    success           BOOLEAN NOT NULL,
    error_message     TEXT,

    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (hook_instance_id, suggestion_uuid)
);

\echo 'Creating executed_actions indexes...'

CREATE INDEX IF NOT EXISTS idx_executed_actions_service
    ON cds_hooks.executed_actions(service_id);
CREATE INDEX IF NOT EXISTS idx_executed_actions_patient
    ON cds_hooks.executed_actions(patient_id);
CREATE INDEX IF NOT EXISTS idx_executed_actions_user
    ON cds_hooks.executed_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_executed_actions_executed_at
    ON cds_hooks.executed_actions(executed_at);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cds_hooks TO emr_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA cds_hooks TO emr_user;

\echo 'CDS Hooks executed_actions table ready.'
