/**
 * Natural Language Input Component
 * Provides interface for users to describe what they want in plain English
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  TextField,
  Button,
  Paper,
  Typography,
  Chip,
  Stack,
  InputAdornment,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material';
import {
  Send as SendIcon,
  MicNone as MicIcon,
  AutoAwesome as AutoAwesomeIcon,
  History as HistoryIcon,
  Lightbulb as LightbulbIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { useUIComposer } from '../contexts/UIComposerContext';
import useClaudeStatus from '../hooks/useClaudeStatus';

const EXAMPLE_REQUESTS = [
  {
    category: 'Patient Views',
    examples: [
      'Show all diabetic patients with recent HbA1c > 8',
      'Display patient demographics and contact information',
      'Create a patient list sorted by last visit date'
    ]
  },
  {
    category: 'Clinical Dashboards',
    examples: [
      'Create a medication adherence dashboard for hypertensive patients',
      'Show vital signs trends for the last 6 months',
      'Display lab results with abnormal values highlighted'
    ]
  },
  {
    category: 'Data Visualizations',
    examples: [
      'Chart blood pressure readings over time',
      'Bar chart of most common diagnoses',
      'Timeline of patient encounters and procedures'
    ]
  },
  {
    category: 'Clinical Forms',
    examples: [
      'Build an order entry form with decision support',
      'Create a medication reconciliation form',
      'Design a patient assessment form'
    ]
  }
];

const NaturalLanguageInput = () => {
  const {
    currentRequest,
    setCurrentRequest,
    canGenerate,
    isLoading,
    conversation,
    addConversationEntry
  } = useUIComposer();
  
  const claudeStatus = useClaudeStatus();
  
  const [inputValue, setInputValue] = useState(currentRequest || '');
  const [examplesMenuAnchor, setExamplesMenuAnchor] = useState(null);
  const [historyMenuAnchor, setHistoryMenuAnchor] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const textFieldRef = useRef(null);
  
  // Handle input changes
  const handleInputChange = useCallback((event) => {
    setInputValue(event.target.value);
  }, []);
  
  // Handle form submission
  const handleSubmit = useCallback((event) => {
    event.preventDefault();
    if (inputValue.trim() && !isLoading) {
      setCurrentRequest(inputValue.trim());
      addConversationEntry({
        type: 'user_request',
        content: inputValue.trim(),
        timestamp: new Date().toISOString()
      });
    }
  }, [inputValue, isLoading, setCurrentRequest, addConversationEntry]);
  
  // Handle example selection
  const handleExampleSelect = useCallback((example) => {
    setInputValue(example);
    setExamplesMenuAnchor(null);
    textFieldRef.current?.focus();
  }, []);
  
  // Handle history selection
  const handleHistorySelect = useCallback((historyItem) => {
    setInputValue(historyItem.content);
    setHistoryMenuAnchor(null);
    textFieldRef.current?.focus();
  }, []);
  
  // Handle clear input
  const handleClear = useCallback(() => {
    setInputValue('');
    setCurrentRequest('');
    textFieldRef.current?.focus();
  }, [setCurrentRequest]);
  
  // Handle voice input (placeholder)
  const handleVoiceInput = useCallback(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => {
        setIsRecording(true);
      };
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(transcript);
        setIsRecording(false);
      };
      
      recognition.onerror = () => {
        setIsRecording(false);
      };
      
      recognition.onend = () => {
        setIsRecording(false);
      };
      
      recognition.start();
    } else {
      // Fallback for browsers without speech recognition
      alert('Speech recognition not supported in this browser');
    }
  }, []);
  
  // Get recent history items
  const recentHistory = conversation
    .filter(entry => entry.type === 'user_request')
    .slice(-5)
    .reverse();
  
  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Box mb={2}>
        <Typography variant="h6" gutterBottom>
          Describe what you want to create
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Use natural language to describe the clinical interface you need. 
          Be specific about the data you want to see and how you want it displayed.
        </Typography>
      </Box>
      
      <Box component="form" onSubmit={handleSubmit}>
        <TextField
          ref={textFieldRef}
          fullWidth
          multiline
          rows={3}
          variant="outlined"
          placeholder="Example: Show all diabetic patients with recent HbA1c > 8 in a table with their medication adherence rates"
          value={inputValue}
          onChange={handleInputChange}
          disabled={isLoading || !claudeStatus.available}
          helperText={!claudeStatus.available ? "Claude Code must be running to use this feature" : ""}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Stack direction="row" spacing={1}>
                  {inputValue && (
                    <Tooltip title="Clear input">
                      <IconButton
                        onClick={handleClear}
                        size="small"
                        disabled={isLoading}
                      >
                        <ClearIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  
                  <Tooltip title="Voice input">
                    <IconButton
                      onClick={handleVoiceInput}
                      size="small"
                      disabled={isLoading}
                      color={isRecording ? 'primary' : 'default'}
                    >
                      <MicIcon />
                    </IconButton>
                  </Tooltip>
                  
                  <Tooltip title="Examples">
                    <IconButton
                      onClick={(e) => setExamplesMenuAnchor(e.currentTarget)}
                      size="small"
                      disabled={isLoading}
                    >
                      <LightbulbIcon />
                    </IconButton>
                  </Tooltip>
                  
                  {recentHistory.length > 0 && (
                    <Tooltip title="Recent requests">
                      <IconButton
                        onClick={(e) => setHistoryMenuAnchor(e.currentTarget)}
                        size="small"
                        disabled={isLoading}
                      >
                        <HistoryIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </InputAdornment>
            )
          }}
          sx={{ mb: 2 }}
        />
        
        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            type="submit"
            variant="contained"
            startIcon={<AutoAwesomeIcon />}
            disabled={!inputValue.trim() || isLoading || !claudeStatus.available}
            sx={{ minWidth: 120 }}
          >
            {!claudeStatus.available ? 'Claude Required' : isLoading ? 'Generating...' : 'Generate UI'}
          </Button>
          
          {isLoading && (
            <Typography variant="body2" color="text.secondary">
              AI agents are working on your request...
            </Typography>
          )}
        </Stack>
      </Box>
      
      {/* Examples Menu */}
      <Menu
        anchorEl={examplesMenuAnchor}
        open={Boolean(examplesMenuAnchor)}
        onClose={() => setExamplesMenuAnchor(null)}
        PaperProps={{
          sx: { maxWidth: 400, maxHeight: 400 }
        }}
      >
        <Box sx={{ p: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Example Requests
          </Typography>
        </Box>
        
        {EXAMPLE_REQUESTS.map((category, categoryIndex) => (
          <Box key={categoryIndex}>
            <MenuItem disabled>
              <ListItemText
                primary={category.category}
                primaryTypographyProps={{
                  variant: 'subtitle2',
                  color: 'primary'
                }}
              />
            </MenuItem>
            
            {category.examples.map((example, exampleIndex) => (
              <MenuItem
                key={exampleIndex}
                onClick={() => handleExampleSelect(example)}
                sx={{ pl: 3 }}
              >
                <ListItemText
                  primary={example}
                  primaryTypographyProps={{
                    variant: 'body2'
                  }}
                />
              </MenuItem>
            ))}
            
            {categoryIndex < EXAMPLE_REQUESTS.length - 1 && <Divider />}
          </Box>
        ))}
      </Menu>
      
      {/* History Menu */}
      <Menu
        anchorEl={historyMenuAnchor}
        open={Boolean(historyMenuAnchor)}
        onClose={() => setHistoryMenuAnchor(null)}
        PaperProps={{
          sx: { maxWidth: 400, maxHeight: 300 }
        }}
      >
        <Box sx={{ p: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Recent Requests
          </Typography>
        </Box>
        
        {recentHistory.map((item, index) => (
          <MenuItem
            key={index}
            onClick={() => handleHistorySelect(item)}
          >
            <ListItemIcon>
              <HistoryIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={item.content}
              secondary={new Date(item.timestamp).toLocaleString()}
              primaryTypographyProps={{
                variant: 'body2',
                noWrap: true
              }}
              secondaryTypographyProps={{
                variant: 'caption'
              }}
            />
          </MenuItem>
        ))}
        
        {recentHistory.length === 0 && (
          <MenuItem disabled>
            <ListItemText
              primary="No recent requests"
              primaryTypographyProps={{
                variant: 'body2',
                color: 'text.secondary'
              }}
            />
          </MenuItem>
        )}
      </Menu>
      
      {/* Quick Tips */}
      <Box mt={2}>
        <Typography variant="caption" color="text.secondary" gutterBottom>
          Quick Tips:
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            label="Be specific about data types"
            size="small"
            variant="outlined"
            onClick={() => handleExampleSelect('Show all patients with diabetes')}
          />
          <Chip
            label="Mention visualization type"
            size="small"
            variant="outlined"
            onClick={() => handleExampleSelect('Create a bar chart of')}
          />
          <Chip
            label="Include time ranges"
            size="small"
            variant="outlined"
            onClick={() => handleExampleSelect('Show data from the last 6 months')}
          />
          <Chip
            label="Specify filters"
            size="small"
            variant="outlined"
            onClick={() => handleExampleSelect('Filter by active patients only')}
          />
        </Stack>
      </Box>
    </Paper>
  );
};

export default NaturalLanguageInput;