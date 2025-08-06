import React from 'react';
import { useParams } from 'react-router-dom';
import { Box } from '@mui/material';
import MedicationReconciliation from '../components/clinical/medications/MedicationReconciliation';

function MedicationReconciliationPage() {
  const { patientId, encounterId } = useParams();
  const mode = new URLSearchParams(window.location.search).get('mode') || 'admission';

  return (
    <Box sx={{ height: '100vh', overflow: 'hidden' }}>
      <MedicationReconciliation 
        patientId={patientId}
        encounterId={encounterId}
        mode={mode}
      />
    </Box>
  );
}

export default MedicationReconciliationPage;