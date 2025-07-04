import React from 'react';
import { useParams } from 'react-router-dom';
import UnderConstruction from '../components/UnderConstruction';
import {
  EventNote as EncountersIcon
} from '@mui/icons-material';

const PatientEncounters = () => {
  const { id } = useParams();
  
  return (
    <UnderConstruction
      featureName="Patient Encounters"
      description="View complete encounter history for this patient. Access visit notes, diagnoses, and treatment plans from all past visits."
      estimatedDate="Q2 2025"
      customIcon={<EncountersIcon sx={{ fontSize: 80, color: '#388e3c', opacity: 0.8 }} />}
      plannedFeatures={[
        "Chronological encounter list",
        "Encounter type filtering",
        "Visit summaries and details",
        "Provider notes access",
        "Diagnoses and procedures",
        "Orders placed during visits",
        "Lab results by encounter",
        "Billing codes and charges",
        "Encounter documentation",
        "Visit outcome tracking"
      ]}
      alternativeActions={[
        { label: "View patient details", path: `/patients/${id}` },
        { label: "View all encounters", path: "/encounters" },
        { label: "Access clinical workspace", path: `/clinical-workspace/${id}` }
      ]}
    />
  );
};

export default PatientEncounters;