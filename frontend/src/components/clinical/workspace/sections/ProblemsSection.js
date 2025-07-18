/**
 * Problems Section Component
 * Displays and manages patient's problem list
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Collapse,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useTheme,
  alpha
} from '@mui/material';
import {
  Assignment as ProblemIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  Search as SearchIcon,
  ErrorOutline as SeverityIcon,
  Tune as TuneIcon,
  Sort as SortIcon,
  CheckCircle as VerifiedIcon,
  HelpOutline as UnconfirmedIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import ClinicalCard from '../../common/ClinicalCard';
import ClinicalDataList from '../../common/ClinicalDataList';
import ClinicalFilterBar from '../../common/ClinicalFilterBar';
import { useTabFilters, useTabSearch } from '../../../../hooks/clinical';
import {
  getStatusColor,
  getSeverityColor,
  formatDate
} from '../../../../utils/clinicalHelpers';
import { 
  getConditionStatus, 
  isConditionActive, 
  getResourceDisplayText, 
  getCodeableConceptDisplay, 
  FHIR_STATUS_VALUES 
} from '../../../../core/fhir/utils/fhirFieldUtils';

const ProblemsSection = ({
  conditions = [],
  loading = false,
  error = null,
  onAdd,
  onEdit,
  onHistory,
  department
}) => {
  const theme = useTheme();
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Use clinical hooks
  const {
    filters,
    setFilters,
    applyFilters
  } = useTabFilters({
    status: 'all',
    severity: 'all',
    verification: 'all',
    dateRange: null
  });
  
  const {
    searchTerm,
    setSearchTerm,
    searchItems
  } = useTabSearch(['code.text', 'code.coding.display']);
  
  // Helper functions
  const getSeverityLevel = (severity) => {
    if (!severity) return 'unknown';
    const display = getCodeableConceptDisplay(severity).toLowerCase();
    if (display.includes('severe') || display.includes('high')) return 'severe';
    if (display.includes('moderate') || display.includes('medium')) return 'moderate';
    if (display.includes('mild') || display.includes('low')) return 'mild';
    return 'unknown';
  };
  
  const getVerificationStatus = (condition) => {
    const status = condition.verificationStatus?.coding?.[0]?.code;
    return status || 'unconfirmed';
  };
  
  // Filter and sort conditions
  const filteredConditions = useMemo(() => {
    let result = conditions;
    
    // Apply search
    if (searchTerm) {
      result = searchItems(result);
    }
    
    // Apply filters
    result = applyFilters(result, {
      status: (condition) => {
        if (filters.status === 'all') return true;
        const status = getConditionStatus(condition);
        if (filters.status === 'active') return status === FHIR_STATUS_VALUES.CONDITION.ACTIVE;
        if (filters.status === 'resolved') return status === FHIR_STATUS_VALUES.CONDITION.RESOLVED;
        return false;
      },
      severity: (condition) => {
        if (filters.severity === 'all') return true;
        return getSeverityLevel(condition.severity) === filters.severity;
      },
      verification: (condition) => {
        if (filters.verification === 'all') return true;
        return getVerificationStatus(condition) === filters.verification;
      },
      dateRange: (condition) => {
        if (!filters.dateRange?.start && !filters.dateRange?.end) return true;
        const onsetDate = condition.onsetDateTime || condition.onsetPeriod?.start;
        if (!onsetDate) return false;
        const date = new Date(onsetDate);
        
        if (filters.dateRange.start && date < new Date(filters.dateRange.start)) return false;
        if (filters.dateRange.end && date > new Date(filters.dateRange.end)) return false;
        return true;
      }
    });
    
    // Sort by severity if enabled
    if (filters.sortBySeverity) {
      result.sort((a, b) => {
        const severityOrder = { severe: 0, moderate: 1, mild: 2, unknown: 3 };
        const severityA = severityOrder[getSeverityLevel(a.severity)] || 3;
        const severityB = severityOrder[getSeverityLevel(b.severity)] || 3;
        return severityA - severityB;
      });
    } else {
      // Default sort by onset date (most recent first)
      result.sort((a, b) => {
        const dateA = new Date(a.onsetDateTime || a.onsetPeriod?.start || 0);
        const dateB = new Date(b.onsetDateTime || b.onsetPeriod?.start || 0);
        return dateB - dateA;
      });
    }
    
    return result;
  }, [conditions, searchTerm, filters, searchItems, applyFilters]);
  
  // Count statistics
  const activeCount = conditions.filter(c => isConditionActive(c)).length;
  const resolvedCount = conditions.filter(c => 
    getConditionStatus(c) === FHIR_STATUS_VALUES.CONDITION.RESOLVED
  ).length;
  
  return (
    <ClinicalCard
      title="Problem List"
      icon={<ProblemIcon />}
      department={department}
      variant="clinical"
      expandable={false}
      subtitle={
        <Stack direction="row" spacing={1}>
          <Chip 
            label={`${activeCount} Active`} 
            size="small" 
            color="primary" 
            variant={filters.status === 'active' ? 'filled' : 'outlined'}
            onClick={() => setFilters({ ...filters, status: 'active' })}
          />
          <Chip 
            label={`${resolvedCount} Resolved`} 
            size="small" 
            variant={filters.status === 'resolved' ? 'filled' : 'outlined'}
            onClick={() => setFilters({ ...filters, status: 'resolved' })}
          />
          <Chip 
            label="All" 
            size="small" 
            variant={filters.status === 'all' ? 'filled' : 'outlined'}
            onClick={() => setFilters({ ...filters, status: 'all' })}
          />
        </Stack>
      }
      actions={
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Advanced Filters">
            <IconButton 
              size="small" 
              color={showAdvancedFilters ? "primary" : "default"}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              <TuneIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Sort by Severity">
            <IconButton 
              size="small"
              color={filters.sortBySeverity ? "primary" : "default"}
              onClick={() => setFilters({ ...filters, sortBySeverity: !filters.sortBySeverity })}
            >
              <SortIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      }
    >
      {/* Search Bar */}
      <TextField
        fullWidth
        placeholder="Search problems..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        size="small"
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          )
        }}
      />
      
      {/* Advanced Filters */}
      <Collapse in={showAdvancedFilters}>
        <ClinicalFilterBar
          filters={filters}
          onFilterChange={setFilters}
          availableFilters={['severity', 'verification', 'dateRange']}
          filterOptions={{
            severity: [
              { value: 'all', label: 'All Severities' },
              { value: 'severe', label: 'Severe' },
              { value: 'moderate', label: 'Moderate' },
              { value: 'mild', label: 'Mild' }
            ],
            verification: [
              { value: 'all', label: 'All Statuses' },
              { value: 'confirmed', label: 'Confirmed' },
              { value: 'provisional', label: 'Provisional' },
              { value: 'differential', label: 'Differential' },
              { value: 'unconfirmed', label: 'Unconfirmed' }
            ]
          }}
          sx={{ mb: 2 }}
        />
      </Collapse>
      
      {/* Problems List */}
      <ClinicalDataList
        items={filteredConditions}
        loading={loading}
        error={error}
        emptyStateProps={{
          dataType: 'problem',
          action: onAdd,
          searchTerm: searchTerm
        }}
        getItemId={(condition) => condition.id}
        getItemPrimary={(condition) => getResourceDisplayText(condition)}
        getItemSecondary={(condition) => {
          const parts = [];
          if (condition.onsetDateTime) {
            parts.push(`Onset: ${formatDate(condition.onsetDateTime)}`);
          }
          if (condition.recorder?.display) {
            parts.push(`Recorded by: ${condition.recorder.display}`);
          }
          return parts.join(' • ');
        }}
        getItemIcon={(condition) => {
          const verified = getVerificationStatus(condition) === 'confirmed';
          return verified ? (
            <Tooltip title="Verified">
              <VerifiedIcon color="success" />
            </Tooltip>
          ) : (
            <Tooltip title="Unconfirmed">
              <UnconfirmedIcon color="action" />
            </Tooltip>
          );
        }}
        getItemStatus={(condition) => getConditionStatus(condition)}
        getItemChips={(condition) => {
          const chips = [];
          
          // Severity chip
          if (condition.severity) {
            const severity = getSeverityLevel(condition.severity);
            chips.push({
              label: severity.charAt(0).toUpperCase() + severity.slice(1),
              size: 'small',
              icon: <SeverityIcon />,
              sx: {
                backgroundColor: alpha(getSeverityColor(severity, theme), 0.1),
                color: getSeverityColor(severity, theme),
                border: `1px solid ${alpha(getSeverityColor(severity, theme), 0.3)}`
              }
            });
          }
          
          // Verification chip
          const verification = getVerificationStatus(condition);
          if (verification !== 'confirmed') {
            chips.push({
              label: verification.charAt(0).toUpperCase() + verification.slice(1),
              size: 'small',
              variant: 'outlined'
            });
          }
          
          return chips;
        }}
        onItemClick={onEdit}
        onItemEdit={onEdit}
        onItemHistory={onHistory}
        expandable={true}
        renderExpandedContent={(condition) => (
          <Box sx={{ pl: 2, pt: 1 }}>
            {condition.note?.map((note, index) => (
              <Typography key={`note-${note.text?.substring(0, 20) || ''}-${index}`} variant="body2" color="text.secondary" paragraph>
                {note.text}
              </Typography>
            ))}
            {condition.evidence?.map((evidence, index) => (
              <Typography key={`evidence-${evidence.detail?.[0]?.display?.substring(0, 20) || ''}-${index}`} variant="body2" color="text.secondary">
                Evidence: {evidence.detail?.[0]?.display || 'Not specified'}
              </Typography>
            ))}
          </Box>
        )}
      />
    </ClinicalCard>
  );
};

export default ProblemsSection;