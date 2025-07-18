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
  getClinicalSpacing 
} from '../../../themes/clinicalThemeUtils';
import StatusChip from './StatusChip';

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
              key={index}
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
      elevation={1}
      sx={{
        borderRadius: theme.shape.borderRadius,
        border: `1px solid ${theme.palette.divider}`,
        overflow: 'hidden'
      }}
    >
      <TableContainer sx={{ maxHeight: stickyHeader ? 400 : 'none' }}>
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
                    backgroundColor: alpha(departmentColor, 0.05),
                    borderBottom: `2px solid ${alpha(departmentColor, 0.1)}`,
                    position: stickyHeader ? 'sticky' : 'static',
                    top: 0,
                    zIndex: 1
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
            {paginatedData.map((row, index) => (
              <TableRow
                key={row.id || index}
                hover
                onClick={() => onRowClick?.(row)}
                sx={{
                  cursor: onRowClick ? 'pointer' : 'default',
                  '&:hover': {
                    backgroundColor: alpha(departmentColor, 0.04)
                  },
                  // Add urgency styling
                  ...(urgency === 'urgent' && {
                    borderLeft: `3px solid ${theme.palette.error.main}`
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
                      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`
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
            borderTop: `1px solid ${theme.palette.divider}`,
            backgroundColor: alpha(theme.palette.background.paper, 0.8)
          }}
        />
      )}
    </Paper>
  );
};

export default ClinicalDataTable;