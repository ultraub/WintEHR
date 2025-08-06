import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  Button,
  Stack,
  Grid
} from '@mui/material';
import { LocalPharmacy as PharmacyIcon, Add as AddIcon, Search as SearchIcon } from '@mui/icons-material';

const MedicationsPage = () => {
  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <PharmacyIcon color="primary" />
        <Typography variant="h4" component="h1">
          Medications Management
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          New Prescription
        </Button>
        <Button variant="outlined" startIcon={<SearchIcon />}>
          Search Formulary
        </Button>
      </Stack>

      <Alert severity="info" sx={{ mb: 3 }}>
        The Medications Management module provides comprehensive medication workflows 
        with e-prescribing, reconciliation, and clinical decision support.
      </Alert>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                E-Prescribing
              </Typography>
              <Typography variant="body2" component="div">
                • Electronic prescription transmission<br/>
                • Drug interaction checking<br/>
                • Allergy alerts<br/>
                • Formulary integration<br/>
                • Prior authorization support<br/>
                • Prescription monitoring
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Medication Reconciliation
              </Typography>
              <Typography variant="body2" component="div">
                • Admission reconciliation<br/>
                • Discharge reconciliation<br/>
                • Transfer reconciliation<br/>
                • Medication history review<br/>
                • Discrepancy identification<br/>
                • FHIR MedicationRequest integration
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Clinical Decision Support
              </Typography>
              <Typography variant="body2" component="div">
                • Drug-drug interactions<br/>
                • Drug-allergy checking<br/>
                • Dose range validation<br/>
                • Therapeutic duplication alerts<br/>
                • Age/weight-based dosing<br/>
                • Clinical guidelines integration
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default MedicationsPage;