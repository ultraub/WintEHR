/**
 * OrderEntryForm — shared composition surface used by every tab in the
 * Unified Order Entry (#116). One tab = one category preset; the form
 * itself is identical so the user's mental model stays consistent across
 * the lab / imaging / procedure tabs (and the med / immunization tabs
 * that arrive in Phase 4.2).
 *
 * Why this is a separate, simpler component than the existing
 * `ServiceRequestFormFields` (621 lines, used by `CPOEDialog`):
 * - The legacy form is married to `BaseResourceDialog`'s state machine —
 *   it expects a single in-progress order, a 3-step stepper, and a
 *   save-to-HAPI completion. The unified entry has a different shape:
 *   compose many orders without leaving the dialog, push each to a
 *   shared draft bundle, sign them all at the end.
 * - Keeping the legacy form intact (CPOEDialog stays as the
 *   single-order edit-mode entry per the plan) means this MVP doesn't
 *   risk regressing the existing flow.
 *
 * What this form does:
 * - Search the category-appropriate catalog via CatalogIntegrationService
 * - Capture a clinical indication and priority
 * - Hand a fully-formed FHIR ServiceRequest (status='draft') to the
 *   parent via `onAddDraft`. Status is `draft` per Phase 3 — the Sign
 *   All step at the unified-shell level flips them to `active`.
 *
 * Out of scope for this MVP form:
 * - Specimen type, body site, performer routing (legacy form has these
 *   via `LabOrderFields`/`ImagingOrderFields`; Phase 4.1.B will lift
 *   those in once the unified shell proves out)
 * - Custom test free-text (catalog-only for now; "add custom" arrives
 *   in 4.1.B alongside the rich-form lift)
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

import catalogService from '../../../../services/CatalogIntegrationService';
import { useDraftOrderBundle } from './DraftOrderBundleProvider';

// Mapping from our internal tab "kind" to the FHIR
// ServiceRequest.category coding. The codes follow the SNOMED CT system
// already used by config/serviceRequestDialogConfig.js's ORDER_CATEGORIES
// so anything that reads the saved resource sees a consistent category
// regardless of which entry surface (CPOE vs. Unified) created it.
const CATEGORY_CODINGS = {
  laboratory: {
    system: 'http://snomed.info/sct',
    code: '108252007',
    display: 'Laboratory procedure',
  },
  imaging: {
    system: 'http://snomed.info/sct',
    code: '363679005',
    display: 'Imaging',
  },
  procedure: {
    system: 'http://snomed.info/sct',
    code: '387713003',
    display: 'Surgical procedure',
  },
};

const PRIORITIES = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'asap', label: 'ASAP' },
  { value: 'stat', label: 'STAT' },
];

/**
 * @param {object} props
 * @param {'laboratory' | 'imaging' | 'procedure'} props.category
 * @param {string} props.kindLabel — Human label rendered in placeholder/help
 *   (e.g. "lab test", "imaging study", "procedure").
 */
const OrderEntryForm = ({ category, kindLabel }) => {
  const { patientId, addDraft } = useDraftOrderBundle();

  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [indication, setIndication] = useState('');
  const [priority, setPriority] = useState('routine');
  const [error, setError] = useState(null);

  // Debounced catalog search — 250ms matches the composer's pattern so
  // typing speed feels consistent across surfaces. For 'laboratory' we
  // call getLabTests (LOINC-backed); for imaging/procedure we fall back
  // to a free-text search via the FHIR proxy because the catalog service
  // doesn't yet expose dedicated methods for those domains.
  useEffect(() => {
    const handle = setTimeout(async () => {
      const q = search.trim();
      if (q.length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        let items = [];
        if (category === 'laboratory') {
          items = await catalogService.getLabTests(q, null, 25);
        } else {
          // Imaging / procedure: no dedicated catalog method yet. Empty
          // results push the user toward the legacy CPOE dialog for
          // these types in the MVP. Phase 4.1.B will add proper catalog
          // sourcing.
          items = [];
        }
        setResults(Array.isArray(items) ? items : []);
      } catch (e) {
        console.warn('OrderEntryForm: catalog search failed', e);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [search, category]);

  const canAdd = useMemo(
    () => Boolean(selected && indication.trim().length >= 5),
    [selected, indication],
  );

  const handleAdd = useCallback(() => {
    if (!canAdd) {
      setError('Pick a code and provide a clinical indication (5+ chars).');
      return;
    }
    setError(null);

    const draft = {
      resourceType: 'ServiceRequest',
      // status='draft' — Phase 3 contract. Sign All flips to 'active'.
      status: 'draft',
      intent: 'order',
      priority,
      subject: { reference: `Patient/${patientId}` },
      authoredOn: new Date().toISOString(),
      category: [{ coding: [CATEGORY_CODINGS[category]] }],
      code: {
        coding: [
          {
            system: selected.system || 'http://loinc.org',
            code: selected.code,
            display: selected.display,
          },
        ],
        text: selected.display,
      },
      reasonCode: [{ text: indication.trim() }],
    };

    addDraft(draft);

    // Reset for the next compose-and-add cycle. Keep the priority — most
    // batches in a single session share a priority.
    setSelected(null);
    setSearch('');
    setResults([]);
    setIndication('');
  }, [canAdd, patientId, priority, selected, indication, category, addDraft]);

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      {error && <Alert severity="error">{error}</Alert>}

      {category !== 'laboratory' && (
        <Alert severity="info">
          {kindLabel} catalog search is limited in this MVP. For full
          imaging/procedure entry, use the legacy CPOE dialog. Phase 4.1.B
          will land the rich form here.
        </Alert>
      )}

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
                  {opt.system?.split('/').pop()} · {opt.code}
                </Typography>
              </Stack>
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={`Search ${kindLabel}`}
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
        placeholder="Why is this being ordered?"
        multiline
        minRows={2}
        helperText="At least 5 characters."
      />

      <FormControl size="small" sx={{ maxWidth: 200 }}>
        <InputLabel>Priority</InputLabel>
        <Select value={priority} onChange={(e) => setPriority(e.target.value)} label="Priority">
          {PRIORITIES.map((p) => (
            <MenuItem key={p.value} value={p.value}>
              {p.label}
            </MenuItem>
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

export default OrderEntryForm;
