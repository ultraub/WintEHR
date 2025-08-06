/**
 * Inventory Management Page
 * Comprehensive medication inventory tracking and management
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Tooltip,
  LinearProgress,
  useTheme,
  alpha
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Inventory as InventoryIcon,
  LocalShipping as ShippingIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  TrendingDown as LowStockIcon,
  AccessTime as ExpiringIcon,
  Error as ExpiredIcon
} from '@mui/icons-material';
import { format } from 'date-fns';

// Import inventory service
import { 
  getAllInventory, 
  getInventoryAlerts,
  addInventory,
  generateInventoryReport 
} from '../services/inventoryManagementService';

const InventoryManagementPage = () => {
  const theme = useTheme();
  
  // State
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [alerts, setAlerts] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Receive shipment form state
  const [shipmentForm, setShipmentForm] = useState({
    medicationCode: '',
    medicationName: '',
    quantity: '',
    lotNumber: '',
    expirationDate: '',
    manufacturer: '',
    invoiceNumber: ''
  });

  // Load inventory data
  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get inventory with filters
      const filters = {
        search: searchTerm,
        lowStock: filterType === 'lowStock',
        expiringSoon: filterType === 'expiring',
        controlled: filterType === 'controlled'
      };
      
      const [inventoryData, alertsData] = await Promise.all([
        getAllInventory(filters),
        getInventoryAlerts()
      ]);
      
      setInventory(inventoryData);
      setAlerts(alertsData);
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterType]);

  // Initial load
  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadInventory();
    setRefreshing(false);
  };

  // Handle receive shipment
  const handleReceiveShipment = async () => {
    try {
      const result = await addInventory(shipmentForm.medicationCode, {
        ...shipmentForm,
        quantity: parseInt(shipmentForm.quantity)
      });
      
      if (result.success) {
        setReceiveDialogOpen(false);
        setShipmentForm({
          medicationCode: '',
          medicationName: '',
          quantity: '',
          lotNumber: '',
          expirationDate: '',
          manufacturer: '',
          invoiceNumber: ''
        });
        await loadInventory();
      }
    } catch (error) {
      console.error('Error receiving shipment:', error);
    }
  };

  // Generate and download report
  const handleGenerateReport = async (reportType) => {
    try {
      const report = await generateInventoryReport(reportType);
      
      // Convert to CSV or JSON based on report type
      const dataStr = JSON.stringify(report, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `inventory_report_${reportType}_${format(new Date(), 'yyyy-MM-dd')}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (error) {
      console.error('Error generating report:', error);
    }
  };

  // Calculate totals
  const totalItems = inventory.length;
  const lowStockCount = alerts.lowStock?.length || 0;
  const outOfStockCount = alerts.outOfStock?.length || 0;
  const expiringCount = alerts.expiringSoon?.length || 0;
  const expiredCount = alerts.expired?.length || 0;

  // Get status chip for inventory item
  const getStatusChip = (item) => {
    if (item.quantity === 0) {
      return <Chip label="Out of Stock" color="error" size="small" icon={<ExpiredIcon />} />;
    }
    if (item.quantity <= item.reorderPoint) {
      return <Chip label="Low Stock" color="warning" size="small" icon={<LowStockIcon />} />;
    }
    
    // Check for expiring lots
    const hasExpiringSoon = item.lotNumbers?.some(lot => {
      const daysUntilExpiration = Math.floor(
        (new Date(lot.expirationDate) - new Date()) / (1000 * 60 * 60 * 24)
      );
      return daysUntilExpiration <= 90 && daysUntilExpiration > 0;
    });
    
    if (hasExpiringSoon) {
      return <Chip label="Expiring Soon" color="warning" size="small" icon={<ExpiringIcon />} />;
    }
    
    return <Chip label="In Stock" color="success" size="small" icon={<CheckIcon />} />;
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary.main">
            <InventoryIcon sx={{ mr: 1, verticalAlign: 'bottom' }} />
            Inventory Management
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Track and manage medication inventory
          </Typography>
        </Box>
        
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={refreshing ? <LinearProgress size={20} /> : <RefreshIcon />}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<ShippingIcon />}
            onClick={() => setReceiveDialogOpen(true)}
          >
            Receive Shipment
          </Button>
        </Stack>
      </Stack>

      {/* Alert Summary Cards */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="text.secondary" variant="caption">
                    Total Items
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {totalItems}
                  </Typography>
                </Box>
                <InventoryIcon color="primary" sx={{ fontSize: 40 }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="text.secondary" variant="caption">
                    Low Stock
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="warning.main">
                    {lowStockCount}
                  </Typography>
                </Box>
                <LowStockIcon color="warning" sx={{ fontSize: 40 }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: alpha(theme.palette.error.main, 0.1) }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="text.secondary" variant="caption">
                    Out of Stock
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="error.main">
                    {outOfStockCount}
                  </Typography>
                </Box>
                <ExpiredIcon color="error" sx={{ fontSize: 40 }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="text.secondary" variant="caption">
                    Expiring Soon
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="warning.main">
                    {expiringCount}
                  </Typography>
                </Box>
                <ExpiringIcon color="warning" sx={{ fontSize: 40 }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters and Actions */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search medications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Filter</InputLabel>
              <Select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                label="Filter"
              >
                <MenuItem value="all">All Items</MenuItem>
                <MenuItem value="lowStock">Low Stock</MenuItem>
                <MenuItem value="expiring">Expiring Soon</MenuItem>
                <MenuItem value="controlled">Controlled Substances</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={5}>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                size="small"
                startIcon={<DownloadIcon />}
                onClick={() => handleGenerateReport('summary')}
              >
                Summary Report
              </Button>
              <Button
                size="small"
                startIcon={<DownloadIcon />}
                onClick={() => handleGenerateReport('detailed')}
              >
                Detailed Report
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Inventory Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Medication</TableCell>
              <TableCell>Code</TableCell>
              <TableCell align="right">Quantity</TableCell>
              <TableCell align="right">Reorder Point</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Lots</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <LinearProgress />
                </TableCell>
              </TableRow>
            ) : inventory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="text.secondary">
                    No inventory items found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              inventory
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((item) => (
                  <TableRow key={item.code}>
                    <TableCell>
                      <Stack>
                        <Typography variant="body2" fontWeight="medium">
                          {item.name}
                        </Typography>
                        {item.controlled && (
                          <Chip 
                            label="Controlled" 
                            size="small" 
                            color="error" 
                            variant="outlined"
                            sx={{ width: 'fit-content', mt: 0.5 }}
                          />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {item.code}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography 
                        fontWeight="medium"
                        color={item.quantity <= item.reorderPoint ? 'warning.main' : 'text.primary'}
                      >
                        {item.quantity} {item.unit}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {item.reorderPoint} {item.unit}
                    </TableCell>
                    <TableCell>
                      {getStatusChip(item)}
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        {item.lotNumbers?.slice(0, 2).map((lot, index) => (
                          <Typography key={index} variant="caption">
                            Lot: {lot.lotNumber} (Exp: {format(new Date(lot.expirationDate), 'MM/yyyy')})
                          </Typography>
                        ))}
                        {item.lotNumbers?.length > 2 && (
                          <Typography variant="caption" color="text.secondary">
                            +{item.lotNumbers.length - 2} more
                          </Typography>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => setSelectedItem(item)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Print Labels">
                          <IconButton size="small">
                            <PrintIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50]}
          component="div"
          count={inventory.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </TableContainer>

      {/* Receive Shipment Dialog */}
      <Dialog
        open={receiveDialogOpen}
        onClose={() => setReceiveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Receive Shipment</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Medication Code (RxNorm)"
              value={shipmentForm.medicationCode}
              onChange={(e) => setShipmentForm({ ...shipmentForm, medicationCode: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Medication Name"
              value={shipmentForm.medicationName}
              onChange={(e) => setShipmentForm({ ...shipmentForm, medicationName: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Quantity"
              type="number"
              value={shipmentForm.quantity}
              onChange={(e) => setShipmentForm({ ...shipmentForm, quantity: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Lot Number"
              value={shipmentForm.lotNumber}
              onChange={(e) => setShipmentForm({ ...shipmentForm, lotNumber: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Expiration Date"
              type="date"
              value={shipmentForm.expirationDate}
              onChange={(e) => setShipmentForm({ ...shipmentForm, expirationDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              required
            />
            <TextField
              fullWidth
              label="Manufacturer"
              value={shipmentForm.manufacturer}
              onChange={(e) => setShipmentForm({ ...shipmentForm, manufacturer: e.target.value })}
            />
            <TextField
              fullWidth
              label="Invoice Number"
              value={shipmentForm.invoiceNumber}
              onChange={(e) => setShipmentForm({ ...shipmentForm, invoiceNumber: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReceiveDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleReceiveShipment}
            variant="contained"
            disabled={!shipmentForm.medicationCode || !shipmentForm.quantity || !shipmentForm.lotNumber}
          >
            Receive Shipment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InventoryManagementPage;