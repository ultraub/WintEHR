/**
 * HostedSectionPanel — renders a hostable section (Flowsheet, Imaging
 * studies, a module's panel) inside another tab, as a full-width card.
 *
 * The section's component loads its own data from `patientId`; the host
 * tab shares nothing with it. Heavy sections start collapsed
 * (`defaultCollapsed`) so hosting Imaging on Chart Review does not fire
 * DICOM queries on every chart open. Lazy chunk with one retry and an
 * error boundary, like top-level tabs.
 */

import React, { Suspense, lazy, useMemo, useState } from 'react';
import { Box, Card, CardContent, CardHeader, CircularProgress, Collapse, Grid, IconButton, Typography } from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { retryOnce } from './clinicalTabRegistry';

class SectionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <Typography variant="body2" color="error" sx={{ p: 2 }}>
          {this.props.label} could not be displayed ({this.state.error.message || 'error'}).
        </Typography>
      );
    }
    return this.props.children;
  }
}

/**
 * The section's content alone: lazy component, retry, error boundary. Strip
 * tabs (Results, Pharmacy, Care Plan) render this as a sub-tab body; the
 * card below wraps it for stacked hosts like Chart Review.
 */
export const HostedSectionBody = ({ section, patientId, currentPatient, onNavigateToTab }) => {
  const Component = useMemo(
    () => (section.loader ? lazy(() => retryOnce(section.loader)) : null),
    [section.loader],
  );
  if (!Component) {
    return <Typography variant="body2" color="text.secondary">This section has no content to host.</Typography>;
  }
  return (
    <SectionErrorBoundary label={section.label}>
      <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} /></Box>}>
        <Component patientId={patientId} currentPatient={currentPatient} onNavigateToTab={onNavigateToTab} hosted />
      </Suspense>
    </SectionErrorBoundary>
  );
};

const HostedSectionPanel = ({ section, patientId, currentPatient, onNavigateToTab }) => {
  const [open, setOpen] = useState(!section.defaultCollapsed);

  return (
    <Grid item xs={12} data-testid={`hosted-section-${section.id}`}>
      <Card sx={{ border: '1px solid', borderColor: 'divider', borderLeft: '4px solid', borderLeftColor: section.color || 'primary.main' }}>
        <CardHeader
          title={<Typography variant="h6" sx={{ fontWeight: 600 }}>{section.label}</Typography>}
          subheader={section.hostedFrom ? `From ${section.hostedFrom}` : undefined}
          action={
            <IconButton
              onClick={() => setOpen((v) => !v)}
              aria-label={`${open ? 'Collapse' : 'Expand'} ${section.label}`}
              aria-expanded={open}
              sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
            >
              <ExpandMoreIcon />
            </IconButton>
          }
          sx={{ pb: 0 }}
        />
        <Collapse in={open} unmountOnExit>
          <CardContent sx={{ pt: 1 }}>
            <HostedSectionBody section={section} patientId={patientId} currentPatient={currentPatient} onNavigateToTab={onNavigateToTab} />
          </CardContent>
        </Collapse>
      </Card>
    </Grid>
  );
};

export default HostedSectionPanel;
