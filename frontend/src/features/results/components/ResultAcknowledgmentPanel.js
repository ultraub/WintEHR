/**
 * Result Acknowledgment Panel
 * Tracks and displays result review status for providers
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Stack,
  Button,
  Badge,
  Tooltip,
  Divider,
  Alert,
  CircularProgress,
  Menu,
  MenuItem,
  Checkbox,
  FormControlLabel,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  CheckCircle as AcknowledgedIcon,
  RadioButtonUnchecked as UnacknowledgedIcon,
  Warning as CriticalIcon,
  TrendingUp as AbnormalIcon,
  CheckCircleOutline as NormalIcon,
  Visibility as ViewIcon,
  Done as AckIcon,
  DoneAll as AckAllIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  AccessTime as TimeIcon,
  Person as PersonIcon,
  Science as LabIcon
} from '@mui/icons-material';
import { format, formatDistanceToNow } from 'date-fns';
import { resultsManagementService } from '../../../services/resultsManagementService';
import { useFHIRResource } from '../../../contexts/FHIRResourceContext';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../contexts/ClinicalWorkflowContext';

const ResultAcknowledgmentPanel = ({ patientId, providerId, onResultSelect }) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('unacknowledged'); // all, unacknowledged, critical
  const [selectedResults, setSelectedResults] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [acknowledgingBatch, setAcknowledgingBatch] = useState(false);
  
  const { publish } = useClinicalWorkflow();
  const { currentPatient } = useFHIRResource();

  useEffect(() => {
    loadResults();
  }, [patientId, providerId, filter]);

  const loadResults = async () => {
    setLoading(true);
    try {
      const unacknowledgedResults = await resultsManagementService.getUnacknowledgedResults(
        providerId,
        patientId
      );

      // Apply filter
      let filteredResults = unacknowledgedResults;
      if (filter === 'critical') {
        filteredResults = unacknowledgedResults.filter(r => r.priority.level === 1);
      }

      // Sort by priority and date
      filteredResults.sort((a, b) => {
        if (a.priority.level !== b.priority.level) {
          return a.priority.level - b.priority.level;
        }
        return new Date(b.effectiveDateTime) - new Date(a.effectiveDateTime);
      });

      setResults(filteredResults);
    } catch (error) {
      // Handle error silently or add proper error handling here
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (result) => {
    try {
      await resultsManagementService.acknowledgeResult(
        result.id,
        providerId,
        'Result reviewed'
      );

      // Publish event
      await publish(CLINICAL_EVENTS.RESULT_ACKNOWLEDGED, {
        observationId: result.id,
        patientId,
        providerId,
        priority: result.priority.label,
        acknowledgedAt: new Date().toISOString()
      });

      // Reload results
      loadResults();
    } catch (error) {
      // Handle error silently or add proper error handling here
    }
  };

  const handleBatchAcknowledge = async () => {
    setAcknowledgingBatch(true);
    try {
      // Acknowledge all selected results
      await Promise.all(
        selectedResults.map(resultId => {
          const result = results.find(r => r.id === resultId);
          return resultsManagementService.acknowledgeResult(
            resultId,
            providerId,
            'Batch acknowledgment'
          );
        })
      );

      // Publish batch event
      await publish(CLINICAL_EVENTS.RESULTS_BATCH_ACKNOWLEDGED, {
        resultIds: selectedResults,
        patientId,
        providerId,
        count: selectedResults.length,
        acknowledgedAt: new Date().toISOString()
      });

      setSelectedResults([]);
      loadResults();
    } catch (error) {
      // Handle error silently or add proper error handling here
    } finally {
      setAcknowledgingBatch(false);
    }
  };

  const getResultIcon = (priority) => {
    switch (priority.level) {
      case 1:
        return <CriticalIcon color="error" />;
      case 2:
        return <AbnormalIcon color="warning" />;
      case 3:
        return <AbnormalIcon color="info" />;
      default:
        return <NormalIcon color="success" />;
    }
  };

  const filteredResults = results.filter(result => {
    if (!searchTerm) return true;
    
    const testName = result.code?.text || result.code?.coding?.[0]?.display || '';
    return testName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const criticalCount = results.filter(r => r.priority.level === 1).length;
  const unacknowledgedCount = results.length;

  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Result Acknowledgment</Typography>
        <Stack direction="row" spacing={1}>
          <Badge badgeContent={criticalCount} color="error">
            <Chip
              label="Critical"
              size="small"
              color={filter === 'critical' ? 'error' : 'default'}
              onClick={() => setFilter('critical')}
            />
          </Badge>
          <Badge badgeContent={unacknowledgedCount} color="warning">
            <Chip
              label="Unacknowledged"
              size="small"
              color={filter === 'unacknowledged' ? 'warning' : 'default'}
              onClick={() => setFilter('unacknowledged')}
            />
          </Badge>
          <Chip
            label="All"
            size="small"
            color={filter === 'all' ? 'primary' : 'default'}
            onClick={() => setFilter('all')}
          />
        </Stack>
      </Stack>

      {/* Search */}
      <TextField
        size="small"
        fullWidth
        placeholder="Search results..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          )
        }}
      />

      {/* Batch Actions */}
      {selectedResults.length > 0 && (
        <Alert 
          severity="info" 
          sx={{ mb: 2 }}
          action={
            <Button
              size="small"
              variant="contained"
              onClick={handleBatchAcknowledge}
              disabled={acknowledgingBatch}
              startIcon={acknowledgingBatch ? <CircularProgress size={16} /> : <AckAllIcon />}
            >
              Acknowledge {selectedResults.length} Results
            </Button>
          }
        >
          {selectedResults.length} results selected
        </Alert>
      )}

      {/* Results List */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {loading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        ) : filteredResults.length === 0 ? (
          <Alert severity="success">
            All results have been acknowledged
          </Alert>
        ) : (
          <List>
            {filteredResults.map((result, index) => {
              const testName = result.code?.text || result.code?.coding?.[0]?.display;
              const value = result.valueQuantity ? 
                `${result.valueQuantity.value} ${result.valueQuantity.unit}` : 
                result.valueString || 'No value';
              const isSelected = selectedResults.includes(result.id);

              return (
                <React.Fragment key={result.id}>
                  <ListItem
                    button
                    onClick={() => onResultSelect && onResultSelect(result)}
                    selected={isSelected}
                  >
                    <ListItemIcon>
                      <Checkbox
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (isSelected) {
                            setSelectedResults(prev => prev.filter(id => id !== result.id));
                          } else {
                            setSelectedResults(prev => [...prev, result.id]);
                          }
                        }}
                      />
                    </ListItemIcon>
                    <ListItemIcon>
                      {getResultIcon(result.priority)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2">{testName}</Typography>
                          <Chip 
                            label={result.priority.label} 
                            size="small" 
                            color={result.priority.color}
                          />
                        </Stack>
                      }
                      secondary={
                        <Stack spacing={0.5}>
                          <Typography variant="caption">
                            Result: {value}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {result.effectiveDateTime ? 
                              formatDistanceToNow(new Date(result.effectiveDateTime), { addSuffix: true }) :
                              'Unknown time'
                            }
                          </Typography>
                        </Stack>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="View Details">
                          <IconButton 
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              onResultSelect && onResultSelect(result);
                            }}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Acknowledge">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAcknowledge(result);
                            }}
                          >
                            <AckIcon />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < filteredResults.length - 1 && <Divider />}
                </React.Fragment>
              );
            })}
          </List>
        )}
      </Box>

      {/* Summary */}
      <Divider sx={{ my: 2 }} />
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="caption" color="text.secondary">
          Provider: {providerId}
        </Typography>
        <Stack direction="row" spacing={2}>
          <Typography variant="caption" color="error.main">
            {criticalCount} Critical
          </Typography>
          <Typography variant="caption" color="warning.main">
            {unacknowledgedCount} Pending
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
};

export default ResultAcknowledgmentPanel;