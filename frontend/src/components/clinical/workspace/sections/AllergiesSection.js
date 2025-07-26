/**
 * Allergies Section Component
 * Displays and manages patient's allergy list
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  Alert,
  useTheme,
  alpha
} from '@mui/material';
import {
  Warning as WarningIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  Search as SearchIcon,
  Error as CriticalIcon,
  Warning as ModerateIcon,
  Info as LowIcon,
  CheckCircle as VerifiedIcon,
  HelpOutline as UnverifiedIcon
} from '@mui/icons-material';
import { ClinicalResourceCard } from '../../shared/cards';
import { ClinicalDataList } from '../../shared/tables';
import { useTabFilters, useTabSearch } from '../../../../hooks/clinical';
import {
  getStatusColor,
  formatDate
} from '../../../../utils/clinicalHelpers';
import { 
  getResourceDisplayText,
  getCodeableConceptDisplay 
} from '../../../../core/fhir/utils/fhirFieldUtils';

const AllergiesSection = ({
  allergies = [],
  loading = false,
  error = null,
  onAdd,
  onEdit,
  onHistory,
  department
}) => {
  const theme = useTheme();
  
  // Use clinical hooks
  const {
    filters,
    setFilters
  } = useTabFilters({
    status: 'active',
    criticality: 'all'
  });
  
  const {
    searchTerm,
    setSearchTerm,
    searchItems
  } = useTabSearch(['code.text', 'code.coding.display', 'reaction.substance.text']);
  
  // Helper functions
  const getAllergyStatus = (allergy) => {
    return allergy.clinicalStatus?.coding?.[0]?.code || 'unknown';
  };
  
  const isAllergyActive = (allergy) => {
    return getAllergyStatus(allergy) === 'active';
  };
  
  const getCriticalityIcon = (criticality) => {
    switch (criticality?.toLowerCase()) {
      case 'high':
        return <CriticalIcon color="error" />;
      case 'low':
        return <LowIcon color="info" />;
      default:
        return <ModerateIcon color="warning" />;
    }
  };
  
  const getCriticalityColor = (criticality) => {
    switch (criticality?.toLowerCase()) {
      case 'high':
        return theme.palette.error.main;
      case 'low':
        return theme.palette.info.main;
      default:
        return theme.palette.warning.main;
    }
  };
  
  // Filter allergies
  const filteredAllergies = useMemo(() => {
    let result = allergies;
    
    // Apply search
    if (searchTerm) {
      result = searchItems(result);
    }
    
    // Apply filters
    if (filters.status !== 'all') {
      result = result.filter(allergy => {
        if (filters.status === 'active') return isAllergyActive(allergy);
        if (filters.status === 'inactive') return !isAllergyActive(allergy);
        return true;
      });
    }
    
    if (filters.criticality !== 'all') {
      result = result.filter(allergy => 
        allergy.criticality?.toLowerCase() === filters.criticality
      );
    }
    
    // Sort by criticality (high first) then by recorded date
    result.sort((a, b) => {
      const criticalityOrder = { high: 0, moderate: 1, low: 2 };
      const critA = criticalityOrder[a.criticality?.toLowerCase()] ?? 1;
      const critB = criticalityOrder[b.criticality?.toLowerCase()] ?? 1;
      
      if (critA !== critB) return critA - critB;
      
      const dateA = new Date(a.recordedDate || 0);
      const dateB = new Date(b.recordedDate || 0);
      return dateB - dateA;
    });
    
    return result;
  }, [allergies, searchTerm, filters, searchItems]);
  
  // Count statistics
  const activeCount = allergies.filter(a => isAllergyActive(a)).length;
  const criticalCount = allergies.filter(a => a.criticality?.toLowerCase() === 'high').length;
  
  // Critical allergies alert
  const hasCriticalAllergies = criticalCount > 0;
  
  return (
    <ClinicalResourceCard
      title="Allergies & Intolerances"
      icon={<WarningIcon />}
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
          {criticalCount > 0 && (
            <Chip 
              label={`${criticalCount} Critical`} 
              size="small" 
              color="error" 
              icon={<CriticalIcon />}
              variant={filters.criticality === 'high' ? 'filled' : 'outlined'}
              onClick={() => setFilters({ ...filters, criticality: 'high' })}
            />
          )}
          <Chip 
            label="All" 
            size="small" 
            variant={filters.status === 'all' && filters.criticality === 'all' ? 'filled' : 'outlined'}
            onClick={() => setFilters({ ...filters, status: 'all', criticality: 'all' })}
          />
        </Stack>
      }
    >
      {/* Critical Allergies Alert */}
      {hasCriticalAllergies && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          icon={<CriticalIcon />}
        >
          This patient has {criticalCount} critical {criticalCount === 1 ? 'allergy' : 'allergies'}. 
          Please review before prescribing medications.
        </Alert>
      )}
      
      {/* Search Bar */}
      <TextField
        fullWidth
        placeholder="Search allergies..."
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
      
      {/* Allergies List */}
      <ClinicalDataList
        items={filteredAllergies}
        loading={loading}
        error={error}
        emptyStateProps={{
          dataType: 'allergy',
          action: onAdd,
          searchTerm: searchTerm,
          title: allergies.length === 0 ? 'No Known Allergies' : undefined,
          message: allergies.length === 0 ? 
            'No allergies have been documented for this patient' : undefined
        }}
        getItemId={(allergy) => allergy.id}
        getItemPrimary={(allergy) => getResourceDisplayText(allergy)}
        getItemSecondary={(allergy) => {
          const parts = [];
          
          // Reactions
          const reactions = allergy.reaction?.flatMap(r => 
            r.manifestation?.map(m => getCodeableConceptDisplay(m))
          ).filter(Boolean);
          if (reactions?.length > 0) {
            parts.push(`Reactions: ${reactions.join(', ')}`);
          }
          
          // Recorded date
          if (allergy.recordedDate) {
            parts.push(`Recorded: ${formatDate(allergy.recordedDate)}`);
          }
          
          return parts.join(' • ');
        }}
        getItemIcon={(allergy) => {
          const verified = allergy.verificationStatus?.coding?.[0]?.code === 'confirmed';
          const icon = getCriticalityIcon(allergy.criticality);
          
          return (
            <Stack direction="row" spacing={0.5} alignItems="center">
              {icon}
              {verified ? (
                <Tooltip title="Verified">
                  <VerifiedIcon fontSize="small" color="success" />
                </Tooltip>
              ) : (
                <Tooltip title="Unverified">
                  <UnverifiedIcon fontSize="small" color="action" />
                </Tooltip>
              )}
            </Stack>
          );
        }}
        getItemStatus={(allergy) => getAllergyStatus(allergy)}
        getItemChips={(allergy) => {
          const chips = [];
          
          // Type chip
          if (allergy.type) {
            chips.push({
              label: allergy.type === 'allergy' ? 'Allergy' : 'Intolerance',
              size: 'small',
              variant: 'outlined'
            });
          }
          
          // Category chips
          allergy.category?.forEach(category => {
            let label = category;
            if (category === 'medication') label = 'Drug';
            if (category === 'food') label = 'Food';
            if (category === 'environment') label = 'Environmental';
            
            chips.push({
              label: label.charAt(0).toUpperCase() + label.slice(1),
              size: 'small',
              variant: 'outlined'
            });
          });
          
          // Onset chip
          if (allergy.onsetDateTime) {
            chips.push({
              label: `Since ${new Date(allergy.onsetDateTime).getFullYear()}`,
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
        renderExpandedContent={(allergy) => (
          <Box sx={{ pl: 2, pt: 1 }}>
            {/* Detailed reactions */}
            {allergy.reaction?.map((reaction, idx) => (
              <Box key={`reaction-${idx}`} sx={{ mb: 1 }}>
                <Typography variant="subtitle2">
                  Reaction {allergy.reaction.length > 1 ? idx + 1 : ''}:
                </Typography>
                <Stack spacing={0.5} sx={{ pl: 2 }}>
                  {reaction.manifestation?.map((manifestation, mIdx) => (
                    <Typography key={`manifestation-${getCodeableConceptDisplay(manifestation)}-${mIdx}`} variant="body2" color="text.secondary">
                      • {getCodeableConceptDisplay(manifestation)}
                    </Typography>
                  ))}
                  {reaction.severity && (
                    <Typography variant="body2" color="text.secondary">
                      Severity: {reaction.severity}
                    </Typography>
                  )}
                  {reaction.exposureRoute && (
                    <Typography variant="body2" color="text.secondary">
                      Exposure Route: {getCodeableConceptDisplay(reaction.exposureRoute)}
                    </Typography>
                  )}
                </Stack>
              </Box>
            ))}
            
            {/* Notes */}
            {allergy.note?.map((note, index) => (
              <Typography key={`note-${note.text?.substring(0, 20) || ''}-${index}`} variant="body2" color="text.secondary" paragraph>
                Note: {note.text}
              </Typography>
            ))}
          </Box>
        )}
      />
    </ClinicalResourceCard>
  );
};

export default AllergiesSection;