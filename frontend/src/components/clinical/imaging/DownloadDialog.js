import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
  Typography,
  Box,
  Alert,
  LinearProgress,
  Stack,
  Chip
} from '@mui/material';
import {
  Download as DownloadIcon,
  Image as ImageIcon,
  Folder as FolderIcon
} from '@mui/icons-material';
import { downloadDICOMStudy, exportDICOMImages, formatFileSize } from '../../../core/imaging/imagingUtils';

const DownloadDialog = ({ open, onClose, study }) => {
  const [downloadType, setDownloadType] = useState('dicom');
  const [imageFormat, setImageFormat] = useState('jpeg');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState(null);
  
  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);
    setDownloadProgress(0);
    
    try {
      if (downloadType === 'dicom') {
        await downloadDICOMStudy(study, setDownloadProgress);
      } else {
        await exportDICOMImages(study?.id, imageFormat, setDownloadProgress);
      }
      
      // Success - close dialog after a short delay
      setTimeout(() => {
        onClose();
        setIsDownloading(false);
        setDownloadProgress(0);
      }, 1000);
    } catch (err) {
      setError(err.message || 'Download failed');
      setIsDownloading(false);
    }
  };
  
  const getEstimatedSize = () => {
    if (!study || !study.numberOfInstances) return 'Unknown size';
    
    // Rough estimates
    const bytesPerInstance = downloadType === 'dicom' ? 512000 : 100000; // 500KB for DICOM, 100KB for JPEG
    const estimatedBytes = study.numberOfInstances * bytesPerInstance;
    return formatFileSize(estimatedBytes);
  };
  
  return (
    <Dialog open={open} onClose={!isDownloading ? onClose : undefined} maxWidth="sm" fullWidth>
      <DialogTitle>
        Download Imaging Study
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          {/* Study Info */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Study Information
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {study?.description || 'Imaging Study'}
            </Typography>
            <Stack direction="row" spacing={1} mt={1}>
              <Chip 
                label={`${study?.numberOfSeries || 0} series`} 
                size="small" 
                icon={<FolderIcon />}
              />
              <Chip 
                label={`${study?.numberOfInstances || 0} images`} 
                size="small" 
                icon={<ImageIcon />}
              />
              <Chip 
                label={`~${getEstimatedSize()}`} 
                size="small"
                color="primary"
              />
            </Stack>
          </Box>
          
          {/* Download Options */}
          <FormControl component="fieldset">
            <FormLabel component="legend">Download Format</FormLabel>
            <RadioGroup
              value={downloadType}
              onChange={(e) => setDownloadType(e.target.value)}
            >
              <FormControlLabel 
                value="dicom" 
                control={<Radio />} 
                label={
                  <Box>
                    <Typography>Original DICOM Files</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Full quality, includes all metadata
                    </Typography>
                  </Box>
                }
                disabled={isDownloading}
              />
              <FormControlLabel 
                value="images" 
                control={<Radio />} 
                label={
                  <Box>
                    <Typography>Image Files (JPEG/PNG)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Compressed, easy to view and share
                    </Typography>
                  </Box>
                }
                disabled={isDownloading}
              />
            </RadioGroup>
          </FormControl>
          
          {/* Image Format Selection */}
          {downloadType === 'images' && (
            <FormControl component="fieldset">
              <FormLabel component="legend">Image Format</FormLabel>
              <RadioGroup
                row
                value={imageFormat}
                onChange={(e) => setImageFormat(e.target.value)}
              >
                <FormControlLabel 
                  value="jpeg" 
                  control={<Radio size="small" />} 
                  label="JPEG"
                  disabled={isDownloading}
                />
                <FormControlLabel 
                  value="png" 
                  control={<Radio size="small" />} 
                  label="PNG"
                  disabled={isDownloading}
                />
              </RadioGroup>
            </FormControl>
          )}
          
          {/* Progress */}
          {isDownloading && (
            <Box>
              <Typography variant="body2" gutterBottom>
                Preparing download... {downloadProgress}%
              </Typography>
              <LinearProgress variant="determinate" value={downloadProgress} />
            </Box>
          )}
          
          {/* Error */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          
          {/* Info */}
          <Alert severity="info">
            Downloaded files will be compressed into a ZIP archive.
            Large studies may take several minutes to prepare.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isDownloading}>
          Cancel
        </Button>
        <Button 
          onClick={handleDownload} 
          variant="contained" 
          startIcon={<DownloadIcon />}
          disabled={isDownloading}
        >
          {isDownloading ? 'Downloading...' : 'Download'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DownloadDialog;