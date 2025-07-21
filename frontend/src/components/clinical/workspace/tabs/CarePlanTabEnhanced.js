/**
 * Enhanced Care Plan Tab Component
 * Part of the Clinical UI Improvements Initiative
 * 
 * Improvements:
 * - Visual goal progress tracking with charts
 * - Enhanced goal cards with progress indicators
 * - Interactive timeline view for care plan history
 * - Better visual hierarchy and data density
 * - Integrated with new UI components
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Alert,
  Tooltip,
  LinearProgress,
  CircularProgress,
  useTheme,
  alpha,
  Tabs,
  Tab,
  Badge,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Snackbar,
  Grid,
  Avatar,
  AvatarGroup,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Paper,
  Card,
  CardContent,
  CardActions,
  CardHeader
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Print as PrintIcon,
  Search as SearchIcon,
  Flag as GoalIcon,
  Assignment as TaskIcon,
  LocalHospital as InterventionIcon,
  Group as TeamIcon,
  TrendingUp as ProgressIcon,
  CheckCircle as CompletedIcon,
  Schedule as InProgressIcon,
  Cancel as CancelledIcon,
  Warning as OverdueIcon,
  CalendarMonth as CalendarIcon,
  Person as PersonIcon,
  Notes as NotesIcon,
  Timeline as TimelineIcon,
  Assessment as OutcomeIcon,
  Favorite as HealthIcon,
  Psychology as BehavioralIcon,
  Restaurant as NutritionIcon,
  FitnessCenter as ExerciseIcon,
  MedicalServices as MedicalIcon,
  Close as CloseIcon,
  ViewList as ListView,
  ViewModule as CardView,
  AccountTree as TreeView,
  Target as TargetIcon,
  EmojiEvents as AchievementIcon,
  ShowChart as ChartIcon,
  ArrowUpward as UpIcon,
  ArrowDownward as DownIcon,
  Remove as NoChangeIcon
} from '@mui/icons-material';
import { format, parseISO, formatDistanceToNow, isPast, isFuture, differenceInDays, addDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import { printDocument } from '../../../../core/export/printUtils';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import { motion, AnimatePresence } from 'framer-motion';

// Import new UI components
import ClinicalCard from '../../ui/ClinicalCard';
import MetricsBar from '../../ui/MetricsBar';
import ResourceTimeline from '../../ui/ResourceTimeline';
import SmartTable from '../../ui/SmartTable';
import TrendSparkline from '../../ui/TrendSparkline';
import { ContextualFAB } from '../../ui/QuickActionFAB';
import { useThemeDensity } from '../../../../hooks/useThemeDensity';

// Enhanced goal categories with colors and icons
const goalCategories = {
  'health-maintenance': { 
    icon: <HealthIcon />, 
    label: 'Health Maintenance', 
    color: 'primary',
    description: 'General health and wellness goals'
  },
  'behavioral': { 
    icon: <BehavioralIcon />, 
    label: 'Behavioral', 
    color: 'secondary',
    description: 'Mental health and behavioral goals'
  },
  'nutrition': { 
    icon: <NutritionIcon />, 
    label: 'Nutrition', 
    color: 'warning',
    description: 'Diet and nutrition goals'
  },
  'exercise': { 
    icon: <ExerciseIcon />, 
    label: 'Exercise', 
    color: 'info',
    description: 'Physical activity and fitness goals'
  },
  'medical': { 
    icon: <MedicalIcon />, 
    label: 'Medical', 
    color: 'error',
    description: 'Medical treatment and therapy goals'
  }
};

// Enhanced Goal Card Component
const EnhancedGoalCard = ({ goal, onEdit, onViewProgress, onUpdateProgress, density }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  
  const category = goal.category?.[0]?.coding?.[0]?.code || 'health-maintenance';
  const categoryConfig = goalCategories[category] || goalCategories['health-maintenance'];
  const targetDate = goal.target?.[0]?.dueDate;
  const isOverdue = targetDate && isPast(parseISO(targetDate)) && goal.lifecycleStatus === 'active';
  const daysUntilDue = targetDate ? differenceInDays(parseISO(targetDate), new Date()) : null;
  
  // Calculate progress percentage
  const progressPercentage = goal.achievementStatus?.coding?.[0]?.code === 'achieved' ? 100 :
                            goal.achievementStatus?.coding?.[0]?.code === 'improving' ? 75 :
                            goal.achievementStatus?.coding?.[0]?.code === 'in-progress' ? 50 :
                            goal.achievementStatus?.coding?.[0]?.code === 'no-change' ? 25 : 0;

  // Determine severity based on status and due date
  const getSeverity = () => {
    if (goal.lifecycleStatus === 'completed') return 'success';
    if (goal.lifecycleStatus === 'cancelled') return 'low';
    if (isOverdue) return 'critical';
    if (daysUntilDue && daysUntilDue <= 7) return 'high';
    return 'normal';
  };

  // Progress trend indicator
  const getTrendIcon = () => {
    const achievement = goal.achievementStatus?.coding?.[0]?.code;
    if (achievement === 'improving') return <UpIcon fontSize="small" color="success" />;
    if (achievement === 'worsening') return <DownIcon fontSize="small" color="error" />;
    return <NoChangeIcon fontSize="small" color="action" />;
  };

  const metrics = [
    {
      label: 'Progress',
      value: `${progressPercentage}%`,
      color: progressPercentage >= 80 ? 'success' : progressPercentage >= 50 ? 'warning' : 'error',
      showProgress: true,
      progress: progressPercentage
    },
    {
      label: 'Days Until Due',
      value: daysUntilDue !== null ? (daysUntilDue < 0 ? `${Math.abs(daysUntilDue)}d overdue` : `${daysUntilDue}d`) : 'No deadline',
      color: isOverdue ? 'error' : daysUntilDue && daysUntilDue <= 7 ? 'warning' : 'default'
    }
  ];

  const actions = [
    { icon: <EditIcon />, onClick: () => onEdit(goal), tooltip: 'Edit Goal' },
    { icon: <ChartIcon />, onClick: () => onViewProgress(goal), tooltip: 'View Progress' },
    { icon: <ProgressIcon />, onClick: () => onUpdateProgress(goal), tooltip: 'Update Progress' }
  ];

  return (
    <ClinicalCard
      severity={getSeverity()}
      title={goal.description?.text || 'Goal'}
      subtitle={
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip 
            label={categoryConfig.label} 
            size="small" 
            variant="outlined"
            icon={categoryConfig.icon}
          />
          {getTrendIcon()}
        </Stack>
      }
      status={goal.lifecycleStatus}
      expandable
      expanded={expanded}
      onExpandChange={setExpanded}
      metrics={metrics}
      actions={actions}
      density={density}
    >
      <Stack spacing={2}>
        {goal.target?.[0]?.measure && (
          <Box>
            <Typography variant="caption" color="text.secondary">Target Measure</Typography>
            <Typography variant="body2">
              {goal.target[0].measure.text || goal.target[0].measure.coding?.[0]?.display}
              {goal.target[0].detailQuantity && 
                `: ${goal.target[0].detailQuantity.value} ${goal.target[0].detailQuantity.unit}`
              }
            </Typography>
          </Box>
        )}
        
        {goal.note?.[0] && (
          <Box>
            <Typography variant="caption" color="text.secondary">Notes</Typography>
            <Typography variant="body2">{goal.note[0].text}</Typography>
          </Box>
        )}
        
        {goal.addresses?.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary">Addresses</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {goal.addresses.map((condition, idx) => (
                <Chip
                  key={idx}
                  label={condition.display || 'Condition'}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </ClinicalCard>
  );
};

// Goal Progress Chart Component
const GoalProgressChart = ({ goal, observations }) => {
  const theme = useTheme();
  
  // Transform observations into chart data
  const chartData = useMemo(() => {
    if (!observations || observations.length === 0) return [];
    
    return observations
      .filter(obs => obs.valueQuantity?.value !== undefined)
      .map(obs => ({
        date: obs.effectiveDateTime || obs.issued,
        value: obs.valueQuantity.value,
        unit: obs.valueQuantity.unit
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-20); // Last 20 observations
  }, [observations]);

  if (chartData.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', bgcolor: 'background.paper', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          No progress data available
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
      <Typography variant="subtitle2" gutterBottom>
        Progress Trend
      </Typography>
      <TrendSparkline
        data={chartData.map(d => d.value)}
        width={300}
        height={100}
        color={theme.palette.primary.main}
        showArea
      />
      <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {format(parseISO(chartData[0].date), 'MMM d')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Latest: {chartData[chartData.length - 1].value} {chartData[chartData.length - 1].unit}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {format(parseISO(chartData[chartData.length - 1].date), 'MMM d')}
        </Typography>
      </Stack>
    </Box>
  );
};

// Care Team Member Component
const CareTeamMember = ({ participant, onEdit }) => {
  const role = participant.role?.[0]?.text || participant.role?.[0]?.coding?.[0]?.display || 'Team Member';
  const memberSince = participant.period?.start ? 
    formatDistanceToNow(parseISO(participant.period.start), { addSuffix: true }) : 
    'Recently joined';
  
  return (
    <ListItem>
      <ListItemIcon>
        <Avatar sx={{ width: 32, height: 32 }}>
          <PersonIcon />
        </Avatar>
      </ListItemIcon>
      <ListItemText
        primary={participant.member?.display || 'Team Member'}
        secondary={
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label={role} size="small" variant="outlined" />
            <Typography variant="caption" color="text.secondary">
              • {memberSince}
            </Typography>
          </Stack>
        }
      />
      <ListItemSecondaryAction>
        <IconButton edge="end" size="small" onClick={() => onEdit(participant)}>
          <EditIcon fontSize="small" />
        </IconButton>
      </ListItemSecondaryAction>
    </ListItem>
  );
};

const CarePlanTabEnhanced = ({ patientId, patient, density: propDensity }) => {
  const theme = useTheme();
  const [themeDensity] = useThemeDensity();
  const density = propDensity || themeDensity;
  
  const { getPatientResources, isLoading, refreshPatientResources } = useFHIRResource();
  const { publish } = useClinicalWorkflow();
  
  // State
  const [activeTab, setActiveTab] = useState(0);
  const [viewMode, setViewMode] = useState('cards');
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Get resources
  const carePlans = getPatientResources(patientId, 'CarePlan') || [];
  const goals = getPatientResources(patientId, 'Goal') || [];
  const careTeams = getPatientResources(patientId, 'CareTeam') || [];
  
  // Get active care plan
  const activeCarePlan = carePlans.find(cp => cp.status === 'active') || carePlans[0];
  const activities = activeCarePlan?.activity || [];
  const careTeam = careTeams[0];
  
  // Filter and sort goals
  const filteredGoals = useMemo(() => {
    return goals.filter(goal => {
      if (filterStatus !== 'all' && goal.lifecycleStatus !== filterStatus) {
        return false;
      }
      if (filterCategory !== 'all') {
        const category = goal.category?.[0]?.coding?.[0]?.code;
        if (category !== filterCategory) return false;
      }
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const goalText = (goal.description?.text || '').toLowerCase();
        if (!goalText.includes(searchLower)) return false;
      }
      return true;
    });
  }, [goals, filterStatus, filterCategory, searchTerm]);

  // Sort goals by priority and due date
  const sortedGoals = useMemo(() => {
    return [...filteredGoals].sort((a, b) => {
      // Overdue goals first
      const aOverdue = a.target?.[0]?.dueDate && isPast(parseISO(a.target[0].dueDate)) && a.lifecycleStatus === 'active';
      const bOverdue = b.target?.[0]?.dueDate && isPast(parseISO(b.target[0].dueDate)) && b.lifecycleStatus === 'active';
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      
      // Then by priority
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const aPriority = priorityOrder[a.priority?.coding?.[0]?.code] ?? 3;
      const bPriority = priorityOrder[b.priority?.coding?.[0]?.code] ?? 3;
      if (aPriority !== bPriority) return aPriority - bPriority;
      
      // Then by due date
      const aDate = a.target?.[0]?.dueDate || '';
      const bDate = b.target?.[0]?.dueDate || '';
      return aDate.localeCompare(bDate);
    });
  }, [filteredGoals]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const activeGoals = goals.filter(g => g.lifecycleStatus === 'active');
    const completedGoals = goals.filter(g => g.lifecycleStatus === 'completed');
    const overdueGoals = activeGoals.filter(g => 
      g.target?.[0]?.dueDate && isPast(parseISO(g.target[0].dueDate))
    );
    
    return [
      {
        label: 'Active Goals',
        value: activeGoals.length,
        color: 'primary',
        icon: <InProgressIcon />
      },
      {
        label: 'Completed',
        value: completedGoals.length,
        color: 'success',
        icon: <CompletedIcon />
      },
      {
        label: 'Overdue',
        value: overdueGoals.length,
        color: overdueGoals.length > 0 ? 'error' : 'default',
        icon: <OverdueIcon />
      },
      {
        label: 'Success Rate',
        value: goals.length > 0 ? 
          `${Math.round((completedGoals.length / goals.length) * 100)}%` : '0%',
        color: 'info',
        icon: <AchievementIcon />
      }
    ];
  }, [goals]);

  // Timeline data for goals
  const timelineData = useMemo(() => {
    return sortedGoals.map(goal => ({
      id: goal.id,
      date: goal.startDate || goal.meta?.lastUpdated,
      type: 'Goal',
      title: goal.description?.text || 'Goal',
      category: goal.category?.[0]?.coding?.[0]?.code || 'health-maintenance',
      status: goal.lifecycleStatus,
      resource: goal
    }));
  }, [sortedGoals]);

  // Quick actions for FAB
  const quickActions = [
    {
      icon: <GoalIcon />,
      label: 'New Goal',
      onClick: () => {
        setSelectedGoal(null);
        setGoalDialogOpen(true);
      }
    },
    {
      icon: <TaskIcon />,
      label: 'Add Activity',
      onClick: () => {
        setSelectedActivity(null);
        setActivityDialogOpen(true);
      }
    },
    {
      icon: <TeamIcon />,
      label: 'Add Team Member',
      onClick: () => {
        setSelectedParticipant(null);
        setTeamDialogOpen(true);
      }
    },
    {
      icon: <PrintIcon />,
      label: 'Print Care Plan',
      onClick: handlePrintCarePlan
    }
  ];

  function handlePrintCarePlan() {
    const patientInfo = {
      name: patient ? 
        `${patient.name?.[0]?.given?.join(' ') || ''} ${patient.name?.[0]?.family || ''}`.trim() : 
        'Unknown Patient',
      mrn: patient?.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || patient?.id,
      birthDate: patient?.birthDate,
      gender: patient?.gender
    };
    
    let content = '<h2>Care Plan & Goals</h2>';
    
    // Metrics summary
    content += '<div class="metrics-box">';
    metrics.forEach(metric => {
      content += `<div class="metric"><strong>${metric.label}:</strong> ${metric.value}</div>`;
    });
    content += '</div>';
    
    // Goals by category
    Object.entries(goalCategories).forEach(([key, config]) => {
      const categoryGoals = sortedGoals.filter(g => 
        (g.category?.[0]?.coding?.[0]?.code || 'health-maintenance') === key
      );
      
      if (categoryGoals.length > 0) {
        content += `<h3>${config.label}</h3>`;
        categoryGoals.forEach(goal => {
          const targetDate = goal.target?.[0]?.dueDate;
          const isOverdue = targetDate && isPast(parseISO(targetDate)) && goal.lifecycleStatus === 'active';
          
          content += '<div class="note-box avoid-break">';
          content += `<h4>${goal.description?.text || 'Goal'}</h4>`;
          content += `<p><strong>Status:</strong> ${goal.lifecycleStatus}`;
          if (isOverdue) content += ' <span class="error">(OVERDUE)</span>';
          content += '</p>';
          
          if (targetDate) {
            content += `<p><strong>Target Date:</strong> ${format(parseISO(targetDate), 'MMMM d, yyyy')}</p>`;
          }
          
          if (goal.target?.[0]?.measure) {
            content += `<p><strong>Target:</strong> ${goal.target[0].measure.text || goal.target[0].measure.coding?.[0]?.display}`;
            if (goal.target[0].detailQuantity) {
              content += ` - ${goal.target[0].detailQuantity.value} ${goal.target[0].detailQuantity.unit}`;
            }
            content += '</p>';
          }
          
          if (goal.note?.[0]) {
            content += `<p><strong>Notes:</strong> ${goal.note[0].text}</p>`;
          }
          content += '</div>';
        });
      }
    });
    
    // Care team
    if (careTeam?.participant?.length > 0) {
      content += '<h3>Care Team</h3>';
      content += '<ul>';
      careTeam.participant.forEach(p => {
        const member = p.member?.display || 'Team Member';
        const role = p.role?.[0]?.text || p.role?.[0]?.coding?.[0]?.display || 'Role not specified';
        content += `<li>${member} - ${role}</li>`;
      });
      content += '</ul>';
    }
    
    // Activities
    if (activities.length > 0) {
      content += '<h3>Activities & Interventions</h3>';
      content += '<ul>';
      activities.forEach(activity => {
        const description = activity.detail?.description || 'Activity';
        const status = activity.detail?.status || 'Unknown';
        content += `<li>${description} (${status})`;
        if (activity.detail?.scheduledTiming?.repeat?.frequency) {
          content += ` - ${activity.detail.scheduledTiming.repeat.frequency} times per ${activity.detail.scheduledTiming.repeat.period} ${activity.detail.scheduledTiming.repeat.periodUnit}`;
        }
        content += '</li>';
      });
      content += '</ul>';
    }
    
    printDocument({
      title: 'Care Plan & Goals',
      patient: patientInfo,
      content
    });
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Metrics Bar */}
      <MetricsBar metrics={metrics} density={density} />
      
      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab 
            label={
              <Badge badgeContent={sortedGoals.length} color="primary">
                Goals
              </Badge>
            } 
          />
          <Tab 
            label={
              <Badge badgeContent={activities.length} color="secondary">
                Activities
              </Badge>
            } 
          />
          <Tab 
            label={
              <Badge badgeContent={careTeam?.participant?.length || 0} color="info">
                Care Team
              </Badge>
            } 
          />
          <Tab label="Timeline" />
        </Tabs>
      </Box>
      
      {/* Content Area */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {/* Goals Tab */}
        {activeTab === 0 && (
          <Stack spacing={2}>
            {/* Filters */}
            <Paper sx={{ p: 2 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  placeholder="Search goals..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    )
                  }}
                />
                
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    label="Status"
                  >
                    <MenuItem value="all">All Status</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                    <MenuItem value="cancelled">Cancelled</MenuItem>
                    <MenuItem value="on-hold">On Hold</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    label="Category"
                  >
                    <MenuItem value="all">All Categories</MenuItem>
                    {Object.entries(goalCategories).map(([key, config]) => (
                      <MenuItem key={key} value={key}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {config.icon}
                          <span>{config.label}</span>
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={(e, v) => v && setViewMode(v)}
                  size="small"
                >
                  <ToggleButton value="cards">
                    <CardView />
                  </ToggleButton>
                  <ToggleButton value="list">
                    <ListView />
                  </ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            </Paper>
            
            {/* Goals Display */}
            {sortedGoals.length === 0 ? (
              <Alert severity="info">
                No goals found matching your criteria
              </Alert>
            ) : viewMode === 'cards' ? (
              <Grid container spacing={2}>
                {sortedGoals.map((goal) => (
                  <Grid item xs={12} md={6} key={goal.id}>
                    <EnhancedGoalCard
                      goal={goal}
                      onEdit={() => {
                        setSelectedGoal(goal);
                        setGoalDialogOpen(true);
                      }}
                      onViewProgress={() => {
                        setSelectedGoal(goal);
                        setProgressDialogOpen(true);
                      }}
                      onUpdateProgress={() => {
                        setSelectedGoal(goal);
                        setProgressDialogOpen(true);
                      }}
                      density={density}
                    />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <SmartTable
                columns={[
                  { 
                    id: 'description', 
                    label: 'Goal',
                    render: (row) => (
                      <Stack>
                        <Typography variant="body2">{row.description?.text || 'Goal'}</Typography>
                        <Stack direction="row" spacing={1}>
                          <Chip 
                            label={goalCategories[row.category?.[0]?.coding?.[0]?.code || 'health-maintenance'].label} 
                            size="small" 
                            variant="outlined"
                          />
                        </Stack>
                      </Stack>
                    )
                  },
                  { 
                    id: 'status', 
                    label: 'Status',
                    render: (row) => {
                      const status = row.lifecycleStatus;
                      const color = status === 'completed' ? 'success' : 
                                   status === 'cancelled' ? 'error' : 
                                   status === 'active' ? 'primary' : 'default';
                      return <Chip label={status} size="small" color={color} />;
                    }
                  },
                  { 
                    id: 'progress', 
                    label: 'Progress',
                    render: (row) => {
                      const progress = row.achievementStatus?.coding?.[0]?.code === 'achieved' ? 100 :
                                     row.achievementStatus?.coding?.[0]?.code === 'improving' ? 75 :
                                     row.achievementStatus?.coding?.[0]?.code === 'in-progress' ? 50 :
                                     row.achievementStatus?.coding?.[0]?.code === 'no-change' ? 25 : 0;
                      return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ flex: 1 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={progress} 
                              sx={{ height: 6 }}
                              color={progress >= 80 ? 'success' : progress >= 50 ? 'warning' : 'error'}
                            />
                          </Box>
                          <Typography variant="caption">{progress}%</Typography>
                        </Box>
                      );
                    }
                  },
                  { 
                    id: 'dueDate', 
                    label: 'Due Date',
                    render: (row) => {
                      const dueDate = row.target?.[0]?.dueDate;
                      if (!dueDate) return 'No deadline';
                      const date = parseISO(dueDate);
                      const isOverdue = isPast(date) && row.lifecycleStatus === 'active';
                      return (
                        <Typography 
                          variant="body2" 
                          color={isOverdue ? 'error' : 'text.primary'}
                        >
                          {format(date, 'MMM d, yyyy')}
                          {isOverdue && ' (Overdue)'}
                        </Typography>
                      );
                    }
                  }
                ]}
                data={sortedGoals}
                density={density}
                onRowClick={(row) => {
                  setSelectedGoal(row);
                  setProgressDialogOpen(true);
                }}
              />
            )}
          </Stack>
        )}
        
        {/* Activities Tab */}
        {activeTab === 1 && (
          <Stack spacing={2}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Activities & Interventions
              </Typography>
              {activities.length === 0 ? (
                <Alert severity="info">
                  No activities or interventions defined
                </Alert>
              ) : (
                <List>
                  {activities.map((activity, index) => {
                    const status = activity.detail?.status || 'not-started';
                    const statusColor = status === 'completed' ? 'success' :
                                      status === 'cancelled' ? 'error' :
                                      status === 'in-progress' ? 'primary' : 'default';
                    
                    return (
                      <React.Fragment key={index}>
                        <ListItem>
                          <ListItemIcon>
                            <TaskIcon color={status === 'overdue' ? 'error' : 'action'} />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="body1">
                                  {activity.detail?.description || 'Activity'}
                                </Typography>
                                <Chip label={status} size="small" color={statusColor} />
                              </Stack>
                            }
                            secondary={
                              <Stack spacing={0.5}>
                                {activity.detail?.scheduledTiming?.repeat?.frequency && (
                                  <Typography variant="caption">
                                    Frequency: {activity.detail.scheduledTiming.repeat.frequency} times per{' '}
                                    {activity.detail.scheduledTiming.repeat.period} {activity.detail.scheduledTiming.repeat.periodUnit}
                                  </Typography>
                                )}
                                {activity.detail?.location && (
                                  <Typography variant="caption">
                                    Location: {activity.detail.location.display}
                                  </Typography>
                                )}
                                {activity.detail?.performer?.[0] && (
                                  <Typography variant="caption">
                                    Assigned to: {activity.detail.performer[0].display || 'Provider'}
                                  </Typography>
                                )}
                              </Stack>
                            }
                          />
                          <ListItemSecondaryAction>
                            <IconButton 
                              edge="end" 
                              size="small" 
                              onClick={() => {
                                setSelectedActivity(activity);
                                setActivityDialogOpen(true);
                              }}
                            >
                              <EditIcon />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItem>
                        {index < activities.length - 1 && <Divider component="li" />}
                      </React.Fragment>
                    );
                  })}
                </List>
              )}
            </Paper>
          </Stack>
        )}
        
        {/* Care Team Tab */}
        {activeTab === 2 && (
          <Stack spacing={2}>
            <Paper sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  Care Team Members
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setSelectedParticipant(null);
                    setTeamDialogOpen(true);
                  }}
                >
                  Add Member
                </Button>
              </Stack>
              
              {!careTeam || careTeam.participant?.length === 0 ? (
                <Alert severity="info">
                  No care team members assigned
                </Alert>
              ) : (
                <List>
                  {careTeam.participant.map((participant, index) => (
                    <CareTeamMember
                      key={index}
                      participant={participant}
                      onEdit={() => {
                        setSelectedParticipant(participant);
                        setTeamDialogOpen(true);
                      }}
                    />
                  ))}
                </List>
              )}
            </Paper>
            
            {/* Team Collaboration Summary */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Collaboration Summary
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <MetricsBar 
                    metrics={[
                      { label: 'Total Members', value: careTeam?.participant?.length || 0, color: 'primary' },
                      { label: 'Active Tasks', value: activities.filter(a => a.detail?.status === 'in-progress').length, color: 'warning' }
                    ]}
                    density="compact"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" gutterBottom>Role Distribution</Typography>
                  <Stack spacing={1}>
                    {careTeam?.participant?.reduce((acc, p) => {
                      const role = p.role?.[0]?.text || p.role?.[0]?.coding?.[0]?.display || 'Unknown';
                      acc[role] = (acc[role] || 0) + 1;
                      return acc;
                    }, {}) && Object.entries(
                      careTeam.participant.reduce((acc, p) => {
                        const role = p.role?.[0]?.text || p.role?.[0]?.coding?.[0]?.display || 'Unknown';
                        acc[role] = (acc[role] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([role, count]) => (
                      <Stack key={role} direction="row" justifyContent="space-between">
                        <Typography variant="body2">{role}</Typography>
                        <Chip label={count} size="small" />
                      </Stack>
                    ))}
                  </Stack>
                </Grid>
              </Grid>
            </Paper>
          </Stack>
        )}
        
        {/* Timeline Tab */}
        {activeTab === 3 && (
          <Box>
            <ResourceTimeline
              resources={timelineData}
              height={600}
              onResourceClick={(resource) => {
                if (resource.type === 'Goal') {
                  setSelectedGoal(resource.resource);
                  setProgressDialogOpen(true);
                }
              }}
            />
          </Box>
        )}
      </Box>
      
      {/* Contextual FAB */}
      <ContextualFAB
        module="care-plan"
        actions={quickActions}
        density={density}
      />
      
      {/* Dialogs would go here - keeping them simple for now */}
      {/* Goal Editor Dialog */}
      <Dialog open={goalDialogOpen} onClose={() => setGoalDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedGoal ? 'Edit Goal' : 'New Goal'}
        </DialogTitle>
        <DialogContent>
          {/* Goal form fields */}
          <Typography variant="body2" sx={{ p: 2 }}>
            Goal editor form would go here
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGoalDialogOpen(false)}>Cancel</Button>
          <Button variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
      
      {/* Progress Dialog */}
      <Dialog open={progressDialogOpen} onClose={() => setProgressDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Goal Progress
        </DialogTitle>
        <DialogContent>
          {selectedGoal && (
            <Stack spacing={3} sx={{ mt: 2 }}>
              <Alert severity="info">
                {selectedGoal.description?.text || 'Goal'}
              </Alert>
              
              {/* Progress visualization would go here */}
              <Typography variant="body2">
                Progress tracking and visualization would be displayed here
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProgressDialogOpen(false)}>Close</Button>
          <Button variant="contained">Update Progress</Button>
        </DialogActions>
      </Dialog>
      
      {/* Team Member Dialog */}
      <Dialog open={teamDialogOpen} onClose={() => setTeamDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedParticipant ? 'Edit Team Member' : 'Add Team Member'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ p: 2 }}>
            Team member form would go here
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTeamDialogOpen(false)}>Cancel</Button>
          <Button variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
      
      {/* Activity Dialog */}
      <Dialog open={activityDialogOpen} onClose={() => setActivityDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedActivity ? 'Edit Activity' : 'Add Activity'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ p: 2 }}>
            Activity form would go here
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActivityDialogOpen(false)}>Cancel</Button>
          <Button variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default React.memo(CarePlanTabEnhanced);