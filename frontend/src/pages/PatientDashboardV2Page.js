import React from 'react';
import { useParams } from 'react-router-dom';
import PatientSummaryV4 from '../components/clinical/dashboard/PatientSummaryV4';

const PatientDashboardV2Page = () => {
  const { id } = useParams();
  
  
  if (!id) {
    return <div>No patient ID provided</div>;
  }
  
  // Using V4 component which provides a beautiful patient summary with clinical workspace integration
  return <PatientSummaryV4 patientId={id} />;
};

export default PatientDashboardV2Page;