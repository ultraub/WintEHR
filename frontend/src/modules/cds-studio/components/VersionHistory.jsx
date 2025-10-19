import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent
} from '@mui/lab';
import {
  History as HistoryIcon,
  CheckCircle as CurrentIcon,
  Update as VersionIcon,
  Restore as RestoreIcon
} from '@mui/icons-material';
import cdsStudioApi from '../services/cdsStudioApi';

const VersionHistory = ({ serviceId }) => {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rollbackDialog, setRollbackDialog] = useState({
    open: false,
    version: null,
    notes: ''
  });
  const [rollbackLoading, setRollbackLoading] = useState(false);

  useEffect(() => {
    if (serviceId) {
      loadVersionHistory();
    }
  }, [serviceId]);

  const loadVersionHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await cdsStudioApi.getVersionHistory(serviceId);
      setVersions(data.versions || []);
    } catch (err) {
      console.error('Failed to load version history:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRollbackClick = (version) => {
    setRollbackDialog({
      open: true,
      version,
      notes: `Rollback to version ${version.version}`
    });
  };

  const handleRollbackConfirm = async () => {
    try {
      setRollbackLoading(true);

      await cdsStudioApi.rollbackService(
        serviceId,
        rollbackDialog.version.version,
        rollbackDialog.notes
      );

      // Close dialog and refresh
      setRollbackDialog({ open: false, version: null, notes: '' });
      await loadVersionHistory();

      // Notify user to refresh the page
      alert('Service rolled back successfully. Please refresh the page to see changes.');
    } catch (err) {
      console.error('Rollback failed:', err);
      setError(err.message);
    } finally {
      setRollbackLoading(false);
    }
  };

  const handleRollbackCancel = () => {
    setRollbackDialog({ open: false, version: null, notes: '' });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString();
  };

  if (loading && versions.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" onClose={() => setError(null)}>
        {error}
      </Alert>
    );
  }

  if (versions.length === 0) {
    return (
      <Alert severity="info">
        No version history available for this service.
      </Alert>
    );
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <HistoryIcon />
        <Typography variant="h6">Version History</Typography>
        <Chip label={`${versions.length} versions`} size="small" />
      </Box>

      <Timeline position="right">
        {versions.map((version, index) => {
          const isCurrent = index === 0;

          return (
            <TimelineItem key={version.id || index}>
              <TimelineOppositeContent color="text.secondary" sx={{ flex: 0.3 }}>
                <Typography variant="body2">{formatDate(version.created_at)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {version.created_by || 'System'}
                </Typography>
              </TimelineOppositeContent>

              <TimelineSeparator>
                <TimelineDot color={isCurrent ? 'primary' : 'grey'}>
                  {isCurrent ? <CurrentIcon fontSize="small" /> : <VersionIcon fontSize="small" />}
                </TimelineDot>
                {index < versions.length - 1 && <TimelineConnector />}
              </TimelineSeparator>

              <TimelineContent>
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="start" mb={1}>
                      <Box>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="h6" component="span">
                            Version {version.version}
                          </Typography>
                          {isCurrent && (
                            <Chip label="Current" size="small" color="primary" />
                          )}
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {version.status}
                        </Typography>
                      </Box>
                      {!isCurrent && (
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<RestoreIcon />}
                          onClick={() => handleRollbackClick(version)}
                        >
                          Rollback
                        </Button>
                      )}
                    </Box>

                    {version.version_notes && (
                      <Box mt={2}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Notes:
                        </Typography>
                        <Typography variant="body2">
                          {version.version_notes}
                        </Typography>
                      </Box>
                    )}

                    {version.changes && version.changes.length > 0 && (
                      <Box mt={2}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Changes:
                        </Typography>
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                          {version.changes.map((change, idx) => (
                            <li key={idx}>
                              <Typography variant="body2">{change}</Typography>
                            </li>
                          ))}
                        </ul>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </TimelineContent>
            </TimelineItem>
          );
        })}
      </Timeline>

      {/* Rollback Confirmation Dialog */}
      <Dialog
        open={rollbackDialog.open}
        onClose={handleRollbackCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <RestoreIcon />
            Rollback to Version {rollbackDialog.version?.version}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will create a new version based on version {rollbackDialog.version?.version}.
            The current version will be preserved in history.
          </Alert>

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Rollback Notes"
            value={rollbackDialog.notes}
            onChange={(e) => setRollbackDialog({ ...rollbackDialog, notes: e.target.value })}
            placeholder="Describe why you're rolling back..."
            sx={{ mt: 2 }}
          />

          {rollbackDialog.version && (
            <Box mt={2}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Version to restore:
              </Typography>
              <Typography variant="body2">
                Version {rollbackDialog.version.version} - {rollbackDialog.version.version_notes}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Created: {formatDate(rollbackDialog.version.created_at)}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRollbackCancel} disabled={rollbackLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleRollbackConfirm}
            disabled={rollbackLoading}
            startIcon={rollbackLoading ? <CircularProgress size={20} /> : <RestoreIcon />}
          >
            {rollbackLoading ? 'Rolling back...' : 'Confirm Rollback'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VersionHistory;
