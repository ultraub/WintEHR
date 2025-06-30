import React, { useState, useMemo } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Chip,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Button,
  InputAdornment,
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  Science as ScienceIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { format } from 'date-fns';

const LaboratoryTab = ({ observations, onOpenModal }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLabTypes, setSelectedLabTypes] = useState([]);

  // Filter laboratory observations (observation_type is null, so filter by excluding vitals)
  const labResults = useMemo(() => {
    return observations.filter(obs => {
      const display = obs.display?.toLowerCase() || '';
      return !display.includes('blood pressure') && !display.includes('heart rate') && 
             !display.includes('temperature') && !display.includes('weight') && 
             !display.includes('height') && !display.includes('oxygen') && 
             !display.includes('respiratory') && !display.includes('bmi') && 
             !display.includes('pulse') && !display.includes('bp');
    });
  }, [observations]);

  // Get unique lab types for filter pills, grouped by categories
  const labCategories = useMemo(() => {
    const labs = [...new Set(labResults.map(obs => obs.display))];
    
    // Categorize labs
    const categories = {
      'Chemistry': [],
      'Hematology': [],
      'Lipids': [],
      'Cardiac': [],
      'Diabetes': [],
      'Other': []
    };

    labs.forEach(lab => {
      const labLower = lab.toLowerCase();
      if (labLower.includes('glucose') || labLower.includes('a1c') || labLower.includes('hemoglobin a1c')) {
        categories['Diabetes'].push(lab);
      } else if (labLower.includes('cholesterol') || labLower.includes('ldl') || labLower.includes('hdl') || labLower.includes('triglyceride')) {
        categories['Lipids'].push(lab);
      } else if (labLower.includes('hemoglobin') || labLower.includes('hematocrit') || labLower.includes('wbc') || labLower.includes('platelet') || labLower.includes('white blood cell')) {
        categories['Hematology'].push(lab);
      } else if (labLower.includes('troponin') || labLower.includes('bnp') || labLower.includes('ck')) {
        categories['Cardiac'].push(lab);
      } else if (labLower.includes('sodium') || labLower.includes('potassium') || labLower.includes('creatinine') || labLower.includes('bun') || labLower.includes('chloride')) {
        categories['Chemistry'].push(lab);
      } else {
        categories['Other'].push(lab);
      }
    });

    // Remove empty categories
    Object.keys(categories).forEach(key => {
      if (categories[key].length === 0) {
        delete categories[key];
      } else {
        categories[key].sort();
      }
    });

    return categories;
  }, [labResults]);

  // Filter observations based on search and selected types
  const filteredLabs = useMemo(() => {
    let filtered = labResults;

    if (searchTerm) {
      filtered = filtered.filter(obs =>
        obs.display.toLowerCase().includes(searchTerm.toLowerCase()) ||
        obs.value.toString().toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedLabTypes.length > 0) {
      filtered = filtered.filter(obs =>
        selectedLabTypes.includes(obs.display)
      );
    }

    return filtered.sort((a, b) => new Date(b.observation_date) - new Date(a.observation_date));
  }, [labResults, searchTerm, selectedLabTypes]);

  // Check if lab is abnormal
  const isAbnormal = (lab) => {
    const value = parseFloat(lab.value);
    const name = lab.display.toLowerCase();
    
    if (isNaN(value)) return false;

    if (name.includes('hemoglobin') || name.includes('hgb')) {
      return value < 12.0 || value > 16.0;
    }
    if (name.includes('hematocrit') || name.includes('hct')) {
      return value < 36.0 || value > 46.0;
    }
    if (name.includes('glucose')) {
      return value < 70 || value > 140;
    }
    if (name.includes('a1c') || name.includes('hemoglobin a1c')) {
      return value > 7.0;
    }
    if (name.includes('creatinine')) {
      return value > 1.3;
    }
    if (name.includes('ldl')) {
      return value > 100;
    }
    if (name.includes('hdl')) {
      return value < 40;
    }
    if (name.includes('triglycerides')) {
      return value > 150;
    }
    if (name.includes('cholesterol') && !name.includes('ldl') && !name.includes('hdl')) {
      return value > 200;
    }
    if (name.includes('sodium')) {
      return value < 136 || value > 145;
    }
    if (name.includes('potassium')) {
      return value < 3.5 || value > 5.0;
    }
    if (name.includes('white blood cell') || name.includes('wbc')) {
      return value < 4.5 || value > 11.0;
    }
    if (name.includes('platelet')) {
      return value < 150 || value > 450;
    }
    
    return false;
  };

  const handleLabTypeToggle = (type) => {
    setSelectedLabTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const clearAllFilters = () => {
    setSelectedLabTypes([]);
    setSearchTerm('');
  };

  const getStatusColor = (lab) => {
    return isAbnormal(lab) ? 'warning' : 'success';
  };

  const getLabTrend = (labName) => {
    const labHistory = labResults
      .filter(lab => lab.display === labName)
      .sort((a, b) => new Date(a.observation_date) - new Date(b.observation_date));
    
    if (labHistory.length < 2) return 'stable';
    
    const latest = parseFloat(labHistory[labHistory.length - 1].value);
    const previous = parseFloat(labHistory[labHistory.length - 2].value);
    
    if (isNaN(latest) || isNaN(previous)) return 'stable';
    
    const change = ((latest - previous) / previous) * 100;
    if (change > 5) return 'increasing';
    if (change < -5) return 'decreasing';
    return 'stable';
  };

  return (
    <Box>
      {/* Header with Add Button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Laboratory Results</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => onOpenModal('observation')}
          size="small"
        >
          Add Lab Result
        </Button>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search lab results..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={8}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="body2">Filter by category:</Typography>
                {selectedLabTypes.length > 0 && (
                  <Button
                    size="small"
                    onClick={clearAllFilters}
                    sx={{ ml: 1 }}
                  >
                    Clear All
                  </Button>
                )}
              </Box>
              {Object.entries(labCategories).map(([category, labs]) => (
                <Box key={category} sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                    {category}:
                  </Typography>
                  <Box sx={{ display: 'inline-flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {labs.map((lab) => (
                      <Chip
                        key={lab}
                        label={lab}
                        onClick={() => handleLabTypeToggle(lab)}
                        color={selectedLabTypes.includes(lab) ? 'primary' : 'default'}
                        variant={selectedLabTypes.includes(lab) ? 'filled' : 'outlined'}
                        size="small"
                      />
                    ))}
                  </Box>
                </Box>
              ))}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <ScienceIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h6">{labResults.length}</Typography>
              <Typography variant="body2" color="text.secondary">Total Results</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <WarningIcon color="warning" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h6">{labResults.filter(isAbnormal).length}</Typography>
              <Typography variant="body2" color="text.secondary">Abnormal Results</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="primary" sx={{ fontSize: 40, mb: 1 }}>
                {Object.keys(labCategories).length}
              </Typography>
              <Typography variant="h6">{Object.keys(labCategories).length}</Typography>
              <Typography variant="body2" color="text.secondary">Categories</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="info.main" sx={{ fontSize: 40, mb: 1 }}>
                {filteredLabs.length}
              </Typography>
              <Typography variant="h6">{filteredLabs.length}</Typography>
              <Typography variant="body2" color="text.secondary">Filtered Results</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Lab Results Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date & Time</TableCell>
              <TableCell>Test Name</TableCell>
              <TableCell>Result</TableCell>
              <TableCell>Unit</TableCell>
              <TableCell>Reference Range</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Trend</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredLabs.length > 0 ? (
              filteredLabs.map((lab) => {
                const trend = getLabTrend(lab.display);
                return (
                  <TableRow 
                    key={lab.id}
                    sx={{ 
                      bgcolor: isAbnormal(lab) ? 'warning.light' : 'transparent',
                      '&:hover': { bgcolor: isAbnormal(lab) ? 'warning.main' : 'action.hover' }
                    }}
                  >
                    <TableCell>
                      {format(new Date(lab.observation_date), 'MM/dd/yyyy h:mm a')}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {lab.display}
                        {isAbnormal(lab) && (
                          <WarningIcon color="warning" fontSize="small" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          fontWeight: 'bold',
                          color: isAbnormal(lab) ? 'warning.dark' : 'inherit'
                        }}
                      >
                        {lab.value}
                      </Typography>
                    </TableCell>
                    <TableCell>{lab.unit}</TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        See reference
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={isAbnormal(lab) ? 'Abnormal' : 'Normal'}
                        color={getStatusColor(lab)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TrendingUpIcon 
                          fontSize="small" 
                          color={
                            trend === 'increasing' ? 'error' : 
                            trend === 'decreasing' ? 'success' : 
                            'disabled'
                          }
                          sx={{
                            transform: trend === 'decreasing' ? 'rotate(180deg)' : 'none'
                          }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {trend}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Edit lab result">
                        <IconButton 
                          size="small" 
                          onClick={() => onOpenModal('observation', lab)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                    {searchTerm || selectedLabTypes.length > 0 
                      ? 'No lab results match your search criteria'
                      : 'No lab results recorded'
                    }
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Abnormal Results Alert */}
      {labResults.filter(isAbnormal).length > 0 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>{labResults.filter(isAbnormal).length}</strong> abnormal lab results require attention.
            Review values outside normal ranges and consider follow-up actions.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

export default LaboratoryTab;