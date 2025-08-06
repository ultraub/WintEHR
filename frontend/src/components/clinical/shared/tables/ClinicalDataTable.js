/**
 * ClinicalDataTable Component
 * Enhanced data table with clinical context awareness and smart formatting
 */
import React, { useState, useMemo } from 'react';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  TablePagination,
  Paper,
  Box,
  Typography,
  IconButton,
  Chip,
  Tooltip,
  useTheme,
  alpha,
  Skeleton
} from '@mui/material';
import {
  Sort as SortIcon,
  FilterList as FilterIcon,
  Visibility as ViewIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon
} from '@mui/icons-material';
import { 
  getClinicalContext, 
  getSeverityColor, 
  getClinicalTypography,
  getClinicalSpacing,
  getBorderRadius,
  getElevationShadow,
  getSmoothTransition,
  getHoverEffect
} from '../../../../themes/clinicalThemeUtils';
import { clinicalTokens } from '../../../../themes/clinicalTheme';
import StatusChip from '../display/StatusChip';

const ClinicalDataTable = ({
  data = [],
  columns = [],
  loading = false,
  department,
  clinicalContext,
  showSeverityIndicators = true,
  showStatusChips = true,
  showTrendIndicators = true,
  urgency = 'normal',
  onRowClick,
  onRowAction,
  sortable = true,
  filterable = true,
  pagination = true,
  dense = false,
  stickyHeader = false,
  ...props
}) => {
  const theme = useTheme();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  
  // Get clinical context
  const context = clinicalContext || getClinicalContext(
    window.location.pathname,
    new Date().getHours(),
    department
  );
  
  // Enhanced context with urgency
  const enhancedContext = {
    ...context,
    urgency
  };
  
  // Get clinical styling
  const spacing = getClinicalSpacing(theme, enhancedContext, dense ? 'compact' : 'comfortable');
  const dataTypography = getClinicalTypography(theme, 'data');
  const labelTypography = getClinicalTypography(theme, 'label');
  
  // Get department-specific colors
  const departmentColor = theme.clinical?.departments?.[department]?.primary || theme.palette.primary.main;
  
  // Sorting logic
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return data;
    
    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);
  
  // Pagination logic
  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    
    const startIndex = page * rowsPerPage;
    return sortedData.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedData, page, rowsPerPage, pagination]);
  
  // Handle sorting
  const handleSort = (columnKey) => {
    if (!sortable) return;
    
    setSortConfig(prev => ({
      key: columnKey,
      direction: prev.key === columnKey && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };
  
  // Handle pagination
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  // Get severity color for value
  const getSeverityForValue = (value, column) => {
    if (!column.severityRules) return null;
    
    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) return null;
    
    const { critical, severe, moderate, mild } = column.severityRules;
    
    if (critical && (numericValue >= critical.min && numericValue <= critical.max)) return 'critical';
    if (severe && (numericValue >= severe.min && numericValue <= severe.max)) return 'severe';
    if (moderate && (numericValue >= moderate.min && numericValue <= moderate.max)) return 'moderate';
    if (mild && (numericValue >= mild.min && numericValue <= mild.max)) return 'mild';
    
    return 'normal';
  };
  
  // Get trend indicator
  const getTrendIndicator = (value, previousValue) => {
    if (!previousValue || !showTrendIndicators) return null;
    
    const current = parseFloat(value);
    const previous = parseFloat(previousValue);
    
    if (isNaN(current) || isNaN(previous)) return null;
    
    const diff = current - previous;
    const percentChange = (diff / previous) * 100;
    
    if (Math.abs(percentChange) < 1) return null; // No significant change
    
    const isUp = diff > 0;
    const color = isUp ? theme.palette.success.main : theme.palette.error.main;
    
    return (
      <Tooltip title={`${isUp ? '+' : ''}${diff.toFixed(2)} (${percentChange.toFixed(1)}%)`}>
        <Box sx={{ display: 'flex', alignItems: 'center', ml: 0.5 }}>
          {isUp ? (
            <TrendingUpIcon sx={{ fontSize: 16, color }} />
          ) : (
            <TrendingDownIcon sx={{ fontSize: 16, color }} />
          )}
        </Box>
      </Tooltip>
    );
  };
  
  // Render cell content
  const renderCellContent = (row, column) => {
    const value = row[column.key];
    
    if (loading) {
      return <Skeleton variant="text" width="100%" />;
    }
    
    if (column.type === 'status' && showStatusChips) {
      return (
        <StatusChip
          status={value}
          variant="clinical"
          size="small"
          department={department}
          urgency={urgency}
        />
      );
    }
    
    if (column.type === 'severity' && showSeverityIndicators) {
      const severity = getSeverityForValue(value, column);
      const severityColor = getSeverityColor(theme, severity, enhancedContext);
      
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography
            variant="body2"
            sx={{
              ...dataTypography,
              color: severityColor,
              fontWeight: severity && ['severe', 'critical'].includes(severity) ? 700 : 400
            }}
          >
            {value}
          </Typography>
          {severity && ['severe', 'critical'].includes(severity) && (
            <WarningIcon sx={{ fontSize: 16, color: severityColor }} />
          )}
          {column.unit && (
            <Typography variant="caption" color="text.secondary">
              {column.unit}
            </Typography>
          )}
          {getTrendIndicator(value, row[`${column.key}_previous`])}
        </Box>
      );
    }
    
    if (column.type === 'date') {
      return (
        <Typography variant="body2" sx={dataTypography}>
          {value ? new Date(value).toLocaleDateString() : '-'}
        </Typography>
      );
    }
    
    if (column.type === 'action') {
      return (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={() => onRowAction?.(row, 'view')}
            sx={{ color: departmentColor }}
          >
            <ViewIcon fontSize="small" />
          </IconButton>
          {column.actions?.map((action, index) => (
            <IconButton
              key={`action-${action.type}-${index}`}
              size="small"
              onClick={() => onRowAction?.(row, action.type)}
              sx={{ color: action.color || theme.palette.text.secondary }}
            >
              {action.icon}
            </IconButton>
          ))}
        </Box>
      );
    }
    
    return (
      <Typography variant="body2" sx={dataTypography}>
        {value || '-'}
      </Typography>
    );
  };
  
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: getBorderRadius('lg'),
        boxShadow: getElevationShadow(2),
        background: theme.palette.mode === 'dark' 
          ? theme.palette.background.paper
          : clinicalTokens.gradients?.backgroundCard || theme.palette.background.paper,
        overflow: 'hidden',
        position: 'relative',
        ...getSmoothTransition(['all'])
      }}
    >
      <TableContainer sx={{ 
        maxHeight: stickyHeader ? 400 : 'none',
        '&::-webkit-scrollbar': {
          width: 8,
          height: 8
        },
        '&::-webkit-scrollbar-track': {
          background: theme.palette.mode === 'dark'
            ? alpha(theme.palette.background.paper, 0.2)
            : alpha(theme.palette.background.default, 0.1)
        },
        '&::-webkit-scrollbar-thumb': {
          background: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.4 : 0.2),
          borderRadius: 4,
          '&:hover': {
            background: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.6 : 0.3)
          }
        }
      }}>
        <Table 
          stickyHeader={stickyHeader}
          size={dense ? 'small' : 'medium'}
          {...props}
        >
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  align={column.align || 'left'}
                  sx={{
                    background: theme.palette.mode === 'dark'
                      ? `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.85)} 100%)`
                      : `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.default, 0.9)} 100%)`,
                    borderBottom: `2px solid ${alpha(departmentColor, theme.palette.mode === 'dark' ? 0.3 : 0.2)}`,
                    position: stickyHeader ? 'sticky' : 'static',
                    top: 0,
                    zIndex: 1,
                    fontWeight: 600,
                    backdropFilter: 'blur(8px)',
                    boxShadow: stickyHeader 
                      ? `0 2px 4px ${alpha(theme.palette.mode === 'dark' ? theme.palette.common.white : theme.palette.common.black, 0.1)}` 
                      : 'none'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="subtitle2" sx={labelTypography}>
                      {column.label}
                    </Typography>
                    {sortable && column.sortable !== false && (
                      <IconButton
                        size="small"
                        onClick={() => handleSort(column.key)}
                        sx={{
                          color: sortConfig.key === column.key ? departmentColor : 'text.secondary',
                          transform: sortConfig.key === column.key && sortConfig.direction === 'desc' 
                            ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.2s ease'
                        }}
                      >
                        <SortIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedData.map((row, rowIndex) => (
              <TableRow
                key={row.id || rowIndex}
                hover
                onClick={() => onRowClick?.(row)}
                sx={{
                  cursor: onRowClick ? 'pointer' : 'default',
                  // Zebra striping
                  backgroundColor: rowIndex % 2 === 0 
                    ? 'transparent' 
                    : alpha(
                        theme.palette.mode === 'dark' 
                          ? theme.palette.background.paper 
                          : theme.palette.background.default, 
                        theme.palette.mode === 'dark' ? 0.5 : 0.3
                      ),
                  // Enhanced hover effect
                  '&:hover': {
                    backgroundColor: alpha(departmentColor, theme.palette.mode === 'dark' ? 0.15 : 0.08),
                    transform: 'translateY(-1px)',
                    boxShadow: `0 2px 8px ${alpha(
                      theme.palette.mode === 'dark' ? theme.palette.common.white : theme.palette.common.black, 
                      0.05
                    )}`,
                    '& td': {
                      backgroundColor: 'transparent'
                    }
                  },
                  // Smooth transitions
                  ...getSmoothTransition(['all']),
                  // Add urgency styling
                  ...(urgency === 'urgent' && {
                    borderLeft: `4px solid ${theme.palette.error.main}`,
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 4,
                      background: `linear-gradient(180deg, ${theme.palette.error.main} 0%, ${alpha(theme.palette.error.main, 0.6)} 100%)`,
                      animation: 'pulse 2s infinite'
                    }
                  })
                }}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    align={column.align || 'left'}
                    sx={{
                      py: spacing / 4,
                      px: spacing / 2,
                      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                      position: 'relative',
                      // Visual grouping for related columns
                      ...(column.group && {
                        borderRight: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                      })
                    }}
                  >
                    {renderCellContent(row, column)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {loading && (
              Array.from({ length: rowsPerPage }, (_, index) => (
                <TableRow key={`loading-${index}`}>
                  {columns.map((column) => (
                    <TableCell key={column.key}>
                      <Skeleton variant="text" width="100%" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      {pagination && (
        <TablePagination
          component="div"
          count={data.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          sx={{
            borderTop: `2px solid ${alpha(departmentColor, 0.1)}`,
            background: `linear-gradient(180deg, ${alpha(theme.palette.background.default, 0.5)} 0%, ${alpha(theme.palette.background.paper, 0.5)} 100%)`,
            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
              fontWeight: 500
            },
            '& .MuiTablePagination-select': {
              borderRadius: getBorderRadius('sm'),
              backgroundColor: alpha(theme.palette.background.paper, 0.8)
            }
          }}
        />
      )}
    </Paper>
  );
};

export default ClinicalDataTable;