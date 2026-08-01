/**
 * BedChip — patient-header slot contribution (module 'inpatient').
 *
 * Shows the ward/location of the patient's CURRENT admission (an
 * in-progress inpatient Encounter). Renders nothing when the patient is
 * not admitted — absence of the chip means "not an inpatient", honestly.
 * Eager-light by design: header chips must not lazy-flash.
 */

import React, { useEffect, useState } from 'react';
import { Chip, Tooltip } from '@mui/material';
import { Hotel as BedIcon } from '@mui/icons-material';

import { fhirClient } from '../../core/fhir/services/fhirClient';

const BedChip = ({ patient }) => {
  const [admission, setAdmission] = useState(null);

  useEffect(() => {
    if (!patient?.id) {
      setAdmission(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await fhirClient.search('Encounter', {
          patient: patient.id,
          status: 'in-progress',
          class: 'IMP',
          _count: 1,
        });
        const encounter = (result.resources || [])[0] || null;
        if (!cancelled) setAdmission(encounter);
      } catch (err) {
        // A failed lookup must not degrade the header — no chip, one log.
        console.error('BedChip: admission lookup failed', err);
        if (!cancelled) setAdmission(null);
      }
    })();
    return () => { cancelled = true; };
  }, [patient?.id]);

  if (!admission) return null;

  const location = (admission.location || [])[0]?.location?.display;
  const since = admission.period?.start
    ? new Date(admission.period.start).toLocaleDateString()
    : null;

  return (
    <Tooltip title={`Admitted${since ? ` since ${since}` : ''}`}>
      <Chip
        size="small"
        color="secondary"
        icon={<BedIcon sx={{ fontSize: 16 }} />}
        label={location || 'Admitted'}
      />
    </Tooltip>
  );
};

export default BedChip;
