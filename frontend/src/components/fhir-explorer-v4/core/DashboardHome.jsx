/**
 * Smart Dashboard Home Component for FHIR Explorer v4
 * 
 * Provides an intelligent overview of FHIR data with:
 * - Data statistics and health metrics
 * - Quick access to common queries
 * - Recent activity and saved queries
 * - Resource type distribution visualization
 * - Guided onboarding for new users
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  IconButton,
  Paper,
  LinearProgress,
  CircularProgress,
  Tooltip,
  Divider,
  Badge,
  Alert,
  AlertTitle,
  Fade,
  Zoom,
  useTheme
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  LocalHospital as HospitalIcon,
  Science as ScienceIcon,
  Medication as MedicationIcon,
  Assessment as AssessmentIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Star as StarIcon,
  History as HistoryIcon,
  PlayArrow as PlayIcon,
  Bookmark as BookmarkIcon,
  TipsAndUpdates as TipsIcon,
  AutoAwesome as AutoAwesomeIcon,
  Explore as ExploreIcon,
  Build as BuildIcon,
  Visibility as VisibilityIcon,
  School as SchoolIcon,
  ChevronRight as ChevronRightIcon,
  Refresh as RefreshIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';

// Import mode constants
import { APP_MODES, DISCOVERY_VIEWS, QUERY_VIEWS, VISUALIZATION_VIEWS } from '../constants/appConstants';

// Resource type configurations with colors and icons
const RESOURCE_CONFIGS = {
  Patient: { icon: <PeopleIcon />, color: '#2196f3', label: 'Patients' },
  Observation: { icon: <ScienceIcon />, color: '#4caf50', label: 'Observations' },
  Condition: { icon: <AssessmentIcon />, color: '#f44336', label: 'Conditions' },
  MedicationRequest: { icon: <MedicationIcon />, color: '#ff9800', label: 'Medications' },
  Encounter: { icon: <HospitalIcon />, color: '#9c27b0', label: 'Encounters' },
  DiagnosticReport: { icon: <AssessmentIcon />, color: '#607d8b', label: 'Reports' },
  Procedure: { icon: <HospitalIcon />, color: '#795548', label: 'Procedures' },
  Practitioner: { icon: <PeopleIcon />, color: '#3f51b5', label: 'Practitioners' }
};

// Quick action items for navigation
const QUICK_ACTIONS = [
  {
    title: 'Explore Resources',
    description: 'Browse and discover FHIR resource types',
    icon: <ExploreIcon />,
    color: '#388e3c',
    mode: APP_MODES.DISCOVERY,
    view: DISCOVERY_VIEWS.CATALOG
  },
  {
    title: 'Build Queries',
    description: 'Create powerful FHIR queries visually',
    icon: <BuildIcon />,
    color: '#f57c00',
    mode: APP_MODES.QUERY_BUILDING,
    view: QUERY_VIEWS.VISUAL
  },
  {
    title: 'Visualize Data',
    description: 'Create charts and data visualizations',
    icon: <VisibilityIcon />,
    color: '#7b1fa2',
    mode: APP_MODES.VISUALIZATION,
    view: VISUALIZATION_VIEWS.CHARTS
  },
  {
    title: 'Start Learning',
    description: 'Interactive FHIR tutorials and guides',
    icon: <SchoolIcon />,
    color: '#c2185b',
    mode: APP_MODES.LEARNING
  }
];

// Sample queries for quick execution
const SAMPLE_QUERIES = [
  {
    title: 'Recent Lab Results',
    description: 'Latest laboratory observations',
    query: '/fhir/R4/Observation?category=laboratory&_sort=-date&_count=10',
    icon: <ScienceIcon />,
    color: '#4caf50'
  },
  {
    title: 'Active Patients',
    description: 'Patients with recent encounters',
    query: '/fhir/R4/Patient?_has:Encounter:patient:date=ge2024-01-01',
    icon: <PeopleIcon />,
    color: '#2196f3'
  },
  {
    title: 'Current Medications',
    description: 'Active medication requests',
    query: '/fhir/R4/MedicationRequest?status=active&_include=MedicationRequest:patient',
    icon: <MedicationIcon />,
    color: '#ff9800'
  },
  {
    title: 'Critical Conditions',
    description: 'High-severity conditions',
    query: '/fhir/R4/Condition?severity=severe&clinical-status=active',
    icon: <WarningIcon />,
    color: '#f44336'
  }
];

/**
 * Statistics card component
 */
const StatCard = ({ title, value, change, icon, color, loading = false }) => {
  const theme = useTheme();
  
  return (
    <Card 
      sx={{ 
        height: '100%',
        background: `linear-gradient(135deg, ${alpha(color, 0.1)} 0%, ${alpha(color, 0.05)} 100%)`,
        border: 1,
        borderColor: alpha(color, 0.2),
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: `0 8px 24px ${alpha(color, 0.15)}`
        }
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              <Typography variant="h4" sx={{ fontWeight: 700, color }}>
                {value?.toLocaleString() || '0'}
              </Typography>
            )}
            {change && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <TrendingUpIcon 
                  sx={{ 
                    fontSize: 16, 
                    color: change > 0 ? 'success.main' : 'error.main',
                    mr: 0.5 
                  }} 
                />
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: change > 0 ? 'success.main' : 'error.main',
                    fontWeight: 500 
                  }}
                >
                  {change > 0 ? '+' : ''}{change}% this week
                </Typography>
              </Box>
            )}
          </Box>
          <Avatar 
            sx={{ 
              bgcolor: alpha(color, 0.1),
              color,
              width: 56,
              height: 56 
            }}
          >
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );
};

/**
 * Quick action card component
 */
const QuickActionCard = ({ action, onNavigate }) => {
  return (
    <Card 
      sx={{ 
        height: '100%',
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 12px 32px ${alpha(action.color, 0.2)}`
        }
      }}
      onClick={() => onNavigate(action.mode, action.view)}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar 
            sx={{ 
              bgcolor: alpha(action.color, 0.1),
              color: action.color,
              mr: 2 
            }}
          >
            {action.icon}
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {action.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {action.description}
            </Typography>
          </Box>
        </Box>
      </CardContent>
      <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
        <Button 
          size="small" 
          endIcon={<ChevronRightIcon />}
          sx={{ color: action.color }}
        >
          Get Started
        </Button>
      </CardActions>
    </Card>
  );
};

/**
 * Sample query card component
 */
const SampleQueryCard = ({ query, onExecute }) => {
  const [loading, setLoading] = useState(false);

  const handleExecute = async () => {
    setLoading(true);
    try {
      await onExecute(query.query);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Avatar 
            sx={{ 
              bgcolor: alpha(query.color, 0.1),
              color: query.color,
              width: 32,
              height: 32,
              mr: 2 
            }}
          >
            {React.cloneElement(query.icon, { fontSize: 'small' })}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {query.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {query.description}
            </Typography>
          </Box>
        </Box>
        <Typography 
          variant="body2" 
          sx={{ 
            fontFamily: 'monospace',
            bgcolor: 'background.surface',
            p: 1,
            borderRadius: 1,
            fontSize: '0.75rem',
            mt: 1
          }}
        >
          {query.query}
        </Typography>
      </CardContent>
      <CardActions sx={{ pt: 0 }}>
        <Button 
          size="small" 
          onClick={handleExecute}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : <PlayIcon />}
        >
          Execute
        </Button>
        <IconButton size="small">
          <ShareIcon fontSize="small" />
        </IconButton>
      </CardActions>
    </Card>
  );
};

/**
 * Recent activity component
 */
const RecentActivity = ({ queryHistory }) => {
  if (!queryHistory || queryHistory.length === 0) {
    return (
      <Alert severity="info">
        <AlertTitle>No Recent Activity</AlertTitle>
        Start exploring FHIR data to see your query history here.
      </Alert>
    );
  }

  return (
    <List>
      {queryHistory.slice(0, 5).map((item, index) => (
        <ListItemButton key={index} sx={{ borderRadius: 2, mb: 1 }}>
          <ListItemIcon>
            <HistoryIcon color="action" />
          </ListItemIcon>
          <ListItemText
            primary={item.query?.substring(0, 50) + '...'}
            secondary={`${item.resultCount || 0} results • ${item.executionTime || 0}ms • ${
              item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : 'Unknown time'
            }`}
            primaryTypographyProps={{ fontSize: '0.875rem' }}
            secondaryTypographyProps={{ fontSize: '0.75rem' }}
          />
          <Chip 
            label={item.resultCount || 0} 
            size="small" 
            color={item.resultCount > 0 ? 'success' : 'default'}
          />
        </ListItemButton>
      ))}
    </List>
  );
};

/**
 * Main Dashboard Home Component
 */
function DashboardHome({ onNavigate, fhirData, queryHistory, theme }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [welcomeVisible, setWelcomeVisible] = useState(true);

  // Calculate statistics from FHIR data
  const calculatedStats = useMemo(() => {
    if (!fhirData || !fhirData.resources) {
      return {
        totalResources: 0,
        totalPatients: 0,
        recentObservations: 0,
        activeConditions: 0,
        resourceDistribution: {}
      };
    }

    const resources = fhirData.resources;
    const distribution = {};
    
    // Count resources by type
    Object.keys(resources).forEach(resourceType => {
      const count = resources[resourceType]?.length || 0;
      if (count > 0) {
        distribution[resourceType] = count;
      }
    });

    return {
      totalResources: Object.values(distribution).reduce((sum, count) => sum + count, 0),
      totalPatients: distribution.Patient || 0,
      recentObservations: distribution.Observation || 0,
      activeConditions: distribution.Condition || 0,
      resourceDistribution: distribution
    };
  }, [fhirData]);

  useEffect(() => {
    // Simulate loading delay for smooth UX
    const timer = setTimeout(() => {
      setStats(calculatedStats);
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [calculatedStats]);

  const handleSampleQueryExecute = async (query) => {
    // Navigate to query playground with the query
    onNavigate(APP_MODES.QUERY_BUILDING, QUERY_VIEWS.PLAYGROUND);
    // The actual query execution would be handled by the playground component
  };

  const topResourceTypes = useMemo(() => {
    return Object.entries(calculatedStats.resourceDistribution || {})
      .sort(([,a], [,b]) => b - a)
      .slice(0, 6)
      .map(([type, count]) => ({ type, count }));
  }, [calculatedStats.resourceDistribution]);

  return (
    <Box>
      {/* Welcome section */}
      {welcomeVisible && (
        <Fade in timeout={800}>
          <Alert 
            severity="info" 
            sx={{ mb: 3 }}
            onClose={() => setWelcomeVisible(false)}
            icon={<AutoAwesomeIcon />}
          >
            <AlertTitle>Welcome to FHIR Explorer v4!</AlertTitle>
            Your next-generation healthcare data discovery platform. Explore FHIR resources, 
            build intelligent queries, and visualize healthcare data like never before.
          </Alert>
        </Fade>
      )}

      {/* Statistics overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Zoom in timeout={600} style={{ transitionDelay: '100ms' }}>
            <div>
              <StatCard
                title="Total Resources"
                value={calculatedStats.totalResources}
                change={12}
                icon={<AssessmentIcon />}
                color="#1976d2"
                loading={loading}
              />
            </div>
          </Zoom>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Zoom in timeout={600} style={{ transitionDelay: '200ms' }}>
            <div>
              <StatCard
                title="Patients"
                value={calculatedStats.totalPatients}
                change={5}
                icon={<PeopleIcon />}
                color="#2196f3"
                loading={loading}
              />
            </div>
          </Zoom>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Zoom in timeout={600} style={{ transitionDelay: '300ms' }}>
            <div>
              <StatCard
                title="Observations"
                value={calculatedStats.recentObservations}
                change={8}
                icon={<ScienceIcon />}
                color="#4caf50"
                loading={loading}
              />
            </div>
          </Zoom>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Zoom in timeout={600} style={{ transitionDelay: '400ms' }}>
            <div>
              <StatCard
                title="Conditions"
                value={calculatedStats.activeConditions}
                change={-2}
                icon={<AssessmentIcon />}
                color="#f44336"
                loading={loading}
              />
            </div>
          </Zoom>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Quick actions */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
              Quick Actions
            </Typography>
            <Grid container spacing={2}>
              {QUICK_ACTIONS.map((action, index) => (
                <Grid item xs={12} sm={6} key={index}>
                  <Zoom in timeout={600} style={{ transitionDelay: `${500 + index * 100}ms` }}>
                    <div>
                      <QuickActionCard action={action} onNavigate={onNavigate} />
                    </div>
                  </Zoom>
                </Grid>
              ))}
            </Grid>
          </Paper>

          {/* Resource distribution */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
              Resource Distribution
            </Typography>
            <Grid container spacing={2}>
              {topResourceTypes.map(({ type, count }, index) => {
                const config = RESOURCE_CONFIGS[type] || { 
                  icon: <AssessmentIcon />, 
                  color: '#757575', 
                  label: type 
                };
                const percentage = calculatedStats.totalResources > 0 
                  ? (count / calculatedStats.totalResources * 100).toFixed(1) 
                  : 0;

                return (
                  <Grid item xs={12} sm={6} md={4} key={type}>
                    <Card 
                      variant="outlined" 
                      sx={{ 
                        p: 2,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          borderColor: config.color,
                          boxShadow: `0 4px 12px ${alpha(config.color, 0.15)}`
                        }
                      }}
                      onClick={() => onNavigate(APP_MODES.DISCOVERY, DISCOVERY_VIEWS.CATALOG)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Avatar 
                          sx={{ 
                            bgcolor: alpha(config.color, 0.1),
                            color: config.color,
                            mr: 2 
                          }}
                        >
                          {config.icon}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {count.toLocaleString()}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {config.label}
                          </Typography>
                        </Box>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={parseFloat(percentage)}
                        sx={{ 
                          bgcolor: alpha(config.color, 0.1),
                          '& .MuiLinearProgress-bar': {
                            bgcolor: config.color
                          }
                        }}
                      />
                      <Typography 
                        variant="caption" 
                        color="text.secondary"
                        sx={{ display: 'block', textAlign: 'right', mt: 1 }}
                      >
                        {percentage}% of total
                      </Typography>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Paper>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} lg={4}>
          {/* Sample queries */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Try These Queries
              </Typography>
              <Tooltip title="More in Query Builder">
                <IconButton 
                  size="small"
                  onClick={() => onNavigate(APP_MODES.QUERY_BUILDING, QUERY_VIEWS.PLAYGROUND)}
                >
                  <ChevronRightIcon />
                </IconButton>
              </Tooltip>
            </Box>
            {SAMPLE_QUERIES.map((query, index) => (
              <SampleQueryCard 
                key={index} 
                query={query} 
                onExecute={handleSampleQueryExecute}
              />
            ))}
          </Paper>

          {/* Recent activity */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Recent Activity
            </Typography>
            <RecentActivity queryHistory={queryHistory} />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default DashboardHome;