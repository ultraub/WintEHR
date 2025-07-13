/**
 * Lab Care Recommendations Component
 * Displays care recommendations based on lab results
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  IconButton,
  Collapse,
  Alert,
  AlertTitle,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Badge
} from '@mui/material';
import {
  TrendingUp as AdjustmentIcon,
  Science as DiagnosticIcon,
  Science,
  Warning as CriticalIcon,
  Schedule as MonitoringIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as ApplyIcon,
  Assignment as TaskIcon,
  Share as ShareIcon,
  Psychology as ReasoningIcon,
  MedicalServices as ProtocolIcon,
  Assessment as AssessmentIcon,
  Close as CloseIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { labToCareIntegrationService } from '../../../services/labToCareIntegrationService';
import { fhirClient } from '../../../services/fhirClient';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../contexts/ClinicalWorkflowContext';
import { format } from 'date-fns';

const LabCareRecommendations = ({ patientId, observations, carePlanId, onRecommendationApplied }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [applyingRecommendation, setApplyingRecommendation] = useState(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);
  const [shareNotes, setShareNotes] = useState('');
  const [selectedCareTeam, setSelectedCareTeam] = useState('');
  const [careTeams, setCareTeams] = useState([]);
  
  const { publish } = useClinicalWorkflow();

  useEffect(() => {
    if (patientId && observations?.length > 0) {
      loadRecommendations();
    }
  }, [patientId, observations]);

  useEffect(() => {
    if (patientId) {
      loadCareTeams();
    }
  }, [patientId]);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const recs = await labToCareIntegrationService.generateCareRecommendations(
        patientId,
        observations
      );
      setRecommendations(recs);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCareTeams = async () => {
    try {
      const response = await fhirClient.search('CareTeam', {
        patient: patientId,
        status: 'active'
      });
      setCareTeams(response.entry?.map(e => e.resource) || []);
    } catch (error) {
      console.error('Failed to load care teams:', error);
    }
  };

  const handleToggleExpand = (index) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedCards(newExpanded);
  };

  const handleApplyRecommendation = async (recommendation) => {
    setApplyingRecommendation(recommendation);
    
    try {
      let result;
      
      switch (recommendation.type) {
        case 'treatment-adjustment':
          // Create a task for the provider
          result = await createTreatmentAdjustmentTask(recommendation);
          break;
          
        case 'diagnostic-workup':
          // Create service requests for additional tests
          result = await createDiagnosticWorkupOrders(recommendation);
          break;
          
        case 'monitoring-due':
          // Create service request for the due test
          result = await createMonitoringOrder(recommendation);
          break;
          
        case 'critical-value':
          // Create high-priority task
          result = await createCriticalValueTask(recommendation);
          break;
      }
      
      // Update care plan if provided
      if (carePlanId && result) {
        await updateCarePlanWithRecommendation(carePlanId, recommendation, result);
      }
      
      // Publish event
      await publish(CLINICAL_EVENTS.CARE_PLAN_UPDATED, {
        patientId,
        carePlanId,
        recommendationType: recommendation.type,
        recommendationApplied: true,
        timestamp: new Date().toISOString()
      });
      
      // Notify parent
      if (onRecommendationApplied) {
        onRecommendationApplied(recommendation, result);
      }
      
      // Remove applied recommendation
      setRecommendations(prev => prev.filter(r => r !== recommendation));
      
    } catch (error) {
      console.error('Failed to apply recommendation:', error);
    } finally {
      setApplyingRecommendation(null);
    }
  };

  const createTreatmentAdjustmentTask = async (recommendation) => {
    const task = {
      resourceType: 'Task',
      status: 'requested',
      intent: 'order',
      priority: recommendation.priority === 'high' ? 'urgent' : 'routine',
      code: {
        text: 'Treatment Adjustment Required'
      },
      description: recommendation.action,
      for: {
        reference: `Patient/${patientId}`
      },
      authoredOn: new Date().toISOString(),
      reasonCode: {
        text: recommendation.reasoning
      },
      note: [{
        text: `Based on ${recommendation.test}: ${recommendation.value}. Protocol: ${recommendation.protocol}`
      }]
    };
    
    return await fhirClient.create('Task', task);
  };

  const createDiagnosticWorkupOrders = async (recommendation) => {
    const orders = [];
    
    for (const test of recommendation.additionalTests) {
      const order = {
        resourceType: 'ServiceRequest',
        status: 'active',
        intent: 'order',
        priority: 'routine',
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: test.code,
            display: test.name
          }]
        },
        subject: {
          reference: `Patient/${patientId}`
        },
        authoredOn: new Date().toISOString(),
        reasonCode: [{
          text: recommendation.reasoning
        }],
        note: [{
          text: `Part of diagnostic workup based on ${recommendation.test}: ${recommendation.value}`
        }]
      };
      
      const created = await fhirClient.create('ServiceRequest', order);
      orders.push(created);
    }
    
    return orders;
  };

  const createMonitoringOrder = async (recommendation) => {
    const order = {
      resourceType: 'ServiceRequest',
      status: 'active',
      intent: 'order',
      priority: recommendation.priority === 'high' ? 'urgent' : 'routine',
      code: {
        coding: [{
          system: 'http://loinc.org',
          code: recommendation.loincCode,
          display: recommendation.test
        }]
      },
      subject: {
        reference: `Patient/${patientId}`
      },
      authoredOn: new Date().toISOString(),
      reasonCode: [{
        text: `${recommendation.protocol} monitoring`
      }],
      note: [{
        text: recommendation.reasoning
      }]
    };
    
    if (recommendation.lastValue) {
      order.note.push({
        text: `Last value: ${recommendation.lastValue}`
      });
    }
    
    return await fhirClient.create('ServiceRequest', order);
  };

  const createCriticalValueTask = async (recommendation) => {
    const task = {
      resourceType: 'Task',
      status: 'requested',
      intent: 'order',
      priority: 'urgent',
      code: {
        text: 'Critical Value Follow-up'
      },
      description: recommendation.action,
      for: {
        reference: `Patient/${patientId}`
      },
      authoredOn: new Date().toISOString(),
      reasonCode: {
        text: recommendation.message
      },
      note: [{
        text: `Critical value: ${recommendation.test} = ${recommendation.value}`
      }],
      restriction: {
        period: {
          end: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() // Due in 4 hours
        }
      }
    };
    
    return await fhirClient.create('Task', task);
  };

  const updateCarePlanWithRecommendation = async (carePlanId, recommendation, result) => {
    try {
      const updates = Array.isArray(result) ? result : [result];
      await labToCareIntegrationService.updateCarePlanWithLabResults(
        carePlanId,
        [{
          ...recommendation,
          implemented: true,
          implementedResources: updates.map(u => ({
            reference: `${u.resourceType}/${u.id}`
          }))
        }]
      );
    } catch (error) {
      console.error('Failed to update care plan:', error);
    }
  };

  const handleShareRecommendation = (recommendation) => {
    setSelectedRecommendation(recommendation);
    setShareDialogOpen(true);
  };

  const handleShareSubmit = async () => {
    if (!selectedRecommendation || !selectedCareTeam) return;
    
    try {
      // Share the related observation with care team
      const observationIds = selectedRecommendation.relatedObservationId ? 
        [selectedRecommendation.relatedObservationId] : [];
      
      const notes = `Recommendation: ${selectedRecommendation.action}\n` +
                   `Reasoning: ${selectedRecommendation.reasoning}\n` +
                   `Additional notes: ${shareNotes}`;
      
      await labToCareIntegrationService.shareLabResultsWithCareTeam(
        observationIds,
        selectedCareTeam,
        notes
      );
      
      setShareDialogOpen(false);
      setShareNotes('');
      setSelectedCareTeam('');
      setSelectedRecommendation(null);
      
    } catch (error) {
      console.error('Failed to share recommendation:', error);
    }
  };

  const getRecommendationIcon = (type) => {
    switch (type) {
      case 'treatment-adjustment':
        return <AdjustmentIcon color="primary" />;
      case 'diagnostic-workup':
        return <DiagnosticIcon color="secondary" />;
      case 'monitoring-due':
        return <MonitoringIcon color="warning" />;
      case 'critical-value':
        return <CriticalIcon color="error" />;
      default:
        return <AssessmentIcon />;
    }
  };

  const getRecommendationColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Alert severity="info">
        <AlertTitle>No Recommendations</AlertTitle>
        All lab results are within expected ranges. No immediate actions required.
      </Alert>
    );
  }

  return (
    <Box>
      <Stack spacing={2}>
        {/* Summary */}
        <Alert severity="info" icon={<AssessmentIcon />}>
          <AlertTitle>Lab-Based Care Recommendations</AlertTitle>
          <Typography variant="body2">
            {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''} based on recent lab results
          </Typography>
        </Alert>

        {/* Recommendations */}
        {recommendations.map((recommendation, index) => (
          <Card key={index} elevation={2}>
            <CardContent>
              <Stack spacing={2}>
                {/* Header */}
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Stack direction="row" spacing={2} alignItems="center">
                    {getRecommendationIcon(recommendation.type)}
                    <Typography variant="h6">
                      {recommendation.action}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <Chip 
                      label={recommendation.priority} 
                      size="small" 
                      color={getRecommendationColor(recommendation.priority)}
                    />
                    <IconButton 
                      size="small"
                      onClick={() => handleToggleExpand(index)}
                    >
                      {expandedCards.has(index) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Stack>
                </Stack>

                {/* Basic Info */}
                <Stack direction="row" spacing={3}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <ProtocolIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {recommendation.protocol || recommendation.pattern || recommendation.type}
                    </Typography>
                  </Stack>
                  {recommendation.test && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Science fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {recommendation.test}: {recommendation.value}
                      </Typography>
                    </Stack>
                  )}
                </Stack>

                {/* Expanded Details */}
                <Collapse in={expandedCards.has(index)}>
                  <Stack spacing={2} sx={{ mt: 2 }}>
                    <Divider />
                    
                    {/* Reasoning */}
                    <Stack direction="row" spacing={2}>
                      <ReasoningIcon color="action" />
                      <Box flex={1}>
                        <Typography variant="subtitle2" gutterBottom>
                          Clinical Reasoning
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {recommendation.reasoning}
                        </Typography>
                      </Box>
                    </Stack>

                    {/* Additional Tests (for diagnostic workup) */}
                    {recommendation.additionalTests && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          Recommended Additional Tests
                        </Typography>
                        <List dense>
                          {recommendation.additionalTests.map((test, idx) => (
                            <ListItem key={idx}>
                              <ListItemIcon>
                                <Science fontSize="small" />
                              </ListItemIcon>
                              <ListItemText 
                                primary={test.name}
                                secondary={`LOINC: ${test.code}`}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}

                    {/* Last Value (for monitoring) */}
                    {recommendation.lastValue && (
                      <Typography variant="body2" color="text.secondary">
                        <strong>Last Value:</strong> {recommendation.lastValue}
                      </Typography>
                    )}
                  </Stack>
                </Collapse>
              </Stack>
            </CardContent>
            
            <CardActions>
              <Button
                startIcon={applyingRecommendation === recommendation ? 
                  <CircularProgress size={20} /> : <ApplyIcon />}
                onClick={() => handleApplyRecommendation(recommendation)}
                disabled={applyingRecommendation !== null}
                color="primary"
              >
                Apply Recommendation
              </Button>
              <Button
                startIcon={<ShareIcon />}
                onClick={() => handleShareRecommendation(recommendation)}
              >
                Share with Team
              </Button>
            </CardActions>
          </Card>
        ))}
      </Stack>

      {/* Share Dialog */}
      <Dialog 
        open={shareDialogOpen} 
        onClose={() => setShareDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Share Recommendation with Care Team
          <IconButton
            onClick={() => setShareDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {selectedRecommendation && (
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>Recommendation:</strong> {selectedRecommendation.action}
                </Typography>
              </Alert>
            )}
            
            <FormControl fullWidth>
              <InputLabel>Care Team</InputLabel>
              <Select
                value={selectedCareTeam}
                onChange={(e) => setSelectedCareTeam(e.target.value)}
                label="Care Team"
              >
                {careTeams.map(team => (
                  <MenuItem key={team.id} value={team.id}>
                    {team.name || `Care Team ${team.id}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Additional Notes"
              value={shareNotes}
              onChange={(e) => setShareNotes(e.target.value)}
              placeholder="Add any additional context or instructions..."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleShareSubmit}
            variant="contained"
            disabled={!selectedCareTeam}
          >
            Share
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LabCareRecommendations;