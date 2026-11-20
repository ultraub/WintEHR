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
