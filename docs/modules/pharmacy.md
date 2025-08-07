# Pharmacy Module

**Version**: 1.0.0  
**Last Updated**: 2025-08-06  
**Component Location**: `frontend/src/pages/PharmacyDashboard.js`

## Overview

The Pharmacy module provides complete prescription management and dispensing workflow automation for pharmacy staff, including queue management, drug interaction checking, and controlled substance tracking.

## Features

### Core Functionality
- **Prescription Queue**: Real-time prescription management
- **Dispensing Workflow**: Step-by-step dispensing process
- **Drug Interactions**: Automatic interaction checking
- **Inventory Tracking**: Medication stock management
- **Controlled Substances**: DEA compliance and tracking
- **Patient Counseling**: Documentation and notes

### Workflow States
1. **Pending**: New prescriptions awaiting review
2. **In Progress**: Currently being filled
3. **Ready**: Completed and awaiting pickup
4. **Dispensed**: Picked up by patient
5. **Cancelled**: Cancelled prescriptions

## User Interface

### Dashboard Layout
```
┌─────────────────────────────────────────────────────────┐
│                 Pharmacy Dashboard                      │
├─────────────────────────────────────────────────────────┤
│ Queue Stats: Pending (12) | Ready (5) | Today (47)     │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  Queue       │         Prescription Details             │
│  Filters     │                                          │
│              │  Patient: John Doe                       │
│  □ Urgent    │  Medication: Lisinopril 10mg            │
│  □ Controlled│  Quantity: 30 tablets                   │
│  □ Refrigerated  Instructions: Take once daily         │
│              │                                          │
│  Sort By:    │  [Fill] [Hold] [Cancel] [Contact MD]    │
│  ○ Time      │                                          │
│  ○ Priority  │                                          │
└──────────────┴──────────────────────────────────────────┘
```

## Component Implementation

### Main Dashboard
```javascript
// pages/PharmacyDashboard.js
import React, { useState, useEffect } from 'react';
import { Grid, Paper } from '@mui/material';
import PrescriptionQueue from '@/components/pharmacy/PrescriptionQueue';
import DispensingWorkflow from '@/components/pharmacy/DispensingWorkflow';
import { usePharmacy } from '@/hooks/usePharmacy';

const PharmacyDashboard = () => {
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const { queue, loading, refetch } = usePharmacy();

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <PrescriptionQueue 
          prescriptions={queue}
          onSelect={setSelectedPrescription}
          onRefresh={refetch}
        />
      </Grid>
      <Grid item xs={12} md={8}>
        {selectedPrescription && (
          <DispensingWorkflow 
            prescription={selectedPrescription}
            onComplete={() => {
              setSelectedPrescription(null);
              refetch();
            }}
          />
        )}
      </Grid>
    </Grid>
  );
};
```

### Dispensing Workflow
```javascript
// components/pharmacy/DispensingWorkflow.jsx
const DispensingWorkflow = ({ prescription, onComplete }) => {
  const [step, setStep] = useState('verify');
  
  const steps = {
    verify: VerifyPrescription,
    interactions: CheckInteractions,
    fill: FillPrescription,
    label: PrintLabel,
    complete: CompletePrescription
  };
  
  const CurrentStep = steps[step];
  
  return (
    <Paper sx={{ p: 3 }}>
      <Stepper activeStep={Object.keys(steps).indexOf(step)}>
        {Object.keys(steps).map(key => (
          <Step key={key}>
            <StepLabel>{key}</StepLabel>
          </Step>
        ))}
      </Stepper>
      
      <CurrentStep 
        prescription={prescription}
        onNext={() => setStep(getNextStep(step))}
        onComplete={onComplete}
      />
    </Paper>
  );
};
```

## FHIR Resources

### MedicationRequest
```javascript
{
  "resourceType": "MedicationRequest",
  "id": "rx-123",
  "status": "active",
  "intent": "order",
  "medicationCodeableConcept": {
    "coding": [{
      "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
      "code": "203133",
      "display": "Lisinopril 10 MG Oral Tablet"
    }]
  },
  "subject": { "reference": "Patient/patient-456" },
  "authoredOn": "2025-08-06T10:00:00Z",
  "requester": { "reference": "Practitioner/dr-789" },
  "dosageInstruction": [{
    "text": "Take 1 tablet by mouth once daily",
    "timing": {
      "repeat": {
        "frequency": 1,
        "period": 1,
        "periodUnit": "d"
      }
    }
  }],
  "dispenseRequest": {
    "quantity": {
      "value": 30,
      "unit": "tablets"
    },
    "daysSupply": {
      "value": 30,
      "unit": "days"
    }
  }
}
```

### MedicationDispense
```javascript
const createDispenseRecord = async (prescription, dispensingData) => {
  const dispense = {
    resourceType: "MedicationDispense",
    status: "completed",
    medicationCodeableConcept: prescription.medicationCodeableConcept,
    subject: prescription.subject,
    authorizingPrescription: [{
      reference: `MedicationRequest/${prescription.id}`
    }],
    quantity: dispensingData.quantity,
    daysSupply: dispensingData.daysSupply,
    whenHandedOver: new Date().toISOString(),
    performer: [{
      actor: { reference: `Practitioner/${getCurrentUser().id}` }
    }],
    note: [{
      text: dispensingData.counselingNotes
    }]
  };
  
  return await fhirClient.create('MedicationDispense', dispense);
};
```

## Drug Interaction Checking

```javascript
// services/drugInteractionService.js
export const checkInteractions = async (medicationCode, patientId) => {
  // Get patient's current medications
  const currentMeds = await fhirClient.search('MedicationRequest', {
    patient: patientId,
    status: 'active'
  });
  
  // Check interactions
  const interactions = [];
  for (const med of currentMeds.entry) {
    const interaction = await checkDrugDrugInteraction(
      medicationCode,
      med.resource.medicationCodeableConcept.coding[0].code
    );
    
    if (interaction) {
      interactions.push({
        medication: med.resource.medicationCodeableConcept.text,
        severity: interaction.severity,
        description: interaction.description,
        recommendation: interaction.recommendation
      });
    }
  }
  
  return interactions;
};
```

## Controlled Substance Management

```javascript
// Verify DEA requirements
const verifyControlledSubstance = async (prescription) => {
  const medication = prescription.medicationCodeableConcept;
  const schedule = getControlledSchedule(medication);
  
  if (schedule) {
    // Verify prescriber DEA
    const prescriber = await fhirClient.read(
      'Practitioner', 
      prescription.requester.reference
    );
    
    if (!prescriber.identifier?.find(i => i.system === 'DEA')) {
      throw new Error('Prescriber DEA number required');
    }
    
    // Check refills
    if (schedule <= 2 && prescription.dispenseRequest.numberOfRepeatsAllowed > 0) {
      throw new Error('No refills allowed for Schedule II medications');
    }
    
    // Log to controlled substance registry
    await logControlledDispense(prescription, schedule);
  }
};
```

## Queue Management

```javascript
// hooks/usePharmacy.js
export const usePharmacy = () => {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const fetchQueue = async () => {
    const prescriptions = await fhirClient.search('MedicationRequest', {
      status: 'active',
      _sort: 'authored',
      _include: ['MedicationRequest:patient', 'MedicationRequest:requester']
    });
    
    const processed = prescriptions.entry?.map(entry => ({
      ...entry.resource,
      patient: findIncluded(prescriptions, entry.resource.subject),
      prescriber: findIncluded(prescriptions, entry.resource.requester),
      priority: calculatePriority(entry.resource)
    }));
    
    setQueue(processed || []);
    setLoading(false);
  };
  
  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);
  
  return { queue, loading, refetch: fetchQueue };
};
```

## Security & Compliance

### Access Control
```javascript
const pharmacyPermissions = {
  viewQueue: ['pharmacist', 'pharmacy_tech', 'admin'],
  dispense: ['pharmacist', 'admin'],
  cancelPrescription: ['pharmacist', 'admin'],
  viewControlled: ['pharmacist'],
  modifyInventory: ['pharmacist', 'pharmacy_manager']
};
```

### Audit Requirements
- All dispensing actions logged
- Controlled substance tracking
- Inventory adjustments tracked
- Patient counseling documented

## Testing

```javascript
describe('Pharmacy Module', () => {
  it('displays prescription queue', async () => {
    const { getByText } = render(<PharmacyDashboard />);
    await waitFor(() => {
      expect(getByText('Prescription Queue')).toBeInTheDocument();
    });
  });
  
  it('completes dispensing workflow', async () => {
    const prescription = createMockPrescription();
    const result = await completeDispensing(prescription);
    expect(result.status).toBe('completed');
  });
});
```

---

Built with ❤️ for the healthcare community.