/**
 * Note Template Wizard Component
 * Guides users through template selection based on visit type and clinical context
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Box,
  Chip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Assignment as ProgressIcon,
  Notes as SOAPIcon,
  Assessment as AssessmentIcon,
  EventNote as PlanIcon,
  MedicalServices as PhysicalIcon,
  ArrowForward as NextIcon,
  ArrowBack as BackIcon,
  Close as CloseIcon,
  Psychology as WellnessIcon,
  LocalHospital as AcuteIcon,
  Favorite as ChronicIcon,
  EventRepeat as FollowUpIcon,
  AutoAwesome as SmartIcon
} from '@mui/icons-material';
import { NOTE_TEMPLATES } from '../../../../services/noteTemplatesService';

// Visit type configurations
const VISIT_TYPES = {
  'new-patient': {
    label: 'New Patient Visit',
    icon: <PhysicalIcon />,
    color: 'primary',
    description: 'Initial comprehensive evaluation',
    recommendedTemplate: 'history-physical',
    keywords: ['new', 'initial', 'first visit', 'comprehensive']
  },
  'annual-physical': {
    label: 'Annual Physical/Wellness',
    icon: <WellnessIcon />,
    color: 'success',
    description: 'Preventive care and health maintenance',
    recommendedTemplate: 'history-physical',
    keywords: ['physical', 'wellness', 'annual', 'preventive', 'screening']
  },
  'acute-visit': {
    label: 'Acute Illness',
    icon: <AcuteIcon />,
    color: 'error',
    description: 'Urgent or acute condition management',
    recommendedTemplate: 'soap',
    keywords: ['acute', 'urgent', 'illness', 'sick', 'pain']
  },
  'chronic-followup': {
    label: 'Chronic Disease Follow-up',
    icon: <ChronicIcon />,
    color: 'warning',
    description: 'Management of ongoing chronic conditions',
    recommendedTemplate: 'progress',
    keywords: ['chronic', 'diabetes', 'hypertension', 'follow-up', 'management']
  },
  'routine-followup': {
    label: 'Routine Follow-up',
    icon: <FollowUpIcon />,
    color: 'info',
    description: 'Regular check-up or medication review',
    recommendedTemplate: 'progress',
    keywords: ['follow-up', 'routine', 'check-up', 'medication review']
  },
  'assessment-only': {
    label: 'Assessment/Consultation',
    icon: <AssessmentIcon />,
    color: 'secondary',
    description: 'Clinical assessment or specialist consultation',
    recommendedTemplate: 'assessment',
    keywords: ['assessment', 'consultation', 'evaluation', 'specialist']
  },
  'plan-update': {
    label: 'Plan Update/Review',
    icon: <PlanIcon />,
    color: 'primary',
    description: 'Update treatment plan or care goals',
    recommendedTemplate: 'plan-update',
    keywords: ['plan', 'update', 'review', 'goals', 'treatment change']
  }
};

// Template recommendation engine
const getRecommendations = (visitType, chiefComplaint, patientConditions = []) => {
  const recommendations = [];
  
  // Primary recommendation based on visit type
  if (visitType && VISIT_TYPES[visitType]) {
    const visitConfig = VISIT_TYPES[visitType];
    recommendations.push({
      template: visitConfig.recommendedTemplate,
      reason: `Recommended for ${visitConfig.label}`,
      confidence: 0.9
    });
  }

  // Secondary recommendations based on chief complaint
  if (chiefComplaint) {
    const complaint = chiefComplaint.toLowerCase();
    
    if (complaint.includes('pain') || complaint.includes('acute') || complaint.includes('urgent')) {
      recommendations.push({
        template: 'soap',
        reason: 'SOAP format ideal for acute presentations',
        confidence: 0.8
      });
    }
    
    if (complaint.includes('follow-up') || complaint.includes('chronic')) {
      recommendations.push({
        template: 'progress',
        reason: 'Progress note format for ongoing care',
        confidence: 0.7
      });
    }
    
    if (complaint.includes('physical') || complaint.includes('wellness') || complaint.includes('screening')) {
      recommendations.push({
        template: 'history-physical',
        reason: 'Comprehensive format for preventive care',
        confidence: 0.8
      });
    }
  }

  // Recommendations based on patient conditions
  if (patientConditions.length > 0) {
    const hasChronicConditions = patientConditions.some(condition => 
      ['diabetes', 'hypertension', 'copd', 'heart failure'].some(chronic => 
        condition.toLowerCase().includes(chronic)
      )
    );
    
    if (hasChronicConditions) {
      recommendations.push({
        template: 'progress',
        reason: 'Progress notes ideal for chronic disease management',
        confidence: 0.6
      });
    }
  }

  // Remove duplicates and sort by confidence
  const uniqueRecommendations = recommendations
    .filter((rec, index, arr) => 
      arr.findIndex(r => r.template === rec.template) === index
    )
    .sort((a, b) => b.confidence - a.confidence);

  return uniqueRecommendations;
};

// Visit Type Selection Component
const VisitTypeSelection = ({ selectedVisitType, onVisitTypeChange }) => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        What type of visit is this?
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Select the type of visit to get personalized template recommendations.
      </Typography>
      
      <Grid container spacing={2}>
        {Object.entries(VISIT_TYPES).map(([key, visitType]) => (
          <Grid item xs={12} sm={6} md={4} key={key}>
            <Card 
              variant={selectedVisitType === key ? 'outlined' : 'elevation'}
              sx={{ 
                height: '100%',
                border: selectedVisitType === key ? 2 : 0,
                borderColor: selectedVisitType === key ? 'primary.main' : 'transparent'
              }}
            >
              <CardActionArea 
                onClick={() => onVisitTypeChange(key)}
                sx={{ height: '100%', p: 2 }}
              >
                <CardContent sx={{ textAlign: 'center', p: 0 }}>
                  <Box sx={{ 
                    color: `${visitType.color}.main`,
                    mb: 1
                  }}>
                    {React.cloneElement(visitType.icon, { fontSize: 'large' })}
                  </Box>
                  <Typography variant="subtitle1" gutterBottom>
                    {visitType.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {visitType.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

// Clinical Context Component
const ClinicalContext = ({ chiefComplaint, onChiefComplaintChange, patientConditions }) => {
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h6" gutterBottom>
          Clinical Context
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Provide additional context to improve template recommendations.
        </Typography>
      </Box>

      <TextField
        fullWidth
        label="Chief Complaint"
        value={chiefComplaint}
        onChange={(e) => onChiefComplaintChange(e.target.value)}
        placeholder="e.g., Chest pain, Follow-up diabetes, Annual physical..."
        helperText="What is the primary reason for this visit?"
        multiline
        rows={2}
      />

      {patientConditions.length > 0 && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Active Conditions:
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {patientConditions.slice(0, 5).map((condition, index) => (
              <Chip 
                key={index}
                label={condition}
                size="small"
                variant="outlined"
              />
            ))}
            {patientConditions.length > 5 && (
              <Chip 
                label={`+${patientConditions.length - 5} more`}
                size="small"
                variant="outlined"
                color="primary"
              />
            )}
          </Stack>
        </Box>
      )}
    </Stack>
  );
};

// Template Recommendations Component
const TemplateRecommendations = ({ recommendations, selectedTemplate, onTemplateSelect }) => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Recommended Templates
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Based on your visit type and clinical context, here are the best template options:
      </Typography>

      <Stack spacing={2}>
        {recommendations.map((rec, index) => {
          const template = NOTE_TEMPLATES[rec.template];
          if (!template) return null;

          const isSelected = selectedTemplate === rec.template;
          const isTopRecommendation = index === 0;

          return (
            <Card 
              key={rec.template}
              variant={isSelected ? 'outlined' : 'elevation'}
              sx={{ 
                border: isSelected ? 2 : 0,
                borderColor: isSelected ? 'primary.main' : 'transparent',
                position: 'relative'
              }}
            >
              {isTopRecommendation && (
                <Chip
                  label="Recommended"
                  color="primary"
                  size="small"
                  icon={<SmartIcon />}
                  sx={{ 
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    zIndex: 1
                  }}
                />
              )}
              
              <CardActionArea onClick={() => onTemplateSelect(rec.template)}>
                <CardContent>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ color: `${template.color}.main` }}>
                      {template.icon === 'ProgressIcon' && <ProgressIcon />}
                      {template.icon === 'SOAPIcon' && <SOAPIcon />}
                      {template.icon === 'AssessmentIcon' && <AssessmentIcon />}
                      {template.icon === 'NotesIcon' && <PlanIcon />}
                    </Box>
                    
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1">
                        {template.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {rec.reason}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {template.structure === 'sections' ? 'Structured format' : 'Free-form format'}
                        {template.autoPopulateFields?.length > 0 && 
                          ` • Auto-populates ${template.autoPopulateFields.length} fields`
                        }
                      </Typography>
                    </Box>
                    
                    <Box>
                      <Chip
                        label={`${Math.round(rec.confidence * 100)}% match`}
                        size="small"
                        color={rec.confidence > 0.8 ? 'success' : rec.confidence > 0.6 ? 'warning' : 'default'}
                      />
                    </Box>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}

        {/* Show all templates option */}
        <Card variant="outlined" sx={{ opacity: 0.7 }}>
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              Don't see what you need?
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You can browse all available templates after completing the wizard.
            </Typography>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};

const NoteTemplateWizard = ({ 
  open, 
  onClose, 
  onTemplateSelected,
  patientConditions = [],
  defaultVisitType = null,
  defaultChiefComplaint = ''
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedVisitType, setSelectedVisitType] = useState(defaultVisitType);
  const [chiefComplaint, setChiefComplaint] = useState(defaultChiefComplaint);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [recommendations, setRecommendations] = useState([]);

  // Reset wizard when opened
  useEffect(() => {
    if (open) {
      setActiveStep(0);
      setSelectedVisitType(defaultVisitType);
      setChiefComplaint(defaultChiefComplaint);
      setSelectedTemplate(null);
    }
  }, [open, defaultVisitType, defaultChiefComplaint]);

  // Update recommendations when context changes
  useEffect(() => {
    const newRecommendations = getRecommendations(
      selectedVisitType, 
      chiefComplaint, 
      patientConditions
    );
    setRecommendations(newRecommendations);
    
    // Auto-select top recommendation
    if (newRecommendations.length > 0 && !selectedTemplate) {
      setSelectedTemplate(newRecommendations[0].template);
    }
  }, [selectedVisitType, chiefComplaint, patientConditions, selectedTemplate]);

  const steps = [
    {
      label: 'Visit Type',
      content: (
        <VisitTypeSelection
          selectedVisitType={selectedVisitType}
          onVisitTypeChange={setSelectedVisitType}
        />
      )
    },
    {
      label: 'Clinical Context',
      content: (
        <ClinicalContext
          chiefComplaint={chiefComplaint}
          onChiefComplaintChange={setChiefComplaint}
          patientConditions={patientConditions}
        />
      )
    },
    {
      label: 'Template Selection',
      content: (
        <TemplateRecommendations
          recommendations={recommendations}
          selectedTemplate={selectedTemplate}
          onTemplateSelect={setSelectedTemplate}
        />
      )
    }
  ];

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep(activeStep + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  const handleComplete = () => {
    if (selectedTemplate) {
      onTemplateSelected({
        templateId: selectedTemplate,
        visitType: selectedVisitType,
        chiefComplaint,
        autoPopulate: true
      });
      onClose();
    }
  };

  const canProceed = () => {
    switch (activeStep) {
      case 0:
        return selectedVisitType !== null;
      case 1:
        return true; // Clinical context is optional
      case 2:
        return selectedTemplate !== null;
      default:
        return false;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Note Template Wizard</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Stepper activeStep={activeStep} orientation="vertical">
            {steps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel>{step.label}</StepLabel>
                <StepContent>
                  <Box sx={{ mb: 2 }}>
                    {step.content}
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>

          {activeStep === steps.length && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Template selection complete! Click "Use Template" to start documenting.
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={activeStep === 0}
          onClick={handleBack}
          startIcon={<BackIcon />}
        >
          Back
        </Button>
        {activeStep < steps.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={!canProceed()}
            endIcon={<NextIcon />}
          >
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleComplete}
            disabled={!selectedTemplate}
          >
            Use Template
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default React.memo(NoteTemplateWizard);