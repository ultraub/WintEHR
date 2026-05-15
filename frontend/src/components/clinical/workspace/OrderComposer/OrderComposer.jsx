/**
 * OrderComposer — modal shell for multi-order composition (#116, Phase 4.1).
 *
 * Phase 4.1.A shipped the architecture; this polish pass tightens the
 * layout and visual hierarchy in response to UX feedback:
 *
 * - Right pane was too narrow for the embedded CDS cards (wrapped
 *   3-deep). Widened the flex split from 2:1 → 3:2 and bumped the
 *   pane's minWidth so cards have breathing room.
 * - The shared `<CDSCard>` is built for the workspace's wider columns,
 *   not a 380px sidebar — it wrapped the title across three lines and
 *   collided the source label with the heading. Replaced with a
 *   compact inline render (severity-tinted Paper, single-line title,
 *   collapsible detail).
 * - Form had dead whitespace below the indication textarea. Indication
 *   now flex-fills the available vertical space so the form occupies
 *   the dialog naturally rather than clustering at the top.
 * - Added a header subtitle, tab styling tweaks, and a footer chip so
 *   the shell reads as structured composition rather than four
 *   detached pieces.
 *
 * Sign-all flow is unchanged from 4.1.A: iterate drafts, create each as
 * status='active' via fhirClient.create, fire ORDER_PLACED per order.
 * Phase 3's draft contract still holds for OTHER entry surfaces
 * (MedicationDialog, ServiceRequestDialog, QuickOrderDialog) — those
 * land drafts that flow through the encounter signing dialog.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  GavelOutlined as SignIcon,
  Image as ImagingIcon,
  HealingOutlined as ProcedureIcon,
  InfoOutlined as InfoIcon,
  MedicationOutlined as MedicationIcon,
  Science as LabIcon,
  Vaccines as ImmunizationIcon,
  LocalHospital as NursingIcon,
  Restaurant as DietIcon,
  ForwardToInbox as ReferralIcon,
  Gavel as CodeStatusTabIcon,
  ReportProblemOutlined as WarningIcon,
  WarningAmberOutlined as CriticalIcon,
} from '@mui/icons-material';

import { useAuth } from '../../../../contexts/AuthContext';
import { useClinicalWorkflow } from '../../../../contexts/ClinicalWorkflowContext';
import { CLINICAL_EVENTS } from '../../../../constants/clinicalEvents';
import { useOrderSelectHook } from '../../../../hooks/cds/useCDSHooks';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';

import { DraftOrderBundleProvider, useDraftOrderBundle } from './DraftOrderBundleProvider';
import DraftOrderList from './DraftOrderList';
import OrderSetSelector from './ordersets/OrderSetSelector';
import LabOrderTab from './tabs/LabOrderTab';
import ImagingOrderTab from './tabs/ImagingOrderTab';
import ProcedureOrderTab from './tabs/ProcedureOrderTab';
import MedicationOrderTab from './tabs/MedicationOrderTab';
import ImmunizationOrderTab from './tabs/ImmunizationOrderTab';
import NursingOrderTab from './tabs/NursingOrderTab';
import DietOrderTab from './tabs/DietOrderTab';
import ReferralOrderTab from './tabs/ReferralOrderTab';
import CodeStatusOrderTab from './tabs/CodeStatusOrderTab';

// Tab order is intentional: most common ordering use cases first.
// Medications and labs lead because they're the high-volume tabs in
// real outpatient/inpatient CPOE. Imaging/procedure/immunization
// follow. Phase 4.3 adds the operational/care-planning tabs
// (nursing/diet/referral/code-status) at the end — they fire less
// often but matter when a patient is admitted or has a goals-of-care
// transition. The Tabs container is `scrollable` so the 9 tabs stay
// usable on narrower viewports.
const TABS = [
  { id: 'med', label: 'Medications', icon: <MedicationIcon fontSize="small" />, Comp: MedicationOrderTab },
  { id: 'lab', label: 'Labs', icon: <LabIcon fontSize="small" />, Comp: LabOrderTab },
  { id: 'imaging', label: 'Imaging', icon: <ImagingIcon fontSize="small" />, Comp: ImagingOrderTab },
  { id: 'procedure', label: 'Procedure', icon: <ProcedureIcon fontSize="small" />, Comp: ProcedureOrderTab },
  { id: 'immunization', label: 'Immunizations', icon: <ImmunizationIcon fontSize="small" />, Comp: ImmunizationOrderTab },
  { id: 'nursing', label: 'Nursing', icon: <NursingIcon fontSize="small" />, Comp: NursingOrderTab },
  { id: 'diet', label: 'Diet', icon: <DietIcon fontSize="small" />, Comp: DietOrderTab },
  { id: 'referral', label: 'Referral', icon: <ReferralIcon fontSize="small" />, Comp: ReferralOrderTab },
  { id: 'codestatus', label: 'Code Status', icon: <CodeStatusTabIcon fontSize="small" />, Comp: CodeStatusOrderTab },
];

// Compact CDS card variant for the OrderComposer right pane.
//
// The workspace's <CDSCard> assumes wide column space and full
// suggestion-actions; here we just need a one-line summary the user
// can scan while composing, with an expand for the detail body. Pure
// presentational — no feedback actions, no suggestion-accept (those
// stay on the workspace-level CDSCard for the chart view).
const INDICATOR_STYLE = {
  critical: { icon: <CriticalIcon fontSize="small" color="error" />, accent: 'error' },
  warning: { icon: <WarningIcon fontSize="small" color="warning" />, accent: 'warning' },
  info: { icon: <InfoIcon fontSize="small" color="info" />, accent: 'info' },
};

const CompactCDSCard = ({ card }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const indicator = (card.indicator || 'info').toLowerCase();
  const style = INDICATOR_STYLE[indicator] || INDICATOR_STYLE.info;
  const accentColor = theme.palette[style.accent]?.main || theme.palette.info.main;

  const hasDetail = Boolean(card.detail);
  const sourceLabel = card.source?.label;

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 1,
        borderLeftWidth: 3,
        borderLeftColor: accentColor,
        bgcolor: alpha(accentColor, 0.04),
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1,
          py: 0.75,
          cursor: hasDetail ? 'pointer' : 'default',
        }}
        onClick={() => hasDetail && setExpanded((v) => !v)}
      >
        {style.icon}
        <Typography
          variant="body2"
          sx={{ flex: 1, fontWeight: 500, minWidth: 0 }}
          noWrap
        >
          {card.summary}
        </Typography>
        {hasDetail && (
          <ExpandMoreIcon
            fontSize="small"
            sx={{
              color: 'text.secondary',
              transition: 'transform 0.15s',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
            }}
          />
        )}
      </Box>
      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ px: 2, pb: 1 }}>
          {card.detail && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'pre-wrap' }}>
              {card.detail}
            </Typography>
          )}
          {sourceLabel && (
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
              — {sourceLabel}
            </Typography>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

/**
 * Inner shell — uses the bundle context. Split from the public wrapper
 * so the provider lifecycle aligns with dialog open/close (each open
 * gets a fresh bundle).
 */
const OrderComposerInner = ({ open, onClose, patientId, onSigned }) => {
  const theme = useTheme();
  const { user } = useAuth();
  const { publish } = useClinicalWorkflow();
  const { drafts, clearDrafts } = useDraftOrderBundle();

  // Default to medications — highest-volume tab in real CPOE use.
  const [activeTab, setActiveTab] = useState('med');
  const [signing, setSigning] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' });

  // Order-select fires continuously at the shell level with the full
  // bundle (not per-tab) — the win over CPOEDialog. Phase 4.2's
  // drug-drug-interaction / panel-overlap CQL services depend on
  // seeing every draft at once.
  const draftResources = useMemo(() => drafts.map((d) => d.resource), [drafts]);
  const { cards: orderSelectCards = [] } = useOrderSelectHook(
    patientId,
    user?.id || user?.username,
    draftResources,
  ) || {};

  const ActiveTabComp = TABS.find((t) => t.id === activeTab)?.Comp || LabOrderTab;

  const handleSignAll = useCallback(async () => {
    if (drafts.length === 0) return;
    setSigning(true);
    const userRef = `Practitioner/${user?.id || user?.username || 'unknown'}`;
    const failed = [];
    const created = [];

    for (const { resource } of drafts) {
      try {
        const toCreate = {
          ...resource,
          status: 'active',
          requester: { reference: userRef },
          authoredOn: resource.authoredOn || new Date().toISOString(),
        };
        const result = await fhirClient.create(toCreate.resourceType, toCreate);
        created.push(result);

        // Per-order Provenance for audit-trail parity with the
        // encounter signing dialog (Phase 4.1.B requirement). Records
        // who signed and when, with `reason.code='ORD'` (HL7 v3
        // ActReason for "originated"). Failure is non-fatal — the
        // order is already created; missing Provenance is a metrics
        // gap, not a data integrity issue.
        try {
          await fhirClient.create('Provenance', {
            resourceType: 'Provenance',
            target: [{ reference: `${result.resourceType}/${result.id}` }],
            recorded: new Date().toISOString(),
            occurredDateTime: new Date().toISOString(),
            agent: [
              {
                type: {
                  coding: [
                    {
                      system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type',
                      code: 'author',
                      display: 'Author',
                    },
                  ],
                },
                who: { reference: userRef },
              },
            ],
            reason: [
              {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason',
                    code: 'ORD',
                    display: 'Order',
                  },
                ],
              },
            ],
          });
        } catch (provErr) {
          console.warn(`OrderComposer: Provenance create failed for ${result.resourceType}/${result.id}`, provErr);
        }

        await publish(CLINICAL_EVENTS.ORDER_PLACED, {
          orderId: result.id,
          resourceType: result.resourceType,
          patientId,
          category: result.category?.[0]?.coding?.[0]?.code,
          priority: result.priority,
        });
      } catch (err) {
        console.error('OrderComposer: sign failed for one draft', err);
        failed.push({ resource, error: err?.message || String(err) });
      }
    }

    setSigning(false);

    if (failed.length === 0) {
      setSnackbar({
        open: true,
        message: `Signed ${created.length} order${created.length === 1 ? '' : 's'}.`,
        severity: 'success',
      });
      clearDrafts();
      onSigned?.(created);
      onClose?.();
    } else {
      setSnackbar({
        open: true,
        message: `Signed ${created.length}; ${failed.length} failed — see browser console.`,
        severity: 'error',
      });
    }
  }, [drafts, user, patientId, publish, clearDrafts, onSigned, onClose]);

  return (
    <>
      <Dialog
        open={open}
        onClose={signing ? undefined : onClose}
        maxWidth="xl"
        fullWidth
        PaperProps={{ sx: { height: '92vh' } }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            pb: 0.5,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Stack spacing={0.25}>
            <Typography variant="h6" component="span">Order Composer</Typography>
            <Typography variant="caption" color="text.secondary">
              Build a batch of orders and sign them all at once.
            </Typography>
          </Stack>
          <Box sx={{ flex: 1 }} />
          <OrderSetSelector />
          <IconButton onClick={onClose} disabled={signing} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <Tabs
          value={activeTab}
          onChange={(_e, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            borderBottom: '1px solid',
            borderColor: 'divider',
            px: 2,
            minHeight: 44,
            '& .MuiTab-root': { minHeight: 44, textTransform: 'none', fontWeight: 500 },
          }}
        >
          {TABS.map((t) => (
            <Tab key={t.id} value={t.id} label={t.label} icon={t.icon} iconPosition="start" />
          ))}
        </Tabs>

        <DialogContent sx={{ display: 'flex', p: 0, overflow: 'hidden' }}>
          {/* Form pane — flex 3 gives the autocomplete + textarea room
              to breathe and lets the indication field flex-fill the
              available vertical space. */}
          <Box
            sx={{
              flex: 3,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'auto',
              borderRight: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.default',
            }}
          >
            <ActiveTabComp />
          </Box>

          {/* Right pane: drafts + cross-order CDS. flex 2 + minWidth so
              the compact CDS cards have enough horizontal space for the
              summary line and the expand chevron. */}
          <Box
            sx={{
              flex: 2,
              minWidth: 380,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box
              sx={{
                flex: 1,
                overflow: 'auto',
                borderBottom: orderSelectCards.length > 0 ? '1px solid' : 'none',
                borderColor: 'divider',
              }}
            >
              <DraftOrderList />
            </Box>
            {orderSelectCards.length > 0 && (
              <Box sx={{ p: 1.5, maxHeight: '45%', overflow: 'auto' }}>
                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 0.75, letterSpacing: 0.5 }}
                >
                  CDS suggestions · {orderSelectCards.length}
                </Typography>
                <Stack spacing={0.75}>
                  {orderSelectCards.map((card) => (
                    <CompactCDSCard key={card.uuid || card.summary} card={card} />
                  ))}
                </Stack>
              </Box>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 1.5, gap: 1, borderTop: `1px solid ${theme.palette.divider}` }}>
          {drafts.length === 0 ? (
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
              Compose at least one order before signing.
            </Typography>
          ) : (
            <Chip
              label={`${drafts.length} draft${drafts.length === 1 ? '' : 's'} pending`}
              size="small"
              color="warning"
              variant="outlined"
              sx={{ mr: 'auto' }}
            />
          )}
          <Button onClick={onClose} disabled={signing}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={signing ? <CircularProgress size={16} color="inherit" /> : <SignIcon />}
            onClick={handleSignAll}
            disabled={drafts.length === 0 || signing}
          >
            {signing
              ? 'Signing...'
              : `Sign all (${drafts.length} order${drafts.length === 1 ? '' : 's'})`}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

/**
 * Public wrapper — supplies the bundle context so each dialog open
 * starts with a fresh draft list.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.patientId — Bare FHIR id (no `Patient/` prefix).
 * @param {string} [props.encounterId]
 * @param {(createdResources: FHIR.Resource[]) => void} [props.onSigned]
 */
const OrderComposer = (props) => (
  <DraftOrderBundleProvider patientId={props.patientId} encounterId={props.encounterId}>
    <OrderComposerInner {...props} />
  </DraftOrderBundleProvider>
);

export default OrderComposer;
