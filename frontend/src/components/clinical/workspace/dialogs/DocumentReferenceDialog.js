import React from 'react';
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
  Alert,
  Stack,
  Paper,
  Link
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

const DocumentReferenceDialog = ({ open, onClose, document, patientId, onSaved }) => {
  const isViewMode = !!document;

  const handleClose = () => {
    onClose();
  };

  const handleSave = async () => {
    // TODO: Implement save functionality
    if (onSaved) {
      onSaved();
    }
    handleClose();
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
                              {content.attachment?.size && ` • ${Math.round(content.attachment.size / 1024)} KB`}
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
          <Alert severity="info">
            Document upload functionality coming soon
          </Alert>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose}>
          {isViewMode ? 'Close' : 'Cancel'}
        </Button>
        {!isViewMode && (
          <Button onClick={handleSave} variant="contained" color="primary">
            Save
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DocumentReferenceDialog;