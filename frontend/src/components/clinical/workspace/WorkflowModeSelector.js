/**
 * WorkflowModeSelector Component
 * Provides workflow mode selection and navigation for the clinical workspace
 */
import React, { useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Badge,
  useTheme,
  alpha,
  Collapse,
  Paper,
  CircularProgress
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Description as DocumentationIcon,
  LocalPharmacy as OrdersIcon,
  Assessment as ResultsIcon,
  Assignment as CareIcon,
  Analytics as PopulationIcon,
  ArrowDropDown as ArrowDownIcon,
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as UncheckedIcon,
  Keyboard as KeyboardIcon,
  Info as InfoIcon,
  Timeline as TimelineIcon,
  Edit as EditIcon,
  Science as LabIcon,
  Groups as TeamIcon
} from '@mui/icons-material';
import { useWorkflow } from '../../../contexts/WorkflowContext';
import { useFHIRResource } from '../../../contexts/FHIRResourceContext';

// Workflow mode configurations with icons and colors
const WORKFLOW_CONFIGS = {
  'chart-review': {
    icon: <DashboardIcon />,
    color: 'primary',
    shortcut: 'Cmd+1',
    tasks: ['Review active problems', 'Check recent encounters', 'Verify medications']
  },
  'encounter-documentation': {
    icon: <DocumentationIcon />,
    color: 'secondary',
    shortcut: 'Cmd+2',
    tasks: ['Document encounter', 'Update problem list', 'Add clinical notes']
  },
  'orders-management': {
    icon: <OrdersIcon />,
    color: 'success',
    shortcut: 'Cmd+3',
    tasks: ['Create orders', 'Prescribe medications', 'Schedule procedures']
  },
  'results-review': {
    icon: <ResultsIcon />,
    color: 'warning',
    shortcut: 'Cmd+4',
    tasks: ['Review lab results', 'Check imaging reports', 'Acknowledge results']
  },
  'care-planning': {
    icon: <CareIcon />,
    color: 'info',
    shortcut: 'Cmd+5',
    tasks: ['Update care plans', 'Set goals', 'Coordinate with team']
  },
  'population-health': {
    icon: <PopulationIcon />,
    color: 'error',
    shortcut: 'Cmd+6',
    tasks: ['Analyze populations', 'Track quality measures', 'Generate reports']
  }
};

const WorkflowModeSelector = ({ onModeChange }) => {
  const theme = useTheme();
  const { currentMode, changeWorkflowMode, activeResources, isLoadingResources, WORKFLOW_MODES } = useWorkflow();
  const { currentPatient } = useFHIRResource();
  
  const [anchorEl, setAnchorEl] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const menuOpen = Boolean(anchorEl);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleModeSelect = (modeId) => {
    changeWorkflowMode(modeId);
    if (onModeChange) {
      onModeChange(modeId);
    }
    handleMenuClose();
  };

  // Get resource counts for current mode
  const getResourceCounts = () => {
    if (!currentMode || !activeResources) return {};
    
    const counts = {};
    currentMode.requiredResources.forEach(resourceType => {
      counts[resourceType] = activeResources[resourceType]?.length || 0;
    });
    return counts;
  };

  // Get workflow status indicators
  const getWorkflowStatus = (mode) => {
    // In a real implementation, this would check actual task completion
    const mockStatus = {
      completedTasks: mode.id === currentMode?.id ? 2 : 0,
      totalTasks: 3,
      hasAlerts: mode.id === 'results-review',
      priority: mode.id === 'results-review' ? 'high' : 'normal'
    };
    return mockStatus;
  };

  const resourceCounts = getResourceCounts();
  const currentConfig = currentMode ? WORKFLOW_CONFIGS[currentMode.id] : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Main Mode Selector */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <ButtonGroup variant="outlined" sx={{ flex: 1 }}>
          <Button
            fullWidth
            onClick={handleMenuOpen}
            startIcon={currentConfig?.icon}
            endIcon={<ArrowDownIcon />}
            color={currentConfig?.color || 'primary'}
            sx={{
              justifyContent: 'space-between',
              textTransform: 'none',
              py: 1,
              backgroundColor: alpha(theme.palette[currentConfig?.color || 'primary'].main, 0.08),
              '&:hover': {
                backgroundColor: alpha(theme.palette[currentConfig?.color || 'primary'].main, 0.12)
              }
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <Typography variant="subtitle1" fontWeight="medium">
                {currentMode?.name || 'Select Workflow'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {currentMode?.description}
              </Typography>
            </Box>
          </Button>
        </ButtonGroup>

        <Tooltip title="Workflow Details">
          <IconButton onClick={() => setShowDetails(!showDetails)}>
            <InfoIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="Keyboard Shortcuts">
          <IconButton>
            <KeyboardIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Workflow Details Panel */}
      <Collapse in={showDetails}>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            backgroundColor: alpha(theme.palette.background.paper, 0.5),
            border: 1,
            borderColor: 'divider'
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle2" fontWeight="medium">
              Current Workflow Tasks
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {currentConfig?.shortcut}
            </Typography>
          </Box>

          {/* Task List */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
            {WORKFLOW_CONFIGS[currentMode?.id]?.tasks.map((task, index) => (
              <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {index < 2 ? <CheckIcon fontSize="small" color="success" /> : <UncheckedIcon fontSize="small" color="action" />}
                <Typography variant="body2" sx={{ textDecoration: index < 2 ? 'line-through' : 'none' }}>
                  {task}
                </Typography>
              </Box>
            ))}
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Resource Counts */}
          <Typography variant="subtitle2" fontWeight="medium" gutterBottom>
            Available Resources
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {Object.entries(resourceCounts).map(([resourceType, count]) => (
              <Chip
                key={resourceType}
                label={`${resourceType}: ${count}`}
                size="small"
                variant="outlined"
                icon={isLoadingResources ? <CircularProgress size={12} /> : null}
              />
            ))}
          </Box>
        </Paper>
      </Collapse>

      {/* Workflow Mode Menu */}
      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            width: 320,
            maxHeight: 400
          }
        }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Select Clinical Workflow
          </Typography>
        </Box>
        <Divider />
        
        {Object.values(WORKFLOW_MODES).map((mode) => {
          const config = WORKFLOW_CONFIGS[mode.id];
          const status = getWorkflowStatus(mode);
          const isActive = currentMode?.id === mode.id;
          
          return (
            <MenuItem
              key={mode.id}
              onClick={() => handleModeSelect(mode.id)}
              selected={isActive}
              sx={{
                py: 1.5,
                '&.Mui-selected': {
                  backgroundColor: alpha(theme.palette[config.color].main, 0.08)
                }
              }}
            >
              <ListItemIcon>
                <Badge
                  badgeContent={status.hasAlerts ? '!' : 0}
                  color="error"
                  variant="dot"
                >
                  {React.cloneElement(config.icon, { color: config.color })}
                </Badge>
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body1">{mode.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {config.shortcut}
                    </Typography>
                  </Box>
                }
                secondary={
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {mode.description}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <Chip
                        label={`${status.completedTasks}/${status.totalTasks} tasks`}
                        size="small"
                        color={status.completedTasks === status.totalTasks ? 'success' : 'default'}
                        variant="outlined"
                      />
                      {status.priority === 'high' && (
                        <Chip
                          label="Priority"
                          size="small"
                          color="error"
                          variant="filled"
                        />
                      )}
                    </Box>
                  </Box>
                }
              />
            </MenuItem>
          );
        })}
        
        <Divider sx={{ mt: 1 }} />
        
        <MenuItem onClick={handleMenuClose} sx={{ py: 1 }}>
          <ListItemIcon>
            <KeyboardIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Keyboard Shortcuts"
            secondary="Press ? to view all shortcuts"
          />
        </MenuItem>
      </Menu>
    </Box>
  );
};

// Quick access workflow buttons for common modes
export const WorkflowQuickAccess = () => {
  const theme = useTheme();
  const { currentMode, changeWorkflowMode, WORKFLOW_MODES } = useWorkflow();
  
  const quickModes = ['chart-review', 'encounter-documentation', 'orders-management', 'results-review'];
  
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      {quickModes.map(modeId => {
        const mode = Object.values(WORKFLOW_MODES).find(m => m.id === modeId);
        const config = WORKFLOW_CONFIGS[modeId];
        const isActive = currentMode?.id === modeId;
        
        return (
          <Tooltip key={modeId} title={`${mode.name} (${config.shortcut})`}>
            <IconButton
              onClick={() => changeWorkflowMode(modeId)}
              color={isActive ? config.color : 'default'}
              sx={{
                backgroundColor: isActive ? alpha(theme.palette[config.color].main, 0.08) : 'transparent',
                '&:hover': {
                  backgroundColor: alpha(theme.palette[config.color].main, 0.12)
                }
              }}
            >
              {config.icon}
            </IconButton>
          </Tooltip>
        );
      })}
    </Box>
  );
};

export default WorkflowModeSelector;