/**
 * CDS Migration Tool - Migrates non-compliant hooks to spec-compliant services
 * This component helps transform existing configurations to match CDS Hooks specification
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Divider,
  CircularProgress,
  Tooltip,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Snackbar
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  ArrowForward as MigrateIcon,
  Visibility as ViewIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon
} from '@mui/icons-material';
import { cdsHooksService } from '../../../services/cdsHooksService';
import { HOOK_TYPES } from '../../../models/cdsService';

const CDSMigrationTool = ({ onComplete }) => {
  const [hooks, setHooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [migrationStatus, setMigrationStatus] = useState({});
  const [selectedHook, setSelectedHook] = useState(null);
  const [showDetails, setShowDetails] = useState({});
  const [migrationSummary, setMigrationSummary] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    loadExistingHooks();
  }, []);

  const loadExistingHooks = async () => {
    try {
      setLoading(true);
      const response = await cdsHooksService.listCustomHooks();
      const hooksData = response.data || [];
      
      // Analyze each hook for migration needs
      const statusMap = {};
      hooksData.forEach(hook => {
        statusMap[hook.id] = analyzeHook(hook);
      });
      
      setHooks(hooksData);
      setMigrationStatus(statusMap);
    } catch (error) {
      console.error('Failed to load hooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeHook = (hook) => {
    const issues = [];
    const warnings = [];
    const migrations = [];

    // Check for non-standard fields
    if (hook.conditions && hook.conditions.length > 0) {
      issues.push({
        field: 'conditions',
        message: 'Conditions are not part of CDS Hooks spec',
        action: 'Move to service implementation logic'
      });
      migrations.push('conditions');
    }

    if (hook.displayBehavior) {
      issues.push({
        field: 'displayBehavior',
        message: 'Display behavior is not part of CDS Hooks spec',
        action: 'Remove - UI behavior is client-specific'
      });
      migrations.push('displayBehavior');
    }

    if (hook.cards && hook.cards.length > 0) {
      warnings.push({
        field: 'cards',
        message: 'Cards should be generated dynamically, not stored',
        action: 'Convert to dynamic generation in service logic'
      });
      migrations.push('cards');
    }

    // Check card structure compliance
    if (hook.cards) {
      hook.cards.forEach((card, index) => {
        if (!card.source || !card.source.label) {
          issues.push({
            field: `cards[${index}].source`,
            message: 'Card missing required source field',
            action: 'Add source with label'
          });
        }
        if (card.summary && card.summary.length > 140) {
          warnings.push({
            field: `cards[${index}].summary`,
            message: `Summary exceeds 140 characters (${card.summary.length})`,
            action: 'Truncate to 140 characters'
          });
        }
      });
    }

    // Check prefetch templates
    if (hook.prefetch) {
      Object.entries(hook.prefetch).forEach(([key, template]) => {
        if (!template.includes('{{') && !template.includes('/')) {
          warnings.push({
            field: `prefetch.${key}`,
            message: 'Prefetch template may be invalid',
            action: 'Ensure proper FHIR query format'
          });
        }
      });
    }

    return {
      isCompliant: issues.length === 0 && warnings.length === 0,
      issues,
      warnings,
      migrations,
      canAutoMigrate: !migrations.includes('conditions') // Can't auto-migrate conditions
    };
  };

  const migrateHook = async (hook) => {
    const status = migrationStatus[hook.id];
    
    // Create spec-compliant service definition
    const service = {
      id: hook.id,
      hook: hook.hook || HOOK_TYPES.PATIENT_VIEW,
      title: hook.title || hook.id,
      description: hook.description || 'Migrated CDS Service',
      prefetch: hook.prefetch || {},
      usageRequirements: hook.usageRequirements || null,
      enabled: hook.enabled !== false
    };

    // Store migration data for manual handling
    const migrationData = {
      originalId: hook.id,
      conditions: hook.conditions || [],
      cardTemplates: hook.cards || [],
      displayBehavior: hook.displayBehavior || null,
      migrationDate: new Date().toISOString()
    };

    return {
      service,
      migrationData,
      requiresManualWork: status.migrations.includes('conditions')
    };
  };

  const performBatchMigration = async () => {
    const results = {
      successful: [],
      failed: [],
      manual: []
    };

    for (const hook of hooks) {
      try {
        const migration = await migrateHook(hook);
        
        if (migration.requiresManualWork) {
          results.manual.push({
            hook,
            migration,
            reason: 'Conditions require manual conversion to service logic'
          });
        } else {
          // Auto-migrate what we can
          results.successful.push({
            hook,
            migration
          });
        }
      } catch (error) {
        results.failed.push({
          hook,
          error: error.message
        });
      }
    }

    setMigrationSummary(results);
  };

  const performSingleMigration = async (hook) => {
    try {
      const migration = await migrateHook(hook);
      
      // Update the service in the backend
      await cdsHooksService.updateService(hook.id, migration.service);
      
      // Store migration data for reference
      localStorage.setItem(`cds-migration-${hook.id}`, JSON.stringify(migration.migrationData));
      
      // Reload hooks
      await loadExistingHooks();
      
      return { success: true, migration };
    } catch (error) {
      console.error('Migration failed:', error);
      return { success: false, error: error.message };
    }
  };

  const exportMigrationPlan = () => {
    const plan = {
      timestamp: new Date().toISOString(),
      hooks: hooks.map(hook => ({
        id: hook.id,
        status: migrationStatus[hook.id],
        migration: migrateHook(hook)
      }))
    };

    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cds-migration-plan-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          CDS Hooks Migration Tool
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          This tool helps migrate your existing hook configurations to be compliant with the CDS Hooks 1.0 specification.
        </Typography>

        <Stack direction="row" spacing={2} alignItems="center">
          <Alert severity="info" sx={{ flexGrow: 1 }}>
            Found {hooks.length} existing hooks. 
            {' '}{hooks.filter(h => migrationStatus[h.id]?.isCompliant).length} are already compliant.
          </Alert>
          <Button
            variant="contained"
            startIcon={<MigrateIcon />}
            onClick={performBatchMigration}
            disabled={hooks.length === 0}
          >
            Start Migration
          </Button>
          <Button
            variant="outlined"
            onClick={exportMigrationPlan}
          >
            Export Plan
          </Button>
        </Stack>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Hook ID</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Issues</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {hooks.map(hook => {
              const status = migrationStatus[hook.id];
              const expanded = showDetails[hook.id];
              
              return (
                <React.Fragment key={hook.id}>
                  <TableRow>
                    <TableCell>
                      <Typography variant="subtitle2">{hook.id}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {hook.title}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={hook.hook} size="small" />
                    </TableCell>
                    <TableCell>
                      {status?.isCompliant ? (
                        <Chip
                          icon={<CheckIcon />}
                          label="Compliant"
                          color="success"
                          size="small"
                        />
                      ) : (
                        <Chip
                          icon={<WarningIcon />}
                          label="Needs Migration"
                          color="warning"
                          size="small"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        {status?.issues.length > 0 && (
                          <Chip
                            label={`${status.issues.length} issues`}
                            color="error"
                            size="small"
                          />
                        )}
                        {status?.warnings.length > 0 && (
                          <Chip
                            label={`${status.warnings.length} warnings`}
                            color="warning"
                            size="small"
                          />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        {!status?.isCompliant && status?.canAutoMigrate && (
                          <Tooltip title="Migrate this service">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={async () => {
                                const result = await performSingleMigration(hook);
                                if (result.success) {
                                  setSnackbar({
                                    open: true,
                                    message: 'Service migrated successfully',
                                    severity: 'success'
                                  });
                                } else {
                                  setSnackbar({
                                    open: true,
                                    message: `Migration failed: ${result.error}`,
                                    severity: 'error'
                                  });
                                }
                              }}
                            >
                              <MigrateIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        <IconButton
                          size="small"
                          onClick={() => setShowDetails({
                            ...showDetails,
                            [hook.id]: !expanded
                          })}
                        >
                          {expanded ? <CollapseIcon /> : <ExpandIcon />}
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => setSelectedHook(hook)}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                  
                  <TableRow>
                    <TableCell colSpan={5} sx={{ py: 0 }}>
                      <Collapse in={expanded} timeout="auto" unmountOnExit>
                        <Box sx={{ py: 2 }}>
                          {status?.issues.length > 0 && (
                            <>
                              <Typography variant="subtitle2" color="error" gutterBottom>
                                Issues:
                              </Typography>
                              <List dense>
                                {status.issues.map((issue, idx) => (
                                  <ListItem key={idx}>
                                    <ListItemIcon>
                                      <ErrorIcon color="error" fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText
                                      primary={`${issue.field}: ${issue.message}`}
                                      secondary={`Action: ${issue.action}`}
                                    />
                                  </ListItem>
                                ))}
                              </List>
                            </>
                          )}
                          
                          {status?.warnings.length > 0 && (
                            <>
                              <Typography variant="subtitle2" color="warning.main" gutterBottom>
                                Warnings:
                              </Typography>
                              <List dense>
                                {status.warnings.map((warning, idx) => (
                                  <ListItem key={idx}>
                                    <ListItemIcon>
                                      <WarningIcon color="warning" fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText
                                      primary={`${warning.field}: ${warning.message}`}
                                      secondary={`Action: ${warning.action}`}
                                    />
                                  </ListItem>
                                ))}
                              </List>
                            </>
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Migration Summary Dialog */}
      <Dialog
        open={!!migrationSummary}
        onClose={() => setMigrationSummary(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Migration Summary</DialogTitle>
        <DialogContent>
          {migrationSummary && (
            <Stack spacing={2}>
              <Alert severity="success">
                Successfully prepared {migrationSummary.successful.length} services for migration
              </Alert>
              
              {migrationSummary.manual.length > 0 && (
                <Alert severity="warning">
                  {migrationSummary.manual.length} services require manual conversion
                </Alert>
              )}
              
              {migrationSummary.failed.length > 0 && (
                <Alert severity="error">
                  {migrationSummary.failed.length} services failed to migrate
                </Alert>
              )}
              
              <Typography variant="body2">
                Next steps:
              </Typography>
              <List>
                <ListItem>
                  <ListItemText
                    primary="1. Review the migration plan"
                    secondary="Ensure all service definitions are correct"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="2. Convert conditions to service logic"
                    secondary="Implement condition logic in backend service implementations"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="3. Update API endpoints"
                    secondary="Change from /cds-hooks to /cds-services"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="4. Test migrated services"
                    secondary="Verify all services work correctly after migration"
                  />
                </ListItem>
              </List>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMigrationSummary(null)}>Close</Button>
          <Button 
            variant="contained" 
            onClick={() => {
              exportMigrationPlan();
              setMigrationSummary(null);
            }}
          >
            Export Details
          </Button>
        </DialogActions>
      </Dialog>

      {/* Hook Details Dialog */}
      <Dialog
        open={!!selectedHook}
        onClose={() => setSelectedHook(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Hook Configuration Details</DialogTitle>
        <DialogContent>
          {selectedHook && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Original Configuration
              </Typography>
              <Paper sx={{ p: 2, bgcolor: 'grey.50', mb: 3 }}>
                <pre style={{ margin: 0, overflow: 'auto' }}>
                  {JSON.stringify(selectedHook, null, 2)}
                </pre>
              </Paper>
              
              <Divider sx={{ my: 3 }} />
              
              <Typography variant="h6" gutterBottom>
                Migrated Service Definition
              </Typography>
              <Paper sx={{ p: 2, bgcolor: 'primary.50', mb: 3 }}>
                <pre style={{ margin: 0, overflow: 'auto' }}>
                  {JSON.stringify(migrateHook(selectedHook).service, null, 2)}
                </pre>
              </Paper>
              
              {selectedHook.conditions && selectedHook.conditions.length > 0 && (
                <>
                  <Typography variant="h6" gutterBottom color="warning.main">
                    Manual Migration Required
                  </Typography>
                  <Alert severity="warning">
                    This hook has conditions that need to be converted to service implementation logic.
                    The conditions will need to be implemented in the backend service code.
                  </Alert>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedHook(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CDSMigrationTool;