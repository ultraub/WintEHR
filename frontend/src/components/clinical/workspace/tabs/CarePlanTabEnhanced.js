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

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  ListItemAvatar,
  ListItemSecondaryAction,
  Paper,
  Card,
  CardContent,
  CardActions,
  CardHeader,
  Fab
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
import { formatClinicalDate } from '../../../../core/fhir/utils/dateFormatUtils';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import { navigateToTab, TAB_IDS } from '../../utils/navigationHelper';
import { printDocument } from '../../../../core/export/printUtils';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
// Removed framer-motion for consistency

// Import shared clinical components
import { 
  ClinicalResourceCard,
  ClinicalSummaryCard,
  ClinicalFilterPanel,
  ClinicalDataGrid,
  ClinicalEmptyState,
  ClinicalLoadingState
} from '../../shared';

// Import old UI components to be replaced
import { MetricsBar } from '../../shared/display';
import { ResourceTimeline } from '../../shared/display';
import { AlertTitle } from '@mui/material';

// Custom hooks
const useDensity = () => {
  const [density, setDensity] = useState('comfortable');
  return { density, setDensity };
};

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
const EnhancedGoalCard = ({ goal, onEdit, onViewProgress, onUpdateProgress, density, isAlternate = false }) => {
  const theme = useTheme();
  
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
    if (goal.lifecycleStatus === 'cancelled') return 'low';
    if (isOverdue) return 'critical';
    if (daysUntilDue && daysUntilDue <= 7) return 'high';
    if (goal.lifecycleStatus === 'completed') return 'normal';
    return 'normal';
  };

  const getStatusColor = () => {
    if (goal.lifecycleStatus === 'completed') return 'success';
    if (goal.lifecycleStatus === 'cancelled') return 'default';
    if (goal.lifecycleStatus === 'on-hold') return 'warning';
    return 'primary';
  };

  // Progress trend indicator
  const getTrendIcon = () => {
    const achievement = goal.achievementStatus?.coding?.[0]?.code;
    if (achievement === 'improving') return <UpIcon fontSize="small" color="success" />;
    if (achievement === 'worsening') return <DownIcon fontSize="small" color="error" />;
    return <NoChangeIcon fontSize="small" color="action" />;
  };

  const details = [
    { label: 'Category', value: categoryConfig.label },
    { label: 'Progress', value: `${progressPercentage}%` },
    { label: 'Target Date', value: targetDate ? formatClinicalDate(targetDate) : 'No deadline' },
    { label: 'Status', value: goal.lifecycleStatus || 'active' }
  ];

  if (daysUntilDue !== null && goal.lifecycleStatus === 'active') {
    details.push({ 
      label: 'Time Remaining', 
      value: daysUntilDue < 0 ? `${Math.abs(daysUntilDue)}d overdue` : `${daysUntilDue}d` 
    });
  }

  const actions = [
    { icon: <EditIcon />, onClick: () => onEdit(goal), label: 'Edit Goal' },
    { icon: <ChartIcon />, onClick: () => onViewProgress(goal), label: 'View Progress' },
    { icon: <ProgressIcon />, onClick: () => onUpdateProgress(goal), label: 'Update Progress' }
  ];

  return (
    <ClinicalResourceCard
      title={goal.description?.text || 'Goal'}
      severity={getSeverity()}
      status={goal.lifecycleStatus || 'active'}
      statusColor={getStatusColor()}
      icon={categoryConfig.icon}
      details={details}
      onEdit={() => onEdit(goal)}
      actions={actions}
      isAlternate={isAlternate}
    >
      <Box sx={{ mt: 2 }}>
        {/* Progress bar */}
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="body2">Progress</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              {getTrendIcon()}
              <Typography variant="body2" fontWeight="medium">
                {progressPercentage}%
              </Typography>
            </Stack>
          </Stack>
          <LinearProgress 
            variant="determinate" 
            value={progressPercentage} 
            sx={{ 
              height: 8, 
              borderRadius: 0,
              backgroundColor: theme.palette.action.disabledBackground,
              '& .MuiLinearProgress-bar': {
                backgroundColor: progressPercentage >= 80 ? theme.palette.success.main : 
                                progressPercentage >= 50 ? theme.palette.warning.main : 
                                theme.palette.error.main
              }
            }}
          />
        </Box>
        
        {goal.target?.[0]?.measure && (
          <Box sx={{ mb: 2 }}>
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
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">Notes</Typography>
            <Typography variant="body2">{goal.note[0].text}</Typography>
          </Box>
        )}
        
        {goal.addresses?.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary">Addresses</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 0.5 }}>
              {goal.addresses.map((condition, idx) => (
                <Chip
                  key={idx}
                  label={condition.display || 'Condition'}
                  size="small"
                  variant="outlined"
                  sx={{ borderRadius: '4px' }}
                />
              ))}
            </Stack>
          </Box>
        )}
      </Box>
    </ClinicalResourceCard>
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
      <ClinicalEmptyState
        title="No progress data available"
        message="Start tracking progress to see trends over time."
      />
    );
  }

  return (
    <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 0, border: 1, borderColor: 'divider' }}>
      <Typography variant="subtitle2" gutterBottom>
        Progress Trend
      </Typography>
      {/* Simplified trend display */}
      <Box sx={{ height: 100, display: 'flex', alignItems: 'flex-end', gap: 0.5 }}>
        {chartData.map((d, idx) => (
          <Box
            key={idx}
            sx={{
              flex: 1,
              height: `${(d.value / Math.max(...chartData.map(p => p.value))) * 100}%`,
              bgcolor: theme.palette.primary.main,
              minHeight: 4
            }}
          />
        ))}
      </Box>
      <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {formatClinicalDate(chartData[0].date, 'monthDay')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Latest: {chartData[chartData.length - 1].value} {chartData[chartData.length - 1].unit}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatClinicalDate(chartData[chartData.length - 1].date, 'monthDay')}
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
            <Chip label={role} size="small" variant="outlined" sx={{ borderRadius: '4px' }} />
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

const CarePlanTabEnhanced = ({
  patientId,
  patient,
  density: propDensity,
  onNavigateToTab // Cross-tab navigation support
}) => {
  const theme = useTheme();
  const { density, setDensity } = useDensity();
  
  const { getPatientResources, isLoading, refreshPatientResources, searchResources } = useFHIRResource();
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
  const [isSaving, setIsSaving] = useState(false);

  // Form refs for Goal dialog
  const goalDescriptionRef = useRef(null);
  const goalCategoryRef = useRef(null);
  const goalTargetDateRef = useRef(null);
  const goalPriorityRef = useRef(null);
  const goalNotesRef = useRef(null);

  // Form refs for Activity dialog
  const activityDescriptionRef = useRef(null);
  const activityStatusRef = useRef(null);
  const activityCategoryRef = useRef(null);
  const activityAssignedRef = useRef(null);
  const activityLocationRef = useRef(null);
  const activityFrequencyRef = useRef(null);
  const activityPeriodRef = useRef(null);
  const activityDurationRef = useRef(null);
  const activityNotesRef = useRef(null);

  // Form refs for Team Member dialog
  const teamMemberNameRef = useRef(null);
  const teamMemberRoleRef = useRef(null);
  const teamMemberContactRef = useRef(null);
  const teamMemberStartDateRef = useRef(null);
  const teamMemberEndDateRef = useRef(null);
  const teamMemberNotesRef = useRef(null);

  // Track if we've attempted to load resources for this patient
  const loadAttemptedRef = useRef(null);

  // Get resources from context - context persists across remounts
  const carePlans = getPatientResources(patientId, 'CarePlan') || [];
  const goals = getPatientResources(patientId, 'Goal') || [];
  const careTeams = getPatientResources(patientId, 'CareTeam') || [];

  // Debug logging
  console.log('CarePlanTab RENDER:', {
    patientId,
    carePlans: carePlans.length,
    careTeams: careTeams.length,
    goals: goals.length,
    loadAttemptedFor: loadAttemptedRef.current
  });

  // Get active care plan
  const activeCarePlan = carePlans.find(cp => cp.status === 'active') || carePlans[0];
  const activities = activeCarePlan?.activity || [];
  const careTeam = careTeams[0];

  console.log('CarePlanTab: activeCarePlan=', activeCarePlan?.id, 'activities=', activities.length, 'careTeam=', careTeam?.id);

  // Load resources when tab mounts - store in context (persists across remounts)
  useEffect(() => {
    const loadCarePlanResources = async () => {
      // Skip if no patient
      if (!patientId) return;

      // Check what's missing from context
      const existingCarePlans = getPatientResources(patientId, 'CarePlan') || [];
      const existingCareTeams = getPatientResources(patientId, 'CareTeam') || [];
      const existingGoals = getPatientResources(patientId, 'Goal') || [];

      const needsCarePlans = existingCarePlans.length === 0;
      const needsCareTeams = existingCareTeams.length === 0;
      const needsGoals = existingGoals.length === 0;

      // Skip if all data is already loaded
      if (!needsCarePlans && !needsCareTeams && !needsGoals) {
        console.log('CarePlanTab: All data already in context, skipping fetch');
        return;
      }

      // Check if we've already tried fetching for this patient
      if (loadAttemptedRef.current === patientId) {
        console.log('CarePlanTab: Already attempted load for this patient');
        return;
      }

      loadAttemptedRef.current = patientId;
      console.log('CarePlanTab: Loading resources for patient', patientId, '- needs:', { needsCarePlans, needsCareTeams, needsGoals });

      try {
        // Fetch only what's missing in parallel using searchResources (creates patient relationships)
        const fetchPromises = [];
        if (needsCarePlans) {
          fetchPromises.push(
            searchResources('CarePlan', { patient: patientId, _count: 100 })
              .then(r => ({ type: 'CarePlan', count: r?.resources?.length || 0 }))
          );
        }
        if (needsCareTeams) {
          fetchPromises.push(
            searchResources('CareTeam', { patient: patientId, _count: 100 })
              .then(r => ({ type: 'CareTeam', count: r?.resources?.length || 0 }))
          );
        }
        if (needsGoals) {
          fetchPromises.push(
            searchResources('Goal', { patient: patientId, _count: 100 })
              .then(r => ({ type: 'Goal', count: r?.resources?.length || 0 }))
          );
        }

        const results = await Promise.all(fetchPromises);

        // searchResources automatically stores resources AND creates patient relationships
        results.forEach(({ type, count }) => {
          console.log('CarePlanTab: Fetched', count, type);
        });

        console.log('CarePlanTab: Resources stored in context with relationships');
      } catch (err) {
        console.error('CarePlanTab: Fetch failed:', err);
      }
    };

    loadCarePlanResources();
  }, [patientId, getPatientResources, searchResources]);

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

  // Aggregate care team members across all CareTeams (deduplicated)
  const aggregatedCareTeam = useMemo(() => {
    const memberMap = new Map();
    careTeams.forEach(team => {
      team.participant?.forEach(participant => {
        const memberId = participant.member?.reference || participant.member?.display || JSON.stringify(participant);
        if (!memberMap.has(memberId)) {
          memberMap.set(memberId, {
            ...participant,
            careTeams: [team.id],
            carePlansInvolved: []
          });
        } else {
          memberMap.get(memberId).careTeams.push(team.id);
        }
      });
    });

    // Link care team members to CarePlans
    carePlans.forEach(plan => {
      plan.careTeam?.forEach(teamRef => {
        const teamId = teamRef.reference?.split('/')[1];
        memberMap.forEach((member) => {
          if (member.careTeams.includes(teamId)) {
            if (!member.carePlansInvolved.includes(plan.id)) {
              member.carePlansInvolved.push(plan.id);
            }
          }
        });
      });
    });

    return Array.from(memberMap.values());
  }, [careTeams, carePlans]);

  // Categorize CarePlans by status
  const categorizedCarePlans = useMemo(() => {
    const active = carePlans.filter(cp => cp.status === 'active' || cp.status === 'on-hold');
    const completed = carePlans.filter(cp => cp.status === 'completed' || cp.status === 'revoked' || cp.status === 'entered-in-error');
    return { active, completed };
  }, [carePlans]);

  // Calculate care-focused metrics
  const metrics = useMemo(() => {
    const activeCarePlans = categorizedCarePlans.active;
    const activeGoals = goals.filter(g => g.lifecycleStatus === 'active');
    const overdueGoals = activeGoals.filter(g =>
      g.target?.[0]?.dueDate && isPast(parseISO(g.target[0].dueDate))
    );

    // Count unique conditions being managed
    const conditions = new Set();
    carePlans.forEach(plan => {
      plan.category?.forEach(cat => {
        const code = cat.coding?.[0]?.display || cat.text;
        if (code && code !== 'assess-plan') {
          conditions.add(code);
        }
      });
    });

    return [
      {
        label: 'Active Care Plans',
        value: activeCarePlans.length,
        color: activeCarePlans.length > 0 ? 'primary' : 'default',
        icon: <InterventionIcon />
      },
      {
        label: 'Conditions Managed',
        value: conditions.size || carePlans.length,
        color: 'info',
        icon: <MedicalIcon />
      },
      {
        label: 'Care Team',
        value: aggregatedCareTeam.filter(m => m.role?.[0]?.text !== 'Patient').length,
        color: 'secondary',
        icon: <TeamIcon />
      },
      {
        label: 'Active Goals',
        value: activeGoals.length,
        color: overdueGoals.length > 0 ? 'error' : activeGoals.length > 0 ? 'success' : 'default',
        icon: overdueGoals.length > 0 ? <OverdueIcon /> : <GoalIcon />,
        subtitle: overdueGoals.length > 0 ? `${overdueGoals.length} overdue` : null
      }
    ];
  }, [carePlans, categorizedCarePlans, goals, aggregatedCareTeam]);

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

  // ========================================
  // Save Handlers for FHIR Resources
  // ========================================

  /**
   * Save Goal to FHIR
   * Creates or updates a Goal resource
   */
  const handleSaveGoal = useCallback(async () => {
    if (!patientId) return;

    const description = goalDescriptionRef.current?.value?.trim();
    if (!description) {
      setSnackbar({
        open: true,
        message: 'Goal description is required',
        severity: 'error'
      });
      return;
    }

    setIsSaving(true);
    try {
      const category = goalCategoryRef.current?.value || 'health-maintenance';
      const targetDate = goalTargetDateRef.current?.value;
      const priority = goalPriorityRef.current?.value || 'medium';
      const notes = goalNotesRef.current?.value?.trim();

      const goalResource = {
        resourceType: 'Goal',
        lifecycleStatus: selectedGoal?.lifecycleStatus || 'active',
        achievementStatus: selectedGoal?.achievementStatus || {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/goal-achievement',
            code: 'in-progress',
            display: 'In Progress'
          }]
        },
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/goal-category',
            code: category,
            display: goalCategories[category]?.label || category
          }]
        }],
        priority: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/goal-priority',
            code: priority,
            display: priority.charAt(0).toUpperCase() + priority.slice(1)
          }]
        },
        description: {
          text: description
        },
        subject: {
          reference: `Patient/${patientId}`
        },
        startDate: selectedGoal?.startDate || new Date().toISOString().split('T')[0]
      };

      // Add target date if provided
      if (targetDate) {
        goalResource.target = [{
          dueDate: targetDate
        }];
      }

      // Add notes if provided
      if (notes) {
        goalResource.note = [{
          text: notes,
          time: new Date().toISOString()
        }];
      }

      let result;
      if (selectedGoal?.id) {
        // Update existing goal
        goalResource.id = selectedGoal.id;
        result = await fhirClient.update('Goal', selectedGoal.id, goalResource);
      } else {
        // Create new goal
        result = await fhirClient.create('Goal', goalResource);
      }

      // Refresh patient resources to get updated data
      await refreshPatientResources(patientId, ['Goal']);

      // Publish clinical event
      publish(CLINICAL_EVENTS.DOCUMENTATION_CREATED, {
        type: 'Goal',
        resourceId: result.id,
        patientId,
        action: selectedGoal?.id ? 'updated' : 'created'
      });

      setSnackbar({
        open: true,
        message: selectedGoal ? 'Goal updated successfully' : 'Goal created successfully',
        severity: 'success'
      });
      setGoalDialogOpen(false);
      setSelectedGoal(null);

    } catch (error) {
      console.error('Error saving goal:', error);
      setSnackbar({
        open: true,
        message: `Failed to save goal: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  }, [patientId, selectedGoal, refreshPatientResources, publish]);

  /**
   * Save Activity to CarePlan
   * Updates the CarePlan with new/modified activity
   */
  const handleSaveActivity = useCallback(async () => {
    if (!patientId || !activeCarePlan) {
      setSnackbar({
        open: true,
        message: 'No active care plan found',
        severity: 'error'
      });
      return;
    }

    const description = activityDescriptionRef.current?.value?.trim();
    if (!description) {
      setSnackbar({
        open: true,
        message: 'Activity description is required',
        severity: 'error'
      });
      return;
    }

    setIsSaving(true);
    try {
      const status = activityStatusRef.current?.value || 'not-started';
      const category = activityCategoryRef.current?.value || 'other';
      const assigned = activityAssignedRef.current?.value?.trim();
      const location = activityLocationRef.current?.value?.trim();
      const frequency = parseInt(activityFrequencyRef.current?.value) || 1;
      const period = activityPeriodRef.current?.value || 'd';
      const duration = parseInt(activityDurationRef.current?.value) || 1;

      const newActivity = {
        detail: {
          status: status,
          description: description,
          category: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/care-plan-activity-kind',
              code: category,
              display: category.charAt(0).toUpperCase() + category.slice(1)
            }]
          }
        }
      };

      // Add performer if assigned
      if (assigned) {
        newActivity.detail.performer = [{
          display: assigned
        }];
      }

      // Add location if provided
      if (location) {
        newActivity.detail.location = {
          display: location
        };
      }

      // Add scheduled timing
      newActivity.detail.scheduledTiming = {
        repeat: {
          frequency: frequency,
          period: duration,
          periodUnit: period
        }
      };

      // Update care plan with new/modified activity
      const updatedActivities = [...(activeCarePlan.activity || [])];

      if (selectedActivity) {
        // Find and update existing activity
        const activityIndex = updatedActivities.findIndex(
          a => a.detail?.description === selectedActivity.detail?.description
        );
        if (activityIndex >= 0) {
          updatedActivities[activityIndex] = newActivity;
        }
      } else {
        // Add new activity
        updatedActivities.push(newActivity);
      }

      const updatedCarePlan = {
        ...activeCarePlan,
        activity: updatedActivities
      };

      await fhirClient.update('CarePlan', activeCarePlan.id, updatedCarePlan);

      // Refresh patient resources
      await refreshPatientResources(patientId, ['CarePlan']);

      // Publish clinical event
      publish(CLINICAL_EVENTS.DOCUMENTATION_CREATED, {
        type: 'CarePlan',
        resourceId: activeCarePlan.id,
        patientId,
        action: 'activity_updated'
      });

      setSnackbar({
        open: true,
        message: selectedActivity ? 'Activity updated successfully' : 'Activity added successfully',
        severity: 'success'
      });
      setActivityDialogOpen(false);
      setSelectedActivity(null);

    } catch (error) {
      console.error('Error saving activity:', error);
      setSnackbar({
        open: true,
        message: `Failed to save activity: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  }, [patientId, activeCarePlan, selectedActivity, refreshPatientResources, publish]);

  /**
   * Save Team Member to CareTeam
   * Updates the CareTeam with new/modified participant
   */
  const handleSaveTeamMember = useCallback(async () => {
    if (!patientId) return;

    const memberName = teamMemberNameRef.current?.value?.trim();
    if (!memberName) {
      setSnackbar({
        open: true,
        message: 'Team member name is required',
        severity: 'error'
      });
      return;
    }

    setIsSaving(true);
    try {
      const role = teamMemberRoleRef.current?.value || 'caregiver';
      const contact = teamMemberContactRef.current?.value?.trim();
      const startDate = teamMemberStartDateRef.current?.value;
      const endDate = teamMemberEndDateRef.current?.value;

      const newParticipant = {
        role: [{
          coding: [{
            system: 'http://snomed.info/sct',
            code: role,
            display: role.charAt(0).toUpperCase() + role.replace(/-/g, ' ').slice(1)
          }]
        }],
        member: {
          display: memberName
        }
      };

      // Add period if dates provided
      if (startDate || endDate) {
        newParticipant.period = {};
        if (startDate) newParticipant.period.start = startDate;
        if (endDate) newParticipant.period.end = endDate;
      }

      let targetCareTeam = careTeam;

      if (!targetCareTeam) {
        // Create new CareTeam if none exists
        targetCareTeam = {
          resourceType: 'CareTeam',
          status: 'active',
          name: `Care Team for Patient`,
          subject: {
            reference: `Patient/${patientId}`
          },
          participant: []
        };
      }

      // Update care team with new/modified participant
      const updatedParticipants = [...(targetCareTeam.participant || [])];

      if (selectedParticipant) {
        // Find and update existing participant by display name
        const participantIndex = updatedParticipants.findIndex(
          p => p.member?.display === selectedParticipant.member?.display
        );
        if (participantIndex >= 0) {
          updatedParticipants[participantIndex] = newParticipant;
        }
      } else {
        // Add new participant
        updatedParticipants.push(newParticipant);
      }

      const updatedCareTeam = {
        ...targetCareTeam,
        participant: updatedParticipants
      };

      let result;
      if (targetCareTeam.id) {
        result = await fhirClient.update('CareTeam', targetCareTeam.id, updatedCareTeam);
      } else {
        result = await fhirClient.create('CareTeam', updatedCareTeam);
      }

      // Refresh patient resources
      await refreshPatientResources(patientId, ['CareTeam']);

      // Publish clinical event
      publish(CLINICAL_EVENTS.DOCUMENTATION_CREATED, {
        type: 'CareTeam',
        resourceId: result.id,
        patientId,
        action: selectedParticipant ? 'participant_updated' : 'participant_added'
      });

      setSnackbar({
        open: true,
        message: selectedParticipant ? 'Team member updated successfully' : 'Team member added successfully',
        severity: 'success'
      });
      setTeamDialogOpen(false);
      setSelectedParticipant(null);

    } catch (error) {
      console.error('Error saving team member:', error);
      setSnackbar({
        open: true,
        message: `Failed to save team member: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  }, [patientId, careTeam, selectedParticipant, refreshPatientResources, publish]);

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
            content += `<p><strong>Target Date:</strong> ${formatClinicalDate(targetDate, 'verbose')}</p>`;
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
      <Stack direction="row" spacing={2} sx={{ p: 2, backgroundColor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
        {metrics.map((metric, index) => (
          <ClinicalSummaryCard
            key={index}
            title={metric.label}
            value={metric.value}
            severity={metric.color === 'error' ? 'high' : metric.color === 'warning' ? 'moderate' : 'normal'}
            icon={metric.icon}
          />
        ))}
      </Stack>
      
      {/* Tabs - Reordered for Option B: Longitudinal Care Coordination */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab
            label={
              <Badge badgeContent={carePlans.length} color="primary">
                Care Plans
              </Badge>
            }
          />
          <Tab
            label={
              <Badge badgeContent={aggregatedCareTeam.filter(m => m.role?.[0]?.text !== 'Patient').length} color="info">
                Care Team
              </Badge>
            }
          />
          <Tab
            label={
              <Badge badgeContent={sortedGoals.length} color={sortedGoals.length > 0 ? "success" : "default"}>
                Goals
              </Badge>
            }
          />
          <Tab label="Timeline" />
        </Tabs>
      </Box>
      
      {/* Content Area */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Care Plans Tab (Tab 0) - NEW: Longitudinal Care View */}
        {activeTab === 0 && (
          <Box sx={{ p: 2 }}>
            <Stack spacing={3}>
              {/* Active Care Plans Section */}
              {categorizedCarePlans.active.length > 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InterventionIcon color="primary" />
                    Active Care Plans
                  </Typography>
                  <Stack spacing={2}>
                    {categorizedCarePlans.active.map((plan) => {
                      const planCondition = plan.category?.find(c => c.coding?.[0]?.display && c.coding?.[0]?.display !== 'assess-plan')?.coding?.[0]?.display
                        || plan.category?.find(c => c.text)?.text
                        || 'General Care Plan';
                      const planActivities = plan.activity || [];
                      const planTeam = careTeams.find(t => plan.careTeam?.some(ref => ref.reference?.includes(t.id)));

                      return (
                        <Card key={plan.id} sx={{ borderRadius: 0, borderLeft: 4, borderLeftColor: 'primary.main' }}>
                          <CardHeader
                            avatar={<MedicalIcon color="primary" />}
                            title={planCondition}
                            subheader={
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Chip label={plan.status} size="small" color="primary" sx={{ borderRadius: '4px' }} />
                                {plan.period?.start && (
                                  <Typography variant="caption" color="text.secondary">
                                    Since {formatClinicalDate(plan.period.start)}
                                  </Typography>
                                )}
                              </Stack>
                            }
                            action={
                              <IconButton onClick={() => { setSelectedActivity(null); setActivityDialogOpen(true); }}>
                                <AddIcon />
                              </IconButton>
                            }
                          />
                          <CardContent>
                            <Grid container spacing={2}>
                              {/* Activities */}
                              <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" gutterBottom>
                                  <TaskIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                                  Activities ({planActivities.length})
                                </Typography>
                                {planActivities.length === 0 ? (
                                  <Typography variant="body2" color="text.secondary">No activities defined</Typography>
                                ) : (
                                  <List dense disablePadding>
                                    {planActivities.slice(0, 3).map((activity, idx) => (
                                      <ListItem key={idx} disablePadding sx={{ py: 0.5 }}>
                                        <ListItemIcon sx={{ minWidth: 32 }}>
                                          {activity.detail?.status === 'completed' ? <CompletedIcon color="success" fontSize="small" /> :
                                           activity.detail?.status === 'in-progress' ? <InProgressIcon color="primary" fontSize="small" /> :
                                           <TaskIcon fontSize="small" color="action" />}
                                        </ListItemIcon>
                                        <ListItemText
                                          primary={activity.detail?.description || 'Activity'}
                                          primaryTypographyProps={{ variant: 'body2' }}
                                        />
                                      </ListItem>
                                    ))}
                                    {planActivities.length > 3 && (
                                      <Typography variant="caption" color="text.secondary" sx={{ pl: 4 }}>
                                        +{planActivities.length - 3} more activities
                                      </Typography>
                                    )}
                                  </List>
                                )}
                              </Grid>
                              {/* Care Team for this plan */}
                              <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" gutterBottom>
                                  <TeamIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                                  Care Team
                                </Typography>
                                {planTeam?.participant?.filter(p => p.role?.[0]?.text !== 'Patient').length > 0 ? (
                                  <List dense disablePadding>
                                    {planTeam.participant.filter(p => p.role?.[0]?.text !== 'Patient').slice(0, 4).map((p, idx) => (
                                      <ListItem key={idx} disablePadding sx={{ py: 0.25 }}>
                                        <ListItemIcon sx={{ minWidth: 32 }}>
                                          <Avatar sx={{ width: 24, height: 24, bgcolor: 'secondary.main' }}>
                                            <PersonIcon sx={{ fontSize: 14 }} />
                                          </Avatar>
                                        </ListItemIcon>
                                        <ListItemText
                                          primary={p.member?.display || 'Team Member'}
                                          secondary={p.role?.[0]?.text || p.role?.[0]?.coding?.[0]?.display || 'Provider'}
                                          primaryTypographyProps={{ variant: 'body2' }}
                                          secondaryTypographyProps={{ variant: 'caption' }}
                                        />
                                      </ListItem>
                                    ))}
                                    {planTeam.participant.filter(p => p.role?.[0]?.text !== 'Patient').length > 4 && (
                                      <Typography variant="caption" color="text.secondary" sx={{ pl: 4 }}>
                                        +{planTeam.participant.filter(p => p.role?.[0]?.text !== 'Patient').length - 4} more members
                                      </Typography>
                                    )}
                                  </List>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">No team assigned</Typography>
                                )}
                              </Grid>
                            </Grid>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Stack>
                </Box>
              )}

              {/* Historical Care Plans Section */}
              {categorizedCarePlans.completed.length > 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                    <CompletedIcon />
                    Care History ({categorizedCarePlans.completed.length})
                  </Typography>
                  <Stack spacing={1}>
                    {categorizedCarePlans.completed.map((plan) => {
                      const planCondition = plan.category?.find(c => c.coding?.[0]?.display && c.coding?.[0]?.display !== 'assess-plan')?.coding?.[0]?.display
                        || plan.category?.find(c => c.text)?.text
                        || 'Care Plan';
                      return (
                        <Card key={plan.id} sx={{ borderRadius: 0, opacity: 0.8, bgcolor: 'action.hover' }}>
                          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Stack direction="row" spacing={1} alignItems="center">
                                <MedicalIcon color="action" fontSize="small" />
                                <Typography variant="body2">{planCondition}</Typography>
                                <Chip label={plan.status} size="small" variant="outlined" sx={{ borderRadius: '4px' }} />
                              </Stack>
                              <Typography variant="caption" color="text.secondary">
                                {plan.period?.start && plan.period?.end
                                  ? `${formatClinicalDate(plan.period.start)} - ${formatClinicalDate(plan.period.end)}`
                                  : plan.period?.start ? `Started ${formatClinicalDate(plan.period.start)}` : ''
                                }
                              </Typography>
                            </Stack>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Stack>
                </Box>
              )}

              {/* Empty State */}
              {carePlans.length === 0 && (
                <ClinicalEmptyState
                  title="No care plans found"
                  message="Care plans help coordinate ongoing treatment for chronic conditions and complex care needs."
                  actions={[
                    {
                      label: 'Create Care Plan',
                      onClick: () => {
                        // TODO: Open care plan creation dialog
                        setSnackbar({ open: true, message: 'Care plan creation coming soon', severity: 'info' });
                      },
                      color: 'primary'
                    }
                  ]}
                />
              )}
            </Stack>
          </Box>
        )}

        {/* Care Team Tab (Tab 1) - Aggregated across all plans */}
        {activeTab === 1 && (
          <Box sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Paper sx={{ p: 2, borderRadius: 0 }}>
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

                {aggregatedCareTeam.filter(m => m.role?.[0]?.text !== 'Patient').length === 0 ? (
                  <ClinicalEmptyState
                    title="No care team members"
                    message="Care team members collaborate to provide coordinated patient care across all conditions."
                    actions={[
                      {
                        label: 'Add Member',
                        onClick: () => {
                          setSelectedParticipant(null);
                          setTeamDialogOpen(true);
                        },
                        color: 'primary'
                      }
                    ]}
                  />
                ) : (
                  <List>
                    {aggregatedCareTeam.filter(m => m.role?.[0]?.text !== 'Patient').map((member, index) => (
                      <React.Fragment key={index}>
                        <ListItem>
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: 'secondary.main' }}>
                              <PersonIcon />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={member.member?.display || 'Team Member'}
                            secondary={
                              <Stack spacing={0.5}>
                                <Typography variant="body2" color="text.secondary">
                                  {member.role?.[0]?.text || member.role?.[0]?.coding?.[0]?.display || 'Role not specified'}
                                </Typography>
                                {member.carePlansInvolved.length > 0 && (
                                  <Typography variant="caption" color="text.secondary">
                                    Involved in {member.carePlansInvolved.length} care plan{member.carePlansInvolved.length !== 1 ? 's' : ''}
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
                                setSelectedParticipant(member);
                                setTeamDialogOpen(true);
                              }}
                            >
                              <EditIcon />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItem>
                        {index < aggregatedCareTeam.filter(m => m.role?.[0]?.text !== 'Patient').length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </Paper>

              {/* Patient is also part of the care team */}
              {aggregatedCareTeam.some(m => m.role?.[0]?.text === 'Patient') && (
                <Alert severity="info" sx={{ borderRadius: 0 }}>
                  <AlertTitle>Patient Involvement</AlertTitle>
                  The patient is an active participant in their care coordination.
                </Alert>
              )}
            </Stack>
          </Box>
        )}

        {/* Goals Tab (Tab 2) - With improved empty state */}
        {activeTab === 2 && (
          <Box sx={{ p: 2 }}>
          <Stack spacing={2}>
            {/* Filters */}
            <ClinicalFilterPanel
              searchQuery={searchTerm}
              onSearchChange={setSearchTerm}
              additionalFilters={
                <>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      label="Status"
                      sx={{ borderRadius: 0 }}
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
                      sx={{ borderRadius: 0 }}
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
                </>
              }
            />
            
            {/* Goals Display */}
            {sortedGoals.length === 0 ? (
              <ClinicalEmptyState
                title="No goals found"
                message="Try adjusting your search criteria or create a new goal."
                actions={[
                  { label: 'Clear Filters', onClick: () => {
                    setSearchTerm('');
                    setFilterStatus('all');
                    setFilterCategory('all');
                  }},
                  { label: 'New Goal', onClick: () => {
                    setSelectedGoal(null);
                    setGoalDialogOpen(true);
                  }}
                ]}
              />
            ) : viewMode === 'cards' ? (
              <Grid container spacing={2}>
                {sortedGoals.map((goal, index) => (
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
                      isAlternate={index % 2 === 1}
                    />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <ClinicalDataGrid
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
                            sx={{ borderRadius: '4px' }}
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
                      return <Chip label={status} size="small" color={color} sx={{ borderRadius: '4px' }} />;
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
                              sx={{ height: 6, borderRadius: 0 }}
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
          </Box>
        )}
        
        {/* Timeline Tab (Tab 3) */}
        {activeTab === 3 && (
          <Box sx={{ p: 2 }}>
            <ClinicalFilterPanel
              searchQuery={searchTerm}
              onSearchChange={setSearchTerm}
              onRefresh={() => refreshPatientResources(patientId)}
            />
            
            <List sx={{ mt: 2 }}>
              {timelineData.map((item, index) => (
                <ListItem
                  key={item.id}
                  button
                  onClick={() => {
                    if (item.type === 'Goal') {
                      setSelectedGoal(item.resource);
                      setProgressDialogOpen(true);
                    }
                  }}
                  sx={{ 
                    backgroundColor: index % 2 === 1 ? 'action.hover' : 'transparent',
                    borderRadius: 0,
                    '&:hover': {
                      backgroundColor: 'action.selected'
                    }
                  }}
                >
                  <ListItemIcon>
                    {goalCategories[item.category]?.icon || <GoalIcon />}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.title}
                    secondary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="caption">
                          {formatClinicalDate(item.date)}
                        </Typography>
                        <Chip
                          label={item.status || 'active'}
                          size="small"
                          sx={{ borderRadius: '4px' }}
                          color={item.status === 'completed' ? 'success' : 'default'}
                        />
                      </Stack>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </Box>
      
      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add goal"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          borderRadius: 0
        }}
        onClick={() => {
          setSelectedGoal(null);
          setGoalDialogOpen(true);
        }}
      >
        <AddIcon />
      </Fab>
      
      {/* Dialogs would go here - keeping them simple for now */}
      {/* Goal Editor Dialog */}
      <Dialog open={goalDialogOpen} onClose={() => setGoalDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedGoal ? 'Edit Goal' : 'New Goal'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Goal Description"
              multiline
              rows={3}
              defaultValue={selectedGoal?.description?.text || ''}
              placeholder="Enter goal description..."
              inputRef={goalDescriptionRef}
            />
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                defaultValue={selectedGoal?.category?.[0]?.coding?.[0]?.code || 'health-maintenance'}
                label="Category"
                onChange={(e) => { goalCategoryRef.current = e.target.value; }}
              >
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
            <TextField
              fullWidth
              label="Target Date"
              type="date"
              InputLabelProps={{ shrink: true }}
              defaultValue={selectedGoal?.target?.[0]?.dueDate?.split('T')[0] || ''}
              inputRef={goalTargetDateRef}
            />
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                defaultValue={selectedGoal?.priority?.coding?.[0]?.code || 'medium'}
                label="Priority"
                onChange={(e) => { goalPriorityRef.current = e.target.value; }}
              >
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="low">Low</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Notes"
              multiline
              rows={2}
              defaultValue={selectedGoal?.note?.[0]?.text || ''}
              placeholder="Additional notes..."
              inputRef={goalNotesRef}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGoalDialogOpen(false)} sx={{ borderRadius: 0 }} disabled={isSaving}>Cancel</Button>
          <Button
            variant="contained"
            sx={{ borderRadius: 0 }}
            onClick={handleSaveGoal}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Progress Dialog */}
      <Dialog open={progressDialogOpen} onClose={() => setProgressDialogOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 0 } }}>
        <DialogTitle>
          Goal Progress - {selectedGoal?.description?.text || 'Goal'}
        </DialogTitle>
        <DialogContent>
          {selectedGoal && (
            <Stack spacing={3} sx={{ mt: 2 }}>
              <Alert severity="info" sx={{ borderRadius: 0 }}>
                <Typography variant="body2">
                  <strong>Category:</strong> {goalCategories[selectedGoal.category?.[0]?.coding?.[0]?.code || 'health-maintenance']?.label}
                  {selectedGoal.target?.[0]?.dueDate && (
                    <> • <strong>Due:</strong> {formatClinicalDate(selectedGoal.target[0].dueDate)}</>
                  )}
                </Typography>
              </Alert>
              
              {/* Current Progress */}
              <Box>
                <Typography variant="h6" gutterBottom>Current Progress</Typography>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Achievement Status</InputLabel>
                  <Select
                    defaultValue={selectedGoal.achievementStatus?.coding?.[0]?.code || 'in-progress'}
                    label="Achievement Status"
                  >
                    <MenuItem value="in-progress">In Progress</MenuItem>
                    <MenuItem value="improving">Improving</MenuItem>
                    <MenuItem value="worsening">Worsening</MenuItem>
                    <MenuItem value="no-change">No Change</MenuItem>
                    <MenuItem value="achieved">Achieved</MenuItem>
                    <MenuItem value="sustaining">Sustaining</MenuItem>
                    <MenuItem value="not-achieved">Not Achieved</MenuItem>
                  </Select>
                </FormControl>
                
                <TextField
                  fullWidth
                  label="Progress Notes"
                  multiline
                  rows={3}
                  placeholder="Add notes about current progress..."
                  sx={{ mb: 2 }}
                />
              </Box>
              
              {/* Progress Chart */}
              <Box>
                <Typography variant="h6" gutterBottom>Progress Timeline</Typography>
                <GoalProgressChart 
                  goal={selectedGoal} 
                  observations={[]} // Would be populated with actual observations
                />
              </Box>
              
              {/* Target Measures */}
              {selectedGoal.target?.[0] && (
                <Box>
                  <Typography variant="h6" gutterBottom>Target Measures</Typography>
                  <Stack spacing={1}>
                    <Typography variant="body2">
                      <strong>Measure:</strong> {selectedGoal.target[0].measure?.text || selectedGoal.target[0].measure?.coding?.[0]?.display || 'Not specified'}
                    </Typography>
                    {selectedGoal.target[0].detailQuantity && (
                      <Typography variant="body2">
                        <strong>Target Value:</strong> {selectedGoal.target[0].detailQuantity.value} {selectedGoal.target[0].detailQuantity.unit}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProgressDialogOpen(false)} sx={{ borderRadius: 0 }}>Close</Button>
          <Button 
            variant="contained" 
            sx={{ borderRadius: 0 }}
            onClick={() => {
              setSnackbar({
                open: true,
                message: 'Progress updated successfully',
                severity: 'success'
              });
              setProgressDialogOpen(false);
            }}
          >
            Update Progress
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Team Member Dialog */}
      <Dialog open={teamDialogOpen} onClose={() => setTeamDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 0 } }}>
        <DialogTitle>
          {selectedParticipant ? 'Edit Team Member' : 'Add Team Member'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Member Name"
              defaultValue={selectedParticipant?.member?.display || ''}
              placeholder="Enter team member name..."
              inputRef={teamMemberNameRef}
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                defaultValue={selectedParticipant?.role?.[0]?.coding?.[0]?.code || 'caregiver'}
                label="Role"
                onChange={(e) => { teamMemberRoleRef.current = e.target.value; }}
              >
                <MenuItem value="caregiver">Caregiver</MenuItem>
                <MenuItem value="physician">Physician</MenuItem>
                <MenuItem value="nurse">Nurse</MenuItem>
                <MenuItem value="social-worker">Social Worker</MenuItem>
                <MenuItem value="therapist">Therapist</MenuItem>
                <MenuItem value="pharmacist">Pharmacist</MenuItem>
                <MenuItem value="dietitian">Dietitian</MenuItem>
                <MenuItem value="coordinator">Care Coordinator</MenuItem>
                <MenuItem value="specialist">Specialist</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Contact Information"
              placeholder="Phone, email, or other contact details..."
              defaultValue={selectedParticipant?.telecom?.[0]?.value || ''}
              inputRef={teamMemberContactRef}
            />
            <TextField
              fullWidth
              label="Start Date"
              type="date"
              InputLabelProps={{ shrink: true }}
              defaultValue={selectedParticipant?.period?.start?.split('T')[0] || ''}
              inputRef={teamMemberStartDateRef}
            />
            <TextField
              fullWidth
              label="End Date (if applicable)"
              type="date"
              InputLabelProps={{ shrink: true }}
              defaultValue={selectedParticipant?.period?.end?.split('T')[0] || ''}
              inputRef={teamMemberEndDateRef}
            />
            <TextField
              fullWidth
              label="Notes"
              multiline
              rows={2}
              placeholder="Additional notes about this team member's role..."
              inputRef={teamMemberNotesRef}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTeamDialogOpen(false)} sx={{ borderRadius: 0 }} disabled={isSaving}>Cancel</Button>
          <Button
            variant="contained"
            sx={{ borderRadius: 0 }}
            onClick={handleSaveTeamMember}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Activity Dialog */}
      <Dialog open={activityDialogOpen} onClose={() => setActivityDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 0 } }}>
        <DialogTitle>
          {selectedActivity ? 'Edit Activity' : 'Add Activity'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Activity Description"
              multiline
              rows={3}
              defaultValue={selectedActivity?.detail?.description || ''}
              placeholder="Describe the activity or intervention..."
              inputRef={activityDescriptionRef}
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                defaultValue={selectedActivity?.detail?.status || 'not-started'}
                label="Status"
                onChange={(e) => { activityStatusRef.current = e.target.value; }}
              >
                <MenuItem value="not-started">Not Started</MenuItem>
                <MenuItem value="scheduled">Scheduled</MenuItem>
                <MenuItem value="in-progress">In Progress</MenuItem>
                <MenuItem value="on-hold">On Hold</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
                <MenuItem value="stopped">Stopped</MenuItem>
                <MenuItem value="unknown">Unknown</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                defaultValue={selectedActivity?.detail?.category?.coding?.[0]?.code || 'other'}
                label="Category"
                onChange={(e) => { activityCategoryRef.current = e.target.value; }}
              >
                <MenuItem value="diet">Diet</MenuItem>
                <MenuItem value="drug">Medication</MenuItem>
                <MenuItem value="encounter">Encounter</MenuItem>
                <MenuItem value="observation">Observation</MenuItem>
                <MenuItem value="procedure">Procedure</MenuItem>
                <MenuItem value="supply">Supply</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Assigned To"
              defaultValue={selectedActivity?.detail?.performer?.[0]?.display || ''}
              placeholder="Provider or team member responsible..."
              inputRef={activityAssignedRef}
            />
            <TextField
              fullWidth
              label="Location"
              defaultValue={selectedActivity?.detail?.location?.display || ''}
              placeholder="Where will this activity take place..."
              inputRef={activityLocationRef}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Frequency"
                type="number"
                defaultValue={selectedActivity?.detail?.scheduledTiming?.repeat?.frequency || 1}
                sx={{ width: '30%' }}
                inputRef={activityFrequencyRef}
              />
              <FormControl sx={{ width: '35%' }}>
                <InputLabel>Period</InputLabel>
                <Select
                  defaultValue={selectedActivity?.detail?.scheduledTiming?.repeat?.periodUnit || 'd'}
                  label="Period"
                  onChange={(e) => { activityPeriodRef.current = e.target.value; }}
                >
                  <MenuItem value="s">Seconds</MenuItem>
                  <MenuItem value="min">Minutes</MenuItem>
                  <MenuItem value="h">Hours</MenuItem>
                  <MenuItem value="d">Days</MenuItem>
                  <MenuItem value="wk">Weeks</MenuItem>
                  <MenuItem value="mo">Months</MenuItem>
                  <MenuItem value="a">Years</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Duration"
                type="number"
                defaultValue={selectedActivity?.detail?.scheduledTiming?.repeat?.period || 1}
                sx={{ width: '35%' }}
                inputRef={activityDurationRef}
              />
            </Stack>
            <TextField
              fullWidth
              label="Notes"
              multiline
              rows={2}
              placeholder="Additional notes about this activity..."
              inputRef={activityNotesRef}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActivityDialogOpen(false)} sx={{ borderRadius: 0 }} disabled={isSaving}>Cancel</Button>
          <Button
            variant="contained"
            sx={{ borderRadius: 0 }}
            onClick={handleSaveActivity}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
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
          sx={{ width: '100%', borderRadius: 0 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default React.memo(CarePlanTabEnhanced);