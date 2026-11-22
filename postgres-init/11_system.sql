-- Command Center system settings (docs/COMMAND_CENTER.md, slice 2)
-- Purpose: overrides for the settings the Command Center manages. The
-- settings themselves (key, type, default, tier, which env var they shadow)
-- are DEFINED in code — backend/api/command_center/settings_registry.py —
-- this table only stores the values an admin has changed.
--
-- Runs on first Postgres start. Existing deployments get the same DDL from
-- SqlSettingsRepository.ensure_schema() at the backend's first settings
-- access, so no manual migration is needed; both are idempotent.

CREATE SCHEMA IF NOT EXISTS system;

CREATE TABLE IF NOT EXISTS system.settings (
    key         TEXT PRIMARY KEY,           -- e.g. system.patient_count_cap
    value       TEXT NOT NULL,              -- JSON for plain values; Fernet ciphertext for secrets
    is_secret   BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by  TEXT,                       -- User.id of the admin who set it
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE system.settings IS
    'Command Center setting overrides. Definitions live in backend/api/command_center/settings_registry.py.';

-- Command Center jobs (docs/COMMAND_CENTER.md, slice 3): long-running admin
-- tasks (Synthea load, terminology load, DICOM generation) run as
-- subprocesses inside emr-backend. Rows are the source of truth across the
-- uvicorn workers; the log lives at log_path under /app/data/jobs.
-- The same DDL is applied idempotently by SqlJobsRepository.ensure_schema().

CREATE TABLE IF NOT EXISTS system.jobs (
    id                TEXT PRIMARY KEY,
    kind              TEXT NOT NULL,                 -- key in jobs_registry.py
    params            TEXT NOT NULL DEFAULT '{}',    -- JSON
    status            TEXT NOT NULL,                 -- queued|running|succeeded|failed|cancelled|lost
    progress          DOUBLE PRECISION,              -- 0..1 when the kind reports it
    message           TEXT,                          -- last human-readable status line
    started_by        TEXT,                          -- User.id
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at        TIMESTAMPTZ,
    finished_at       TIMESTAMPTZ,
    heartbeat_at      TIMESTAMPTZ,                   -- bumped by the running worker
    cancel_requested  BOOLEAN NOT NULL DEFAULT FALSE,
    exit_code         INTEGER,
    log_path          TEXT,
    worker            TEXT                           -- hostname:pid of the worker running it
);

-- One job at a time per deployment: the insert of a second queued/running
-- job fails on this index, which is how the service answers 409 atomically.
CREATE UNIQUE INDEX IF NOT EXISTS system_jobs_one_active
    ON system.jobs ((TRUE)) WHERE status IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS system_jobs_created_at ON system.jobs (created_at DESC);

-- Command Center health history (docs/COMMAND_CENTER.md, slice 17): one row per
-- status report (on request or from the sampler), pruned after
-- COMMAND_CENTER_HISTORY_DAYS (7). Same DDL applied idempotently by
-- SqlStatusHistoryRepository.ensure_schema().

CREATE TABLE IF NOT EXISTS system.status_history (
    id          BIGSERIAL PRIMARY KEY,
    checked_at  TIMESTAMPTZ NOT NULL,
    overall     TEXT NOT NULL,                 -- ok|degraded|down
    components  TEXT NOT NULL,                 -- JSON: {component: ok|degraded|down|absent}
    source      TEXT NOT NULL DEFAULT 'request' -- request|sampler
);

CREATE INDEX IF NOT EXISTS system_status_history_checked_at ON system.status_history (checked_at DESC);
