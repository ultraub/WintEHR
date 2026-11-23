/**
 * Main Application Search Bar Component
 * Patient search in the app bar: type a name, pick a patient, land on the chart.
 *
 * It used to also list catalog matches (medications, conditions, lab tests),
 * but those rows linked to routes that do not exist and held the patient
 * results back until the slower catalog query finished.
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  InputBase,
  Paper,
  IconButton,
  Typography,
  CircularProgress,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  alpha,
  Popper,
  ClickAwayListener
} from '@mui/material';
import {
  Search as SearchIcon,
  Person as PersonIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { debounce } from 'lodash';
import { fhirClient } from '../core/fhir/services/fhirClient';
import { getPatientDetailUrl } from '../core/navigation/navigationUtils';
import { useTheme } from '@mui/material/styles';
import { formatPersonName } from '../utils/clinicalDisplay';

const SearchBar = ({ compact = false }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const fieldRef = useRef(null);
  // Only the newest request may update state; a slow early response must not
  // overwrite the results for what the user has typed since.
  const requestSeq = useRef(0);

  const debouncedSearch = useMemo(
    () => debounce(async (query) => {
      const seq = ++requestSeq.current;
      try {
        const patientResults = await fhirClient.searchPatients({
          name: query,
          _count: 8,
          _sort: '-_lastUpdated'
        });
        if (seq !== requestSeq.current) return;

        setPatients((patientResults.resources || []).map(patient => {
          return {
            id: patient.id,
            display: formatPersonName(patient, 'family-first'),
            secondary: `DOB: ${patient.birthDate || 'Unknown'}`
          };
        }));
        setFailed(false);
      } catch (error) {
        if (seq !== requestSeq.current) return;
        setPatients([]);
        setFailed(true);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, 300),
    []
  );

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const handleInputChange = (event) => {
    const value = event.target.value;
    setSearchQuery(value);

    if (value.trim().length < 2) {
      requestSeq.current += 1;
      debouncedSearch.cancel();
      setPatients([]);
      setLoading(false);
      setFailed(false);
      setShowResults(false);
      return;
    }
    setLoading(true);
    setShowResults(true);
    debouncedSearch(value.trim());
  };

  const handlePatientClick = (patient) => {
    navigate(getPatientDetailUrl(patient.id));
    handleClear();
  };

  const handleClear = () => {
    requestSeq.current += 1;
    debouncedSearch.cancel();
    setSearchQuery('');
    setPatients([]);
    setLoading(false);
    setFailed(false);
    setShowResults(false);
  };

  const handleFocus = () => {
    if (searchQuery.trim().length >= 2) {
      setShowResults(true);
    }
  };

  const handleClickAway = () => {
    setShowResults(false);
  };

  const renderMessage = (text) => (
    <Paper sx={{ p: 2, textAlign: 'center' }}>
      <Typography variant="body2" color="text.secondary">{text}</Typography>
    </Paper>
  );

  const renderSearchResults = () => {
    // Keep the previous matches on screen while a new query is in flight; the
    // spinner in the field already shows that work is happening.
    if (loading && patients.length === 0) return renderMessage('Searching…');
    if (failed) return renderMessage('Search is unavailable right now.');
    if (patients.length === 0) return renderMessage(`No patients match "${searchQuery.trim()}"`);

    return (
      <Paper sx={{ maxHeight: 400, overflow: 'auto' }}>
        {patients.map((patient) => (
          <ListItemButton
            key={patient.id}
            onClick={() => handlePatientClick(patient)}
            sx={{ py: 1 }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <PersonIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={patient.display}
              secondary={patient.secondary}
              primaryTypographyProps={{ fontSize: '0.875rem' }}
              secondaryTypographyProps={{ fontSize: '0.75rem' }}
            />
          </ListItemButton>
        ))}
      </Paper>
    );
  };

  return (
    <ClickAwayListener onClickAway={handleClickAway}>
      <Box sx={{ position: 'relative', width: compact ? 300 : 400 }}>
        <Paper
          ref={fieldRef}
          sx={{
            p: '2px 4px',
            display: 'flex',
            alignItems: 'center',
            // A light, translucent field: it sits in the app bar, which is
            // dark in every mode, and should not be the darkest thing in it.
            backgroundColor: alpha(theme.palette.common.white, 0.1),
            backgroundImage: 'none',
            boxShadow: 'none',
            border: 1,
            borderColor: alpha(theme.palette.common.white, 0.16),
            transition: 'all 0.2s ease',
            '&:hover': {
              backgroundColor: alpha(theme.palette.common.white, 0.14),
              borderColor: alpha(theme.palette.common.white, 0.3),
            },
            '&:focus-within': {
              backgroundColor: alpha(theme.palette.common.white, 0.16),
              borderColor: theme.palette.primary.main,
            }
          }}
        >
          <SearchIcon sx={{ m: 1, color: 'text.secondary' }} />
          <InputBase
            sx={{ ml: 1, flex: 1 }}
            placeholder="Search patients by name"
            inputProps={{ 'aria-label': 'Search patients by name' }}
            value={searchQuery}
            onChange={handleInputChange}
            onFocus={handleFocus}
          />
          {loading && <CircularProgress size={20} sx={{ mr: 1 }} />}
          {searchQuery && (
            <IconButton 
              type="button"
              aria-label="Clear search"
              sx={{ p: '10px' }}
              onClick={handleClear}
              size="small"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Paper>
        
        <Popper
          open={showResults && Boolean(fieldRef.current)}
          anchorEl={fieldRef.current}
          placement="bottom-start"
          sx={{ 
            width: fieldRef.current?.offsetWidth || 400,
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