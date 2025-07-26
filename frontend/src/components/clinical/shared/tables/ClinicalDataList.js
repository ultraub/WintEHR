/**
 * ClinicalDataList Component
 * Base component for displaying clinical data in a list format
 */

import React, { useMemo } from 'react';
import {
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Typography,
  Box,
  IconButton,
  Chip,
  Stack,
  Tooltip,
  CircularProgress,
  Alert,
  useTheme,
  alpha,
  Skeleton
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  History as HistoryIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { useTabSearch, useExpandableList } from '../../../../hooks/clinical';
import { getStatusColor, truncateText } from '../../../../utils/clinicalHelpers';
import ClinicalEmptyState from '../ClinicalEmptyState';

const ClinicalDataList = ({
  // Data props
  items = [],
  loading = false,
  error = null,
  
  // Display props
  title,
  icon,
  emptyStateProps = {},
  maxHeight = 400,
  
  // Item rendering props
  getItemId,
  getItemPrimary,
  getItemSecondary,
  getItemIcon,
  getItemStatus,
  getItemChips = () => [],
  renderItemContent,
  
  // Interaction props
  onItemClick,
  onItemEdit,
  onItemDelete,
  onItemHistory,
  expandable = false,
  renderExpandedContent,
  
  // Search props
  searchable = true,
  searchFields = [],
  initialSearchTerm = '',
  
  // Selection props
  selectable = false,
  selectedItems = [],
  onSelectionChange,
  
  // Other props
  sx = {},
  ...props
}) => {
  const theme = useTheme();
  
  // Search functionality
  const {
    searchTerm,
    updateSearchTerm,
    searchItems,
    getHighlightedText
  } = useTabSearch(searchFields);
  
  // Expandable functionality
  const {
    expandedItems,
    toggleItem,
    isExpanded
  } = useExpandableList();
  
  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchable || !searchTerm) return items;
    return searchItems(items);
  }, [items, searchable, searchTerm, searchItems]);
  
  // Handle item selection
  const handleItemSelect = (itemId) => {
    if (!selectable || !onSelectionChange) return;
    
    const newSelection = selectedItems.includes(itemId)
      ? selectedItems.filter(id => id !== itemId)
      : [...selectedItems, itemId];
      
    onSelectionChange(newSelection);
  };
  
  // Render loading state
  if (loading) {
    return (
      <Box sx={{ p: 2, ...sx }}>
        {[1, 2, 3].map((i) => (
          <Box key={`skeleton-${i}`} sx={{ mb: 2 }}>
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="text" width="100%" height={20} />
            <Skeleton variant="text" width="80%" height={20} />
          </Box>
        ))}
      </Box>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2, ...sx }}>
        {error}
      </Alert>
    );
  }
  
  // Render empty state
  if (filteredItems.length === 0) {
    return (
      <ClinicalEmptyState
        type={searchTerm ? 'no-results' : 'empty'}
        searchTerm={searchTerm}
        {...emptyStateProps}
        sx={{ ...sx, ...emptyStateProps.sx }}
      />
    );
  }
  
  return (
    <List 
      sx={{ 
        maxHeight,
        overflow: 'auto',
        ...sx
      }}
      {...props}
    >
      {filteredItems.map((item) => {
        const itemId = getItemId ? getItemId(item) : item.id;
        const itemExpanded = isExpanded(itemId);
        const itemSelected = selectable && selectedItems.includes(itemId);
        
        return (
          <ListItem
            key={itemId}
            onClick={() => {
              if (selectable) {
                handleItemSelect(itemId);
              } else if (onItemClick) {
                onItemClick(item);
              }
            }}
            selected={itemSelected}
            sx={{
              borderRadius: theme.shape.borderRadius / 8,
              mb: 1,
              backgroundColor: itemSelected 
                ? alpha(theme.palette.primary.main, 0.08)
                : itemExpanded 
                  ? alpha(theme.palette.primary.main, 0.05) 
                  : 'transparent',
              transition: theme.transitions.create(['background-color', 'transform'], {
                duration: theme.transitions.duration.short
              }),
              cursor: onItemClick || selectable ? 'pointer' : 'default',
              '&:hover': { 
                backgroundColor: itemSelected
                  ? alpha(theme.palette.primary.main, 0.12)
                  : itemExpanded 
                    ? alpha(theme.palette.primary.main, 0.08) 
                    : 'action.hover',
                transform: 'translateY(-1px)'
              }
            }}
          >
            {/* Item Icon */}
            {getItemIcon && (
              <ListItemIcon>
                {getItemIcon(item)}
              </ListItemIcon>
            )}
            
            {/* Item Content */}
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="body1">
                    {searchable && searchTerm 
                      ? getHighlightedText(getItemPrimary(item))
                      : getItemPrimary(item)
                    }
                  </Typography>
                  
                  {/* Status Chip */}
                  {getItemStatus && (
                    <Chip
                      label={getItemStatus(item)}
                      size="small"
                      sx={{
                        backgroundColor: alpha(getStatusColor(getItemStatus(item), theme), 0.1),
                        color: getStatusColor(getItemStatus(item), theme),
                        border: `1px solid ${alpha(getStatusColor(getItemStatus(item), theme), 0.3)}`
                      }}
                    />
                  )}
                  
                  {/* Additional Chips */}
                  {getItemChips(item).map((chip, index) => (
                    <Chip
                      key={chip.label || `chip-${itemId}-${index}`}
                      {...chip}
                      size="small"
                    />
                  ))}
                </Box>
              }
              secondary={
                <>
                  {getItemSecondary && (
                    <Typography variant="body2" color="text.secondary">
                      {searchable && searchTerm 
                        ? getHighlightedText(getItemSecondary(item))
                        : getItemSecondary(item)
                      }
                    </Typography>
                  )}
                  
                  {/* Custom content */}
                  {renderItemContent && renderItemContent(item)}
                  
                  {/* Expanded content */}
                  {expandable && itemExpanded && renderExpandedContent && (
                    <Box sx={{ mt: 2 }}>
                      {renderExpandedContent(item)}
                    </Box>
                  )}
                </>
              }
              primaryTypographyProps={{ component: 'div' }}
              secondaryTypographyProps={{ component: 'div' }}
            />
            
            {/* Actions */}
            <ListItemSecondaryAction>
              <Stack direction="row" spacing={0.5}>
                {/* Edit Action */}
                {onItemEdit && (
                  <Tooltip title="Edit">
                    <IconButton 
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onItemEdit(item);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                
                {/* Delete Action */}
                {onItemDelete && (
                  <Tooltip title="Delete">
                    <IconButton 
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        onItemDelete(item);
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                
                {/* History Action */}
                {onItemHistory && (
                  <Tooltip title="View History">
                    <IconButton 
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onItemHistory(item);
                      }}
                    >
                      <HistoryIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                
                {/* Expand Action */}
                {expandable && renderExpandedContent && (
                  <IconButton 
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleItem(itemId);
                    }}
                  >
                    {itemExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                )}
              </Stack>
            </ListItemSecondaryAction>
          </ListItem>
        );
      })}
    </List>
  );
};

export default ClinicalDataList;