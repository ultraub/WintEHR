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
  alpha,
  Snackbar
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
  Print as PrintIcon,
  Close as CloseIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { format, parseISO, formatDistanceToNow, addDays, isPast, isFuture } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';
import { printDocument } from '../../../../core/export/printUtils';
import { fhirClient } from '../../../../services/fhirClient';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';

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
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Typography variant="caption" component="span">
                      {participant.role?.[0]?.text || participant.role?.[0]?.coding?.[0]?.display || 'Role not specified'}
                    </Typography>
                    {participant.period?.start && (
                      <Typography variant="caption" color="text.secondary" component="span">
                        • Since {format(parseISO(participant.period.start), 'MMM yyyy')}
                      </Typography>
                    )}
                  </span>
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
                      <span>
                        {activity.detail?.scheduledTiming?.repeat?.frequency && (
                          <span style={{ fontSize: '0.75rem' }}>
                            Frequency: {activity.detail.scheduledTiming.repeat.frequency} times per {activity.detail.scheduledTiming.repeat.period} {activity.detail.scheduledTiming.repeat.periodUnit}
                          </span>
                        )}
                        {activity.detail?.location && (
                          <span style={{ fontSize: '0.75rem', display: 'block' }}>
                            Location: {activity.detail.location.display}
                          </span>
                        )}
                      </span>
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

// Add Care Team Member Dialog
const AddCareTeamMemberDialog = ({ open, onClose, careTeam, patientId, onSuccess }) => {
  const [memberData, setMemberData] = useState({
    name: '',
    role: '',
    contact: '',
    responsibilities: ''
  });

  const handleSave = async () => {
    try {
      if (!memberData.name || !memberData.role) {
        alert('Please provide member name and role');
        return;
      }

      // Create or update CareTeam resource
      let careTeamResource;
      
      if (careTeam && careTeam.id) {
        // Update existing CareTeam
        careTeamResource = { ...careTeam };
        if (!careTeamResource.participant) {
          careTeamResource.participant = [];
        }
        
        // Add new participant
        careTeamResource.participant.push({
          role: [{
            coding: [{
              system: 'http://snomed.info/sct',
              code: memberData.role,
              display: memberData.role.charAt(0).toUpperCase() + memberData.role.slice(1).replace('-', ' ')
            }],
            text: memberData.role.charAt(0).toUpperCase() + memberData.role.slice(1).replace('-', ' ')
          }],
          member: {
            display: memberData.name
          },
          period: {
            start: new Date().toISOString()
          }
        });
        
        await fhirClient.update('CareTeam', careTeam.id, careTeamResource);
      } else {
        // Create new CareTeam
        careTeamResource = {
          resourceType: 'CareTeam',
          status: 'active',
          subject: {
            reference: `Patient/${patientId}`
          },
          period: {
            start: new Date().toISOString()
          },
          participant: [{
            role: [{
              coding: [{
                system: 'http://snomed.info/sct',
                code: memberData.role,
                display: memberData.role.charAt(0).toUpperCase() + memberData.role.slice(1).replace('-', ' ')
              }],
              text: memberData.role.charAt(0).toUpperCase() + memberData.role.slice(1).replace('-', ' ')
            }],
            member: {
              display: memberData.name
            },
            period: {
              start: new Date().toISOString()
            }
          }],
          name: 'Patient Care Team'
        };
        
        // Store contact and responsibilities as extensions if provided
        if (memberData.contact || memberData.responsibilities) {
          careTeamResource.extension = [];
          if (memberData.contact) {
            careTeamResource.extension.push({
              url: 'http://example.org/fhir/StructureDefinition/member-contact',
              valueString: memberData.contact
            });
          }
          if (memberData.responsibilities) {
            careTeamResource.extension.push({
              url: 'http://example.org/fhir/StructureDefinition/member-responsibilities',
              valueString: memberData.responsibilities
            });
          }
        }
        
        await fhirClient.create('CareTeam', careTeamResource);
      }
      
      // Reset form and close
      setMemberData({ name: '', role: '', contact: '', responsibilities: '' });
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      // Failed to add care team member
      alert('Failed to add care team member: ' + error.message);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Add Care Team Member
        <IconButton
          edge="end"
          color="inherit"
          onClick={onClose}
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
            value={memberData.name}
            onChange={(e) => setMemberData({ ...memberData, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Role</InputLabel>
            <Select 
              label="Role" 
              value={memberData.role}
              onChange={(e) => setMemberData({ ...memberData, role: e.target.value })}
            >
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
            value={memberData.contact}
            onChange={(e) => setMemberData({ ...memberData, contact: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Responsibilities"
            placeholder="Describe the member's responsibilities in the care plan"
            value={memberData.responsibilities}
            onChange={(e) => setMemberData({ ...memberData, responsibilities: e.target.value })}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={handleSave}
          disabled={!memberData.name || !memberData.role}
        >
          Add Member
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Helper function to fetch observations related to a goal
const fetchGoalRelatedObservations = async (goal) => {
  try {
    if (!goal || !goal.id) return [];
    
    // Goals can be linked to observations in several ways:
    // 1. Observation.goal references the Goal
    // 2. Goal.addresses references a Condition, and Observations reference the same Condition
    // 3. Goal.target.measure specifies what type of observation to look for
    
    const observations = [];
    
    // Try to get the measure code from the goal target
    const measureCode = goal.target?.[0]?.measure?.coding?.[0]?.code;
    const measureSystem = goal.target?.[0]?.measure?.coding?.[0]?.system;
    
    if (measureCode) {
      // Search for observations with matching code
      const searchParams = {
        patient: goal.subject?.reference?.split('/')[1],
        code: measureCode,
        _sort: '-date',
        _count: 100
      };
      
      const response = await fhirClient.searchResources('Observation', searchParams);
      if (response.entry) {
        observations.push(...response.entry.map(e => e.resource));
      }
    }
    
    // Also try to find observations that directly reference this goal
    try {
      const goalRefSearchParams = {
        patient: goal.subject?.reference?.split('/')[1],
        goal: `Goal/${goal.id}`,
        _sort: '-date',
        _count: 100
      };
      
      const goalRefResponse = await fhirClient.searchResources('Observation', goalRefSearchParams);
      if (goalRefResponse.entry) {
        // Add observations that aren't already in the list
        const existingIds = new Set(observations.map(o => o.id));
        goalRefResponse.entry.forEach(entry => {
          if (!existingIds.has(entry.resource.id)) {
            observations.push(entry.resource);
          }
        });
      }
    } catch (err) {
      // Goal reference search might not be supported by all servers
      // This is expected behavior for some FHIR servers
    }
    
    return observations;
  } catch (error) {
    // Error fetching goal-related observations
    return [];
  }
};

// Goal Progress Dialog
const GoalProgressDialog = ({ open, onClose, goal, patientId }) => {
  const [progressData, setProgressData] = useState([]);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();

  useEffect(() => {
    if (open && goal) {
      loadProgressData();
    }
  }, [open, goal]);

  const loadProgressData = async () => {
    setLoading(true);
    try {
      // Fetch actual observations related to this goal
      const observations = await fetchGoalRelatedObservations(goal);
      
      if (observations && observations.length > 0) {
        // Transform observations into progress data
        const progressDataPoints = observations
          .filter(obs => obs.valueQuantity?.value !== undefined)
          .map(obs => ({
            date: format(parseISO(obs.effectiveDateTime || obs.issued), 'MMM d'),
            value: obs.valueQuantity.value,
            unit: obs.valueQuantity.unit,
            target: goal.target?.[0]?.detailQuantity?.value || null
          }))
          .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        setProgressData(progressDataPoints);
      } else {
        // No observations found - show empty state
        setProgressData([]);
      }
    } catch (error) {
      // Failed to load goal progress data
      setProgressData([]);
    } finally {
      setLoading(false);
    }
  };

  // Function removed - now using real FHIR Observation data

  const calculateProgress = () => {
    if (!progressData.length) return 0;
    const latestValue = progressData[progressData.length - 1].value;
    const targetValue = goal.target?.[0]?.detailQuantity?.value;
    if (!targetValue) return 0;
    return Math.round((latestValue / targetValue) * 100);
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 80) return theme.palette.success.main;
    if (percentage >= 50) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const progressPercentage = calculateProgress();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Goal Progress Tracking
        <IconButton
          edge="end"
          color="inherit"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ mt: 2 }}>
            {/* Goal Info */}
            <Card sx={{ mb: 3, bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {goal?.description?.text || 'Goal'}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Target: {goal?.target?.[0]?.detailQuantity?.value} {goal?.target?.[0]?.detailQuantity?.unit || 'units'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Due Date: {goal?.target?.[0]?.dueDate ? format(parseISO(goal.target[0].dueDate), 'MMM d, yyyy') : 'Not set'}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Progress Overview */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Box sx={{ position: 'relative', display: 'inline-flex', mb: 2 }}>
                      <CircularProgress
                        variant="determinate"
                        value={progressPercentage}
                        size={120}
                        thickness={6}
                        sx={{ color: getProgressColor(progressPercentage) }}
                      />
                      <Box
                        sx={{
                          top: 0,
                          left: 0,
                          bottom: 0,
                          right: 0,
                          position: 'absolute',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Typography variant="h4" component="div" color="text.secondary">
                          {progressPercentage}%
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="subtitle1">Overall Progress</Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h3" color="primary">
                      {progressData.length ? progressData[progressData.length - 1].value : 0}
                    </Typography>
                    <Typography variant="subtitle1">Current Value</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Target: {goal?.target?.[0]?.detailQuantity?.value || 'Not set'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h3" color={progressPercentage >= 100 ? 'success.main' : 'warning.main'}>
                      {progressPercentage >= 100 ? 'Achieved' : 'In Progress'}
                    </Typography>
                    <Typography variant="subtitle1">Status</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Started {goal?.startDate ? format(parseISO(goal.startDate), 'MMM d, yyyy') : 'Recently'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Progress Chart */}
            <Card>
              <CardHeader title="Progress Over Time" />
              <CardContent>
                {progressData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={progressData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke={theme.palette.primary.main} 
                        strokeWidth={2}
                        name="Actual Progress"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="target" 
                        stroke={theme.palette.error.main} 
                        strokeDasharray="5 5"
                        name="Target"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <Box 
                    sx={{ 
                      height: 300, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexDirection: 'column'
                    }}
                  >
                    <Typography variant="body1" color="text.secondary" gutterBottom>
                      No progress data available
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Progress will appear here once observations are recorded for this goal
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                onClick={() => {
                  // Update progress
                  onClose();
                }}
              >
                Update Progress
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  // Export data
                  alert('Export functionality would be implemented here');
                }}
              >
                Export Data
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

// Activity Edit Dialog
const ActivityEditDialog = ({ open, onClose, activity, carePlanId, onSuccess }) => {
  const [activityData, setActivityData] = useState({
    description: activity?.detail?.description || '',
    status: activity?.detail?.status || 'not-started',
    scheduledPeriod: activity?.detail?.scheduledPeriod?.start || '',
    performerType: activity?.detail?.performer?.[0]?.type || 'practitioner',
    goal: activity?.detail?.goal?.[0]?.reference || '',
    notes: activity?.detail?.note || ''
  });

  const handleSave = async () => {
    try {
      // Get the care plan
      const carePlanResponse = await fetch(`/fhir/R4/CarePlan/${carePlanId}`);
      if (!carePlanResponse.ok) {
        throw new Error('Failed to fetch care plan');
      }
      const carePlan = await carePlanResponse.json();

      // Update the activity in the care plan
      const activityIndex = carePlan.activity?.findIndex(a => 
        a.detail?.description === activity?.detail?.description
      ) ?? -1;

      if (activityIndex === -1) {
        throw new Error('Activity not found in care plan');
      }

      // Update the activity
      carePlan.activity[activityIndex] = {
        ...carePlan.activity[activityIndex],
        detail: {
          ...carePlan.activity[activityIndex].detail,
          description: activityData.description,
          status: activityData.status,
          scheduledPeriod: activityData.scheduledPeriod ? {
            start: activityData.scheduledPeriod
          } : undefined,
          performer: [{
            type: {
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/practitioner-role',
                code: activityData.performerType
              }]
            }
          }],
          goal: activityData.goal ? [{
            reference: activityData.goal
          }] : undefined,
          note: activityData.notes
        }
      };

      // Save the updated care plan
      const updateResponse = await fetch(`/fhir/R4/CarePlan/${carePlanId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(carePlan)
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update care plan');
      }

      // Close dialog - parent component will handle refresh
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      alert('Failed to update activity: ' + error.message);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Edit Activity
        <IconButton
          edge="end"
          color="inherit"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="Activity Description"
            value={activityData.description}
            onChange={(e) => setActivityData({ ...activityData, description: e.target.value })}
            sx={{ mb: 2 }}
            required
          />
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={activityData.status}
              onChange={(e) => setActivityData({ ...activityData, status: e.target.value })}
              label="Status"
            >
              <MenuItem value="not-started">Not Started</MenuItem>
              <MenuItem value="scheduled">Scheduled</MenuItem>
              <MenuItem value="in-progress">In Progress</MenuItem>
              <MenuItem value="on-hold">On Hold</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            type="date"
            label="Scheduled Date"
            value={activityData.scheduledPeriod}
            onChange={(e) => setActivityData({ ...activityData, scheduledPeriod: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
          />

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Performer Type</InputLabel>
            <Select
              value={activityData.performerType}
              onChange={(e) => setActivityData({ ...activityData, performerType: e.target.value })}
              label="Performer Type"
            >
              <MenuItem value="practitioner">Practitioner</MenuItem>
              <MenuItem value="patient">Patient</MenuItem>
              <MenuItem value="related-person">Related Person</MenuItem>
              <MenuItem value="care-team">Care Team</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Notes"
            value={activityData.notes}
            onChange={(e) => setActivityData({ ...activityData, notes: e.target.value })}
            placeholder="Additional notes about this activity"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={handleSave}
          disabled={!activityData.description}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
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
        const savedGoal = await response.json();
        
        // Check if we need to create or update a CarePlan
        const carePlans = await fhirClient.searchResources('CarePlan', {
          patient: patientId,
          status: 'active'
        });
        
        let carePlan;
        if (carePlans.resources && carePlans.resources.length > 0) {
          // Update existing active CarePlan
          carePlan = carePlans.resources[0];
          if (!carePlan.goal) {
            carePlan.goal = [];
          }
          // Add goal reference if not already present
          const goalRef = { reference: `Goal/${savedGoal.id}` };
          if (!carePlan.goal.some(g => g.reference === goalRef.reference)) {
            carePlan.goal.push(goalRef);
          }
          
          await fhirClient.update('CarePlan', carePlan.id, carePlan);
        } else {
          // Create new CarePlan
          const newCarePlan = {
            resourceType: 'CarePlan',
            status: 'active',
            intent: 'plan',
            title: 'Patient Care Plan',
            description: 'Comprehensive care plan for patient',
            subject: {
              reference: `Patient/${patientId}`
            },
            period: {
              start: new Date().toISOString()
            },
            author: {
              display: 'Current Provider' // This would come from auth context
            },
            goal: [{
              reference: `Goal/${savedGoal.id}`
            }],
            category: [{
              coding: [{
                system: 'http://snomed.info/sct',
                code: '734163000',
                display: 'Care plan'
              }]
            }]
          };
          
          await fhirClient.create('CarePlan', newCarePlan);
        }
        
        // Close dialog - parent component will handle refresh
        onClose();
      } else {
        // Handle error - would use proper error logging in production
        throw new Error(`Failed to save goal: ${response.statusText}`);
      }
    } catch (error) {
      // Handle error - show user-friendly message
      if (onClose) {
        onClose();
      }
      // In production, this would show an error snackbar or dialog
      // Failed to save goal - would show error notification in production
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

const CarePlanTab = ({ patientId, onNotificationUpdate, department = 'general' }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { getPatientResources, isLoading, currentPatient, refreshPatientResources } = useFHIRResource();
  const { publish } = useClinicalWorkflow();
  
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
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
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [activityEditDialogOpen, setActivityEditDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);

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
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const goalText = (goal.description?.text || '').toLowerCase();
      const targetMeasure = (goal.target?.[0]?.measure?.text || goal.target?.[0]?.measure?.coding?.[0]?.display || '').toLowerCase();
      const notes = (goal.note?.[0]?.text || '').toLowerCase();
      
      if (!goalText.includes(searchLower) && 
          !targetMeasure.includes(searchLower) && 
          !notes.includes(searchLower)) {
        return false;
      }
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
    setSelectedGoalForProgress(goal);
    setProgressDialogOpen(true);
  };

  const handleEditActivity = (activity) => {
    setSelectedActivity(activity);
    setActivityEditDialogOpen(true);
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
                  setSnackbar({
                    open: true,
                    message: 'Failed to update goal progress: ' + error.message,
                    severity: 'error'
                  });
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
      <AddCareTeamMemberDialog 
        open={addMemberDialogOpen} 
        onClose={() => setAddMemberDialogOpen(false)}
        careTeam={selectedCareTeam}
        patientId={patientId}
        onSuccess={() => {
          setSnackbar({ 
            open: true, 
            message: 'Care team member added successfully', 
            severity: 'success' 
          });
          refreshPatientResources(patientId);
        }}
      />

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
                      <span>
                        <span style={{ fontSize: '0.875rem', color: 'rgba(0, 0, 0, 0.6)' }}>
                          Role: {member.role?.[0]?.text || 'Not specified'}
                        </span>
                        {member.period?.start && (
                          <span style={{ fontSize: '0.75rem', color: 'rgba(0, 0, 0, 0.6)', display: 'block' }}>
                            Since: {format(parseISO(member.period.start), 'MMM d, yyyy')}
                          </span>
                        )}
                      </span>
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

      {/* Goal Progress Dialog */}
      <GoalProgressDialog
        open={progressDialogOpen}
        onClose={() => {
          setProgressDialogOpen(false);
          setSelectedGoalForProgress(null);
        }}
        goal={selectedGoalForProgress}
        patientId={patientId}
      />

      {/* Activity Edit Dialog */}
      <ActivityEditDialog
        open={activityEditDialogOpen}
        onClose={() => {
          setActivityEditDialogOpen(false);
          setSelectedActivity(null);
        }}
        activity={selectedActivity}
        carePlanId={activeCarePlan?.id}
        onSuccess={() => {
          setSnackbar({
            open: true,
            message: 'Activity updated successfully',
            severity: 'success'
          });
        }}
      />

      {/* Snackbar for notifications */}
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

export default React.memo(CarePlanTab);