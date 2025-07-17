/**
 * Patient Timeline Component for FHIR Explorer v4
 * 
 * Interactive patient journey visualization
 * (Placeholder implementation for Phase 1)
 */

import React from 'react';
import {
  Box,
  Typography,
  Alert,
  Grid,
  Card,
  CardContent
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  Person as PersonIcon,
  Event as EventIcon
} from '@mui/icons-material';

function PatientTimeline({ onNavigate }) {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Patient Timeline Visualization
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Coming in Phase 3: Interactive Patient Journeys
        </Typography>
        Patient timeline visualizations will include:
        <ul>
          <li>Chronological view of patient encounters and events</li>
          <li>Interactive timeline with zoom and filtering</li>
          <li>Multi-layered view showing different data types</li>
          <li>Care episode grouping and analysis</li>
          <li>Clinical milestone tracking and outcomes</li>
        </ul>
      </Alert>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <TimelineIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Chronological View
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Interactive timeline showing patient events, encounters,
                and clinical milestones in chronological order.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <PersonIcon sx={{ fontSize: 48, color: 'secondary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Patient Journey
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Comprehensive view of the patient's healthcare journey
                with key events, decisions, and outcomes.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <EventIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Event Correlation
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Correlate different types of clinical events to identify
                patterns and relationships in patient care.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default PatientTimeline;