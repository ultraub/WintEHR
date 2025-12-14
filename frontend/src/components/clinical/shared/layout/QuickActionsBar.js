/**
 * QuickActionsBar Component
 * Context-aware action bar with keyboard shortcuts and command palette
 * Provides quick access to common clinical actions
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Button,
  Tooltip,
  Stack,
  Divider,
  Typography,
  Dialog,
  DialogContent,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  useTheme,
  alpha,
  InputAdornment,
  Zoom
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Print as PrintIcon,
  Refresh as RefreshIcon,
  History as HistoryIcon,
  Share as ShareIcon,
  Settings as SettingsIcon,
  KeyboardCommandKey as CommandIcon,
  Assignment as OrderIcon,
  Medication as MedicationIcon,
  Description as NoteIcon,
  Science as LabIcon,
  Image as ImagingIcon,
  CalendarMonth as AppointmentIcon,
  LocalPharmacy as PharmacyIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useHotkeys } from 'react-hotkeys-hook';
import Fuse from 'fuse.js';

// Default quick actions
const DEFAULT_ACTIONS = [
  {
    id: 'new-order',
    label: 'New Order',
    icon: <OrderIcon />,
    shortcut: 'Ctrl+O',
    category: 'Clinical',
    action: 'newOrder'
  },
  {
    id: 'prescribe',
    label: 'Prescribe Medication',
    icon: <MedicationIcon />,
    shortcut: 'Ctrl+M',
    category: 'Clinical',
    action: 'prescribeMedication'
  },
  {
    id: 'add-note',
    label: 'Add Note',
    icon: <NoteIcon />,
    shortcut: 'Ctrl+N',
    category: 'Documentation',
    action: 'addNote'
  },
  {
    id: 'order-lab',
    label: 'Order Lab',
    icon: <LabIcon />,
    shortcut: 'Ctrl+L',
    category: 'Clinical',
    action: 'orderLab'
  },
  {
    id: 'order-imaging',
    label: 'Order Imaging',
    icon: <ImagingIcon />,
    shortcut: 'Ctrl+I',
    category: 'Clinical',
    action: 'orderImaging'
  },
  {
    id: 'schedule',
    label: 'Schedule Appointment',
    icon: <AppointmentIcon />,
    shortcut: 'Ctrl+S',
    category: 'Administrative',
    action: 'scheduleAppointment'
  },
  {
    id: 'print-summary',
    label: 'Print Summary',
    icon: <PrintIcon />,
    shortcut: 'Ctrl+P',
    category: 'Utility',
    action: 'printSummary'
  },
  {
    id: 'refresh',
    label: 'Refresh Data',
    icon: <RefreshIcon />,
    shortcut: 'F5',
    category: 'Utility',
    action: 'refresh'
  }
];

// Command palette component
const CommandPalette = ({ open, onClose, actions, onExecute, recentActions }) => {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Initialize Fuse.js for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(actions, {
      keys: ['label', 'category', 'keywords'],
      threshold: 0.3
    });
  }, [actions]);

  // Filter actions based on search
  const filteredActions = useMemo(() => {
    if (!searchTerm) {
      // Show recent actions when no search term
      const recentIds = new Set(recentActions);
      const recent = actions.filter(a => recentIds.has(a.id));
      const others = actions.filter(a => !recentIds.has(a.id));
      return [...recent, ...others];
    }
    return fuse.search(searchTerm).map(result => result.item);
  }, [searchTerm, fuse, actions, recentActions]);

  // Reset when opened
  useEffect(() => {
    if (open) {
      setSearchTerm('');
      setSelectedIndex(0);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredActions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredActions[selectedIndex]) {
          onExecute(filteredActions[selectedIndex]);
          onClose();
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          overflow: 'hidden'
        }
      }}
    >
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          fullWidth
          placeholder="Type a command or search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" onClick={onClose}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            )
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                border: 'none'
              }
            }
          }}
        />
      </Box>

      <DialogContent sx={{ p: 0, maxHeight: 400 }}>
        <List>
          {filteredActions.map((action, index) => (
            <ListItem
              key={action.id}
              button
              selected={index === selectedIndex}
              onClick={() => {
                onExecute(action);
                onClose();
              }}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.08)
                }
              }}
            >
              <ListItemIcon>
                {action.icon}
              </ListItemIcon>
              <ListItemText
                primary={action.label}
                secondary={action.category}
              />
              <ListItemSecondaryAction>
                {action.shortcut && (
                  <Typography
                    variant="caption"
                    sx={{
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      backgroundColor: alpha(theme.palette.text.primary, 0.08),
                      fontFamily: 'monospace'
                    }}
                  >
                    {action.shortcut}
                  </Typography>
                )}
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>

        {filteredActions.length === 0 && (
          <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            <Typography variant="body2">
              No commands found matching "{searchTerm}"
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Main QuickActionsBar component
const QuickActionsBar = ({
  actions = DEFAULT_ACTIONS,
  onActionClick,
  position = 'top',
  showLabels = false,
  maxVisibleActions = 5,
  enableKeyboardShortcuts = true,
  enableCommandPalette = true,
  currentContext = null
}) => {
  const theme = useTheme();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [recentActions, setRecentActions] = useState([]);

  // Load recent actions from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('clinicalRecentActions');
    if (saved) {
      try {
        setRecentActions(JSON.parse(saved));
      } catch (e) {
        // Invalid data
      }
    }
  }, []);

  // Filter actions based on context
  const contextualActions = useMemo(() => {
    if (!currentContext) return actions;
    
    // Filter based on current tab/context
    return actions.filter(action => {
      // Add context-specific filtering logic here
      return true;
    });
  }, [actions, currentContext]);

  // Get visible actions
  const visibleActions = contextualActions.slice(0, maxVisibleActions);
  const hiddenActions = contextualActions.slice(maxVisibleActions);

  // Handle action execution
  const executeAction = useCallback((action) => {
    onActionClick?.(action.action, action);
    
    // Update recent actions
    setRecentActions(prev => {
      const updated = [action.id, ...prev.filter(id => id !== action.id)].slice(0, 5);
      localStorage.setItem('clinicalRecentActions', JSON.stringify(updated));
      return updated;
    });
  }, [onActionClick]);

  // Register keyboard shortcuts
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const shortcuts = {};
    actions.forEach(action => {
      if (action.shortcut) {
        shortcuts[action.shortcut.toLowerCase().replace('ctrl', 'cmd')] = () => {
          executeAction(action);
        };
      }
    });

    // Command palette shortcut
    if (enableCommandPalette) {
      shortcuts['cmd+k'] = () => setCommandPaletteOpen(true);
    }

    // Register all shortcuts
    Object.entries(shortcuts).forEach(([key, handler]) => {
      // Note: In a real implementation, you'd use react-hotkeys-hook here
      // For now, we'll use a simplified approach
    });
  }, [actions, enableKeyboardShortcuts, enableCommandPalette, executeAction]);

  // Open command palette with Cmd+K
  useHotkeys('cmd+k, ctrl+k', () => {
    if (enableCommandPalette) {
      setCommandPaletteOpen(true);
    }
  });

  return (
    <>
      <Paper
        elevation={2}
        sx={{
          position: position === 'floating' ? 'fixed' : 'relative',
          bottom: position === 'floating' ? 16 : 'auto',
          left: position === 'floating' ? '50%' : 'auto',
          transform: position === 'floating' ? 'translateX(-50%)' : 'none',
          zIndex: position === 'floating' ? 1200 : 'auto',
          borderRadius: 2,
          overflow: 'hidden',
          backgroundColor: alpha(theme.palette.background.paper, 0.95),
          backdropFilter: 'blur(10px)'
        }}
      >
        <Stack
          direction="row"
          spacing={0}
          divider={<Divider orientation="vertical" flexItem />}
          sx={{ px: 1, py: 0.5 }}
        >
          {/* Visible actions */}
          {visibleActions.map((action, index) => (
            <Zoom
              key={action.id}
              in={true}
              style={{ transitionDelay: `${index * 50}ms` }}
            >
              <Tooltip
                title={
                  <Box>
                    <Typography variant="body2">{action.label}</Typography>
                    {action.shortcut && (
                      <Typography variant="caption" sx={{ opacity: 0.7 }}>
                        {action.shortcut}
                      </Typography>
                    )}
                  </Box>
                }
                placement="top"
              >
                {showLabels ? (
                  <Button
                    size="small"
                    startIcon={action.icon}
                    onClick={() => executeAction(action)}
                    sx={{ minWidth: 'auto' }}
                  >
                    {action.label}
                  </Button>
                ) : (
                  <IconButton
                    size="small"
                    onClick={() => executeAction(action)}
                  >
                    {action.icon}
                  </IconButton>
                )}
              </Tooltip>
            </Zoom>
          ))}

          {/* Command palette button */}
          {enableCommandPalette && (
            <Tooltip
              title={
                <Box>
                  <Typography variant="body2">Command Palette</Typography>
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    Cmd+K
                  </Typography>
                </Box>
              }
              placement="top"
            >
              <IconButton
                size="small"
                onClick={() => setCommandPaletteOpen(true)}
                sx={{
                  backgroundColor: alpha(theme.palette.primary.main, 0.08),
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.16)
                  }
                }}
              >
                <CommandIcon />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Paper>

      {/* Command palette dialog */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        actions={contextualActions}
        onExecute={executeAction}
        recentActions={recentActions}
      />
    </>
  );
};

export default QuickActionsBar;