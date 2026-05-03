/**
 * Suggestion Action Builder
 *
 * Templated builder for CDS Hooks 2.0 suggestion actions. Each action emits
 * `{ type: 'create', description, resource: <FHIR resource> }`. The runtime
 * (`backend/api/cds_hooks/actions/executor.py::_execute_create_action`)
 * accepts a partial resource — it auto-injects `id`, `subject`, `requester`,
 * and `encounter` from the hook context, so this builder only needs to
 * supply `resourceType`, `status`, `intent`, and `code`.
 *
 * Templates cover the common student use cases (order a lab, prescribe,
 * add a problem, refer). Each is a thin wrapper that picks a code from
 * the matching catalog and stamps it into a fixed FHIR skeleton. Custom
 * (free-form) actions are out of scope here — see the plan in
 * `~/.claude/plans/we-want-students-to-sharded-pond.md`.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Stack,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  IconButton,
  Button,
  Alert,
  Chip,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

import cdsClinicalDataService from '../../../../services/cdsClinicalDataService';

/**
 * Template registry. Each template knows:
 *   - resourceType: FHIR type the action will create
 *   - fetchCodes: how to populate the code-picker from the live catalog
 *   - getCodeKey/getCodeDisplay: how to render an option from the catalog
 *   - buildResource: produces the partial FHIR resource handed to the runtime
 *
 * The runtime fills in id/subject/requester/encounter on execute.
 */
const ACTION_TEMPLATES = {
  'order-lab': {
    label: 'Order Lab',
    resourceType: 'ServiceRequest',
    codeLabel: 'Lab test',
    placeholder: 'e.g. HbA1c, CBC, Lipid panel',
    fetchCodes: (search) => cdsClinicalDataService.getLabCatalog(search || null, null, 25),
    getCodeKey: (item) => item.loinc_code || item.test_code || item.id,
    getCodeDisplay: (item) => item.test_name || item.display || item.loinc_code,
    buildResource: (codeItem) => ({
      resourceType: 'ServiceRequest',
      status: 'draft',
      intent: 'order',
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'laboratory',
          display: 'Laboratory'
        }]
      }],
      code: {
        coding: [{
          system: 'http://loinc.org',
          code: codeItem.loinc_code || codeItem.test_code,
          display: codeItem.test_name || codeItem.display
        }],
        text: codeItem.test_name || codeItem.display
      }
    })
  },

  'order-medication': {
    label: 'Order Medication',
    resourceType: 'MedicationRequest',
    codeLabel: 'Medication',
    placeholder: 'e.g. Metformin, Atorvastatin',
    fetchCodes: (search) => cdsClinicalDataService.getDynamicMedicationCatalog(search || null, 25),
    getCodeKey: (item) => item.rxnorm_code || item.id,
    getCodeDisplay: (item) => item.generic_name || item.brand_name || item.rxnorm_code,
    buildResource: (codeItem) => ({
      resourceType: 'MedicationRequest',
      status: 'draft',
      intent: 'order',
      medicationCodeableConcept: {
        coding: [{
          system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
          code: codeItem.rxnorm_code,
          display: codeItem.generic_name || codeItem.brand_name
        }],
        text: codeItem.generic_name || codeItem.brand_name
      }
    })
  },

  'add-problem': {
    label: 'Add Problem',
    resourceType: 'Condition',
    codeLabel: 'Problem',
    placeholder: 'e.g. Hypertension, Type 2 diabetes',
    fetchCodes: (search) => cdsClinicalDataService.getDynamicConditionCatalog(search || null, 25),
    // Conditions catalog returns SNOMED concepts as { code, display, ... }.
    getCodeKey: (item) => item.code || item.snomed_code || item.id,
    getCodeDisplay: (item) => item.display || item.code,
    buildResource: (codeItem) => ({
      resourceType: 'Condition',
      clinicalStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active'
        }]
      },
      verificationStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: 'confirmed'
        }]
      },
      code: {
        coding: [{
          system: 'http://snomed.info/sct',
          code: codeItem.code || codeItem.snomed_code,
          display: codeItem.display
        }],
        text: codeItem.display
      }
    })
  },

  'refer': {
    label: 'Refer',
    resourceType: 'ServiceRequest',
    codeLabel: 'Referral',
    placeholder: 'e.g. Cardiology consult, Diabetes education',
    // No clean catalog for "specialty" — students enter the display freely
    // and we mint a minimal SNOMED-aligned referral. Backend just needs a
    // valid resource shape; the code text is the display the EMR shows.
    fetchCodes: null,
    getCodeKey: null,
    getCodeDisplay: null,
    buildResource: (codeItem) => ({
      resourceType: 'ServiceRequest',
      status: 'draft',
      intent: 'order',
      category: [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: '3457005',
          display: 'Patient referral'
        }]
      }],
      code: {
        text: codeItem.display || 'Referral'
      }
    })
  }
};

/**
 * One action editor row.
 */
const ActionRow = ({ action, onChange, onDelete }) => {
  const templateId = action.templateId || 'order-lab';
  const template = ACTION_TEMPLATES[templateId] || ACTION_TEMPLATES['order-lab'];

  const [search, setSearch] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Free-text fallback for templates without a catalog (referral, etc.)
  const [freeText, setFreeText] = useState(action.codeItem?.display || '');

  // Re-fetch catalog when template changes or search updates. Debounced via
  // a 200ms timer so each keystroke doesn't fire a request.
  useEffect(() => {
    if (!template.fetchCodes) {
      setOptions([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await template.fetchCodes(search);
        setOptions(Array.isArray(data) ? data : []);
      } catch (e) {
        // Swallow — the picker just shows an empty list. The user can
        // type their own code via the description field.
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [template, search]);

  const handleTemplateChange = (newTemplateId) => {
    const newTemplate = ACTION_TEMPLATES[newTemplateId];
    if (!newTemplate) return;
    // Reset code selection — the previous codeItem is from a different
    // catalog and won't make sense here.
    onChange({
      ...action,
      templateId: newTemplateId,
      codeItem: null,
      description: newTemplate.label
    });
    setSearch('');
    setFreeText('');
  };

  const handleCodeSelect = (codeItem) => {
    if (!codeItem) {
      onChange({ ...action, codeItem: null });
      return;
    }
    onChange({
      ...action,
      codeItem,
      // If the description is blank or matches the template default, fill
      // it from the picked code so the runtime's required-description
      // validation passes without forcing the student to retype.
      description:
        action.description && action.description !== template.label
          ? action.description
          : `${template.label}: ${template.getCodeDisplay(codeItem)}`
    });
  };

  const handleFreeTextSubmit = (text) => {
    setFreeText(text);
    if (!text) {
      onChange({ ...action, codeItem: null });
      return;
    }
    onChange({
      ...action,
      codeItem: { display: text },
      description:
        action.description && action.description !== template.label
          ? action.description
          : `${template.label}: ${text}`
    });
  };

  const handleDescriptionChange = (text) => {
    onChange({ ...action, description: text });
  };

  return (
    <Paper elevation={0} sx={{ p: 2, mb: 1.5, backgroundColor: 'grey.50' }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Action template</InputLabel>
            <Select
              value={templateId}
              label="Action template"
              onChange={(e) => handleTemplateChange(e.target.value)}
            >
              {Object.entries(ACTION_TEMPLATES).map(([id, t]) => (
                <MenuItem key={id} value={id}>{t.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Chip
            label={template.resourceType}
            size="small"
            sx={{ fontFamily: 'monospace' }}
          />

          <Box sx={{ flex: 1 }} />

          <IconButton
            size="small"
            color="error"
            onClick={onDelete}
            aria-label="Delete action"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>

        {template.fetchCodes ? (
          <Autocomplete
            size="small"
            options={options}
            value={action.codeItem || null}
            loading={loading}
            getOptionLabel={(opt) =>
              opt && template.getCodeDisplay
                ? template.getCodeDisplay(opt) || ''
                : ''
            }
            isOptionEqualToValue={(a, b) =>
              template.getCodeKey(a) === template.getCodeKey(b)
            }
            onInputChange={(_, val) => setSearch(val)}
            onChange={(_, val) => handleCodeSelect(val)}
            renderInput={(params) => (
              <TextField
                {...params}
                label={template.codeLabel}
                placeholder={template.placeholder}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loading && <CircularProgress size={16} />}
                      {params.InputProps.endAdornment}
                    </>
                  )
                }}
              />
            )}
          />
        ) : (
          <TextField
            size="small"
            label={template.codeLabel}
            placeholder={template.placeholder}
            value={freeText}
            onChange={(e) => handleFreeTextSubmit(e.target.value)}
            fullWidth
          />
        )}

        <TextField
          size="small"
          label="Description (shown to clinician)"
          value={action.description || ''}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder={template.label}
          fullWidth
          required
          helperText="Required by the runtime — shown next to the Accept button"
        />
      </Stack>
    </Paper>
  );
};

/**
 * Convert a builder-state action (with `templateId` + `codeItem`) into the
 * shape the runtime executes: `{ type, description, resource }`. Builder
 * state is kept richer because we need to remember which template/code
 * the student picked when re-opening the wizard.
 */
export function actionToRuntimeShape(action) {
  const template = ACTION_TEMPLATES[action.templateId];
  if (!template || !action.codeItem) return null;
  return {
    type: 'create',
    description: action.description || template.label,
    resource: template.buildResource(action.codeItem)
  };
}

/**
 * Reverse: given a runtime-shape action that came back from a saved
 * service, infer which template/code it was built from so the picker can
 * re-hydrate. We discriminate by resourceType (+ category for
 * ServiceRequest, since both labs and referrals are ServiceRequests).
 *
 * Returns null if the resource doesn't match any known template, in which
 * case the editor shows it as an "Order Lab" default — the user can re-pick.
 */
export function runtimeToBuilderState(runtimeAction) {
  const resource = runtimeAction?.resource;
  if (!resource || typeof resource !== 'object') return null;

  const rt = resource.resourceType;
  let templateId = null;

  if (rt === 'MedicationRequest') {
    templateId = 'order-medication';
  } else if (rt === 'Condition') {
    templateId = 'add-problem';
  } else if (rt === 'ServiceRequest') {
    const catCode = resource.category?.[0]?.coding?.[0]?.code;
    if (catCode === 'laboratory') templateId = 'order-lab';
    else templateId = 'refer';
  }

  if (!templateId) return null;

  // Synthesize a codeItem from the persisted resource so the picker shows
  // a populated value without re-fetching the catalog. The shape only needs
  // the fields the template's getCodeDisplay/buildResource consume.
  const coding = rt === 'MedicationRequest'
    ? resource.medicationCodeableConcept?.coding?.[0] || {}
    : resource.code?.coding?.[0] || {};
  const text = rt === 'MedicationRequest'
    ? resource.medicationCodeableConcept?.text
    : resource.code?.text;

  let codeItem;
  if (templateId === 'order-lab') {
    codeItem = {
      loinc_code: coding.code,
      test_name: coding.display || text,
      test_code: coding.code
    };
  } else if (templateId === 'order-medication') {
    codeItem = {
      rxnorm_code: coding.code,
      generic_name: coding.display || text
    };
  } else if (templateId === 'add-problem') {
    codeItem = {
      code: coding.code,
      display: coding.display || text
    };
  } else {
    codeItem = { display: text || '' };
  }

  return {
    templateId,
    codeItem,
    description: runtimeAction.description || ''
  };
}

/**
 * Main builder. The component receives runtime-shape actions on the way in
 * and emits runtime-shape actions on the way out, so the persisted card
 * stays clean. Builder-state (templateId, codeItem) lives in local React
 * state and is reconstructed from runtime shape on init.
 *
 * Props:
 *   - actions: array of runtime-shape action objects from the parent
 *   - onChange: called with the updated runtime-shape array
 */
const SuggestionActionBuilder = ({ actions = [], onChange }) => {
  // Local builder state. Initialized from the parent's runtime-shape props
  // exactly once — subsequent edits are user-driven and round-trip through
  // onChange. We don't sync from props on every render because that would
  // overwrite in-flight edits with the parent's stale runtime shape.
  const [builderActions, setBuilderActions] = useState(() =>
    (Array.isArray(actions) ? actions : [])
      .map((a) => runtimeToBuilderState(a) || {
        templateId: 'order-lab',
        codeItem: null,
        description: a?.description || ''
      })
  );

  // Whenever builder state changes, emit the runtime shape (filtered to
  // exclude incomplete entries) up to the parent.
  useEffect(() => {
    const runtime = builderActions
      .map(actionToRuntimeShape)
      .filter(Boolean);
    onChange(runtime);
    // We intentionally exclude `onChange` from deps — parents typically
    // re-create the handler each render, which would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [builderActions]);

  const handleAdd = useCallback(() => {
    setBuilderActions((prev) => [
      ...prev,
      {
        templateId: 'order-lab',
        codeItem: null,
        description: ''
      }
    ]);
  }, []);

  const handleActionChange = useCallback((index, updated) => {
    setBuilderActions((prev) => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  }, []);

  const handleDelete = useCallback((index) => {
    setBuilderActions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const safeActions = builderActions;
  const incompleteCount = safeActions.filter(
    (a) => !a.codeItem
  ).length;

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          Actions
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          variant="outlined"
        >
          Add action
        </Button>
      </Stack>

      {safeActions.length === 0 && (
        <Alert severity="info" sx={{ mb: 1 }}>
          <Typography variant="body2">
            No actions yet. A suggestion without actions still shows the
            label and acknowledges on Accept, but nothing is created.
          </Typography>
        </Alert>
      )}

      {safeActions.map((action, idx) => (
        <ActionRow
          key={idx}
          action={action}
          onChange={(updated) => handleActionChange(idx, updated)}
          onDelete={() => handleDelete(idx)}
        />
      ))}

      {incompleteCount > 0 && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          <Typography variant="body2">
            {incompleteCount} action{incompleteCount > 1 ? 's' : ''} missing
            a selected code. Incomplete actions will be dropped on save.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

export default SuggestionActionBuilder;
