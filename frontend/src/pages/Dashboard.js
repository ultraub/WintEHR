import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
  Button,
  IconButton,
  Badge,
  Divider,
} from '@mui/material';
import {
  People as PeopleIcon,
  EventNote as EventNoteIcon,
  LocalHospital as HospitalIcon,
  TrendingUp as TrendingUpIcon,
  AccessTime as AccessTimeIcon,
  Person as PersonIcon,
  Assignment as TaskIcon,
  Science as LabIcon,
  Warning as AlertIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
  ArrowForward as ArrowForwardIcon,
  Notifications as NotificationsIcon,
  Assessment as AssessmentIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { format, isToday, startOfDay, endOfDay } from 'date-fns';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const COLORS = ['#E91E63', '#7C4DFF', '#FFBB28', '#FF8042', '#F48FB1'];

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [todaysSchedule, setTodaysSchedule] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [criticalAlerts, setCriticalAlerts] = useState([]);
  const [recentLabResults, setRecentLabResults] = useState([]);
  const [qualityMetrics, setQualityMetrics] = useState(null);
  const [encounterTrends, setEncounterTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const promises = [
        api.get('/api/dashboard/stats'),
        api.get('/api/dashboard/recent-activity'),
        api.get('/api/dashboard/encounter-trends'),
      ];

      // Add provider-specific data if logged in
      if (currentUser?.id) {
        promises.push(
          api.get('/api/encounters', {
            params: {
              start_date: startOfDay(new Date()).toISOString(),
              end_date: endOfDay(new Date()).toISOString(),
              provider_id: currentUser.id
            }
          }),
          api.get('/api/tasks', {
            params: {
              assigned_to: currentUser.id,
              status: 'pending',
              limit: 5
            }
          }),
          api.get('/api/clinical/alerts', {
            params: {
              provider_id: currentUser.id,
              severity: 'critical',
              acknowledged: false
            }
          }),
          api.get('/api/lab-results', {
            params: {
              status: 'final',
              reviewed: false,
              limit: 10
            }
          }),
          api.get('/api/quality/measures/summary')
        );
      }

      const results = await Promise.all(promises);
      
      setStats(results[0].data);
      setRecentActivity(results[1].data);
      setEncounterTrends(results[2].data);
      
      if (currentUser?.id) {
        setTodaysSchedule(results[3]?.data || []);
        setPendingTasks(results[4]?.data || []);
        setCriticalAlerts(results[5]?.data || []);
        setRecentLabResults(results[6]?.data || []);
        setQualityMetrics(results[7]?.data || null);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  const statCards = currentUser ? [
    {
      title: 'My Patients',
      value: stats?.my_patients || 0,
      icon: <PeopleIcon />,
      color: '#1976d2',
      action: () => navigate('/patients'),
    },
    {
      title: "Today's Appointments",
      value: todaysSchedule.length,
      icon: <ScheduleIcon />,
      color: '#388e3c',
      subtitle: 'View Schedule',
      action: () => navigate('/encounters'),
    },
    {
      title: 'Pending Tasks',
      value: pendingTasks.length,
      icon: <TaskIcon />,
      color: '#f57c00',
      subtitle: 'Requires action',
      action: () => navigate('/clinical/workspace', { state: { tab: 'tasks' } }),
    },
    {
      title: 'Unreviewed Labs',
      value: recentLabResults.length,
      icon: <LabIcon />,
      color: '#d32f2f',
      subtitle: 'Need review',
      action: () => navigate('/lab-results'),
    },
  ] : [
    {
      title: 'Total Patients',
      value: stats?.total_patients || 0,
      icon: <PeopleIcon />,
      color: '#1976d2',
    },
    {
      title: 'Total Encounters',
      value: stats?.total_encounters || 0,
      icon: <EventNoteIcon />,
      color: '#388e3c',
    },
    {
      title: 'Active Providers',
      value: stats?.active_providers || 0,
      icon: <HospitalIcon />,
      color: '#f57c00',
    },
    {
      title: 'Recent Encounters',
      value: stats?.recent_encounters || 0,
      icon: <TrendingUpIcon />,
      color: '#d32f2f',
      subtitle: 'Last 7 days',
    },
  ];

  return (
    <div>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <div>
          <Typography variant="h4" gutterBottom>
            {currentUser ? `Welcome back, Dr. ${currentUser.name}` : 'Dashboard'}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </Typography>
        </div>
        {criticalAlerts.length > 0 && (
          <Badge badgeContent={criticalAlerts.length} color="error">
            <IconButton color="error" onClick={() => navigate('/alerts')}>
              <NotificationsIcon />
            </IconButton>
          </Badge>
        )}
      </Box>

      {/* Critical Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="body2">
            You have {criticalAlerts.length} critical alert{criticalAlerts.length > 1 ? 's' : ''} requiring immediate attention
          </Typography>
        </Alert>
      )}
      
      <Grid container spacing={3}>
        {/* Stat Cards */}
        {statCards.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card 
              sx={{ 
                height: '100%', 
                cursor: stat.action ? 'pointer' : 'default',
                '&:hover': stat.action ? { boxShadow: 4 } : {} 
              }}
              onClick={stat.action}
            >
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      {stat.title}
                    </Typography>
                    <Typography variant="h4" component="div">
                      {stat.value}
                    </Typography>
                    {stat.subtitle && (
                      <Typography variant="caption" color="textSecondary">
                        {stat.subtitle}
                      </Typography>
                    )}
                  </Box>
                  <Avatar sx={{ bgcolor: stat.color, width: 56, height: 56 }}>
                    {stat.icon}
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}

        {/* Encounter Trends Chart */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, height: '300px' }}>
            <Typography variant="h6" gutterBottom>
              {currentUser ? 'My Patient Encounters (Last 30 Days)' : 'Patient Encounters (Last 30 Days)'}
            </Typography>
            <ResponsiveContainer width="100%" height="85%">
              <LineChart data={encounterTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => format(new Date(date), 'MMM d')}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')}
                  formatter={(value) => [`${value} encounters`, 'Count']}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#E91E63" 
                  strokeWidth={2}
                  dot={{ fill: '#E91E63', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Today's Schedule */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '400px' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Today's Schedule</Typography>
              <Button 
                size="small" 
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/encounters')}
              >
                View All
              </Button>
            </Box>
            <List sx={{ maxHeight: '320px', overflow: 'auto' }}>
              {todaysSchedule.length > 0 ? (
                todaysSchedule.map((appointment, index) => (
                  <ListItem 
                    key={index} 
                    alignItems="flex-start"
                    sx={{ 
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                    onClick={() => navigate(`/encounters/${appointment.id}`)}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: appointment.status === 'completed' ? '#4caf50' : '#ff9800' }}>
                        <PersonIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body1">
                            {appointment.patient_name || 'Unknown Patient'}
                          </Typography>
                          <Chip 
                            label={format(new Date(appointment.encounter_date), 'h:mm a')}
                            size="small"
                            color={appointment.status === 'completed' ? 'success' : 'warning'}
                          />
                        </Box>
                      }
                      secondary={
                        <React.Fragment>
                          <Typography component="span" variant="body2" color="text.primary">
                            {appointment.encounter_type || 'Office Visit'}
                          </Typography>
                          {appointment.chief_complaint && (
                            <>
                              {' — '}
                              {appointment.chief_complaint}
                            </>
                          )}
                        </React.Fragment>
                      }
                    />
                  </ListItem>
                ))
              ) : (
                <Box display="flex" justifyContent="center" alignItems="center" height="300px">
                  <Typography color="textSecondary">No appointments scheduled for today</Typography>
                </Box>
              )}
            </List>
          </Paper>
        </Grid>

        {/* Pending Tasks & Orders */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '400px' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Pending Tasks</Typography>
              <Button 
                size="small" 
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/clinical/workspace', { state: { tab: 'tasks' } })}
              >
                View All
              </Button>
            </Box>
            <List sx={{ maxHeight: '320px', overflow: 'auto' }}>
              {pendingTasks.length > 0 ? (
                pendingTasks.map((task, index) => (
                  <ListItem key={index} alignItems="flex-start">
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: task.priority === 'high' ? '#f44336' : '#ff9800' }}>
                        <TaskIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="body1">{task.title}</Typography>
                          <Chip 
                            label={task.priority}
                            size="small"
                            color={task.priority === 'high' ? 'error' : 'warning'}
                          />
                        </Box>
                      }
                      secondary={
                        <React.Fragment>
                          <Typography component="span" variant="body2" color="text.primary">
                            {task.patient_name}
                          </Typography>
                          {task.due_date && (
                            <>
                              {' — Due: '}
                              {format(new Date(task.due_date), 'MMM d')}
                            </>
                          )}
                        </React.Fragment>
                      }
                    />
                  </ListItem>
                ))
              ) : (
                <Box display="flex" justifyContent="center" alignItems="center" height="300px">
                  <Typography color="textSecondary">No pending tasks</Typography>
                </Box>
              )}
            </List>
          </Paper>
        </Grid>

        {/* Quality Metrics Summary */}
        {currentUser && qualityMetrics && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Quality Metrics</Typography>
                <Button 
                  size="small" 
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => navigate('/quality-measures')}
                >
                  View Details
                </Button>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="primary">
                        {qualityMetrics.overall_score || 0}%
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Overall Score
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="success.main">
                        {qualityMetrics.measures_met || 0}/{qualityMetrics.total_measures || 0}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Measures Met
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              {qualityMetrics.top_measures && (
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>Performance by Measure</Typography>
                  {qualityMetrics.top_measures.slice(0, 3).map((measure, index) => (
                    <Box key={index} mb={1}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2">{measure.name}</Typography>
                        <Typography variant="body2" color={measure.score >= measure.target ? 'success.main' : 'error.main'}>
                          {measure.score}%
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          </Grid>
        )}

        {/* Recent Lab Results */}
        {currentUser && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Recent Lab Results</Typography>
                <Button 
                  size="small" 
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => navigate('/lab-results')}
                >
                  View All
                </Button>
              </Box>
              <List>
                {recentLabResults.length > 0 ? (
                  recentLabResults.slice(0, 5).map((lab, index) => (
                    <ListItem key={index} divider={index < 4}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: lab.abnormal_flag ? '#f44336' : '#4caf50' }}>
                          <LabIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box display="flex" justifyContent="space-between">
                            <Typography variant="body2">{lab.test_name}</Typography>
                            {lab.abnormal_flag && (
                              <Chip label="Abnormal" size="small" color="error" />
                            )}
                          </Box>
                        }
                        secondary={
                          <React.Fragment>
                            <Typography component="span" variant="caption">
                              {lab.patient_name} — {format(new Date(lab.collection_date), 'MMM d')}
                            </Typography>
                          </React.Fragment>
                        }
                      />
                    </ListItem>
                  ))
                ) : (
                  <Box display="flex" justifyContent="center" alignItems="center" height="200px">
                    <Typography color="textSecondary">No unreviewed lab results</Typography>
                  </Box>
                )}
              </List>
            </Paper>
          </Grid>
        )}

        {/* Quick Actions */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Grid container spacing={2}>
              <Grid item>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => navigate('/patients/new')}
                >
                  New Patient
                </Button>
              </Grid>
              <Grid item>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<EventNoteIcon />}
                  onClick={() => navigate('/encounters/new')}
                >
                  Schedule Appointment
                </Button>
              </Grid>
              <Grid item>
                <Button
                  variant="outlined"
                  startIcon={<LabIcon />}
                  onClick={() => navigate('/lab-results/new')}
                >
                  Enter Lab Results
                </Button>
              </Grid>
              <Grid item>
                <Button
                  variant="outlined"
                  startIcon={<TaskIcon />}
                  onClick={() => navigate('/clinical/workspace', { state: { tab: 'tasks', action: 'new' } })}
                >
                  Create Task
                </Button>
              </Grid>
              <Grid item>
                <Button
                  variant="outlined"
                  startIcon={<AssessmentIcon />}
                  onClick={() => navigate('/quality-measures')}
                >
                  Quality Reports
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </div>
  );
}

export default Dashboard;