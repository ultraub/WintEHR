/**
 * Dashboard Manager Component
 * Save/load/share dashboard functionality
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Stack,
  Alert,
  Card,
  CardContent,
  CardActions,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
  Snackbar,
  Grid
} from '@mui/material';
import {
  Save as SaveIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Visibility as VisibilityIcon,
  FileCopy as FileCopyIcon,
  MoreVert as MoreVertIcon,
  Dashboard as DashboardIcon,
  AccessTime as AccessTimeIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useUIComposer } from '../contexts/UIComposerContext';

const DashboardManager = () => {
  const {
    currentSpec,
    dashboardList,
    setDashboardList,
    setCurrentSpec,
    createNewSpec
  } = useUIComposer();
  
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [dashboardName, setDashboardName] = useState('');
  const [dashboardDescription, setDashboardDescription] = useState('');
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [loading, setLoading] = useState(false);
  
  // Load saved dashboards on component mount
  useEffect(() => {
    loadSavedDashboards();
  }, []);
  
  // Load saved dashboards from localStorage
  const loadSavedDashboards = useCallback(() => {
    try {
      const saved = localStorage.getItem('ui-composer-dashboards');
      if (saved) {
        const dashboards = JSON.parse(saved);
        setDashboardList(dashboards);
      }
    } catch (error) {
      // Error loading saved dashboards
    }
  }, [setDashboardList]);
  
  // Save dashboards to localStorage
  const saveDashboardsToStorage = useCallback((dashboards) => {
    try {
      localStorage.setItem('ui-composer-dashboards', JSON.stringify(dashboards));
    } catch (error) {
      // Error saving dashboards
    }
  }, []);
  
  // Handle save dashboard
  const handleSaveDashboard = useCallback(async () => {
    if (!currentSpec || !dashboardName.trim()) return;
    
    setLoading(true);
    
    try {
      const dashboard = {
        id: Date.now().toString(),
        name: dashboardName,
        description: dashboardDescription,
        specification: currentSpec,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: 'Current User', // TODO: Get from auth context
        tags: [] // TODO: Extract tags from specification
      };
      
      const updatedDashboards = [...dashboardList, dashboard];
      setDashboardList(updatedDashboards);
      saveDashboardsToStorage(updatedDashboards);
      
      setSaveDialogOpen(false);
      setDashboardName('');
      setDashboardDescription('');
      
      setSnackbar({
        open: true,
        message: 'Dashboard saved successfully!',
        severity: 'success'
      });
      
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Error saving dashboard',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [currentSpec, dashboardName, dashboardDescription, dashboardList, setDashboardList, saveDashboardsToStorage]);
  
  // Handle load dashboard
  const handleLoadDashboard = useCallback((dashboard) => {
    setCurrentSpec(dashboard.specification);
    setSnackbar({
      open: true,
      message: `Dashboard "${dashboard.name}" loaded successfully!`,
      severity: 'success'
    });
  }, [setCurrentSpec]);
  
  // Handle delete dashboard
  const handleDeleteDashboard = useCallback((dashboardId) => {
    const updatedDashboards = dashboardList.filter(d => d.id !== dashboardId);
    setDashboardList(updatedDashboards);
    saveDashboardsToStorage(updatedDashboards);
    
    setSnackbar({
      open: true,
      message: 'Dashboard deleted successfully!',
      severity: 'success'
    });
  }, [dashboardList, setDashboardList, saveDashboardsToStorage]);
  
  // Handle export dashboard
  const handleExportDashboard = useCallback((dashboard) => {
    const exportData = {
      ...dashboard,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dashboard.name.replace(/[^a-zA-Z0-9]/g, '_')}_dashboard.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    setSnackbar({
      open: true,
      message: 'Dashboard exported successfully!',
      severity: 'success'
    });
  }, []);
  
  // Handle import dashboard
  const handleImportDashboard = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        
        // Validate imported data
        if (!importedData.specification || !importedData.name) {
          throw new Error('Invalid dashboard file');
        }
        
        const dashboard = {
          ...importedData,
          id: Date.now().toString(),
          importedAt: new Date().toISOString()
        };
        
        const updatedDashboards = [...dashboardList, dashboard];
        setDashboardList(updatedDashboards);
        saveDashboardsToStorage(updatedDashboards);
        
        setSnackbar({
          open: true,
          message: 'Dashboard imported successfully!',
          severity: 'success'
        });
        
      } catch (error) {
        setSnackbar({
          open: true,
          message: 'Error importing dashboard',
          severity: 'error'
        });
      }
    };
    
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  }, [dashboardList, setDashboardList, saveDashboardsToStorage]);
  
  // Handle share dashboard
  const handleShareDashboard = useCallback((dashboard) => {
    // Create shareable link (would need backend implementation)
    const shareData = {
      name: dashboard.name,
      description: dashboard.description,
      specification: dashboard.specification,
      sharedAt: new Date().toISOString()
    };
    
    // For now, copy to clipboard
    navigator.clipboard.writeText(JSON.stringify(shareData, null, 2));
    
    setSnackbar({
      open: true,
      message: 'Dashboard specification copied to clipboard!',
      severity: 'success'
    });
  }, []);
  
  // Handle duplicate dashboard
  const handleDuplicateDashboard = useCallback((dashboard) => {
    const duplicatedDashboard = {
      ...dashboard,
      id: Date.now().toString(),
      name: `${dashboard.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const updatedDashboards = [...dashboardList, duplicatedDashboard];
    setDashboardList(updatedDashboards);
    saveDashboardsToStorage(updatedDashboards);
    
    setSnackbar({
      open: true,
      message: 'Dashboard duplicated successfully!',
      severity: 'success'
    });
  }, [dashboardList, setDashboardList, saveDashboardsToStorage]);
  
  // Initialize save dialog with current spec name
  useEffect(() => {
    if (currentSpec && saveDialogOpen) {
      setDashboardName(currentSpec.metadata?.name || '');
      setDashboardDescription(currentSpec.metadata?.description || '');
    }
  }, [currentSpec, saveDialogOpen]);
  
  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Dashboard Manager
        </Typography>
        
        <Stack direction="row" spacing={1}>
          <input
            type="file"
            accept=".json"
            onChange={handleImportDashboard}
            style={{ display: 'none' }}
            id="import-dashboard"
          />
          <label htmlFor="import-dashboard">
            <Button
              variant="outlined"
              component="span"
              startIcon={<UploadIcon />}
              size="small"
            >
              Import
            </Button>
          </label>
          
          <Button
            variant="contained"
            onClick={() => setSaveDialogOpen(true)}
            disabled={!currentSpec}
            startIcon={<SaveIcon />}
            size="small"
          >
            Save Current
          </Button>
        </Stack>
      </Box>
      
      {/* Saved Dashboards */}
      {dashboardList.length === 0 ? (
        <Alert severity="info">
          No saved dashboards yet. Create and save your first dashboard to get started!
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {dashboardList.map((dashboard) => (
            <Grid item xs={12} md={6} key={dashboard.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" gutterBottom>
                        {dashboard.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {dashboard.description}
                      </Typography>
                      
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                        <Chip
                          icon={<PersonIcon />}
                          label={dashboard.author}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          icon={<AccessTimeIcon />}
                          label={new Date(dashboard.createdAt).toLocaleDateString()}
                          size="small"
                          variant="outlined"
                        />
                      </Stack>
                    </Box>
                    
                    <IconButton
                      onClick={(e) => {
                        setSelectedDashboard(dashboard);
                        setActionMenuAnchor(e.currentTarget);
                      }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>
                </CardContent>
                
                <CardActions>
                  <Button
                    size="small"
                    onClick={() => handleLoadDashboard(dashboard)}
                    startIcon={<VisibilityIcon />}
                  >
                    Load
                  </Button>
                  <Button
                    size="small"
                    onClick={() => handleExportDashboard(dashboard)}
                    startIcon={<DownloadIcon />}
                  >
                    Export
                  </Button>
                  <Button
                    size="small"
                    onClick={() => handleShareDashboard(dashboard)}
                    startIcon={<ShareIcon />}
                  >
                    Share
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      
      {/* Save Dialog */}
      <Dialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Save Dashboard</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              autoFocus
              fullWidth
              label="Dashboard Name"
              value={dashboardName}
              onChange={(e) => setDashboardName(e.target.value)}
              required
            />
            
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={3}
              value={dashboardDescription}
              onChange={(e) => setDashboardDescription(e.target.value)}
              placeholder="Brief description of what this dashboard shows..."
            />
            
            {currentSpec && (
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>Components:</strong> {currentSpec.layout?.structure?.children?.length || 0}
                </Typography>
                <Typography variant="body2">
                  <strong>Data Sources:</strong> {currentSpec.dataSources?.length || 0}
                </Typography>
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveDashboard}
            disabled={!dashboardName.trim() || loading}
            variant="contained"
          >
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Action Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={() => setActionMenuAnchor(null)}
      >
        <MenuItem onClick={() => {
          handleLoadDashboard(selectedDashboard);
          setActionMenuAnchor(null);
        }}>
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Load</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => {
          handleDuplicateDashboard(selectedDashboard);
          setActionMenuAnchor(null);
        }}>
          <ListItemIcon>
            <FileCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => {
          handleExportDashboard(selectedDashboard);
          setActionMenuAnchor(null);
        }}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => {
          handleShareDashboard(selectedDashboard);
          setActionMenuAnchor(null);
        }}>
          <ListItemIcon>
            <ShareIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Share</ListItemText>
        </MenuItem>
        
        <Divider />
        
        <MenuItem onClick={() => {
          handleDeleteDashboard(selectedDashboard.id);
          setActionMenuAnchor(null);
        }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
      
      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        message={snackbar.message}
      />
    </Box>
  );
};

export default DashboardManager;