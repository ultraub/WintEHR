import React, { useState } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Stack,
  Divider
} from '@mui/material';
import {
  School as TrainingIcon,
  Code as FHIRIcon,
  Timeline as WorkflowIcon,
  Search as QueryIcon,
  AccountTree as RelationshipIcon,
  PlayArrow as StartIcon,
  MenuBook as GuideIcon,
  Quiz as QuizIcon,
  CheckCircle as CompletedIcon,
  Psychology as CDSIcon
} from '@mui/icons-material';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`training-tabpanel-${index}`}
      aria-labelledby={`training-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function TrainingCenterPage() {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const trainingModules = [
    {
      title: 'FHIR Resource Explorer',
      description: 'Explore and understand FHIR R4 resources with interactive examples',
      icon: <FHIRIcon />,
      level: 'Beginner',
      duration: '30 min',
      completed: false,
      features: [
        'Browse all FHIR resource types',
        'View real patient data examples',
        'Understand resource relationships',
        'Interactive JSON viewer'
      ]
    },
    {
      title: 'Clinical Workflow Simulator',
      description: 'Practice real-world clinical scenarios in a safe environment',
      icon: <WorkflowIcon />,
      level: 'Intermediate',
      duration: '60 min',
      completed: false,
      features: [
        'Patient admission workflow',
        'Medication reconciliation',
        'Lab order and results',
        'Discharge planning'
      ]
    },
    {
      title: 'FHIR Query Builder',
      description: 'Learn to construct and execute FHIR search queries',
      icon: <QueryIcon />,
      level: 'Advanced',
      duration: '45 min',
      completed: false,
      features: [
        'Search parameter construction',
        'Complex query building',
        'Performance optimization',
        'Debugging tools'
      ]
    },
    {
      title: 'Resource Relationships',
      description: 'Understand how FHIR resources connect and reference each other',
      icon: <RelationshipIcon />,
      level: 'Intermediate',
      duration: '40 min',
      completed: false,
      features: [
        'Resource reference patterns',
        'Bundle composition',
        'Contained resources',
        'Provenance tracking'
      ]
    },
    {
      title: 'CDS Hooks Development',
      description: 'Build and test Clinical Decision Support hooks and cards',
      icon: <CDSIcon />,
      level: 'Advanced',
      duration: '50 min',
      completed: false,
      features: [
        'Hook service development',
        'Card creation and formatting',
        'Drug interaction checking',
        'Real-time clinical alerts'
      ],
      isExternal: true,
      externalUrl: '/cds-studio'
    }
  ];

  const quickStartGuides = [
    {
      title: 'Getting Started with FHIR',
      description: 'Basic introduction to FHIR concepts and structure',
      duration: '15 min',
      level: 'Beginner'
    },
    {
      title: 'Patient Data Model',
      description: 'Understanding patient demographics and core resources',
      duration: '20 min',
      level: 'Beginner'
    },
    {
      title: 'Clinical Data Entry',
      description: 'How to document clinical findings and observations',
      duration: '25 min',
      level: 'Intermediate'
    },
    {
      title: 'Medication Management',
      description: 'Prescribing, dispensing, and administering medications',
      duration: '30 min',
      level: 'Intermediate'
    },
    {
      title: 'Care Coordination',
      description: 'Managing care plans, teams, and patient transitions',
      duration: '35 min',
      level: 'Advanced'
    }
  ];

  const assessments = [
    {
      title: 'FHIR Basics Quiz',
      questions: 15,
      duration: '20 min',
      passScore: '80%',
      attempts: 0,
      maxAttempts: 3
    },
    {
      title: 'Clinical Workflow Assessment',
      questions: 25,
      duration: '45 min',
      passScore: '85%',
      attempts: 0,
      maxAttempts: 2
    },
    {
      title: 'Advanced FHIR Implementation',
      questions: 30,
      duration: '60 min',
      passScore: '90%',
      attempts: 0,
      maxAttempts: 2
    }
  ];

  const getLevelColor = (level) => {
    switch (level) {
      case 'Beginner': return 'success';
      case 'Intermediate': return 'warning';
      case 'Advanced': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TrainingIcon sx={{ fontSize: 48 }} />
          <Box>
            <Typography variant="h3" fontWeight="bold">
              Training Center
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.9 }}>
              Master FHIR-based EMR workflows and become an expert user
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Progress Overview */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Your Progress
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={3}>
            <Stack alignItems="center">
              <Typography variant="h3" color="primary">2</Typography>
              <Typography variant="body2" color="text.secondary">Completed Modules</Typography>
            </Stack>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Stack alignItems="center">
              <Typography variant="h3" color="warning.main">3</Typography>
              <Typography variant="body2" color="text.secondary">In Progress</Typography>
            </Stack>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Stack alignItems="center">
              <Typography variant="h3" color="success.main">85%</Typography>
              <Typography variant="body2" color="text.secondary">Average Score</Typography>
            </Stack>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Stack alignItems="center">
              <Typography variant="h3" color="info.main">24h</Typography>
              <Typography variant="body2" color="text.secondary">Total Time</Typography>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Training Modules" />
          <Tab label="Quick Start Guides" />
          <Tab label="Assessments" />
          <Tab label="Resources" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {trainingModules.map((module, index) => (
              <Grid item xs={12} md={6} key={index}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Stack direction="row" spacing={2} alignItems="flex-start" mb={2}>
                      <Box sx={{ color: 'primary.main' }}>
                        {module.icon}
                      </Box>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h6" gutterBottom>
                          {module.title}
                        </Typography>
                        <Stack direction="row" spacing={1} mb={1}>
                          <Chip 
                            label={module.level} 
                            size="small" 
                            color={getLevelColor(module.level)}
                          />
                          <Chip 
                            label={module.duration} 
                            size="small" 
                            variant="outlined"
                          />
                          {module.completed && (
                            <Chip 
                              label="Completed" 
                              size="small" 
                              color="success"
                              icon={<CompletedIcon />}
                            />
                          )}
                        </Stack>
                        <Typography variant="body2" color="text.secondary" mb={2}>
                          {module.description}
                        </Typography>
                        <List dense>
                          {module.features.map((feature, idx) => (
                            <ListItem key={idx} sx={{ px: 0 }}>
                              <ListItemIcon sx={{ minWidth: 20 }}>
                                <CompletedIcon fontSize="small" color="success" />
                              </ListItemIcon>
                              <ListItemText 
                                primary={feature}
                                primaryTypographyProps={{ variant: 'body2' }}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    </Stack>
                  </CardContent>
                  <CardActions>
                    <Button 
                      variant={module.completed ? "outlined" : "contained"}
                      startIcon={module.completed ? <CompletedIcon /> : <StartIcon />}
                      fullWidth
                      onClick={() => {
                        if (module.isExternal && module.externalUrl) {
                          window.open(module.externalUrl, '_blank');
                        } else {
                          // Handle regular training modules
                          // Handle regular training modules
                        }
                      }}
                    >
                      {module.completed ? 'Review' : 'Start Module'}
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <List>
            {quickStartGuides.map((guide, index) => (
              <React.Fragment key={index}>
                <ListItem>
                  <ListItemIcon>
                    <GuideIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={guide.title}
                    secondary={guide.description}
                  />
                  <Stack direction="row" spacing={1} mr={2}>
                    <Chip 
                      label={guide.level} 
                      size="small" 
                      color={getLevelColor(guide.level)}
                    />
                    <Chip 
                      label={guide.duration} 
                      size="small" 
                      variant="outlined"
                    />
                  </Stack>
                  <Button variant="outlined" size="small">
                    Start
                  </Button>
                </ListItem>
                {index < quickStartGuides.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            {assessments.map((assessment, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card>
                  <CardContent>
                    <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                      <QuizIcon color="primary" />
                      <Typography variant="h6">
                        {assessment.title}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" mb={2}>
                      Test your knowledge and earn certification
                    </Typography>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">Questions:</Typography>
                        <Typography variant="body2">{assessment.questions}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">Duration:</Typography>
                        <Typography variant="body2">{assessment.duration}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">Pass Score:</Typography>
                        <Typography variant="body2">{assessment.passScore}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">Attempts:</Typography>
                        <Typography variant="body2">
                          {assessment.attempts}/{assessment.maxAttempts}
                        </Typography>
                      </Stack>
                    </Stack>
                  </CardContent>
                  <CardActions>
                    <Button 
                      variant="contained" 
                      fullWidth
                      disabled={assessment.attempts >= assessment.maxAttempts}
                    >
                      {assessment.attempts === 0 ? 'Take Assessment' : 'Retake'}
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Documentation
                  </Typography>
                  <List>
                    <ListItem button>
                      <ListItemText primary="FHIR R4 Specification" secondary="Official HL7 FHIR documentation" />
                    </ListItem>
                    <ListItem button>
                      <ListItemText primary="EMR User Guide" secondary="Complete guide to system features" />
                    </ListItem>
                    <ListItem button>
                      <ListItemText primary="Clinical Workflows" secondary="Step-by-step workflow documentation" />
                    </ListItem>
                    <ListItem button>
                      <ListItemText primary="API Reference" secondary="Technical API documentation" />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Support
                  </Typography>
                  <List>
                    <ListItem button>
                      <ListItemText primary="Help Desk" secondary="Get help from our support team" />
                    </ListItem>
                    <ListItem button>
                      <ListItemText primary="Community Forum" secondary="Connect with other users" />
                    </ListItem>
                    <ListItem button>
                      <ListItemText primary="Video Tutorials" secondary="Watch step-by-step tutorials" />
                    </ListItem>
                    <ListItem button>
                      <ListItemText primary="Feedback" secondary="Share your suggestions" />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>
    </Box>
  );
}

export default TrainingCenterPage;