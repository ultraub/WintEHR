/**
 * Feedback Interface Component
 * Human-in-the-loop feedback tools for UI refinement
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Chip,
  Stack,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
  Collapse,
  Card,
  CardContent,
  Avatar,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Send as SendIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ColorLens as ColorLensIcon,
  AspectRatio as ResizeIcon,
  SwapHoriz as SwapHorizIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  History as HistoryIcon,
  AutoAwesome as SmartIcon
} from '@mui/icons-material';
import { useUIComposer } from '../contexts/UIComposerContext';

const FEEDBACK_TYPES = [
  { id: 'general', label: 'General', icon: <EditIcon /> },
  { id: 'color', label: 'Color', icon: <ColorLensIcon /> },
  { id: 'size', label: 'Size', icon: <ResizeIcon /> },
  { id: 'layout', label: 'Layout', icon: <SwapHorizIcon /> },
  { id: 'add', label: 'Add Component', icon: <AddIcon /> },
  { id: 'remove', label: 'Remove', icon: <DeleteIcon /> }
];

const QUICK_FEEDBACK_OPTIONS = [
  { text: 'Make the chart bigger', type: 'size' },
  { text: 'Change to a bar chart', type: 'general' },
  { text: 'Add a filter', type: 'add' },
  { text: 'Change the colors', type: 'color' },
  { text: 'Remove this component', type: 'remove' },
  { text: 'Show more data', type: 'general' }
];

const FeedbackInterface = () => {
  const {
    currentSpec,
    feedback,
    addFeedback,
    conversation,
    addConversationEntry,
    isLoading
  } = useUIComposer();
  
  const [feedbackText, setFeedbackText] = useState('');
  const [selectedFeedbackType, setSelectedFeedbackType] = useState('general');
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [showFeedbackHistory, setShowFeedbackHistory] = useState(false);
  const [quickFeedbackMenuAnchor, setQuickFeedbackMenuAnchor] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Handle feedback submission
  const handleSubmitFeedback = useCallback(async () => {
    if (!feedbackText.trim()) return;
    
    setSubmitting(true);
    
    try {
      const feedbackEntry = {
        text: feedbackText,
        type: selectedFeedbackType,
        componentId: selectedComponent,
        timestamp: new Date().toISOString()
      };
      
      // Add to feedback history
      addFeedback(feedbackEntry);
      
      // Add to conversation
      addConversationEntry({
        type: 'user_feedback',
        content: feedbackText,
        feedbackType: selectedFeedbackType,
        componentId: selectedComponent
      });
      
      // Clear form
      setFeedbackText('');
      setSelectedComponent(null);
      
      // TODO: Process feedback through refinement agent
      // This would be implemented to actually refine the UI
      
    } catch (error) {
      // Error submitting feedback
    } finally {
      setSubmitting(false);
    }
  }, [feedbackText, selectedFeedbackType, selectedComponent, addFeedback, addConversationEntry]);
  
  // Handle quick feedback
  const handleQuickFeedback = useCallback((quickFeedback) => {
    setFeedbackText(quickFeedback.text);
    setSelectedFeedbackType(quickFeedback.type);
    setQuickFeedbackMenuAnchor(null);
  }, []);
  
  // Handle feedback type change
  const handleFeedbackTypeChange = useCallback((type) => {
    setSelectedFeedbackType(type);
  }, []);
  
  // Handle component selection
  const handleComponentSelect = useCallback((componentId) => {
    setSelectedComponent(componentId);
  }, []);
  
  // Get recent feedback
  const recentFeedback = feedback.slice(-5).reverse();
  
  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Feedback & Refinement
        </Typography>
        
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<SmartIcon />}
            onClick={(e) => setQuickFeedbackMenuAnchor(e.currentTarget)}
          >
            Quick Feedback
          </Button>
          
          <Button
            size="small"
            variant="outlined"
            startIcon={<HistoryIcon />}
            onClick={() => setShowFeedbackHistory(!showFeedbackHistory)}
          >
            History
          </Button>
        </Stack>
      </Box>
      
      {/* Feedback Form */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Tell us how to improve this UI:
        </Typography>
        
        {/* Feedback Type Selector */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Feedback Type:
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {FEEDBACK_TYPES.map((type) => (
              <Chip
                key={type.id}
                label={type.label}
                icon={type.icon}
                onClick={() => handleFeedbackTypeChange(type.id)}
                color={selectedFeedbackType === type.id ? 'primary' : 'default'}
                variant={selectedFeedbackType === type.id ? 'filled' : 'outlined'}
                size="small"
              />
            ))}
          </Stack>
        </Box>
        
        {/* Component Selector */}
        {currentSpec && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Component (optional):
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="Select a component or leave blank for general feedback"
              value={selectedComponent || ''}
              onChange={(e) => setSelectedComponent(e.target.value)}
              variant="outlined"
            />
          </Box>
        )}
        
        {/* Feedback Text */}
        <TextField
          fullWidth
          multiline
          rows={3}
          placeholder="Example: Make the chart bigger, change to blue colors, add a filter for date range..."
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          variant="outlined"
          sx={{ mb: 2 }}
        />
        
        {/* Submit Button */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              variant="contained"
              onClick={handleSubmitFeedback}
              disabled={!feedbackText.trim() || submitting || isLoading}
              startIcon={<SendIcon />}
            >
              {submitting ? 'Refining...' : 'Refine UI'}
            </Button>
            
            {isLoading && (
              <Typography variant="body2" color="text.secondary">
                Processing your feedback...
              </Typography>
            )}
          </Stack>
          
          <Stack direction="row" spacing={1}>
            <Tooltip title="I like this UI">
              <IconButton size="small" color="success">
                <ThumbUpIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="I don't like this UI">
              <IconButton size="small" color="error">
                <ThumbDownIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </Box>
      
      {/* Quick Feedback Menu */}
      <Menu
        anchorEl={quickFeedbackMenuAnchor}
        open={Boolean(quickFeedbackMenuAnchor)}
        onClose={() => setQuickFeedbackMenuAnchor(null)}
      >
        {QUICK_FEEDBACK_OPTIONS.map((option, index) => (
          <MenuItem
            key={index}
            onClick={() => handleQuickFeedback(option)}
          >
            <ListItemText primary={option.text} />
          </MenuItem>
        ))}
      </Menu>
      
      {/* Feedback History */}
      <Collapse in={showFeedbackHistory}>
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Recent Feedback
          </Typography>
          
          {recentFeedback.length === 0 ? (
            <Alert severity="info">
              No feedback provided yet. Share your thoughts to improve the UI!
            </Alert>
          ) : (
            <Stack spacing={1}>
              {recentFeedback.map((item) => (
                <Card key={item.id} elevation={0} variant="outlined">
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.main' }}>
                        <Typography variant="caption">U</Typography>
                      </Avatar>
                      
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Chip
                            label={item.type}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                          <Typography variant="caption" color="text.secondary">
                            {new Date(item.timestamp).toLocaleString()}
                          </Typography>
                        </Box>
                        
                        <Typography variant="body2">
                          {item.text}
                        </Typography>
                        
                        {item.componentId && (
                          <Typography variant="caption" color="text.secondary">
                            Component: {item.componentId}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </Box>
      </Collapse>
      
      {/* Tips */}
      <Box sx={{ mt: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="caption" color="text.secondary" gutterBottom>
          Tips for better feedback:
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            label="Be specific"
            size="small"
            variant="outlined"
            onClick={() => setFeedbackText('Make the chart 200px taller')}
          />
          <Chip
            label="Mention colors"
            size="small"
            variant="outlined"
            onClick={() => setFeedbackText('Change the bars to blue')}
          />
          <Chip
            label="Request features"
            size="small"
            variant="outlined"
            onClick={() => setFeedbackText('Add a date range filter')}
          />
          <Chip
            label="Layout changes"
            size="small"
            variant="outlined"
            onClick={() => setFeedbackText('Move the legend to the bottom')}
          />
        </Stack>
      </Box>
    </Paper>
  );
};

export default FeedbackInterface;