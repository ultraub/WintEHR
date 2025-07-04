import React from 'react';
import UnderConstruction from '../components/UnderConstruction';
import {
  LocalPharmacy as MedicationsIcon
} from '@mui/icons-material';

const Medications = () => {
  return (
    <UnderConstruction
      featureName="Medications Management"
      description="Comprehensive medication management with e-prescribing, drug interaction checking, and medication reconciliation. Ensure patient safety with advanced clinical decision support."
      estimatedDate="Q1 2025"
      customIcon={<MedicationsIcon sx={{ fontSize: 80, color: '#E91E63', opacity: 0.8 }} />}
      plannedFeatures={[
        "Electronic prescribing (e-Rx)",
        "Drug interaction checking",
        "Allergy alerts and contraindications",
        "Medication history and reconciliation",
        "Prescription templates and favorites",
        "Controlled substance prescribing",
        "Prior authorization support",
        "Pharmacy directory integration",
        "Medication adherence tracking",
        "Generic substitution suggestions"
      ]}
      alternativeActions={[
        { label: "View patient records", path: "/patients" },
        { label: "Access clinical workspace", path: "/clinical-workspace/placeholder" }
      ]}
    />
  );
};

export default Medications;