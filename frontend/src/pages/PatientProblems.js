import React from 'react';
import { useParams } from 'react-router-dom';
import UnderConstruction from '../components/UnderConstruction';
import {
  LocalHospital as ProblemsIcon
} from '@mui/icons-material';

const PatientProblems = () => {
  const { id } = useParams();
  
  return (
    <UnderConstruction
      featureName="Problem List"
      description="Manage patient diagnoses, active problems, and medical history. Track condition progression and treatment effectiveness."
      estimatedDate="Q1 2025"
      customIcon={<ProblemsIcon sx={{ fontSize: 80, color: '#7C4DFF', opacity: 0.8 }} />}
      plannedFeatures={[
        "Active problem list management",
        "Past medical history",
        "Problem severity and status tracking",
        "ICD-10 code integration",
        "Problem onset and resolution dates",
        "Clinical notes linking",
        "Problem-specific care plans",
        "Family history tracking",
        "Social history documentation",
        "Surgical history management"
      ]}
      alternativeActions={[
        { label: "View patient details", path: `/patients/${id}` },
        { label: "Access clinical workspace", path: `/clinical-workspace/${id}` },
        { label: "Return to patient list", path: "/patients" }
      ]}
    />
  );
};

export default PatientProblems;