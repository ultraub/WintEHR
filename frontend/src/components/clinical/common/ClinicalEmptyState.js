/**
 * ClinicalEmptyState Component
 * Consistent empty state displays for clinical workspace
 */

import React from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  useTheme,
  alpha
} from '@mui/material';
import {
  Assignment as ProblemIcon,
  Medication as MedicationIcon,
  Warning as AllergyIcon,
  Science as LabIcon,
  Image as ImagingIcon,
  LocalHospital as OrderIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Add as AddIcon
} from '@mui/icons-material';

const ClinicalEmptyState = ({
  type = 'empty',
  dataType,
  title,
  message,
  icon,
  action,
  actionLabel,
  actionIcon,
  searchTerm,
  hasActiveFilters = false,
  onClearFilters,
  onClearSearch,
  sx = {},
  ...props
}) => {
  const theme = useTheme();

  // Get default icon based on data type
  const getDefaultIcon = () => {
    const icons = {
      problem: <ProblemIcon sx={{ fontSize: 48 }} />,
      medication: <MedicationIcon sx={{ fontSize: 48 }} />,
      allergy: <AllergyIcon sx={{ fontSize: 48 }} />,
      lab: <LabIcon sx={{ fontSize: 48 }} />,
      imaging: <ImagingIcon sx={{ fontSize: 48 }} />,
      order: <OrderIcon sx={{ fontSize: 48 }} />,
      search: <SearchIcon sx={{ fontSize: 48 }} />,
      filter: <FilterIcon sx={{ fontSize: 48 }} />
    };
    
    if (type === 'no-results' && (searchTerm || hasActiveFilters)) {
      return icons.search;
    }
    
    return icons[dataType] || icons.problem;
  };

  // Get default messages
  const getDefaultTitle = () => {
    if (type === 'no-results') {
      if (searchTerm) {
        return `No results for "${searchTerm}"`;
      }
      if (hasActiveFilters) {
        return 'No results match your filters';
      }
      return 'No results found';
    }

    const titles = {
      problem: 'No problems found',
      medication: 'No medications found',
      allergy: 'No allergies recorded',
      lab: 'No lab results available',
      imaging: 'No imaging studies found',
      order: 'No orders found'
    };

    return titles[dataType] || 'No data available';
  };

  const getDefaultMessage = () => {
    if (type === 'no-results') {
      if (searchTerm && hasActiveFilters) {
        return 'Try adjusting your search criteria or clearing filters';
      }
      if (searchTerm) {
        return 'Try different search terms or check your spelling';
      }
      if (hasActiveFilters) {
        return 'Try adjusting or clearing your filters';
      }
      return 'Try adjusting your search criteria';
    }

    const messages = {
      problem: 'Add problems to track patient conditions',
      medication: 'Prescribe medications to manage patient care',
      allergy: 'Document allergies for patient safety',
      lab: 'Order lab tests to monitor patient health',
      imaging: 'Request imaging studies for diagnosis',
      order: 'Create orders for patient care'
    };

    return messages[dataType] || 'Start by adding new items';
  };

  const getDefaultActionLabel = () => {
    if (type === 'no-results') {
      return null;
    }

    const labels = {
      problem: 'Add Problem',
      medication: 'Prescribe Medication',
      allergy: 'Add Allergy',
      lab: 'Order Lab Test',
      imaging: 'Order Imaging',
      order: 'Create Order'
    };

    return labels[dataType] || 'Add Item';
  };

  // Resolve display values
  const displayIcon = icon || getDefaultIcon();
  const displayTitle = title || getDefaultTitle();
  const displayMessage = message || getDefaultMessage();
  const displayActionLabel = actionLabel || getDefaultActionLabel();
  const displayActionIcon = actionIcon || <AddIcon />;

  return (
    <Box
      sx={{
        py: 6,
        px: 3,
        textAlign: 'center',
        ...sx
      }}
      {...props}
    >
      <Box
        sx={{
          color: alpha(theme.palette.text.secondary, 0.3),
          mb: 2
        }}
      >
        {displayIcon}
      </Box>

      <Typography variant="h6" color="text.secondary" gutterBottom>
        {displayTitle}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {displayMessage}
      </Typography>

      <Stack direction="row" spacing={2} justifyContent="center">
        {/* Clear search button */}
        {type === 'no-results' && searchTerm && onClearSearch && (
          <Button
            variant="outlined"
            size="small"
            onClick={onClearSearch}
          >
            Clear Search
          </Button>
        )}

        {/* Clear filters button */}
        {type === 'no-results' && hasActiveFilters && onClearFilters && (
          <Button
            variant="outlined"
            size="small"
            onClick={onClearFilters}
          >
            Clear Filters
          </Button>
        )}

        {/* Primary action button */}
        {type === 'empty' && action && displayActionLabel && (
          <Button
            variant="contained"
            size="small"
            startIcon={displayActionIcon}
            onClick={action}
          >
            {displayActionLabel}
          </Button>
        )}
      </Stack>
    </Box>
  );
};

export default ClinicalEmptyState;