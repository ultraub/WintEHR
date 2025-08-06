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
import { Science as LabIcon, Upload as UploadIcon, Search as SearchIcon } from '@mui/icons-material';

const LabResultsPage = () => {
  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <LabIcon color="primary" />
        <Typography variant="h4" component="h1">
          Lab Results & Orders
        </Typography>
        <Button variant="contained" startIcon={<UploadIcon />}>
          Import Results
        </Button>
        <Button variant="outlined" startIcon={<SearchIcon />}>
          Search Orders
        </Button>
      </Stack>

      <Alert severity="info" sx={{ mb: 3 }}>
        The Lab Results & Orders module is in development! This will provide comprehensive 
        laboratory and imaging management with FHIR-native integration.
      </Alert>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Lab Results Management
              </Typography>
              <Typography variant="body2" component="div">
                • Real-time result monitoring<br/>
                • Critical value alerts<br/>
                • Trend analysis and charting<br/>
                • Integration with lab systems<br/>
                • FHIR Observation resources<br/>
                • Result review workflows
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Order Management
              </Typography>
              <Typography variant="body2" component="div">
                • CPOE (Computerized Provider Order Entry)<br/>
                • Order sets and protocols<br/>
                • Status tracking and notifications<br/>
                • Integration with imaging systems<br/>
                • FHIR ServiceRequest resources<br/>
                • Decision support integration
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default LabResultsPage;