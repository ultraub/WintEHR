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
  MedicalServices as MedicalIcon
} from '@mui/icons-material';
import { format, parseISO, formatDistanceToNow, addDays, isPast, isFuture } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';

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
const GoalCard = ({ goal, onEdit, onViewProgress }) => {
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
                  bgcolor: alpha(theme.palette[categoryConfig.color].main, 0.1),
                  color: theme.palette[categoryConfig.color].main 
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
        <Button size="small" color="primary">
          Update Progress
        </Button>
        <Button size="small">
          Add Intervention
        </Button>
      </CardActions>
    </Card>
  );
};

// Care Team Component
const CareTeamCard = ({ careTeam }) => {
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
        <Button size="small" startIcon={<AddIcon />}>
          Add Member
        </Button>
        <Button size="small">
          View All
        </Button>
      </CardActions>
    </Card>
  );
};

// Intervention List Component
const InterventionList = ({ activities, onEdit }) => {
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
        <Button size="small" startIcon={<AddIcon />}>
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

  const handleSave = () => {
    // TODO: Implement save functionality
    console.log('Saving goal:', goalData);
    onClose();
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
  const { getPatientResources, isLoading } = useFHIRResource();
  
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterCategory, setFilterCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [goalEditorOpen, setGoalEditorOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);

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
    navigate(`/patients/${patientId}/goals/${goal.id}/progress`);
  };

  const handleEditActivity = (activity) => {
    // TODO: Implement activity editing
    console.log('Edit activity:', activity);
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
              <CareTeamCard careTeam={careTeams[0]} />
            )}

            {/* Interventions */}
            <InterventionList 
              activities={activities} 
              onEdit={handleEditActivity}
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
    </Box>
  );
};

export default CarePlanTab;