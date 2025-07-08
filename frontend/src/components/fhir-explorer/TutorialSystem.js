/**
 * FHIR Explorer - Interactive Tutorial System
 * 
 * Provides step-by-step guided learning experiences for FHIR concepts
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Avatar,
  IconButton
} from '@mui/material';
import {
  School as SchoolIcon,
  CheckCircle as CheckCircleIcon,
  Lightbulb as LightbulbIcon,
  Person as PersonIcon,
  Science as ScienceIcon,
  LocalHospital as HospitalIcon,
  Assessment as AssessmentIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  ExpandMore as ExpandMoreIcon,
  Quiz as QuizIcon,
  EmojiEvents as TrophyIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import { github } from 'react-syntax-highlighter/dist/esm/styles/hljs';

SyntaxHighlighter.registerLanguage('json', json);

// Tutorial Content Definitions
export const TUTORIAL_CONTENT = {
  'fhir-basics': {
    title: 'FHIR Fundamentals',
    description: 'Understanding the building blocks of healthcare interoperability',
    estimatedTime: '15 minutes',
    difficulty: 'beginner',
    icon: <SchoolIcon />,
    steps: [
      {
        id: 'what-is-fhir',
        title: 'What is FHIR?',
        content: {
          explanation: `
            FHIR (Fast Healthcare Interoperability Resources) is a standard for 
            exchanging healthcare information electronically. Think of it as a 
            universal language that healthcare systems use to communicate.
          `,
          keyPoints: [
            'Developed by HL7 International',
            'Based on modern web technologies (REST, JSON, XML)',
            'Designed for real-world healthcare scenarios',
            'Patient-centered data model'
          ],
          analogy: `
            Imagine FHIR as a universal translator for healthcare data. Just like 
            how English might be a common language for international business, 
            FHIR is the common language for healthcare systems worldwide.
          `,
          quiz: {
            question: 'What does FHIR stand for?',
            options: [
              'Fast Healthcare Information Resources',
              'Fast Healthcare Interoperability Resources', 
              'Federal Healthcare Integration Rules',
              'Flexible Healthcare Information Repository'
            ],
            correct: 1
          }
        }
      },
      {
        id: 'resources-concept',
        title: 'Understanding Resources',
        content: {
          explanation: `
            In FHIR, all healthcare information is organized into "Resources" - 
            standardized chunks of data that represent specific healthcare concepts.
          `,
          examples: [
            {
              resource: 'Patient',
              description: 'Information about a person receiving healthcare',
              icon: <PersonIcon />,
              contains: ['Name', 'Date of birth', 'Gender', 'Contact information']
            },
            {
              resource: 'Observation',
              description: 'Measurements and simple assertions made about a patient',
              icon: <ScienceIcon />,
              contains: ['Vital signs', 'Lab results', 'Physical measurements']
            },
            {
              resource: 'Condition',
              description: 'A health condition or diagnosis',
              icon: <AssessmentIcon />,
              contains: ['Diagnosis codes', 'Onset date', 'Clinical status']
            }
          ],
          keyPoints: [
            'Each resource has a specific purpose and structure',
            'Resources can reference other resources',
            'All resources share common elements (id, metadata)',
            'Resources are designed to be self-contained but linkable'
          ]
        }
      },
      {
        id: 'rest-api-basics',
        title: 'FHIR REST API',
        content: {
          explanation: `
            FHIR uses REST (Representational State Transfer) principles for API design. 
            This means you interact with FHIR data using standard HTTP methods and URLs.
          `,
          operations: [
            {
              method: 'GET',
              url: '/fhir/R4/Patient/123',
              description: 'Read a specific patient by ID',
              color: 'success'
            },
            {
              method: 'GET', 
              url: '/fhir/R4/Patient?name=Smith',
              description: 'Search for patients with name containing "Smith"',
              color: 'info'
            },
            {
              method: 'POST',
              url: '/fhir/R4/Patient',
              description: 'Create a new patient record',
              color: 'warning'
            },
            {
              method: 'PUT',
              url: '/fhir/R4/Patient/123',
              description: 'Update an existing patient',
              color: 'primary'
            }
          ],
          urlStructure: {
            base: 'https://server.com',
            fhirPath: '/fhir/R4',
            resourceType: '/Patient',
            resourceId: '/123',
            parameters: '?name=Smith&_count=10'
          }
        }
      }
    ]
  },

  'search-fundamentals': {
    title: 'FHIR Search Fundamentals',
    description: 'Master the art of finding healthcare data',
    estimatedTime: '20 minutes',
    difficulty: 'beginner',
    icon: <ScienceIcon />,
    steps: [
      {
        id: 'basic-search',
        title: 'Basic Search Concepts',
        content: {
          explanation: `
            FHIR search allows you to find resources based on their properties. 
            Think of it like using a search engine, but specifically designed for healthcare data.
          `,
          searchTypes: [
            {
              type: 'String Search',
              description: 'Search text fields like names',
              example: 'name=Smith',
              tip: 'Supports partial matching by default'
            },
            {
              type: 'Token Search',
              description: 'Search coded values like gender or identifiers',
              example: 'gender=male',
              tip: 'Exact matching for coded values'
            },
            {
              type: 'Date Search',
              description: 'Search date fields with comparisons',
              example: 'birthdate=ge1990-01-01',
              tip: 'Use prefixes: ge (≥), le (≤), gt (>), lt (<)'
            },
            {
              type: 'Reference Search',
              description: 'Search by references to other resources',
              example: 'patient=Patient/123',
              tip: 'Links resources together'
            }
          ]
        }
      },
      {
        id: 'search-modifiers',
        title: 'Search Modifiers',
        content: {
          explanation: `
            Modifiers change how search parameters behave. They're added after 
            the parameter name with a colon (:).
          `,
          modifiers: [
            {
              modifier: ':exact',
              description: 'Exact match (case sensitive)',
              example: 'name:exact=Smith',
              useCase: 'When you need precise matching'
            },
            {
              modifier: ':contains',
              description: 'Case-insensitive substring match',
              example: 'name:contains=mit',
              useCase: 'Broader search within text'
            },
            {
              modifier: ':missing',
              description: 'Find resources where field is missing/present',
              example: 'birthdate:missing=true',
              useCase: 'Data quality checks'
            },
            {
              modifier: ':not',
              description: 'Exclude resources with this value',
              example: 'gender:not=male',
              useCase: 'Exclusion criteria'
            }
          ],
          practiceExercise: {
            instruction: 'Try to understand what each query does:',
            examples: [
              'Patient?name:contains=john',
              'Patient?birthdate:missing=false',
              'Observation?code:not=29463-7'
            ]
          }
        }
      }
    ]
  },

  'clinical-scenarios': {
    title: 'Real-World Clinical Scenarios',
    description: 'Apply FHIR knowledge to practical healthcare situations',
    estimatedTime: '30 minutes',
    difficulty: 'intermediate',
    icon: <HospitalIcon />,
    steps: [
      {
        id: 'patient-chart-review',
        title: 'Patient Chart Review',
        content: {
          scenario: `
            Dr. Smith needs to review all available information for patient John Doe 
            before his upcoming appointment. She needs to gather his demographics, 
            recent vital signs, lab results, medications, and any active conditions.
          `,
          approach: [
            'Start with patient demographics',
            'Find recent observations (vitals, labs)',
            'Check current medications',
            'Review active conditions',
            'Look at recent encounters'
          ],
          queries: [
            {
              step: 'Find the patient',
              query: '/fhir/R4/Patient?name=John&family=Doe',
              explanation: 'Search by name components'
            },
            {
              step: 'Get vital signs (last 30 days)',
              query: '/fhir/R4/Observation?patient=Patient/123&category=vital-signs&date=ge2023-10-01',
              explanation: 'Filter by patient, category, and recent date'
            },
            {
              step: 'Find lab results',
              query: '/fhir/R4/Observation?patient=Patient/123&category=laboratory&_sort=-date',
              explanation: 'Sort by date (newest first)'
            },
            {
              step: 'Get current medications',
              query: '/fhir/R4/MedicationRequest?patient=Patient/123&status=active',
              explanation: 'Only active prescriptions'
            },
            {
              step: 'Check active conditions',
              query: '/fhir/R4/Condition?patient=Patient/123&clinical-status=active',
              explanation: 'Current health issues'
            }
          ]
        }
      },
      {
        id: 'population-health',
        title: 'Population Health Query',
        content: {
          scenario: `
            The hospital wants to identify diabetic patients who haven't had 
            their HbA1c checked in the last 6 months for a quality improvement initiative.
          `,
          challenge: 'This requires combining multiple queries and understanding relationships',
          approach: [
            'Find patients with diabetes diagnosis',
            'Look for recent HbA1c tests',
            'Identify gaps in care'
          ],
          complexQueries: [
            {
              description: 'Find diabetic patients',
              query: '/fhir/R4/Condition?code=E11&clinical-status=active',
              note: 'E11 is ICD-10 code for Type 2 diabetes'
            },
            {
              description: 'Find recent HbA1c tests',
              query: '/fhir/R4/Observation?code=4548-4&date=ge2023-04-01',
              note: 'LOINC code 4548-4 for Hemoglobin A1c'
            }
          ]
        }
      }
    ]
  }
};

// Individual Tutorial Step Component
export const TutorialStep = ({ stepData, onComplete, onNext, onPrevious, isLast, isFirst }) => {
  const [quizAnswer, setQuizAnswer] = useState(null);
  const [showQuizResult, setShowQuizResult] = useState(false);
  const [understood, setUnderstood] = useState(false);

  const handleQuizSubmit = (answerIndex) => {
    setQuizAnswer(answerIndex);
    setShowQuizResult(true);
    if (stepData.content.quiz && answerIndex === stepData.content.quiz.correct) {
      setUnderstood(true);
    }
  };

  const renderContent = () => {
    const { content } = stepData;

    return (
      <Box>
        {/* Main Explanation */}
        {content.explanation && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body1">
              {content.explanation}
            </Typography>
          </Alert>
        )}

        {/* Analogy */}
        {content.analogy && (
          <Card sx={{ mb: 3, bgcolor: 'primary.50' }}>
            <CardContent>
              <Typography variant="h6" color="primary" gutterBottom>
                <LightbulbIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Think of it this way...
              </Typography>
              <Typography variant="body1">
                {content.analogy}
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Key Points */}
        {content.keyPoints && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Key Points:
            </Typography>
            <List>
              {content.keyPoints.map((point, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    <CheckCircleIcon color="success" />
                  </ListItemIcon>
                  <ListItemText primary={point} />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Examples */}
        {content.examples && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Examples:
            </Typography>
            <Grid container spacing={2}>
              {content.examples.map((example, index) => (
                <Grid item xs={12} md={4} key={index}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                          {example.icon}
                        </Avatar>
                        <Typography variant="h6">
                          {example.resource}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {example.description}
                      </Typography>
                      <Typography variant="subtitle2" gutterBottom>
                        Contains:
                      </Typography>
                      <Box>
                        {example.contains.map((item, idx) => (
                          <Chip 
                            key={idx} 
                            label={item} 
                            size="small" 
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* Operations (for REST API tutorial) */}
        {content.operations && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              HTTP Operations:
            </Typography>
            {content.operations.map((op, index) => (
              <Card key={index} sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Chip 
                      label={op.method} 
                      color={op.color} 
                      sx={{ mr: 2, fontWeight: 'bold' }}
                    />
                    <Typography 
                      variant="body1" 
                      sx={{ fontFamily: 'monospace', flexGrow: 1 }}
                    >
                      {op.url}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {op.description}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}

        {/* Search Types */}
        {content.searchTypes && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Types of Search:
            </Typography>
            {content.searchTypes.map((type, index) => (
              <Accordion key={index}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">{type.type}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" gutterBottom>
                    {type.description}
                  </Typography>
                  <Box sx={{ bgcolor: 'grey.100', p: 1, borderRadius: 1, mb: 1 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {type.example}
                    </Typography>
                  </Box>
                  <Alert severity="info">
                    <Typography variant="body2">
                      💡 <strong>Tip:</strong> {type.tip}
                    </Typography>
                  </Alert>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )}

        {/* Clinical Scenarios */}
        {content.scenario && (
          <Box sx={{ mb: 3 }}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                📋 Clinical Scenario
              </Typography>
              <Typography variant="body1">
                {content.scenario}
              </Typography>
            </Alert>

            {content.approach && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Approach:
                </Typography>
                <List>
                  {content.approach.map((step, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <Typography variant="h6" color="primary">
                          {index + 1}.
                        </Typography>
                      </ListItemIcon>
                      <ListItemText primary={step} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {content.queries && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Step-by-step Queries:
                </Typography>
                {content.queries.map((query, index) => (
                  <Card key={index} sx={{ mb: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1" color="primary" gutterBottom>
                        {query.step}
                      </Typography>
                      <Box sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1, mb: 1 }}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {query.query}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {query.explanation}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* Quiz */}
        {content.quiz && (
          <Box sx={{ mb: 3 }}>
            <Card sx={{ bgcolor: 'secondary.50' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <QuizIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Quick Check
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {content.quiz.question}
                </Typography>
                <Box sx={{ mt: 2 }}>
                  {content.quiz.options.map((option, index) => (
                    <Button
                      key={index}
                      variant={quizAnswer === index ? "contained" : "outlined"}
                      onClick={() => handleQuizSubmit(index)}
                      sx={{ display: 'block', mb: 1, textAlign: 'left' }}
                      color={
                        showQuizResult 
                          ? (index === content.quiz.correct ? 'success' : 
                             (quizAnswer === index ? 'error' : 'inherit'))
                          : 'primary'
                      }
                      disabled={showQuizResult}
                    >
                      {option}
                    </Button>
                  ))}
                </Box>
                {showQuizResult && (
                  <Alert 
                    severity={quizAnswer === content.quiz.correct ? 'success' : 'error'}
                    sx={{ mt: 2 }}
                  >
                    {quizAnswer === content.quiz.correct 
                      ? '🎉 Correct! Well done!' 
                      : `Not quite. The correct answer is: ${content.quiz.options[content.quiz.correct]}`
                    }
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        {stepData.title}
      </Typography>
      
      {renderContent()}

      {/* Navigation */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, pt: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button
          onClick={onPrevious}
          disabled={isFirst}
          startIcon={<ArrowBackIcon />}
        >
          Previous
        </Button>
        
        <Button
          variant="contained"
          onClick={isLast ? onComplete : onNext}
          endIcon={isLast ? <TrophyIcon /> : <ArrowForwardIcon />}
          disabled={stepData.content.quiz && !understood}
        >
          {isLast ? 'Complete Tutorial' : 'Next'}
        </Button>
      </Box>
    </Box>
  );
};

// Main Tutorial Component
export const InteractiveTutorial = ({ tutorialId, onComplete, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  
  const tutorial = TUTORIAL_CONTENT[tutorialId];
  
  if (!tutorial) {
    return (
      <Alert severity="error">
        Tutorial not found: {tutorialId}
      </Alert>
    );
  }

  const handleStepComplete = () => {
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    if (currentStep < tutorial.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete && onComplete();
    }
  };

  const handleNext = () => {
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    setCurrentStep(Math.min(currentStep + 1, tutorial.steps.length - 1));
  };

  const handlePrevious = () => {
    setCurrentStep(Math.max(currentStep - 1, 0));
  };

  const progress = ((currentStep + 1) / tutorial.steps.length) * 100;

  return (
    <Dialog 
      open={true} 
      onClose={onClose}
      maxWidth="lg" 
      fullWidth
      scroll="paper"
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {tutorial.icon}
            <Box>
              <Typography variant="h6">{tutorial.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                Step {currentStep + 1} of {tutorial.steps.length} • {tutorial.estimatedTime}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
        <LinearProgress 
          variant="determinate" 
          value={progress} 
          sx={{ mt: 2 }}
        />
      </DialogTitle>
      
      <DialogContent>
        <TutorialStep
          stepData={tutorial.steps[currentStep]}
          onComplete={handleStepComplete}
          onNext={handleNext}
          onPrevious={handlePrevious}
          isFirst={currentStep === 0}
          isLast={currentStep === tutorial.steps.length - 1}
        />
      </DialogContent>
    </Dialog>
  );
};