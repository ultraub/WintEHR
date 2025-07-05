import React from 'react';
import { useParams } from 'react-router-dom';
import PatientDashboardV2 from '../components/clinical/dashboard/PatientDashboardV2';

const PatientDashboardV2Page = () => {
  const { id } = useParams();
  
  return <PatientDashboardV2 patientId={id} />;
};

export default PatientDashboardV2Page;