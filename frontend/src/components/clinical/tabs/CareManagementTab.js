import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Chip,
  Stack,
  Divider,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Collapse,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Avatar,
  Badge,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Assignment as CarePlanIcon,
  Group as CareTeamIcon,
  Person as PersonIcon,
  Flag as GoalIcon,
  Task as TaskIcon,
  Schedule as ActivityIcon,
  CheckCircle as CompletedIcon,
  RadioButtonUnchecked as PendingIcon,
  Cancel as CancelledIcon,
  Pause as OnHoldIcon,
  Add as AddIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Print as PrintIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  AccessTime as TimeIcon,
  CalendarToday as DateIcon,
  TrendingUp as ProgressIcon
} from '@mui/icons-material';
import { format, parseISO, isAfter, isBefore, differenceInDays } from 'date-fns';
import { fhirClient } from '../../../services/fhirClient';

// Care Plan Section
const CarePlansSection = ({ carePlans, patientId, onRefresh }) => {
  const [expandedPlans, setExpandedPlans] = useState({});
  const [filter, setFilter] = useState('active');

  const toggleExpanded = (id) => {
    setExpandedPlans(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredPlans = carePlans.filter(plan => {
    if (filter === 'all') return true;
    return plan.status === filter;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'info';
      case 'cancelled': return 'error';
      case 'draft': return 'warning';
      case 'on-hold': return 'default';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return <PendingIcon color="success" />;
      case 'completed': return <CompletedIcon color="info" />;
      case 'cancelled': return <CancelledIcon color="error" />;
      case 'on-hold': return <OnHoldIcon color="default" />;
      default: return <PendingIcon />;
    }
  };

  const calculateProgress = (plan) => {
    if (!plan.activity) return 0;
    
    const activities = plan.activity;
    const completed = activities.filter(a => 
      a.detail?.status === 'completed'
    ).length;
    
    return activities.length > 0 ? (completed / activities.length) * 100 : 0;
  };

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Care Plans</Typography>
          <Stack direction="row" spacing={1}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                label="Status"
              >
                <MenuItem value="all">All Plans</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="on-hold">On Hold</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
            <Tooltip title="Add Care Plan">
              <IconButton size="small" color="primary">
                <AddIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Print Care Plans">
              <IconButton size="small">
                <PrintIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {filteredPlans.map((plan, index) => {
          const isExpanded = expandedPlans[plan.id];
          const progress = calculateProgress(plan);

          return (
            <React.Fragment key={plan.id}>
              <Accordion expanded={isExpanded} onChange={() => toggleExpanded(plan.id)}>
                <AccordionSummary>
                  <Box sx={{ width: '100%' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={2} alignItems="center">
                        {getStatusIcon(plan.status)}
                        <Box>
                          <Typography variant="subtitle1">
                            {plan.title || `Care Plan ${index + 1}`}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Intent: {plan.intent} | Status: {plan.status}
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip 
                          label={plan.status}
                          size="small"
                          color={getStatusColor(plan.status)}
                        />
                        {plan.activity && (
                          <Chip 
                            label={`${plan.activity.length} activities`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    </Stack>
                    
                    {plan.activity && (
                      <Box sx={{ mt: 2 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="caption">Progress:</Typography>
                          <LinearProgress 
                            variant="determinate" 
                            value={progress} 
                            sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                          />
                          <Typography variant="caption">{Math.round(progress)}%</Typography>
                        </Stack>
                      </Box>
                    )}
                  </Box>
                </AccordionSummary>
                
                <AccordionDetails>
                  <Stack spacing={2}>
                    {plan.description && (
                      <Box>
                        <Typography variant="subtitle2">Description:</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {plan.description}
                        </Typography>
                      </Box>
                    )}

                    {plan.period && (
                      <Box>
                        <Typography variant="subtitle2">Timeline:</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {plan.period.start && `Start: ${format(parseISO(plan.period.start), 'MM/dd/yyyy')}`}
                          {plan.period.end && ` - End: ${format(parseISO(plan.period.end), 'MM/dd/yyyy')}`}
                        </Typography>
                      </Box>
                    )}

                    {plan.goal && plan.goal.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2">Goals:</Typography>
                        <List dense>
                          {plan.goal.map((goal, goalIndex) => (
                            <ListItem key={goalIndex}>
                              <ListItemIcon>
                                <GoalIcon color="primary" />
                              </ListItemIcon>
                              <ListItemText 
                                primary={goal.description?.text || `Goal ${goalIndex + 1}`}
                                secondary={goal.target?.map(t => t.detailString).join(', ')}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}

                    {plan.activity && plan.activity.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2">Activities:</Typography>
                        <List dense>
                          {plan.activity.map((activity, actIndex) => {
                            const detail = activity.detail;
                            return (
                              <ListItem key={actIndex}>
                                <ListItemIcon>
                                  {detail?.status === 'completed' ? (
                                    <CompletedIcon color="success" />
                                  ) : (
                                    <ActivityIcon color="action" />
                                  )}
                                </ListItemIcon>
                                <ListItemText 
                                  primary={detail?.description || `Activity ${actIndex + 1}`}
                                  secondary={
                                    <>
                                      Status: {detail?.status || 'unknown'}
                                      {detail?.scheduledPeriod?.start && 
                                        ` • Scheduled: ${format(parseISO(detail.scheduledPeriod.start), 'MM/dd/yyyy')}`
                                      }
                                    </>
                                  }
                                />
                              </ListItem>
                            );
                          })}
                        </List>
                      </Box>
                    )}

                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" startIcon={<EditIcon />}>
                        Edit Plan
                      </Button>
                      <Button size="small" variant="outlined">
                        View Details
                      </Button>
                    </Stack>
                  </Stack>
                </AccordionDetails>
              </Accordion>
              {index < filteredPlans.length - 1 && <Divider sx={{ my: 1 }} />}
            </React.Fragment>
          );
        })}

        {filteredPlans.length === 0 && (
          <Alert severity="info">
            No care plans found for the selected filter
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

// Care Team Section
const CareTeamSection = ({ careTeams, patientId, onRefresh }) => {
  const [expandedTeams, setExpandedTeams] = useState({});

  const toggleExpanded = (id) => {
    setExpandedTeams(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getParticipantRole = (participant) => {
    return participant.role?.[0]?.text || 
           participant.role?.[0]?.coding?.[0]?.display || 
           'Team Member';
  };

  const getParticipantName = (participant) => {
    return participant.member?.display || 
           participant.member?.reference || 
           'Unknown';
  };

  const getRoleColor = (role) => {
    const roleLower = role.toLowerCase();
    if (roleLower.includes('physician') || roleLower.includes('doctor')) return 'primary';
    if (roleLower.includes('nurse')) return 'secondary';
    if (roleLower.includes('therapist')) return 'success';
    if (roleLower.includes('social')) return 'info';
    return 'default';
  };

  const activeTeams = careTeams.filter(team => team.status === 'active');

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Care Team</Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Add Team Member">
              <IconButton size="small" color="primary">
                <AddIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Contact Team">
              <IconButton size="small">
                <PhoneIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {activeTeams.map((team, teamIndex) => {
          const isExpanded = expandedTeams[team.id];

          return (
            <React.Fragment key={team.id}>
              <Box sx={{ mb: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle1">
                    {team.name || `Care Team ${teamIndex + 1}`}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Chip 
                      label={team.status}
                      size="small"
                      color={team.status === 'active' ? 'success' : 'default'}
                    />
                    <Badge badgeContent={team.participant?.length || 0} color="primary">
                      <CareTeamIcon />
                    </Badge>
                    <IconButton size="small" onClick={() => toggleExpanded(team.id)}>
                      {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Stack>
                </Stack>

                {team.participant && (
                  <Grid container spacing={2}>
                    {team.participant.slice(0, isExpanded ? undefined : 4).map((participant, index) => {
                      const role = getParticipantRole(participant);
                      const name = getParticipantName(participant);

                      return (
                        <Grid item xs={12} sm={6} md={3} key={index}>
                          <Paper sx={{ p: 2, textAlign: 'center' }}>
                            <Avatar sx={{ mx: 'auto', mb: 1, bgcolor: `${getRoleColor(role)}.light` }}>
                              <PersonIcon />
                            </Avatar>
                            <Typography variant="subtitle2" noWrap>
                              {name}
                            </Typography>
                            <Chip 
                              label={role}
                              size="small"
                              color={getRoleColor(role)}
                              sx={{ mt: 1 }}
                            />
                            
                            {participant.period && (
                              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                                {participant.period.start && 
                                  `Since: ${format(parseISO(participant.period.start), 'MM/yyyy')}`
                                }
                              </Typography>
                            )}

                            <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1 }}>
                              <Tooltip title="Contact">
                                <IconButton size="small">
                                  <PhoneIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Message">
                                <IconButton size="small">
                                  <EmailIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </Paper>
                        </Grid>
                      );
                    })}
                  </Grid>
                )}

                <Collapse in={isExpanded}>
                  <Box sx={{ mt: 2 }}>
                    {team.note && team.note.length > 0 && (
                      <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography variant="subtitle2">Team Notes:</Typography>
                        {team.note.map((note, idx) => (
                          <Typography key={idx} variant="body2">
                            {note.text}
                          </Typography>
                        ))}
                      </Alert>
                    )}
                    
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" startIcon={<EditIcon />}>
                        Edit Team
                      </Button>
                      <Button size="small" variant="outlined">
                        Contact All
                      </Button>
                    </Stack>
                  </Box>
                </Collapse>
              </Box>
              {teamIndex < activeTeams.length - 1 && <Divider />}
            </React.Fragment>
          );
        })}

        {activeTeams.length === 0 && (
          <Alert severity="info">
            No active care teams found
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

// Goals & Tasks Section
const GoalsTasksSection = ({ carePlans, patientId }) => {
  const [filter, setFilter] = useState('active');

  // Extract all goals from care plans
  const allGoals = carePlans.flatMap(plan => 
    (plan.goal || []).map(goal => ({
      ...goal,
      planId: plan.id,
      planTitle: plan.title
    }))
  );

  // Extract all activities/tasks from care plans
  const allTasks = carePlans.flatMap(plan => 
    (plan.activity || []).map(activity => ({
      ...activity,
      planId: plan.id,
      planTitle: plan.title
    }))
  );

  const filteredTasks = allTasks.filter(task => {
    if (filter === 'all') return true;
    return task.detail?.status === filter;
  });

  const getTaskIcon = (status) => {
    switch (status) {
      case 'completed': return <CompletedIcon color="success" />;
      case 'cancelled': return <CancelledIcon color="error" />;
      case 'on-hold': return <OnHoldIcon color="default" />;
      default: return <TaskIcon color="primary" />;
    }
  };

  const isOverdue = (task) => {
    const scheduledEnd = task.detail?.scheduledPeriod?.end;
    if (!scheduledEnd) return false;
    return isAfter(new Date(), parseISO(scheduledEnd)) && 
           task.detail?.status !== 'completed';
  };

  return (
    <Grid container spacing={3}>
      {/* Goals Section */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Goals
            </Typography>
            
            {allGoals.length > 0 ? (
              <List>
                {allGoals.map((goal, index) => (
                  <React.Fragment key={index}>
                    <ListItem>
                      <ListItemIcon>
                        <GoalIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={goal.description?.text || `Goal ${index + 1}`}
                        secondary={
                          <>
                            From: {goal.planTitle || 'Unknown Plan'}
                            {goal.target?.map(target => (
                              target.detailString && ` • Target: ${target.detailString}`
                            ))}
                          </>
                        }
                      />
                    </ListItem>
                    {index < allGoals.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Alert severity="info">
                No goals defined in care plans
              </Alert>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Tasks Section */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Tasks & Activities
              </Typography>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="all">All Tasks</MenuItem>
                  <MenuItem value="in-progress">In Progress</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            {filteredTasks.length > 0 ? (
              <List>
                {filteredTasks.map((task, index) => {
                  const detail = task.detail;
                  const overdue = isOverdue(task);

                  return (
                    <React.Fragment key={index}>
                      <ListItem>
                        <ListItemIcon>
                          {getTaskIcon(detail?.status)}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body1">
                                {detail?.description || `Task ${index + 1}`}
                              </Typography>
                              {overdue && (
                                <Chip 
                                  label="Overdue"
                                  size="small"
                                  color="error"
                                />
                              )}
                            </Stack>
                          }
                          secondary={
                            <>
                              Status: {detail?.status || 'unknown'}
                              {detail?.scheduledPeriod?.start && 
                                ` • Due: ${format(parseISO(detail.scheduledPeriod.start), 'MM/dd/yyyy')}`
                              }
                              <br />
                              Plan: {task.planTitle || 'Unknown Plan'}
                            </>
                          }
                        />
                      </ListItem>
                      {index < filteredTasks.length - 1 && <Divider />}
                    </React.Fragment>
                  );
                })}
              </List>
            ) : (
              <Alert severity="info">
                No tasks found for the selected filter
              </Alert>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

// Main Care Management Tab Component
const CareManagementTab = ({ patientId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [carePlans, setCarePlans] = useState([]);
  const [careTeams, setCareTeams] = useState([]);

  useEffect(() => {
    if (!patientId) return;
    fetchCareManagementData();
  }, [patientId]);

  const fetchCareManagementData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [carePlansResult, careTeamsResult] = await Promise.all([
        fhirClient.search('CarePlan', { patient: patientId, _sort: '-date' }),
        fhirClient.search('CareTeam', { patient: patientId, _sort: '-date' })
      ]);

      setCarePlans(carePlansResult.resources || []);
      setCareTeams(careTeamsResult.resources || []);

    } catch (err) {
      console.error('Error fetching care management data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Error loading care management data: {error}
      </Alert>
    );
  }

  const activePlansCount = carePlans.filter(p => p.status === 'active').length;
  const activeTeamsCount = careTeams.filter(t => t.status === 'active').length;

  return (
    <Box sx={{ p: 3 }}>
      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <CarePlanIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4">{activePlansCount}</Typography>
            <Typography variant="body2" color="text.secondary">
              Active Care Plans
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <CareTeamIcon color="secondary" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4">{activeTeamsCount}</Typography>
            <Typography variant="body2" color="text.secondary">
              Active Care Teams
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <GoalIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4">
              {carePlans.reduce((acc, plan) => acc + (plan.goal?.length || 0), 0)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Active Goals
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <TaskIcon color="warning" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4">
              {carePlans.reduce((acc, plan) => acc + (plan.activity?.length || 0), 0)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Activities
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Care Plans Section */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <CarePlansSection 
            carePlans={carePlans}
            patientId={patientId}
            onRefresh={fetchCareManagementData}
          />
        </Grid>

        {/* Care Team Section */}
        <Grid item xs={12}>
          <CareTeamSection 
            careTeams={careTeams}
            patientId={patientId}
            onRefresh={fetchCareManagementData}
          />
        </Grid>

        {/* Goals & Tasks Section */}
        <Grid item xs={12}>
          <GoalsTasksSection 
            carePlans={carePlans}
            patientId={patientId}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default CareManagementTab;