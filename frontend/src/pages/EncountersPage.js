import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  Button,
  Stack
} from '@mui/material';
import { EventNote as EncounterIcon, Add as AddIcon } from '@mui/icons-material';

const EncountersPage = () => {
  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <EncounterIcon color="primary" />
        <Typography variant="h4" component="h1">
          Encounters
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          New Encounter
        </Button>
      </Stack>

      <Alert severity="info" sx={{ mb: 3 }}>
        The Encounters module is coming soon! This will provide comprehensive visit management, 
        scheduling, and encounter documentation capabilities.
      </Alert>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Planned Features
          </Typography>
          <Typography variant="body2" component="div">
            • Visit scheduling and management<br/>
            • Encounter templates and workflows<br/>
            • Provider assignments<br/>
            • Billing integration<br/>
            • Patient check-in/check-out<br/>
            • Real-time encounter status
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default EncountersPage;