-- Migration: Add failure tracking columns to external services
-- Version: 001
-- Date: 2025-10-18
-- Purpose: Enable auto-disable logic for failing external services

-- Add failure tracking columns to services table
ALTER TABLE external_services.services
ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_failure_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS auto_disabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_disabled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_error_message TEXT;

-- Add index for auto_disabled column (used in filtering)
CREATE INDEX IF NOT EXISTS idx_services_auto_disabled ON external_services.services(auto_disabled) WHERE auto_disabled = TRUE;

-- Add comment explaining purpose
COMMENT ON COLUMN external_services.services.consecutive_failures IS 'Count of consecutive execution failures for auto-disable logic';
COMMENT ON COLUMN external_services.services.auto_disabled IS 'Service automatically disabled after exceeding failure threshold';
COMMENT ON COLUMN external_services.services.auto_disabled_at IS 'Timestamp when service was auto-disabled';
COMMENT ON COLUMN external_services.services.last_error_message IS 'Last execution error message for debugging';

-- Migration complete
SELECT 'Migration 001: Failure tracking columns added successfully' AS result;
