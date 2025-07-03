import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Avatar,
  Button,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  Construction as ConstructionIcon,
  ArrowBack as ArrowBackIcon,
  EventNote as EventNoteIcon,
  Schedule as ScheduleIcon,
  CalendarMonth as CalendarIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

function EncounterSchedule() {
  const navigate = useNavigate();

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Schedule Appointment
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/dashboard')}
        >
          Back to Dashboard
        </Button>
      </Box>

      <Paper sx={{ p: 6, textAlign: 'center' }}>
        <Box mb={4}>
          <Avatar
            sx={{
              width: 120,
              height: 120,
              margin: '0 auto',
              backgroundColor: '#9C27B0',
              mb: 3,
            }}
          >
            <ConstructionIcon sx={{ fontSize: 60 }} />
          </Avatar>
          
          <Typography variant="h3" gutterBottom color="primary">
            📅 Scheduling System 📅
          </Typography>
          
          <Typography variant="h6" color="textSecondary" gutterBottom>
            Advanced Appointment Management
          </Typography>
          
          <Typography variant="body1" paragraph sx={{ maxWidth: 600, mx: 'auto' }}>
            We're developing a sophisticated appointment scheduling system with calendar integration, 
            automated reminders, and real-time availability checking. Stay tuned for this exciting feature!
          </Typography>
        </Box>

        <Grid container spacing={3} sx={{ mt: 4 }}>
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <CalendarIcon color="primary" sx={{ fontSize: 40, mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Calendar Integration
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Seamless integration with provider calendars and availability management
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <EventNoteIcon color="secondary" sx={{ fontSize: 40, mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Automated Reminders
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  SMS and email reminders for patients with customizable templates
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <ScheduleIcon color="success" sx={{ fontSize: 40, mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Smart Scheduling
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  AI-powered scheduling optimization and conflict resolution
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Box mt={6}>
          <Typography variant="body2" color="textSecondary">
            🔄 For now, encounters can be viewed in the Encounters section
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

export default EncounterSchedule;