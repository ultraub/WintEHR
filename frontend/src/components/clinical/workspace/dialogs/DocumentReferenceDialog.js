import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Typography,
  Box,
  Chip,
  IconButton,
  Stack,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  Description as DocumentIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  PictureAsPdf as PdfIcon,
  Image as ImageIcon,
  Article as ArticleIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';

const DOCUMENT_TYPES = [
  { value: 'clinical-note', display: 'Clinical Note', system: 'http://loinc.org', code: '11506-3' },
  { value: 'discharge-summary', display: 'Discharge Summary', system: 'http://loinc.org', code: '18842-5' },
  { value: 'progress-note', display: 'Progress Note', system: 'http://loinc.org', code: '11536-0' },
  { value: 'consultation', display: 'Consultation Note', system: 'http://loinc.org', code: '11488-4' },
  { value: 'operative-note', display: 'Operative Note', system: 'http://loinc.org', code: '11504-8' },
  { value: 'referral', display: 'Referral Letter', system: 'http://loinc.org', code: '57133-1' },
  { value: 'other', display: 'Other', system: 'http://loinc.org', code: '47045-0' }
];

const INITIAL_FORM = {
  documentType: 'clinical-note',
  description: '',
  date: new Date().toISOString().split('T')[0],
  content: '',
  status: 'current'
};

const DocumentReferenceDialog = ({ open, onClose, document, patientId, onSaved }) => {
  const isViewMode = !!document;
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleClose = () => {
    setFormData(INITIAL_FORM);
    setError(null);
    onClose();
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.content.trim()) {
      setError('Document content is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const docType = DOCUMENT_TYPES.find(t => t.value === formData.documentType) || DOCUMENT_TYPES[0];

      const fhirDocRef = {
        resourceType: 'DocumentReference',
        status: formData.status,
        type: {
          coding: [{
            system: docType.system,
            code: docType.code,
            display: docType.display
          }],
          text: docType.display
        },
        subject: { reference: `Patient/${patientId}` },
        date: new Date(formData.date).toISOString(),
        content: [{
          attachment: {
            contentType: 'text/plain',
            data: btoa(unescape(encodeURIComponent(formData.content.trim()))),
            title: formData.description.trim() || docType.display
          }
        }]
      };

      if (formData.description.trim()) {
        fhirDocRef.description = formData.description.trim();
      }

      await fhirClient.create('DocumentReference', fhirDocRef);

      if (onSaved) {
        onSaved();
      }
      handleClose();
    } catch (err) {
      console.error('Error creating document reference:', err);
      setError(err.message || 'Failed to create document');
    } finally {
      setSaving(false);
    }
  };

  const getDocumentIcon = (mimeType) => {
    if (mimeType?.includes('pdf')) return <PdfIcon />;
    if (mimeType?.includes('image')) return <ImageIcon />;
    return <ArticleIcon />;
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 0
        }
      }}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <DocumentIcon />
            <Typography variant="h6">
              {isViewMode ? 'View Document' : 'Add Document'}
            </Typography>
          </Stack>
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {isViewMode && document ? (
          <Box>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    backgroundColor: 'grey.50',
                    borderRadius: 0,
                    border: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                    {getDocumentIcon(document.content?.[0]?.attachment?.contentType)}
                    <Typography variant="h6">
                      {document.description || document.type?.text || 'Clinical Document'}
                    </Typography>
                  </Stack>

                  <Stack direction="row" spacing={1} mb={2}>
                    <Chip
                      label={document.status || 'current'}
                      color={document.status === 'current' ? 'success' : 'default'}
                      size="small"
                    />
                    {document.docStatus && (
                      <Chip label={document.docStatus} size="small" variant="outlined" />
                    )}
                    {document.type?.coding?.[0]?.display && (
                      <Chip label={document.type.coding[0].display} size="small" variant="outlined" />
                    )}
                  </Stack>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Date
                      </Typography>
                      <Typography variant="body2">
                        {document.date ? format(new Date(document.date), 'MMM d, yyyy h:mm a') : 'Unknown'}
                      </Typography>
                    </Grid>

                    {document.author?.[0] && (
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Author
                        </Typography>
                        <Typography variant="body2">
                          {document.author[0].display || 'Unknown'}
                        </Typography>
                      </Grid>
                    )}

                    {document.context?.encounter?.[0] && (
                      <Grid item xs={12}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Related Encounter
                        </Typography>
                        <Typography variant="body2">
                          {document.context.encounter[0].display || document.context.encounter[0].reference}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </Paper>
              </Grid>

              {document.content && document.content.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>
                    Document Content
                  </Typography>
                  <Stack spacing={2}>
                    {document.content.map((content, index) => (
                      <Paper
                        key={index}
                        elevation={0}
                        sx={{
                          p: 2,
                          borderRadius: 0,
                          border: '1px solid',
                          borderColor: 'divider'
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography variant="body2">
                              {content.attachment?.title || 'Attachment'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {content.attachment?.contentType || 'Unknown type'}
                              {content.attachment?.size && ` \u2022 ${Math.round(content.attachment.size / 1024)} KB`}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={1}>
                            {content.attachment?.url && (
                              <>
                                <IconButton size="small" color="primary">
                                  <ViewIcon />
                                </IconButton>
                                <IconButton size="small" color="primary">
                                  <DownloadIcon />
                                </IconButton>
                              </>
                            )}
                          </Stack>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </Grid>
              )}
            </Grid>
          </Box>
        ) : (
          <Box>
            {error && (
              <Typography color="error" variant="body2" sx={{ mb: 2 }}>
                {error}
              </Typography>
            )}
            <Grid container spacing={2}>
              <Grid item xs={8}>
                <FormControl fullWidth size="small">
                  <InputLabel>Document Type</InputLabel>
                  <Select
                    value={formData.documentType}
                    onChange={(e) => handleChange('documentType', e.target.value)}
                    label="Document Type"
                  >
                    {DOCUMENT_TYPES.map(type => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.display}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    onChange={(e) => handleChange('status', e.target.value)}
                    label="Status"
                  >
                    <MenuItem value="current">Current</MenuItem>
                    <MenuItem value="superseded">Superseded</MenuItem>
                    <MenuItem value="entered-in-error">Entered in Error</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Description"
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="Brief description of the document"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleChange('date', e.target.value)}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Content"
                  value={formData.content}
                  onChange={(e) => handleChange('content', e.target.value)}
                  fullWidth
                  required
                  multiline
                  rows={8}
                  size="small"
                  placeholder="Enter or paste document content here..."
                />
              </Grid>
            </Grid>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          {isViewMode ? 'Close' : 'Cancel'}
        </Button>
        {!isViewMode && (
          <Button
            onClick={handleSave}
            variant="contained"
            color="primary"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : null}
          >
            {saving ? 'Saving...' : 'Save Document'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DocumentReferenceDialog;
