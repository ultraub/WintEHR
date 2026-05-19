/**
 * ImmunizationOrderTab — composes an ORDER to immunize, not the
 * recording of an administration (#116, Phase 4.1.B; #5 future MAR).
 *
 * Decision recap (from the plan): the Order Composer is the CPOE
 * surface — prescribers compose intent. Nurses record the actual
 * administration in the MAR Tasks pane via ImmunizationAdminDialog
 * (Phase 5.2).
 *
 * So this tab produces a `ServiceRequest` whose:
 * - `code` carries the CVX coding of the vaccine to give
 * - `category` is "immunization" so downstream surfaces (the
 *   MAR Tasks pane) can recognize it
 * - `status='draft'` until Sign All flips it to active
 *
 * The route / site / dose / lot / reaction fields explicitly DO NOT
 * belong here — those are facts about the administration event,
 * captured by the nurse in ImmunizationAdminDialog when (and if) the
 * order is acted on.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
} from '@mui/icons-material';

import catalogService from '../../../../../services/CatalogIntegrationService';
import { useDraftOrderBundle } from '../DraftOrderBundleProvider';
import DiagnosisPicker, { toReasonReference } from '../DiagnosisPicker';

const CVX_SYSTEM = 'http://hl7.org/fhir/sid/cvx';

// SNOMED CT category coding for an immunization order. Matches the
// shape the other order tabs use so the right pane's icon-and-label
// heuristic in DraftOrderList resolves the new kind correctly without
// code changes there.
const IMMUNIZATION_CATEGORY_CODING = {
  system: 'http://snomed.info/sct',
  code: '33879002',
  display: 'Immunization',
};

const PRIORITIES = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'asap', label: 'ASAP' },
  { value: 'stat', label: 'STAT' },
];

const ImmunizationOrderTab = () => {
  const { patientId, addDraft } = useDraftOrderBundle();

  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [indication, setIndication] = useState('');
  const [priority, setPriority] = useState('routine');
  const [diagnoses, setDiagnoses] = useState([]);
  const [error, setError] = useState(null);

  // CVX vaccine catalog comes from the system ValueSet
  // `wintehr-vaccines` that ValueSetComposer hydrates from. Reuses the
  // same expansion path the ValueSet browse pane uses for vaccines,
  // so the picker stays in sync as the system catalog grows.
  useEffect(() => {
    const handle = setTimeout(async () => {
      const q = search.trim();
      if (q.length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const items = await catalogService.expandTerminologyValueSet('wintehr-vaccines', q, 25);
        setResults(Array.isArray(items) ? items : []);
      } catch (e) {
        console.warn('ImmunizationOrderTab: vaccine catalog search failed', e);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [search]);

  const canAdd = useMemo(
    () => Boolean(selected && indication.trim().length >= 5),
    [selected, indication],
  );

  const handleAdd = useCallback(() => {
    if (!canAdd) {
      setError('Pick a vaccine and provide a clinical indication (5+ chars).');
      return;
    }
    setError(null);

    const draft = {
      resourceType: 'ServiceRequest',
      status: 'draft',
      intent: 'order',
      priority,
      subject: { reference: `Patient/${patientId}` },
      authoredOn: new Date().toISOString(),
      category: [{ coding: [IMMUNIZATION_CATEGORY_CODING] }],
      code: {
        coding: [
          {
            system: selected.system || CVX_SYSTEM,
            code: selected.code,
            display: selected.display,
          },
        ],
        text: selected.display,
      },
      reasonCode: [{ text: indication.trim() }],
      ...(toReasonReference(diagnoses) ? { reasonReference: toReasonReference(diagnoses) } : {}),
    };

    addDraft(draft);

    setSelected(null);
    setSearch('');
    setResults([]);
    setIndication('');
  }, [canAdd, patientId, priority, selected, indication, diagnoses, addDraft]);

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      {error && <Alert severity="error">{error}</Alert>}

      <Alert severity="info" variant="outlined" sx={{ '& .MuiAlert-message': { fontSize: '0.85rem' } }}>
        This tab orders an immunization. The nurse records the actual
        administration (lot number, site, route, reaction) in the
        Immunizations chart section after the order is signed.
      </Alert>

      <Autocomplete
        options={results}
        loading={searching}
        value={selected}
        onChange={(_e, v) => setSelected(v)}
        getOptionLabel={(opt) => opt?.display || ''}
        isOptionEqualToValue={(opt, val) => opt?.code === val?.code}
        filterOptions={(x) => x}
        renderOption={(props, opt) => {
          const { key, ...rest } = props;
          return (
            <li key={key} {...rest}>
              <Stack>
                <Typography variant="body2">{opt.display}</Typography>
                <Typography variant="caption" color="text.secondary">
                  CVX · {opt.code}
                </Typography>
              </Stack>
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Search vaccines (CVX)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <>
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                  {params.InputProps.startAdornment}
                </>
              ),
              endAdornment: (
                <>
                  {searching ? <CircularProgress size={18} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />

      <TextField
        label="Clinical indication"
        value={indication}
        onChange={(e) => setIndication(e.target.value)}
        placeholder="Why is this vaccine being given?"
        multiline
        minRows={2}
        helperText="At least 5 characters."
      />

      <DiagnosisPicker value={diagnoses} onChange={setDiagnoses} />

      <FormControl size="small" sx={{ maxWidth: 200 }}>
        <InputLabel>Priority</InputLabel>
        <Select value={priority} onChange={(e) => setPriority(e.target.value)} label="Priority">
          {PRIORITIES.map((p) => (
            <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          disabled={!canAdd}
        >
          Add to draft list
        </Button>
      </Box>
    </Stack>
  );
};

export default ImmunizationOrderTab;
