# FHIR AuditEvent Implementation

## Overview

This document describes the implementation of FHIR R4 AuditEvent resources in the MedGenEMR system. The implementation replaces the custom audit logging system with standard FHIR AuditEvent resources.

## Features

### Backend Implementation

1. **FHIR AuditEvent Converter** (`backend/api/fhir/converters/audit_event.py`)
   - Converts EMR audit logs to FHIR R4 AuditEvent resources
   - Maps audit actions to standard FHIR codes
   - Supports different event types (create, read, update, delete, login, logout)
   - Includes agent identification (user, system)
   - Tracks accessed/modified resources

2. **Audit Service** (`backend/api/services/audit_service.py`)
   - Creates audit logs for all FHIR operations
   - Provides search capabilities with filters
   - Supports login/logout auditing
   - Maintains backward compatibility with existing audit logs

3. **FHIR Endpoints**
   - `GET /fhir/R4/AuditEvent` - Search audit events
   - `GET /fhir/R4/AuditEvent/{id}` - Get specific audit event
   - All FHIR operations automatically create audit events

### Frontend Implementation

1. **Audit Trail Component** (`frontend/src/components/AuditTrail.js`)
   - Displays audit events in a searchable table
   - Supports filtering by date, action, outcome, user
   - Pagination for large result sets
   - Color-coded outcomes for quick status identification

2. **Audit Trail Page** (`frontend/src/pages/AuditTrailPage.js`)
   - System-wide audit trail view
   - Patient-specific audit trail
   - Resource-specific audit trail

3. **Integration Points**
   - Menu item in main navigation
   - Quick action in patient view
   - Accessible from various resource views

## Search Parameters

The AuditEvent search supports the following parameters:

- `date` - When the activity occurred (supports operators: gt, lt, ge, le, eq)
- `agent` - Who participated (user reference)
- `entity` - Specific instance of resource
- `type` - Type of action performed
- `action` - Type of action performed (C,R,U,D,E)
- `outcome` - Whether the event succeeded or failed
- `patient` - Filter by patient reference

## Action Types

| Action Code | Description | FHIR Mapping |
|-------------|-------------|--------------|
| C | Create | Create new resource |
| R | Read | Read/access resource |
| U | Update | Update existing resource |
| D | Delete | Delete resource |
| E | Execute | Execute operation |

## Outcome Codes

| Code | Description | UI Display |
|------|-------------|------------|
| 0 | Success | Green chip |
| 4 | Minor Failure | Yellow chip |
| 8 | Major Failure | Red chip |
| 12 | Serious Failure | Red chip |

## Usage Examples

### Search for all events for a patient
```
GET /fhir/R4/AuditEvent?patient=Patient/123
```

### Search for all login events today
```
GET /fhir/R4/AuditEvent?type=110122&date=ge2025-01-07
```

### Search for all failed operations
```
GET /fhir/R4/AuditEvent?outcome=4,8,12
```

### Search for events by a specific user
```
GET /fhir/R4/AuditEvent?agent=Practitioner/dr-smith
```

## Security Considerations

1. **Access Control**
   - Audit events require authentication
   - Users can only see audit events they have permission to access
   - Admin users have full access to all audit events

2. **Data Integrity**
   - Audit events are immutable once created
   - All FHIR operations automatically create audit entries
   - Network information (IP address, user agent) is captured

3. **Compliance**
   - Meets HIPAA audit logging requirements
   - Supports security event monitoring
   - Enables access tracking and reporting

## Migration from Legacy System

The existing `emr.audit_logs` table is automatically converted to FHIR AuditEvent format when accessed through the FHIR API. No data migration is required.

## Future Enhancements

1. Real-time audit event notifications
2. Advanced analytics and reporting
3. Integration with SIEM systems
4. Automated anomaly detection
5. Bulk export of audit events