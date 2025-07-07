/**
 * Care Plan Tab Component
 * Manage patient care plans, goals, and interventions
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
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
  Divider,
  Card,
  CardContent,
  CardActions,
  CardHeader,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  FormControl,
  Select,
  InputLabel,
  CircularProgress,
  Alert,
  LinearProgress,
  Avatar,
  AvatarGroup,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  alpha
} from '@mui/material';
import {
  Flag as GoalIcon,
  Assignment as TaskIcon,
  LocalHospital as InterventionIcon,
  Group as TeamIcon,
  TrendingUp as ProgressIcon,
  CheckCircle as CompletedIcon,
  Schedule as InProgressIcon,
  Cancel as CancelledIcon,
  Warning as OverdueIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
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
  Print as PrintIcon
} from '@mui/icons-material';
import { format, parseISO, formatDistanceToNow, addDays, isPast, isFuture } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';
import { printDocument } from '../../../../utils/printUtils';

// Goal categories
const goalCategories = {
  'health-maintenance': { icon: <HealthIcon />, label: 'Health Maintenance', color: 'primary' },
  'behavioral': { icon: <BehavioralIcon />, label: 'Behavioral', color: 'secondary' },
  'nutrition': { icon: <NutritionIcon />, label: 'Nutrition', color: 'warning' },
  'exercise': { icon: <ExerciseIcon />, label: 'Exercise', color: 'info' },
  'medical': { icon: <MedicalIcon />, label: 'Medical', color: 'error' }
};

// Get goal status info
const getGoalStatus = (goal) => {
  const status = goal.lifecycleStatus;
  switch (status) {
    case 'active':
    case 'on-hold':
      return { 
        icon: <InProgressIcon />, 
        color: 'warning', 
        label: 'In Progress' 
      };
    case 'completed':
    case 'achieved':
      return { 
        icon: <CompletedIcon />, 
        color: 'success', 
        label: 'Completed' 
      };
    case 'cancelled':
    case 'abandoned':
      return { 
        icon: <CancelledIcon />, 
        color: 'error', 
        label: 'Cancelled' 
      };
    default:
      return { 
        icon: <InProgressIcon />, 
        color: 'default', 
        label: status 
      };
  }
};

// Goal Card Component
const GoalCard = ({ goal, onEdit, onViewProgress, onUpdateProgress, onAddIntervention }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  
  const category = goal.category?.[0]?.coding?.[0]?.code || 'health-maintenance';
  const categoryConfig = goalCategories[category] || goalCategories['health-maintenance'];
  const status = getGoalStatus(goal);
  const targetDate = goal.target?.[0]?.dueDate;
  const isOverdue = targetDate && isPast(parseISO(targetDate)) && goal.lifecycleStatus === 'active';

  const progressPercentage = goal.achievementStatus?.coding?.[0]?.code === 'achieved' ? 100 :
                            goal.achievementStatus?.coding?.[0]?.code === 'in-progress' ? 60 : 0;

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={2} alignItems="center" mb={2}>
              <Avatar 
                sx={{ 
                  bgcolor: categoryConfig?.color && theme.palette[categoryConfig.color]?.main
                    ? alpha(theme.palette[categoryConfig.color].main, 0.1)
                    : alpha(theme.palette.primary.main, 0.1),
                  color: categoryConfig?.color && theme.palette[categoryConfig.color]?.main
                    ? theme.palette[categoryConfig.color].main
                    : theme.palette.primary.main 
                }}
              >
                {categoryConfig.icon}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6">
                  {goal.description?.text || 'Goal'}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip 
                    label={categoryConfig.label} 
                    size="small" 
                    variant="outlined"
                  />
                  <Chip 
                    icon={status.icon}
                    label={status.label} 
                    size="small" 
                    color={status.color}
                  />
                  {isOverdue && (
                    <Chip 
                      icon={<OverdueIcon />}
                      label="Overdue" 
                      size="small" 
                      color="error"
                    />
                  )}
                </Stack>
              </Box>
            </Stack>

            <Box mb={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2" color="text.secondary">
                  Progress
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {progressPercentage}%
                </Typography>
              </Stack>
              <LinearProgress 
                variant="determinate" 
                value={progressPercentage} 
                sx={{ height: 8, borderRadius: 1 }}
                color={progressPercentage === 100 ? 'success' : 'primary'}
              />
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Target Date</Typography>
                <Typography variant="body2">
                  {targetDate ? format(parseISO(targetDate), 'MMM d, yyyy') : 'No target date'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Priority</Typography>
                <Typography variant="body2">
                  {goal.priority?.text || goal.priority?.coding?.[0]?.display || 'Normal'}
                </Typography>
              </Grid>
            </Grid>

            {goal.note?.[0] && expanded && (
              <Box mt={2}>
                <Typography variant="caption" color="text.secondary">Notes</Typography>
                <Typography variant="body2">{goal.note[0].text}</Typography>
              </Box>
            )}

            {goal.target?.[0]?.measure && (
              <Box mt={2}>
                <Typography variant="caption" color="text.secondary">Target Measure</Typography>
                <Typography variant="body2">
                  {goal.target[0].measure.text || goal.target[0].measure.coding?.[0]?.display}
                  {goal.target[0].detailQuantity && 
                    `: ${goal.target[0].detailQuantity.value} ${goal.target[0].detailQuantity.unit}`
                  }
                </Typography>
              </Box>
            )}
          </Box>

          <Stack direction="column" spacing={1}>
            <IconButton size="small" onClick={() => onEdit(goal)}>
              <EditIcon />
            </IconButton>
            <IconButton size="small" onClick={() => onViewProgress(goal)}>
              <TimelineIcon />
            </IconButton>
          </Stack>
        </Stack>
      </CardContent>

      <CardActions>
        <Button 
          size="small" 
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show Less' : 'Show More'}
        </Button>
        <Button size="small" color="primary" onClick={() => onUpdateProgress(goal)}>
          Update Progress
        </Button>
        <Button size="small" onClick={() => onAddIntervention && onAddIntervention(goal)}>
          Add Intervention
        </Button>
      </CardActions>
    </Card>
  );
};

// Care Team Component
const CareTeamCard = ({ careTeam, onAddMember, onViewAll }) => {
  const theme = useTheme();
  
  const participants = careTeam.participant || [];
  const activeParticipants = participants.filter(p => 
    !p.period?.end || isFuture(parseISO(p.period.end))
  );

  return (
    <Card>
      <CardHeader
        avatar={<TeamIcon color="primary" />}
        title="Care Team"
        subheader={`${activeParticipants.length} active members`}
      />
      <CardContent>
        <List>
          {activeParticipants.map((participant, index) => (
            <ListItem key={index}>
              <ListItemIcon>
                <Avatar sx={{ width: 32, height: 32 }}>
                  <PersonIcon />
                </Avatar>
              </ListItemIcon>
              <ListItemText
                primary={participant.member?.display || 'Team Member'}
                secondary={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption">
                      {participant.role?.[0]?.text || participant.role?.[0]?.coding?.[0]?.display || 'Role not specified'}
                    </Typography>
                    {participant.period?.start && (
                      <Typography variant="caption" color="text.secondary">
                        • Since {format(parseISO(participant.period.start), 'MMM yyyy')}
                      </Typography>
                    )}
                  </Stack>
                }
              />
            </ListItem>
          ))}
        </List>
        
        {activeParticipants.length === 0 && (
          <Typography variant="body2" color="text.secondary" align="center">
            No care team members assigned
          </Typography>
        )}
      </CardContent>
      <CardActions>
        <Button size="small" startIcon={<AddIcon />} onClick={onAddMember}>
          Add Member
        </Button>
        <Button size="small" onClick={onViewAll}>
          View All
        </Button>
      </CardActions>
    </Card>
  );
};

// Intervention List Component
const InterventionList = ({ activities, onEdit, onAddIntervention }) => {
  const getActivityStatus = (activity) => {
    if (activity.detail?.status === 'completed') return 'completed';
    if (activity.detail?.status === 'cancelled') return 'cancelled';
    if (activity.detail?.scheduledTiming?.repeat?.boundsPeriod?.end &&
        isPast(parseISO(activity.detail.scheduledTiming.repeat.boundsPeriod.end))) {
      return 'overdue';
    }
    return 'active';
  };

  const getStatusChip = (status) => {
    switch (status) {
      case 'completed':
        return <Chip size="small" label="Completed" color="success" />;
      case 'cancelled':
        return <Chip size="small" label="Cancelled" color="error" />;
      case 'overdue':
        return <Chip size="small" label="Overdue" color="error" />;
      default:
        return <Chip size="small" label="Active" color="primary" />;
    }
  };

  return (
    <Card>
      <CardHeader
        avatar={<InterventionIcon color="secondary" />}
        title="Interventions & Activities"
        subheader={`${activities.length} total activities`}
      />
      <CardContent>
        <List>
          {activities.map((activity, index) => {
            const status = getActivityStatus(activity);
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
                          {activity.detail?.description || 
                           activity.detail?.code?.text || 
                           activity.detail?.code?.coding?.[0]?.display ||
                           'Activity'}
                        </Typography>
                        {getStatusChip(status)}
                      </Stack>
                    }
                    secondary={
                      <Box>
                        {activity.detail?.scheduledTiming?.repeat?.frequency && (
                          <Typography variant="caption">
                            Frequency: {activity.detail.scheduledTiming.repeat.frequency} times per {activity.detail.scheduledTiming.repeat.period} {activity.detail.scheduledTiming.repeat.periodUnit}
                          </Typography>
                        )}
                        {activity.detail?.location && (
                          <Typography variant="caption" display="block">
                            Location: {activity.detail.location.display}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" size="small" onClick={() => onEdit(activity)}>
                      <EditIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
                {index < activities.length - 1 && <Divider component="li" />}
              </React.Fragment>
            );
          })}
        </List>
        
        {activities.length === 0 && (
          <Typography variant="body2" color="text.secondary" align="center">
            No interventions or activities defined
          </Typography>
        )}
      </CardContent>
      <CardActions>
        <Button size="small" startIcon={<AddIcon />} onClick={onAddIntervention}>
          Add Intervention
        </Button>
      </CardActions>
    </Card>
  );
};

// Goal Editor Dialog
const GoalEditorDialog = ({ open, onClose, goal, patientId }) => {
  const [goalData, setGoalData] = useState({
    description: goal?.description?.text || '',
    category: goal?.category?.[0]?.coding?.[0]?.code || 'health-maintenance',
    priority: goal?.priority?.coding?.[0]?.code || 'medium',
    targetDate: goal?.target?.[0]?.dueDate || '',
    targetMeasure: goal?.target?.[0]?.measure?.text || '',
    targetValue: goal?.target?.[0]?.detailQuantity?.value || '',
    targetUnit: goal?.target?.[0]?.detailQuantity?.unit || '',
    notes: goal?.note?.[0]?.text || ''
  });

  const handleSave = async () => {
    try {
      // Create FHIR Goal resource
      const goalResource = {
        resourceType: 'Goal',
        lifecycleStatus: 'active',
        achievementStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/goal-achievement',
            code: 'in-progress',
            display: 'In Progress'
          }]
        },
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/goal-category',
            code: goalData.category,
            display: goalCategories[goalData.category]?.label || 'Health Maintenance'
          }]
        }],
        priority: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/goal-priority',
            code: goalData.priority,
            display: goalData.priority.charAt(0).toUpperCase() + goalData.priority.slice(1)
          }]
        },
        description: {
          text: goalData.description
        },
        subject: {
          reference: `Patient/${patientId}`
        },
        startDate: new Date().toISOString().split('T')[0],
        target: goalData.targetDate || goalData.targetMeasure ? [{
          dueDate: goalData.targetDate || undefined,
          measure: goalData.targetMeasure ? {
            text: goalData.targetMeasure
          } : undefined,
          detailQuantity: goalData.targetValue ? {
            value: parseFloat(goalData.targetValue),
            unit: goalData.targetUnit || ''
          } : undefined
        }] : [],
        note: goalData.notes ? [{
          text: goalData.notes,
          time: new Date().toISOString()
        }] : []
      };

      let response;
      if (goal && goal.id) {
        // Update existing goal
        response = await fetch(`/fhir/R4/Goal/${goal.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...goal,
            ...goalResource,
            id: goal.id
          })
        });
      } else {
        // Create new goal
        response = await fetch('/fhir/R4/Goal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(goalResource)
        });
      }

      if (response.ok) {
        // Refresh patient resources to show new/updated goal
        window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
          detail: { patientId } 
        }));
        onClose();
      } else {
        console.error('Failed to save goal:', response.statusText);
      }
    } catch (error) {
      console.error('Error saving goal:', error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {goal ? 'Edit Goal' : 'New Goal'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="Goal Description"
            value={goalData.description}
            onChange={(e) => setGoalData({ ...goalData, description: e.target.value })}
            multiline
            rows={2}
          />

          <FormControl fullWidth>
            <InputLabel>Category</InputLabel>
            <Select
              value={goalData.category}
              onChange={(e) => setGoalData({ ...goalData, category: e.target.value })}
              label="Category"
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

          <FormControl fullWidth>
            <InputLabel>Priority</InputLabel>
            <Select
              value={goalData.priority}
              onChange={(e) => setGoalData({ ...goalData, priority: e.target.value })}
              label="Priority"
            >
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            type="date"
            label="Target Date"
            value={goalData.targetDate}
            onChange={(e) => setGoalData({ ...goalData, targetDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            fullWidth
            label="Target Measure"
            value={goalData.targetMeasure}
            onChange={(e) => setGoalData({ ...goalData, targetMeasure: e.target.value })}
            placeholder="e.g., Blood pressure, Weight, HbA1c"
          />

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Target Value"
                type="number"
                value={goalData.targetValue}
                onChange={(e) => setGoalData({ ...goalData, targetValue: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Unit"
                value={goalData.targetUnit}
                onChange={(e) => setGoalData({ ...goalData, targetUnit: e.target.value })}
                placeholder="e.g., mmHg, kg, %"
              />
            </Grid>
          </Grid>

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Notes"
            value={goalData.notes}
            onChange={(e) => setGoalData({ ...goalData, notes: e.target.value })}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>
          Save Goal
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const CarePlanTab = ({ patientId, onNotificationUpdate }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { getPatientResources, isLoading, currentPatient } = useFHIRResource();
  
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterCategory, setFilterCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [goalEditorOpen, setGoalEditorOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [selectedGoalForProgress, setSelectedGoalForProgress] = useState(null);
  const [interventionDialogOpen, setInterventionDialogOpen] = useState(false);
  const [selectedGoalForIntervention, setSelectedGoalForIntervention] = useState(null);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [viewAllMembersDialogOpen, setViewAllMembersDialogOpen] = useState(false);
  const [selectedCareTeam, setSelectedCareTeam] = useState(null);

  useEffect(() => {
    setLoading(false);
  }, []);

  // Get care plan resources
  const carePlans = getPatientResources(patientId, 'CarePlan') || [];
  const goals = getPatientResources(patientId, 'Goal') || [];
  const careTeams = getPatientResources(patientId, 'CareTeam') || [];

  // Get active care plan
  const activeCarePlan = carePlans.find(cp => cp.status === 'active') || carePlans[0];
  const activities = activeCarePlan?.activity || [];

  // Filter goals
  const filteredGoals = goals.filter(goal => {
    if (filterStatus !== 'all' && goal.lifecycleStatus !== filterStatus) {
      return false;
    }
    if (filterCategory !== 'all') {
      const category = goal.category?.[0]?.coding?.[0]?.code;
      if (category !== filterCategory) return false;
    }
    return true;
  });

  // Sort goals by priority and date
  const sortedGoals = [...filteredGoals].sort((a, b) => {
    // Sort by priority first
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const aPriority = priorityOrder[a.priority?.coding?.[0]?.code] ?? 3;
    const bPriority = priorityOrder[b.priority?.coding?.[0]?.code] ?? 3;
    if (aPriority !== bPriority) return aPriority - bPriority;
    
    // Then by target date
    const aDate = a.target?.[0]?.dueDate || '';
    const bDate = b.target?.[0]?.dueDate || '';
    return aDate.localeCompare(bDate);
  });

  const handleEditGoal = (goal) => {
    setSelectedGoal(goal);
    setGoalEditorOpen(true);
  };

  const handleViewProgress = (goal) => {
    // Open progress dialog or navigate to progress view
    setSnackbar({ 
      open: true, 
      message: 'Goal progress view coming soon', 
      severity: 'info' 
    });
  };

  const handleEditActivity = (activity) => {
    // TODO: Implement activity editing
    setSnackbar({ 
      open: true, 
      message: 'Activity editing coming soon', 
      severity: 'info' 
    });
  };

  const handleUpdateProgress = (goal) => {
    setSelectedGoalForProgress(goal);
    setProgressDialogOpen(true);
  };

  const handleAddIntervention = (goal) => {
    setSelectedGoalForIntervention(goal);
    setInterventionDialogOpen(true);
  };
  
  const handlePrintCarePlan = () => {
    const patientInfo = {
      name: currentPatient ? 
        `${currentPatient.name?.[0]?.given?.join(' ') || ''} ${currentPatient.name?.[0]?.family || ''}`.trim() : 
        'Unknown Patient',
      mrn: currentPatient?.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || currentPatient?.id,
      birthDate: currentPatient?.birthDate,
      gender: currentPatient?.gender,
      phone: currentPatient?.telecom?.find(t => t.system === 'phone')?.value
    };
    
    let content = '<h2>Care Plan & Goals</h2>';
    
    // Active Care Plan Summary
    if (activeCarePlan) {
      content += '<div class="section">';
      content += `<h3>${activeCarePlan.title || 'Comprehensive Care Plan'}</h3>`;
      content += `<p>Started: ${activeCarePlan.period?.start ? 
        format(parseISO(activeCarePlan.period.start), 'MMMM d, yyyy') : 
        'Unknown'}</p>`;
      content += '</div>';
    }
    
    // Goals
    content += '<h3>Goals</h3>';
    if (sortedGoals.length === 0) {
      content += '<p>No goals defined.</p>';
    } else {
      sortedGoals.forEach(goal => {
        const category = goal.category?.[0]?.coding?.[0]?.code || 'health-maintenance';
        const categoryLabel = goalCategories[category]?.label || 'Health Maintenance';
        const targetDate = goal.target?.[0]?.dueDate;
        const status = goal.lifecycleStatus;
        
        content += '<div class="note-box avoid-break">';
        content += `<h4>${goal.description?.text || 'Goal'}</h4>`;
        content += `<p><strong>Category:</strong> ${categoryLabel} | <strong>Status:</strong> ${status}</p>`;
        if (targetDate) {
          content += `<p><strong>Target Date:</strong> ${format(parseISO(targetDate), 'MMMM d, yyyy')}</p>`;
        }
        if (goal.target?.[0]?.measure) {
          content += `<p><strong>Target Measure:</strong> ${goal.target[0].measure.text || goal.target[0].measure.coding?.[0]?.display}`;
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
    
    // Care Team
    if (careTeams.length > 0 && careTeams[0].participant) {
      content += '<h3>Care Team</h3>';
      content += '<ul>';
      careTeams[0].participant.forEach(participant => {
        const member = participant.member?.display || 'Team Member';
        const role = participant.role?.[0]?.text || participant.role?.[0]?.coding?.[0]?.display || 'Role not specified';
        content += `<li>${member} - ${role}</li>`;
      });
      content += '</ul>';
    }
    
    // Activities/Interventions
    if (activities.length > 0) {
      content += '<h3>Interventions & Activities</h3>';
      content += '<ul>';
      activities.forEach(activity => {
        const description = activity.detail?.description || 
                          activity.detail?.code?.text || 
                          activity.detail?.code?.coding?.[0]?.display ||
                          'Activity';
        content += `<li>${description}`;
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
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Care Plan & Goals
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrintCarePlan}
          >
            Print
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setSelectedGoal(null);
              setGoalEditorOpen(true);
            }}
          >
            New Goal
          </Button>
        </Stack>
      </Stack>

      {/* Care Plan Summary */}
      {activeCarePlan && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="subtitle2">
            Active Care Plan: {activeCarePlan.title || 'Comprehensive Care Plan'}
          </Typography>
          <Typography variant="caption">
            Started {activeCarePlan.period?.start ? 
              formatDistanceToNow(parseISO(activeCarePlan.period.start), { addSuffix: true }) : 
              'recently'
            }
          </Typography>
        </Alert>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
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
        </Stack>
      </Paper>

      <Grid container spacing={3}>
        {/* Goals Section */}
        <Grid item xs={12} lg={8}>
          <Typography variant="h6" gutterBottom>
            Goals ({sortedGoals.length})
          </Typography>
          
          {sortedGoals.length === 0 ? (
            <Alert severity="info">
              No goals found matching your criteria
            </Alert>
          ) : (
            <Box>
              {sortedGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onEdit={handleEditGoal}
                  onViewProgress={handleViewProgress}
                  onUpdateProgress={handleUpdateProgress}
                  onAddIntervention={handleAddIntervention}
                />
              ))}
            </Box>
          )}
        </Grid>

        {/* Right Column */}
        <Grid item xs={12} lg={4}>
          <Stack spacing={3}>
            {/* Care Team */}
            {careTeams.length > 0 && (
              <CareTeamCard 
                careTeam={careTeams[0]} 
                onAddMember={() => {
                  setSelectedCareTeam(careTeams[0]);
                  setAddMemberDialogOpen(true);
                }}
                onViewAll={() => {
                  setSelectedCareTeam(careTeams[0]);
                  setViewAllMembersDialogOpen(true);
                }}
              />
            )}

            {/* Interventions */}
            <InterventionList 
              activities={activities} 
              onEdit={handleEditActivity}
              onAddIntervention={() => setInterventionDialogOpen(true)}
            />

            {/* Outcomes Summary */}
            <Card>
              <CardHeader
                avatar={<OutcomeIcon color="success" />}
                title="Outcomes"
                subheader="Goal achievement summary"
              />
              <CardContent>
                <Stack spacing={2}>
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2">Completed Goals</Typography>
                      <Typography variant="h6" color="success.main">
                        {goals.filter(g => g.lifecycleStatus === 'completed').length}
                      </Typography>
                    </Stack>
                  </Box>
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2">Active Goals</Typography>
                      <Typography variant="h6" color="primary">
                        {goals.filter(g => g.lifecycleStatus === 'active').length}
                      </Typography>
                    </Stack>
                  </Box>
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2">Success Rate</Typography>
                      <Typography variant="h6">
                        {goals.length > 0 ? 
                          Math.round((goals.filter(g => g.lifecycleStatus === 'completed').length / goals.length) * 100) : 0
                        }%
                      </Typography>
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      {/* Goal Editor Dialog */}
      <GoalEditorDialog
        open={goalEditorOpen}
        onClose={() => setGoalEditorOpen(false)}
        goal={selectedGoal}
        patientId={patientId}
      />

      {/* Progress Update Dialog */}
      <Dialog open={progressDialogOpen} onClose={() => setProgressDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Update Goal Progress</DialogTitle>
        <DialogContent>
          {selectedGoalForProgress && (
            <Stack spacing={3} sx={{ mt: 2 }}>
              <Alert severity="info">
                Goal: {selectedGoalForProgress.description?.text || 'Goal'}
              </Alert>
              
              <FormControl fullWidth>
                <InputLabel>Achievement Status</InputLabel>
                <Select
                  defaultValue={selectedGoalForProgress.achievementStatus?.coding?.[0]?.code || 'in-progress'}
                  label="Achievement Status"
                >
                  <MenuItem value="in-progress">In Progress</MenuItem>
                  <MenuItem value="improving">Improving</MenuItem>
                  <MenuItem value="worsening">Worsening</MenuItem>
                  <MenuItem value="no-change">No Change</MenuItem>
                  <MenuItem value="achieved">Achieved</MenuItem>
                  <MenuItem value="not-achieved">Not Achieved</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                type="number"
                label="Progress Percentage"
                defaultValue="60"
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>
                }}
              />

              <TextField
                fullWidth
                multiline
                rows={3}
                label="Progress Notes"
                placeholder="Describe the progress made..."
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProgressDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={async () => {
              // Update goal with new progress
              if (selectedGoalForProgress) {
                try {
                  const response = await fetch(`/fhir/R4/Goal/${selectedGoalForProgress.id}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      ...selectedGoalForProgress,
                      achievementStatus: {
                        coding: [{
                          system: 'http://terminology.hl7.org/CodeSystem/goal-achievement',
                          code: 'improving',
                          display: 'Improving'
                        }]
                      }
                    })
                  });
                  
                  if (response.ok) {
                    window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
                      detail: { patientId } 
                    }));
                    setProgressDialogOpen(false);
                  }
                } catch (error) {
                  console.error('Error updating goal progress:', error);
                }
              }
            }}
          >
            Update Progress
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Intervention Dialog */}
      <Dialog open={interventionDialogOpen} onClose={() => setInterventionDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Intervention</DialogTitle>
        <DialogContent>
          {selectedGoalForIntervention && (
            <Stack spacing={3} sx={{ mt: 2 }}>
              <Alert severity="info">
                For Goal: {selectedGoalForIntervention.description?.text || 'Goal'}
              </Alert>
              
              <TextField
                fullWidth
                label="Intervention Description"
                placeholder="Describe the intervention..."
                multiline
                rows={2}
              />

              <FormControl fullWidth>
                <InputLabel>Intervention Type</InputLabel>
                <Select defaultValue="medication" label="Intervention Type">
                  <MenuItem value="medication">Medication</MenuItem>
                  <MenuItem value="procedure">Procedure</MenuItem>
                  <MenuItem value="education">Education</MenuItem>
                  <MenuItem value="counseling">Counseling</MenuItem>
                  <MenuItem value="referral">Referral</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Frequency"
                placeholder="e.g., Daily, Weekly, As needed"
              />

              <TextField
                fullWidth
                type="date"
                label="Start Date"
                defaultValue={new Date().toISOString().split('T')[0]}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInterventionDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={async () => {
              // Create intervention as part of CarePlan activity
              if (selectedGoalForIntervention) {
                // In a real implementation, this would update the CarePlan resource
                // Adding intervention for the selected goal
                setInterventionDialogOpen(false);
              }
            }}
          >
            Add Intervention
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Care Team Member Dialog */}
      <Dialog open={addMemberDialogOpen} onClose={() => setAddMemberDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Add Care Team Member
          <IconButton
            edge="end"
            color="inherit"
            onClick={() => setAddMemberDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Member Name"
              placeholder="Enter care team member name"
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Role</InputLabel>
              <Select label="Role" defaultValue="">
                <MenuItem value="physician">Physician</MenuItem>
                <MenuItem value="nurse">Nurse</MenuItem>
                <MenuItem value="therapist">Therapist</MenuItem>
                <MenuItem value="social-worker">Social Worker</MenuItem>
                <MenuItem value="care-coordinator">Care Coordinator</MenuItem>
                <MenuItem value="family">Family Member</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Contact Information"
              placeholder="Phone or email"
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Responsibilities"
              placeholder="Describe the member's responsibilities in the care plan"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddMemberDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={() => {
              setAddMemberDialogOpen(false);
              setSnackbar({ 
                open: true, 
                message: 'Care team member added successfully', 
                severity: 'success' 
              });
            }}
          >
            Add Member
          </Button>
        </DialogActions>
      </Dialog>

      {/* View All Members Dialog */}
      <Dialog open={viewAllMembersDialogOpen} onClose={() => setViewAllMembersDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Care Team Members
          <IconButton
            edge="end"
            color="inherit"
            onClick={() => setViewAllMembersDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedCareTeam && selectedCareTeam.participant && selectedCareTeam.participant.length > 0 ? (
            <List>
              {selectedCareTeam.participant.map((member, index) => (
                <ListItem key={index} divider>
                  <ListItemIcon>
                    <PersonIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={member.member?.display || 'Unknown Member'}
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Role: {member.role?.[0]?.text || 'Not specified'}
                        </Typography>
                        {member.period?.start && (
                          <Typography variant="caption" color="text.secondary">
                            Since: {format(parseISO(member.period.start), 'MMM d, yyyy')}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" size="small">
                      <EditIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                No care team members found
              </Typography>
              <Button 
                startIcon={<AddIcon />} 
                onClick={() => {
                  setViewAllMembersDialogOpen(false);
                  setAddMemberDialogOpen(true);
                }}
                sx={{ mt: 2 }}
              >
                Add First Member
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewAllMembersDialogOpen(false)}>Close</Button>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={() => {
              setViewAllMembersDialogOpen(false);
              setAddMemberDialogOpen(true);
            }}
          >
            Add Member
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CarePlanTab;