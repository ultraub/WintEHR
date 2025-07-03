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
  PersonAdd as PersonAddIcon,
  Assignment as AssignmentIcon,
  LocalHospital as HospitalIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

function PatientNew() {
  const navigate = useNavigate();

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          New Patient Registration
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/patients')}
        >
          Back to Patients
        </Button>
      </Box>

      <Paper sx={{ p: 6, textAlign: 'center' }}>
        <Box mb={4}>
          <Avatar
            sx={{
              width: 120,
              height: 120,
              margin: '0 auto',
              backgroundColor: '#2196F3',
              mb: 3,
            }}
          >
            <ConstructionIcon sx={{ fontSize: 60 }} />
          </Avatar>
          
          <Typography variant="h3" gutterBottom color="primary">
            👤 Coming Soon! 👤
          </Typography>
          
          <Typography variant="h6" color="textSecondary" gutterBottom>
            Patient Registration System
          </Typography>
          
          <Typography variant="body1" paragraph sx={{ maxWidth: 600, mx: 'auto' }}>
            We're building a comprehensive patient registration system that will streamline 
            the onboarding process with FHIR-compliant data collection, insurance verification, 
            and automated chart creation.
          </Typography>
        </Box>

        <Grid container spacing={3} sx={{ mt: 4 }}>
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <PersonAddIcon color="primary" sx={{ fontSize: 40, mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Demographics
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Comprehensive patient information collection with FHIR compliance
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <AssignmentIcon color="secondary" sx={{ fontSize: 40, mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Insurance Verification
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Real-time insurance eligibility checking and benefit verification
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <HospitalIcon color="success" sx={{ fontSize: 40, mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Chart Creation
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Automated medical chart setup with customizable templates
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Box mt={6}>
          <Typography variant="body2" color="textSecondary">
            🎯 For now, you can create patients through the FHIR Explorer or import Synthea data
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

export default PatientNew;