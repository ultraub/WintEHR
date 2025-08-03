# Phase 2: Pharmacy Service Integration

**Created**: 2025-08-03  
**Status**: IMPLEMENTED

## Overview

Phase 2.1 enhanced the MedicationDispense service to integrate with the backend pharmacy API, providing better workflow management, queue tracking, and dispensing operations.

## Changes Made

### 1. New Pharmacy Service (`pharmacyService.js`)

Created a dedicated pharmacy service that interfaces with the backend pharmacy API endpoints:

#### Key Features:
- **Pharmacy Queue Management**: Get and filter pharmacy queue by status, patient, priority
- **Medication Dispensing**: Create MedicationDispense records via pharmacy API
- **Status Tracking**: Update pharmacy workflow status (pending → verified → dispensed → completed)
- **Inventory Checking**: Check medication availability before dispensing
- **Metrics & Statistics**: Track pharmacy performance and queue statistics
- **Caching**: 1-minute cache for queue data to improve performance

#### API Endpoints Used:
```javascript
GET  /api/clinical/pharmacy/queue        // Get pharmacy queue
POST /api/clinical/pharmacy/dispense     // Dispense medication
PUT  /api/clinical/pharmacy/status/{id}  // Update status
GET  /api/clinical/pharmacy/metrics      // Get metrics
GET  /api/clinical/pharmacy/inventory/check/{code}  // Check inventory
```

### 2. Enhanced MedicationDispenseService

Updated the existing service to integrate with the pharmacy API:

#### New Methods:
- `getPatientPharmacyQueue(patientId)` - Get pharmacy queue for specific patient
- `updatePharmacyStatus(requestId, status, notes)` - Update workflow status
- `completePharmacyDispensing(prescriptionId, data)` - Complete dispensing workflow
- Enhanced `createMedicationDispense()` to use pharmacy API when prescription ID available
- Enhanced `validateDispensingPrerequisites()` to check inventory

#### Integration Pattern:
```javascript
// Use pharmacy API when prescription ID available
if (dispenseData.prescriptionId) {
  // Use backend pharmacy API for better integration
  const result = await pharmacyService.dispenseMedication(data);
} else {
  // Fallback to direct FHIR API
  const response = await fhirClient.create('MedicationDispense', resource);
}
```

## Usage Examples

### 1. Get Pharmacy Queue
```javascript
// Get entire pharmacy queue
const queue = await pharmacyService.getPharmacyQueue();

// Get queue for specific patient
const patientQueue = await pharmacyService.getPharmacyQueue({
  patientId: 'Patient/123'
});

// Get pending prescriptions only
const pendingQueue = await pharmacyService.getPharmacyQueue({
  status: 'pending',
  priority: 1  // Urgent only
});
```

### 2. Process Prescription
```javascript
// Verify prescription
await pharmacyService.processPrescription(prescriptionId, {
  medicationCode: 'RxNorm123',
  pharmacistId: 'Practitioner/456',
  notes: 'Verified dosage and patient information'
});

// Complete dispensing
const result = await pharmacyService.completeDispensing(prescriptionId, {
  quantity: 30,
  lotNumber: 'LOT123456',
  expirationDate: '2025-12-31',
  notes: 'Counseled patient on usage',
  pharmacistId: 'Practitioner/456'
});
```

### 3. Check Inventory
```javascript
const inventory = await pharmacyService.checkMedicationInventory('RxNorm123');
// Returns:
{
  medication_code: "RxNorm123",
  medication_name: "Medication Name",
  current_stock: 150,
  minimum_stock: 50,
  status: "in_stock",
  lot_numbers: [...]
}
```

### 4. Get Queue Statistics
```javascript
const stats = await pharmacyService.getQueueStatistics();
// Returns:
{
  total: 25,
  byStatus: {
    pending: 10,
    verified: 5,
    dispensed: 3,
    ready: 4,
    completed: 3
  },
  byPriority: {
    1: 2,  // Urgent
    2: 5,  // High
    3: 18  // Normal
  },
  overdue: 3,
  avgWaitTime: 2  // hours
}
```

## Pharmacy Workflow States

The pharmacy workflow follows these states:

1. **pending** - New prescription received
2. **verified** - Pharmacist verified prescription
3. **dispensed** - Medication physically dispensed
4. **ready** - Ready for patient pickup
5. **completed** - Picked up by patient

## Priority Levels

Prescriptions are prioritized as:
- **1**: Urgent/STAT
- **2**: High priority
- **3**: Normal (default)
- **4**: Low priority
- **5**: Scheduled/future

## Benefits

1. **Better Workflow Management**: Track prescriptions through entire pharmacy workflow
2. **Queue Visibility**: See pending work and prioritize appropriately
3. **Inventory Integration**: Check stock before dispensing
4. **Performance Metrics**: Track pharmacy efficiency
5. **Status Updates**: Real-time status tracking for prescriptions
6. **Validation**: Built-in checks for safer dispensing

## Migration Notes

Existing code using `medicationDispenseService` will continue to work. The service now automatically uses the pharmacy API when a prescription ID is provided, falling back to direct FHIR API calls when needed.

## Testing

Test the integration:

```javascript
// Test queue retrieval
const queue = await pharmacyService.getPharmacyQueue();
console.log(`${queue.length} prescriptions in queue`);

// Test dispensing
const testDispense = await medicationDispenseService.completePharmacyDispensing(
  'medication-request-id',
  {
    patientId: 'Patient/123',
    quantity: 30,
    lotNumber: 'TEST123',
    expirationDate: '2025-12-31',
    notes: 'Test dispensing',
    pharmacistId: 'Practitioner/pharmacist'
  }
);
```

## Next Steps

- Phase 2.2: Update UI components to use enhanced pharmacy services
- Phase 2.3: Test complete pharmacy workflow with real data
- Future: Add real-time WebSocket updates for queue changes