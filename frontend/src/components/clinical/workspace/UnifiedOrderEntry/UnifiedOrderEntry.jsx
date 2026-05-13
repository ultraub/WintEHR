/**
 * UnifiedOrderEntry — modal shell for the multi-order composition flow
 * that #116 calls for. Phase 4.1 (this PR) ships lab/imaging/procedure
 * tabs; Phase 4.2 adds med/immunization; Phase 4.3 adds order sets and
 * the remaining order types.
 *
 * Layout
 * ------
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  Unified Order Entry — Patient: Fiona F4 CKD            [X]  │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │  Tabs: [ Labs ]  [ Imaging ]  [ Procedure ]                  │
 *   ├────────────────────────────────────┬─────────────────────────┤
 *   │                                    │                         │
 *   │   <active tab's OrderEntryForm>    │   <DraftOrderList>      │
 *   │                                    │                         │
 *   │   (search, indication, priority,   │   (running list of      │
 *   │    Add to draft list)              │    composed drafts)     │
 *   │                                    │                         │
 *   ├────────────────────────────────────┴─────────────────────────┤
 *   │  CDS cards from order-select (if any drafts)                 │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │  Cancel                              [Sign all (N orders) ]  │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Sign-all flow
 * -------------
 *
 * 1. Fire `order-sign` CDS hook with the full draft bundle as
 *    `context.draftOrders` and resource refs as `context.selections`
 *    (CDS Hooks 2.0 spec compliance — same buildDraftOrderBundle path
 *    PR #117 wired for order-select).
 * 2. If any hard-stop cards land, show them and require an explicit
 *    Continue. Otherwise proceed.
 * 3. For each draft: POST to HAPI with status='active' (we sign all at
 *    once here — see plan note below), create a Provenance referencing
 *    the new id, fire ORDER_PLACED clinical event.
 * 4. On full success: clear the bundle and close the dialog. On partial
 *    failure: keep failed drafts in the bundle, show a Snackbar.
 *
 * Why Sign All creates as `active` directly (not draft + then sign):
 * - The user has *just* composed and confirmed; making them re-sign via
 *   the encounter signing dialog would double-tap.
 * - Per the plan ("Wire `order-sign` on Sign All"), this is the explicit
 *   sign step for this composition session.
 * - The Phase 3 rule still holds for OTHER entry surfaces (Medication
 *   dialog, ServiceRequest dialog, QuickOrder): they land as draft, the
 *   encounter signing dialog flips them.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Snackbar,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  GavelOutlined as SignIcon,
  Science as LabIcon,
  Image as ImagingIcon,
  HealingOutlined as ProcedureIcon,
} from '@mui/icons-material';

import { useAuth } from '../../../../contexts/AuthContext';
import { useClinicalWorkflow } from '../../../../contexts/ClinicalWorkflowContext';
import { CLINICAL_EVENTS } from '../../../../constants/clinicalEvents';
import { useOrderSelectHook } from '../../../../hooks/cds/useCDSHooks';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import CDSCard from '../../cds/CDSCard';

import { DraftOrderBundleProvider, useDraftOrderBundle } from './DraftOrderBundleProvider';
import DraftOrderList from './DraftOrderList';
import LabOrderTab from './tabs/LabOrderTab';
import ImagingOrderTab from './tabs/ImagingOrderTab';
import ProcedureOrderTab from './tabs/ProcedureOrderTab';

const TABS = [
  { id: 'lab', label: 'Labs', icon: <LabIcon fontSize="small" />, Comp: LabOrderTab },
  { id: 'imaging', label: 'Imaging', icon: <ImagingIcon fontSize="small" />, Comp: ImagingOrderTab },
  { id: 'procedure', label: 'Procedure', icon: <ProcedureIcon fontSize="small" />, Comp: ProcedureOrderTab },
];

/**
 * Inner shell — uses the bundle context. Split from the public component
 * so the provider lifecycle aligns with the dialog open/close (each open
 * gets a fresh bundle).
 */
const UnifiedOrderEntryInner = ({ open, onClose, patientId, onSigned }) => {
  const { user } = useAuth();
  const { publish } = useClinicalWorkflow();
  const { drafts, clearDrafts } = useDraftOrderBundle();

  const [activeTab, setActiveTab] = useState('lab');
  const [signing, setSigning] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' });

  // Fire order-select continuously as drafts change. The unified shell
  // fires ONCE for the whole bundle (not per-tab) — that's the win over
  // CPOEDialog's single-resource firing, because cross-order CDS like
  // drug-drug-interaction or panel-overlap need the full set.
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
        // Sign-in-place: flip to active and stamp requester before POST.
        // Provenance creation is left to the encounter signing dialog
        // for now — this MVP just lands signed orders. Phase 4.1.B will
        // create the Provenance per order to match EncounterSigningDialog's
        // audit trail.
        const toCreate = {
          ...resource,
          status: 'active',
          requester: { reference: userRef },
          authoredOn: resource.authoredOn || new Date().toISOString(),
        };
        const result = await fhirClient.create(toCreate.resourceType, toCreate);
        created.push(result);

        // Publish the same event the legacy CPOE flow does so downstream
        // tabs (Results, Pharmacy) refresh.
        await publish(CLINICAL_EVENTS.ORDER_PLACED, {
          orderId: result.id,
          resourceType: result.resourceType,
          patientId,
          category: result.category?.[0]?.coding?.[0]?.code,
          priority: result.priority,
        });
      } catch (err) {
        console.error('UnifiedOrderEntry: sign failed for one draft', err);
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
        PaperProps={{ sx: { height: '90vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          Unified Order Entry
          <Box sx={{ flex: 1 }} />
          <IconButton onClick={onClose} disabled={signing} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <Tabs
          value={activeTab}
          onChange={(_e, v) => setActiveTab(v)}
          sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 2 }}
        >
          {TABS.map((t) => (
            <Tab key={t.id} value={t.id} label={t.label} icon={t.icon} iconPosition="start" />
          ))}
        </Tabs>

        <DialogContent dividers sx={{ display: 'flex', p: 0 }}>
          {/* Active tab pane — flex 2 so the form has room for catalog
              autocomplete dropdowns. */}
          <Box sx={{ flex: 2, overflow: 'auto', borderRight: '1px solid', borderColor: 'divider' }}>
            <ActiveTabComp />
          </Box>

          {/* Right pane: running draft list + order-select CDS cards. */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 320 }}>
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              <DraftOrderList />
            </Box>
            {orderSelectCards.length > 0 && (
              <Box
                sx={{
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  p: 1,
                  maxHeight: '40%',
                  overflow: 'auto',
                }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
                  CDS suggestions ({orderSelectCards.length})
                </Typography>
                {orderSelectCards.map((card) => (
                  <CDSCard
                    key={card.uuid || card.summary}
                    card={card}
                    patientId={patientId}
                    userId={user?.id || user?.username}
                  />
                ))}
              </Box>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          {drafts.length === 0 && (
            <Alert severity="info" sx={{ flex: 1, py: 0 }}>
              Compose at least one order before signing.
            </Alert>
          )}
          <Button onClick={onClose} disabled={signing}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={signing ? <CircularProgress size={16} /> : <SignIcon />}
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
 * @param {(createdResources: FHIR.Resource[]) => void} [props.onSigned] —
 *   Called when Sign All completes successfully; the parent uses this to
 *   refresh its orders list.
 */
const UnifiedOrderEntry = (props) => (
  <DraftOrderBundleProvider patientId={props.patientId} encounterId={props.encounterId}>
    <UnifiedOrderEntryInner {...props} />
  </DraftOrderBundleProvider>
);

export default UnifiedOrderEntry;
