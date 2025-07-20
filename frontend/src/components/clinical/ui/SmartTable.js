import React, { useState, useMemo, memo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Paper,
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Stack,
  Checkbox,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
  Toolbar,
  alpha,
  useTheme,
  Skeleton,
  LinearProgress,
  Badge
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterListIcon,
  GetApp as DownloadIcon,
  Print as PrintIcon,
  MoreVert as MoreVertIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { visuallyHidden } from '@mui/utils';
import TrendSparkline from './TrendSparkline';
import { severity as severityTokens, getClinicalStatusStyles } from '../../../themes/clinicalTheme';

// Status icon mapping
const statusIcons = {
  normal: <CheckCircleIcon fontSize="small" color="success" />,
  abnormal: <WarningIcon fontSize="small" color="warning" />,
  critical: <ErrorIcon fontSize="small" color="error" />,
  pending: <InfoIcon fontSize="small" color="info" />
};

// Trend icon mapping
const trendIcons = {
  up: <TrendingUpIcon fontSize="small" color="success" />,
  down: <TrendingDownIcon fontSize="small" color="error" />,
  stable: <TrendingFlatIcon fontSize="small" color="primary" />
};

// Cell renderers for different data types
const cellRenderers = {
  status: (value, row) => {
    const icon = statusIcons[value] || statusIcons.normal;
    return (
      <Stack direction="row" alignItems="center" spacing={1}>
        {icon}
        <Typography variant="body2">{value}</Typography>
      </Stack>
    );
  },
  
  trend: (value, row) => {
    const icon = trendIcons[value] || trendIcons.stable;
    return icon;
  },
  
  sparkline: (value, row, column) => {
    if (!value || !Array.isArray(value)) return null;
    return (
      <TrendSparkline
        data={value}
        width={100}
        height={30}
        showReferenceRange={column.showReferenceRange}
        referenceRange={column.referenceRange || row.referenceRange}
        color={column.sparklineColor}
      />
    );
  },
  
  chip: (value, row, column) => {
    if (!value) return null;
    const chipConfig = column.chipConfig?.[value] || {};
    return (
      <Chip
        label={value}
        size="small"
        color={chipConfig.color || 'default'}
        variant={chipConfig.variant || 'filled'}
        sx={{ height: 20 }}
      />
    );
  },
  
  badges: (value, row) => {
    if (!value || !Array.isArray(value)) return null;
    return (
      <Stack direction="row" spacing={0.5}>
        {value.map((badge, index) => (
          <Badge
            key={index}
            badgeContent={badge.count}
            color={badge.color || 'primary'}
            max={99}
          >
            <Chip
              label={badge.label}
              size="small"
              variant="outlined"
              sx={{ height: 20 }}
            />
          </Badge>
        ))}
      </Stack>
    );
  },
  
  severity: (value, row) => {
    const severityConfig = severityTokens[value] || severityTokens.normal;
    return (
      <Chip
        label={value}
        size="small"
        sx={{
          backgroundColor: severityConfig.bg,
          color: severityConfig.color,
          borderColor: severityConfig.borderColor,
          height: 20
        }}
      />
    );
  },
  
  progress: (value, row, column) => {
    const max = column.progressMax || 100;
    const percentage = (value / max) * 100;
    const color = percentage >= 80 ? 'success' : percentage >= 50 ? 'primary' : 'warning';
    
    return (
      <Box sx={{ width: '100%', minWidth: 80 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <LinearProgress
            variant="determinate"
            value={percentage}
            color={color}
            sx={{ flex: 1, height: 6, borderRadius: 3 }}
          />
          <Typography variant="caption" sx={{ minWidth: 35 }}>
            {value}/{max}
          </Typography>
        </Stack>
      </Box>
    );
  },
  
  custom: (value, row, column) => {
    if (column.renderCell) {
      return column.renderCell(value, row);
    }
    return value;
  }
};

// Enhanced table toolbar
const SmartTableToolbar = memo(({
  title,
  numSelected,
  onSearch,
  onFilter,
  onExport,
  onPrint,
  actions = []
}) => {
  const theme = useTheme();
  const [searchValue, setSearchValue] = useState('');

  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchValue(value);
    if (onSearch) {
      onSearch(value);
    }
  };

  return (
    <Toolbar
      sx={{
        pl: { sm: 2 },
        pr: { xs: 1, sm: 1 },
        ...(numSelected > 0 && {
          bgcolor: (theme) =>
            alpha(theme.palette.primary.main, theme.palette.action.activatedOpacity),
        }),
      }}
    >
      {numSelected > 0 ? (
        <Typography
          sx={{ flex: '1 1 100%' }}
          color="inherit"
          variant="subtitle1"
          component="div"
        >
          {numSelected} selected
        </Typography>
      ) : (
        <>
          <Typography
            sx={{ flex: '1 1 100%' }}
            variant="h6"
            id="tableTitle"
            component="div"
          >
            {title}
          </Typography>
          
          <TextField
            size="small"
            placeholder="Search..."
            value={searchValue}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ mr: 2, width: 250 }}
          />
        </>
      )}

      <Stack direction="row" spacing={1}>
        {actions.map((action, index) => (
          <Tooltip key={index} title={action.tooltip}>
            <IconButton onClick={action.onClick}>
              {action.icon}
            </IconButton>
          </Tooltip>
        ))}
        
        {onFilter && (
          <Tooltip title="Filter">
            <IconButton onClick={onFilter}>
              <FilterListIcon />
            </IconButton>
          </Tooltip>
        )}
        
        {onExport && (
          <Tooltip title="Export">
            <IconButton onClick={onExport}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        )}
        
        {onPrint && (
          <Tooltip title="Print">
            <IconButton onClick={onPrint}>
              <PrintIcon />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Toolbar>
  );
});

SmartTableToolbar.displayName = 'SmartTableToolbar';

const SmartTable = memo(({
  // Data props
  data = [],
  columns = [],
  
  // Feature flags
  selectable = false,
  sortable = true,
  paginate = true,
  searchable = true,
  toolbar = true,
  dense = false,
  stickyHeader = false,
  loading = false,
  
  // Pagination props
  rowsPerPageOptions = [10, 25, 50, 100],
  defaultRowsPerPage = 25,
  
  // Selection props
  selected = [],
  onSelectionChange,
  
  // Event handlers
  onRowClick,
  onCellClick,
  onSearch,
  onFilter,
  onExport,
  onPrint,
  
  // Styling
  maxHeight = 600,
  toolbarActions = [],
  title = '',
  emptyMessage = 'No data available',
  sx = {},
  
  ...otherProps
}) => {
  const theme = useTheme();
  const [order, setOrder] = useState('asc');
  const [orderBy, setOrderBy] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);
  const [internalSelected, setInternalSelected] = useState(selected);
  const [searchTerm, setSearchTerm] = useState('');
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [contextRow, setContextRow] = useState(null);

  // Use external selected if provided, otherwise use internal state
  const selectedRows = onSelectionChange ? selected : internalSelected;
  const setSelectedRows = onSelectionChange ? onSelectionChange : setInternalSelected;

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    
    return data.filter(row => {
      return columns.some(column => {
        const value = row[column.field];
        if (value == null) return false;
        return String(value).toLowerCase().includes(searchTerm.toLowerCase());
      });
    });
  }, [data, columns, searchTerm]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!orderBy) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      const aValue = a[orderBy];
      const bValue = b[orderBy];
      
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      
      if (order === 'desc') {
        return bValue > aValue ? 1 : -1;
      }
      return aValue > bValue ? 1 : -1;
    });
  }, [filteredData, order, orderBy]);

  // Paginate data
  const paginatedData = paginate
    ? sortedData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
    : sortedData;

  // Handlers
  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      const newSelected = paginatedData.map((row, index) => 
        row.id || index
      );
      setSelectedRows(newSelected);
      return;
    }
    setSelectedRows([]);
  };

  const handleRowSelect = (event, id) => {
    event.stopPropagation();
    const selectedIndex = selectedRows.indexOf(id);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selectedRows, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selectedRows.slice(1));
    } else if (selectedIndex === selectedRows.length - 1) {
      newSelected = newSelected.concat(selectedRows.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selectedRows.slice(0, selectedIndex),
        selectedRows.slice(selectedIndex + 1)
      );
    }

    setSelectedRows(newSelected);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearch = (term) => {
    setSearchTerm(term);
    setPage(0);
    if (onSearch) {
      onSearch(term);
    }
  };

  const isSelected = (id) => selectedRows.indexOf(id) !== -1;

  if (loading) {
    return (
      <Paper sx={{ width: '100%', overflow: 'hidden', ...sx }} {...otherProps}>
        {toolbar && (
          <Skeleton variant="rectangular" height={64} />
        )}
        <TableContainer sx={{ maxHeight }}>
          <Table stickyHeader={stickyHeader} size={dense ? 'small' : 'medium'}>
            <TableHead>
              <TableRow>
                {selectable && <TableCell padding="checkbox"><Skeleton /></TableCell>}
                {columns.map((column) => (
                  <TableCell key={column.field}>
                    <Skeleton />
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {[...Array(5)].map((_, index) => (
                <TableRow key={index}>
                  {selectable && <TableCell padding="checkbox"><Skeleton /></TableCell>}
                  {columns.map((column) => (
                    <TableCell key={column.field}>
                      <Skeleton />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    );
  }

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden', ...sx }} {...otherProps}>
      {toolbar && (
        <SmartTableToolbar
          title={title}
          numSelected={selectedRows.length}
          onSearch={searchable ? handleSearch : null}
          onFilter={onFilter}
          onExport={onExport}
          onPrint={onPrint}
          actions={toolbarActions}
        />
      )}
      
      <TableContainer sx={{ maxHeight }}>
        <Table stickyHeader={stickyHeader} size={dense ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox">
                  <Checkbox
                    color="primary"
                    indeterminate={selectedRows.length > 0 && selectedRows.length < paginatedData.length}
                    checked={paginatedData.length > 0 && selectedRows.length === paginatedData.length}
                    onChange={handleSelectAllClick}
                  />
                </TableCell>
              )}
              
              {columns.map((column) => (
                <TableCell
                  key={column.field}
                  align={column.align || 'left'}
                  style={{ minWidth: column.minWidth }}
                  sortDirection={orderBy === column.field ? order : false}
                >
                  {sortable && column.sortable !== false ? (
                    <TableSortLabel
                      active={orderBy === column.field}
                      direction={orderBy === column.field ? order : 'asc'}
                      onClick={() => handleRequestSort(column.field)}
                    >
                      {column.headerName}
                      {orderBy === column.field ? (
                        <Box component="span" sx={visuallyHidden}>
                          {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                        </Box>
                      ) : null}
                    </TableSortLabel>
                  ) : (
                    column.headerName
                  )}
                </TableCell>
              ))}
              
              {(onRowClick || contextRow) && (
                <TableCell align="right" width={48} />
              )}
            </TableRow>
          </TableHead>
          
          <TableBody>
            <AnimatePresence>
              {paginatedData.map((row, rowIndex) => {
                const rowId = row.id || rowIndex;
                const isItemSelected = isSelected(rowId);
                
                return (
                  <motion.tr
                    key={rowId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2, delay: rowIndex * 0.02 }}
                    component={TableRow}
                    hover
                    onClick={(event) => onRowClick && onRowClick(event, row)}
                    selected={isItemSelected}
                    sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
                  >
                    {selectable && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          color="primary"
                          checked={isItemSelected}
                          onClick={(event) => handleRowSelect(event, rowId)}
                        />
                      </TableCell>
                    )}
                    
                    {columns.map((column) => {
                      const value = row[column.field];
                      const renderer = column.type && cellRenderers[column.type];
                      
                      return (
                        <TableCell
                          key={column.field}
                          align={column.align || 'left'}
                          onClick={(event) => {
                            if (onCellClick && column.clickable !== false) {
                              onCellClick(event, value, row, column);
                            }
                          }}
                          sx={{
                            cursor: onCellClick && column.clickable !== false ? 'pointer' : 'default',
                            ...column.cellStyle
                          }}
                        >
                          {renderer ? renderer(value, row, column) : value}
                        </TableCell>
                      );
                    })}
                    
                    {(onRowClick || contextRow) && (
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            setMenuAnchor(event.currentTarget);
                            setContextRow(row);
                          }}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    )}
                  </motion.tr>
                );
              })}
              
              {paginatedData.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + (selectable ? 1 : 0) + (onRowClick ? 1 : 0)}
                    align="center"
                    sx={{ py: 8 }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {emptyMessage}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
      </TableContainer>
      
      {paginate && (
        <TablePagination
          rowsPerPageOptions={rowsPerPageOptions}
          component="div"
          count={sortedData.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      )}
      
      {/* Context menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => {
          setMenuAnchor(null);
          setContextRow(null);
        }}
      >
        <MenuItem onClick={() => {
          console.log('View details:', contextRow);
          setMenuAnchor(null);
        }}>
          View Details
        </MenuItem>
        <MenuItem onClick={() => {
          console.log('Edit:', contextRow);
          setMenuAnchor(null);
        }}>
          Edit
        </MenuItem>
        <MenuItem onClick={() => {
          console.log('Delete:', contextRow);
          setMenuAnchor(null);
        }}>
          Delete
        </MenuItem>
      </Menu>
    </Paper>
  );
});

SmartTable.displayName = 'SmartTable';

export default SmartTable;