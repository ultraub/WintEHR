/**
 * ResourceDataGrid Component
 * A flexible data grid for displaying FHIR resources with sorting, filtering, and actions
 */
import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  IconButton,
  Chip,
  Typography,
  Toolbar,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Checkbox,
  Tooltip
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  Search as SearchIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';

const ResourceDataGrid = ({
  data = [],
  columns = [],
  onEdit,
  onDelete,
  onRowClick,
  title,
  loading = false,
  dense = false,
  showPagination = true,
  defaultRowsPerPage = 10,
  selectable = false,
  selected = [],
  onSelectionChange,
  actions = true
}) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);
  const [orderBy, setOrderBy] = useState('');
  const [order, setOrder] = useState('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    
    return data.filter(row => {
      return columns.some(column => {
        const value = column.selector ? column.selector(row) : row[column.field];
        return value?.toString().toLowerCase().includes(searchTerm.toLowerCase());
      });
    });
  }, [data, searchTerm, columns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!orderBy) return filteredData;

    const column = columns.find(col => col.field === orderBy);
    if (!column) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = column.selector ? column.selector(a) : a[orderBy];
      const bValue = column.selector ? column.selector(b) : b[orderBy];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (order === 'asc') {
        return aValue > bValue ? 1 : -1;
      }
      return aValue < bValue ? 1 : -1;
    });
  }, [filteredData, orderBy, order, columns]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!showPagination) return sortedData;
    return sortedData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [sortedData, page, rowsPerPage, showPagination]);

  const handleSort = (field) => {
    const isAsc = orderBy === field && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(field);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleMenuOpen = (event, row) => {
    setAnchorEl(event.currentTarget);
    setSelectedRow(row);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedRow(null);
  };

  const handleAction = (action) => {
    if (selectedRow) {
      if (action === 'edit' && onEdit) {
        onEdit(selectedRow);
      } else if (action === 'delete' && onDelete) {
        onDelete(selectedRow);
      }
    }
    handleMenuClose();
  };

  const handleSelectAll = (event) => {
    if (event.target.checked && onSelectionChange) {
      onSelectionChange(data.map(row => row.id));
    } else if (onSelectionChange) {
      onSelectionChange([]);
    }
  };

  const handleSelectRow = (rowId) => {
    if (!onSelectionChange) return;
    
    const selectedIndex = selected.indexOf(rowId);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = [...selected, rowId];
    } else {
      newSelected = selected.filter(id => id !== rowId);
    }

    onSelectionChange(newSelected);
  };

  return (
    <Paper elevation={0} sx={{ width: '100%', overflow: 'hidden' }}>
      {(title || searchTerm !== undefined) && (
        <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 1 } }}>
          {title && (
            <Typography
              sx={{ flex: '1 1 100%' }}
              variant="h6"
              component="div"
            >
              {title}
            </Typography>
          )}
          <TextField
            size="small"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 200 }}
          />
        </Toolbar>
      )}
      
      <TableContainer>
        <Table size={dense ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selected.length > 0 && selected.length < data.length}
                    checked={data.length > 0 && selected.length === data.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
              )}
              {columns.map((column) => (
                <TableCell
                  key={column.field}
                  align={column.align || 'left'}
                  sortDirection={orderBy === column.field ? order : false}
                >
                  {column.sortable !== false ? (
                    <TableSortLabel
                      active={orderBy === column.field}
                      direction={orderBy === column.field ? order : 'asc'}
                      onClick={() => handleSort(column.field)}
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
              {actions && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedData.map((row) => {
              const isItemSelected = selected.includes(row.id);
              
              return (
                <TableRow
                  key={row.id}
                  hover
                  onClick={() => onRowClick && onRowClick(row)}
                  selected={isItemSelected}
                  sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
                >
                  {selectable && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isItemSelected}
                        onChange={() => handleSelectRow(row.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => {
                    const value = column.selector ? column.selector(row) : row[column.field];
                    
                    return (
                      <TableCell key={column.field} align={column.align || 'left'}>
                        {column.render ? column.render(value, row) : value}
                      </TableCell>
                    );
                  })}
                  {actions && (
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMenuOpen(e, row);
                        }}
                      >
                        <MoreIcon />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      
      {showPagination && (
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={filteredData.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      )}
      
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {onEdit && (
          <MenuItem onClick={() => handleAction('edit')}>
            <EditIcon fontSize="small" sx={{ mr: 1 }} />
            Edit
          </MenuItem>
        )}
        {onDelete && (
          <MenuItem onClick={() => handleAction('delete')}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        )}
      </Menu>
    </Paper>
  );
};

export default ResourceDataGrid;