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
import { vitalSignsService } from '../services/vitalSignsService';

const VitalSignsTab = ({ observations, onOpenModal, patientId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVitalTypes, setSelectedVitalTypes] = useState([]);

  // Filter vital signs observations using the vital signs service
  const vitalSigns = useMemo(() => {
    return vitalSignsService.filterVitalSigns(observations);
  }, [observations]);

  // Get unique vital types for filter pills
  const vitalTypes = useMemo(() => {
    const types = [...new Set(vitalSigns.map(obs => vitalSignsService.getDisplayName(obs)))];
    return types.sort();
  }, [vitalSigns]);

  // Filter observations based on search and selected types
  const filteredVitals = useMemo(() => {
    let filtered = vitalSigns;

    if (searchTerm) {
      filtered = filtered.filter(obs => {
        const displayName = vitalSignsService.getDisplayName(obs);
        const value = vitalSignsService.getValue(obs);
        return displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
               (value && value.toString().toLowerCase().includes(searchTerm.toLowerCase()));
      });
    }

    if (selectedVitalTypes.length > 0) {
      filtered = filtered.filter(obs =>
        selectedVitalTypes.includes(vitalSignsService.getDisplayName(obs))
      );
    }

    return filtered.sort((a, b) => {
      const dateA = new Date(a.effectiveDateTime || a.observation_date || a.date);
      const dateB = new Date(b.effectiveDateTime || b.observation_date || b.date);
      return dateB - dateA;
    });
  }, [vitalSigns, searchTerm, selectedVitalTypes]);

  // Check if vital is abnormal using the vital signs service
  const isAbnormal = (vital) => {
    return vitalSignsService.isAbnormal(vital);
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
                    {format(new Date(vital.effectiveDateTime || vital.observation_date || vital.date), 'MM/dd/yyyy h:mm a')}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {vitalSignsService.getDisplayName(vital)}
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
                      {vitalSignsService.formatValue(vital)}
                    </Typography>
                  </TableCell>
                  <TableCell>{vitalSignsService.getUnit(vital)}</TableCell>
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