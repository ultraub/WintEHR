/**
 * ClinicalList Component
 * A flexible, density-aware list component for clinical data
 * Supports compact/comfortable/spacious modes with inline actions
 */
import React, { useState, useMemo } from 'react';
import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Box,
  Typography,
  Chip,
  Stack,
  Tooltip,
  useTheme,
  alpha,
  Collapse,
  Button,
  Skeleton
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  TrendingUp as TrendUpIcon,
  TrendingDown as TrendDownIcon,
  FiberManualRecord as StatusIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import TrendSparkline from './TrendSparkline';

// Density configurations
const DENSITY_CONFIG = {
  compact: {
    padding: 0.5,
    fontSize: '0.875rem',
    rowHeight: 40,
    showSecondary: false,
    inlineActions: true
  },
  comfortable: {
    padding: 1,
    fontSize: '0.9375rem',
    rowHeight: 56,
    showSecondary: true,
    inlineActions: true
  },
  spacious: {
    padding: 2,
    fontSize: '1rem',
    rowHeight: 72,
    showSecondary: true,
    inlineActions: false
  }
};

// Severity color mapping
const SEVERITY_COLORS = {
  critical: { bg: '#FFEBEE', color: '#D32F2F', priority: 4 },
  high: { bg: '#FFF3E0', color: '#F57C00', priority: 3 },
  moderate: { bg: '#FFF8E1', color: '#FBC02D', priority: 2 },
  low: { bg: '#E8F5E9', color: '#388E3C', priority: 1 },
  normal: { bg: 'transparent', color: '#616161', priority: 0 }
};

// Clinical List Item Component
export const ClinicalListItem = ({
  primary,
  secondary,
  icon,
  severity = 'normal',
  status,
  trend,
  trendData,
  actions = [],
  expandable = false,
  expandedContent,
  density = 'comfortable',
  onClick,
  selected = false,
  loading = false,
  customContent
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const config = DENSITY_CONFIG[density];
  const severityStyle = SEVERITY_COLORS[severity];

  const handleExpandClick = (e) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  if (loading) {
    return (
      <ListItem sx={{ py: config.padding }}>
        <ListItemIcon>
          <Skeleton variant="circular" width={24} height={24} />
        </ListItemIcon>
        <ListItemText
          primary={<Skeleton width="60%" />}
          secondary={config.showSecondary && <Skeleton width="40%" />}
        />
      </ListItem>
    );
  }

  return (
    <>
      <ListItem
        button={!!onClick}
        onClick={onClick}
        selected={selected}
        sx={{
          py: config.padding,
          minHeight: config.rowHeight,
          backgroundColor: severityStyle.bg,
          borderLeft: severity !== 'normal' ? `4px solid ${severityStyle.color}` : 'none',
          '&:hover': {
            backgroundColor: alpha(theme.palette.action.hover, 0.08),
            '& .inline-actions': {
              opacity: 1
            }
          },
          transition: 'all 0.2s ease'
        }}
      >
        {icon && (
          <ListItemIcon sx={{ minWidth: density === 'compact' ? 36 : 48 }}>
            {icon}
          </ListItemIcon>
        )}

        <ListItemText
          primary={
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography
                variant="body2"
                sx={{ 
                  fontSize: config.fontSize,
                  fontWeight: severity !== 'normal' ? 600 : 400
                }}
              >
                {primary}
              </Typography>
              {status && (
                <Chip
                  label={status}
                  size="small"
                  sx={{ 
                    height: density === 'compact' ? 18 : 22,
                    fontSize: density === 'compact' ? '0.75rem' : '0.8125rem'
                  }}
                />
              )}
              {trend && (
                trend === 'up' ? 
                  <TrendUpIcon sx={{ fontSize: 16, color: 'error.main' }} /> :
                  <TrendDownIcon sx={{ fontSize: 16, color: 'success.main' }} />
              )}
              {trendData && (
                <TrendSparkline
                  data={trendData}
                  width={60}
                  height={20}
                  showLastValue={false}
                />
              )}
            </Stack>
          }
          secondary={config.showSecondary && secondary}
          secondaryTypographyProps={{
            sx: { fontSize: '0.8125rem' }
          }}
        />

        {customContent && (
          <Box sx={{ flex: 1, mx: 2 }}>
            {customContent}
          </Box>
        )}

        <ListItemSecondaryAction>
          <Stack 
            direction="row" 
            spacing={0.5}
            className="inline-actions"
            sx={{
              opacity: config.inlineActions ? 0 : 1,
              transition: 'opacity 0.2s'
            }}
          >
            {actions.map((action, index) => (
              <Tooltip key={index} title={action.label}>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick();
                  }}
                  sx={{ 
                    padding: density === 'compact' ? 0.5 : 1,
                    color: action.color || 'inherit'
                  }}
                >
                  {action.icon}
                </IconButton>
              </Tooltip>
            ))}
            {expandable && (
              <IconButton
                size="small"
                onClick={handleExpandClick}
                sx={{ 
                  padding: density === 'compact' ? 0.5 : 1,
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s'
                }}
              >
                <ExpandIcon />
              </IconButton>
            )}
          </Stack>
        </ListItemSecondaryAction>
      </ListItem>

      {expandable && (
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box
            sx={{
              px: config.padding * 4,
              py: config.padding * 2,
              backgroundColor: alpha(theme.palette.background.paper, 0.5),
              borderLeft: severity !== 'normal' ? `4px solid ${severityStyle.color}` : 'none'
            }}
          >
            {expandedContent}
          </Box>
        </Collapse>
      )}
    </>
  );
};

// Main Clinical List Component
const ClinicalList = ({
  items = [],
  density = 'comfortable',
  sortBySeverity = true,
  groupByCategory = false,
  emptyMessage = 'No items to display',
  loading = false,
  loadingCount = 3,
  onItemClick,
  selectedId,
  renderItem,
  ListHeaderComponent,
  ListFooterComponent
}) => {
  const theme = useTheme();

  // Sort items by severity if enabled
  const sortedItems = useMemo(() => {
    if (!sortBySeverity) return items;
    
    return [...items].sort((a, b) => {
      const aPriority = SEVERITY_COLORS[a.severity]?.priority || 0;
      const bPriority = SEVERITY_COLORS[b.severity]?.priority || 0;
      return bPriority - aPriority;
    });
  }, [items, sortBySeverity]);

  // Group items by category if enabled
  const groupedItems = useMemo(() => {
    if (!groupByCategory) return { ungrouped: sortedItems };
    
    return sortedItems.reduce((groups, item) => {
      const category = item.category || 'Other';
      if (!groups[category]) groups[category] = [];
      groups[category].push(item);
      return groups;
    }, {});
  }, [sortedItems, groupByCategory]);

  if (loading) {
    return (
      <List>
        {Array.from({ length: loadingCount }, (_, i) => (
          <ClinicalListItem key={i} loading density={density} />
        ))}
      </List>
    );
  }

  if (items.length === 0) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 4,
          color: 'text.secondary'
        }}
      >
        <Typography variant="body2">{emptyMessage}</Typography>
      </Box>
    );
  }

  return (
    <List sx={{ py: 0 }}>
      {ListHeaderComponent}
      
      {Object.entries(groupedItems).map(([category, categoryItems]) => (
        <React.Fragment key={category}>
          {groupByCategory && category !== 'ungrouped' && (
            <ListItem
              sx={{
                backgroundColor: alpha(theme.palette.primary.main, 0.08),
                py: 0.5
              }}
            >
              <Typography variant="overline" color="primary">
                {category} ({categoryItems.length})
              </Typography>
            </ListItem>
          )}
          
          {categoryItems.map((item) => (
            renderItem ? (
              renderItem(item, density)
            ) : (
              <ClinicalListItem
                key={item.id}
                primary={item.primary || item.name || item.title}
                secondary={item.secondary || item.description}
                icon={item.icon}
                severity={item.severity}
                status={item.status}
                trend={item.trend}
                trendData={item.trendData}
                actions={item.actions}
                expandable={item.expandable}
                expandedContent={item.expandedContent}
                density={density}
                onClick={() => onItemClick?.(item)}
                selected={selectedId === item.id}
                customContent={item.customContent}
              />
            )
          ))}
        </React.Fragment>
      ))}
      
      {ListFooterComponent}
    </List>
  );
};

export default ClinicalList;