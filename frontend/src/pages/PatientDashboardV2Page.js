import React from 'react';
import { useParams } from 'react-router-dom';
import PatientSummary from '../components/clinical/dashboard/PatientSummary';
import { decodeFhirId } from '../core/navigation/navigationUtils';

const PatientDashboardV2Page = () => {
  const { id: encodedPatientId } = useParams();
  const patientId = decodeFhirId(encodedPatientId).toLowerCase(); // Normalize to lowercase for consistency
  
  if (!patientId) {
    return <div>No patient ID provided</div>;
  }
  
  // Using component which provides a beautiful patient summary with clinical workspace integration
  return <PatientSummary patientId={patientId} />;
};

export default PatientDashboardV2Page;