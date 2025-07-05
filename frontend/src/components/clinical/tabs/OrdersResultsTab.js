import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Chip,
  Stack,
  Divider,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Collapse,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Badge
} from '@mui/material';
import {
  Science as LabIcon,
  Assignment as ReportIcon,
  MedicalServices as ProcedureIcon,
  RadioButtonChecked as ImagingIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Warning as WarningIcon,
  CheckCircle as NormalIcon,
  Add as AddIcon,
  Search as SearchIcon,
  ViewList as ListViewIcon,
  ShowChart as ChartViewIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CalendarToday as DateIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { format, parseISO, subDays, isAfter, isBefore } from 'date-fns';
import { fhirClient } from '../../../services/fhirClient';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

// Lab Results Section
const LabResultsSection = ({ observations, patientId }) => {
  const [viewMode, setViewMode] = useState('list');
  const [selectedTest, setSelectedTest] = useState(null);
  const [dateRange, setDateRange] = useState('30');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItems, setExpandedItems] = useState({});

  // Filter lab observations
  const labObservations = observations.filter(obs => 
    obs.category?.[0]?.coding?.[0]?.code === 'laboratory'
  );

  // Apply search filter
  const filteredLabs = labObservations.filter(obs => {
    const display = obs.code?.text || obs.code?.coding?.[0]?.display || '';
    return display.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Apply date filter
  const dateFilteredLabs = filteredLabs.filter(obs => {
    if (dateRange === 'all') return true;
    const obsDate = obs.effectiveDateTime ? parseISO(obs.effectiveDateTime) : null;
    if (!obsDate) return false;
    const cutoffDate = subDays(new Date(), parseInt(dateRange));
    return isAfter(obsDate, cutoffDate);
  });

  // Group labs by test type for trending
  const groupedLabs = dateFilteredLabs.reduce((acc, obs) => {
    const code = obs.code?.coding?.[0]?.code || 'unknown';
    if (!acc[code]) {
      acc[code] = {
        name: obs.code?.text || obs.code?.coding?.[0]?.display,
        code: code,
        observations: []
      };
    }
    acc[code].observations.push(obs);
    return acc;
  }, {});

  // Sort observations by date for each group
  Object.values(groupedLabs).forEach(group => {
    group.observations.sort((a, b) => 
      new Date(b.effectiveDateTime) - new Date(a.effectiveDateTime)
    );
  });

  const toggleExpanded = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getValueStatus = (obs) => {
    const interpretation = obs.interpretation?.[0]?.coding?.[0]?.code;
    if (['H', 'HH', 'L', 'LL', 'A', 'AA'].includes(interpretation)) {
      return 'abnormal';
    }
    
    // Check reference range
    if (obs.valueQuantity?.value && obs.referenceRange?.[0]) {
      const value = parseFloat(obs.valueQuantity.value);
      const low = obs.referenceRange[0].low?.value;
      const high = obs.referenceRange[0].high?.value;
      
      if (low && value < low) return 'low';
      if (high && value > high) return 'high';
    }
    
    return 'normal';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'abnormal':
      case 'high':
      case 'low':
        return <WarningIcon color="warning" fontSize="small" />;
      default:
        return <NormalIcon color="success" fontSize="small" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'high': return 'error';
      case 'low': return 'info';
      case 'abnormal': return 'warning';
      default: return 'success';
    }
  };

  // Prepare data for trending chart
  const getTrendData = (testGroup) => {
    return testGroup.observations
      .filter(obs => obs.valueQuantity?.value)
      .map(obs => ({
        date: format(parseISO(obs.effectiveDateTime), 'MM/dd'),
        value: parseFloat(obs.valueQuantity.value),
        unit: obs.valueQuantity.unit,
        low: obs.referenceRange?.[0]?.low?.value,
        high: obs.referenceRange?.[0]?.high?.value
      }))
      .reverse(); // Chronological order for chart
  };

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Laboratory Results</Typography>
          <Stack direction="row" spacing={1}>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, newMode) => newMode && setViewMode(newMode)}
              size="small"
            >
              <ToggleButton value="list">
                <ListViewIcon />
              </ToggleButton>
              <ToggleButton value="chart">
                <ChartViewIcon />
              </ToggleButton>
            </ToggleButtonGroup>
            <Tooltip title="Order Labs">
              <IconButton size="small" color="primary">
                <AddIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Download Results">
              <IconButton size="small">
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={2} mb={2}>
          <TextField
            size="small"
            placeholder="Search lab tests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
            sx={{ flexGrow: 1 }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Date Range</InputLabel>
            <Select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              label="Date Range"
            >
              <MenuItem value="7">Last 7 days</MenuItem>
              <MenuItem value="30">Last 30 days</MenuItem>
              <MenuItem value="90">Last 90 days</MenuItem>
              <MenuItem value="365">Last year</MenuItem>
              <MenuItem value="all">All time</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        {viewMode === 'list' ? (
          <List>
            {Object.entries(groupedLabs).map(([code, group]) => {
              const latestObs = group.observations[0];
              const status = getValueStatus(latestObs);
              const isExpanded = expandedItems[code];

              return (
                <React.Fragment key={code}>
                  <ListItem>
                    <ListItemIcon>
                      {getStatusIcon(status)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body1">{group.name}</Typography>
                          <Chip 
                            label={`${latestObs.valueQuantity?.value} ${latestObs.valueQuantity?.unit}`}
                            size="small"
                            color={getStatusColor(status)}
                          />
                        </Stack>
                      }
                      secondary={
                        <>
                          Latest: {format(parseISO(latestObs.effectiveDateTime), 'MM/dd/yyyy h:mm a')}
                          {latestObs.referenceRange?.[0] && ` • Range: ${latestObs.referenceRange[0].low?.value} - ${latestObs.referenceRange[0].high?.value} ${latestObs.valueQuantity?.unit}`}
                        </>
                      }
                    />
                    <Stack direction="row" spacing={1}>
                      {group.observations.length > 1 && (
                        <Chip 
                          label={`${group.observations.length} results`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                      <IconButton size="small" onClick={() => toggleExpanded(code)}>
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </Stack>
                  </ListItem>
                  <Collapse in={isExpanded}>
                    <Box pl={7} pr={2} pb={2}>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Date</TableCell>
                              <TableCell>Value</TableCell>
                              <TableCell>Status</TableCell>
                              <TableCell>Performer</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {group.observations.slice(0, 5).map((obs) => (
                              <TableRow key={obs.id}>
                                <TableCell>{format(parseISO(obs.effectiveDateTime), 'MM/dd/yy h:mm a')}</TableCell>
                                <TableCell>
                                  {obs.valueQuantity?.value} {obs.valueQuantity?.unit}
                                </TableCell>
                                <TableCell>
                                  <Chip 
                                    label={getValueStatus(obs)}
                                    size="small"
                                    color={getStatusColor(getValueStatus(obs))}
                                  />
                                </TableCell>
                                <TableCell>{obs.performer?.[0]?.display || 'Unknown'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      {group.observations.length > 5 && (
                        <Box mt={1}>
                          <Button 
                            size="small" 
                            onClick={() => setSelectedTest(group)}
                          >
                            View All {group.observations.length} Results
                          </Button>
                        </Box>
                      )}
                    </Box>
                  </Collapse>
                  <Divider />
                </React.Fragment>
              );
            })}
          </List>
        ) : (
          // Chart View
          <Grid container spacing={2}>
            {Object.entries(groupedLabs).map(([code, group]) => {
              const trendData = getTrendData(group);
              if (trendData.length < 2) return null;

              const latestValue = trendData[trendData.length - 1];
              const hasReferenceRange = latestValue.low !== undefined && latestValue.high !== undefined;

              return (
                <Grid item xs={12} md={6} key={code}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      {group.name}
                    </Typography>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <ChartTooltip />
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#1976d2" 
                          strokeWidth={2}
                          dot={{ fill: '#1976d2' }}
                        />
                        {hasReferenceRange && (
                          <>
                            <ReferenceLine 
                              y={latestValue.low} 
                              stroke="#ff9800" 
                              strokeDasharray="3 3"
                              label="Low"
                            />
                            <ReferenceLine 
                              y={latestValue.high} 
                              stroke="#ff9800" 
                              strokeDasharray="3 3"
                              label="High"
                            />
                          </>
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        )}

        {Object.keys(groupedLabs).length === 0 && (
          <Alert severity="info">
            No lab results found for the selected criteria
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

// Diagnostic Reports Section
const DiagnosticReportsSection = ({ diagnosticReports, patientId }) => {
  const [filter, setFilter] = useState('all');
  const [expandedItems, setExpandedItems] = useState({});

  const toggleExpanded = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredReports = diagnosticReports.filter(report => {
    if (filter === 'all') return true;
    return report.category?.[0]?.coding?.[0]?.code === filter;
  });

  const getReportIcon = (category) => {
    const code = category?.[0]?.coding?.[0]?.code;
    switch (code) {
      case 'RAD': return <ImagingIcon color="primary" />;
      case 'LAB': return <LabIcon color="secondary" />;
      case 'PATH': return <ReportIcon color="error" />;
      default: return <ReportIcon color="action" />;
    }
  };

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Diagnostic Reports</Typography>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              label="Category"
            >
              <MenuItem value="all">All Reports</MenuItem>
              <MenuItem value="LAB">Laboratory</MenuItem>
              <MenuItem value="RAD">Radiology</MenuItem>
              <MenuItem value="PATH">Pathology</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <List>
          {filteredReports.map((report, index) => {
            const isExpanded = expandedItems[report.id];

            return (
              <React.Fragment key={report.id}>
                <ListItem>
                  <ListItemIcon>
                    {getReportIcon(report.category)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body1">
                          {report.code?.text || report.code?.coding?.[0]?.display || 'Diagnostic Report'}
                        </Typography>
                        <Chip 
                          label={report.status}
                          size="small"
                          color={report.status === 'final' ? 'success' : 'warning'}
                        />
                      </Stack>
                    }
                    secondary={
                      <>
                        Date: {report.effectiveDateTime ? format(parseISO(report.effectiveDateTime), 'MM/dd/yyyy h:mm a') : 'Unknown'}
                        {report.performer?.[0]?.display && ` • Performed by: ${report.performer[0].display}`}
                      </>
                    }
                  />
                  <Stack direction="row" spacing={1}>
                    {report.presentedForm?.length > 0 && (
                      <Tooltip title="View Report">
                        <IconButton size="small" color="primary">
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    <IconButton size="small" onClick={() => toggleExpanded(report.id)}>
                      {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Stack>
                </ListItem>
                <Collapse in={isExpanded}>
                  <Box pl={7} pr={2} pb={2}>
                    <Stack spacing={1}>
                      {report.conclusion && (
                        <Box>
                          <Typography variant="subtitle2">Conclusion:</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {report.conclusion}
                          </Typography>
                        </Box>
                      )}
                      {report.result && report.result.length > 0 && (
                        <Box>
                          <Typography variant="subtitle2">Results:</Typography>
                          <List dense>
                            {report.result.map((result, idx) => (
                              <ListItem key={idx}>
                                <ListItemText 
                                  primary={result.display}
                                  secondary={`Reference: ${result.reference}`}
                                />
                              </ListItem>
                            ))}
                          </List>
                        </Box>
                      )}
                    </Stack>
                  </Box>
                </Collapse>
                {index < filteredReports.length - 1 && <Divider />}
              </React.Fragment>
            );
          })}
        </List>

        {filteredReports.length === 0 && (
          <Alert severity="info">
            No diagnostic reports found
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

// Imaging Studies Section
const ImagingStudiesSection = ({ imagingStudies, patientId }) => {
  const [expandedItems, setExpandedItems] = useState({});

  const toggleExpanded = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Imaging Studies</Typography>
          <Tooltip title="Order Imaging">
            <IconButton size="small" color="primary">
              <AddIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        <List>
          {imagingStudies.map((study, index) => {
            const isExpanded = expandedItems[study.id];
            const modalityList = study.modality?.map(m => m.code).join(', ');

            return (
              <React.Fragment key={study.id}>
                <ListItem>
                  <ListItemIcon>
                    <ImagingIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body1">
                          {study.description || modalityList || 'Imaging Study'}
                        </Typography>
                        <Chip 
                          label={study.status}
                          size="small"
                          color={study.status === 'available' ? 'success' : 'warning'}
                        />
                      </Stack>
                    }
                    secondary={
                      <>
                        Date: {study.started ? format(parseISO(study.started), 'MM/dd/yyyy h:mm a') : 'Unknown'}
                        {` • Series: ${study.numberOfSeries || 0} | Instances: ${study.numberOfInstances || 0}`}
                      </>
                    }
                  />
                  <Stack direction="row" spacing={1}>
                    <Tooltip title="View Images">
                      <IconButton size="small" color="primary">
                        <ImagingIcon />
                      </IconButton>
                    </Tooltip>
                    <IconButton size="small" onClick={() => toggleExpanded(study.id)}>
                      {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Stack>
                </ListItem>
                <Collapse in={isExpanded}>
                  <Box pl={7} pr={2} pb={2}>
                    <Stack spacing={1}>
                      {study.series?.map((series, idx) => (
                        <Box key={idx}>
                          <Typography variant="subtitle2">
                            Series {idx + 1}: {series.modality?.code}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {series.description || 'No description'} - {series.numberOfInstances} instances
                          </Typography>
                        </Box>
                      ))}
                      {study.procedureReference && (
                        <Typography variant="body2" color="text.secondary">
                          Procedure: {study.procedureReference.display}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                </Collapse>
                {index < imagingStudies.length - 1 && <Divider />}
              </React.Fragment>
            );
          })}
        </List>

        {imagingStudies.length === 0 && (
          <Alert severity="info">
            No imaging studies found
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

// Procedures Section
const ProceduresSection = ({ procedures, patientId }) => {
  const [filter, setFilter] = useState('all');

  const filteredProcedures = procedures.filter(proc => {
    if (filter === 'all') return true;
    return proc.status === filter;
  });

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Procedures</Typography>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              label="Status"
            >
              <MenuItem value="all">All Procedures</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="in-progress">In Progress</MenuItem>
              <MenuItem value="not-done">Not Done</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <List>
          {filteredProcedures.map((procedure, index) => (
            <React.Fragment key={procedure.id}>
              <ListItem>
                <ListItemIcon>
                  <ProcedureIcon color="secondary" />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body1">
                        {procedure.code?.text || procedure.code?.coding?.[0]?.display || 'Procedure'}
                      </Typography>
                      <Chip 
                        label={procedure.status}
                        size="small"
                        color={procedure.status === 'completed' ? 'success' : 'default'}
                      />
                    </Stack>
                  }
                  secondary={
                    <>
                      Date: {procedure.performedDateTime ? 
                        format(parseISO(procedure.performedDateTime), 'MM/dd/yyyy') :
                        procedure.performedPeriod?.start ? 
                        format(parseISO(procedure.performedPeriod.start), 'MM/dd/yyyy') : 
                        'Unknown'}
                      {procedure.performer?.[0]?.actor?.display && ` • Performed by: ${procedure.performer[0].actor.display}`}
                    </>
                  }
                />
              </ListItem>
              {index < filteredProcedures.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>

        {filteredProcedures.length === 0 && (
          <Alert severity="info">
            No procedures found
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

// Main Orders & Results Tab Component
const OrdersResultsTab = ({ patientId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [observations, setObservations] = useState([]);
  const [diagnosticReports, setDiagnosticReports] = useState([]);
  const [imagingStudies, setImagingStudies] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [activeSection, setActiveSection] = useState('labs');

  useEffect(() => {
    if (!patientId) return;
    fetchOrdersAndResults();
  }, [patientId]);

  const fetchOrdersAndResults = async () => {
    setLoading(true);
    setError(null);

    try {
      const [
        observationsResult,
        diagnosticReportsResult,
        imagingStudiesResult,
        proceduresResult
      ] = await Promise.all([
        fhirClient.getObservations(patientId),
        fhirClient.search('DiagnosticReport', { patient: patientId, _sort: '-date' }),
        fhirClient.search('ImagingStudy', { patient: patientId, _sort: '-started' }),
        fhirClient.search('Procedure', { patient: patientId, _sort: '-date' })
      ]);

      setObservations(observationsResult.resources || []);
      setDiagnosticReports(diagnosticReportsResult.resources || []);
      setImagingStudies(imagingStudiesResult.resources || []);
      setProcedures(proceduresResult.resources || []);

    } catch (err) {
      console.error('Error fetching orders and results:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Error loading orders and results: {error}
      </Alert>
    );
  }

  // Count items for badges
  const labCount = observations.filter(obs => 
    obs.category?.[0]?.coding?.[0]?.code === 'laboratory'
  ).length;
  const reportCount = diagnosticReports.length;
  const imagingCount = imagingStudies.length;
  const procedureCount = procedures.length;

  return (
    <Box sx={{ p: 3 }}>
      {/* Section Navigation */}
      <Paper sx={{ p: 1, mb: 3 }}>
        <Stack direction="row" spacing={1}>
          <Button
            variant={activeSection === 'labs' ? 'contained' : 'outlined'}
            onClick={() => setActiveSection('labs')}
            startIcon={<LabIcon />}
          >
            Lab Results
            {labCount > 0 && (
              <Badge badgeContent={labCount} color="error" sx={{ ml: 1 }}>
                <Box />
              </Badge>
            )}
          </Button>
          <Button
            variant={activeSection === 'reports' ? 'contained' : 'outlined'}
            onClick={() => setActiveSection('reports')}
            startIcon={<ReportIcon />}
          >
            Diagnostic Reports
            {reportCount > 0 && (
              <Badge badgeContent={reportCount} color="error" sx={{ ml: 1 }}>
                <Box />
              </Badge>
            )}
          </Button>
          <Button
            variant={activeSection === 'imaging' ? 'contained' : 'outlined'}
            onClick={() => setActiveSection('imaging')}
            startIcon={<ImagingIcon />}
          >
            Imaging
            {imagingCount > 0 && (
              <Badge badgeContent={imagingCount} color="error" sx={{ ml: 1 }}>
                <Box />
              </Badge>
            )}
          </Button>
          <Button
            variant={activeSection === 'procedures' ? 'contained' : 'outlined'}
            onClick={() => setActiveSection('procedures')}
            startIcon={<ProcedureIcon />}
          >
            Procedures
            {procedureCount > 0 && (
              <Badge badgeContent={procedureCount} color="error" sx={{ ml: 1 }}>
                <Box />
              </Badge>
            )}
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton onClick={fetchOrdersAndResults}>
            <RefreshIcon />
          </IconButton>
        </Stack>
      </Paper>

      {/* Content Sections */}
      {activeSection === 'labs' && (
        <LabResultsSection observations={observations} patientId={patientId} />
      )}
      {activeSection === 'reports' && (
        <DiagnosticReportsSection diagnosticReports={diagnosticReports} patientId={patientId} />
      )}
      {activeSection === 'imaging' && (
        <ImagingStudiesSection imagingStudies={imagingStudies} patientId={patientId} />
      )}
      {activeSection === 'procedures' && (
        <ProceduresSection procedures={procedures} patientId={patientId} />
      )}
    </Box>
  );
};

export default OrdersResultsTab;