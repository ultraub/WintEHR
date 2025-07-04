import React from 'react';
import { useParams } from 'react-router-dom';
import UnderConstruction from '../components/UnderConstruction';
import {
  Warning as AllergiesIcon
} from '@mui/icons-material';

const PatientAllergies = () => {
  const { id } = useParams();
  
  return (
    <UnderConstruction
      featureName="Allergies & Intolerances"
      description="Document and manage patient allergies, adverse reactions, and intolerances. Ensure patient safety with comprehensive allergy tracking."
      estimatedDate="Q1 2025"
      customIcon={<AllergiesIcon sx={{ fontSize: 80, color: '#f44336', opacity: 0.8 }} />}
      plannedFeatures={[
        "Allergy documentation and categorization",
        "Reaction severity levels",
        "Allergen types (drug, food, environmental)",
        "Reaction symptoms and manifestations",
        "Verification status tracking",
        "Historical allergy information",
        "Cross-reactivity warnings",
        "Allergy alert integration",
        "Patient-reported allergies",
        "Allergy reconciliation workflows"
      ]}
      alternativeActions={[
        { label: "View patient details", path: `/patients/${id}` },
        { label: "Access clinical workspace", path: `/clinical-workspace/${id}` },
        { label: "Return to patient list", path: "/patients" }
      ]}
    />
  );
};

export default PatientAllergies;