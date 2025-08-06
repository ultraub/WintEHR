import React from 'react';
import { useParams } from 'react-router-dom';
import PatientSummaryV4 from '../components/clinical/dashboard/PatientSummaryV4';
import { decodeFhirId } from '../core/navigation/navigationUtils';

const PatientDashboardV2Page = () => {
  const { id: encodedPatientId } = useParams();
  const patientId = decodeFhirId(encodedPatientId).toLowerCase(); // Normalize to lowercase for consistency
  
  if (!patientId) {
    return <div>No patient ID provided</div>;
  }
  
  // Using V4 component which provides a beautiful patient summary with clinical workspace integration
  return <PatientSummaryV4 patientId={patientId} />;
};

export default PatientDashboardV2Page;