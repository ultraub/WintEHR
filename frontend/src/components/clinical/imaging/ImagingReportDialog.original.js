/**
 * Imaging Report Dialog Component
 * Display and create imaging reports linked to ImagingStudy resources
 */
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  TextField,
  Divider,
  Stack,
  Chip,
  CircularProgress,
  Alert,
  Paper,
  Grid,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Close as CloseIcon,
  Description as ReportIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Print as PrintIcon,
  CalendarMonth as DateIcon,
  Person as PersonIcon,
  LocalHospital as HospitalIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { useFHIRResource } from '../../../contexts/FHIRResourceContext';
import { fhirClient } from '../../../services/fhirClient';

const ImagingReportDialog = ({ open, onClose, study, patientId }) => {
  const { getPatientResources, refreshResources } = useFHIRResource();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    findings: '',
    impression: '',
    recommendations: '',
    status: 'final'
  });

  useEffect(() => {
    if (open && study) {
      loadReport();
    }
  }, [open, study]);

  const loadReport = async () => {
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

      if (linkedReport) {
        setReport(linkedReport);
        // Extract the text components from the FHIR DiagnosticReport
        let findings = '';
        if (linkedReport.presentedForm?.[0]?.data) {
          // Data might be base64 or hex encoded
          const data = linkedReport.presentedForm[0].data;
          try {
            // Try base64 decode first
            findings = atob(data);
          } catch (e) {
            // If base64 fails, try hex decode
            try {
              findings = data.match(/.{1,2}/g).map(byte => 
                String.fromCharCode(parseInt(byte, 16))
              ).join('');
            } catch (hexError) {
              // If both fail, use as-is
              findings = data;
            }
          }
        } else if (linkedReport.text?.div) {
          findings = linkedReport.text.div;
        }
        
        const impression = linkedReport.conclusion || '';
        const recommendations = linkedReport.conclusionCode?.[0]?.text || '';
        
        setFormData({
          findings: findings,
          impression: impression,
          recommendations: recommendations,
          status: linkedReport.status || 'final'
        });
      } else {
        // No existing report, prepare for creation
        setReport(null);
        setFormData({
          findings: '',
          impression: '',
          recommendations: '',
          status: 'preliminary'
        });
      }
    } catch (error) {
      
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const reportData = {
        resourceType: 'DiagnosticReport',
        status: formData.status,
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '18748-4',
            display: 'Diagnostic Imaging Report'
          }],
          text: `${study.modality?.[0]?.display || 'Imaging'} Report - ${study.description || 'Unknown Study'}`
        },
        subject: {
          reference: `Patient/${patientId}`
        },
        effectiveDateTime: new Date().toISOString(),
        issued: new Date().toISOString(),
        basedOn: [{
          reference: `ImagingStudy/${study.id}`,
          display: study.description
        }],
        conclusion: formData.impression,
        conclusionCode: formData.recommendations ? [{
          text: formData.recommendations
        }] : undefined,
        presentedForm: [{
          contentType: 'text/plain',
          data: btoa(formData.findings), // Base64 encode the findings
          title: 'Detailed Findings'
        }]
      };

      if (report) {
        // Update existing report
        reportData.id = report.id;
        await fhirClient.update('DiagnosticReport', report.id, reportData);
      } else {
        // Create new report
        await fhirClient.create('DiagnosticReport', reportData);
      }

      // Refresh resources to get the updated report
      await refreshResources(patientId);
      await loadReport();
      setEditing(false);
    } catch (error) {
      
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getStudyDetails = () => {
    if (!study) return {};
    
    return {
      modality: study.modality?.[0]?.display || study.modality?.[0]?.code || 'Unknown',
      description: study.description || 'Imaging Study',
      date: study.started || study.performedDateTime,
      bodySite: study.bodySite?.[0]?.display || study.bodySite?.[0]?.coding?.[0]?.display || '',
      accession: study.identifier?.[0]?.value || '',
      series: study.numberOfSeries || 0,
      instances: study.numberOfInstances || 0
    };
  };

  const studyDetails = getStudyDetails();

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <ReportIcon />
            <Typography variant="h6">Imaging Report</Typography>
            {report && (
              <Chip 
                label={report.status} 
                size="small" 
                color={report.status === 'final' ? 'success' : 'warning'}
              />
            )}
          </Stack>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box>
            {/* Study Information */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Study Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Modality:</strong> {studyDetails.modality}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Description:</strong> {studyDetails.description}
                    </Typography>
                    {studyDetails.bodySite && (
                      <Typography variant="body2" color="text.secondary">
                        <strong>Body Site:</strong> {studyDetails.bodySite}
                      </Typography>
                    )}
                  </Stack>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Stack spacing={1}>
                    {studyDetails.date && (
                      <Typography variant="body2" color="text.secondary">
                        <strong>Study Date:</strong> {format(parseISO(studyDetails.date), 'MMM d, yyyy HH:mm')}
                      </Typography>
                    )}
                    {studyDetails.accession && (
                      <Typography variant="body2" color="text.secondary">
                        <strong>Accession:</strong> {studyDetails.accession}
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary">
                      <strong>Images:</strong> {studyDetails.series} series, {studyDetails.instances} instances
                    </Typography>
                  </Stack>
                </Grid>
              </Grid>
            </Paper>

            {/* Report Content */}
            {editing ? (
              <Stack spacing={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    label="Status"
                  >
                    <MenuItem value="preliminary">Preliminary</MenuItem>
                    <MenuItem value="final">Final</MenuItem>
                    <MenuItem value="amended">Amended</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  label="Findings"
                  multiline
                  rows={8}
                  fullWidth
                  value={formData.findings}
                  onChange={(e) => setFormData({ ...formData, findings: e.target.value })}
                  helperText="Describe what was observed in the images"
                />

                <TextField
                  label="Impression"
                  multiline
                  rows={4}
                  fullWidth
                  value={formData.impression}
                  onChange={(e) => setFormData({ ...formData, impression: e.target.value })}
                  helperText="Summary and interpretation of findings"
                />

                <TextField
                  label="Recommendations"
                  multiline
                  rows={3}
                  fullWidth
                  value={formData.recommendations}
                  onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
                  helperText="Follow-up actions or additional studies (optional)"
                />
              </Stack>
            ) : (
              <Stack spacing={3}>
                {!report ? (
                  <Alert severity="info">
                    No report exists for this imaging study. Click "Create Report" to add one.
                  </Alert>
                ) : (
                  <>
                    {/* Report Header */}
                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          Report Details
                        </Typography>
                        {report.issued && (
                          <Typography variant="caption" color="text.secondary">
                            Issued: {format(parseISO(report.issued), 'MMM d, yyyy HH:mm')}
                          </Typography>
                        )}
                      </Stack>
                      <Divider />
                    </Box>

                    {/* Findings */}
                    {formData.findings && (
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                          Findings
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {formData.findings}
                        </Typography>
                      </Box>
                    )}

                    {/* Impression */}
                    {formData.impression && (
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                          Impression
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {formData.impression}
                        </Typography>
                      </Box>
                    )}

                    {/* Recommendations */}
                    {formData.recommendations && (
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                          Recommendations
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {formData.recommendations}
                        </Typography>
                      </Box>
                    )}
                  </>
                )}
              </Stack>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handlePrint} startIcon={<PrintIcon />}>
          Print
        </Button>
        {editing ? (
          <>
            <Button onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              startIcon={<SaveIcon />}
              disabled={saving || !formData.findings || !formData.impression}
            >
              {saving ? 'Saving...' : 'Save Report'}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onClose}>
              Close
            </Button>
            <Button
              variant="contained"
              onClick={() => setEditing(true)}
              startIcon={<EditIcon />}
            >
              {report ? 'Edit Report' : 'Create Report'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ImagingReportDialog;