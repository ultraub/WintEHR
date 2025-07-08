/**
 * MigrationDashboard Component
 * Interface for managing FHIR data migrations and consistency
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Button,
  LinearProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  Stack,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Switch,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Badge
} from '@mui/material';
import {
  PlayArrow as RunIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Assessment as StatusIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  GetApp as ExportIcon,
  Visibility as ViewIcon,
  Settings as SettingsIcon,
  Timeline as TimelineIcon,
  Storage as DataIcon,
  Security as IntegrityIcon
} from '@mui/icons-material';
import { useMigrations, useMigrationProgress } from '../../hooks/useMigrations';
import { useFHIRResource } from '../../contexts/FHIRResourceContext';

const MigrationStatusCard = ({ title, count, total, color, icon, onClick }) => (
  <Card 
    sx={{ 
      cursor: onClick ? 'pointer' : 'default',
      '&:hover': onClick ? { boxShadow: 3 } : {}
    }}
    onClick={onClick}
  >
    <CardContent>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box sx={{ color: `${color}.main` }}>
          {icon}
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" color={color}>
            {count}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          {total && (
            <LinearProgress
              variant="determinate"
              value={(count / total) * 100}
              sx={{ mt: 1, height: 6, borderRadius: 3 }}
              color={color}
            />
          )}
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

const MigrationProgressDialog = ({ open, onClose, progress, isRunning }) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>Migration Progress</DialogTitle>
    <DialogContent>
      {isRunning ? (
        <Stack spacing={3}>
          <Box>
            <Typography variant="body2" gutterBottom>
              Processing resources...
            </Typography>
            <LinearProgress
              variant="determinate"
              value={(progress?.processed || 0) / (progress?.total || 1) * 100}
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Typography variant="caption" color="text.secondary">
              {progress?.processed || 0} of {progress?.total || 0} resources processed
            </Typography>
          </Box>
          
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h6" color="primary">
                    {progress?.migrated || 0}
                  </Typography>
                  <Typography variant="caption">Migrated</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={4}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h6" color="error">
                    {progress?.errors || 0}
                  </Typography>
                  <Typography variant="caption">Errors</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={4}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h6">
                    {(progress?.processed || 0) - (progress?.migrated || 0) - (progress?.errors || 0)}
                  </Typography>
                  <Typography variant="caption">Skipped</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Stack>
      ) : (
        <Typography>Migration completed or not running.</Typography>
      )}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Close</Button>
    </DialogActions>
  </Dialog>
);

const MigrationResultsDialog = ({ open, onClose, result }) => {
  if (!result) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Migration Results</DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          {/* Summary */}
          <Card variant="outlined">
            <CardHeader
              title="Summary"
              titleTypographyProps={{ variant: 'h6' }}
            />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={3}>
                  <Typography variant="body2">Resources Processed</Typography>
                  <Typography variant="h6">{result.resourcesProcessed}</Typography>
                </Grid>
                <Grid item xs={3}>
                  <Typography variant="body2">Resources Migrated</Typography>
                  <Typography variant="h6" color="primary">{result.resourcesMigrated}</Typography>
                </Grid>
                <Grid item xs={3}>
                  <Typography variant="body2">Errors</Typography>
                  <Typography variant="h6" color="error">{result.errors.length}</Typography>
                </Grid>
                <Grid item xs={3}>
                  <Typography variant="body2">Duration</Typography>
                  <Typography variant="h6">{Math.round(result.duration / 1000)}s</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Errors */}
          {result.errors.length > 0 && (
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" color="error">
                  Errors ({result.errors.length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List>
                  {result.errors.map((error, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <ErrorIcon color="error" />
                      </ListItemIcon>
                      <ListItemText
                        primary={error.message}
                        secondary={error.resourceId ? `Resource: ${error.resourceId}` : undefined}
                      />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" color="warning.main">
                  Warnings ({result.warnings.length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List>
                  {result.warnings.map((warning, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <WarningIcon color="warning" />
                      </ListItemIcon>
                      <ListItemText
                        primary={warning.message}
                        secondary={warning.resourceId ? `Resource: ${warning.resourceId}` : undefined}
                      />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          )}

          {/* Changes */}
          {result.changes.length > 0 && (
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" color="info.main">
                  Changes Made ({result.changes.length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List>
                  {result.changes.slice(0, 20).map((change, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <InfoIcon color="info" />
                      </ListItemIcon>
                      <ListItemText
                        primary={change.description}
                        secondary={change.resourceId ? `Resource: ${change.resourceId}` : undefined}
                      />
                    </ListItem>
                  ))}
                  {result.changes.length > 20 && (
                    <ListItem>
                      <ListItemText
                        primary={`... and ${result.changes.length - 20} more changes`}
                        sx={{ fontStyle: 'italic' }}
                      />
                    </ListItem>
                  )}
                </List>
              </AccordionDetails>
            </Accordion>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

const MigrationDashboard = () => {
  const {
    migrateResources,
    getMigrationStatus,
    isRunning,
    progress,
    lastResult,
    migrationStatus,
    availableMigrations,
    clearResults
  } = useMigrations();

  const { searchResources } = useFHIRResource();

  const [selectedResourceType, setSelectedResourceType] = useState('all');
  const [migrationOptions, setMigrationOptions] = useState({
    dryRun: false,
    batchSize: 10,
    saveResults: true
  });
  const [showProgress, setShowProgress] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);

  const resourceTypes = ['all', 'Patient', 'Condition', 'MedicationRequest', 'Observation', 'Encounter'];

  // Load migration status on component mount
  useEffect(() => {
    const loadStatus = async () => {
      setLoading(true);
      try {
        await getMigrationStatus();
      } catch (error) {
        
      } finally {
        setLoading(false);
      }
    };
    loadStatus();
  }, [getMigrationStatus]);

  // Show progress dialog when migration starts
  useEffect(() => {
    if (isRunning) {
      setShowProgress(true);
    }
  }, [isRunning]);

  // Show results when migration completes
  useEffect(() => {
    if (lastResult && !isRunning) {
      setShowProgress(false);
      setShowResults(true);
    }
  }, [lastResult, isRunning]);

  const handleRunMigration = async () => {
    try {
      setLoading(true);
      
      // Fetch resources to migrate
      const searchParams = selectedResourceType === 'all' 
        ? { _count: 1000 } 
        : { _type: selectedResourceType, _count: 1000 };
      
      const searchResult = await searchResources('', searchParams);
      const resources = searchResult.resources || [];

      if (resources.length === 0) {
        alert('No resources found to migrate');
        return;
      }

      await migrateResources(resources, migrationOptions);
    } catch (error) {
      
      alert(`Migration failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStatus = async () => {
    setLoading(true);
    try {
      await getMigrationStatus(selectedResourceType === 'all' ? null : selectedResourceType);
    } catch (error) {
      
    } finally {
      setLoading(false);
    }
  };

  const statusData = useMemo(() => {
    if (!migrationStatus) return null;
    
    return [
      {
        title: 'Total Resources',
        count: migrationStatus.total,
        color: 'primary',
        icon: <DataIcon />
      },
      {
        title: 'Need Migration',
        count: migrationStatus.needsMigration,
        total: migrationStatus.total,
        color: 'warning',
        icon: <WarningIcon />
      },
      {
        title: 'Up to Date',
        count: migrationStatus.upToDate,
        total: migrationStatus.total,
        color: 'success',
        icon: <SuccessIcon />
      },
      {
        title: 'Errors',
        count: migrationStatus.errors,
        total: migrationStatus.total,
        color: 'error',
        icon: <ErrorIcon />
      }
    ];
  }, [migrationStatus]);

  return (
    <Box sx={{ p: 3 }}>
      <Paper elevation={0} sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Data Migration Dashboard
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage FHIR data consistency and migrations
            </Typography>
          </Box>
          
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleRefreshStatus}
              disabled={loading || isRunning}
            >
              Refresh Status
            </Button>
            <Button
              variant="outlined"
              startIcon={<ViewIcon />}
              onClick={() => setShowResults(true)}
              disabled={!lastResult}
            >
              View Last Results
            </Button>
          </Stack>
        </Box>

        {/* Status Overview */}
        {statusData && (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {statusData.map((item, index) => (
              <Grid item xs={12} sm={6} md={3} key={index}>
                <MigrationStatusCard {...item} />
              </Grid>
            ))}
          </Grid>
        )}

        {/* Migration Controls */}
        <Card sx={{ mb: 4 }}>
          <CardHeader
            avatar={<SettingsIcon />}
            title="Migration Controls"
            titleTypographyProps={{ variant: 'h6' }}
          />
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Resource Type</InputLabel>
                  <Select
                    value={selectedResourceType}
                    onChange={(e) => setSelectedResourceType(e.target.value)}
                    label="Resource Type"
                  >
                    {resourceTypes.map(type => (
                      <MenuItem key={type} value={type}>
                        {type === 'all' ? 'All Resource Types' : type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Batch Size"
                  type="number"
                  value={migrationOptions.batchSize}
                  onChange={(e) => setMigrationOptions(prev => ({
                    ...prev,
                    batchSize: parseInt(e.target.value) || 10
                  }))}
                  inputProps={{ min: 1, max: 100 }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Stack direction="row" spacing={3}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={migrationOptions.dryRun}
                        onChange={(e) => setMigrationOptions(prev => ({
                          ...prev,
                          dryRun: e.target.checked
                        }))}
                      />
                    }
                    label="Dry Run (Preview Only)"
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={migrationOptions.saveResults}
                        onChange={(e) => setMigrationOptions(prev => ({
                          ...prev,
                          saveResults: e.target.checked
                        }))}
                        disabled={migrationOptions.dryRun}
                      />
                    }
                    label="Save Results"
                  />
                </Stack>
              </Grid>
              
              <Grid item xs={12}>
                <Stack direction="row" spacing={2}>
                  <Button
                    variant="contained"
                    startIcon={isRunning ? <StopIcon /> : <RunIcon />}
                    onClick={handleRunMigration}
                    disabled={loading || !migrationStatus?.needsMigration}
                    size="large"
                  >
                    {isRunning ? 'Running...' : 'Run Migration'}
                  </Button>
                  
                  <Button
                    variant="outlined"
                    onClick={clearResults}
                    disabled={!lastResult}
                  >
                    Clear Results
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Available Migrations */}
        <Card>
          <CardHeader
            avatar={<TimelineIcon />}
            title="Available Migrations"
            titleTypographyProps={{ variant: 'h6' }}
          />
          <CardContent>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Migration ID</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Version</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {availableMigrations.map((migration) => (
                    <TableRow key={migration.id}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {migration.id}
                        </Typography>
                      </TableCell>
                      <TableCell>{migration.description}</TableCell>
                      <TableCell>
                        <Chip label={migration.version} size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label="Available" 
                          color="success" 
                          size="small"
                          icon={<SuccessIcon />}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Progress Dialog */}
        <MigrationProgressDialog
          open={showProgress}
          onClose={() => setShowProgress(false)}
          progress={progress}
          isRunning={isRunning}
        />

        {/* Results Dialog */}
        <MigrationResultsDialog
          open={showResults}
          onClose={() => setShowResults(false)}
          result={lastResult}
        />
      </Paper>
    </Box>
  );
};

export default MigrationDashboard;