/**
 * DiagnosisPicker — multi-select linking orders to active Conditions
 * (#116, Phase 4.1.C).
 *
 * Real EHRs require diagnosis association on most orders — it's how
 * payers route the claim, how labs confirm medical necessity, and how
 * downstream CDS picks up clinical context. Each tab in the composer
 * uses this picker; the result lands in the draft's
 * `reasonReference[]` as `Condition/{id}` refs.
 *
 * Loads the patient's active Conditions on mount (one fetch per dialog
 * open — the Conditions list doesn't change while the user composes).
 * Falls back gracefully on fetch failure — diagnosis association is
 * optional; CDS still fires without it.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Autocomplete,
  Box,
  Chip,
  CircularProgress,
  TextField,
  Typography,
} from '@mui/material';

import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import { useDraftOrderBundle } from './DraftOrderBundleProvider';

// Cache active-conditions by patient id within a single dialog session.
// The dialog tears down (provider unmounts → this module-level Map
// stays, fine across sessions). Conditions list doesn't change while
// composing — no point re-fetching every keystroke or tab switch.
const _cache = new Map();

// Strip the obvious clinical-stub displays from problem-list strings so
// the autocomplete options are readable. Synthea conditions sometimes
// have inline coding system + version cruft that students don't need.
function conditionLabel(condition) {
  return (
    condition?.code?.text
    || condition?.code?.coding?.[0]?.display
    || condition?.code?.coding?.[0]?.code
    || 'Unknown condition'
  );
}

/**
 * @param {object} props
 * @param {Array<{id: string, label: string}>} props.value — currently
 *   selected conditions
 * @param {(next: Array<{id: string, label: string}>) => void} props.onChange
 */
const DiagnosisPicker = ({ value, onChange }) => {
  const { patientId } = useDraftOrderBundle();

  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load once per dialog open. The provider remounts on each dialog
  // open, so this effect re-runs naturally — no need for manual cache
  // invalidation. The module-level _cache is a defensive shortcut for
  // tab-switch re-renders within a single dialog session.
  useEffect(() => {
    if (!patientId) return;
    if (_cache.has(patientId)) {
      setOptions(_cache.get(patientId));
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const bundle = await fhirClient.search('Condition', {
          patient: `Patient/${patientId}`,
          'clinical-status': 'active',
          _sort: '-recorded-date',
          _count: 100,
        });
        // fhirClient.search returns either {resources: []} or {entry: []}
        // depending on whether the response interceptor unwrapped it.
        // Defensive: handle both shapes.
        const conditions =
          (bundle?.resources && Array.isArray(bundle.resources) && bundle.resources)
          || (bundle?.entry || []).map((e) => e.resource).filter(Boolean);
        const opts = conditions.map((c) => ({
          id: c.id,
          label: conditionLabel(c),
        }));
        if (!cancelled) {
          _cache.set(patientId, opts);
          setOptions(opts);
        }
      } catch (e) {
        console.warn('DiagnosisPicker: condition fetch failed', e);
        if (!cancelled) setError(e?.message || 'Failed to load conditions');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const handleChange = useCallback((_event, next) => {
    onChange(next || []);
  }, [onChange]);

  return (
    <Box>
      <Autocomplete
        multiple
        options={options}
        loading={loading}
        value={value || []}
        onChange={handleChange}
        getOptionLabel={(opt) => opt?.label || ''}
        isOptionEqualToValue={(a, b) => a?.id === b?.id}
        renderTags={(tags, getTagProps) =>
          tags.map((t, idx) => (
            <Chip
              {...getTagProps({ index: idx })}
              key={t.id}
              label={t.label}
              size="small"
              variant="outlined"
            />
          ))
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label="Link to diagnosis"
            placeholder={options.length === 0 && !loading ? 'No active conditions on file' : 'Select one or more'}
            helperText={error ? `(${error})` : 'Optional. Helps CDS context and downstream routing.'}
            size="small"
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress size={16} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
        size="small"
      />
      {options.length === 0 && !loading && !error && (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
          No active conditions found. Order will be saved without a diagnosis reference.
        </Typography>
      )}
    </Box>
  );
};

/**
 * Convert the picker's selection shape into FHIR
 * `reasonReference[]` for inclusion on a draft order. Pure helper so
 * tabs don't repeat the same projection.
 */
export function toReasonReference(selected) {
  if (!Array.isArray(selected) || selected.length === 0) return undefined;
  return selected.map((s) => ({
    reference: `Condition/${s.id}`,
    display: s.label,
  }));
}

export default DiagnosisPicker;
