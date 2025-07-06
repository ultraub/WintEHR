/**
 * Results Tab Component
 * Display lab results, imaging, and diagnostic test results
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Stack,
  Button,
  IconButton,
  Tooltip,
  Divider,
  Card,
  CardContent,
  CardActions,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  FormControl,
  Select,
  InputLabel,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Tabs,
  Tab,
  Badge,
  LinearProgress,
  useTheme,
  alpha
} from '@mui/material';
import {
  Science as LabIcon,
  Image as ImagingIcon,
  Assessment as DiagnosticIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Warning as AbnormalIcon,
  CheckCircle as NormalIcon,
  Schedule as PendingIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  GetApp as DownloadIcon,
  Visibility as ViewIcon,
  Print as PrintIcon,
  CalendarMonth as DateIcon,
  AccessTime as TimeIcon,
  ArrowUpward as HighIcon,
  ArrowDownward as LowIcon,
  Remove as NormalRangeIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import { format, parseISO, isWithinInterval, subDays, subMonths, formatDistanceToNow } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';

// Get result status icon and color
const getResultStatus = (observation) => {
  if (!observation.status) return { icon: <PendingIcon />, color: 'default' };
  
  switch (observation.status) {
    case 'final':
      const interpretation = observation.interpretation?.[0]?.coding?.[0]?.code;
      if (interpretation === 'H' || interpretation === 'HH') {
        return { icon: <HighIcon />, color: 'error', label: 'High' };
      } else if (interpretation === 'L' || interpretation === 'LL') {
        return { icon: <LowIcon />, color: 'error', label: 'Low' };
      } else if (interpretation === 'A' || interpretation === 'AA') {
        return { icon: <AbnormalIcon />, color: 'warning', label: 'Abnormal' };
      }
      return { icon: <NormalIcon />, color: 'success', label: 'Normal' };
    case 'preliminary':
      return { icon: <PendingIcon />, color: 'warning', label: 'Preliminary' };
    case 'entered-in-error':
      return { icon: <AbnormalIcon />, color: 'error', label: 'Error' };
    default:
      return { icon: <PendingIcon />, color: 'default', label: observation.status };
  }
};

// Result Row Component for Table View
const ResultRow = ({ observation, onClick, selected }) => {
  const theme = useTheme();
  const status = getResultStatus(observation);
  const date = observation.effectiveDateTime || observation.issued;
  
  const getValue = () => {
    if (observation.valueQuantity) {
      return `${observation.valueQuantity.value} ${observation.valueQuantity.unit || ''}`;
    } else if (observation.valueString) {
      return observation.valueString;
    } else if (observation.valueCodeableConcept) {
      return observation.valueCodeableConcept.text || 
             observation.valueCodeableConcept.coding?.[0]?.display;
    }
    return 'Result pending';
  };

  const getReference = () => {
    if (observation.referenceRange?.[0]) {
      const range = observation.referenceRange[0];
      if (range.low && range.high) {
        return `${range.low.value}-${range.high.value} ${range.low.unit || ''}`;
      } else if (range.text) {
        return range.text;
      }
    }
    return '';
  };

  return (
    <TableRow 
      hover 
      onClick={onClick}
      selected={selected}
      sx={{ cursor: 'pointer' }}
    >
      <TableCell>
        <Stack direction="row" spacing={1} alignItems="center">
          {status.icon}
          <Typography variant="body2">
            {observation.code?.text || observation.code?.coding?.[0]?.display || 'Unknown test'}
          </Typography>
        </Stack>
      </TableCell>
      <TableCell>
        <Typography variant="body2" fontWeight={status.label !== 'Normal' ? 'bold' : 'normal'}>
          {getValue()}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="caption" color="text.secondary">
          {getReference()}
        </Typography>
      </TableCell>
      <TableCell>
        {status.label && (
          <Chip 
            label={status.label} 
            size="small" 
            color={status.color}
            sx={{ fontWeight: 'bold' }}
          />
        )}
      </TableCell>
      <TableCell>
        <Typography variant="caption">
          {date ? format(parseISO(date), 'MMM d, yyyy h:mm a') : 'No date'}
        </Typography>
      </TableCell>
    </TableRow>
  );
};

// Result Card Component
const ResultCard = ({ observation, onClick }) => {
  const theme = useTheme();
  const status = getResultStatus(observation);
  const date = observation.effectiveDateTime || observation.issued;
  
  return (
    <Card 
      sx={{ 
        mb: 2,
        cursor: 'pointer',
        '&:hover': { boxShadow: 3 }
      }}
      onClick={onClick}
    >
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              {status.icon}
              <Typography variant="h6">
                {observation.code?.text || observation.code?.coding?.[0]?.display || 'Unknown test'}
              </Typography>
              {status.label && (
                <Chip 
                  label={status.label} 
                  size="small" 
                  color={status.color}
                />
              )}
            </Stack>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary">Result</Typography>
                <Typography variant="body1" fontWeight="bold">
                  {observation.valueQuantity ? 
                    `${observation.valueQuantity.value} ${observation.valueQuantity.unit || ''}` :
                    observation.valueString || 'Pending'
                  }
                </Typography>
              </Grid>
              
              {observation.referenceRange?.[0] && (
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.secondary">Reference Range</Typography>
                  <Typography variant="body2">
                    {observation.referenceRange[0].low?.value}-{observation.referenceRange[0].high?.value} {observation.referenceRange[0].low?.unit}
                  </Typography>
                </Grid>
              )}
              
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary">Date</Typography>
                <Typography variant="body2">
                  {date ? format(parseISO(date), 'MMM d, yyyy') : 'No date'}
                </Typography>
              </Grid>
            </Grid>
            
            {observation.note?.[0] && (
              <Box mt={2}>
                <Typography variant="caption" color="text.secondary">Note</Typography>
                <Typography variant="body2">{observation.note[0].text}</Typography>
              </Box>
            )}
          </Box>
        </Stack>
      </CardContent>
      
      <CardActions>
        <Button size="small" startIcon={<ViewIcon />}>View Details</Button>
        <Button size="small" startIcon={<PrintIcon />}>Print</Button>
      </CardActions>
    </Card>
  );
};

// Imaging Result Component
const ImagingResult = ({ imagingStudy, onClick }) => {
  const theme = useTheme();
  
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center" mb={2}>
          <ImagingIcon color="primary" />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">
              {imagingStudy.description || 'Imaging Study'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {imagingStudy.started ? format(parseISO(imagingStudy.started), 'MMM d, yyyy h:mm a') : 'Date unknown'}
            </Typography>
          </Box>
          <Chip 
            label={imagingStudy.status} 
            size="small" 
            color={imagingStudy.status === 'available' ? 'success' : 'default'}
          />
        </Stack>
        
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">Modality</Typography>
            <Typography variant="body2">
              {imagingStudy.modality?.[0]?.display || 'Unknown'}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">Body Site</Typography>
            <Typography variant="body2">
              {imagingStudy.bodySite?.[0]?.display || 'Not specified'}
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">Series</Typography>
            <Typography variant="body2">
              {imagingStudy.numberOfSeries || 0} series, {imagingStudy.numberOfInstances || 0} images
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
      
      <CardActions>
        <Button size="small" startIcon={<ViewIcon />} onClick={onClick}>
          View Images
        </Button>
        <Button size="small" startIcon={<DownloadIcon />}>
          Download Report
        </Button>
      </CardActions>
    </Card>
  );
};

const ResultsTab = ({ patientId, onNotificationUpdate }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { getPatientResources, isLoading } = useFHIRResource();
  
  const [tabValue, setTabValue] = useState(0);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'cards'
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState(null);

  useEffect(() => {
    setLoading(false);
  }, []);

  // Get observations and imaging studies
  const observations = getPatientResources(patientId, 'Observation') || [];
  const imagingStudies = getPatientResources(patientId, 'ImagingStudy') || [];
  const diagnosticReports = getPatientResources(patientId, 'DiagnosticReport') || [];

  // Categorize observations
  const labResults = observations.filter(o => 
    o.category?.[0]?.coding?.[0]?.code === 'laboratory'
  );
  const vitalSigns = observations.filter(o => 
    o.category?.[0]?.coding?.[0]?.code === 'vital-signs'
  );
  const otherResults = observations.filter(o => 
    !['laboratory', 'vital-signs'].includes(o.category?.[0]?.coding?.[0]?.code)
  );

  // Filter results based on current filters
  const filterResults = (results) => {
    return results.filter(result => {
      // Period filter
      if (filterPeriod !== 'all') {
        const date = result.effectiveDateTime || result.issued || result.started;
        if (date) {
          const resultDate = parseISO(date);
          const periodMap = {
            '7d': subDays(new Date(), 7),
            '30d': subDays(new Date(), 30),
            '3m': subMonths(new Date(), 3),
            '6m': subMonths(new Date(), 6),
            '1y': subMonths(new Date(), 12)
          };
          if (!isWithinInterval(resultDate, {
            start: periodMap[filterPeriod],
            end: new Date()
          })) {
            return false;
          }
        }
      }

      // Status filter
      if (filterStatus !== 'all') {
        const status = getResultStatus(result);
        if (filterStatus === 'abnormal' && status.label === 'Normal') return false;
        if (filterStatus === 'normal' && status.label !== 'Normal') return false;
      }

      // Search filter
      if (searchTerm) {
        const testName = result.code?.text || result.code?.coding?.[0]?.display || '';
        if (!testName.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  };

  // Get filtered results based on current tab
  const getCurrentResults = () => {
    switch (tabValue) {
      case 0: return filterResults(labResults);
      case 1: return imagingStudies;
      case 2: return filterResults(vitalSigns);
      case 3: return diagnosticReports;
      default: return [];
    }
  };

  const filteredResults = getCurrentResults();
  const sortedResults = [...filteredResults].sort((a, b) => {
    const dateA = new Date(a.effectiveDateTime || a.issued || a.started || 0);
    const dateB = new Date(b.effectiveDateTime || b.issued || b.started || 0);
    return dateB - dateA;
  });

  // Count abnormal results
  const abnormalCount = labResults.filter(r => {
    const status = getResultStatus(r);
    return status.label && status.label !== 'Normal';
  }).length;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Test Results
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant={viewMode === 'table' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('table')}
          >
            Table View
          </Button>
          <Button
            variant={viewMode === 'cards' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('cards')}
          >
            Card View
          </Button>
        </Stack>
      </Stack>

      {/* Alerts */}
      {abnormalCount > 0 && (
        <Alert 
          severity="warning" 
          sx={{ mb: 3 }}
          action={
            <Button 
              size="small" 
              onClick={() => setFilterStatus('abnormal')}
            >
              View All
            </Button>
          }
        >
          <Typography variant="subtitle2">
            {abnormalCount} abnormal lab results require review
          </Typography>
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={(e, newValue) => setTabValue(newValue)}
          variant="fullWidth"
        >
          <Tab 
            label="Lab Results" 
            icon={
              <Badge badgeContent={labResults.length} color="primary">
                <LabIcon />
              </Badge>
            }
            iconPosition="start"
          />
          <Tab 
            label="Imaging" 
            icon={
              <Badge badgeContent={imagingStudies.length} color="primary">
                <ImagingIcon />
              </Badge>
            }
            iconPosition="start"
          />
          <Tab 
            label="Vital Signs" 
            icon={
              <Badge badgeContent={vitalSigns.length} color="primary">
                <DiagnosticIcon />
              </Badge>
            }
            iconPosition="start"
          />
          <Tab 
            label="Reports" 
            icon={
              <Badge badgeContent={diagnosticReports.length} color="primary">
                <AssessmentIcon />
              </Badge>
            }
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            placeholder="Search tests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
          
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              label="Period"
            >
              <MenuItem value="all">All Time</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
              <MenuItem value="3m">Last 3 Months</MenuItem>
              <MenuItem value="6m">Last 6 Months</MenuItem>
              <MenuItem value="1y">Last Year</MenuItem>
            </Select>
          </FormControl>

          {tabValue === 0 && (
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                label="Status"
              >
                <MenuItem value="all">All Results</MenuItem>
                <MenuItem value="normal">Normal Only</MenuItem>
                <MenuItem value="abnormal">Abnormal Only</MenuItem>
              </Select>
            </FormControl>
          )}

          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
          >
            Print Results
          </Button>
        </Stack>
      </Paper>

      {/* Results Display */}
      {sortedResults.length === 0 ? (
        <Alert severity="info">
          No results found matching your criteria
        </Alert>
      ) : viewMode === 'table' && tabValue !== 1 ? (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Test Name</TableCell>
                <TableCell>Result</TableCell>
                <TableCell>Reference Range</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedResults
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((result) => (
                  <ResultRow
                    key={result.id}
                    observation={result}
                    onClick={() => navigate(`/patients/${patientId}/results/${result.id}`)}
                    selected={selectedResult?.id === result.id}
                  />
                ))
              }
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={sortedResults.length}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </TableContainer>
      ) : tabValue === 1 ? (
        // Imaging Results
        <Box>
          {sortedResults.map((imaging) => (
            <ImagingResult
              key={imaging.id}
              imagingStudy={imaging}
              onClick={() => navigate(`/patients/${patientId}/imaging/${imaging.id}`)}
            />
          ))}
        </Box>
      ) : (
        // Card View
        <Box>
          {sortedResults.map((result) => (
            <ResultCard
              key={result.id}
              observation={result}
              onClick={() => navigate(`/patients/${patientId}/results/${result.id}`)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default ResultsTab;