/**
 * ResultsReviewMode Component
 * Smart results review with grouping, trending, and critical value highlighting
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  ListSubheader,
  Chip,
  Stack,
  Divider,
  Card,
  CardContent,
  CardActions,
  Collapse,
  Alert,
  CircularProgress,
  Tooltip,
  Badge,
  Avatar,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  useTheme,
  alpha,
  Fade,
  Grow,
  Menu,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import {
  Search as SearchIcon,
  Science as LabIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  Timeline as TimelineIcon,
  ViewList as ListIcon,
  ViewModule as GridIcon,
  CalendarToday as CalendarIcon,
  AccessTime as ClockIcon,
  Flag as FlagIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as NormalIcon,
  Error as CriticalIcon,
  Info as InfoIcon,
  LocalHospital as ImagingIcon,
  Biotech as MicrobiologyIcon,
  Bloodtype as HematologyIcon,
  Medication as ChemistryIcon,
  Psychology as PathologyIcon,
  FiberManualRecord as DotIcon,
  ShowChart as ChartIcon,
  Close as CloseIcon,
  CheckCircle
} from '@mui/icons-material';
import { format, parseISO, formatDistanceToNow, isToday, subDays, isWithinInterval } from 'date-fns';
import { useParams } from 'react-router-dom';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { fhirClient } from '../../../../services/fhirClient';
import { useObservations, usePatientResourceType } from '../../../../hooks/useFHIRResources';

// Lab categories
const LAB_CATEGORIES = {
  chemistry: {
    label: 'Chemistry',
    icon: <ChemistryIcon />,
    color: 'primary',
    codes: ['2093-3', '2085-9', '2160-0', '17861-6', '2345-7', '2339-0', '2069-3', '20565-8']
  },
  hematology: {
    label: 'Hematology',
    icon: <HematologyIcon />,
    color: 'error',
    codes: ['26464-8', '26453-1', '718-7', '4544-3', '787-2', '785-6', '786-4', '777-3']
  },
  microbiology: {
    label: 'Microbiology',
    icon: <MicrobiologyIcon />,
    color: 'success',
    codes: ['600-7', '944-5', '945-2', '25836-8']
  },
  urinalysis: {
    label: 'Urinalysis',
    icon: <LabIcon />,
    color: 'warning',
    codes: ['5811-5', '5804-0', '2514-8', '5803-2', '5794-3', '5797-6', '5799-2', '5778-6']
  },
  cardiac: {
    label: 'Cardiac',
    icon: <ChemistryIcon />,
    color: 'secondary',
    codes: ['2157-6', '33914-3', '2951-2', '3094-0', '2028-9']
  },
  other: {
    label: 'Other',
    icon: <LabIcon />,
    color: 'info',
    codes: []
  }
};

// Reference ranges (simplified - in production, these would come from the lab system)
const REFERENCE_RANGES = {
  '2093-3': { low: 125, high: 200, unit: 'mg/dL', name: 'Cholesterol' },
  '2085-9': { low: 30, high: 70, unit: 'mg/dL', name: 'HDL' },
  '2571-8': { low: 0, high: 150, unit: 'mg/dL', name: 'Triglycerides' },
  '2160-0': { low: 3, high: 7, unit: 'mg/dL', name: 'Creatinine' },
  '17861-6': { low: 3.5, high: 5, unit: 'g/dL', name: 'Albumin' },
  '2345-7': { low: 70, high: 100, unit: 'mg/dL', name: 'Glucose' },
  '718-7': { low: 4.5, high: 11, unit: '10*3/uL', name: 'WBC' },
  '787-2': { low: 150, high: 400, unit: '10*3/uL', name: 'Platelets' },
  '785-6': { low: 4, high: 6, unit: '10*6/uL', name: 'RBC' },
  '2951-2': { low: 136, high: 145, unit: 'mmol/L', name: 'Sodium' },
  '2823-3': { low: 3.5, high: 5.1, unit: 'mmol/L', name: 'Potassium' }
};

// Get category for a lab code
const getLabCategory = (code) => {
  for (const [key, category] of Object.entries(LAB_CATEGORIES)) {
    if (category.codes.includes(code)) {
      return key;
    }
  }
  return 'other';
};

// Check if value is critical
const isCriticalValue = (code, value) => {
  const range = REFERENCE_RANGES[code];
  if (!range || !value) return false;
  return value < range.low * 0.8 || value > range.high * 1.2;
};

// Check if value is abnormal
const isAbnormalValue = (code, value) => {
  const range = REFERENCE_RANGES[code];
  if (!range || !value) return false;
  return value < range.low || value > range.high;
};

// Get trend for values
const getTrend = (values) => {
  if (values.length < 2) return 'stable';
  const recent = values.slice(-3);
  const avg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
  const first = recent[0];
  const diff = ((avg - first) / first) * 100;
  if (diff > 10) return 'increasing';
  if (diff < -10) return 'decreasing';
  return 'stable';
};

// Result Card Component
const ResultCard = ({ result, view, onSelect, selected }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  
  const code = result.code?.coding?.[0]?.code;
  const value = result.valueQuantity?.value;
  const unit = result.valueQuantity?.unit;
  const category = getLabCategory(code);
  const categoryConfig = LAB_CATEGORIES[category];
  const reference = REFERENCE_RANGES[code];
  const isCritical = isCriticalValue(code, value);
  const isAbnormal = isAbnormalValue(code, value);
  
  const effectiveDate = result.effectiveDateTime ? parseISO(result.effectiveDateTime) : null;
  const isRecent = effectiveDate && isToday(effectiveDate);

  if (view === 'grid') {
    return (
      <Card 
        sx={{ 
          height: '100%',
          borderLeft: 4,
          borderLeftColor: isCritical ? 'error.main' : isAbnormal ? 'warning.main' : 'success.main',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          bgcolor: selected ? alpha(theme.palette.primary.main, 0.08) : 'background.paper',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: theme.shadows[4]
          }
        }}
        onClick={() => onSelect(result)}
      >
        <CardContent>
          <Stack spacing={1}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Avatar 
                sx={{ 
                  bgcolor: alpha(theme.palette[categoryConfig.color].main, 0.1),
                  color: theme.palette[categoryConfig.color].main,
                  width: 32,
                  height: 32
                }}
              >
                {categoryConfig.icon}
              </Avatar>
              {isCritical && (
                <Chip 
                  icon={<CriticalIcon />} 
                  label="Critical" 
                  size="small" 
                  color="error"
                />
              )}
            </Stack>
            
            <Typography variant="subtitle2" fontWeight="500">
              {result.code?.text || reference?.name || 'Unknown Test'}
            </Typography>
            
            <Typography variant="h4" color={isCritical ? 'error' : isAbnormal ? 'warning.main' : 'text.primary'}>
              {value} {unit}
            </Typography>
            
            {reference && (
              <Typography variant="caption" color="text.secondary">
                Normal: {reference.low} - {reference.high} {reference.unit}
              </Typography>
            )}
            
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="caption" color="text.secondary">
                {effectiveDate ? format(effectiveDate, 'MMM dd, yyyy') : 'No date'}
              </Typography>
              {isRecent && <Chip label="Today" size="small" color="primary" />}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  // List view
  return (
    <ListItem
      sx={{
        borderLeft: 4,
        borderLeftColor: isCritical ? 'error.main' : isAbnormal ? 'warning.main' : 'success.main',
        bgcolor: selected ? alpha(theme.palette.primary.main, 0.08) : 'background.paper',
        mb: 0.5
      }}
      secondaryAction={
        <Stack direction="row" spacing={1} alignItems="center">
          {isRecent && <Chip label="Today" size="small" color="primary" />}
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Stack>
      }
    >
      <ListItemIcon>
        <Checkbox
          edge="start"
          checked={selected}
          onChange={() => onSelect(result)}
        />
      </ListItemIcon>
      <ListItemText
        primary={
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="subtitle2">
              {result.code?.text || reference?.name || 'Unknown Test'}
            </Typography>
            <Typography 
              variant="h6" 
              color={isCritical ? 'error' : isAbnormal ? 'warning.main' : 'text.primary'}
              fontWeight="500"
            >
              {value} {unit}
            </Typography>
            {isCritical && <Chip icon={<CriticalIcon />} label="Critical" size="small" color="error" />}
            {isAbnormal && !isCritical && <Chip icon={<WarningIcon />} label="Abnormal" size="small" color="warning" />}
          </Stack>
        }
        secondary={
          <Stack direction="row" spacing={2}>
            <Typography variant="caption">
              {effectiveDate ? format(effectiveDate, 'MMM dd, yyyy h:mm a') : 'No date'}
            </Typography>
            {reference && (
              <Typography variant="caption" color="text.secondary">
                Normal: {reference.low} - {reference.high} {reference.unit}
              </Typography>
            )}
          </Stack>
        }
      />
    </ListItem>
  );
};

// Trending Chart Component - Simple implementation without recharts
const TrendingChart = ({ observations, code }) => {
  const theme = useTheme();
  const reference = REFERENCE_RANGES[code];
  
  const data = observations
    .filter(obs => obs.code?.coding?.[0]?.code === code && obs.valueQuantity?.value)
    .sort((a, b) => new Date(a.effectiveDateTime) - new Date(b.effectiveDateTime))
    .map(obs => ({
      date: format(parseISO(obs.effectiveDateTime), 'MMM dd'),
      value: obs.valueQuantity.value,
      unit: obs.valueQuantity.unit
    }));

  if (data.length < 2) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">
          Not enough data points for trending
        </Typography>
      </Box>
    );
  }

  // Simple text-based trend display
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Trend Analysis
      </Typography>
      <List dense>
        {data.slice(-5).reverse().map((point, index) => (
          <ListItem key={index}>
            <ListItemText
              primary={`${point.value} ${point.unit}`}
              secondary={point.date}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

// Main ResultsReviewMode Component
const ResultsReviewMode = () => {
  const theme = useTheme();
  const { patientId } = useParams();
  const { currentPatient } = useFHIRResource();
  
  // State
  const [view, setView] = useState('list');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [showAbnormalOnly, setShowAbnormalOnly] = useState(false);
  const [selectedResults, setSelectedResults] = useState([]);
  const [trendingCode, setTrendingCode] = useState(null);
  const [sortBy, setSortBy] = useState('date');

  // Get observations
  const observationsData = useObservations(patientId);
  const diagnosticReports = usePatientResourceType(patientId, 'DiagnosticReport');
  const imagingStudies = usePatientResourceType(patientId, 'ImagingStudy');

  // Filter and process observations
  const processedResults = useMemo(() => {
    let results = observationsData.observations || [];
    
    // Filter by category
    if (selectedCategory !== 'all') {
      const categoryCodes = LAB_CATEGORIES[selectedCategory]?.codes || [];
      results = results.filter(obs => 
        categoryCodes.includes(obs.code?.coding?.[0]?.code)
      );
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      results = results.filter(obs =>
        obs.code?.text?.toLowerCase().includes(query) ||
        obs.code?.coding?.[0]?.display?.toLowerCase().includes(query)
      );
    }
    
    // Filter by date
    const now = new Date();
    switch (dateFilter) {
      case 'today':
        results = results.filter(obs => 
          obs.effectiveDateTime && isToday(parseISO(obs.effectiveDateTime))
        );
        break;
      case 'week':
        const weekAgo = subDays(now, 7);
        results = results.filter(obs => 
          obs.effectiveDateTime && 
          isWithinInterval(parseISO(obs.effectiveDateTime), { start: weekAgo, end: now })
        );
        break;
      case 'month':
        const monthAgo = subDays(now, 30);
        results = results.filter(obs => 
          obs.effectiveDateTime && 
          isWithinInterval(parseISO(obs.effectiveDateTime), { start: monthAgo, end: now })
        );
        break;
    }
    
    // Filter abnormal only
    if (showAbnormalOnly) {
      results = results.filter(obs => {
        const code = obs.code?.coding?.[0]?.code;
        const value = obs.valueQuantity?.value;
        return isAbnormalValue(code, value);
      });
    }
    
    // Sort results
    switch (sortBy) {
      case 'date':
        results.sort((a, b) => 
          new Date(b.effectiveDateTime || 0) - new Date(a.effectiveDateTime || 0)
        );
        break;
      case 'name':
        results.sort((a, b) => 
          (a.code?.text || '').localeCompare(b.code?.text || '')
        );
        break;
      case 'value':
        results.sort((a, b) => {
          const aVal = a.valueQuantity?.value || 0;
          const bVal = b.valueQuantity?.value || 0;
          const aCode = a.code?.coding?.[0]?.code;
          const bCode = b.code?.coding?.[0]?.code;
          const aAbnormal = isAbnormalValue(aCode, aVal);
          const bAbnormal = isAbnormalValue(bCode, bVal);
          if (aAbnormal && !bAbnormal) return -1;
          if (!aAbnormal && bAbnormal) return 1;
          return 0;
        });
        break;
    }
    
    return results;
  }, [observationsData.observations, selectedCategory, searchQuery, dateFilter, showAbnormalOnly, sortBy]);

  // Group results by category
  const groupedResults = useMemo(() => {
    const groups = {};
    processedResults.forEach(result => {
      const code = result.code?.coding?.[0]?.code;
      const category = getLabCategory(code);
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(result);
    });
    return groups;
  }, [processedResults]);

  // Count abnormal results
  const abnormalCount = useMemo(() => {
    return processedResults.filter(obs => {
      const code = obs.code?.coding?.[0]?.code;
      const value = obs.valueQuantity?.value;
      return isAbnormalValue(code, value);
    }).length;
  }, [processedResults]);

  // Count critical results
  const criticalCount = useMemo(() => {
    return processedResults.filter(obs => {
      const code = obs.code?.coding?.[0]?.code;
      const value = obs.valueQuantity?.value;
      return isCriticalValue(code, value);
    }).length;
  }, [processedResults]);

  // Handle result selection
  const handleSelectResult = (result) => {
    setSelectedResults(prev => {
      const isSelected = prev.some(r => r.id === result.id);
      if (isSelected) {
        return prev.filter(r => r.id !== result.id);
      }
      return [...prev, result];
    });
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedResults.length === processedResults.length) {
      setSelectedResults([]);
    } else {
      setSelectedResults(processedResults);
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs>
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                placeholder="Search results..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="small"
                sx={{ minWidth: 300 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  )
                }}
              />
              
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Date Range</InputLabel>
                <Select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  label="Date Range"
                >
                  <MenuItem value="all">All Time</MenuItem>
                  <MenuItem value="today">Today</MenuItem>
                  <MenuItem value="week">Past Week</MenuItem>
                  <MenuItem value="month">Past Month</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  label="Sort By"
                >
                  <MenuItem value="date">Date</MenuItem>
                  <MenuItem value="name">Name</MenuItem>
                  <MenuItem value="value">Abnormal First</MenuItem>
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={showAbnormalOnly}
                    onChange={(e) => setShowAbnormalOnly(e.target.checked)}
                  />
                }
                label="Abnormal Only"
              />
            </Stack>
          </Grid>
          
          <Grid item>
            <Stack direction="row" spacing={1}>
              <ToggleButtonGroup
                value={view}
                exclusive
                onChange={(e, newView) => setView(newView || view)}
                size="small"
              >
                <ToggleButton value="list">
                  <ListIcon />
                </ToggleButton>
                <ToggleButton value="grid">
                  <GridIcon />
                </ToggleButton>
              </ToggleButtonGroup>
              
              <IconButton size="small">
                <PrintIcon />
              </IconButton>
              <IconButton size="small">
                <DownloadIcon />
              </IconButton>
              <IconButton size="small">
                <ShareIcon />
              </IconButton>
            </Stack>
          </Grid>
        </Grid>

        {/* Summary Stats */}
        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          <Chip
            icon={<LabIcon />}
            label={`${processedResults.length} Results`}
            color="primary"
          />
          {abnormalCount > 0 && (
            <Chip
              icon={<WarningIcon />}
              label={`${abnormalCount} Abnormal`}
              color="warning"
            />
          )}
          {criticalCount > 0 && (
            <Chip
              icon={<CriticalIcon />}
              label={`${criticalCount} Critical`}
              color="error"
            />
          )}
          {selectedResults.length > 0 && (
            <Chip
              label={`${selectedResults.length} Selected`}
              onDelete={() => setSelectedResults([])}
            />
          )}
        </Stack>
      </Paper>

      <Grid container spacing={2} sx={{ flex: 1, minHeight: 0 }}>
        {/* Category Filter - Left Sidebar */}
        <Grid item xs={12} md={2}>
          <Paper sx={{ height: '100%', overflow: 'auto' }}>
            <List>
              <ListSubheader>Categories</ListSubheader>
              <ListItemButton
                selected={selectedCategory === 'all'}
                onClick={() => setSelectedCategory('all')}
              >
                <ListItemIcon>
                  <LabIcon />
                </ListItemIcon>
                <ListItemText primary="All Results" secondary={processedResults.length} />
              </ListItemButton>
              
              {Object.entries(LAB_CATEGORIES).map(([key, category]) => {
                const count = groupedResults[key]?.length || 0;
                if (count === 0 && selectedCategory !== key) return null;
                
                return (
                  <ListItemButton
                    key={key}
                    selected={selectedCategory === key}
                    onClick={() => setSelectedCategory(key)}
                  >
                    <ListItemIcon>
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: alpha(theme.palette[category.color].main, 0.1),
                          color: theme.palette[category.color].main
                        }}
                      >
                        {category.icon}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText primary={category.label} secondary={count} />
                  </ListItemButton>
                );
              })}
            </List>
          </Paper>
        </Grid>

        {/* Results List/Grid - Center */}
        <Grid item xs={12} md={trendingCode ? 5 : 10}>
          <Paper sx={{ height: '100%', overflow: 'auto', p: 2 }}>
            {processedResults.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <LabIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No results found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Try adjusting your filters or search query
                </Typography>
              </Box>
            ) : (
              <>
                {selectedResults.length > 0 && (
                  <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                    <Button
                      size="small"
                      startIcon={<CheckCircle />}
                      onClick={handleSelectAll}
                    >
                      {selectedResults.length === processedResults.length ? 'Deselect All' : 'Select All'}
                    </Button>
                    <Button
                      size="small"
                      startIcon={<ChartIcon />}
                      disabled={selectedResults.length !== 1}
                      onClick={() => {
                        if (selectedResults.length === 1) {
                          setTrendingCode(selectedResults[0].code?.coding?.[0]?.code);
                        }
                      }}
                    >
                      View Trend
                    </Button>
                  </Stack>
                )}

                {view === 'grid' ? (
                  <Grid container spacing={2}>
                    {processedResults.map(result => (
                      <Grid item xs={12} sm={6} md={4} key={result.id}>
                        <ResultCard
                          result={result}
                          view={view}
                          onSelect={handleSelectResult}
                          selected={selectedResults.some(r => r.id === result.id)}
                        />
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <List>
                    {processedResults.map(result => (
                      <ResultCard
                        key={result.id}
                        result={result}
                        view={view}
                        onSelect={handleSelectResult}
                        selected={selectedResults.some(r => r.id === result.id)}
                      />
                    ))}
                  </List>
                )}
              </>
            )}
          </Paper>
        </Grid>

        {/* Trending Panel - Right */}
        {trendingCode && (
          <Grid item xs={12} md={5}>
            <Paper sx={{ height: '100%', p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  Trending: {REFERENCE_RANGES[trendingCode]?.name || 'Lab Result'}
                </Typography>
                <IconButton onClick={() => setTrendingCode(null)}>
                  <CloseIcon />
                </IconButton>
              </Stack>
              
              <TrendingChart
                observations={observationsData.observations || []}
                code={trendingCode}
              />
              
              {/* Historical Values Table */}
              <TableContainer sx={{ mt: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Value</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(observationsData.observations || [])
                      .filter(obs => obs.code?.coding?.[0]?.code === trendingCode)
                      .sort((a, b) => new Date(b.effectiveDateTime) - new Date(a.effectiveDateTime))
                      .slice(0, 10)
                      .map(obs => {
                        const value = obs.valueQuantity?.value;
                        const isCritical = isCriticalValue(trendingCode, value);
                        const isAbnormal = isAbnormalValue(trendingCode, value);
                        
                        return (
                          <TableRow key={obs.id}>
                            <TableCell>
                              {format(parseISO(obs.effectiveDateTime), 'MMM dd, yyyy')}
                            </TableCell>
                            <TableCell 
                              align="right"
                              sx={{ 
                                color: isCritical ? 'error.main' : isAbnormal ? 'warning.main' : 'text.primary',
                                fontWeight: isCritical || isAbnormal ? 'bold' : 'normal'
                              }}
                            >
                              {value} {obs.valueQuantity?.unit}
                            </TableCell>
                            <TableCell>
                              {isCritical ? (
                                <Chip icon={<CriticalIcon />} label="Critical" size="small" color="error" />
                              ) : isAbnormal ? (
                                <Chip icon={<WarningIcon />} label="Abnormal" size="small" color="warning" />
                              ) : (
                                <Chip icon={<NormalIcon />} label="Normal" size="small" color="success" />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default ResultsReviewMode;