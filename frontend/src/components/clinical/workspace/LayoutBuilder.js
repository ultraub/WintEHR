/**
 * LayoutBuilder Component
 * Interface for creating and managing custom workspace layouts
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Alert,
  Stack,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  ToggleButton,
  ToggleButtonGroup,
  Paper,
  Divider,
  useTheme,
  alpha
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Assignment as ChartIcon,
  EventNote as EncountersIcon,
  Science as ResultsIcon,
  LocalPharmacy as OrdersIcon,
  Description as DocumentationIcon,
  Assignment as CarePlanIcon,
  Timeline as TimelineIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  ViewModule as LayoutIcon,
  GridView as GridIcon,
  ViewColumn as ColumnIcon,
  ViewStream as RowIcon
} from '@mui/icons-material';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// Available components for layout
const AVAILABLE_COMPONENTS = [
  { id: 'summary', name: 'Summary Dashboard', icon: <DashboardIcon />, category: 'overview' },
  { id: 'chart', name: 'Chart Review', icon: <ChartIcon />, category: 'clinical' },
  { id: 'encounters', name: 'Encounters', icon: <EncountersIcon />, category: 'clinical' },
  { id: 'results', name: 'Results', icon: <ResultsIcon />, category: 'clinical' },
  { id: 'orders', name: 'Orders', icon: <OrdersIcon />, category: 'clinical' },
  { id: 'documentation', name: 'Documentation', icon: <DocumentationIcon />, category: 'clinical' },
  { id: 'careplan', name: 'Care Plan', icon: <CarePlanIcon />, category: 'care' },
  { id: 'timeline', name: 'Timeline', icon: <TimelineIcon />, category: 'overview' }
];

// Predefined layout templates
const LAYOUT_TEMPLATES = [
  {
    id: 'overview',
    name: 'Clinical Overview',
    description: 'Summary dashboard with key clinical data',
    items: [
      { i: 'summary-1', component: 'summary', x: 0, y: 0, w: 12, h: 6 },
      { i: 'chart-1', component: 'chart', x: 0, y: 6, w: 6, h: 6 },
      { i: 'results-1', component: 'results', x: 6, y: 6, w: 6, h: 6 }
    ]
  },
  {
    id: 'workflow',
    name: 'Clinical Workflow',
    description: 'Optimized for patient encounters',
    items: [
      { i: 'encounters-1', component: 'encounters', x: 0, y: 0, w: 4, h: 12 },
      { i: 'chart-1', component: 'chart', x: 4, y: 0, w: 4, h: 6 },
      { i: 'orders-1', component: 'orders', x: 8, y: 0, w: 4, h: 6 },
      { i: 'documentation-1', component: 'documentation', x: 4, y: 6, w: 8, h: 6 }
    ]
  },
  {
    id: 'results-focused',
    name: 'Results Review',
    description: 'Focus on lab results and orders',
    items: [
      { i: 'results-1', component: 'results', x: 0, y: 0, w: 8, h: 12 },
      { i: 'orders-1', component: 'orders', x: 8, y: 0, w: 4, h: 6 },
      { i: 'timeline-1', component: 'timeline', x: 8, y: 6, w: 4, h: 6 }
    ]
  }
];

const LayoutBuilder = ({ open, onClose, onSelectLayout, patientId }) => {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const [layoutName, setLayoutName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [customLayout, setCustomLayout] = useState([]);
  const [savedLayouts, setSavedLayouts] = useState([]);
  const [error, setError] = useState('');

  // Load saved layouts from localStorage
  React.useEffect(() => {
    const saved = localStorage.getItem('clinical-workspace-layouts');
    if (saved) {
      setSavedLayouts(JSON.parse(saved));
    }
  }, [open]);

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setCustomLayout([...template.items]);
    setActiveStep(1);
  };

  const handleComponentAdd = (component) => {
    const newItem = {
      i: `${component.id}-${Date.now()}`,
      component: component.id,
      x: 0,
      y: 0,
      w: 4,
      h: 4
    };
    setCustomLayout([...customLayout, newItem]);
  };

  const handleComponentRemove = (itemId) => {
    setCustomLayout(customLayout.filter(item => item.i !== itemId));
  };

  const handleLayoutChange = (newLayout) => {
    const updatedLayout = customLayout.map(item => {
      const layoutItem = newLayout.find(l => l.i === item.i);
      if (layoutItem) {
        return {
          ...item,
          x: layoutItem.x,
          y: layoutItem.y,
          w: layoutItem.w,
          h: layoutItem.h
        };
      }
      return item;
    });
    setCustomLayout(updatedLayout);
  };

  const handleSaveLayout = () => {
    if (!layoutName.trim()) {
      setError('Please enter a layout name');
      return;
    }

    const newLayout = {
      id: Date.now().toString(),
      name: layoutName,
      items: customLayout,
      createdAt: new Date().toISOString(),
      editable: true
    };

    const updatedLayouts = [...savedLayouts, newLayout];
    setSavedLayouts(updatedLayouts);
    localStorage.setItem('clinical-workspace-layouts', JSON.stringify(updatedLayouts));

    onSelectLayout(newLayout);
    handleClose();
  };

  const handleSelectSavedLayout = (layout) => {
    onSelectLayout(layout);
    handleClose();
  };

  const handleDeleteLayout = (layoutId) => {
    const updatedLayouts = savedLayouts.filter(l => l.id !== layoutId);
    setSavedLayouts(updatedLayouts);
    localStorage.setItem('clinical-workspace-layouts', JSON.stringify(updatedLayouts));
  };

  const handleClose = () => {
    setActiveStep(0);
    setLayoutName('');
    setSelectedTemplate(null);
    setCustomLayout([]);
    setError('');
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{ sx: { height: '90vh' } }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LayoutIcon />
          Customize Workspace Layout
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Stepper activeStep={activeStep} orientation="vertical">
          <Step>
            <StepLabel>Choose a starting point</StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Select a template or start from scratch
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Card 
                    sx={{ 
                      cursor: 'pointer',
                      border: 2,
                      borderColor: 'transparent',
                      '&:hover': { borderColor: 'primary.main' }
                    }}
                    onClick={() => {
                      setCustomLayout([]);
                      setActiveStep(1);
                    }}
                  >
                    <CardContent>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <AddIcon color="primary" />
                        <Box>
                          <Typography variant="h6">Start from Scratch</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Build your own custom layout
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                {LAYOUT_TEMPLATES.map((template) => (
                  <Grid item xs={12} sm={6} md={4} key={template.id}>
                    <Card 
                      sx={{ 
                        cursor: 'pointer',
                        border: 2,
                        borderColor: selectedTemplate?.id === template.id ? 'primary.main' : 'transparent',
                        '&:hover': { borderColor: 'primary.main' }
                      }}
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          {template.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {template.description}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              {savedLayouts.length > 0 && (
                <>
                  <Divider sx={{ my: 3 }} />
                  <Typography variant="h6" gutterBottom>
                    Saved Layouts
                  </Typography>
                  <List>
                    {savedLayouts.map((layout) => (
                      <ListItem key={layout.id}>
                        <ListItemText
                          primary={layout.name}
                          secondary={`Created ${new Date(layout.createdAt).toLocaleDateString()}`}
                        />
                        <ListItemSecondaryAction>
                          <IconButton 
                            edge="end" 
                            onClick={() => handleSelectSavedLayout(layout)}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton 
                            edge="end" 
                            onClick={() => handleDeleteLayout(layout.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </StepContent>
          </Step>

          <Step>
            <StepLabel>Customize your layout</StepLabel>
            <StepContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <Typography variant="h6" gutterBottom>
                    Available Components
                  </Typography>
                  <List>
                    {AVAILABLE_COMPONENTS.map((component) => (
                      <ListItem 
                        key={component.id}
                        button
                        onClick={() => handleComponentAdd(component)}
                      >
                        <ListItemIcon>{component.icon}</ListItemIcon>
                        <ListItemText 
                          primary={component.name}
                          secondary={component.category}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Grid>

                <Grid item xs={12} md={9}>
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      p: 2, 
                      height: '500px', 
                      overflow: 'auto',
                      backgroundColor: alpha(theme.palette.grey[100], 0.5)
                    }}
                  >
                    {customLayout.length === 0 ? (
                      <Box 
                        sx={{ 
                          height: '100%', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center' 
                        }}
                      >
                        <Typography variant="body1" color="text.secondary">
                          Click components on the left to add them to your layout
                        </Typography>
                      </Box>
                    ) : (
                      <GridLayout
                        className="layout"
                        layout={customLayout}
                        cols={12}
                        rowHeight={40}
                        width={800}
                        onLayoutChange={handleLayoutChange}
                        isDraggable={true}
                        isResizable={true}
                        margin={[10, 10]}
                      >
                        {customLayout.map((item) => {
                          const component = AVAILABLE_COMPONENTS.find(c => c.id === item.component);
                          return (
                            <Paper
                              key={item.i}
                              sx={{ 
                                p: 1, 
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative'
                              }}
                              elevation={2}
                            >
                              {component?.icon}
                              <Typography variant="caption">
                                {component?.name}
                              </Typography>
                              <IconButton
                                size="small"
                                sx={{ 
                                  position: 'absolute', 
                                  top: 2, 
                                  right: 2 
                                }}
                                onClick={() => handleComponentRemove(item.i)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Paper>
                          );
                        })}
                      </GridLayout>
                    )}
                  </Paper>
                </Grid>
              </Grid>

              <Box sx={{ mt: 3 }}>
                <TextField
                  fullWidth
                  label="Layout Name"
                  value={layoutName}
                  onChange={(e) => setLayoutName(e.target.value)}
                  error={!!error}
                  helperText={error}
                />
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        {activeStep === 1 && (
          <>
            <Button onClick={() => setActiveStep(0)}>Back</Button>
            <Button 
              variant="contained" 
              onClick={handleSaveLayout}
              disabled={customLayout.length === 0}
              startIcon={<SaveIcon />}
            >
              Save Layout
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default LayoutBuilder;