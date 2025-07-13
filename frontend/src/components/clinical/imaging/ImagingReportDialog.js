/**
 * Imaging Report Dialog Component - Migrated to BaseResourceDialog
 * Modern imaging report creation/editing using the new BaseResourceDialog pattern
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Stack,
  Chip,
  Alert,
  IconButton
} from '@mui/material';
import {
  Print as PrintIcon,
  Description as ReportIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import BaseResourceDialog from '../../base/BaseResourceDialog';
import DiagnosticReportFormFields from './components/DiagnosticReportFormFields';
import {
  initialValues,
  validationRules,
  parseDiagnosticReportResource,
  createDiagnosticReportResource,
  updateDiagnosticReportResource,
  getStudyDetails,
  getStatusColor,
  getReportCodeFromStudy
} from './config/diagnosticReportDialogConfig';
import { useFHIRResource } from '../../../contexts/FHIRResourceContext';

const ImagingReportDialog = ({ 
  open, 
  onClose, 
  onSave,
  study, 
  patientId,
  mode = 'add' // 'add' | 'edit' | 'view'
}) => {
  const { getPatientResources } = useFHIRResource();
  const [existingReport, setExistingReport] = useState(null);
  const [loading, setLoading] = useState(true);

  // Find existing report for this study
  useEffect(() => {
    if (open && study && patientId) {
      findExistingReport();
    }
  }, [open, study, patientId]);

  const findExistingReport = async () => {
    setLoading(true);
    try {
      // Look for DiagnosticReport resources linked to this ImagingStudy
      const diagnosticReports = getPatientResources(patientId, 'DiagnosticReport') || [];
      
      // Find reports that reference this imaging study
      const linkedReport = diagnosticReports.find(dr => {
        // Check if the report references this ImagingStudy
        const basedOn = dr.basedOn || [];
        const hasImagingStudyRef = basedOn.some(ref => 
          ref.reference === `ImagingStudy/${study.id}` ||
          ref.reference === study.id
        );
        
        // Also check if the report has the same procedure code
        const hasSameProcedure = dr.code?.coding?.some(coding =>
          study.procedureCode?.[0]?.coding?.some(studyCoding =>
            coding.code === studyCoding.code && coding.system === studyCoding.system
          )
        );
        
        return hasImagingStudyRef || hasSameProcedure;
      });

      setExistingReport(linkedReport || null);
    } catch (error) {
      console.error('Error finding existing report:', error);
      setExistingReport(null);
    } finally {
      setLoading(false);
    }
  };

  // Parse existing resource for edit mode
  const parsedInitialValues = existingReport 
    ? parseDiagnosticReportResource(existingReport)
    : {
        ...initialValues,
        reportCode: getReportCodeFromStudy(study)?.code || initialValues.reportCode
      };

  // Custom validation function
  const handleValidate = (formData) => {
    const errors = {};
    
    // Check findings requirement
    if (!formData.findings || formData.findings.trim().length < 10) {
      errors.findings = 'Findings must be at least 10 characters long';
    }
    
    // Check impression requirement
    if (!formData.impression || formData.impression.trim().length < 5) {
      errors.impression = 'Impression must be at least 5 characters long';
    }
    
    // Check status requirement
    if (!formData.status) {
      errors.status = 'Report status is required';
    }
    
    return errors;
  };

  // Handle save operation
  const handleSave = async (formData, currentMode) => {
    try {
      let savedResource;
      
      if (currentMode === 'edit' && existingReport) {
        // Update existing DiagnosticReport
        savedResource = updateDiagnosticReportResource(
          formData, 
          existingReport, 
          'current-user', // TODO: Get from auth context
          'Dr. Current User' // TODO: Get from auth context
        );
      } else {
        // Create new DiagnosticReport
        savedResource = createDiagnosticReportResource(
          formData, 
          patientId,
          study,
          'current-user', // TODO: Get from auth context
          'Dr. Current User' // TODO: Get from auth context
        );
      }
      
      // Call the parent save callback
      await onSave(savedResource, currentMode);
    } catch (error) {
      throw new Error(error.message || 'Failed to save imaging report');
    }
  };

  // Dialog title based on mode and existing report
  const getDialogTitle = () => {
    if (existingReport) {
      return mode === 'edit' ? 'Edit Imaging Report' : 'View Imaging Report';
    }
    return 'Create Imaging Report';
  };

  // Custom dialog title with study info and print button
  const renderCustomTitle = () => {
    const studyDetails = getStudyDetails(study);
    
    return (
      <Stack direction="row" alignItems="center" justifyContent="space-between" width="100%">
        <Stack direction="row" alignItems="center" spacing={2}>
          <ReportIcon />
          <Box>
            <Typography variant="h6">
              {getDialogTitle()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {studyDetails.modality} - {studyDetails.description}
            </Typography>
          </Box>
          {existingReport && (
            <Chip 
              label={existingReport.status} 
              size="small" 
              color={getStatusColor(existingReport.status)}
            />
          )}
        </Stack>
        
        <IconButton onClick={() => window.print()} size="small">
          <PrintIcon />
        </IconButton>
      </Stack>
    );
  };

  // Preview content for the stepper
  const renderPreview = (formData) => {
    const studyDetails = getStudyDetails(study);
    
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Report Summary
        </Typography>
        
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Study: {studyDetails.modality} - {studyDetails.description}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Status: {formData.status} | {studyDetails.date ? format(parseISO(studyDetails.date), 'MMM d, yyyy') : 'No date'}
          </Typography>
        </Paper>

        {formData.findings && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Findings
            </Typography>
            <Typography variant="body2" sx={{ 
              maxHeight: 100, 
              overflow: 'auto',
              bgcolor: 'grey.50',
              p: 1,
              borderRadius: 1
            }}>
              {formData.findings}
            </Typography>
          </Box>
        )}

        {formData.impression && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Impression
            </Typography>
            <Typography variant="body2" sx={{ 
              maxHeight: 100, 
              overflow: 'auto',
              bgcolor: 'grey.50',
              p: 1,
              borderRadius: 1
            }}>
              {formData.impression}
            </Typography>
          </Box>
        )}

        {formData.recommendations && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Recommendations
            </Typography>
            <Typography variant="body2" sx={{ 
              maxHeight: 100, 
              overflow: 'auto',
              bgcolor: 'grey.50',
              p: 1,
              borderRadius: 1
            }}>
              {formData.recommendations}
            </Typography>
          </Box>
        )}
      </Box>
    );
  };

  if (loading) {
    return null; // Could show a loading dialog here
  }

  // Determine actual mode based on existing report
  const actualMode = existingReport ? (mode === 'add' ? 'edit' : mode) : 'add';

  return (
    <BaseResourceDialog
      // Dialog props
      open={open}
      onClose={onClose}
      title={renderCustomTitle()}
      maxWidth="lg"
      fullWidth
      
      // Resource props
      resourceType="DiagnosticReport"
      resource={existingReport}
      mode={actualMode}
      
      // Form configuration
      initialValues={parsedInitialValues}
      validationRules={validationRules}
      
      // Callbacks
      onSave={handleSave}
      onValidate={handleValidate}
      
      // UI customization
      showPreview={true}
      showCancel={true}
      renderPreview={renderPreview}
      
      // Form steps configuration
      steps={[
        { 
          label: 'Study Review', 
          description: 'Review imaging study information' 
        },
        { 
          label: 'Findings', 
          description: 'Document imaging findings and report status' 
        },
        { 
          label: 'Interpretation', 
          description: 'Provide clinical impression and recommendations' 
        }
      ]}
    >
      <DiagnosticReportFormFields 
        study={study}
      />
    </BaseResourceDialog>
  );
};

export default ImagingReportDialog;