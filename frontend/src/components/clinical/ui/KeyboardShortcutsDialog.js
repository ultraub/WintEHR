/**
 * Keyboard Shortcuts Dialog Component
 * Shows all available keyboard shortcuts in the clinical workspace
 * Part of the Clinical UI Improvements Initiative
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  useTheme,
  alpha,
  Tabs,
  Tab
} from '@mui/material';
import {
  Close as CloseIcon,
  Keyboard as KeyboardIcon,
  NavigateNext as NextIcon,
  NavigateBefore as PrevIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

// Platform detection for showing correct modifier keys
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modifierKey = isMac ? '⌘' : 'Ctrl';

// Keyboard shortcut categories
const shortcutCategories = {
  navigation: {
    label: 'Tab Navigation',
    icon: '🧭',
    shortcuts: [
      { keys: [`${modifierKey}+1`], description: 'Go to Summary' },
      { keys: [`${modifierKey}+2`], description: 'Go to Chart Review' },
      { keys: [`${modifierKey}+3`], description: 'Go to Encounters' },
      { keys: [`${modifierKey}+4`], description: 'Go to Results' },
      { keys: [`${modifierKey}+5`], description: 'Go to Orders' },
      { keys: [`${modifierKey}+6`], description: 'Go to Pharmacy' },
      { keys: [`${modifierKey}+7`], description: 'Go to Imaging' },
      { keys: [`${modifierKey}+8`], description: 'Go to Documentation' },
      { keys: [`${modifierKey}+9`], description: 'Go to Care Plan' },
      { keys: [`${modifierKey}+0`], description: 'Go to Timeline' },
      { keys: ['Alt+←'], description: 'Go back' },
      { keys: ['Alt+→'], description: 'Go forward' },
      { keys: [`${modifierKey}+Tab`], description: 'Next tab' },
      { keys: [`${modifierKey}+Shift+Tab`], description: 'Previous tab' }
    ]
  },
  actions: {
    label: 'Quick Actions',
    icon: '⚡',
    shortcuts: [
      { keys: [`${modifierKey}+N`], description: 'Create new (context-aware)' },
      { keys: [`${modifierKey}+E`], description: 'Edit selected item' },
      { keys: [`${modifierKey}+S`], description: 'Save current work' },
      { keys: [`${modifierKey}+P`], description: 'Print current view' },
      { keys: [`${modifierKey}+F`], description: 'Focus search' },
      { keys: [`${modifierKey}+R`], description: 'Refresh data' },
      { keys: ['Delete'], description: 'Delete selected item' },
      { keys: ['Enter'], description: 'Open selected item' },
      { keys: ['Space'], description: 'Toggle selection' }
    ]
  },
  view: {
    label: 'View Controls',
    icon: '👁️',
    shortcuts: [
      { keys: [`${modifierKey}+Shift+1`], description: 'Compact view' },
      { keys: [`${modifierKey}+Shift+2`], description: 'Comfortable view' },
      { keys: [`${modifierKey}+Shift+3`], description: 'Spacious view' },
      { keys: [`${modifierKey}++`], description: 'Zoom in' },
      { keys: [`${modifierKey}+-`], description: 'Zoom out' },
      { keys: [`${modifierKey}+0`], description: 'Reset zoom' }
    ]
  },
  contextual: {
    label: 'Contextual Shortcuts',
    icon: '🎯',
    shortcuts: [
      { keys: ['↑↓'], description: 'Navigate list items' },
      { keys: ['←→'], description: 'Navigate timeline/calendar' },
      { keys: ['Page Up/Down'], description: 'Scroll content quickly' },
      { keys: ['Home/End'], description: 'Jump to start/end' },
      { keys: [`${modifierKey}+A`], description: 'Select all' },
      { keys: [`${modifierKey}+Click`], description: 'Multi-select items' }
    ]
  },
  general: {
    label: 'General',
    icon: '🔧',
    shortcuts: [
      { keys: [`${modifierKey}+/`], description: 'Show this help' },
      { keys: ['Esc'], description: 'Close dialogs/Cancel' },
      { keys: ['Tab'], description: 'Navigate forward' },
      { keys: ['Shift+Tab'], description: 'Navigate backward' },
      { keys: [`${modifierKey}+Z`], description: 'Undo' },
      { keys: [`${modifierKey}+Shift+Z`], description: 'Redo' }
    ]
  }
};

// Key component for displaying keyboard keys
const KeyChip = ({ keyText }) => {
  const theme = useTheme();
  
  return (
    <Chip
      label={keyText}
      size="small"
      sx={{
        fontFamily: 'monospace',
        fontWeight: 600,
        bgcolor: theme.palette.mode === 'dark' 
          ? alpha(theme.palette.grey[800], 0.8)
          : alpha(theme.palette.grey[200], 0.8),
        border: 1,
        borderColor: theme.palette.mode === 'dark'
          ? alpha(theme.palette.grey[700], 0.8)
          : alpha(theme.palette.grey[300], 0.8),
        borderBottomWidth: 3,
        boxShadow: theme.palette.mode === 'dark'
          ? 'inset 0 -2px 0 rgba(0,0,0,0.4)'
          : 'inset 0 -2px 0 rgba(0,0,0,0.1)',
        height: 28,
        '& .MuiChip-label': {
          px: 1.5,
          fontSize: '0.75rem'
        }
      }}
    />
  );
};

const KeyboardShortcutsDialog = ({ open, onClose }) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = React.useState(0);
  
  const categoryKeys = Object.keys(shortcutCategories);
  const activeCategory = categoryKeys[activeTab];
  const category = shortcutCategories[activeCategory];
  
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '80vh'
        }
      }}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <KeyboardIcon color="primary" />
            <Typography variant="h6">Keyboard Shortcuts</Typography>
          </Stack>
          <IconButton
            edge="end"
            color="inherit"
            onClick={onClose}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {categoryKeys.map((key, index) => (
              <Tab
                key={key}
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <span>{shortcutCategories[key].icon}</span>
                    <span>{shortcutCategories[key].label}</span>
                  </Stack>
                }
              />
            ))}
          </Tabs>
        </Box>
        
        <Box sx={{ p: 3 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Shortcut</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {category.shortcuts.map((shortcut, index) => (
                      <TableRow
                        key={index}
                        sx={{
                          '&:hover': {
                            bgcolor: alpha(theme.palette.primary.main, 0.04)
                          }
                        }}
                      >
                        <TableCell sx={{ width: '40%' }}>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            {shortcut.keys.map((key, idx) => (
                              <React.Fragment key={idx}>
                                {idx > 0 && (
                                  <Typography variant="caption" color="text.secondary">
                                    or
                                  </Typography>
                                )}
                                <Stack direction="row" spacing={0.5}>
                                  {key.split('+').map((part, partIdx) => (
                                    <React.Fragment key={partIdx}>
                                      {partIdx > 0 && (
                                        <Typography variant="caption" sx={{ mx: 0.5 }}>
                                          +
                                        </Typography>
                                      )}
                                      <KeyChip keyText={part.trim()} />
                                    </React.Fragment>
                                  ))}
                                </Stack>
                              </React.Fragment>
                            ))}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {shortcut.description}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </motion.div>
          </AnimatePresence>
        </Box>
        
        {/* Tips section */}
        <Box sx={{ px: 3, pb: 2 }}>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              bgcolor: alpha(theme.palette.info.main, 0.04),
              borderColor: alpha(theme.palette.info.main, 0.2)
            }}
          >
            <Stack spacing={1}>
              <Typography variant="subtitle2" color="info.main">
                💡 Pro Tips
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • Hold {modifierKey} and press a number (1-9, 0) to quickly navigate between tabs
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • Use {modifierKey}+F to quickly search within any view
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • Press {modifierKey}+/ anytime to show this help dialog
              </Typography>
            </Stack>
          </Paper>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default KeyboardShortcutsDialog;