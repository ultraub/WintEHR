/**
 * ClinicalDataGrid Component
 * Consistent data table component for clinical data display
 * Features sorting, filtering, pagination, and responsive design
 */
import React, { useState, useMemo } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Paper,
  Checkbox,
  IconButton,
  Tooltip,
  Toolbar,
  Typography,
  alpha,
  useTheme,
  Stack,
  Chip,
  Menu,
  MenuItem,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  FilterList as FilterIcon,
  GetApp as ExportIcon,
  Search as SearchIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { visuallyHidden } from '@mui/utils';
import ClinicalEmptyState from './ClinicalEmptyState';
import ClinicalLoadingState from './ClinicalLoadingState';

/**
 * Enhanced table toolbar with selection actions
 */
const EnhancedTableToolbar = ({ 
  numSelected, 
  title, 
  onExport,
  searchValue,
  onSearchChange,
  showSearch = true
}) => {
  const theme = useTheme();
  
  return (
    <Toolbar
      sx={{
        pl: { sm: 2 },
        pr: { xs: 1, sm: 1 },
        ...(numSelected > 0 && {
          bgcolor: alpha(theme.palette.primary.main, 0.08)
        })
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
        <Typography
          sx={{ flex: '1 1 100%' }}
          variant="h6"
          id="tableTitle"
          component="div"
          fontWeight={600}
        >
          {title}
        </Typography>
      )}

      <Stack direction="row" spacing={1} alignItems="center">
        {showSearch && !numSelected && (
          <TextField
            size="small"
            placeholder="Search..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: searchValue && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => onSearchChange('')}
                    edge="end"
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
              sx: { borderRadius: 0 }
            }}
            sx={{ width: 200 }}
          />
        )}
        
        {numSelected > 0 ? (
          <>
            <Tooltip title="Export selected">
              <IconButton onClick={onExport}>
                <ExportIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete selected">
              <IconButton>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </>
        ) : (
          <>
            {onExport && (
              <Tooltip title="Export all">
                <IconButton onClick={onExport}>
                  <ExportIcon />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Filter list">
              <IconButton>
                <FilterIcon />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Stack>
    </Toolbar>
  );
};

/**
 * Clinical data grid with consistent styling and features
 * @param {Object} props
 * @param {Array} props.columns - Column configuration
 * @param {Array} props.rows - Data rows
 * @param {string} props.title - Table title
 * @param {boolean} props.loading - Loading state
 * @param {string} props.error - Error message
 * @param {boolean} props.selectable - Enable row selection
 * @param {Array} props.selected - Selected row IDs
 * @param {Function} props.onSelectionChange - Selection change handler
 * @param {Function} props.onRowClick - Row click handler
 * @param {Function} props.onEdit - Edit action handler
 * @param {Function} props.onDelete - Delete action handler
 * @param {Function} props.onExport - Export handler
 * @param {Object} props.actions - Custom row actions
 * @param {boolean} props.dense - Dense padding
 * @param {number} props.rowsPerPageOptions - Pagination options
 * @param {string} props.emptyMessage - Empty state message
 * @param {string} props.idField - Field to use as row ID
 * @param {boolean} props.stickyHeader - Sticky header for scrolling
 * @param {number} props.maxHeight - Maximum table height
 */
const ClinicalDataGrid = ({
  columns = [],
  rows = [],
  title,
  loading = false,
  error,
  selectable = false,
  selected = [],
  onSelectionChange,
  onRowClick,
  onEdit,
  onDelete,
  onExport,
  actions,
  dense = false,
  rowsPerPageOptions = [10, 25, 50, 100],
  emptyMessage = 'No data available',
  idField = 'id',
  stickyHeader = true,
  maxHeight = 600,
  ...props
}) => {
  const theme = useTheme();
  const [order, setOrder] = useState('asc');
  const [orderBy, setOrderBy] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(rowsPerPageOptions[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  
  // Handle sorting
  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };
  
  // Handle selection
  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      const newSelected = rows.map((row) => row[idField]);
      onSelectionChange?.(newSelected);
      return;
    }
    onSelectionChange?.([]);
  };
  
  const handleClick = (event, id) => {
    if (!selectable) return;
    
    const selectedIndex = selected.indexOf(id);
    let newSelected = [];
    
    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selected.slice(0, selectedIndex),
        selected.slice(selectedIndex + 1)
      );
    }
    
    onSelectionChange?.(newSelected);
  };
  
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  const isSelected = (id) => selected.indexOf(id) !== -1;
  
  // Filter and sort data
  const processedRows = useMemo(() => {
    let filtered = rows;
    
    // Apply search filter
    if (searchQuery) {
      filtered = rows.filter(row => 
        columns.some(col => {
          const value = row[col.field];
          return value && value.toString().toLowerCase().includes(searchQuery.toLowerCase());
        })
      );
    }
    
    // Apply sorting
    if (orderBy) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[orderBy];
        const bVal = b[orderBy];
        
        if (order === 'desc') {
          return bVal > aVal ? 1 : -1;
        }
        return aVal > bVal ? 1 : -1;
      });
    }
    
    return filtered;
  }, [rows, searchQuery, orderBy, order, columns]);
  
  // Paginate data
  const paginatedRows = processedRows.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );
  
  // Loading state
  if (loading) {
    return <ClinicalLoadingState.Table rows={rowsPerPage} columns={columns.length} />;
  }
  
  // Error state
  if (error) {
    return (
      <ClinicalEmptyState
        title="Error loading data"
        message={error}
        severity="error"
        actions={[
          { label: 'Retry', onClick: () => window.location.reload() }
        ]}
      />
    );
  }
  
  // Empty state
  if (rows.length === 0) {
    return (
      <ClinicalEmptyState
        title={emptyMessage}
        actions={onExport ? [{ label: 'Import Data', icon: <ExportIcon /> }] : []}
      />
    );
  }
  
  return (
    <Box sx={{ width: '100%' }}>
      <Paper sx={{ width: '100%', mb: 2, borderRadius: 0 }}>
        {title && (
          <EnhancedTableToolbar
            numSelected={selected.length}
            title={title}
            onExport={onExport}
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
          />
        )}
        <TableContainer sx={{ maxHeight: stickyHeader ? maxHeight : 'none' }}>
          <Table
            sx={{ minWidth: 750 }}
            aria-labelledby="tableTitle"
            size={dense ? 'small' : 'medium'}
            stickyHeader={stickyHeader}
          >
            <TableHead>
              <TableRow>
                {selectable && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      color="primary"
                      indeterminate={selected.length > 0 && selected.length < rows.length}
                      checked={rows.length > 0 && selected.length === rows.length}
                      onChange={handleSelectAllClick}
                    />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell
                    key={column.field}
                    align={column.align || 'left'}
                    padding={column.disablePadding ? 'none' : 'normal'}
                    sortDirection={orderBy === column.field ? order : false}
                    sx={{
                      fontWeight: 600,
                      backgroundColor: theme.palette.background.paper,
                      borderBottom: `2px solid ${theme.palette.divider}`
                    }}
                  >
                    {column.sortable !== false ? (
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
                {(onEdit || onDelete || actions) && (
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedRows.map((row, index) => {
                const isItemSelected = isSelected(row[idField]);
                const labelId = `enhanced-table-checkbox-${index}`;
                
                return (
                  <TableRow
                    hover
                    onClick={(event) => onRowClick?.(event, row)}
                    role="checkbox"
                    aria-checked={isItemSelected}
                    tabIndex={-1}
                    key={row[idField]}
                    selected={isItemSelected}
                    sx={{
                      cursor: onRowClick ? 'pointer' : 'default',
                      backgroundColor: index % 2 === 1 
                        ? alpha(theme.palette.action.hover, 0.04) 
                        : 'inherit'
                    }}
                  >
                    {selectable && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          color="primary"
                          checked={isItemSelected}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleClick(event, row[idField]);
                          }}
                          inputProps={{ 'aria-labelledby': labelId }}
                        />
                      </TableCell>
                    )}
                    {columns.map((column) => {
                      const value = row[column.field];
                      const cellContent = column.renderCell 
                        ? column.renderCell({ value, row })
                        : value;
                      
                      return (
                        <TableCell
                          key={column.field}
                          align={column.align || 'left'}
                          sx={column.sx}
                        >
                          {cellContent}
                        </TableCell>
                      );
                    })}
                    {(onEdit || onDelete || actions) && (
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          {onEdit && (
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEdit(row);
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {onDelete && (
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDelete(row);
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {actions && (
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAnchorEl(e.currentTarget);
                                setSelectedRow(row);
                              }}
                            >
                              <MoreIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Stack>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={rowsPerPageOptions}
          component="div"
          count={processedRows.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
      
      {/* Actions Menu */}
      {actions && (
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
        >
          {actions.map((action, index) => (
            <MenuItem
              key={index}
              onClick={() => {
                action.onClick(selectedRow);
                setAnchorEl(null);
              }}
            >
              {action.icon && (
                <Box component="span" sx={{ mr: 1, display: 'flex' }}>
                  {action.icon}
                </Box>
              )}
              {action.label}
            </MenuItem>
          ))}
        </Menu>
      )}
    </Box>
  );
};

export default ClinicalDataGrid;