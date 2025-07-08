/**
 * Tasks Tab Component
 * Clinical task management and tracking
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
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  FormControl,
  InputLabel,
  MenuItem,
  Chip,
  Alert,
  Card,
  CardContent,
  Checkbox,
  LinearProgress,
  Fab
} from '@mui/material';
import {
  Add as AddIcon,
  Assignment as TaskIcon,
  CheckCircle as CompleteIcon,
  Schedule as PendingIcon,
  Flag as FlagIcon,
  Person as AssigneeIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useTask } from '../../../contexts/TaskContext';
import { useClinical } from '../../../contexts/ClinicalContext';
import api from '../../../services/api';

const TasksTab = () => {
  const { currentPatient } = useClinical();
  const { tasks, taskStats, loadTasks, loadTaskStats } = useTask();
  const [newTaskDialog, setNewTaskDialog] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium',
    status: 'pending',
    due_date: '',
    assignee: ''
  });

  useEffect(() => {
    if (currentPatient) {
      loadTasks({ patient_id: currentPatient.id });
      loadTaskStats();
    }
  }, [currentPatient]);

  const handleCreateTask = async () => {
    try {
      await api.post('/api/clinical/tasks/', {
        ...newTask,
        patient_id: currentPatient.id
      });
      setNewTaskDialog(false);
      setNewTask({
        title: '',
        description: '',
        priority: 'medium',
        status: 'pending',
        due_date: '',
        assignee: ''
      });
      loadTasks({ patient_id: currentPatient.id });
      loadTaskStats();
    } catch (error) {
      
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      await api.put(`/api/clinical/tasks/${taskId}`, {
        status: 'completed'
      });
      loadTasks({ patient_id: currentPatient.id });
      loadTaskStats();
    } catch (error) {
      
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CompleteIcon color="success" />;
      case 'in-progress':
        return <PendingIcon color="primary" />;
      case 'pending':
        return <TaskIcon color="action" />;
      default:
        return <TaskIcon />;
    }
  };

  const filteredTasks = tasks?.filter(task => {
    if (selectedFilter === 'all') return true;
    return task.status === selectedFilter;
  }) || [];

  const completedTasks = tasks?.filter(task => task.status === 'completed').length || 0;
  const totalTasks = tasks?.length || 0;
  const completionPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">
          Task Management
        </Typography>
        <Fab
          color="primary"
          size="medium"
          onClick={() => setNewTaskDialog(true)}
        >
          <AddIcon />
        </Fab>
      </Box>

      <Grid container spacing={3}>
        {/* Task Stats */}
        <Grid item xs={12}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {taskStats?.total || totalTasks}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Tasks
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main">
                    {completedTasks}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Completed
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="warning.main">
                    {totalTasks - completedTasks}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pending
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="text.primary">
                    {Math.round(completionPercentage)}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Complete
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={completionPercentage} 
                    sx={{ mt: 1 }}
                  />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>

        {/* Task Filters */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label="All"
                variant={selectedFilter === 'all' ? 'filled' : 'outlined'}
                onClick={() => setSelectedFilter('all')}
                color="primary"
              />
              <Chip
                label="Pending"
                variant={selectedFilter === 'pending' ? 'filled' : 'outlined'}
                onClick={() => setSelectedFilter('pending')}
                color="warning"
              />
              <Chip
                label="In Progress"
                variant={selectedFilter === 'in-progress' ? 'filled' : 'outlined'}
                onClick={() => setSelectedFilter('in-progress')}
                color="info"
              />
              <Chip
                label="Completed"
                variant={selectedFilter === 'completed' ? 'filled' : 'outlined'}
                onClick={() => setSelectedFilter('completed')}
                color="success"
              />
            </Box>
          </Paper>
        </Grid>

        {/* Tasks List */}
        <Grid item xs={12}>
          <Paper>
            {filteredTasks.length > 0 ? (
              <List>
                {filteredTasks.map((task, index) => (
                  <ListItem key={task.id || index} divider>
                    <ListItemIcon>
                      <Checkbox
                        checked={task.status === 'completed'}
                        onChange={() => handleCompleteTask(task.id)}
                        disabled={task.status === 'completed'}
                      />
                    </ListItemIcon>
                    <ListItemIcon>
                      {getStatusIcon(task.status)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography 
                            variant="subtitle1"
                            sx={{ 
                              textDecoration: task.status === 'completed' ? 'line-through' : 'none'
                            }}
                          >
                            {task.title}
                          </Typography>
                          <Chip 
                            label={task.priority} 
                            size="small" 
                            color={getPriorityColor(task.priority)}
                          />
                          <Chip 
                            label={task.status} 
                            size="small" 
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {task.description}
                          </Typography>
                          {task.due_date && (
                            <Typography variant="caption" color="text.secondary">
                              Due: {new Date(task.due_date).toLocaleDateString()}
                            </Typography>
                          )}
                          {task.assignee && (
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                              Assignee: {task.assignee}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                    <IconButton size="small">
                      <EditIcon />
                    </IconButton>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <TaskIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No {selectedFilter === 'all' ? '' : selectedFilter} tasks
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedFilter === 'all' 
                    ? 'No tasks found for this patient.'
                    : `No ${selectedFilter} tasks found.`
                  }
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* New Task Dialog */}
      <Dialog open={newTaskDialog} onClose={() => setNewTaskDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Task</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              fullWidth
              label="Task Title"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              required
            />

            <TextField
              fullWidth
              label="Description"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              multiline
              rows={3}
            />

            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={newTask.priority}
                label="Priority"
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Due Date"
              type="date"
              value={newTask.due_date}
              onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
              InputLabelProps={{
                shrink: true,
              }}
            />

            <TextField
              fullWidth
              label="Assignee"
              value={newTask.assignee}
              onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
              placeholder="Provider name or ID"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewTaskDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateTask} 
            variant="contained"
            disabled={!newTask.title}
          >
            Create Task
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TasksTab;