/**
 * Universal Search Bar Component
 * Provides unified search across all clinical resources
 */
import React, { useState, useCallback } from 'react';
import {
  Box,
  TextField,
  Autocomplete,
  Paper,
  Typography,
  Chip,
  Stack,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Search as SearchIcon,
  Medication as MedicationIcon,
  Assignment as ProblemIcon,
  Warning as AllergyIcon,
  Science as LabIcon,
  CameraAlt as ImagingIcon,
  Close as CloseIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { debounce } from 'lodash';
import { searchService } from '../../../../services/searchService';

const RESOURCE_TYPES = {
  conditions: { label: 'Problems', icon: ProblemIcon, color: 'warning' },
  medications: { label: 'Medications', icon: MedicationIcon, color: 'primary' },
  labTests: { label: 'Lab Tests', icon: LabIcon, color: 'info' },
  imagingProcedures: { label: 'Imaging', icon: ImagingIcon, color: 'secondary' }
};

const UniversalSearchBar = ({ 
  placeholder = "Search conditions, medications, lab tests, imaging...",
  onResultSelect,
  onAddToPatient,
  patientId,
  compact = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (!query || query.length < 2) {
        setSearchResults({});
        setShowResults(false);
        return;
      }

      setLoading(true);
      try {
        const results = await searchService.searchAll(query, 5);
        setSearchResults(results);
        setShowResults(true);
      } catch (error) {
        console.error('Error in universal search:', error);
        setSearchResults({});
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  const handleInputChange = (event, value) => {
    setSearchQuery(value);
    debouncedSearch(value);
  };

  const handleResultClick = (result, resourceType) => {
    setSelectedResult({ ...result, resourceType });
    setShowResults(false);
    
    if (onResultSelect) {
      onResultSelect(result, resourceType);
    }
  };

  const handleAddToPatient = (result, resourceType) => {
    setSelectedResult({ ...result, resourceType });
    setShowAddDialog(true);
    setShowResults(false);
  };

  const handleConfirmAdd = async () => {
    if (selectedResult && onAddToPatient) {
      try {
        await onAddToPatient(selectedResult, selectedResult.resourceType);
        setShowAddDialog(false);
        setSelectedResult(null);
        setSearchQuery('');
      } catch (error) {
        console.error('Error adding to patient:', error);
      }
    }
  };

  const getTotalResults = () => {
    return Object.values(searchResults).reduce((total, results) => total + (results?.length || 0), 0);
  };

  const renderSearchResults = () => {
    const totalResults = getTotalResults();
    
    if (loading) {
      return (
        <Paper sx={{ p: 2, mt: 1, textAlign: 'center' }}>
          <CircularProgress size={24} />
          <Typography variant="body2" sx={{ mt: 1 }}>
            Searching...
          </Typography>
        </Paper>
      );
    }

    if (totalResults === 0 && searchQuery.length >= 2) {
      return (
        <Paper sx={{ p: 2, mt: 1, textAlign: 'center' }}>
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
      <Paper sx={{ mt: 1, maxHeight: 400, overflow: 'auto' }}>
        {Object.entries(searchResults).map(([resourceType, results]) => {
          if (!results || results.length === 0) return null;
          
          const resourceConfig = RESOURCE_TYPES[resourceType];
          const IconComponent = resourceConfig?.icon || SearchIcon;
          
          return (
            <Box key={resourceType}>
              <Box sx={{ p: 1, backgroundColor: 'grey.50', display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconComponent fontSize="small" color={resourceConfig?.color || 'action'} />
                <Typography variant="subtitle2">
                  {resourceConfig?.label || resourceType} ({results.length})
                </Typography>
              </Box>
              
              {results.map((result, index) => (
                <ListItem
                  key={`${resourceType}-${index}`}
                  button
                  onClick={() => handleResultClick(result, resourceType)}
                  sx={{ py: 1 }}
                >
                  <ListItemIcon>
                    <IconComponent fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={result.display || result.name}
                    secondary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        {result.code && (
                          <Chip label={result.code} size="small" variant="outlined" />
                        )}
                        {result.system && (
                          <Typography variant="caption" color="text.secondary">
                            {result.system.split('/').pop()}
                          </Typography>
                        )}
                      </Stack>
                    }
                  />
                  {patientId && onAddToPatient && (
                    <ListItemSecondaryAction>
                      <Tooltip title="Add to Patient">
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToPatient(result, resourceType);
                          }}
                        >
                          <AddIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  )}
                </ListItem>
              ))}
              
              <Divider />
            </Box>
          );
        })}
      </Paper>
    );
  };

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      <Autocomplete
        freeSolo
        open={false} // Disable default dropdown, use custom
        inputValue={searchQuery}
        onInputChange={handleInputChange}
        options={[]} // No options needed since we're using custom dropdown
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={placeholder}
            variant="outlined"
            size={compact ? "small" : "medium"}
            fullWidth
            InputProps={{
              ...params.InputProps,
              startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
              endAdornment: loading ? (
                <CircularProgress size={20} />
              ) : searchQuery && (
                <IconButton
                  size="small"
                  onClick={() => {
                    setSearchQuery('');
                    setShowResults(false);
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              ),
            }}
          />
        )}
      />
      
      {showResults && renderSearchResults()}
      
      {/* Add to Patient Confirmation Dialog */}
      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)}>
        <DialogTitle>Add to Patient Record</DialogTitle>
        <DialogContent>
          {selectedResult && (
            <Box>
              <Typography variant="body1" gutterBottom>
                Are you sure you want to add this {RESOURCE_TYPES[selectedResult.resourceType]?.label.toLowerCase().slice(0, -1)} to the patient record?
              </Typography>
              <Paper sx={{ p: 2, mt: 2, backgroundColor: 'grey.50' }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  {React.createElement(
                    RESOURCE_TYPES[selectedResult.resourceType]?.icon || SearchIcon,
                    { fontSize: 'small', color: RESOURCE_TYPES[selectedResult.resourceType]?.color || 'action' }
                  )}
                  <Typography variant="subtitle1">
                    {selectedResult.display || selectedResult.name}
                  </Typography>
                </Stack>
                {selectedResult.code && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Code: {selectedResult.code}
                  </Typography>
                )}
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddDialog(false)}>Cancel</Button>
          <Button onClick={handleConfirmAdd} variant="contained">
            Add to Patient
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UniversalSearchBar;