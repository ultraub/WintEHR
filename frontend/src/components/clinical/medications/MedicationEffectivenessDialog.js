/**
 * Medication Effectiveness Assessment Dialog
 * Comprehensive interface for assessing medication effectiveness and recording outcomes
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  TextField,
  FormControl,
  FormControlLabel,
  RadioGroup,
  Radio,
  Checkbox,
  Slider,
  Alert,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Grid,
  Paper,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
  alpha
} from '@mui/material';
import {
  CheckCircle as EffectiveIcon,
  Warning as CautionIcon,
  Error as IneffectiveIcon,
  Info as InfoIcon,
  Schedule as ScheduleIcon,
  Assignment as AssessmentIcon,
  TrendingUp as ImprovementIcon,
  TrendingDown as DeclineIcon,
  ExpandMore as ExpandMoreIcon,
  Medication as MedicationIcon,
  Timeline as TimelineIcon,
  QuestionAnswer as QuestionIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, addWeeks } from 'date-fns';
import { useMedicationResolver } from '../../../hooks/useMedicationResolver';

// Effectiveness scale options
const EFFECTIVENESS_OPTIONS = [
  { value: 'excellent', label: 'Excellent Response', description: 'Symptoms significantly improved, goals met', icon: <EffectiveIcon color="success" />, color: 'success' },
  { value: 'good', label: 'Good Response', description: 'Noticeable improvement, minor adjustments needed', icon: <ImprovementIcon color="info" />, color: 'info' },
  { value: 'fair', label: 'Fair Response', description: 'Some improvement, may need dose adjustment', icon: <CautionIcon color="warning" />, color: 'warning' },
  { value: 'poor', label: 'Poor Response', description: 'Minimal improvement, consider alternatives', icon: <DeclineIcon color="error" />, color: 'error' },
  { value: 'no-response', label: 'No Response', description: 'No therapeutic benefit observed', icon: <IneffectiveIcon color="error" />, color: 'error' },
  { value: 'worsened', label: 'Condition Worsened', description: 'Symptoms worse than baseline', icon: <IneffectiveIcon color="error" />, color: 'error' }
];

// Adherence scale options
const ADHERENCE_OPTIONS = [
  { value: 'excellent', label: 'Taking as Prescribed', description: '95-100% adherent', score: 95 },
  { value: 'good', label: 'Mostly Compliant', description: '80-94% adherent', score: 85 },
  { value: 'fair', label: 'Occasionally Missing', description: '60-79% adherent', score: 70 },
  { value: 'poor', label: 'Frequently Missing', description: '40-59% adherent', score: 50 },
  { value: 'non-adherent', label: 'Not Taking Medication', description: 'Less than 40% adherent', score: 20 }
];

const MedicationEffectivenessDialog = ({ 
  open, 
  onClose, 
  medicationRequest, 
  assessmentPrompts,
  onSubmitAssessment 
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1=effectiveness, 2=adherence, 3=questions, 4=plan
  
  // Assessment state
  const [overallEffectiveness, setOverallEffectiveness] = useState('');
  const [adherenceLevel, setAdherenceLevel] = useState('');
  const [sideEffectsExperienced, setSideEffectsExperienced] = useState(false);
  const [sideEffectsList, setSideEffectsList] = useState('');
  const [questionResponses, setQuestionResponses] = useState({});
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [therapeuticGoalsAssessment, setTherapeuticGoalsAssessment] = useState({});
  const [nextReviewDate, setNextReviewDate] = useState(addWeeks(new Date(), 4));
  const [recommendedActions, setRecommendedActions] = useState([]);

  const { getMedicationDisplay } = useMedicationResolver(medicationRequest ? [medicationRequest] : []);

  useEffect(() => {
    if (assessmentPrompts?.assessmentQuestions) {
      // Initialize question responses
      const responses = {};
      assessmentPrompts.assessmentQuestions.forEach((question, index) => {
        responses[`question_${index}`] = '';
      });
      setQuestionResponses(responses);
    }

    if (assessmentPrompts?.therapeuticGoals) {
      // Initialize therapeutic goals assessment
      const goals = {};
      Object.keys(assessmentPrompts.therapeuticGoals).forEach(goal => {
        goals[goal] = { achieved: false, currentValue: '', notes: '' };
      });
      setTherapeuticGoalsAssessment(goals);
    }
  }, [assessmentPrompts]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const assessmentData = {
        medicationRequestId: medicationRequest.id,
        patientReference: medicationRequest.subject,
        overallEffectiveness,
        adherenceLevel,
        sideEffectsExperienced,
        sideEffectsList,
        responses: questionResponses,
        therapeuticGoals: therapeuticGoalsAssessment,
        clinicalNotes,
        nextReviewDate: nextReviewDate.toISOString(),
        recommendedActions,
        assessmentDate: new Date().toISOString(),
        assessorId: 'current-provider' // In real app, get from auth context
      };

      await onSubmitAssessment(assessmentData);
      onClose();
    } catch (error) {
      console.error('Error submitting assessment:', error);
    } finally {
      setLoading(false);
    }
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case 1:
        return overallEffectiveness !== '';
      case 2:
        return adherenceLevel !== '';
      case 3:
        return Object.values(questionResponses).every(response => response.trim() !== '');
      case 4:
        return true; // Review step
      default:
        return false;
    }
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'overdue': return 'error';
      case 'urgent': return 'warning';
      case 'soon': return 'info';
      default: return 'default';
    }
  };

  // Step 1: Effectiveness Assessment
  const renderEffectivenessStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        <AssessmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Overall Effectiveness Assessment
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        How well is this medication working for the intended condition?
      </Typography>

      {/* Assessment Context */}
      <Card sx={{ mb: 3, bgcolor: alpha(theme.palette.info.main, 0.05) }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Assessment Phase</Typography>
              <Typography variant="body2">
                {assessmentPrompts?.assessmentPhase === 'initial' ? 'Initial Assessment' : 'Ongoing Monitoring'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Days Since Start</Typography>
              <Typography variant="body2">
                {assessmentPrompts?.daysSinceStart || 0} days
              </Typography>
            </Grid>
            {assessmentPrompts?.urgencyLevel && (
              <Grid item xs={12}>
                <Chip 
                  label={`Assessment ${assessmentPrompts.urgencyLevel.toUpperCase()}`}
                  color={getUrgencyColor(assessmentPrompts.urgencyLevel)}
                  size="small"
                />
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Target Conditions */}
      {assessmentPrompts?.targetConditions && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>Target Conditions</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {assessmentPrompts.targetConditions.map((condition, index) => (
              <Chip 
                key={index}
                label={condition}
                variant="outlined"
                size="small"
              />
            ))}
          </Stack>
        </Box>
      )}

      {/* Effectiveness Options */}
      <FormControl component="fieldset" fullWidth>
        <RadioGroup
          value={overallEffectiveness}
          onChange={(e) => setOverallEffectiveness(e.target.value)}
        >
          {EFFECTIVENESS_OPTIONS.map((option) => (
            <FormControlLabel
              key={option.value}
              value={option.value}
              control={<Radio />}
              label={
                <Card 
                  variant="outlined" 
                  sx={{ 
                    p: 2, 
                    ml: 1, 
                    width: '100%',
                    bgcolor: overallEffectiveness === option.value ? 
                      alpha(theme.palette[option.color].main, 0.1) : 'transparent'
                  }}
                >
                  <Stack direction="row" spacing={2} alignItems="center">
                    {option.icon}
                    <Box>
                      <Typography variant="body1" fontWeight="medium">
                        {option.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {option.description}
                      </Typography>
                    </Box>
                  </Stack>
                </Card>
              }
              sx={{ alignItems: 'flex-start', mb: 1 }}
            />
          ))}
        </RadioGroup>
      </FormControl>

      {/* Therapeutic Goals Assessment */}
      {assessmentPrompts?.therapeuticGoals && Object.keys(assessmentPrompts.therapeuticGoals).length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" gutterBottom>Therapeutic Goals</Typography>
          {Object.entries(assessmentPrompts.therapeuticGoals).map(([goal, target]) => (
            <Card key={goal} variant="outlined" sx={{ mb: 1, p: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" fontWeight="medium">
                    {goal.replace('_', ' ').toUpperCase()}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Target: {target.target} {target.range && `(${target.range[0]}-${target.range[1]})`}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Current Value"
                    value={therapeuticGoalsAssessment[goal]?.currentValue || ''}
                    onChange={(e) => setTherapeuticGoalsAssessment(prev => ({
                      ...prev,
                      [goal]: { ...prev[goal], currentValue: e.target.value }
                    }))}
                    size="small"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={therapeuticGoalsAssessment[goal]?.achieved || false}
                        onChange={(e) => setTherapeuticGoalsAssessment(prev => ({
                          ...prev,
                          [goal]: { ...prev[goal], achieved: e.target.checked }
                        }))}
                      />
                    }
                    label="Achieved"
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Notes"
                    value={therapeuticGoalsAssessment[goal]?.notes || ''}
                    onChange={(e) => setTherapeuticGoalsAssessment(prev => ({
                      ...prev,
                      [goal]: { ...prev[goal], notes: e.target.value }
                    }))}
                    size="small"
                    fullWidth
                  />
                </Grid>
              </Grid>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );

  // Step 2: Adherence Assessment
  const renderAdherenceStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        <ScheduleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Medication Adherence Assessment
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        How consistently is the patient taking this medication as prescribed?
      </Typography>

      <FormControl component="fieldset" fullWidth>
        <RadioGroup
          value={adherenceLevel}
          onChange={(e) => setAdherenceLevel(e.target.value)}
        >
          {ADHERENCE_OPTIONS.map((option) => (
            <FormControlLabel
              key={option.value}
              value={option.value}
              control={<Radio />}
              label={
                <Card 
                  variant="outlined" 
                  sx={{ 
                    p: 2, 
                    ml: 1, 
                    width: '100%',
                    bgcolor: adherenceLevel === option.value ? 
                      alpha(theme.palette.primary.main, 0.1) : 'transparent'
                  }}
                >
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ minWidth: 60 }}>
                      <Typography variant="h6" color="primary">
                        {option.score}%
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body1" fontWeight="medium">
                        {option.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {option.description}
                      </Typography>
                    </Box>
                    <Box sx={{ flexGrow: 1, mx: 2 }}>
                      <LinearProgress 
                        variant="determinate" 
                        value={option.score} 
                        color={option.score >= 80 ? 'success' : option.score >= 60 ? 'warning' : 'error'}
                      />
                    </Box>
                  </Stack>
                </Card>
              }
              sx={{ alignItems: 'flex-start', mb: 1 }}
            />
          ))}
        </RadioGroup>
      </FormControl>

      {/* Side Effects Section */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="subtitle2" gutterBottom>Side Effects</Typography>
        <FormControlLabel
          control={
            <Checkbox
              checked={sideEffectsExperienced}
              onChange={(e) => setSideEffectsExperienced(e.target.checked)}
            />
          }
          label="Patient is experiencing side effects"
        />
        
        {sideEffectsExperienced && (
          <TextField
            label="Describe Side Effects"
            value={sideEffectsList}
            onChange={(e) => setSideEffectsList(e.target.value)}
            multiline
            rows={3}
            fullWidth
            sx={{ mt: 2 }}
            placeholder="Describe the side effects, severity, and impact on daily activities..."
          />
        )}
      </Box>
    </Box>
  );

  // Step 3: Assessment Questions
  const renderQuestionsStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        <QuestionIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Clinical Assessment Questions
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Please answer the following questions specific to this medication therapy.
      </Typography>

      {assessmentPrompts?.assessmentQuestions?.map((question, index) => (
        <Card key={index} variant="outlined" sx={{ mb: 2, p: 2 }}>
          <Typography variant="body1" fontWeight="medium" gutterBottom>
            {index + 1}. {question}
          </Typography>
          <TextField
            value={questionResponses[`question_${index}`] || ''}
            onChange={(e) => setQuestionResponses(prev => ({
              ...prev,
              [`question_${index}`]: e.target.value
            }))}
            multiline
            rows={2}
            fullWidth
            placeholder="Enter your response..."
          />
        </Card>
      ))}

      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" gutterBottom>Additional Clinical Notes</Typography>
        <TextField
          label="Clinical Notes"
          value={clinicalNotes}
          onChange={(e) => setClinicalNotes(e.target.value)}
          multiline
          rows={4}
          fullWidth
          placeholder="Any additional observations, concerns, or clinical notes..."
        />
      </Box>
    </Box>
  );

  // Step 4: Review and Plan
  const renderReviewStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        <TimelineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Assessment Review & Follow-up Plan
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review the assessment and set up the follow-up plan.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>Assessment Summary</Typography>
              <Stack spacing={1}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Overall Effectiveness</Typography>
                  <Typography variant="body2">
                    {EFFECTIVENESS_OPTIONS.find(opt => opt.value === overallEffectiveness)?.label || 'Not selected'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Adherence Level</Typography>
                  <Typography variant="body2">
                    {ADHERENCE_OPTIONS.find(opt => opt.value === adherenceLevel)?.label || 'Not selected'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Side Effects</Typography>
                  <Typography variant="body2">
                    {sideEffectsExperienced ? 'Yes - see details' : 'None reported'}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>Follow-up Plan</Typography>
              <Stack spacing={2}>
                <DatePicker
                  label="Next Review Date"
                  value={nextReviewDate}
                  onChange={(newDate) => setNextReviewDate(newDate)}
                  slotProps={{
                    textField: { fullWidth: true, size: 'small' }
                  }}
                />
                
                {assessmentPrompts?.recommendations && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Recommendations</Typography>
                    <List dense>
                      {assessmentPrompts.recommendations.map((rec, index) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <InfoIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText primary={rec} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Assessment Actions */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" gutterBottom>Recommended Actions</Typography>
        <Stack spacing={1}>
          {[
            'Continue current medication regimen',
            'Adjust dosage based on effectiveness',
            'Consider alternative therapy',
            'Increase monitoring frequency',
            'Schedule lab work',
            'Patient education needed'
          ].map((action, index) => (
            <FormControlLabel
              key={index}
              control={
                <Checkbox
                  checked={recommendedActions.includes(action)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setRecommendedActions(prev => [...prev, action]);
                    } else {
                      setRecommendedActions(prev => prev.filter(a => a !== action));
                    }
                  }}
                />
              }
              label={action}
            />
          ))}
        </Stack>
      </Box>
    </Box>
  );

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh' }
      }}
    >
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6">
              Medication Effectiveness Assessment
            </Typography>
            {medicationRequest && (
              <Typography variant="subtitle2" color="text.secondary">
                {getMedicationDisplay(medicationRequest)}
              </Typography>
            )}
          </Box>
          <Chip 
            label={`Step ${currentStep} of 4`} 
            variant="outlined" 
            size="small"
          />
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mt: 1 }}>
          {currentStep === 1 && renderEffectivenessStep()}
          {currentStep === 2 && renderAdherenceStep()}
          {currentStep === 3 && renderQuestionsStep()}
          {currentStep === 4 && renderReviewStep()}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        {currentStep > 1 && (
          <Button 
            onClick={() => setCurrentStep(currentStep - 1)} 
            disabled={loading}
          >
            Back
          </Button>
        )}
        {currentStep < 4 ? (
          <Button 
            onClick={() => setCurrentStep(currentStep + 1)} 
            variant="contained"
            disabled={!canProceedToNext() || loading}
          >
            Next
          </Button>
        ) : (
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            color="primary"
            disabled={loading}
          >
            {loading ? 'Saving Assessment...' : 'Complete Assessment'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default MedicationEffectivenessDialog;