/**
 * Visual Builder Wizard
 *
 * Step-by-step wizard for creating CDS services visually.
 * Guides users through:
 * 1. Service Configuration (type, name, description)
 * 2. Build Logic (visual condition tree OR CQL)
 * 3. Card Design (WYSIWYG editor + suggestion action templates)
 * 4. Prefetch (auto-derived for CQL)
 * 5. Test & Deploy (run against synthetic patients, then deploy)
 *
 * The earlier "Configure Display" step was removed: its data path was broken
 * (prop-name mismatch + no runtime that consumed `display_config`), so it
 * stored values that never affected behavior. The Test and Review steps
 * were also merged — they share the same saved-draft service and the
 * review summary fits naturally above the deploy button.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  Box,
  Typography,
  Alert,
  CircularProgress,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Paper,
  Divider
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  ArrowForward as ForwardIcon,
  CheckCircle as DeployIcon
} from '@mui/icons-material';

import ConditionBuilder from '../builders/ConditionBuilder';
import CardDesigner from '../builders/CardDesigner';
import CQLEditor from '../builders/CQLEditor';
import PrefetchEditor from '../builders/PrefetchEditor';
import CardPreviewPanel from '../preview/CardPreviewPanel';
import ServiceTester from '../testing/ServiceTester';
import { SERVICE_TYPES } from '../../types/serviceTypes';
import cdsStudioApi from '../../services/cdsStudioApi';
import { useAuth } from '../../../../contexts/AuthContext';
import { extractCardDefinesFromCQL } from '../../utils/cqlDefineExtractor';
import axios from 'axios';

const CQL_SERVICE_TYPE = 'cql-based';

// Step 1 label varies by service type — `renderConditionBuilder` renders
// either ConditionBuilder (visual) or CQLEditor (CQL). The step list itself
// uses a single neutral label so the stepper looks the same for both paths.
const steps = [
  'Service Configuration',
  'Build Logic',
  'Design Card',
  'Prefetch',
  'Test & Deploy'
];

// Step indices — referenced by validateCurrentStep, renderStepContent, and
// the auto-save trigger in handleNext.
const STEP_PREFETCH = 3;
const STEP_TEST_DEPLOY = 4;

/**
 * Visual Builder Wizard Component
 *
 * @param {Object|null} existingService - When non-null, the wizard opens in
 *   edit mode: it fetches the deployed config + referenced ValueSets and
 *   seeds the form. The final-step button becomes "Save and Re-deploy" and
 *   submits via PUT + redeploy instead of POST + deploy. The `service_id`
 *   field is locked because the id is the stable identifier across HAPI,
 *   the DB, and the discovery response.
 */
const buildEmptyServiceConfig = (createdBy) => ({
  service_id: '',
  name: '',
  description: '',
  service_type: 'condition-based',
  category: 'preventive-care',
  hook_type: 'patient-view',
  conditions: [
    {
      type: 'group',
      operator: 'AND',
      conditions: []
    }
  ],
  // CQL services store their logic here instead of in `conditions`. The
  // backend dispatcher reads `service_type` to decide which path runs.
  cql_source: '',
  card: {
    summary: '',
    detail: '',
    indicator: 'info',
    source: { label: '' },
    suggestions: [],
    links: []
  },
  // Backend Pydantic model (`DisplayConfiguration`) requires
  // `presentationMode`. We send the spec-default `'inline'` so saves
  // succeed; the wizard no longer surfaces display behavior because the
  // EMR runtime reads `card.displayBehavior` / `card.overrideReasons`,
  // not `service.display_config`. If someone wires per-service display
  // behavior into the runtime later, re-add the panel.
  display_config: { presentationMode: 'inline' },
  prefetch: {},
  created_by: createdBy || 'unknown'
});

const VisualBuilderWizard = ({ open, onClose, onSuccess, existingService = null }) => {
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [testResults, setTestResults] = useState(null);

  // Service configuration state
  const [serviceConfig, setServiceConfig] = useState(() => buildEmptyServiceConfig(user?.username));

  const [savedServiceId, setSavedServiceId] = useState(null);
  // ValueSets that the current CQL references — populated when editing an
  // existing service so PR 2 (inline VS edit list) has data to render.
  // For new services this stays empty.
  const [referencedValueSets, setReferencedValueSets] = useState([]);
  const isEditMode = Boolean(existingService);
  const isCQLService = serviceConfig.service_type === CQL_SERVICE_TYPE;

  // When CQL defines string-literal CardSummary / CardDetail, surface them
  // as overrides so CardDesigner shows a read-only preview instead of an
  // empty input. The CQL value wins at $apply time anyway.
  const cqlCardOverrides = useMemo(
    () => (isCQLService ? extractCardDefinesFromCQL(serviceConfig.cql_source) : {}),
    [isCQLService, serviceConfig.cql_source]
  );

  // After a ValueSet is created or edited inside the composer, refresh the
  // referenced-VS list so the inline panel reflects the new code count.
  // Only meaningful in edit mode (we have a deployed service to query); in
  // create mode there's nothing for /full-edit-state to return yet.
  const refreshReferencedValueSets = async () => {
    if (!isEditMode || !serviceConfig.service_id) return;
    try {
      const { data } = await axios.get(
        `/api/cds-visual-builder/services/${serviceConfig.service_id}/full-edit-state`
      );
      setReferencedValueSets(data.value_sets || []);
    } catch (err) {
      console.warn('Failed to refresh referenced ValueSets', err);
    }
  };

  // Edit-mode hydration: when the wizard opens with an existing service,
  // pull its full state (config + referenced ValueSets) in one round-trip
  // and seed the form. Skips draft-save (the row already exists in DB).
  useEffect(() => {
    if (!open || !existingService) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await axios.get(
          `/api/cds-visual-builder/services/${existingService.service_id}/full-edit-state`
        );
        if (cancelled) return;
        const svc = data.service || {};
        setServiceConfig({
          service_id: svc.service_id || existingService.service_id,
          name: svc.name || '',
          description: svc.description || '',
          service_type: svc.service_type || 'condition-based',
          category: svc.category || 'preventive-care',
          hook_type: svc.hook_type || 'patient-view',
          conditions: svc.conditions || [{ type: 'group', operator: 'AND', conditions: [] }],
          cql_source: svc.cql_source || '',
          card: svc.card_config || {
            summary: '',
            detail: '',
            indicator: 'info',
            source: { label: '' },
            suggestions: [],
            links: []
          },
          display_config: svc.display_config || { presentationMode: 'inline' },
          prefetch: svc.prefetch_config || {},
          created_by: svc.created_by || user?.username || 'unknown'
        });
        setReferencedValueSets(data.value_sets || []);
        setSavedServiceId(svc.id || existingService.id);
        setActiveStep(0);
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.detail || 'Failed to load service for editing');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, existingService, user?.username]);

  /**
   * Format error messages for display
   * Handles Pydantic validation errors (arrays of objects) and string errors
   */
  const formatError = (errorDetail) => {
    // Handle Pydantic validation errors (array of {type, loc, msg, input})
    if (Array.isArray(errorDetail)) {
      return errorDetail.map(err => {
        const location = err.loc ? err.loc.join('.') : 'unknown field';
        return `${location}: ${err.msg}`;
      }).join('; ');
    }

    // Handle string errors
    if (typeof errorDetail === 'string') {
      return errorDetail;
    }

    // Handle object errors
    if (errorDetail && typeof errorDetail === 'object') {
      return errorDetail.message || JSON.stringify(errorDetail);
    }

    // Fallback
    return 'An unknown error occurred';
  };

  const handleNext = async () => {
    // Validate current step before proceeding
    const validation = validateCurrentStep();
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setError(null);

    // Save (or re-save) the draft before moving into Test & Deploy. The
    // testing UI needs a real backend service to invoke, and the FHIR-
    // preview tab in the CQL editor needs to fetch the generated
    // Library + PlanDefinition. We always re-save on entry so edits in
    // step 2/3/4 after the first save get persisted — without this the
    // test panel runs against the previously-saved CQL.
    if (activeStep === STEP_PREFETCH) {
      await handleSaveDraft();
    }

    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setError(null);
    setActiveStep((prev) => prev - 1);
  };

  const validateCurrentStep = () => {
    switch (activeStep) {
      case 0: // Service Configuration
        if (!serviceConfig.service_id) {
          return { valid: false, error: 'Service ID is required' };
        }
        if (!serviceConfig.name) {
          return { valid: false, error: 'Service name is required' };
        }
        break;

      case 1: // Build Logic — fork on service type
        if (isCQLService) {
          if (!serviceConfig.cql_source || !serviceConfig.cql_source.trim()) {
            return { valid: false, error: 'CQL is required for cql-based services' };
          }
          if (!/define\s+Applicability\s*:/m.test(serviceConfig.cql_source)) {
            return {
              valid: false,
              error: 'Your CQL must define Applicability — a Boolean expression that decides when the card fires.',
            };
          }
        } else if (serviceConfig.conditions.length === 0) {
          return { valid: false, error: 'At least one condition is required' };
        }
        break;

      case 2: // Card Design
        // When CQL defines CardSummary, the static summary is unreachable
        // at runtime — the dynamicValue overrides it. Skip the required
        // check in that case so the student isn't forced to type a
        // duplicate string. Same for CardDetail.
        if (!serviceConfig.card.summary && cqlCardOverrides.summary === undefined) {
          return { valid: false, error: 'Card summary is required' };
        }
        break;

      case 3: // Prefetch
        // Optional — empty prefetch is valid (services that only need patient context)
        break;

      case 4: // Test & Deploy
        // Test panel is optional but recommended; final validation happens at deploy time
        break;

      default:
        break;
    }

    return { valid: true };
  };

  const handleSaveDraft = async () => {
    setLoading(true);
    setError(null);

    try {
      // First save: POST to create. Subsequent saves (re-entering step 5
      // after edits in step 2/3/4): PUT to update the existing draft so
      // the test panel runs against current CQL/card config, not the
      // initial snapshot. The PUT path also re-materializes the HAPI
      // Library + PlanDefinition so $apply sees the latest code.
      let response;
      if (savedServiceId) {
        response = await axios.put(
          `/api/cds-visual-builder/services/${savedServiceId}`,
          {
            name: serviceConfig.name,
            description: serviceConfig.description,
            service_type: serviceConfig.service_type,
            category: serviceConfig.category,
            hook_type: serviceConfig.hook_type,
            conditions: isCQLService ? undefined : serviceConfig.conditions,
            cql_source: isCQLService ? serviceConfig.cql_source : undefined,
            card_config: serviceConfig.card,
            display_config: serviceConfig.display_config,
            prefetch_config: serviceConfig.prefetch,
          }
        );
      } else {
        response = await axios.post(
          '/api/cds-visual-builder/services',
          serviceConfig
        );
      }

      // The test endpoint URL is `/services/{service_id}/test` — the
      // *string* identifier. The backend response includes both the
      // integer DB row id (`id`) and the string identifier (`service_id`).
      // Previously we set savedServiceId to `id`, so the test endpoint
      // got "/services/123/test" and 404'd because no service has
      // `service_id == "123"`. Use service_id.
      setSavedServiceId(response.data.service_id);
      return response.data;
    } catch (err) {
      console.error('Error saving draft:', err);
      const errorMessage = formatError(err.response?.data?.detail) || 'Failed to save service';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async () => {
    setLoading(true);
    setError(null);

    try {
      let serviceId = savedServiceId;
      if (isEditMode) {
        // Edit-mode: PUT the updated config (re-materializes Library +
        // PlanDefinition for CQL services, regenerates Python for visual
        // services), then deploy to bump the stable Library version and
        // refresh inlined ValueSet codes. Single-button "Save and
        // Re-deploy" — the user shouldn't have to remember a second step
        // for the deployed Library to pick up changes.
        await axios.put(
          `/api/cds-visual-builder/services/${serviceConfig.service_id}`,
          {
            name: serviceConfig.name,
            description: serviceConfig.description,
            service_type: serviceConfig.service_type,
            category: serviceConfig.category,
            hook_type: serviceConfig.hook_type,
            conditions: isCQLService ? undefined : serviceConfig.conditions,
            cql_source: isCQLService ? serviceConfig.cql_source : undefined,
            card_config: serviceConfig.card,
            display_config: serviceConfig.display_config,
            prefetch_config: serviceConfig.prefetch
          }
        );
      } else if (!serviceId) {
        const savedService = await handleSaveDraft();
        serviceId = savedService.service_id;
      }

      // Deploy. For new services this is the first stable-version upload;
      // for edits this bumps the version and re-runs `inline_value_set_retrieves`,
      // refreshing any ValueSet code edits made in this session.
      await axios.post(
        `/api/cds-visual-builder/services/${serviceConfig.service_id}/deploy`,
        {}
      );

      onSuccess?.();
      handleClose();
    } catch (err) {
      console.error('Error deploying service:', err);
      const errorMessage = formatError(err.response?.data?.detail) || 'Failed to deploy service';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Reset wizard state so a subsequent Create doesn't pre-populate from
    // a stale edit, and a subsequent Edit doesn't see the previous service's
    // CQL/valuesets while the GET /full-edit-state is in flight.
    setActiveStep(0);
    setServiceConfig(buildEmptyServiceConfig(user?.username));
    setSavedServiceId(null);
    setReferencedValueSets([]);
    setTestResults(null);
    setError(null);

    onClose();
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return renderServiceConfiguration();
      case 1:
        return renderConditionBuilder();
      case 2:
        return renderCardDesigner();
      case STEP_PREFETCH:
        return renderPrefetch();
      case STEP_TEST_DEPLOY:
        return renderTestAndDeploy();
      default:
        return null;
    }
  };

  const renderPrefetch = () => (
    <PrefetchEditor
      value={serviceConfig.prefetch || {}}
      onChange={(prefetch) => setServiceConfig({ ...serviceConfig, prefetch })}
      // Pass cqlSource only for CQL services so the "Re-derive" button
      // appears; visual services don't have it.
      cqlSource={isCQLService ? serviceConfig.cql_source : undefined}
    />
  );

  const renderServiceConfiguration = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Service Configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Configure basic service information
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Service ID"
            value={serviceConfig.service_id}
            onChange={(e) => setServiceConfig({ ...serviceConfig, service_id: e.target.value })}
            placeholder="my-preventive-care-service"
            helperText={isEditMode
              ? 'Service ID is the stable identifier in HAPI and the database; rename is not supported.'
              : 'Unique identifier for this service (lowercase, hyphens allowed)'}
            disabled={isEditMode}
            required
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Service Name"
            value={serviceConfig.name}
            onChange={(e) => setServiceConfig({ ...serviceConfig, name: e.target.value })}
            placeholder="Preventive Care Reminder"
            required
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Description"
            value={serviceConfig.description}
            onChange={(e) => setServiceConfig({ ...serviceConfig, description: e.target.value })}
            placeholder="Reminds clinicians about overdue preventive care screenings"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Service Type</InputLabel>
            <Select
              value={serviceConfig.service_type}
              onChange={(e) => setServiceConfig({ ...serviceConfig, service_type: e.target.value })}
              label="Service Type"
            >
              {/* Use the service type's `id` (kebab-case) as the value so it
                  matches what the backend expects. The previous code used the
                  JS object key (UPPER_SNAKE_CASE), which the backend silently
                  accepted but mis-routed dispatch. */}
              {Object.keys(SERVICE_TYPES).map(typeKey => (
                <MenuItem key={typeKey} value={SERVICE_TYPES[typeKey].id}>
                  {SERVICE_TYPES[typeKey].icon ? `${SERVICE_TYPES[typeKey].icon} ` : ''}
                  {SERVICE_TYPES[typeKey].label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Hook Type</InputLabel>
            <Select
              value={serviceConfig.hook_type}
              onChange={(e) => setServiceConfig({ ...serviceConfig, hook_type: e.target.value })}
              label="Hook Type"
            >
              <MenuItem value="patient-view">Patient View</MenuItem>
              <MenuItem value="order-select">Order Select</MenuItem>
              <MenuItem value="order-sign">Order Sign</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Category</InputLabel>
            <Select
              value={serviceConfig.category}
              onChange={(e) => setServiceConfig({ ...serviceConfig, category: e.target.value })}
              label="Category"
            >
              <MenuItem value="preventive-care">Preventive Care</MenuItem>
              <MenuItem value="medication-safety">Medication Safety</MenuItem>
              <MenuItem value="diagnosis-support">Diagnosis Support</MenuItem>
              <MenuItem value="quality-improvement">Quality Improvement</MenuItem>
              <MenuItem value="cost-reduction">Cost Reduction</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Display Mode</InputLabel>
            <Select
              value={serviceConfig.display_config?.presentationMode || 'popup'}
              onChange={(e) => setServiceConfig({
                ...serviceConfig,
                display_config: {
                  ...(serviceConfig.display_config || {}),
                  presentationMode: e.target.value
                }
              })}
              label="Display Mode"
            >
              {/* Values match PRESENTATION_MODES in CDSPresentation.js. The
                  backend stores this on display_config; the listing
                  endpoint maps it to displayBehavior.defaultMode and
                  CDSHookManager picks the rendering mode from there. */}
              <MenuItem value="popup">Popup — modal dialog (default)</MenuItem>
              <MenuItem value="inline">Inline — within page flow</MenuItem>
              <MenuItem value="modal">Modal — hard-stop, requires acknowledgment</MenuItem>
              <MenuItem value="banner">Banner — sticky bar at top</MenuItem>
              <MenuItem value="sidebar">Sidebar — fixed right-side panel</MenuItem>
              <MenuItem value="drawer">Drawer — slide-out from right</MenuItem>
              <MenuItem value="toast">Toast — corner notification</MenuItem>
              <MenuItem value="card">Card — rich card display</MenuItem>
              <MenuItem value="compact">Compact — icon with badge</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  );

  const renderConditionBuilder = () => {
    if (isCQLService) {
      return (
        <Box>
          <Typography variant="h6" gutterBottom>
            Write CQL
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Author your rule in Clinical Quality Language. The bridge generates
            a FHIR Library and PlanDefinition behind the scenes; HAPI evaluates
            them via the <code>$apply</code> operation when the hook fires.
          </Typography>

          <CQLEditor
            value={serviceConfig.cql_source}
            onChange={(cql) => setServiceConfig({ ...serviceConfig, cql_source: cql })}
            // The editor renders its own ValueSet Composer modal when
            // `onOpenValueSetComposer` isn't provided. Override here only
            // if a different host wants to control the modal externally.
            onLoadFHIRPreview={async () => {
              if (!savedServiceId) return null;
              return cdsStudioApi.getServiceFHIRPreview(serviceConfig.service_id);
            }}
            referencedValueSets={referencedValueSets}
            onValueSetSaved={refreshReferencedValueSets}
          />
        </Box>
      );
    }

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Build Conditions
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Define when this CDS service should trigger
        </Typography>

        <ConditionBuilder
          serviceType={serviceConfig.service_type}
          conditions={serviceConfig.conditions}
          onChange={(conditions) => setServiceConfig({ ...serviceConfig, conditions })}
        />
      </Box>
    );
  };

  const renderCardDesigner = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Design CDS Card
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Design how the alert will appear to clinicians
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <CardDesigner
            card={serviceConfig.card}
            onChange={(card) => setServiceConfig({ ...serviceConfig, card })}
            cqlOverrides={cqlCardOverrides}
            onJumpToCQL={() => setActiveStep(1)}
          />
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper elevation={2} sx={{ p: 2, position: 'sticky', top: 16 }}>
            <Typography variant="subtitle2" gutterBottom>
              Live Preview
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <CardPreviewPanel
              card={serviceConfig.card}
              displayConfig={serviceConfig.display_config}
              serviceId={serviceConfig.service_id || 'preview'}
            />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );

  const renderTestAndDeploy = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Test & Deploy
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Run the saved draft against synthetic patients, then deploy when ready.
      </Typography>

      {savedServiceId ? (
        <Box sx={{ mb: 3 }}>
          <ServiceTester
            serviceId={savedServiceId}
            serviceName={serviceConfig.name}
            serviceConfig={serviceConfig}
          />
        </Box>
      ) : (
        <Alert severity="info" sx={{ mb: 3 }}>
          Service will be saved as draft before testing.
        </Alert>
      )}

      {testResults && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Service tested successfully with {testResults.cards?.length || 0} card(s) generated
        </Alert>
      )}

      {/* Review summary — combines what used to be a separate Review step */}
      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="subtitle2" color="primary">
              Service Summary
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">Service ID</Typography>
            <Typography variant="body2">{serviceConfig.service_id}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">Name</Typography>
            <Typography variant="body2">{serviceConfig.name}</Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" color="text.secondary">Service Type</Typography>
            {/* SERVICE_TYPES is keyed by UPPER_SNAKE_CASE; serviceConfig.service_type
                is kebab-case ids — find the matching entry by id. */}
            <Typography variant="body2">
              {Object.values(SERVICE_TYPES).find((t) => t.id === serviceConfig.service_type)?.label
                || serviceConfig.service_type}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" color="text.secondary">Hook Type</Typography>
            <Typography variant="body2">{serviceConfig.hook_type}</Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" color="text.secondary">Logic</Typography>
            <Typography variant="body2">
              {isCQLService
                ? `CQL (${(serviceConfig.cql_source || '').split('\n').length} lines)`
                : `${serviceConfig.conditions.length} condition(s)`}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" color="text.secondary">Prefetch</Typography>
            <Typography variant="body2">
              {Object.keys(serviceConfig.prefetch || {}).length} template(s)
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" color="text.secondary">Suggestions</Typography>
            <Typography variant="body2">
              {(serviceConfig.card.suggestions || []).length}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle2" color="primary" gutterBottom>
          Card Preview
        </Typography>
        <CardPreviewPanel
          card={serviceConfig.card}
          serviceId={serviceConfig.service_id}
        />
      </Paper>

      <Alert severity="warning">
        <Typography variant="body2">
          <strong>Ready to deploy?</strong> Click <em>Deploy Service</em> to activate this service.
        </Typography>
      </Alert>
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '90vh', maxHeight: '90vh' }
      }}
    >
      <DialogTitle>
        {isEditMode
          ? `Edit Service — ${existingService?.service_id || serviceConfig.service_id}`
          : 'Visual Service Builder'}
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        {/* Stepper */}
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Step Content */}
        <Box sx={{ minHeight: 400 }}>
          {renderStepContent()}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>

        <Box sx={{ flex: 1 }} />

        {activeStep > 0 && (
          <Button
            startIcon={<BackIcon />}
            onClick={handleBack}
            disabled={loading}
          >
            Back
          </Button>
        )}

        {activeStep < steps.length - 1 && (
          <Button
            variant="contained"
            endIcon={<ForwardIcon />}
            onClick={handleNext}
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Next'}
          </Button>
        )}

        {activeStep === steps.length - 1 && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<DeployIcon />}
            onClick={handleDeploy}
            disabled={loading}
          >
            {loading
              ? <CircularProgress size={20} color="inherit" />
              : (isEditMode ? 'Save and Re-deploy' : 'Deploy Service')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default VisualBuilderWizard;
