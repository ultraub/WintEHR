/**
 * Care Gaps Widget
 * Displays preventive care gaps and quality measures
 */

import React, { useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  Grid,
  LinearProgress,
  Chip,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Stack,
  useTheme,
  alpha
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Download as DownloadIcon,
  People as PeopleIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';

function CareGapsWidget({ careGaps }) {
  const theme = useTheme();
  const [selectedGap, setSelectedGap] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleGapClick = (gap) => {
    setSelectedGap(gap);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedGap(null);
  };

  const getGapStatus = (percentage) => {
    if (percentage >= 90) return { color: 'success', icon: <CheckIcon />, text: 'Excellent' };
    if (percentage >= 80) return { color: 'success', icon: <CheckIcon />, text: 'Met Target' };
    if (percentage >= 70) return { color: 'warning', icon: <WarningIcon />, text: 'Below Target' };
    return { color: 'error', icon: <CancelIcon />, text: 'Action Needed' };
  };

  const mockPatientData = [
    { id: '1', name: 'Smith, John', age: 65, lastDate: '2023-03-15', status: 'Overdue' },
    { id: '2', name: 'Johnson, Mary', age: 58, lastDate: '2024-01-10', status: 'Due Soon' },
    { id: '3', name: 'Williams, Robert', age: 72, lastDate: 'Never', status: 'Never Done' },
    { id: '4', name: 'Brown, Patricia', age: 55, lastDate: '2023-11-20', status: 'Overdue' },
    { id: '5', name: 'Davis, Michael', age: 68, lastDate: '2024-02-05', status: 'Current' }
  ];

  if (!careGaps || !careGaps.gaps) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Care Gaps Analysis
        </Typography>
        <Alert severity="info">
          Loading care gaps data...
        </Alert>
      </Paper>
    );
  }

  const overallCompliance = careGaps.gaps.length > 0
    ? Math.round(careGaps.gaps.reduce((sum, gap) => sum + gap.percentage, 0) / careGaps.gaps.length)
    : 0;

  return (
    <>
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6" fontWeight="bold">
            Preventive Care Gaps
          </Typography>
          <Button
            startIcon={<DownloadIcon />}
            variant="outlined"
            size="small"
          >
            Export Report
          </Button>
        </Box>

        {/* Overall Compliance Score */}
        <Paper
          sx={{
            p: 3,
            mb: 3,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
          }}
        >
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={4}>
              <Box textAlign="center">
                <Typography variant="h2" fontWeight="bold" color="primary">
                  {overallCompliance}%
                </Typography>
                <Typography variant="subtitle1" color="text.secondary">
                  Overall Compliance
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={8}>
              <Stack spacing={2}>
                <Box display="flex" alignItems="center" gap={2}>
                  <PeopleIcon color="action" />
                  <Box flexGrow={1}>
                    <Typography variant="body2" color="text.secondary">
                      Total Patient Population
                    </Typography>
                    <Typography variant="h6">
                      {careGaps.totalPatients || 0} patients
                    </Typography>
                  </Box>
                </Box>
                <Box display="flex" alignItems="center" gap={2}>
                  <TrendingUpIcon color="action" />
                  <Box flexGrow={1}>
                    <Typography variant="body2" color="text.secondary">
                      Improvement from Last Quarter
                    </Typography>
                    <Typography variant="h6" color="success.main">
                      +5.2%
                    </Typography>
                  </Box>
                </Box>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        {/* Individual Measures */}
        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
          Quality Measures Performance
        </Typography>
        <List>
          {careGaps.gaps.map((gap, index) => {
            const status = getGapStatus(gap.percentage);
            return (
              <ListItem
                key={index}
                button
                onClick={() => handleGapClick(gap)}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  mb: 1,
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.05)
                  }
                }}
              >
                <ListItemIcon>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: alpha(theme.palette[status.color].main, 0.1),
                      color: theme.palette[status.color].main,
                      fontSize: '1.5rem'
                    }}
                  >
                    {gap.icon}
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {gap.measure}
                      </Typography>
                      <Chip
                        label={status.text}
                        size="small"
                        color={status.color}
                        icon={status.icon}
                      />
                    </Box>
                  }
                  secondary={
                    <Box mt={1}>
                      <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          {gap.description}
                        </Typography>
                        <Typography variant="caption" fontWeight="bold">
                          {gap.percentage}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={gap.percentage}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          bgcolor: alpha(gap.color || theme.palette.primary.main, 0.2),
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 4,
                            bgcolor: gap.color || theme.palette.primary.main
                          }
                        }}
                      />
                      <Box display="flex" justifyContent="space-between" mt={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          {gap.completed}/{gap.eligible} patients
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Target: {gap.percentage < 80 ? '80%' : '90%'}
                        </Typography>
                      </Box>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Tooltip title="View patient list">
                    <IconButton edge="end" onClick={() => handleGapClick(gap)}>
                      <InfoIcon />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            );
          })}
        </List>

        {/* Summary Alert */}
        <Alert
          severity={overallCompliance >= 80 ? 'success' : 'warning'}
          sx={{ mt: 3 }}
        >
          {overallCompliance >= 80 ? (
            <Typography variant="body2">
              <strong>Great work!</strong> Your practice is meeting most quality targets. 
              Focus on the {careGaps.gaps.filter(g => g.percentage < 80).length} measures below target.
            </Typography>
          ) : (
            <Typography variant="body2">
              <strong>Improvement needed.</strong> {careGaps.gaps.filter(g => g.percentage < 80).length} measures 
              are below target. Click on each measure to see which patients need attention.
            </Typography>
          )}
        </Alert>
      </Paper>

      {/* Patient List Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={2}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha(selectedGap?.color || theme.palette.primary.main, 0.1),
                fontSize: '1.25rem'
              }}
            >
              {selectedGap?.icon}
            </Box>
            <Box>
              <Typography variant="h6">{selectedGap?.measure}</Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedGap?.description}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              Showing patients who need this preventive care measure. 
              Current compliance: <strong>{selectedGap?.percentage}%</strong> 
              ({selectedGap?.completed}/{selectedGap?.eligible} patients)
            </Typography>
          </Alert>
          
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Patient Name</TableCell>
                  <TableCell>Age</TableCell>
                  <TableCell>Last Completed</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mockPatientData.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell>{patient.name}</TableCell>
                    <TableCell>{patient.age}</TableCell>
                    <TableCell>{patient.lastDate}</TableCell>
                    <TableCell>
                      <Chip
                        label={patient.status}
                        size="small"
                        color={
                          patient.status === 'Current' ? 'success' :
                          patient.status === 'Due Soon' ? 'warning' : 'error'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button size="small" variant="outlined">
                        Schedule
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Close</Button>
          <Button variant="contained" startIcon={<DownloadIcon />}>
            Export List
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default CareGapsWidget;