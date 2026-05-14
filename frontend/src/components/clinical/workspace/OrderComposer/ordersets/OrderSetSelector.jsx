/**
 * OrderSetSelector — popover-driven launcher for predefined order sets
 * (#116, Phase 4.3).
 *
 * UX: a button in the composer's title bar opens a popover. Each row
 * is an expandable card showing the order set's name + description +
 * a preview of the orders it would add. Clicking "Apply order set"
 * pushes every order in the set into the composer's draft bundle
 * (each gets a `subject` reference to the current patient injected on
 * the way in) and closes the popover. Students can then deselect any
 * unwanted draft in the right pane before signing.
 *
 * Why a popover, not a separate modal: stacking modals is a UX
 * anti-pattern (and the composer is already a modal). The popover
 * stays anchored to its launcher button and dismisses on
 * outside-click, matching the rest of the composer's surface.
 *
 * Why we mutate via `addDraft` rather than passing the whole bundle
 * to the provider: keeps the provider's mutation API narrow (one
 * write per draft) and the recently-added animation continues to
 * work — the last item highlights on apply.
 */

import React, { useCallback, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Popover,
  Stack,
  Typography,
} from '@mui/material';
import {
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  PlaylistAddCheck as OrderSetIcon,
} from '@mui/icons-material';

import { useDraftOrderBundle } from '../DraftOrderBundleProvider';
import { ORDER_SETS } from './orderSets';

/**
 * Pull the human-readable display from any of the FHIR shapes the
 * composer pushes into a draft. Helper kept in this file because it's
 * tightly coupled to the order-set preview rendering and shouldn't
 * leak into the more disciplined DraftOrderList summarize().
 */
function displayOf(resource) {
  if (resource.resourceType === 'MedicationRequest') {
    return resource.medicationCodeableConcept?.text
      || resource.medicationCodeableConcept?.coding?.[0]?.display
      || 'Medication';
  }
  if (resource.resourceType === 'NutritionOrder') {
    return resource.oralDiet?.type?.[0]?.text || 'Diet order';
  }
  return resource.code?.text
    || resource.code?.coding?.[0]?.display
    || 'Order';
}

const OrderSetSelector = () => {
  const { patientId, addDraft } = useDraftOrderBundle();
  const [anchorEl, setAnchorEl] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const handleOpen = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => { setAnchorEl(null); setExpandedId(null); };

  const handleApply = useCallback((set) => {
    const items = set.build();
    for (const item of items) {
      // Inject patient ref consistent with whichever subject-pattern
      // the resource uses. NutritionOrder uses `patient`, everything
      // else uses `subject`.
      const ref = { reference: `Patient/${patientId}` };
      const withSubject = item.resourceType === 'NutritionOrder'
        ? { ...item, patient: ref }
        : { ...item, subject: ref };
      addDraft(withSubject);
    }
    handleClose();
  }, [patientId, addDraft]);

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<OrderSetIcon fontSize="small" />}
        onClick={handleOpen}
        sx={{ textTransform: 'none', mr: 1 }}
      >
        Use order set
      </Button>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { width: 540, maxHeight: '70vh', overflow: 'auto' } } }}
      >
        <Box sx={{ p: 2, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1">Order sets</Typography>
          <Typography variant="caption" color="text.secondary">
            Pick a protocol; we pre-fill the draft list. Deselect anything that doesn't apply before signing.
          </Typography>
        </Box>

        <List dense disablePadding>
          {ORDER_SETS.map((set) => {
            const isOpen = expandedId === set.id;
            const items = set.build();
            return (
              <React.Fragment key={set.id}>
                <ListItem
                  alignItems="flex-start"
                  secondaryAction={
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleApply(set)}
                        sx={{ textTransform: 'none' }}
                      >
                        Apply
                      </Button>
                      <IconButton
                        size="small"
                        onClick={() => setExpandedId(isOpen ? null : set.id)}
                      >
                        {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                      </IconButton>
                    </Stack>
                  }
                  sx={{ pr: 14 }}
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                        <Typography variant="subtitle2">{set.name}</Typography>
                        {set.tags?.map((t) => (
                          <Chip key={t} label={t} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                        ))}
                      </Stack>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                        {set.description}
                      </Typography>
                    }
                    secondaryTypographyProps={{ component: 'div' }}
                  />
                </ListItem>
                <Collapse in={isOpen} unmountOnExit>
                  <Paper variant="outlined" sx={{ mx: 2, mb: 1, p: 1, bgcolor: 'background.default' }}>
                    <Typography variant="overline" color="text.secondary">Includes ({items.length})</Typography>
                    <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                      {items.map((item, idx) => (
                        <Typography key={idx} variant="caption" sx={{ display: 'block' }}>
                          · {displayOf(item)}
                        </Typography>
                      ))}
                    </Stack>
                  </Paper>
                </Collapse>
                <Divider component="li" />
              </React.Fragment>
            );
          })}
        </List>
      </Popover>
    </>
  );
};

export default OrderSetSelector;
