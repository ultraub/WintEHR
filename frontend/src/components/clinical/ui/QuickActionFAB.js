import React, { useState, useEffect, memo } from 'react';
import {
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Fab,
  Box,
  Badge,
  Zoom,
  Portal,
  useTheme,
  useMediaQuery,
  alpha
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Assignment as AssignmentIcon,
  LocalPharmacy as MedicationIcon,
  Science as LabIcon,
  Event as AppointmentIcon,
  Note as NoteIcon,
  Print as PrintIcon,
  Share as ShareIcon,
  Search as SearchIcon,
  KeyboardCommandKey as CommandIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useHotkeys } from 'react-hotkeys-hook';

// Default action presets
const actionPresets = {
  clinical: [
    {
      icon: <AssignmentIcon />,
      name: 'New Order',
      shortcut: 'Ctrl+O',
      color: 'primary'
    },
    {
      icon: <MedicationIcon />,
      name: 'Prescribe',
      shortcut: 'Ctrl+P',
      color: 'secondary'
    },
    {
      icon: <LabIcon />,
      name: 'Order Labs',
      shortcut: 'Ctrl+L',
      color: 'info'
    },
    {
      icon: <NoteIcon />,
      name: 'Add Note',
      shortcut: 'Ctrl+N',
      color: 'success'
    }
  ],
  
  documentation: [
    {
      icon: <NoteIcon />,
      name: 'Progress Note',
      shortcut: 'Ctrl+N'
    },
    {
      icon: <AssignmentIcon />,
      name: 'Discharge Summary',
      shortcut: 'Ctrl+D'
    },
    {
      icon: <EditIcon />,
      name: 'Edit Template',
      shortcut: 'Ctrl+T'
    }
  ],
  
  workflow: [
    {
      icon: <PrintIcon />,
      name: 'Print',
      shortcut: 'Ctrl+P'
    },
    {
      icon: <ShareIcon />,
      name: 'Share',
      shortcut: 'Ctrl+S'
    },
    {
      icon: <SearchIcon />,
      name: 'Search',
      shortcut: 'Ctrl+F'
    }
  ]
};

const QuickActionFAB = memo(({
  // Core props
  actions = [],
  primaryAction,
  presetType = 'clinical',
  
  // Position props
  position = 'bottom-right',
  offsetX = 16,
  offsetY = 16,
  
  // Behavior props
  open: controlledOpen,
  onOpen,
  onClose,
  direction = 'up',
  hidden = false,
  ariaLabel = 'Quick actions',
  
  // Style props
  color = 'primary',
  size = 'large',
  variant = 'circular',
  showBadge = false,
  badgeContent = null,
  
  // Feature flags
  enableKeyboardShortcuts = true,
  showTooltips = true,
  closeOnActionClick = true,
  usePortal = true,
  
  sx = {},
  ...otherProps
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [open, setOpen] = useState(false);
  const [recentAction, setRecentAction] = useState(null);
  
  // Use controlled open state if provided
  const isOpen = controlledOpen !== undefined ? controlledOpen : open;
  
  // Merge preset actions with custom actions
  const mergedActions = actions.length > 0 ? actions : (actionPresets[presetType] || []);
  
  // Calculate position styles
  const positionStyles = {
    'bottom-right': { bottom: offsetY, right: offsetX },
    'bottom-left': { bottom: offsetY, left: offsetX },
    'top-right': { top: offsetY, right: offsetX },
    'top-left': { top: offsetY, left: offsetX }
  };
  
  // Handle open/close
  const handleOpen = () => {
    if (controlledOpen === undefined) {
      setOpen(true);
    }
    onOpen?.();
  };
  
  const handleClose = () => {
    if (controlledOpen === undefined) {
      setOpen(false);
    }
    onClose?.();
  };
  
  const handleToggle = () => {
    if (isOpen) {
      handleClose();
    } else {
      handleOpen();
    }
  };
  
  // Handle action click
  const handleActionClick = (action) => () => {
    if (action.onClick) {
      action.onClick();
    }
    
    // Track recent action
    setRecentAction(action.name);
    setTimeout(() => setRecentAction(null), 2000);
    
    if (closeOnActionClick) {
      handleClose();
    }
  };
  
  // Setup keyboard shortcuts
  useHotkeys('cmd+k, ctrl+k', (e) => {
    e.preventDefault();
    handleToggle();
  }, { enabled: enableKeyboardShortcuts });
  
  // Setup individual action shortcuts
  mergedActions.forEach(action => {
    if (action.shortcut && action.onClick && enableKeyboardShortcuts) {
      useHotkeys(action.shortcut.toLowerCase().replace('ctrl', 'cmd'), (e) => {
        e.preventDefault();
        action.onClick();
      });
    }
  });
  
  // Animation variants
  const fabVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: { 
      scale: 1, 
      opacity: 1,
      transition: { type: 'spring', stiffness: 300, damping: 25 }
    }
  };
  
  const speedDialVariants = {
    closed: { scale: 0.95, opacity: 0.8 },
    open: { scale: 1, opacity: 1 }
  };
  
  // Single FAB mode for primary action
  if (primaryAction && mergedActions.length === 0) {
    const fab = (
      <motion.div
        variants={fabVariants}
        initial="hidden"
        animate={hidden ? "hidden" : "visible"}
        style={{
          position: 'fixed',
          zIndex: theme.zIndex.speedDial,
          ...positionStyles[position]
        }}
      >
        <Badge
          badgeContent={showBadge ? badgeContent : null}
          color="error"
          overlap="circular"
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <Fab
            color={primaryAction.color || color}
            size={size}
            variant={variant}
            onClick={primaryAction.onClick}
            sx={{
              boxShadow: theme.shadows[8],
              '&:hover': {
                boxShadow: theme.shadows[12],
                transform: 'scale(1.05)'
              },
              transition: 'all 0.2s ease',
              ...sx
            }}
            {...otherProps}
          >
            {primaryAction.icon || <AddIcon />}
          </Fab>
        </Badge>
      </motion.div>
    );
    
    return usePortal ? <Portal>{fab}</Portal> : fab;
  }
  
  // Speed Dial mode for multiple actions
  const speedDial = (
    <motion.div
      variants={speedDialVariants}
      initial="closed"
      animate={isOpen ? "open" : "closed"}
      style={{
        position: 'fixed',
        zIndex: theme.zIndex.speedDial,
        ...positionStyles[position]
      }}
    >
      <SpeedDial
        ariaLabel={ariaLabel}
        icon={
          <SpeedDialIcon
            icon={primaryAction?.icon || <AddIcon />}
            openIcon={<CloseIcon />}
          />
        }
        onClose={handleClose}
        onOpen={handleOpen}
        open={isOpen}
        direction={direction}
        hidden={hidden}
        FabProps={{
          color: primaryAction?.color || color,
          size: size,
          sx: {
            boxShadow: theme.shadows[8],
            '&:hover': {
              boxShadow: theme.shadows[12]
            },
            ...sx
          }
        }}
      >
        {mergedActions.map((action, index) => (
          <SpeedDialAction
            key={action.name}
            icon={
              <Badge
                badgeContent={action.badge}
                color="error"
                invisible={!action.badge}
              >
                {action.icon}
              </Badge>
            }
            tooltipTitle={
              showTooltips ? (
                <Box>
                  <Box>{action.name}</Box>
                  {action.shortcut && enableKeyboardShortcuts && (
                    <Box
                      component="span"
                      sx={{
                        fontSize: '0.75rem',
                        opacity: 0.7,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        mt: 0.25
                      }}
                    >
                      <CommandIcon sx={{ fontSize: 12 }} />
                      {action.shortcut.replace('Ctrl', '')}
                    </Box>
                  )}
                </Box>
              ) : ''
            }
            onClick={handleActionClick(action)}
            FabProps={{
              sx: {
                backgroundColor: action.color 
                  ? theme.palette[action.color]?.main 
                  : theme.palette.background.paper,
                color: action.color 
                  ? theme.palette[action.color]?.contrastText 
                  : theme.palette.text.primary,
                '&:hover': {
                  backgroundColor: action.color 
                    ? theme.palette[action.color]?.dark 
                    : theme.palette.action.hover,
                  transform: 'scale(1.1)'
                },
                transition: 'all 0.2s ease'
              }
            }}
            delay={index * 30}
          />
        ))}
      </SpeedDial>
      
      {/* Recent action feedback */}
      <AnimatePresence>
        {recentAction && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: 'absolute',
              bottom: size === 'large' ? 80 : 60,
              right: 0,
              backgroundColor: alpha(theme.palette.background.paper, 0.95),
              padding: theme.spacing(1, 2),
              borderRadius: theme.shape.borderRadius,
              boxShadow: theme.shadows[4],
              whiteSpace: 'nowrap'
            }}
          >
            {recentAction} triggered
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
  
  return usePortal ? <Portal>{speedDial}</Portal> : speedDial;
});

QuickActionFAB.displayName = 'QuickActionFAB';

// Hook for managing FAB state
export const useQuickActions = (initialActions = [], options = {}) => {
  const [actions, setActions] = useState(initialActions);
  const [open, setOpen] = useState(false);
  
  const addAction = (action) => {
    setActions(prev => [...prev, action]);
  };
  
  const removeAction = (actionName) => {
    setActions(prev => prev.filter(a => a.name !== actionName));
  };
  
  const updateAction = (actionName, updates) => {
    setActions(prev => prev.map(a => 
      a.name === actionName ? { ...a, ...updates } : a
    ));
  };
  
  const triggerAction = (actionName) => {
    const action = actions.find(a => a.name === actionName);
    if (action?.onClick) {
      action.onClick();
    }
  };
  
  return {
    actions,
    open,
    setOpen,
    addAction,
    removeAction,
    updateAction,
    triggerAction
  };
};

// Context-aware FAB that changes based on current module
export const ContextualFAB = ({ currentModule, ...props }) => {
  const contextualActions = {
    orders: actionPresets.clinical,
    documentation: actionPresets.documentation,
    pharmacy: [
      {
        icon: <MedicationIcon />,
        name: 'Dispense',
        shortcut: 'Ctrl+D'
      },
      {
        icon: <AssignmentIcon />,
        name: 'Refill Request',
        shortcut: 'Ctrl+R'
      }
    ],
    results: [
      {
        icon: <PrintIcon />,
        name: 'Print Results',
        shortcut: 'Ctrl+P'
      },
      {
        icon: <ShareIcon />,
        name: 'Send to Provider',
        shortcut: 'Ctrl+S'
      }
    ]
  };
  
  return (
    <QuickActionFAB
      actions={contextualActions[currentModule] || actionPresets.clinical}
      {...props}
    />
  );
};

export default QuickActionFAB;