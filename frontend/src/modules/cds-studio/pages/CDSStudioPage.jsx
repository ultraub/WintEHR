import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  AppBar,
  Toolbar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog
} from '@mui/material';
import {
  Add as AddIcon,
  Code as CodeIcon,
  Cloud as CloudIcon,
  CloudDownload as DiscoveryIcon,
  VpnKey as CredentialsIcon,
  Dashboard as DashboardIcon,
  BuildCircle as VisualBuilderIcon,
  ViewModule as TemplateIcon,
  LibraryBooks as ValueSetCatalogIcon,
} from '@mui/icons-material';
import ServicesTable from '../pages/ServicesRegistry/ServicesTable';
import ServiceDetailPanel from '../components/ServiceDetailPanel';
import BuiltInServiceDialog from '../components/BuiltInServiceDialog';
import ExternalServiceDialog from '../components/ExternalServiceDialog';
import DiscoveryImportDialog from '../components/DiscoveryImportDialog';
import CredentialsManager from './CredentialsManager';
import MonitoringDashboard from './MonitoringDashboard';
import ValueSetCatalog from './ValueSetCatalog/ValueSetCatalog';
import VisualBuilderWizard from '../components/builder/VisualBuilderWizard';
import TemplateServiceBuilder from '../components/templates/TemplateServiceBuilder';

const CDSStudioPage = () => {
  const [selectedService, setSelectedService] = useState(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);

  // Builder dialog states
  const [visualBuilderOpen, setVisualBuilderOpen] = useState(false);
  // When non-null, the wizard opens in edit mode and seeds from this service
  // via GET /full-edit-state. Cleared on close.
  const [editingService, setEditingService] = useState(null);
  const [templateBuilderOpen, setTemplateBuilderOpen] = useState(false);
  const [builtInDialogOpen, setBuiltInDialogOpen] = useState(false);
  const [externalDialogOpen, setExternalDialogOpen] = useState(false);

  // Other dialog states
  const [discoveryImportDialogOpen, setDiscoveryImportDialogOpen] = useState(false);
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [monitoringDialogOpen, setMonitoringDialogOpen] = useState(false);
  const [valueSetCatalogOpen, setValueSetCatalogOpen] = useState(false);
  const [newServiceMenuAnchor, setNewServiceMenuAnchor] = useState(null);

  const handleSelectService = (service) => {
    setSelectedService(service);
    setDetailPanelOpen(true);
  };

  const handleCloseDetailPanel = () => {
    setDetailPanelOpen(false);
  };

  const handleOpenNewServiceMenu = (event) => {
    setNewServiceMenuAnchor(event.currentTarget);
  };

  const handleCloseNewServiceMenu = () => {
    setNewServiceMenuAnchor(null);
  };

  const handleNewVisualBuilder = () => {
    setEditingService(null);
    setVisualBuilderOpen(true);
    handleCloseNewServiceMenu();
  };

  const handleEditService = (service) => {
    setEditingService(service);
    setVisualBuilderOpen(true);
  };

  const handleNewTemplateBuilder = () => {
    setTemplateBuilderOpen(true);
    handleCloseNewServiceMenu();
  };

  const handleNewBuiltInService = () => {
    setBuiltInDialogOpen(true);
    handleCloseNewServiceMenu();
  };

  const handleNewExternalService = () => {
    setExternalDialogOpen(true);
    handleCloseNewServiceMenu();
  };

  const handleServiceCreated = () => {
    // Refresh services table
    window.location.reload(); // Simple refresh for now
  };

  const handleRefresh = () => {
    // Refresh will be handled by ServicesTable component
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            CDS Management Studio
          </Typography>
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleOpenNewServiceMenu}
            >
              New Service
            </Button>
            <Button
              variant="outlined"
              startIcon={<DiscoveryIcon />}
              onClick={() => setDiscoveryImportDialogOpen(true)}
            >
              Discovery Import
            </Button>
            <Button
              variant="outlined"
              startIcon={<ValueSetCatalogIcon />}
              onClick={() => setValueSetCatalogOpen(true)}
            >
              ValueSets
            </Button>
            <Button
              variant="outlined"
              startIcon={<CredentialsIcon />}
              onClick={() => setCredentialsDialogOpen(true)}
            >
              Credentials
            </Button>
            <Button
              variant="outlined"
              startIcon={<DashboardIcon />}
              onClick={() => setMonitoringDialogOpen(true)}
            >
              Monitoring
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* New Service Menu */}
      <Menu
        anchorEl={newServiceMenuAnchor}
        open={Boolean(newServiceMenuAnchor)}
        onClose={handleCloseNewServiceMenu}
      >
        <MenuItem onClick={handleNewVisualBuilder}>
          <ListItemIcon>
            <VisualBuilderIcon color="primary" />
          </ListItemIcon>
          <ListItemText
            primary="Visual Builder"
            secondary="Create service with drag-and-drop interface"
          />
        </MenuItem>
        <MenuItem onClick={handleNewTemplateBuilder}>
          <ListItemIcon>
            <TemplateIcon color="secondary" />
          </ListItemIcon>
          <ListItemText
            primary="Template Builder"
            secondary="Start from pre-built service templates"
          />
        </MenuItem>
        <MenuItem onClick={handleNewBuiltInService}>
          <ListItemIcon>
            <CodeIcon />
          </ListItemIcon>
          <ListItemText
            primary="Code Builder"
            secondary="Write Python code directly"
          />
        </MenuItem>
        <MenuItem onClick={handleNewExternalService}>
          <ListItemIcon>
            <CloudIcon />
          </ListItemIcon>
          <ListItemText
            primary="External Service"
            secondary="HTTP endpoint implementing CDS Hooks"
          />
        </MenuItem>
      </Menu>

      {/* Main Content */}
      <Container maxWidth={false} sx={{ mt: 3, mb: 3, flex: 1, overflow: 'auto' }}>
        <Paper sx={{ p: 3 }}>
          <Box mb={3}>
            <Typography variant="h5" gutterBottom>
              CDS Hooks Services
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage and monitor your Clinical Decision Support services
            </Typography>
          </Box>

          <ServicesTable
            onSelectService={handleSelectService}
            onEditService={handleEditService}
            onRefresh={handleRefresh}
          />
        </Paper>
      </Container>

      {/* Service Detail Panel */}
      <ServiceDetailPanel
        service={selectedService}
        open={detailPanelOpen}
        onClose={handleCloseDetailPanel}
      />

      {/* Visual Builder Wizard — handles both create and edit modes via the
          existingService prop. Editing pulls full state via GET
          /full-edit-state, the final-step button becomes "Save and Re-deploy". */}
      <VisualBuilderWizard
        open={visualBuilderOpen}
        onClose={() => {
          setVisualBuilderOpen(false);
          setEditingService(null);
        }}
        onSuccess={handleServiceCreated}
        existingService={editingService}
      />

      {/* Template Service Builder */}
      <Dialog
        open={templateBuilderOpen}
        onClose={() => setTemplateBuilderOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { height: '90vh' }
        }}
      >
        <TemplateServiceBuilder
          onClose={() => setTemplateBuilderOpen(false)}
          onSuccess={handleServiceCreated}
        />
      </Dialog>

      {/* Built-in Service Dialog (Code Builder) */}
      <BuiltInServiceDialog
        open={builtInDialogOpen}
        onClose={() => setBuiltInDialogOpen(false)}
        onSuccess={handleServiceCreated}
      />

      {/* External Service Dialog */}
      <ExternalServiceDialog
        open={externalDialogOpen}
        onClose={() => setExternalDialogOpen(false)}
        onSuccess={handleServiceCreated}
      />

      {/* Discovery Import Dialog */}
      <DiscoveryImportDialog
        open={discoveryImportDialogOpen}
        onClose={() => setDiscoveryImportDialogOpen(false)}
        onSuccess={handleServiceCreated}
      />

      {/* Credentials Manager Dialog */}
      <Dialog
        open={credentialsDialogOpen}
        onClose={() => setCredentialsDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { height: '90vh' }
        }}
      >
        <CredentialsManager />
      </Dialog>

      {/* Monitoring Dashboard Dialog */}
      <Dialog
        open={monitoringDialogOpen}
        onClose={() => setMonitoringDialogOpen(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: { height: '90vh' }
        }}
      >
        <MonitoringDashboard />
      </Dialog>

      {/* ValueSet Catalog — manage student-authored and system ValueSets.
          Self-contained dialog component manages its own Edit/Delete flows. */}
      <ValueSetCatalog
        open={valueSetCatalogOpen}
        onClose={() => setValueSetCatalogOpen(false)}
      />
    </Box>
  );
};

export default CDSStudioPage;
