import React from 'react';
import { useParams } from 'react-router-dom';
import UnderConstruction from '../components/UnderConstruction';
import {
  AddCircle as NewEncounterIcon
} from '@mui/icons-material';

const NewEncounter = () => {
  const { id } = useParams();
  
  return (
    <UnderConstruction
      featureName="New Encounter"
      description="Create a new clinical encounter for this patient. Document visits, capture diagnoses, and manage the complete encounter workflow."
      estimatedDate="Q2 2025"
      customIcon={<NewEncounterIcon sx={{ fontSize: 80, color: '#4caf50', opacity: 0.8 }} />}
      plannedFeatures={[
        "Encounter type selection",
        "Chief complaint documentation",
        "Vital signs capture",
        "Review of systems",
        "Physical examination templates",
        "Assessment and plan",
        "Diagnosis coding (ICD-10)",
        "Procedure documentation (CPT)",
        "Order entry integration",
        "Encounter finalization workflow"
      ]}
      alternativeActions={[
        { label: "View patient details", path: `/patients/${id}` },
        { label: "Access clinical workspace", path: `/clinical-workspace/${id}` },
        { label: "Schedule an appointment", path: "/encounters/schedule" }
      ]}
    />
  );
};

export default NewEncounter;