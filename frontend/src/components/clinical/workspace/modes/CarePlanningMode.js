/**
 * CarePlanningMode Component
 * Visual care planning with goals, activities, and team coordination
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  ListSubheader,
  Chip,
  Stack,
  Divider,
  Card,
  CardContent,
  CardActions,
  Collapse,
  Alert,
  CircularProgress,
  Tooltip,
  Badge,
  Avatar,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  useTheme,
  alpha,
  Fade,
  Grow,
  Menu,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Rating,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent
} from '@mui/lab';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  LocalHospital as HealthIcon,
  Timeline as GoalIcon,
  Group as TeamIcon,
  Assignment as TaskIcon,
  CheckCircle as CompleteIcon,
  RadioButtonUnchecked as PendingIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CalendarToday as CalendarIcon,
  AccessTime as ClockIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  Visibility as ViewIcon,
  VisibilityOff as HideIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  TrendingUp as ProgressIcon,
  Flag as FlagIcon,
  Print as PrintIcon,
  Share as ShareIcon,
  Psychology as MentalHealthIcon,
  FitnessCenter as ExerciseIcon,
  Restaurant as NutritionIcon,
  LocalPharmacy as MedicationIcon,
  MonitorHeart as MonitoringIcon,
  School as EducationIcon,
  Home as HomeIcon,
  Healing as TherapyIcon,
  Favorite as HeartIcon,
  Star as StarIcon
} from '@mui/icons-material';
import { format, parseISO, addDays, addWeeks, addMonths, formatDistanceToNow, isAfter, isBefore, isToday } from 'date-fns';
import { useParams } from 'react-router-dom';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { fhirClient } from '../../../../services/fhirClient';
import { usePatientResourceType } from '../../../../hooks/useFHIRResources';

// Goal categories
const GOAL_CATEGORIES = {
  clinical: {
    label: 'Clinical Goals',
    icon: <HealthIcon />,
    color: 'primary'
  },
  lifestyle: {
    label: 'Lifestyle Goals',
    icon: <ExerciseIcon />,
    color: 'success'
  },
  mental_health: {
    label: 'Mental Health',
    icon: <MentalHealthIcon />,
    color: 'secondary'
  },
  social: {
    label: 'Social Support',
    icon: <TeamIcon />,
    color: 'info'
  },
  medication: {
    label: 'Medication Adherence',
    icon: <MedicationIcon />,
    color: 'warning'
  }
};

// Activity types
const ACTIVITY_TYPES = {
  appointment: { icon: <CalendarIcon />, color: 'primary' },
  medication: { icon: <MedicationIcon />, color: 'warning' },
  therapy: { icon: <TherapyIcon />, color: 'secondary' },
  exercise: { icon: <ExerciseIcon />, color: 'success' },
  nutrition: { icon: <NutritionIcon />, color: 'info' },
  education: { icon: <EducationIcon />, color: 'default' },
  monitoring: { icon: <MonitoringIcon />, color: 'error' }
};

// Goal Card Component
const GoalCard = ({ goal, onEdit, onUpdateProgress }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  
  // Extract goal details
  const description = goal.description?.text || 'Unnamed Goal';
  const priority = goal.priority?.coding?.[0]?.code || 'medium-priority';
  const status = goal.lifecycleStatus || 'proposed';
  const category = goal.category?.[0]?.coding?.[0]?.code || 'clinical';
  const categoryConfig = GOAL_CATEGORIES[category] || GOAL_CATEGORIES.clinical;
  
  // Calculate progress
  const achievementStatus = goal.achievementStatus?.coding?.[0]?.code;
  const progress = achievementStatus === 'achieved' ? 100 :
                  achievementStatus === 'in-progress' ? 50 :
                  achievementStatus === 'improving' ? 75 :
                  0;
  
  // Due date
  const dueDate = goal.target?.[0]?.dueDate ? parseISO(goal.target[0].dueDate) : null;
  const isOverdue = dueDate && isBefore(dueDate, new Date()) && status !== 'completed';
  
  return (
    <Card sx={{ 
      mb: 2,
      borderLeft: 4,
      borderLeftColor: isOverdue ? 'error.main' : categoryConfig.color + '.main'
    }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ 
                bgcolor: alpha(theme.palette[categoryConfig.color].main, 0.1),
                color: theme.palette[categoryConfig.color].main
              }}>
                {categoryConfig.icon}
              </Avatar>
              <Box>
                <Typography variant="h6">{description}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {categoryConfig.label}
                </Typography>
              </Box>
            </Stack>
            
            <Stack direction="row" spacing={1}>
              {isOverdue && (
                <Chip 
                  icon={<WarningIcon />} 
                  label="Overdue" 
                  size="small" 
                  color="error"
                />
              )}
              <Chip 
                label={status} 
                size="small" 
                color={status === 'active' ? 'success' : 'default'}
              />
              <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Stack>
          </Stack>
          
          {/* Progress Bar */}
          <Box>
            <Stack direction="row" justifyContent="space-between" mb={1}>
              <Typography variant="body2">Progress</Typography>
              <Typography variant="body2" color="text.secondary">{progress}%</Typography>
            </Stack>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ height: 8, borderRadius: 4 }}
              color={progress === 100 ? 'success' : categoryConfig.color}
            />
          </Box>
          
          {/* Quick Actions */}
          <Stack direction="row" spacing={1}>
            <Button 
              size="small" 
              startIcon={<EditIcon />}
              onClick={() => onEdit(goal)}
            >
              Update
            </Button>
            <Button 
              size="small" 
              startIcon={<ProgressIcon />}
              onClick={() => onUpdateProgress(goal)}
            >
              Log Progress
            </Button>
            {dueDate && (
              <Chip 
                icon={<CalendarIcon />}
                label={format(dueDate, 'MMM dd, yyyy')}
                size="small"
                variant="outlined"
              />
            )}
          </Stack>
        </Stack>
      </CardContent>
      
      <Collapse in={expanded}>
        <Divider />
        <CardContent>
          <Grid container spacing={2}>
            {/* Target Details */}
            {goal.target?.map((target, index) => (
              <Grid item xs={12} key={index}>
                <Typography variant="subtitle2" gutterBottom>Target</Typography>
                {target.measure && (
                  <Typography variant="body2">
                    Measure: {target.measure.text || target.measure.coding?.[0]?.display}
                  </Typography>
                )}
                {target.detailQuantity && (
                  <Typography variant="body2">
                    Target: {target.detailQuantity.value} {target.detailQuantity.unit}
                  </Typography>
                )}
              </Grid>
            ))}
            
            {/* Notes */}
            {goal.note?.map((note, index) => (
              <Grid item xs={12} key={index}>
                <Typography variant="subtitle2" gutterBottom>Notes</Typography>
                <Typography variant="body2" color="text.secondary">
                  {note.text}
                </Typography>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Collapse>
    </Card>
  );
};

// Activity Timeline Component
const ActivityTimeline = ({ activities }) => {
  const theme = useTheme();
  
  return (
    <Timeline position="alternate">
      {activities.map((activity, index) => {
        const activityType = activity.code?.coding?.[0]?.code || 'appointment';
        const typeConfig = ACTIVITY_TYPES[activityType] || ACTIVITY_TYPES.appointment;
        const isCompleted = activity.status === 'completed';
        const scheduledDate = activity.scheduledTiming?.repeat?.boundsPeriod?.start;
        
        return (
          <TimelineItem key={index}>
            <TimelineOppositeContent color="text.secondary">
              {scheduledDate && format(parseISO(scheduledDate), 'MMM dd, yyyy')}
            </TimelineOppositeContent>
            <TimelineSeparator>
              <TimelineDot 
                color={isCompleted ? 'success' : typeConfig.color}
                variant={isCompleted ? 'filled' : 'outlined'}
              >
                {typeConfig.icon}
              </TimelineDot>
              {index < activities.length - 1 && <TimelineConnector />}
            </TimelineSeparator>
            <TimelineContent>
              <Typography variant="subtitle2">
                {activity.detail?.code?.text || activity.detail?.description || 'Activity'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {activity.detail?.performer?.[0]?.display || 'Care Team'}
              </Typography>
            </TimelineContent>
          </TimelineItem>
        );
      })}
    </Timeline>
  );
};

// Team Member Card
const TeamMemberCard = ({ member }) => {
  const theme = useTheme();
  const practitioner = member.member?.display || 'Unknown';
  const role = member.role?.[0]?.text || member.role?.[0]?.coding?.[0]?.display || 'Team Member';
  const period = member.period;
  const isActive = !period?.end || isAfter(new Date(), parseISO(period.end));
  
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
              <PersonIcon />
            </Avatar>
            <Box flex={1}>
              <Typography variant="subtitle1">{practitioner}</Typography>
              <Typography variant="body2" color="text.secondary">{role}</Typography>
            </Box>
            <Chip 
              label={isActive ? 'Active' : 'Inactive'} 
              size="small"
              color={isActive ? 'success' : 'default'}
            />
          </Stack>
          
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <PhoneIcon fontSize="small" color="action" />
              <Typography variant="body2">(555) 123-4567</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <EmailIcon fontSize="small" color="action" />
              <Typography variant="body2">provider@healthcare.com</Typography>
            </Stack>
          </Stack>
          
          <Stack direction="row" spacing={1}>
            <Button size="small" startIcon={<PhoneIcon />}>Call</Button>
            <Button size="small" startIcon={<EmailIcon />}>Message</Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

// Main CarePlanningMode Component
const CarePlanningMode = () => {
  const theme = useTheme();
  const { patientId } = useParams();
  const { currentPatient } = useFHIRResource();
  
  // State
  const [activeTab, setActiveTab] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [editingGoal, setEditingGoal] = useState(null);
  const [newGoalDialog, setNewGoalDialog] = useState(false);
  const [progressDialog, setProgressDialog] = useState(null);
  
  // Get FHIR resources
  const carePlans = usePatientResourceType(patientId, 'CarePlan');
  const goals = usePatientResourceType(patientId, 'Goal');
  const careTeams = usePatientResourceType(patientId, 'CareTeam');
  
  // Process care plans
  const processedCarePlans = useMemo(() => {
    let plans = carePlans.resources || [];
    
    if (showActiveOnly) {
      plans = plans.filter(plan => plan.status === 'active');
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      plans = plans.filter(plan =>
        plan.title?.toLowerCase().includes(query) ||
        plan.description?.toLowerCase().includes(query)
      );
    }
    
    return plans;
  }, [carePlans.resources, showActiveOnly, searchQuery]);
  
  // Process goals
  const processedGoals = useMemo(() => {
    let goalList = goals.resources || [];
    
    if (selectedCategory !== 'all') {
      goalList = goalList.filter(goal => 
        goal.category?.[0]?.coding?.[0]?.code === selectedCategory
      );
    }
    
    if (showActiveOnly) {
      goalList = goalList.filter(goal => 
        goal.lifecycleStatus === 'active' || goal.lifecycleStatus === 'proposed'
      );
    }
    
    return goalList;
  }, [goals.resources, selectedCategory, showActiveOnly]);
  
  // Extract activities from care plans
  const allActivities = useMemo(() => {
    const activities = [];
    processedCarePlans.forEach(plan => {
      if (plan.activity) {
        activities.push(...plan.activity);
      }
    });
    return activities.sort((a, b) => {
      const aDate = a.detail?.scheduledTiming?.repeat?.boundsPeriod?.start;
      const bDate = b.detail?.scheduledTiming?.repeat?.boundsPeriod?.start;
      if (!aDate || !bDate) return 0;
      return new Date(aDate) - new Date(bDate);
    });
  }, [processedCarePlans]);
  
  // Get care team members
  const teamMembers = useMemo(() => {
    const members = [];
    (careTeams.resources || []).forEach(team => {
      if (team.participant) {
        members.push(...team.participant);
      }
    });
    return members;
  }, [careTeams.resources]);
  
  // Handle goal editing
  const handleEditGoal = (goal) => {
    setEditingGoal(goal);
    setNewGoalDialog(true);
  };
  
  // Handle progress update
  const handleUpdateProgress = (goal) => {
    setProgressDialog(goal);
  };
  
  // Handle save goal
  const handleSaveGoal = async (goalData) => {
    try {
      if (editingGoal) {
        // Update existing goal
        await fhirClient.update('Goal', editingGoal.id, {
          ...editingGoal,
          ...goalData
        });
      } else {
        // Create new goal
        await fhirClient.create('Goal', {
          resourceType: 'Goal',
          ...goalData,
          subject: {
            reference: `Patient/${patientId}`
          }
        });
      }
      
      setNewGoalDialog(false);
      setEditingGoal(null);
      goals.refetch();
    } catch (error) {
      console.error('Error saving goal:', error);
    }
  };
  
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs>
            <TextField
              placeholder="Search care plans and goals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              sx={{ minWidth: 300 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          
          <Grid item>
            <Stack direction="row" spacing={2} alignItems="center">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showActiveOnly}
                    onChange={(e) => setShowActiveOnly(e.target.checked)}
                  />
                }
                label="Active Only"
              />
              
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setNewGoalDialog(true)}
              >
                New Goal
              </Button>
              
              <IconButton>
                <PrintIcon />
              </IconButton>
              <IconButton>
                <ShareIcon />
              </IconButton>
            </Stack>
          </Grid>
        </Grid>
        
        {/* Tabs */}
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mt: 2 }}>
          <Tab 
            label="Goals" 
            icon={<Badge badgeContent={processedGoals.length} color="primary">
              <GoalIcon />
            </Badge>}
            iconPosition="start"
          />
          <Tab 
            label="Care Plans" 
            icon={<Badge badgeContent={processedCarePlans.length} color="primary">
              <TaskIcon />
            </Badge>}
            iconPosition="start"
          />
          <Tab 
            label="Care Team" 
            icon={<Badge badgeContent={teamMembers.length} color="primary">
              <TeamIcon />
            </Badge>}
            iconPosition="start"
          />
          <Tab 
            label="Activities" 
            icon={<Badge badgeContent={allActivities.length} color="primary">
              <CalendarIcon />
            </Badge>}
            iconPosition="start"
          />
        </Tabs>
      </Paper>
      
      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Goals Tab */}
        {activeTab === 0 && (
          <Grid container spacing={2}>
            {/* Category Filter */}
            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Categories</Typography>
                <List>
                  <ListItemButton
                    selected={selectedCategory === 'all'}
                    onClick={() => setSelectedCategory('all')}
                  >
                    <ListItemText primary="All Goals" secondary={processedGoals.length} />
                  </ListItemButton>
                  
                  {Object.entries(GOAL_CATEGORIES).map(([key, category]) => {
                    const count = (goals.resources || []).filter(g => 
                      g.category?.[0]?.coding?.[0]?.code === key
                    ).length;
                    
                    return (
                      <ListItemButton
                        key={key}
                        selected={selectedCategory === key}
                        onClick={() => setSelectedCategory(key)}
                      >
                        <ListItemIcon>
                          <Avatar sx={{ 
                            width: 32, 
                            height: 32,
                            bgcolor: alpha(theme.palette[category.color].main, 0.1),
                            color: theme.palette[category.color].main
                          }}>
                            {category.icon}
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText primary={category.label} secondary={count} />
                      </ListItemButton>
                    );
                  })}
                </List>
              </Paper>
            </Grid>
            
            {/* Goals List */}
            <Grid item xs={12} md={9}>
              {processedGoals.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <GoalIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No goals found
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {showActiveOnly ? 'No active goals. ' : ''}
                    Create a new goal to start care planning.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setNewGoalDialog(true)}
                  >
                    Create First Goal
                  </Button>
                </Paper>
              ) : (
                processedGoals.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onEdit={handleEditGoal}
                    onUpdateProgress={handleUpdateProgress}
                  />
                ))
              )}
            </Grid>
          </Grid>
        )}
        
        {/* Care Plans Tab */}
        {activeTab === 1 && (
          <Grid container spacing={2}>
            {processedCarePlans.length === 0 ? (
              <Grid item xs={12}>
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <TaskIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No care plans found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Care plans will appear here when created by the care team.
                  </Typography>
                </Paper>
              </Grid>
            ) : (
              processedCarePlans.map(plan => (
                <Grid item xs={12} key={plan.id}>
                  <Card>
                    <CardContent>
                      <Stack spacing={2}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography variant="h6">{plan.title || 'Care Plan'}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {plan.description}
                            </Typography>
                          </Box>
                          <Chip 
                            label={plan.status} 
                            color={plan.status === 'active' ? 'success' : 'default'}
                          />
                        </Stack>
                        
                        {plan.period && (
                          <Stack direction="row" spacing={2}>
                            <Chip
                              icon={<CalendarIcon />}
                              label={`Start: ${format(parseISO(plan.period.start), 'MMM dd, yyyy')}`}
                              size="small"
                              variant="outlined"
                            />
                            {plan.period.end && (
                              <Chip
                                icon={<CalendarIcon />}
                                label={`End: ${format(parseISO(plan.period.end), 'MMM dd, yyyy')}`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Stack>
                        )}
                        
                        {plan.category && (
                          <Stack direction="row" spacing={1}>
                            {plan.category.map((cat, index) => (
                              <Chip
                                key={index}
                                label={cat.text || cat.coding?.[0]?.display || 'Category'}
                                size="small"
                              />
                            ))}
                          </Stack>
                        )}
                        
                        {plan.activity && plan.activity.length > 0 && (
                          <>
                            <Divider />
                            <Typography variant="subtitle2">
                              Activities ({plan.activity.length})
                            </Typography>
                            <List dense>
                              {plan.activity.slice(0, 3).map((activity, index) => (
                                <ListItem key={index}>
                                  <ListItemIcon>
                                    <TaskIcon />
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={activity.detail?.code?.text || activity.detail?.description}
                                    secondary={activity.detail?.status}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))
            )}
          </Grid>
        )}
        
        {/* Care Team Tab */}
        {activeTab === 2 && (
          <Grid container spacing={2}>
            {teamMembers.length === 0 ? (
              <Grid item xs={12}>
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <TeamIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No care team members found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Care team members will appear here when assigned.
                  </Typography>
                </Paper>
              </Grid>
            ) : (
              teamMembers.map((member, index) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <TeamMemberCard member={member} />
                </Grid>
              ))
            )}
          </Grid>
        )}
        
        {/* Activities Tab */}
        {activeTab === 3 && (
          <Paper sx={{ p: 3 }}>
            {allActivities.length === 0 ? (
              <Box textAlign="center" py={4}>
                <CalendarIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No activities scheduled
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Activities from care plans will appear here.
                </Typography>
              </Box>
            ) : (
              <ActivityTimeline activities={allActivities} />
            )}
          </Paper>
        )}
      </Box>
      
      {/* New/Edit Goal Dialog */}
      <Dialog
        open={newGoalDialog}
        onClose={() => {
          setNewGoalDialog(false);
          setEditingGoal(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingGoal ? 'Edit Goal' : 'Create New Goal'}
        </DialogTitle>
        <DialogContent>
          {/* Goal form would go here */}
          <Typography color="text.secondary">
            Goal creation form would be implemented here
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setNewGoalDialog(false);
            setEditingGoal(null);
          }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => handleSaveGoal({})}>
            Save Goal
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Progress Update Dialog */}
      <Dialog
        open={!!progressDialog}
        onClose={() => setProgressDialog(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Update Goal Progress</DialogTitle>
        <DialogContent>
          {progressDialog && (
            <Stack spacing={2} sx={{ mt: 2 }}>
              <Typography variant="subtitle1">
                {progressDialog.description?.text}
              </Typography>
              <Box>
                <Typography variant="body2" gutterBottom>Achievement Status</Typography>
                <ToggleButtonGroup
                  value={progressDialog.achievementStatus?.coding?.[0]?.code || 'in-progress'}
                  exclusive
                  fullWidth
                >
                  <ToggleButton value="in-progress">In Progress</ToggleButton>
                  <ToggleButton value="improving">Improving</ToggleButton>
                  <ToggleButton value="achieved">Achieved</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <TextField
                label="Progress Notes"
                multiline
                rows={3}
                fullWidth
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProgressDialog(null)}>Cancel</Button>
          <Button variant="contained">Save Progress</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CarePlanningMode;