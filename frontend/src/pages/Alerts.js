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
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

function Alerts() {
  const navigate = useNavigate();

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Alerts & Notifications
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
              backgroundColor: '#FF9800',
              mb: 3,
            }}
          >
            <ConstructionIcon sx={{ fontSize: 60 }} />
          </Avatar>
          
          <Typography variant="h3" gutterBottom color="primary">
            🚧 Under Construction 🚧
          </Typography>
          
          <Typography variant="h6" color="textSecondary" gutterBottom>
            We're building something amazing!
          </Typography>
          
          <Typography variant="body1" paragraph sx={{ maxWidth: 600, mx: 'auto' }}>
            The Alerts & Notifications system is currently under development. 
            Soon you'll be able to manage critical alerts, system notifications, 
            and patient-specific warnings all in one place.
          </Typography>
        </Box>

        <Grid container spacing={3} sx={{ mt: 4 }}>
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <NotificationsIcon color="primary" sx={{ fontSize: 40, mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Critical Alerts
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Real-time monitoring of critical patient conditions and lab values
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <NotificationsIcon color="secondary" sx={{ fontSize: 40, mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  System Notifications
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Updates about system maintenance, new features, and important announcements
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <NotificationsIcon color="success" sx={{ fontSize: 40, mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Custom Alerts
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Configure personalized alerts based on your clinical workflow
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Box mt={6}>
          <Typography variant="body2" color="textSecondary">
            Expected completion: Coming soon! 🎉
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

export default Alerts;