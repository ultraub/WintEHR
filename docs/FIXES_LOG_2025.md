# WintEHR Fixes Log 2025

This document consolidates all fixes applied to WintEHR in 2025.

## January 2025

### Dependency Fixes (2025-01-24)
- Fixed missing peer dependencies in frontend package.json
- Added @mui/x-date-pickers and dependencies
- Updated ClinicalWorkspace imports

### Encounter Notes Temporal Linking Fix (2025-01-27)
- Fixed temporal linking of DocumentReferences to Encounters
- Issue: Synthea-generated encounters use `actualPeriod` instead of `period`
- Solution: Updated code to check both fields
- Verified: 1476 encounters exist, all using `actualPeriod`

### CDS Override Reason Save Fix
- Fixed override reason configuration save functionality
- Moved from deprecated card-level to hook-level configuration
- Updated displayBehavior.acknowledgment.reasonRequired

### CDS Modal Display Fix
- Fixed modal display for CDS alerts
- Resolved override functionality
- Updated to use proper hook-level configuration

### WebSocket Integration (2025-08-03)
- Implemented complete WebSocket service with auto-reconnection
- Created websocket.js with exponential backoff
- Integrated with ClinicalWorkflowContext
- Added WebSocket status indicator

### Authentication Security (2025-08-03)
- Added audit logging for authentication events
- Implemented basic rate limiting (5 attempts per 15 minutes)
- Added prominent security warnings for production mode

### FHIR Service Migration (2025-01-21)
- Completed migration from fhirService to fhirClient
- Updated all components to use direct FHIR API calls
- Fixed import paths and response format handling

## Documentation Updates
- Updated CLAUDE.md with critical security warnings
- Created comprehensive audit service documentation
- Added WebSocket integration guide