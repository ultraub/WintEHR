import React from 'react';
import { useParams } from 'react-router-dom';
import PatientDashboardV3 from '../components/clinical/dashboard/PatientDashboardV3';

const PatientDashboardV2Page = () => {
  const { id } = useParams();
  
  // Using V3 component which has modernized UI with improved performance
  return <PatientDashboardV3 patientId={id} />;
};

export default PatientDashboardV2Page;