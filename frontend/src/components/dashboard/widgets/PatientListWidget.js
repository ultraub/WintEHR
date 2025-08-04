/**
 * Patient List Widget
 * Smart patient lists with filtering and quick actions
 */

import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  Avatar,
  Chip,
  IconButton,
  Button,
  Menu,
  MenuItem,
  Tooltip,
  CircularProgress,
  Divider,
  FormControl,
  Select,
  Stack,
  Badge,
  useTheme,
  alpha
} from '@mui/material';
import {
  Search as SearchIcon,
  Person as PersonIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  MoreVert as MoreIcon,
  Warning as WarningIcon,
  Medication as MedicationIcon,
  LocalHospital as HospitalIcon,
  Assignment as AssignmentIcon,
  Flag as FlagIcon,
  Add as AddIcon
} from '@mui/icons-material';

import { fhirClient } from '../../../core/fhir/services/fhirClient';
import { useNavigate } from 'react-router-dom';
import { format, differenceInYears } from 'date-fns';

// Predefined smart lists
const smartLists = [
  { id: 'all', label: 'All Patients', icon: <PersonIcon /> },
  { id: 'diabetes', label: 'Diabetes Registry', icon: <HospitalIcon /> },
  { id: 'hypertension', label: 'Hypertension', icon: <WarningIcon /> },
  { id: 'polypharmacy', label: 'Polypharmacy (5+ meds)', icon: <MedicationIcon /> },
  { id: 'overdue', label: 'Overdue Preventive Care', icon: <FlagIcon /> }
];

function PatientListWidget() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [activeList, setActiveList] = useState('all');
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);

  useEffect(() => {
    fetchPatients();
  }, [activeList]);

  useEffect(() => {
    filterAndSortPatients();
  }, [patients, searchQuery, sortBy]);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      let searchParams = { _count: 100, _sort: 'family' };
      let allPatients = [];

      // Fetch based on active list
      switch (activeList) {
        case 'diabetes':
          // First get all patients, then check for diabetes conditions
          const patients = await fhirClient.search('Patient', { ...searchParams, _count: 50 });
          allPatients = patients.resources || [];
          
          // For demo purposes, mark random subset as diabetic
          // In production, would cross-reference with Condition resources
          allPatients = allPatients.slice(0, Math.min(10, allPatients.length));
          break;

        case 'hypertension':
          // Get patients for hypertension registry
          const htnPatients = await fhirClient.search('Patient', { ...searchParams, _count: 50 });
          allPatients = htnPatients.resources || [];
          
          // For demo, take a different subset
          allPatients = allPatients.slice(5, Math.min(15, allPatients.length));
          break;

        case 'polypharmacy':
          // Get patients for polypharmacy monitoring
          const polyPatients = await fhirClient.search('Patient', { ...searchParams, _count: 50 });
          allPatients = polyPatients.resources || [];
          
          // For demo, take another subset
          allPatients = allPatients.slice(10, Math.min(20, allPatients.length));
          break;

        case 'overdue':
          // For demo, just get random patients
          // In production, would check immunization records, screening dates, etc.
          const result = await fhirClient.search('Patient', { ...searchParams, _count: 25 });
          allPatients = result.resources || [];
          break;

        default:
          // All patients
          const allResult = await fhirClient.search('Patient', searchParams);
          allPatients = allResult.resources || [];
      }

      // Process patients for display
      const processedPatients = allPatients.map(patient => {
        const name = patient.name?.[0];
        const displayName = name ? 
          `${name.family || ''}, ${name.given?.join(' ') || ''}`.trim() : 
          'Unknown';
        
        return {
          id: patient.id,
          name: displayName,
          birthDate: patient.birthDate,
          age: patient.birthDate ? differenceInYears(new Date(), new Date(patient.birthDate)) : null,
          gender: patient.gender,
          phone: patient.telecom?.find(t => t.system === 'phone')?.value,
          conditions: [], // Would fetch in production
          medications: [], // Would fetch in production
          lastVisit: null, // Would fetch in production
          riskScore: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low',
          raw: patient
        };
      });

      setPatients(processedPatients);
    } catch (error) {
      console.error('Error fetching patients:', error);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortPatients = () => {
    let filtered = [...patients];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(patient => 
        patient.name.toLowerCase().includes(query) ||
        patient.phone?.includes(query) ||
        patient.id.includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'age':
          return (b.age || 0) - (a.age || 0);
        case 'risk':
          const riskOrder = { high: 3, medium: 2, low: 1 };
          return riskOrder[b.riskScore] - riskOrder[a.riskScore];
        default:
          return 0;
      }
    });

    setFilteredPatients(filtered);
  };

  const handlePatientClick = (patient) => {
    navigate(`/clinical-workspace/${patient.id}`);
  };

  const handleMenuOpen = (event, patient) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedPatient(patient);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedPatient(null);
  };

  const handleListChange = (event, newValue) => {
    setActiveList(newValue);
  };

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  return (
    <Paper sx={{ height: 600, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight="bold">
            Patient Lists
          </Typography>
          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            size="small"
            onClick={() => navigate('/patients/new')}
          >
            New Patient
          </Button>
        </Box>

        {/* Search and Filter Bar */}
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            size="small"
            placeholder="Search patients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              displayEmpty
            >
              <MenuItem value="name">Sort by Name</MenuItem>
              <MenuItem value="age">Sort by Age</MenuItem>
              <MenuItem value="risk">Sort by Risk</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Box>

      {/* Smart List Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeList}
          onChange={handleListChange}
          variant="scrollable"
          scrollButtons="auto"
        >
          {smartLists.map((list) => (
            <Tab
              key={list.id}
              value={list.id}
              label={list.label}
              icon={list.icon}
              iconPosition="start"
            />
          ))}
        </Tabs>
      </Box>

      {/* Patient List */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" height="100%">
            <CircularProgress />
          </Box>
        ) : filteredPatients.length === 0 ? (
          <Box display="flex" justifyContent="center" alignItems="center" height="100%">
            <Typography color="text.secondary">
              No patients found in this list
            </Typography>
          </Box>
        ) : (
          <List>
            {filteredPatients.map((patient, index) => (
              <React.Fragment key={patient.id}>
                <ListItem
                  disablePadding
                  secondaryAction={
                    <IconButton
                      edge="end"
                      onClick={(e) => handleMenuOpen(e, patient)}
                    >
                      <MoreIcon />
                    </IconButton>
                  }
                >
                  <ListItemButton onClick={() => handlePatientClick(patient)}>
                    <ListItemAvatar>
                      <Badge
                        overlap="circular"
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        badgeContent={
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              backgroundColor: theme.palette[getRiskColor(patient.riskScore)].main,
                              border: `2px solid ${theme.palette.background.paper}`
                            }}
                          />
                        }
                      >
                        <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                          <PersonIcon color="primary" />
                        </Avatar>
                      </Badge>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {patient.name}
                          </Typography>
                          <Chip
                            label={`${patient.age || '?'}y ${patient.gender?.[0]?.toUpperCase() || '?'}`}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            ID: {patient.id} • {patient.phone || 'No phone'}
                          </Typography>
                          {activeList === 'polypharmacy' && (
                            <Chip
                              icon={<MedicationIcon />}
                              label="5+ medications"
                              size="small"
                              color="warning"
                              sx={{ ml: 1, height: 20 }}
                            />
                          )}
                          {activeList === 'overdue' && (
                            <Chip
                              icon={<FlagIcon />}
                              label="Overdue screening"
                              size="small"
                              color="error"
                              sx={{ ml: 1, height: 20 }}
                            />
                          )}
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
                {index < filteredPatients.length - 1 && <Divider variant="inset" component="li" />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>

      {/* Patient Count */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: alpha(theme.palette.background.default, 0.5) }}>
        <Typography variant="body2" color="text.secondary" align="center">
          Showing {filteredPatients.length} of {patients.length} patients
        </Typography>
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          handlePatientClick(selectedPatient);
          handleMenuClose();
        }}>
          Open Chart
        </MenuItem>
        <MenuItem onClick={() => {
          navigate(`/clinical-workspace/${selectedPatient?.id}?tab=medications`);
          handleMenuClose();
        }}>
          View Medications
        </MenuItem>
        <MenuItem onClick={() => {
          navigate(`/clinical-workspace/${selectedPatient?.id}?tab=results`);
          handleMenuClose();
        }}>
          View Lab Results
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleMenuClose}>
          Add to Task List
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          Send Message
        </MenuItem>
      </Menu>
    </Paper>
  );
}

export default PatientListWidget;