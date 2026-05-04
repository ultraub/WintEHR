/**
 * ValueSet Composer — modal dialog for student ValueSet authoring.
 *
 * Three sections, in priority order:
 *   1. Catalog autocomplete: search the existing wintehr-* catalogs
 *      (Conditions, Medications, Lab Tests, Vital Signs) via
 *      CatalogIntegrationService and multi-select results
 *   2. Manual entry: paste any (system, code, display) tuple — necessary
 *      for codes not in the loaded catalogs
 *   3. Selected codes table: running list with remove + system grouping;
 *      this is what the FHIR ValueSet ends up containing
 *
 * On Save the composer POSTs to /api/cds-studio/value-sets, gets back the
 * canonical URL, and calls onSave({name, hapi_canonical_url, vs_id}).
 * The parent component (CQLEditor) inserts a `valueset "Name": '<url>'`
 * declaration at the cursor position.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

import catalogService from '../../../../services/CatalogIntegrationService';
import cdsStudioApi from '../../services/cdsStudioApi';

// Catalog domains exposed by CatalogIntegrationService; each entry maps to a
// fetch function on the singleton service. Domains pointing at a wintehr-*
// terminology ValueSet expand it via HAPI's $expand operation.
const DOMAINS = [
  { id: 'conditions', label: 'Conditions', fetch: (q, n) => catalogService.getConditions(q, null, n) },
  { id: 'medications', label: 'Medications', fetch: (q, n) => catalogService.getMedications(q, n) },
  { id: 'labs', label: 'Lab Tests', fetch: (q, n) => catalogService.getLabTests(q, null, n) },
  { id: 'vitals', label: 'Vital Signs', fetch: () => catalogService.getVitalSigns?.() ?? [] },
  { id: 'vaccines', label: 'Vaccines (CVX)', fetch: (q, n) => catalogService.expandTerminologyValueSet('wintehr-vaccines', q, n) },
];

// Known terminology system URIs used to validate manual-entry tuples and to
// hint to students when they paste a system URL the platform recognizes.
const KNOWN_SYSTEMS = [
  { uri: 'http://snomed.info/sct', label: 'SNOMED CT' },
  { uri: 'http://hl7.org/fhir/sid/icd-10-cm', label: 'ICD-10-CM' },
  { uri: 'http://www.nlm.nih.gov/research/umls/rxnorm', label: 'RxNorm' },
  { uri: 'http://loinc.org', label: 'LOINC' },
  { uri: 'http://hl7.org/fhir/sid/cvx', label: 'CVX (vaccines)' },
  { uri: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', label: 'HL7 ActCode' },
];

// Name is the quoted identifier used in CQL `valueset "X": '...'` declarations
// AND the FHIR `ValueSet.name` field. CQL accepts arbitrary quoted strings so
// spaces are fine; FHIR `name` is data type `string` (not `id`), so spaces are
// spec-legal there too. Earlier rule (PascalCase only) forced declarations to
// disagree with LLM-generated retrieves like `[Condition: "Diabetes Mellitus"]`,
// which students then had to debug. We just require a leading letter.
const FHIR_NAME_RE = /^[A-Za-z][A-Za-z0-9_ -]{0,499}$/;

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {(payload: {name: string, hapi_canonical_url: string, vs_id: string}) => void}
 *   props.onSave — called after successful save (POST for create, PUT for edit).
 * @param {string} [props.suggestedName] — pre-filled FHIR Name (CQL identifier).
 *   Only used in create mode; ignored when editing.
 * @param {object} [props.editingValueSet] — when present, opens in edit mode:
 *   `{ vs_id, name, title, description, codes: [{system, code, display}] }`.
 *   Save calls PUT instead of POST. The `name` field is locked (canonical
 *   identity in HAPI; rename would require re-uploading a new ValueSet
 *   resource and rewriting CQL retrieves).
 */
const ValueSetComposer = ({
  open,
  onClose,
  onSave,
  suggestedName = '',
  editingValueSet = null,
}) => {
  const isEditMode = Boolean(editingValueSet);
  // Form fields
  const [name, setName] = useState(suggestedName);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Catalog search state
  const [domain, setDomain] = useState(DOMAINS[0].id);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  // Manual entry state
  const [manualSystem, setManualSystem] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [manualDisplay, setManualDisplay] = useState('');
  const [manualError, setManualError] = useState(null);

  // Running list of selected codes — what the ValueSet will contain.
  // Keyed by `${system}|${code}` for dedup.
  const [selected, setSelected] = useState([]);

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Reset on open. In edit mode, hydrate from the supplied editingValueSet
  // so the user sees the current name/title/description/codes; in create
  // mode start fresh with the suggested name.
  useEffect(() => {
    if (!open) return;
    if (editingValueSet) {
      setName(editingValueSet.name || '');
      setTitle(editingValueSet.title || '');
      setDescription(editingValueSet.description || '');
      setSelected(
        Array.isArray(editingValueSet.codes)
          ? editingValueSet.codes.map((c) => ({
              system: c.system,
              code: c.code,
              display: c.display,
            }))
          : []
      );
    } else {
      setName(suggestedName);
      setTitle('');
      setDescription('');
      setSelected([]);
    }
    setSearch('');
    setSearchResults([]);
    setManualSystem('');
    setManualCode('');
    setManualDisplay('');
    setManualError(null);
    setSaveError(null);
  }, [open, suggestedName, editingValueSet]);

  // Debounced catalog search.
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const fetcher = DOMAINS.find((d) => d.id === domain)?.fetch;
        if (!fetcher) return;
        const results = await fetcher(search.trim(), 50);
        setSearchResults(Array.isArray(results) ? results : []);
      } catch (err) {
        console.warn('Catalog search failed:', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [open, domain, search]);

  const selectedKeys = useMemo(
    () => new Set(selected.map((c) => `${c.system}|${c.code}`)),
    [selected],
  );

  const addCode = useCallback((code) => {
    const key = `${code.system}|${code.code}`;
    setSelected((prev) => (prev.some((c) => `${c.system}|${c.code}` === key) ? prev : [...prev, code]));
  }, []);

  const removeCode = useCallback((system, code) => {
    setSelected((prev) => prev.filter((c) => !(c.system === system && c.code === code)));
  }, []);

  const toggleResult = useCallback(
    (result) => {
      // A catalog result with no system is a bug in the source catalog —
      // a code without a system is unmatchable in FHIR (different systems
      // can reuse the same code value), and silently dropping the system
      // here causes round-trip failures (e.g. a vaccine code in the VS
      // never matching Immunization.vaccineCode at $apply time). Reject
      // it loudly so the catalog gets fixed instead.
      if (!result.system || !result.code) {
        console.warn('Catalog result missing system or code, refusing to add:', result);
        return;
      }
      const code = {
        system: result.system,
        code: result.code,
        display: result.display,
      };
      const key = `${code.system}|${code.code}`;
      if (selectedKeys.has(key)) {
        removeCode(code.system, code.code);
      } else {
        addCode(code);
      }
    },
    [selectedKeys, addCode, removeCode],
  );

  const addManual = useCallback(() => {
    const sys = manualSystem.trim();
    const c = manualCode.trim();
    const d = manualDisplay.trim();
    if (!sys || !c) {
      setManualError('System URI and code are required');
      return;
    }
    if (!/^https?:\/\//.test(sys) && !sys.startsWith('urn:')) {
      setManualError('System URI must be an http(s):// URL or a urn:');
      return;
    }
    addCode({ system: sys, code: c, display: d || undefined });
    setManualSystem('');
    setManualCode('');
    setManualDisplay('');
    setManualError(null);
  }, [manualSystem, manualCode, manualDisplay, addCode]);

  const nameValid = FHIR_NAME_RE.test(name);
  const canSave = nameValid && selected.length > 0 && !saving;

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        name,
        title: title || undefined,
        description: description || undefined,
        codes: selected.map((c) => ({
          system: c.system,
          code: c.code,
          display: c.display,
        })),
      };
      // PUT in edit mode — the backend handler re-PUTs the FHIR ValueSet
      // to HAPI when the code list changes and flushes the CR engine's
      // expansion cache, so the next $apply for any service that
      // references this VS sees the new codes.
      const result = isEditMode
        ? await cdsStudioApi.updateValueSet(editingValueSet.vs_id, payload)
        : await cdsStudioApi.createValueSet(payload);
      onSave?.({
        name: result.name,
        hapi_canonical_url: result.hapi_canonical_url,
        vs_id: result.vs_id,
      });
      onClose?.();
    } catch (err) {
      setSaveError(err?.message || 'Failed to save ValueSet');
    } finally {
      setSaving(false);
    }
  }, [canSave, name, title, description, selected, onSave, onClose, isEditMode, editingValueSet]);

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        {isEditMode ? `Edit ValueSet — ${editingValueSet.name}` : 'Compose a ValueSet'}
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={onClose} disabled={saving} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          {/* Section 1: Identity */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              ValueSet identity
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Diabetes Mellitus"
                helperText={
                  isEditMode
                    ? "Name is the canonical identity; rename isn't supported (would re-publish under a new URL)."
                    : (nameValid || !name
                      ? 'Used in CQL as `valueset "Name": ...` and in retrieves. Spaces are fine.'
                      : 'Must start with a letter; only letters, digits, spaces, hyphens, and underscores allowed.')
                }
                error={!!name && !nameValid}
                disabled={isEditMode}
                required
                sx={{ flex: 1 }}
              />
              <TextField
                label="Human-readable title (optional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Diabetes Conditions"
                sx={{ flex: 1 }}
              />
            </Stack>
            <TextField
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Codes used to identify diabetes-related conditions"
              fullWidth
              sx={{ mt: 2 }}
            />
          </Box>

          <Divider />

          {/* Section 2: Catalog search */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Search existing catalogs
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <FormControl sx={{ minWidth: 180 }}>
                <InputLabel>Domain</InputLabel>
                <Select value={domain} onChange={(e) => setDomain(e.target.value)} label="Domain">
                  {DOMAINS.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type to search…"
                fullWidth
                InputProps={{
                  endAdornment: searching ? <CircularProgress size={18} /> : null,
                }}
              />
            </Stack>
            <Paper
              variant="outlined"
              sx={{ mt: 1, maxHeight: 220, overflow: 'auto', borderRadius: 1 }}
            >
              {searchResults.length === 0 && !searching && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ p: 2, textAlign: 'center' }}
                >
                  No results — adjust the search term, or use manual entry below.
                </Typography>
              )}
              {searchResults.map((r) => {
                const key = `${r.system}|${r.code}`;
                const isSelected = selectedKeys.has(key);
                return (
                  <Box
                    key={key + (r.id || '')}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 2,
                      py: 0.5,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                    onClick={() => toggleResult(r)}
                  >
                    <Checkbox
                      checked={isSelected}
                      tabIndex={-1}
                      size="small"
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleResult(r)}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap>
                        {r.display || r.code}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {r.system?.split('/').pop()}|{r.code}
                      </Typography>
                    </Box>
                    {r.usage_count != null && r.usage_count > 0 && (
                      <Tooltip title={`Used in ${r.usage_count} patient resources`}>
                        <Chip label={r.usage_count} size="small" variant="outlined" />
                      </Tooltip>
                    )}
                  </Box>
                );
              })}
            </Paper>
          </Box>

          <Divider />

          {/* Section 3: Manual entry */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Add a code manually
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems="flex-start">
              <Autocomplete
                freeSolo
                options={KNOWN_SYSTEMS.map((s) => s.uri)}
                getOptionLabel={(opt) => opt}
                renderOption={(props, opt) => {
                  const known = KNOWN_SYSTEMS.find((s) => s.uri === opt);
                  return (
                    <li {...props}>
                      <Box>
                        <Typography variant="body2">{opt}</Typography>
                        {known && (
                          <Typography variant="caption" color="text.secondary">
                            {known.label}
                          </Typography>
                        )}
                      </Box>
                    </li>
                  );
                }}
                value={manualSystem}
                onChange={(_e, v) => setManualSystem(v || '')}
                onInputChange={(_e, v) => setManualSystem(v || '')}
                sx={{ flex: 2, minWidth: 220 }}
                renderInput={(params) => <TextField {...params} label="System URI" />}
              />
              <TextField
                label="Code"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Display (optional)"
                value={manualDisplay}
                onChange={(e) => setManualDisplay(e.target.value)}
                sx={{ flex: 2 }}
              />
              <Button
                onClick={addManual}
                startIcon={<AddIcon />}
                variant="outlined"
                size="medium"
                sx={{ height: 56, mt: { xs: 1, md: 0 } }}
              >
                Add
              </Button>
            </Stack>
            {manualError && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                {manualError}
              </Typography>
            )}
          </Box>

          <Divider />

          {/* Section 4: Selected codes (the actual ValueSet contents) */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Selected codes ({selected.length})
            </Typography>
            {selected.length === 0 ? (
              <Alert severity="info" sx={{ borderRadius: 0 }}>
                Pick at least one code from the catalog or add one manually.
              </Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>System</TableCell>
                      <TableCell>Code</TableCell>
                      <TableCell>Display</TableCell>
                      <TableCell width={48} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selected.map((c) => (
                      <TableRow key={`${c.system}|${c.code}`}>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                          {c.system}
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                          {c.code}
                        </TableCell>
                        <TableCell>{c.display || ''}</TableCell>
                        <TableCell padding="none">
                          <IconButton size="small" onClick={() => removeCode(c.system, c.code)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>

          {saveError && <Alert severity="error">{saveError}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!canSave}
          startIcon={saving ? <CircularProgress size={16} /> : null}
        >
          Save ValueSet
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ValueSetComposer;
