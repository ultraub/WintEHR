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
  Divider,
  Paper
} from '@mui/material';
import {
  Close as CloseIcon,
  Assignment as CarePlanIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { format } from 'date-fns';

const CarePlanDialog = ({ open, onClose, carePlan, patientId, onSaved }) => {
  const isViewMode = !!carePlan;

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
            <CarePlanIcon />
            <Typography variant="h6">
              {isViewMode ? 'View Care Plan' : 'Add Care Plan'}
            </Typography>
          </Stack>
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent dividers>
        {isViewMode && carePlan ? (
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
                  <Typography variant="h6" gutterBottom>
                    {carePlan.title || 'Care Plan'}
                  </Typography>
                  <Stack direction="row" spacing={1} mb={2}>
                    <Chip
                      label={carePlan.status}
                      color={carePlan.status === 'active' ? 'success' : 'default'}
                      size="small"
                    />
                    {carePlan.intent && (
                      <Chip label={carePlan.intent} size="small" variant="outlined" />
                    )}
                  </Stack>
                  
                  {carePlan.description && (
                    <Typography variant="body2" paragraph>
                      {carePlan.description}
                    </Typography>
                  )}
                  
                  {carePlan.period && (
                    <Typography variant="caption" color="text.secondary">
                      Period: {carePlan.period.start && format(new Date(carePlan.period.start), 'MMM d, yyyy')}
                      {carePlan.period.end && ` - ${format(new Date(carePlan.period.end), 'MMM d, yyyy')}`}
                    </Typography>
                  )}
                </Paper>
              </Grid>
              
              {carePlan.goal && carePlan.goal.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>
                    Goals
                  </Typography>
                  <Stack spacing={1}>
                    {carePlan.goal.map((goal, index) => (
                      <Paper
                        key={index}
                        elevation={0}
                        sx={{
                          p: 1.5,
                          borderRadius: 0,
                          border: '1px solid',
                          borderColor: 'divider'
                        }}
                      >
                        <Typography variant="body2">
                          {goal.description?.text || 'Goal'}
                        </Typography>
                      </Paper>
                    ))}
                  </Stack>
                </Grid>
              )}
              
              {carePlan.activity && carePlan.activity.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>
                    Activities
                  </Typography>
                  <Stack spacing={1}>
                    {carePlan.activity.map((activity, index) => (
                      <Paper
                        key={index}
                        elevation={0}
                        sx={{
                          p: 1.5,
                          borderRadius: 0,
                          border: '1px solid',
                          borderColor: 'divider'
                        }}
                      >
                        <Typography variant="body2">
                          {activity.detail?.description || activity.detail?.code?.text || 'Activity'}
                        </Typography>
                        {activity.detail?.status && (
                          <Chip
                            label={activity.detail.status}
                            size="small"
                            sx={{ mt: 1 }}
                          />
                        )}
                      </Paper>
                    ))}
                  </Stack>
                </Grid>
              )}
            </Grid>
          </Box>
        ) : (
          <Alert severity="info">
            Care Plan creation functionality coming soon
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

export default CarePlanDialog;