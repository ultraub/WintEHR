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
import { Assignment as WorkspaceIcon, Person as PersonIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const ClinicalWorkspacePageSimple = () => {
  const navigate = useNavigate();

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <WorkspaceIcon color="primary" />
        <Typography variant="h4" component="h1">
          Clinical Workspace
        </Typography>
      </Stack>

      <Alert severity="success" sx={{ mb: 3 }}>
        🩺 Welcome to the Clinical Workspace! Select a patient to begin working with comprehensive 
        chart review, documentation, and order management tools.
      </Alert>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Get Started
          </Typography>
          <Typography variant="body1" paragraph>
            The Clinical Workspace provides:
          </Typography>
          <Typography variant="body2" component="div" sx={{ mb: 2 }}>
            • Chart Review - Complete patient history and timeline<br/>
            • Documentation - Smart note templates and structured data entry<br/>
            • Order Management - CPOE with clinical decision support<br/>
            • Care Planning - Goal setting and population health tools
          </Typography>
          
          <Button 
            variant="contained" 
            onClick={() => navigate('/patients')}
            startIcon={<PersonIcon />}
            size="large"
          >
            Select a Patient to Begin
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ClinicalWorkspacePageSimple;