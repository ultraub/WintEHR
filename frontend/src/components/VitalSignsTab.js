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
  InputAdornment
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import VitalSignsTrends from './VitalSignsTrends';

const VitalSignsTab = ({ observations, onOpenModal, patientId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVitalTypes, setSelectedVitalTypes] = useState([]);

  // Filter vital signs observations
  const vitalSigns = useMemo(() => {
    return observations.filter(obs => obs.observation_type === 'vital-signs');
  }, [observations]);

  // Get unique vital types for filter pills
  const vitalTypes = useMemo(() => {
    const types = [...new Set(vitalSigns.map(obs => obs.display))];
    return types.sort();
  }, [vitalSigns]);

  // Filter observations based on search and selected types
  const filteredVitals = useMemo(() => {
    let filtered = vitalSigns;

    if (searchTerm) {
      filtered = filtered.filter(obs =>
        obs.display.toLowerCase().includes(searchTerm.toLowerCase()) ||
        obs.value.toString().toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedVitalTypes.length > 0) {
      filtered = filtered.filter(obs =>
        selectedVitalTypes.includes(obs.display)
      );
    }

    return filtered.sort((a, b) => new Date(b.observation_date) - new Date(a.observation_date));
  }, [vitalSigns, searchTerm, selectedVitalTypes]);

  // Check if vital is abnormal (simplified logic)
  const isAbnormal = (vital) => {
    const value = parseFloat(vital.value);
    const display = vital.display.toLowerCase();

    if (display.includes('blood pressure') || display.includes('bp')) {
      if (typeof vital.value === 'string' && vital.value.includes('/')) {
        const [systolic, diastolic] = vital.value.split('/').map(Number);
        return systolic > 140 || systolic < 90 || diastolic > 90 || diastolic < 60;
      }
    }
    if (display.includes('heart rate') || display.includes('pulse')) {
      return value > 100 || value < 60;
    }
    if (display.includes('temperature')) {
      return value > 99.5 || value < 97.0;
    }
    if (display.includes('oxygen') || display.includes('o2') || display.includes('sat')) {
      return value < 95;
    }
    if (display.includes('respiratory') || display.includes('breath')) {
      return value > 20 || value < 12;
    }

    return false;
  };

  const handleVitalTypeToggle = (type) => {
    setSelectedVitalTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const getStatusColor = (vital) => {
    return isAbnormal(vital) ? 'warning' : 'success';
  };

  return (
    <Box>
      {/* Header with Add Button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Vital Signs</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => onOpenModal('observation')}
          size="small"
        >
          Add Vital Signs
        </Button>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search vital signs..."
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
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="body2" sx={{ mr: 1, alignSelf: 'center' }}>
                  Filter by type:
                </Typography>
                {vitalTypes.map((type) => (
                  <Chip
                    key={type}
                    label={type}
                    onClick={() => handleVitalTypeToggle(type)}
                    color={selectedVitalTypes.includes(type) ? 'primary' : 'default'}
                    variant={selectedVitalTypes.includes(type) ? 'filled' : 'outlined'}
                    size="small"
                  />
                ))}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <TrendingUpIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h6">{vitalSigns.length}</Typography>
              <Typography variant="body2" color="text.secondary">Total Recordings</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <WarningIcon color="warning" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h6">{vitalSigns.filter(isAbnormal).length}</Typography>
              <Typography variant="body2" color="text.secondary">Abnormal Values</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="primary" sx={{ fontSize: 40, mb: 1 }}>
                {vitalTypes.length}
              </Typography>
              <Typography variant="h6">{vitalTypes.length}</Typography>
              <Typography variant="body2" color="text.secondary">Vital Types</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="info.main" sx={{ fontSize: 40, mb: 1 }}>
                {filteredVitals.length}
              </Typography>
              <Typography variant="h6">{filteredVitals.length}</Typography>
              <Typography variant="body2" color="text.secondary">Filtered Results</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Vital Signs Trends Chart */}
      <Box sx={{ mb: 3 }}>
        <VitalSignsTrends vitals={vitalSigns} patientId={patientId} />
      </Box>

      {/* Vital Signs Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date & Time</TableCell>
              <TableCell>Vital Sign</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>Unit</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredVitals.length > 0 ? (
              filteredVitals.map((vital) => (
                <TableRow 
                  key={vital.id}
                  sx={{ 
                    bgcolor: isAbnormal(vital) ? 'warning.light' : 'transparent',
                    '&:hover': { bgcolor: isAbnormal(vital) ? 'warning.main' : 'action.hover' }
                  }}
                >
                  <TableCell>
                    {format(new Date(vital.observation_date), 'MM/dd/yyyy h:mm a')}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {vital.display}
                      {isAbnormal(vital) && (
                        <WarningIcon color="warning" fontSize="small" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography 
                      variant="body1" 
                      sx={{ 
                        fontWeight: 'bold',
                        color: isAbnormal(vital) ? 'warning.dark' : 'inherit'
                      }}
                    >
                      {vital.value}
                    </Typography>
                  </TableCell>
                  <TableCell>{vital.unit}</TableCell>
                  <TableCell>
                    <Chip 
                      label={isAbnormal(vital) ? 'Abnormal' : 'Normal'}
                      color={getStatusColor(vital)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Edit vital signs">
                      <IconButton 
                        size="small" 
                        onClick={() => onOpenModal('observation', vital)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                    {searchTerm || selectedVitalTypes.length > 0 
                      ? 'No vital signs match your search criteria'
                      : 'No vital signs recorded'
                    }
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default VitalSignsTab;