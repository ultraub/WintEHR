import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  Stack,
  Chip,
  IconButton,
  InputAdornment,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  FormControlLabel,
  Switch,
  CircularProgress,
  Snackbar
} from '@mui/material';
import {
  Share as ShareIcon,
  ContentCopy as CopyIcon,
  Link as LinkIcon,
  AccessTime as TimeIcon,
  Lock as LockIcon,
  Email as EmailIcon
} from '@mui/icons-material';
import { generateShareLink, copyShareLink } from '../../../core/imaging/imagingUtils';
import { format, addHours } from 'date-fns';

const ShareDialog = ({ open, onClose, study }) => {
  const [shareLink, setShareLink] = useState('');
  const [shareCode, setShareCode] = useState('');
  const [expiresAt, setExpiresAt] = useState(null);
  const [expirationHours, setExpirationHours] = useState(72);
  const [requireAuth, setRequireAuth] = useState(true);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  
  const handleGenerateLink = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const result = await generateShareLink(study, {
        expirationHours,
        requireAuth
      });
      
      setShareLink(result.shareUrl);
      setShareCode(result.shareCode);
      setExpiresAt(result.expiresAt);
    } catch (err) {
      setError(err.message || 'Failed to generate share link');
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleCopyLink = async () => {
    const success = await copyShareLink(shareLink);
    if (success) {
      setCopySuccess(true);
    }
  };
  
  const handleEmailShare = () => {
    const subject = encodeURIComponent(`Shared Medical Imaging: ${study?.description || 'Imaging Study'}`);
    const body = encodeURIComponent(
      `You have been granted access to view medical imaging.\n\n` +
      `Study: ${study?.description || 'Imaging Study'}\n` +
      `Date: ${study?.started ? format(new Date(study.started), 'MMMM d, yyyy') : 'Unknown'}\n\n` +
      `Access Link: ${shareLink}\n` +
      (shareCode ? `Access Code: ${shareCode}\n` : '') +
      `\nThis link will expire on ${format(new Date(expiresAt), 'MMMM d, yyyy h:mm a')}.`
    );
    
    const mailto = `mailto:${recipientEmail}?subject=${subject}&body=${body}`;
    window.location.href = mailto;
  };
  
  const handleClose = () => {
    setShareLink('');
    setShareCode('');
    setExpiresAt(null);
    setError(null);
    onClose();
  };
  
  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          Share Imaging Study
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
                  label={study?.modality?.[0]?.code || 'Unknown'} 
                  size="small"
                  color="primary"
                />
                <Chip 
                  label={`${study?.numberOfInstances || 0} images`} 
                  size="small"
                />
              </Stack>
            </Box>
            
            {!shareLink ? (
              <>
                {/* Share Settings */}
                <FormControl fullWidth>
                  <InputLabel>Link Expiration</InputLabel>
                  <Select
                    value={expirationHours}
                    onChange={(e) => setExpirationHours(e.target.value)}
                    label="Link Expiration"
                  >
                    <MenuItem value={24}>24 hours</MenuItem>
                    <MenuItem value={72}>3 days</MenuItem>
                    <MenuItem value={168}>1 week</MenuItem>
                    <MenuItem value={720}>30 days</MenuItem>
                  </Select>
                </FormControl>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={requireAuth}
                      onChange={(e) => setRequireAuth(e.target.checked)}
                    />
                  }
                  label={
                    <Box>
                      <Typography>Require Authentication</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Recipients will need to verify their identity
                      </Typography>
                    </Box>
                  }
                />
                
                {/* Error */}
                {error && (
                  <Alert severity="error" onClose={() => setError(null)}>
                    {error}
                  </Alert>
                )}
              </>
            ) : (
              <>
                {/* Generated Link */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Share Link Generated
                  </Typography>
                  <TextField
                    fullWidth
                    value={shareLink}
                    InputProps={{
                      readOnly: true,
                      startAdornment: (
                        <InputAdornment position="start">
                          <LinkIcon />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={handleCopyLink} edge="end">
                            <CopyIcon />
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                    helperText={`Expires ${format(new Date(expiresAt), 'MMM d, yyyy h:mm a')}`}
                  />
                </Box>
                
                {/* Access Code (if auth required) */}
                {shareCode && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Access Code
                    </Typography>
                    <TextField
                      fullWidth
                      value={shareCode}
                      InputProps={{
                        readOnly: true,
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockIcon />
                          </InputAdornment>
                        )
                      }}
                      helperText="Share this code separately for added security"
                    />
                  </Box>
                )}
                
                {/* Email Share */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Email Link
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      fullWidth
                      type="email"
                      placeholder="recipient@example.com"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <EmailIcon />
                          </InputAdornment>
                        )
                      }}
                    />
                    <Button
                      variant="outlined"
                      onClick={handleEmailShare}
                      disabled={!recipientEmail}
                    >
                      Send
                    </Button>
                  </Stack>
                </Box>
                
                {/* Security Info */}
                <Alert severity="info" icon={<TimeIcon />}>
                  This link will expire in {expirationHours} hours and can only be used to view the images.
                  No download or modification permissions are granted.
                </Alert>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>
            {shareLink ? 'Done' : 'Cancel'}
          </Button>
          {!shareLink && (
            <Button 
              onClick={handleGenerateLink} 
              variant="contained" 
              startIcon={isGenerating ? <CircularProgress size={20} /> : <ShareIcon />}
              disabled={isGenerating}
            >
              Generate Link
            </Button>
          )}
        </DialogActions>
      </Dialog>
      
      {/* Copy Success Notification */}
      <Snackbar
        open={copySuccess}
        autoHideDuration={3000}
        onClose={() => setCopySuccess(false)}
        message="Link copied to clipboard"
      />
    </>
  );
};

export default ShareDialog;