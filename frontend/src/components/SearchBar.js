/**
 * Main Application Search Bar Component
 * Provides global search functionality across patients and clinical resources
 */
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  InputBase,
  Paper,
  IconButton,
  Autocomplete,
  Typography,
  Chip,
  Stack,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  alpha,
  Popper,
  ClickAwayListener
} from '@mui/material';
import {
  Search as SearchIcon,
  Person as PersonIcon,
  Close as CloseIcon,
  LocalHospital as HospitalIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material';
import { debounce } from 'lodash';
import { fhirClient } from '../core/fhir/services/fhirClient';
import { searchService } from '../services/searchService';
import { getPatientDetailUrl } from '../core/navigation/navigationUtils';
import { useTheme } from '@mui/material/styles';

const SearchBar = ({ compact = false }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({
    patients: [],
    resources: {}
  });
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (!query || query.length < 2) {
        setSearchResults({ patients: [], resources: {} });
        setShowResults(false);
        return;
      }

      setLoading(true);
      try {
        // Search patients
        const patientResults = await fhirClient.searchPatients({
          name: query,
          _count: 5,
          _sort: '-_lastUpdated'
        });

        const transformedPatients = patientResults.resources?.map(patient => {
          const name = patient.name?.[0] || {};
          const mrn = patient.identifier?.find(id => 
            id.type?.coding?.[0]?.code === 'MR' || 
            id.system?.includes('mrn')
          )?.value || patient.identifier?.[0]?.value || '';

          return {
            id: patient.id,
            type: 'patient',
            display: `${name.family || ''}, ${name.given?.join(' ') || ''}`.trim(),
            secondary: `MRN: ${mrn} | DOB: ${patient.birthDate || 'Unknown'}`,
            resource: patient
          };
        }) || [];

        // Search clinical resources
        const resourceResults = await searchService.searchAll(query, 3);

        setSearchResults({
          patients: transformedPatients,
          resources: resourceResults
        });
        setShowResults(true);
      } catch (error) {
        setSearchResults({ patients: [], resources: {} });
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  const handleInputChange = (event) => {
    const value = event.target.value;
    setSearchQuery(value);
    debouncedSearch(value);
    
    if (value && !showResults) {
      setShowResults(true);
    }
  };

  const handlePatientClick = (patient) => {
    navigate(getPatientDetailUrl(patient.id));
    setSearchQuery('');
    setShowResults(false);
  };

  const handleResourceClick = (resource, resourceType) => {
    // Navigate to appropriate page based on resource type
    switch (resourceType) {
      case 'medications':
        navigate('/medications');
        break;
      case 'conditions':
        navigate('/dashboard'); // or appropriate conditions page
        break;
      case 'labTests':
        navigate('/lab-results');
        break;
      default:
        break;
    }
    setSearchQuery('');
    setShowResults(false);
  };

  const handleClear = () => {
    setSearchQuery('');
    setShowResults(false);
    setSearchResults({ patients: [], resources: {} });
  };

  const handleFocus = (event) => {
    setAnchorEl(event.currentTarget);
    if (searchQuery && searchQuery.length >= 2) {
      setShowResults(true);
    }
  };

  const handleClickAway = () => {
    setShowResults(false);
  };

  const getTotalResults = () => {
    const patientCount = searchResults.patients?.length || 0;
    const resourceCount = Object.values(searchResults.resources).reduce(
      (total, results) => total + (results?.length || 0), 0
    );
    return patientCount + resourceCount;
  };

  const renderPatientResults = () => {
    if (!searchResults.patients?.length) return null;

    return (
      <Box>
        <Box sx={{ p: 1, backgroundColor: 'grey.50', display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2">
            Patients ({searchResults.patients.length})
          </Typography>
        </Box>
        {searchResults.patients.map((patient, index) => (
          <ListItem
            key={`patient-${index}`}
            button
            onClick={() => handlePatientClick(patient)}
            sx={{ py: 1 }}
          >
            <ListItemIcon>
              <PersonIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={patient.display}
              secondary={patient.secondary}
              primaryTypographyProps={{ fontSize: '0.875rem' }}
              secondaryTypographyProps={{ fontSize: '0.75rem' }}
            />
          </ListItem>
        ))}
        <Divider />
      </Box>
    );
  };

  const renderResourceResults = () => {
    const resourceTypes = {
      medications: { label: 'Medications', icon: HospitalIcon },
      conditions: { label: 'Conditions', icon: AssignmentIcon },
      labTests: { label: 'Lab Tests', icon: HospitalIcon },
      procedures: { label: 'Procedures', icon: AssignmentIcon }
    };

    return Object.entries(searchResults.resources).map(([resourceType, results]) => {
      if (!results || results.length === 0) return null;
      
      const config = resourceTypes[resourceType] || { label: resourceType, icon: AssignmentIcon };
      const IconComponent = config.icon;
      
      return (
        <Box key={resourceType}>
          <Box sx={{ p: 1, backgroundColor: 'grey.50', display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconComponent fontSize="small" color="secondary" />
            <Typography variant="subtitle2">
              {config.label} ({results.length})
            </Typography>
          </Box>
          
          {results.slice(0, 3).map((result, index) => (
            <ListItem
              key={`${resourceType}-${index}`}
              button
              onClick={() => handleResourceClick(result, resourceType)}
              sx={{ py: 1 }}
            >
              <ListItemIcon>
                <IconComponent fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={result.display || result.name}
                secondary={result.code}
                primaryTypographyProps={{ fontSize: '0.875rem' }}
                secondaryTypographyProps={{ fontSize: '0.75rem' }}
              />
            </ListItem>
          ))}
          <Divider />
        </Box>
      );
    });
  };

  const renderSearchResults = () => {
    const totalResults = getTotalResults();
    
    if (loading) {
      return (
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <CircularProgress size={24} />
          <Typography variant="body2" sx={{ mt: 1 }}>
            Searching...
          </Typography>
        </Paper>
      );
    }

    if (totalResults === 0 && searchQuery.length >= 2) {
      return (
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No results found for "{searchQuery}"
          </Typography>
        </Paper>
      );
    }

    if (totalResults === 0) {
      return null;
    }

    return (
      <Paper sx={{ maxHeight: 400, overflow: 'auto' }}>
        {renderPatientResults()}
        {renderResourceResults()}
      </Paper>
    );
  };

  return (
    <ClickAwayListener onClickAway={handleClickAway}>
      <Box sx={{ position: 'relative', width: compact ? 300 : 400 }}>
        <Paper
          sx={{
            p: '2px 4px',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: alpha(theme.palette.action.hover, 0.5),
            border: 1,
            borderColor: 'divider',
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
            '&:focus-within': {
              backgroundColor: 'background.paper',
              boxShadow: 1,
            }
          }}
        >
          <SearchIcon sx={{ m: 1, color: 'text.secondary' }} />
          <InputBase
            sx={{ ml: 1, flex: 1 }}
            placeholder="Search patients, conditions, medications..."
            value={searchQuery}
            onChange={handleInputChange}
            onFocus={handleFocus}
          />
          {loading && <CircularProgress size={20} sx={{ mr: 1 }} />}
          {searchQuery && (
            <IconButton 
              type="button" 
              sx={{ p: '10px' }} 
              onClick={handleClear}
              size="small"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Paper>
        
        <Popper
          open={showResults && Boolean(anchorEl)}
          anchorEl={anchorEl}
          placement="bottom-start"
          sx={{ 
            width: anchorEl?.offsetWidth || 400,
            zIndex: 1300,
            mt: 1
          }}
        >
          {renderSearchResults()}
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

export default SearchBar;