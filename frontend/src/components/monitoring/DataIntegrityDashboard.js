/**
 * DataIntegrityDashboard Component
 * Real-time monitoring of FHIR data integrity, quality, and consistency
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Alert,
  LinearProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Button,
  Stack,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  CircularProgress,
  Badge,
  Avatar,
  Divider
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  Timeline as TimelineIcon,
  ExpandMore as ExpandMoreIcon,
  Visibility as ViewIcon,
  GetApp as ExportIcon,
  Settings as SettingsIcon,
  Storage as StorageIcon,
  Security as SecurityIcon,
  Speed as PerformanceIcon,
  BugReport as BugIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Link as LinkIcon,
  Code as CodeIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import { format, subHours, subDays, subMonths } from 'date-fns';
import { useFHIRResource } from '../../contexts/FHIRResourceContext';
import { validateResource } from '../../core/fhir/validators/fhirValidation';
import { fhirClient } from '../../services/fhirClient';

// Data integrity checks
const integrityChecks = [
  {
    id: 'missing-required-fields',
    name: 'Missing Required Fields',
    description: 'Resources missing mandatory FHIR fields',
    severity: 'error',
    category: 'structure'
  },
  {
    id: 'invalid-references',
    name: 'Invalid References', 
    description: 'Broken or malformed resource references',
    severity: 'error',
    category: 'references'
  },
  {
    id: 'duplicate-resources',
    name: 'Duplicate Resources',
    description: 'Resources with identical content or identifiers',
    severity: 'warning',
    category: 'duplicates'
  },
  {
    id: 'orphaned-resources',
    name: 'Orphaned Resources',
    description: 'Resources referencing non-existent resources',
    severity: 'warning',
    category: 'references'
  },
  {
    id: 'inconsistent-coding',
    name: 'Inconsistent Coding',
    description: 'Coding systems with inconsistent or deprecated values',
    severity: 'warning',
    category: 'terminology'
  },
  {
    id: 'date-anomalies',
    name: 'Date Anomalies',
    description: 'Invalid or inconsistent date values',
    severity: 'error',
    category: 'temporal'
  },
  {
    id: 'profile-violations',
    name: 'Profile Violations',
    description: 'Resources not conforming to specified profiles',
    severity: 'error',
    category: 'conformance'
  }
];

const MetricCard = ({ title, value, change, trend, color, icon, subtitle, onClick }) => (
  <Card 
    sx={{ 
      cursor: onClick ? 'pointer' : 'default',
      '&:hover': onClick ? { boxShadow: 3 } : {},
      height: '100%'
    }}
    onClick={onClick}
  >
    <CardContent>
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <Avatar sx={{ bgcolor: `${color}.light`, color: `${color}.main` }}>
          {icon}
        </Avatar>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h4" color={color} gutterBottom>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
          {change !== undefined && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
              {trend === 'up' ? (
                <TrendingUpIcon color={change > 0 ? 'error' : 'success'} fontSize="small" />
              ) : trend === 'down' ? (
                <TrendingDownIcon color={change > 0 ? 'success' : 'error'} fontSize="small" />
              ) : null}
              <Typography 
                variant="caption" 
                color={change > 0 ? 'error.main' : 'success.main'}
              >
                {change > 0 ? '+' : ''}{change}%
              </Typography>
            </Stack>
          )}
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

const IntegrityCheckCard = ({ check, results, onViewDetails }) => {
  const getStatusColor = (severity) => {
    switch (severity) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'success';
    }
  };

  const getStatusIcon = (severity, count) => {
    if (count === 0) return <SuccessIcon color="success" />;
    switch (severity) {
      case 'error': return <ErrorIcon color="error" />;
      case 'warning': return <WarningIcon color="warning" />;
      default: return <InfoIcon color="info" />;
    }
  };

  const issueCount = results?.[check.id]?.count || 0;
  const lastRun = results?.[check.id]?.lastRun;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box>
            {getStatusIcon(check.severity, issueCount)}
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" gutterBottom>
              {check.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {check.description}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip 
                label={`${issueCount} issue${issueCount !== 1 ? 's' : ''}`}
                color={getStatusColor(check.severity)}
                size="small"
              />
              <Chip 
                label={check.category}
                variant="outlined"
                size="small"
              />
              {lastRun && (
                <Typography variant="caption" color="text.secondary">
                  Last run: {format(new Date(lastRun), 'MMM d, HH:mm')}
                </Typography>
              )}
            </Stack>
          </Box>
          <Box>
            <IconButton 
              onClick={() => onViewDetails(check)}
              disabled={issueCount === 0}
            >
              <ViewIcon />
            </IconButton>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

const IntegrityDetailsDialog = ({ open, onClose, check, details }) => (
  <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
    <DialogTitle>
      <Stack direction="row" spacing={2} alignItems="center">
        {check?.severity === 'error' ? <ErrorIcon color="error" /> : <WarningIcon color="warning" />}
        {check?.name}
      </Stack>
    </DialogTitle>
    <DialogContent>
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          {check?.description}
        </Typography>
        
        {details && details.length > 0 ? (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Resource</TableCell>
                  <TableCell>Issue</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {details.slice(0, 50).map((detail, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {detail.resourceType}/{detail.resourceId}
                      </Typography>
                    </TableCell>
                    <TableCell>{detail.issue}</TableCell>
                    <TableCell>{detail.path}</TableCell>
                    <TableCell>
                      <Button size="small" variant="outlined">
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Alert severity="success">
            No issues found for this check.
          </Alert>
        )}
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Close</Button>
    </DialogActions>
  </Dialog>
);

const DataIntegrityDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [integrityResults, setIntegrityResults] = useState({});
  const [selectedCheck, setSelectedCheck] = useState(null);
  const [checkDetails, setCheckDetails] = useState([]);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(300); // 5 minutes
  const [timeRange, setTimeRange] = useState('24h');

  const { searchResources } = useFHIRResource();

  // Mock data for demonstration
  const mockMetrics = useMemo(() => ({
    totalResources: 3461,
    validResources: 3398,
    invalidResources: 63,
    referencesChecked: 15420,
    brokenReferences: 12,
    duplicateResources: 8,
    orphanedResources: 5,
    profileViolations: 18,
    lastValidationRun: new Date(),
    averageValidationTime: 2.3,
    resourceGrowthRate: 5.2,
    errorRate: 1.8
  }), []);

  // Run integrity checks
  const runIntegrityChecks = useCallback(async () => {
    setLoading(true);
    try {
      const results = {};
      
      // Simulate running each integrity check
      for (const check of integrityChecks) {
        await new Promise(resolve => setTimeout(resolve, 200)); // Simulate processing time
        
        // Mock results based on check type
        let count = 0;
        switch (check.id) {
          case 'invalid-references':
            count = mockMetrics.brokenReferences;
            break;
          case 'duplicate-resources':
            count = mockMetrics.duplicateResources;
            break;
          case 'orphaned-resources':
            count = mockMetrics.orphanedResources;
            break;
          case 'profile-violations':
            count = mockMetrics.profileViolations;
            break;
          case 'missing-required-fields':
            count = Math.floor(Math.random() * 10);
            break;
          case 'inconsistent-coding':
            count = Math.floor(Math.random() * 15);
            break;
          case 'date-anomalies':
            count = Math.floor(Math.random() * 5);
            break;
          default:
            count = Math.floor(Math.random() * 20);
        }
        
        results[check.id] = {
          count,
          lastRun: new Date(),
          severity: check.severity,
          category: check.category
        };
      }
      
      setIntegrityResults(results);
      setLastUpdate(new Date());
    } catch (error) {
      
    } finally {
      setLoading(false);
    }
  }, [mockMetrics]);

  // Handle check details view
  const handleViewDetails = async (check) => {
    setSelectedCheck(check);
    
    // Mock detailed results
    const mockDetails = [];
    const count = integrityResults[check.id]?.count || 0;
    
    for (let i = 0; i < Math.min(count, 10); i++) {
      mockDetails.push({
        resourceType: ['Patient', 'Condition', 'MedicationRequest', 'Observation'][Math.floor(Math.random() * 4)],
        resourceId: `example-${i + 1}`,
        issue: `${check.name} - Issue ${i + 1}`,
        path: `field.${i % 3 === 0 ? 'reference' : 'coding'}`
      });
    }
    
    setCheckDetails(mockDetails);
    setDetailsDialogOpen(true);
  };

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(runIntegrityChecks, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, runIntegrityChecks]);

  // Initial load
  useEffect(() => {
    runIntegrityChecks();
  }, [runIntegrityChecks]);

  const overviewMetrics = useMemo(() => [
    {
      title: 'Total Resources',
      value: mockMetrics.totalResources,
      color: 'primary',
      icon: <StorageIcon />,
      subtitle: 'FHIR resources in database'
    },
    {
      title: 'Valid Resources',
      value: mockMetrics.validResources,
      color: 'success',
      icon: <SuccessIcon />,
      subtitle: `${((mockMetrics.validResources / mockMetrics.totalResources) * 100).toFixed(1)}% valid`,
      change: -0.2,
      trend: 'down'
    },
    {
      title: 'Issues Found',
      value: mockMetrics.invalidResources,
      color: 'error',
      icon: <ErrorIcon />,
      subtitle: 'Resources with validation issues',
      change: 1.5,
      trend: 'up'
    },
    {
      title: 'References Checked',
      value: mockMetrics.referencesChecked,
      color: 'info',
      icon: <LinkIcon />,
      subtitle: 'Cross-resource references validated'
    }
  ], [mockMetrics]);

  const summaryByCategory = useMemo(() => {
    const categories = {};
    
    integrityChecks.forEach(check => {
      const result = integrityResults[check.id];
      if (!categories[check.category]) {
        categories[check.category] = { total: 0, errors: 0, warnings: 0 };
      }
      
      categories[check.category].total += result?.count || 0;
      if (check.severity === 'error') {
        categories[check.category].errors += result?.count || 0;
      } else {
        categories[check.category].warnings += result?.count || 0;
      }
    });
    
    return Object.entries(categories).map(([category, data]) => ({
      category: category.charAt(0).toUpperCase() + category.slice(1),
      ...data
    }));
  }, [integrityResults]);

  return (
    <Box sx={{ p: 3 }}>
      <Paper elevation={0} sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Data Integrity Monitor
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Real-time FHIR data quality and consistency monitoring
            </Typography>
          </Box>
          
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
              }
              label="Auto Refresh"
            />
            
            <Button
              variant="outlined"
              startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
              onClick={runIntegrityChecks}
              disabled={loading}
            >
              {loading ? 'Checking...' : 'Run Checks'}
            </Button>
          </Stack>
        </Box>

        {/* Status Banner */}
        {lastUpdate && (
          <Alert 
            severity={mockMetrics.invalidResources > 50 ? 'error' : mockMetrics.invalidResources > 20 ? 'warning' : 'success'}
            sx={{ mb: 3 }}
          >
            <Typography variant="body2">
              Last integrity check: {format(lastUpdate, 'MMM d, yyyy HH:mm:ss')} - 
              Found {mockMetrics.invalidResources} issues across {mockMetrics.totalResources} resources
            </Typography>
          </Alert>
        )}

        {/* Overview Metrics */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {overviewMetrics.map((metric, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <MetricCard {...metric} />
            </Grid>
          ))}
        </Grid>

        {/* Progress Indicator */}
        {loading && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" gutterBottom>
              Running integrity checks...
            </Typography>
            <LinearProgress />
          </Box>
        )}

        {/* Category Summary */}
        <Card sx={{ mb: 4 }}>
          <CardHeader
            avatar={<AssessmentIcon />}
            title="Issues by Category"
            titleTypographyProps={{ variant: 'h6' }}
          />
          <CardContent>
            <Grid container spacing={2}>
              {summaryByCategory.map((category) => (
                <Grid item xs={12} sm={6} md={4} key={category.category}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" color={category.total > 0 ? 'error' : 'success'}>
                        {category.total}
                      </Typography>
                      <Typography variant="body2" gutterBottom>
                        {category.category}
                      </Typography>
                      <Stack direction="row" spacing={1} justifyContent="center">
                        {category.errors > 0 && (
                          <Chip label={`${category.errors} errors`} color="error" size="small" />
                        )}
                        {category.warnings > 0 && (
                          <Chip label={`${category.warnings} warnings`} color="warning" size="small" />
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>

        {/* Detailed Integrity Checks */}
        <Card>
          <CardHeader
            avatar={<SecurityIcon />}
            title="Integrity Check Details"
            titleTypographyProps={{ variant: 'h6' }}
          />
          <CardContent>
            <Grid container spacing={2}>
              {integrityChecks.map((check) => (
                <Grid item xs={12} md={6} key={check.id}>
                  <IntegrityCheckCard
                    check={check}
                    results={integrityResults}
                    onViewDetails={handleViewDetails}
                  />
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <IntegrityDetailsDialog
          open={detailsDialogOpen}
          onClose={() => setDetailsDialogOpen(false)}
          check={selectedCheck}
          details={checkDetails}
        />
      </Paper>
    </Box>
  );
};

export default DataIntegrityDashboard;