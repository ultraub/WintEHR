import React from 'react';
import { useParams } from 'react-router-dom';
import UnderConstruction from '../components/UnderConstruction';
import {
  Medication as MedicationIcon
} from '@mui/icons-material';

const PatientMedications = () => {
  const { id } = useParams();
  
  return (
    <UnderConstruction
      featureName="Patient Medications"
      description="View and manage patient-specific medications, including current prescriptions, medication history, and adherence tracking."
      estimatedDate="Q1 2025"
      customIcon={<MedicationIcon sx={{ fontSize: 80, color: '#E91E63', opacity: 0.8 }} />}
      plannedFeatures={[
        "Current medication list",
        "Prescription history",
        "Medication reconciliation",
        "Drug interaction alerts",
        "Allergy checking",
        "Refill management",
        "Medication adherence tracking",
        "Patient education materials",
        "Prescription cost information",
        "Electronic prescribing"
      ]}
      alternativeActions={[
        { label: "View patient details", path: `/patients/${id}` },
        { label: "Access clinical workspace", path: `/clinical-workspace/${id}` },
        { label: "Return to patient list", path: "/patients" }
      ]}
    />
  );
};

export default PatientMedications;