/**
 * Quality Measure Documentation Prompts Component
 * Displays quality measure documentation prompts for HEDIS, MIPS, etc.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Stack,
  Button,
  IconButton,
  Tooltip,
  Collapse,
  Badge,
  Card,
  CardContent,
  CardActions,
  Divider,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Assessment as QualityIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Assignment as TaskIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as CheckIcon,
  Schedule as ClockIcon,
  Star as StarIcon,
  Description as NoteIcon,
  Visibility as ViewIcon,
  Create as CreateIcon,
  MonitorHeart as ClinicalIcon,
  Security as SafetyIcon,
  Healing as PreventiveIcon,
  Psychology as BehavioralIcon,
  LocalHospital as MedicalIcon
} from '@mui/icons-material';

import { qualityMeasureDocumentationService } from '../../../services/qualityMeasureDocumentationService';
import { useClinicalWorkflow } from '../../../contexts/ClinicalWorkflowContext';

const QualityMeasurePrompts = ({ 
  patientId, 
  encounterId = null,
  onCreateNote,
  variant = 'inline', // 'inline', 'dialog', 'summary'
  showSummary = true
}) => {
  const [prompts, setPrompts] = useState([]);
  const [qualityStatus, setQualityStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [creating, setCreating] = useState(false);
  const { publish } = useClinicalWorkflow();

  // Load quality measure prompts
  useEffect(() => {
    if (patientId) {
      loadQualityPrompts();
    }
  }, [patientId, encounterId]);

  const loadQualityPrompts = useCallback(async () => {
    setLoading(true);
    try {
      // Initialize quality measures if needed
      await qualityMeasureDocumentationService.initializeQualityMeasures();
      
      const [prompts, status] = await Promise.all([
        qualityMeasureDocumentationService.generateQualityDocumentationPrompts(patientId, encounterId),
        qualityMeasureDocumentationService.assessPatientQualityStatus(patientId)
      ]);

      setPrompts(prompts);
      setQualityStatus(status);
    } catch (error) {
      // Failed to load quality measure prompts
    } finally {
      setLoading(false);
    }
  }, [patientId, encounterId]);

  const handleCreateNote = useCallback(async (prompt) => {
    if (creating) return;
    
    setCreating(true);
    try {
      if (onCreateNote) {
        await onCreateNote({
          title: prompt.title,
          content: prompt.content,
          template: prompt.template,
          context: prompt.context,
          metadata: {
            ...prompt.metadata,
            qualityMeasure: true,
            measureId: prompt.measureId
          }
        });
      }

      // Publish workflow event
      publish('QUALITY_DOCUMENTATION_CREATED', {
        patientId,
        encounterId,
        measureId: prompt.measureId,
        measureName: prompt.measureName,
        priority: prompt.priority,
        source: 'quality-prompts'
      });

      // Refresh prompts after creation
      await loadQualityPrompts();
      
    } catch (error) {
      // Failed to create quality measure note
    } finally {
      setCreating(false);
    }
  }, [onCreateNote, publish, patientId, encounterId, creating, loadQualityPrompts]);

  const handlePreviewPrompt = useCallback((prompt) => {
    setSelectedPrompt(prompt);
    setDetailsOpen(true);
  }, []);

  const getCategoryIcon = (category) => {
    switch (category?.toLowerCase()) {
      case 'clinical':
        return <ClinicalIcon color="primary" />;
      case 'preventive':
        return <PreventiveIcon color="success" />;
      case 'safety':
        return <SafetyIcon color="warning" />;
      case 'behavioral-health':
        return <BehavioralIcon color="secondary" />;
      default:
        return <MedicalIcon color="info" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  const getUrgencyIcon = (urgency) => {
    switch (urgency) {
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'info':
        return <InfoIcon color="info" />;
      case 'routine':
        return <ClockIcon color="action" />;
      default:
        return <TaskIcon color="action" />;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <CircularProgress size={24} sx={{ mr: 1 }} />
        <Typography variant="body2">Loading quality measures...</Typography>
      </Box>
    );
  }

  if (variant === 'summary') {
    const highPriorityCount = prompts.filter(p => p.priority === 'high').length;
    const totalPrompts = prompts.length;
    
    return (
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2}>
            <QualityIcon color="primary" />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6">Quality Measures</Typography>
              <Typography variant="body2" color="text.secondary">
                {totalPrompts} documentation prompt(s)
              </Typography>
            </Box>
            {highPriorityCount > 0 && (
              <Badge badgeContent={highPriorityCount} color="error">
                <WarningIcon />
              </Badge>
            )}
          </Stack>
          
          {totalPrompts > 0 && (
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Chip
                label={`${highPriorityCount} High Priority`}
                size="small"
                color="error"
                variant="outlined"
              />
              <Chip
                label={`${prompts.filter(p => p.priority === 'medium').length} Medium`}
                size="small"
                color="warning"
                variant="outlined"
              />
              <Chip
                label={`${prompts.filter(p => p.priority === 'low').length} Low`}
                size="small"
                color="info"
                variant="outlined"
              />
            </Stack>
          )}
        </CardContent>
        
        {totalPrompts > 0 && (
          <CardActions>
            <Button
              size="small"
              startIcon={<ViewIcon />}
              onClick={() => setDetailsOpen(true)}
            >
              View Details
            </Button>
          </CardActions>
        )}
      </Card>
    );
  }

  if (prompts.length === 0) {
    return (
      <Alert severity="success" variant="outlined">
        <Typography variant="body2">
          No quality measure documentation needed at this time.
        </Typography>
      </Alert>
    );
  }

  return (
    <Box>
      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Box
          sx={{
            p: 2,
            backgroundColor: 'primary.light',
            cursor: 'pointer'
          }}
          onClick={() => setExpanded(!expanded)}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <QualityIcon color="primary" />
            <Typography variant="h6" color="primary.main" sx={{ flexGrow: 1 }}>
              Quality Measure Documentation
            </Typography>
            <Badge badgeContent={prompts.length} color="primary">
              <TaskIcon />
            </Badge>
            <IconButton size="small" color="primary">
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Stack>
        </Box>

        <Collapse in={expanded}>
          <Box sx={{ p: 2 }}>
            {/* High Priority Prompts */}
            {prompts.some(p => p.priority === 'high') && (
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <WarningIcon color="error" />
                    <Typography variant="subtitle1" color="error.main">
                      High Priority ({prompts.filter(p => p.priority === 'high').length})
                    </Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <List disablePadding>
                    {prompts
                      .filter(prompt => prompt.priority === 'high')
                      .map((prompt, index) => (
                        <ListItem
                          key={prompt.id}
                          divider={index < prompts.filter(p => p.priority === 'high').length - 1}
                          sx={{ py: 2 }}
                        >
                          <ListItemIcon>
                            {getCategoryIcon(prompt.category)}
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <Typography variant="subtitle2">
                                  {prompt.measureName}
                                </Typography>
                                <Chip
                                  label={prompt.urgency}
                                  size="small"
                                  color={getPriorityColor(prompt.priority)}
                                  variant="filled"
                                />
                              </Stack>
                            }
                            secondary={
                              <Box sx={{ mt: 1 }}>
                                <Typography variant="body2" gutterBottom>
                                  {prompt.description}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Suggested Actions: {prompt.suggestedActions.slice(0, 2).join(', ')}
                                  {prompt.suggestedActions.length > 2 && '...'}
                                </Typography>
                              </Box>
                            }
                          />
                          <ListItemSecondaryAction>
                            <Stack direction="row" spacing={1}>
                              <Tooltip title="Preview content">
                                <IconButton 
                                  size="small"
                                  onClick={() => handlePreviewPrompt(prompt)}
                                >
                                  <ViewIcon />
                                </IconButton>
                              </Tooltip>
                              <Button
                                variant="contained"
                                size="small"
                                startIcon={<CreateIcon />}
                                onClick={() => handleCreateNote(prompt)}
                                disabled={creating}
                                color={getPriorityColor(prompt.priority)}
                              >
                                Create Note
                              </Button>
                            </Stack>
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            )}

            {/* Medium/Low Priority Prompts */}
            {prompts.some(p => p.priority !== 'high') && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <InfoIcon color="info" />
                    <Typography variant="subtitle1">
                      Other Quality Measures ({prompts.filter(p => p.priority !== 'high').length})
                    </Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <List disablePadding>
                    {prompts
                      .filter(prompt => prompt.priority !== 'high')
                      .map((prompt, index) => (
                        <ListItem
                          key={prompt.id}
                          divider={index < prompts.filter(p => p.priority !== 'high').length - 1}
                        >
                          <ListItemIcon>
                            {getCategoryIcon(prompt.category)}
                          </ListItemIcon>
                          <ListItemText
                            primary={prompt.measureName}
                            secondary={
                              <Box sx={{ mt: 0.5 }}>
                                <Typography variant="body2" gutterBottom>
                                  {prompt.description}
                                </Typography>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Chip
                                    label={prompt.priority}
                                    size="small"
                                    color={getPriorityColor(prompt.priority)}
                                    variant="outlined"
                                  />
                                  <Typography variant="caption">
                                    {prompt.category}
                                  </Typography>
                                </Stack>
                              </Box>
                            }
                          />
                          <ListItemSecondaryAction>
                            <Stack direction="row" spacing={1}>
                              <IconButton 
                                size="small"
                                onClick={() => handlePreviewPrompt(prompt)}
                              >
                                <ViewIcon />
                              </IconButton>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<CreateIcon />}
                                onClick={() => handleCreateNote(prompt)}
                                disabled={creating}
                              >
                                Document
                              </Button>
                            </Stack>
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            )}

            {/* Quality Status Summary */}
            {qualityStatus && showSummary && (
              <Box sx={{ mt: 2 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" gutterBottom>
                  Quality Measure Status Summary:
                </Typography>
                <Grid container spacing={1}>
                  <Grid item>
                    <Chip
                      icon={<CheckIcon />}
                      label={`${qualityStatus.eligibleMeasures.length} Eligible`}
                      size="small"
                      variant="outlined"
                      color="primary"
                    />
                  </Grid>
                  <Grid item>
                    <Chip
                      icon={<WarningIcon />}
                      label={`${qualityStatus.documentationNeeded.length} Need Documentation`}
                      size="small"
                      variant="outlined"
                      color="warning"
                    />
                  </Grid>
                  {qualityStatus.recommendations.length > 0 && (
                    <Grid item>
                      <Chip
                        icon={<StarIcon />}
                        label={`${qualityStatus.recommendations.length} Recommendations`}
                        size="small"
                        variant="outlined"
                        color="info"
                      />
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}
          </Box>
        </Collapse>
      </Paper>

      {/* Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={2}>
            <QualityIcon />
            <Typography variant="h6">
              {selectedPrompt ? `${selectedPrompt.measureName} - Documentation` : 'Quality Measure Details'}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedPrompt ? (
            <Box>
              <Box sx={{ mb: 3 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  <Chip
                    label={selectedPrompt.priority}
                    color={getPriorityColor(selectedPrompt.priority)}
                    variant="filled"
                  />
                  <Chip
                    label={selectedPrompt.category}
                    variant="outlined"
                  />
                  {getUrgencyIcon(selectedPrompt.urgency)}
                </Stack>
                
                <Typography variant="h6" gutterBottom>
                  {selectedPrompt.title}
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                  {selectedPrompt.description}
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle1" gutterBottom>
                Suggested Actions:
              </Typography>
              <List dense>
                {selectedPrompt.suggestedActions.map((action, index) => (
                  <ListItem key={index} sx={{ py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <TaskIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={action} />
                  </ListItem>
                ))}
              </List>

              {selectedPrompt.missingDocumentation.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Missing Documentation:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {selectedPrompt.missingDocumentation.map((item, index) => (
                      <Chip
                        key={index}
                        label={item.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        size="small"
                        variant="outlined"
                        color="warning"
                      />
                    ))}
                  </Stack>
                </Box>
              )}

              <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Generated content preview (first 200 characters):
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, fontFamily: 'monospace' }}>
                  {selectedPrompt.content.substring(0, 200)}...
                </Typography>
              </Box>
            </Box>
          ) : (
            <Typography>Select a quality measure prompt to view details.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          {selectedPrompt && (
            <Button
              variant="contained"
              startIcon={<CreateIcon />}
              onClick={() => {
                handleCreateNote(selectedPrompt);
                setDetailsOpen(false);
              }}
              disabled={creating}
            >
              Create Documentation Note
            </Button>
          )}
          <Button onClick={() => setDetailsOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QualityMeasurePrompts;