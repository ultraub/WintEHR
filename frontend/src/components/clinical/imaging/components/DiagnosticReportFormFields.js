/**
 * DiagnosticReport Form Fields Component
 * Form fields for creating and editing imaging reports
 */
import React from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Paper,
  Grid,
  Stack,
  Alert
} from '@mui/material';
import { format, parseISO } from 'date-fns';
import { DIAGNOSTIC_REPORT_STATUS_OPTIONS, getStudyDetails } from '../config/diagnosticReportDialogConfig';

const DiagnosticReportFormFields = ({ 
  formData, 
  setFormData, 
  errors = {}, 
  study,
  currentStep = 0 
}) => {
  const studyDetails = getStudyDetails(study);

  const handleChange = (field) => (event) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  // Step 1: Study Information (Read-only display)
  if (currentStep === 0) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Study Information
        </Typography>
        <Alert severity="info" sx={{ mb: 3 }}>
          Review the imaging study details below. This report will be linked to this study.
        </Alert>
        
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Modality
                  </Typography>
                  <Typography variant="body1" fontWeight="500">
                    {studyDetails.modality}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Description
                  </Typography>
                  <Typography variant="body1" fontWeight="500">
                    {studyDetails.description}
                  </Typography>
                </Box>
                
                {studyDetails.bodySite && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Body Site
                    </Typography>
                    <Typography variant="body1" fontWeight="500">
                      {studyDetails.bodySite}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Stack spacing={2}>
                {studyDetails.date && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Study Date
                    </Typography>
                    <Typography variant="body1" fontWeight="500">
                      {format(parseISO(studyDetails.date), 'MMM d, yyyy HH:mm')}
                    </Typography>
                  </Box>
                )}
                
                {studyDetails.accession && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Accession Number
                    </Typography>
                    <Typography variant="body1" fontWeight="500">
                      {studyDetails.accession}
                    </Typography>
                  </Box>
                )}
                
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Images
                  </Typography>
                  <Typography variant="body1" fontWeight="500">
                    {studyDetails.series} series, {studyDetails.instances} instances
                  </Typography>
                </Box>
              </Stack>
            </Grid>
          </Grid>
        </Paper>
      </Box>
    );
  }

  // Step 2: Report Status and Findings
  if (currentStep === 1) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Report Details
        </Typography>
        
        <Stack spacing={3}>
          <FormControl fullWidth error={!!errors.status}>
            <InputLabel>Report Status</InputLabel>
            <Select
              value={formData.status || ''}
              onChange={handleChange('status')}
              label="Report Status"
            >
              {DIAGNOSTIC_REPORT_STATUS_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.display}
                </MenuItem>
              ))}
            </Select>
            {errors.status && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                {errors.status}
              </Typography>
            )}
          </FormControl>

          <TextField
            label="Findings"
            multiline
            rows={8}
            fullWidth
            value={formData.findings || ''}
            onChange={handleChange('findings')}
            error={!!errors.findings}
            helperText={errors.findings || "Describe what was observed in the images"}
            placeholder="Detailed description of imaging findings..."
          />
        </Stack>
      </Box>
    );
  }

  // Step 3: Impression and Recommendations
  if (currentStep === 2) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Clinical Interpretation
        </Typography>
        
        <Stack spacing={3}>
          <TextField
            label="Impression"
            multiline
            rows={6}
            fullWidth
            value={formData.impression || ''}
            onChange={handleChange('impression')}
            error={!!errors.impression}
            helperText={errors.impression || "Summary and interpretation of findings"}
            placeholder="Clinical impression and diagnostic conclusions..."
          />

          <TextField
            label="Recommendations"
            multiline
            rows={4}
            fullWidth
            value={formData.recommendations || ''}
            onChange={handleChange('recommendations')}
            error={!!errors.recommendations}
            helperText={errors.recommendations || "Follow-up actions or additional studies (optional)"}
            placeholder="Recommended follow-up studies or clinical actions..."
          />
        </Stack>
      </Box>
    );
  }

  return null;
};

export default DiagnosticReportFormFields;