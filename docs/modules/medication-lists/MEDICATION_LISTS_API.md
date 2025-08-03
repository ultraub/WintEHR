# Medication Lists API Documentation

**Last Updated**: 2025-08-03

## Overview

The Medication Lists API provides FHIR List-based medication organization and reconciliation capabilities for WintEHR. It implements standard LOINC-coded medication lists including current medications, home medications, discharge medications, and reconciliation lists.

## Key Features

- **FHIR List Resources**: Uses standard FHIR R4 List resources for medication organization
- **LOINC Coding**: Standard LOINC codes for different list types (52471-0, 56445-0, 75311-1, 80738-8)
- **List Modes**: Supports working (ongoing), snapshot (point-in-time), and changes (reconciliation) modes
- **Medication Reconciliation**: Built-in support for reconciling multiple medication lists
- **Entry Management**: Add, remove, and flag medications within lists

## API Endpoints

### Base URL
```
/api/clinical/medication-lists
```

### 1. Get Patient Medication Lists
```http
GET /{patient_id}?list_type={type}&status={status}
```

**Parameters:**
- `patient_id` (required): FHIR patient ID
- `list_type` (optional): Filter by list type (current, home, discharge, reconciliation)
- `status` (optional): List status (default: "current")

**Response:**
```json
[
  {
    "id": "88ecc902-ca75-49e8-8d5c-15f5992dd9ad",
    "resourceType": "List",
    "status": "current",
    "mode": "working",
    "title": "Current Medications",
    "code": {
      "coding": [{
        "system": "http://loinc.org",
        "code": "52471-0",
        "display": "Medication list"
      }]
    },
    "subject": {
      "reference": "Patient/35195"
    },
    "entry": [...]
  }
]
```

### 2. Create Medication List
```http
POST /
```

**Request Body:**
```json
{
  "patient_id": "35195",
  "list_type": "current",
  "title": "Current Medications",
  "encounter_id": "12345",  // optional
  "note": "Initial medication list"  // optional
}
```

**Response:**
```json
{
  "id": "88ecc902-ca75-49e8-8d5c-15f5992dd9ad",
  "resource": { /* Full FHIR List resource */ }
}
```

### 3. Add Medication to List
```http
POST /{list_id}/entries
```

**Request Body:**
```json
{
  "medication_request_id": "35247",
  "flag": "active",  // optional: active, discontinued, etc.
  "note": "Taking as prescribed"  // optional
}
```

**Response:**
```json
{
  "message": "Medication added to list",
  "list_id": "88ecc902-ca75-49e8-8d5c-15f5992dd9ad",
  "entry_count": 1
}
```

### 4. Remove Medication from List
```http
DELETE /{list_id}/entries/{medication_request_id}
```

**Note:** This marks the entry as deleted but doesn't physically remove it (maintains audit trail).

**Response:**
```json
{
  "message": "Medication marked as deleted from list",
  "list_id": "88ecc902-ca75-49e8-8d5c-15f5992dd9ad",
  "medication_request_id": "35247"
}
```

### 5. Reconcile Medication Lists
```http
POST /reconcile
```

**Request Body:**
```json
{
  "patient_id": "35195",
  "source_lists": ["list-id-1", "list-id-2"],
  "encounter_id": "12345",  // optional
  "practitioner_id": "pract-123"  // optional
}
```

**Response:**
```json
{
  "reconciliation_list_id": "new-list-id",
  "medications_reviewed": 10,
  "source_lists_count": 2,
  "conflicts_found": 3
}
```

### 6. Initialize Patient Lists
```http
POST /initialize/{patient_id}
```

Creates standard medication lists (current and home) for a new patient.

**Response:**
```json
{
  "message": "Medication lists initialized",
  "created_lists": ["list-id-1", "list-id-2"]
}
```

## List Types and LOINC Codes

| List Type | LOINC Code | Display | Mode | Description |
|-----------|------------|---------|------|-------------|
| current | 52471-0 | Medication list | working | Active medications the patient is currently taking |
| home | 56445-0 | Medication summary | working | Medications the patient manages at home |
| discharge | 75311-1 | Discharge medications | snapshot | Medications prescribed at discharge |
| reconciliation | 80738-8 | Medication reconciliation | changes | Result of reconciliation process |

## List Entry Structure

Each medication entry in a list contains:
```json
{
  "item": {
    "reference": "MedicationRequest/35247"
  },
  "date": "2025-08-03T01:33:36Z",
  "flag": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/list-item-flag",
      "code": "active"
    }]
  },
  "note": "Taking as prescribed",
  "deleted": false  // true if marked for deletion
}
```

## Reconciliation Process

The reconciliation endpoint:
1. Retrieves all specified source lists
2. Extracts unique medications across lists
3. Identifies medications appearing in multiple lists (conflicts)
4. Creates a new reconciliation list with mode="changes"
5. Flags entries as "review-needed" or "confirmed"

## Error Handling

All endpoints return standard HTTP status codes:
- 200: Success
- 400: Bad Request (invalid parameters)
- 404: Resource not found
- 500: Internal server error

Error responses include detailed messages:
```json
{
  "detail": "Failed to create medication list: {error details}"
}
```

## Integration with Frontend

The frontend should:
1. Call `/initialize/{patient_id}` when creating a new patient
2. Use list IDs to manage medications within specific contexts
3. Display appropriate list based on workflow (current for active care, discharge for discharge planning)
4. Trigger reconciliation when merging medication sources

## Security Notes

- TODO: Currently uses placeholder practitioner ("Practitioner/example")
- Production implementation should extract practitioner from authentication context
- All operations should be audited in production