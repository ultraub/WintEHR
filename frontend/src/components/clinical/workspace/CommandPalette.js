/**
 * CommandPalette Component
 * Provides quick access to commands, navigation, and actions via Cmd+K
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Typography,
  Chip,
  Box,
  InputAdornment,
  Divider,
  IconButton,
  Paper,
  useTheme,
  alpha
} from '@mui/material';
import {
  Search as SearchIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  LocalPharmacy as MedicationIcon,
  Assessment as AssessmentIcon,
  Description as DocumentIcon,
  Timeline as TimelineIcon,
  Dashboard as DashboardIcon,
  Settings as SettingsIcon,
  Close as CloseIcon,
  KeyboardReturn as EnterIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  History as HistoryIcon,
  Favorite as FavoriteIcon,
  Speed as QuickActionIcon,
  Category as CategoryIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useWorkflow } from '../../../contexts/WorkflowContext';
import { useFHIRResource } from '../../../contexts/FHIRResourceContext';
import { fhirClient } from '../../../services/fhirClient';
import { encodeFhirId } from '../../../utils/navigationUtils';

// Command categories
const COMMAND_CATEGORIES = {
  NAVIGATION: 'navigation',
  WORKFLOW: 'workflow',
  PATIENT: 'patient',
  CLINICAL: 'clinical',
  SEARCH: 'search',
  QUICK_ACTION: 'quick-action',
  RECENT: 'recent',
  FAVORITE: 'favorite'
};

// Command type definitions
const createCommand = (id, name, description, category, icon, action, keywords = []) => ({
  id,
  name,
  description,
  category,
  icon,
  action,
  keywords: [name.toLowerCase(), ...keywords]
});

const CommandPalette = ({ open, onClose }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentMode, changeWorkflowMode, quickActions, WORKFLOW_MODES } = useWorkflow();
  const { currentPatient } = useFHIRResource();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState([]);
  const [recentCommands, setRecentCommands] = useState([]);
  const [favoriteCommands, setFavoriteCommands] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Load recent and favorite commands from localStorage
  useEffect(() => {
    const savedRecent = localStorage.getItem('commandPalette-recent');
    const savedFavorites = localStorage.getItem('commandPalette-favorites');
    
    if (savedRecent) {
      setRecentCommands(JSON.parse(savedRecent));
    }
    
    if (savedFavorites) {
      setFavoriteCommands(JSON.parse(savedFavorites));
    }
  }, []);

  // Define available commands
  const commands = useMemo(() => {
    const baseCommands = [
      // Workflow navigation
      ...Object.values(WORKFLOW_MODES).map(mode => 
        createCommand(
          `workflow-${mode.id}`,
          `Switch to ${mode.name}`,
          mode.description,
          COMMAND_CATEGORIES.WORKFLOW,
          <DashboardIcon />,
          () => {
            changeWorkflowMode(mode.id);
            onClose();
          },
          ['workflow', mode.id]
        )
      ),

      // Quick actions
      createCommand(
        'quick-review-results',
        'Review Recent Results',
        'View lab results from the last month',
        COMMAND_CATEGORIES.QUICK_ACTION,
        <AssessmentIcon />,
        () => {
          quickActions.reviewRecentResults();
          onClose();
        },
        ['results', 'labs', 'recent']
      ),
      
      createCommand(
        'quick-start-note',
        'Start Clinical Note',
        'Begin documenting for current encounter',
        COMMAND_CATEGORIES.QUICK_ACTION,
        <DocumentIcon />,
        () => {
          quickActions.startDocumentation();
          onClose();
        },
        ['note', 'documentation', 'soap']
      ),
      
      createCommand(
        'quick-med-review',
        'Review Medications',
        'View and reconcile current medications',
        COMMAND_CATEGORIES.QUICK_ACTION,
        <MedicationIcon />,
        () => {
          quickActions.reviewMedications();
          onClose();
        },
        ['medications', 'drugs', 'prescriptions']
      ),
      
      createCommand(
        'quick-create-orders',
        'Create Orders',
        'Start new clinical orders',
        COMMAND_CATEGORIES.QUICK_ACTION,
        <AssignmentIcon />,
        () => {
          quickActions.createOrders();
          onClose();
        },
        ['orders', 'labs', 'imaging']
      ),

      // Navigation commands
      createCommand(
        'nav-patient-list',
        'Go to Patient List',
        'View all patients',
        COMMAND_CATEGORIES.NAVIGATION,
        <PersonIcon />,
        () => {
          navigate('/patients');
          onClose();
        },
        ['patients', 'list', 'registry']
      ),
      
      createCommand(
        'nav-schedule',
        'Go to Schedule',
        'View appointment schedule',
        COMMAND_CATEGORIES.NAVIGATION,
        <TimelineIcon />,
        () => {
          navigate('/schedule');
          onClose();
        },
        ['appointments', 'calendar', 'schedule']
      ),
      
      createCommand(
        'nav-settings',
        'Go to Settings',
        'Application settings',
        COMMAND_CATEGORIES.NAVIGATION,
        <SettingsIcon />,
        () => {
          navigate('/settings');
          onClose();
        },
        ['preferences', 'configuration']
      ),
    ];

    // Add patient-specific commands if a patient is selected
    if (currentPatient) {
      baseCommands.push(
        createCommand(
          'patient-dashboard',
          'Patient Dashboard',
          `View dashboard for ${currentPatient.name?.[0]?.given?.join(' ')} ${currentPatient.name?.[0]?.family}`,
          COMMAND_CATEGORIES.PATIENT,
          <PersonIcon />,
          () => {
            navigate(`/patients/${encodeFhirId(currentPatient.id)}`);
            onClose();
          },
          ['dashboard', 'summary']
        ),
        
        createCommand(
          'patient-timeline',
          'Patient Timeline',
          'View clinical event timeline',
          COMMAND_CATEGORIES.PATIENT,
          <TimelineIcon />,
          () => {
            navigate(`/patients/${encodeFhirId(currentPatient.id)}/clinical?mode=chart-review`);
            onClose();
          },
          ['timeline', 'history', 'events']
        )
      );
    }

    return baseCommands;
  }, [currentPatient, changeWorkflowMode, navigate, quickActions, WORKFLOW_MODES, onClose]);

  // Search for patients
  const searchPatients = useCallback(async (query) => {
    if (query.length < 2) return [];
    
    try {
      const results = await fhirClient.search('Patient', {
        name: query,
        _count: 5
      });
      
      return results.entry?.map(entry => {
        const patient = entry.resource;
        const name = patient.name?.[0];
        const displayName = `${name?.given?.join(' ')} ${name?.family}`;
        
        return createCommand(
          `patient-${patient.id}`,
          displayName,
          `MRN: ${patient.identifier?.[0]?.value || 'N/A'} | DOB: ${patient.birthDate || 'N/A'}`,
          COMMAND_CATEGORIES.SEARCH,
          <PersonIcon />,
          () => {
            navigate(`/patients/${encodeFhirId(patient.id)}`);
            onClose();
          },
          [displayName.toLowerCase(), patient.identifier?.[0]?.value?.toLowerCase()]
        );
      }) || [];
    } catch (error) {
      console.error('Patient search error:', error);
      return [];
    }
  }, [navigate, onClose]);

  // Filter and search commands
  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery) {
        // Show recent and favorite commands when no search
        const combined = [
          ...favoriteCommands.map(id => commands.find(c => c.id === id)).filter(Boolean),
          ...recentCommands.slice(0, 3).map(id => commands.find(c => c.id === id)).filter(Boolean)
        ];
        setSearchResults(combined.slice(0, 8));
        return;
      }

      setIsSearching(true);
      const query = searchQuery.toLowerCase();
      
      // Filter existing commands
      const filteredCommands = commands.filter(command => 
        command.keywords.some(keyword => keyword.includes(query))
      );

      // Search for patients if query looks like a name
      let patientResults = [];
      if (query.length >= 2 && !query.startsWith('/')) {
        patientResults = await searchPatients(query);
      }

      // Combine and sort results
      const allResults = [...filteredCommands, ...patientResults];
      allResults.sort((a, b) => {
        // Prioritize exact matches
        const aExact = a.keywords.some(k => k === query);
        const bExact = b.keywords.some(k => k === query);
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // Then by category priority
        const categoryPriority = {
          [COMMAND_CATEGORIES.QUICK_ACTION]: 0,
          [COMMAND_CATEGORIES.WORKFLOW]: 1,
          [COMMAND_CATEGORIES.PATIENT]: 2,
          [COMMAND_CATEGORIES.SEARCH]: 3,
          [COMMAND_CATEGORIES.NAVIGATION]: 4
        };
        
        return (categoryPriority[a.category] || 5) - (categoryPriority[b.category] || 5);
      });

      setSearchResults(allResults.slice(0, 10));
      setIsSearching(false);
    };

    const debounceTimer = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, commands, favoriteCommands, recentCommands, searchPatients]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!open) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % searchResults.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (searchResults[selectedIndex]) {
            executeCommand(searchResults[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, selectedIndex, searchResults, onClose]);

  // Execute command and save to recent
  const executeCommand = useCallback((command) => {
    command.action();
    
    // Save to recent commands
    const newRecent = [command.id, ...recentCommands.filter(id => id !== command.id)].slice(0, 10);
    setRecentCommands(newRecent);
    localStorage.setItem('commandPalette-recent', JSON.stringify(newRecent));
  }, [recentCommands]);

  // Toggle favorite
  const toggleFavorite = useCallback((commandId, e) => {
    e.stopPropagation();
    const newFavorites = favoriteCommands.includes(commandId)
      ? favoriteCommands.filter(id => id !== commandId)
      : [...favoriteCommands, commandId];
    
    setFavoriteCommands(newFavorites);
    localStorage.setItem('commandPalette-favorites', JSON.stringify(newFavorites));
  }, [favoriteCommands]);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  // Get category icon
  const getCategoryIcon = (category) => {
    switch (category) {
      case COMMAND_CATEGORIES.WORKFLOW:
        return <DashboardIcon fontSize="small" />;
      case COMMAND_CATEGORIES.QUICK_ACTION:
        return <QuickActionIcon fontSize="small" />;
      case COMMAND_CATEGORIES.PATIENT:
        return <PersonIcon fontSize="small" />;
      case COMMAND_CATEGORIES.SEARCH:
        return <SearchIcon fontSize="small" />;
      case COMMAND_CATEGORIES.NAVIGATION:
        return <CategoryIcon fontSize="small" />;
      default:
        return null;
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
          position: 'fixed',
          top: '20%',
          transform: 'translateY(-20%)',
          maxHeight: '60vh',
          overflow: 'visible'
        }
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <TextField
            fullWidth
            placeholder="Type a command or search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={onClose}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
              sx: {
                '& fieldset': { border: 'none' }
              }
            }}
          />
        </Box>

        <Box sx={{ maxHeight: '400px', overflow: 'auto' }}>
          {searchResults.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                {isSearching ? 'Searching...' : 'No commands found'}
              </Typography>
            </Box>
          ) : (
            <List sx={{ py: 1 }}>
              {searchResults.map((command, index) => (
                <ListItem
                  key={command.id}
                  button
                  selected={selectedIndex === index}
                  onClick={() => executeCommand(command)}
                  sx={{
                    py: 1.5,
                    px: 2,
                    '&.Mui-selected': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.08)
                    }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {command.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={command.name}
                    secondary={command.description}
                    primaryTypographyProps={{ fontWeight: 500 }}
                  />
                  <ListItemSecondaryAction sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {recentCommands.includes(command.id) && (
                      <HistoryIcon fontSize="small" color="action" />
                    )}
                    <IconButton
                      size="small"
                      onClick={(e) => toggleFavorite(command.id, e)}
                      color={favoriteCommands.includes(command.id) ? 'primary' : 'default'}
                    >
                      <FavoriteIcon fontSize="small" />
                    </IconButton>
                    <Chip
                      label={command.category.replace('-', ' ')}
                      size="small"
                      icon={getCategoryIcon(command.category)}
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </Box>

        <Box 
          sx={{ 
            p: 1, 
            borderTop: 1, 
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'background.default'
          }}
        >
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ArrowUpIcon fontSize="small" /> <ArrowDownIcon fontSize="small" /> Navigate
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <EnterIcon fontSize="small" /> Select
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Press ESC to close
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default CommandPalette;