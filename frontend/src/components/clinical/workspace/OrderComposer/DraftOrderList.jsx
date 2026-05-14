/**
 * DraftOrderList — right-pane summary of all in-progress drafts across
 * the lab/imaging/procedure tabs of the Unified Order Entry shell.
 *
 * Stays visible across tab switches because it reads from the shared
 * `DraftOrderBundleProvider`. Each row shows: order type chip, code,
 * indication summary, priority badge, and a remove button.
 *
 * No "edit in place" affordance for the MVP — students remove and re-add
 * if a draft is wrong. Edit-in-place arrives with the rich form lift in
 * Phase 4.1.B.
 */

import React from 'react';
import {
  Box,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Science as LabIcon,
  Image as ImagingIcon,
  HealingOutlined as ProcedureIcon,
  MedicationOutlined as MedicationIcon,
  Vaccines as ImmunizationIcon,
  LocalHospital as NursingIcon,
  Restaurant as DietIcon,
  ForwardToInbox as ReferralIcon,
  Gavel as CodeStatusIcon,
} from '@mui/icons-material';

import { useDraftOrderBundle } from './DraftOrderBundleProvider';

// SNOMED category codes used by the OrderComposer tabs. Lookup table
// so summarize() doesn't grow a chain of equality checks as new tabs
// arrive (nursing, diet, referral, code-status landed in 4.3).
const SR_CATEGORY_KIND = {
  '108252007': 'lab',
  '363679005': 'imaging',
  '33879002': 'immunization',
  '387713003': 'procedure',
  '103735009': 'nursing',
  '3457005': 'referral',
  '385686007': 'code-status',
};

// Reduce a FHIR resource into a (type, label, code) display tuple. Pulled
// to module scope (not a useMemo) because it's a pure transform; reused
// for the row icon + label.
function summarize(resource) {
  const type = resource?.resourceType;

  if (type === 'ServiceRequest') {
    const catCode = resource?.category?.[0]?.coding?.[0]?.code;
    const kind = SR_CATEGORY_KIND[catCode] || 'procedure';
    const code = resource?.code?.coding?.[0]?.code;
    const label =
      resource?.code?.text ||
      resource?.code?.coding?.[0]?.display ||
      'Service request';
    return { kind, label, code };
  }
  if (type === 'MedicationRequest') {
    return {
      kind: 'medication',
      label:
        resource?.medicationCodeableConcept?.text ||
        resource?.medicationCodeableConcept?.coding?.[0]?.display ||
        'Medication',
      code: resource?.medicationCodeableConcept?.coding?.[0]?.code,
    };
  }
  if (type === 'NutritionOrder') {
    const dietRow = resource?.oralDiet?.type?.[0];
    return {
      kind: 'diet',
      label: dietRow?.text || dietRow?.coding?.[0]?.display || 'Diet order',
      code: dietRow?.coding?.[0]?.code || null,
    };
  }
  return {
    kind: 'other',
    label: 'Order',
    code: null,
  };
}

const ICONS = {
  lab: <LabIcon fontSize="small" />,
  imaging: <ImagingIcon fontSize="small" />,
  procedure: <ProcedureIcon fontSize="small" />,
  medication: <MedicationIcon fontSize="small" />,
  immunization: <ImmunizationIcon fontSize="small" />,
  nursing: <NursingIcon fontSize="small" />,
  diet: <DietIcon fontSize="small" />,
  referral: <ReferralIcon fontSize="small" />,
  'code-status': <CodeStatusIcon fontSize="small" />,
  other: null,
};

const PRIORITY_COLORS = {
  routine: 'default',
  urgent: 'warning',
  asap: 'error',
  stat: 'error',
};

const DraftOrderList = () => {
  const { drafts, removeDraft, recentlyAddedId } = useDraftOrderBundle();

  if (drafts.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body2">No drafts yet.</Typography>
        <Typography variant="caption">
          Use the tabs to compose orders. Each one lands here before you sign.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2">
          Draft orders ({drafts.length})
        </Typography>
      </Box>
      <List sx={{ flex: 1, overflow: 'auto', p: 0 }}>
        {drafts.map(({ localId, resource }) => {
          const { kind, label, code } = summarize(resource);
          const priority = resource?.priority || 'routine';
          const isRecent = localId === recentlyAddedId;
          return (
            <ListItem
              key={localId}
              divider
              sx={{
                bgcolor: isRecent ? 'action.selected' : 'inherit',
                transition: 'background-color 0.6s',
              }}
              secondaryAction={
                <Tooltip title="Remove draft">
                  <IconButton edge="end" size="small" onClick={() => removeDraft(localId)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              }
            >
              <ListItemText
                primary={
                  <Stack direction="row" alignItems="center" spacing={1}>
                    {ICONS[kind]}
                    <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                      {label}
                    </Typography>
                    {priority !== 'routine' && (
                      <Chip
                        label={priority}
                        size="small"
                        color={PRIORITY_COLORS[priority]}
                        sx={{ height: 18, fontSize: '0.65rem' }}
                      />
                    )}
                  </Stack>
                }
                secondary={
                  <Stack direction="row" spacing={1} alignItems="center">
                    {code && (
                      <Typography variant="caption" fontFamily="monospace">
                        {code}
                      </Typography>
                    )}
                    {resource?.reasonCode?.[0]?.text && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        — {resource.reasonCode[0].text}
                      </Typography>
                    )}
                  </Stack>
                }
                secondaryTypographyProps={{ component: 'div' }}
              />
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
};

export default DraftOrderList;
