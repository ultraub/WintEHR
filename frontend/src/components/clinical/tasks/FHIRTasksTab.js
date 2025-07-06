/**
 * FHIR Tasks Tab Component
 * Manages clinical tasks using FHIR Task resources
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  Card,
  CardContent,
  CardActions,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Grid,
  Checkbox,
  FormControlLabel,
  Divider,
  Menu,
  ListItemButton,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Add as AddIcon,
  Assignment as TaskIcon,
  CheckCircle as CompletedIcon,
  Schedule as PendingIcon,
  PlayArrow as InProgressIcon,
  Cancel as CancelledIcon,
  Warning as WarningIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  Person as PersonIcon,
  LocalHospital as ClinicalIcon,
  AdminPanelSettings as AdminIcon
} from '@mui/icons-material';
import { format, isAfter, isBefore, parseISO } from 'date-fns';
import { useClinical } from '../../../contexts/ClinicalContext';
import { fhirClient } from '../../../services/fhirClient';

const FHIRTasksTab = () => {
  const { currentPatient, currentEncounter } = useClinical();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [filter, setFilter] = useState('all');
  const [newTask, setNewTask] = useState({
    description: '',
    priority: 'routine',
    status: 'requested',
    intent: 'order',
    category: 'clinical',
    dueDate: '',
    notes: '',
    assignee: ''
  });

  useEffect(() => {
    if (currentPatient) {
      loadTasks();
    }
  }, [currentPatient?.id]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      // Load patient-specific tasks
      const patientTasks = await fhirClient.search('Task', {
        patient: currentPatient.id,
        _sort: '-authored-on',
        _count: 100
      });

      // Also load tasks assigned to the patient (as owner)
      const ownerTasks = await fhirClient.search('Task', {
        owner: `Patient/${currentPatient.id}`,
        _sort: '-authored-on',
        _count: 100
      });

      // Combine and deduplicate
      const allTasks = [...(patientTasks.resources || []), ...(ownerTasks.resources || [])];
      const uniqueTasks = Array.from(new Map(allTasks.map(t => [t.id, t])).values());

      const transformedTasks = uniqueTasks.map(transformFHIRTask);
      setTasks(transformedTasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const transformFHIRTask = (task) => ({
    id: task.id,
    description: task.description || task.code?.text || 'Unnamed Task',
    status: task.status,
    priority: task.priority || 'routine',
    intent: task.intent,
    category: task.businessStatus?.text || 
              task.code?.coding?.[0]?.code || 
              'clinical',
    authoredOn: task.authoredOn,
    lastModified: task.lastModified,
    dueDate: task.restriction?.period?.end,
    completedDate: task.executionPeriod?.end,
    focus: task.focus,
    for: task.for,
    owner: task.owner,
    assignee: task.owner?.display || 'Unassigned',
    notes: task.note?.[0]?.text || '',
    reasonCode: task.reasonCode?.text || task.reasonCode?.coding?.[0]?.display,
    encounter: task.encounter
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CompletedIcon color="success" />;
      case 'in-progress':
        return <InProgressIcon color="primary" />;
      case 'requested':
      case 'received':
      case 'accepted':
        return <PendingIcon color="action" />;
      case 'cancelled':
      case 'rejected':
      case 'failed':
        return <CancelledIcon color="error" />;
      default:
        return <TaskIcon />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
      case 'stat':
        return 'error';
      case 'asap':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'clinical':
        return <ClinicalIcon fontSize="small" />;
      case 'administrative':
        return <AdminIcon fontSize="small" />;
      default:
        return <TaskIcon fontSize="small" />;
    }
  };

  const isOverdue = (task) => {
    return task.dueDate && 
           task.status !== 'completed' && 
           task.status !== 'cancelled' &&
           isBefore(parseISO(task.dueDate), new Date());
  };

  const handleCreateTask = async () => {
    try {
      const fhirTask = {
        resourceType: 'Task',
        status: newTask.status,
        intent: newTask.intent,
        priority: newTask.priority,
        description: newTask.description,
        for: fhirClient.reference('Patient', currentPatient.id),
        encounter: currentEncounter ? 
          fhirClient.reference('Encounter', currentEncounter.id) : undefined,
        authoredOn: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        businessStatus: {
          text: newTask.category
        },
        restriction: newTask.dueDate ? {
          period: {
            end: new Date(newTask.dueDate).toISOString()
          }
        } : undefined,
        note: newTask.notes ? [{
          text: newTask.notes,
          time: new Date().toISOString()
        }] : undefined,
        owner: newTask.assignee ? {
          display: newTask.assignee
        } : undefined
      };

      await fhirClient.create('Task', fhirTask);
      await loadTasks();
      setShowNewTaskDialog(false);
      resetNewTask();
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task: ' + error.message);
    }
  };

  const handleUpdateTaskStatus = async (task, newStatus) => {
    try {
      const fhirTask = await fhirClient.read('Task', task.id);
      fhirTask.status = newStatus;
      fhirTask.lastModified = new Date().toISOString();
      
      if (newStatus === 'completed') {
        fhirTask.executionPeriod = {
          ...(fhirTask.executionPeriod || {}),
          end: new Date().toISOString()
        };
      }

      await fhirClient.update('Task', task.id, fhirTask);
      await loadTasks();
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task: ' + error.message);
    }
  };

  const handleDeleteTask = async (task) => {
    if (!window.confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      await fhirClient.delete('Task', task.id);
      await loadTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task: ' + error.message);
    }
  };

  const resetNewTask = () => {
    setNewTask({
      description: '',
      priority: 'routine',
      status: 'requested',
      intent: 'order',
      category: 'clinical',
      dueDate: '',
      notes: '',
      assignee: ''
    });
  };

  const filteredTasks = tasks.filter(task => {
    switch (filter) {
      case 'active':
        return ['requested', 'received', 'accepted', 'in-progress'].includes(task.status);
      case 'completed':
        return task.status === 'completed';
      case 'overdue':
        return isOverdue(task);
      default:
        return true;
    }
  });

  const groupedTasks = {
    overdue: filteredTasks.filter(isOverdue),
    today: filteredTasks.filter(t => !isOverdue(t) && t.dueDate && 
      format(parseISO(t.dueDate), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')),
    upcoming: filteredTasks.filter(t => !isOverdue(t) && t.dueDate && 
      isAfter(parseISO(t.dueDate), new Date())),
    noDueDate: filteredTasks.filter(t => !t.dueDate)
  };

  const renderTaskCard = (task) => (
    <Card key={task.id} sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              {getStatusIcon(task.status)}
              <Typography variant="h6" component="div">
                {task.description}
              </Typography>
            </Box>
            
            <Box display="flex" gap={1} mb={1}>
              <Chip
                icon={getCategoryIcon(task.category)}
                label={task.category}
                size="small"
                variant="outlined"
              />
              <Chip
                label={task.priority}
                size="small"
                color={getPriorityColor(task.priority)}
              />
              {isOverdue(task) && (
                <Chip
                  icon={<WarningIcon />}
                  label="Overdue"
                  size="small"
                  color="error"
                />
              )}
            </Box>

            {task.notes && (
              <Typography variant="body2" color="text.secondary" paragraph>
                {task.notes}
              </Typography>
            )}

            <Box display="flex" gap={2} flexWrap="wrap">
              {task.dueDate && (
                <Typography variant="caption" color="text.secondary">
                  Due: {format(parseISO(task.dueDate), 'MMM d, yyyy')}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                Assigned to: {task.assignee}
              </Typography>
              {task.completedDate && (
                <Typography variant="caption" color="text.secondary">
                  Completed: {format(parseISO(task.completedDate), 'MMM d, yyyy')}
                </Typography>
              )}
            </Box>
          </Box>

          <Box>
            <IconButton
              size="small"
              onClick={(e) => {
                setSelectedTask(task);
                setAnchorEl(e.currentTarget);
              }}
            >
              <MoreIcon />
            </IconButton>
          </Box>
        </Box>
      </CardContent>
      <CardActions>
        {task.status !== 'completed' && task.status !== 'cancelled' && (
          <>
            {task.status === 'requested' && (
              <Button
                size="small"
                onClick={() => handleUpdateTaskStatus(task, 'in-progress')}
              >
                Start
              </Button>
            )}
            {task.status === 'in-progress' && (
              <Button
                size="small"
                color="success"
                onClick={() => handleUpdateTaskStatus(task, 'completed')}
              >
                Complete
              </Button>
            )}
            <Button
              size="small"
              color="error"
              onClick={() => handleUpdateTaskStatus(task, 'cancelled')}
            >
              Cancel
            </Button>
          </>
        )}
      </CardActions>
    </Card>
  );

  const renderTaskGroup = (title, tasks, icon) => {
    if (tasks.length === 0) return null;

    return (
      <Box mb={3}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          {icon}
          <Typography variant="h6">{title} ({tasks.length})</Typography>
        </Box>
        {tasks.map(renderTaskCard)}
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Tasks</Typography>
        <Box display="flex" gap={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Filter</InputLabel>
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              label="Filter"
            >
              <MenuItem value="all">All Tasks</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="overdue">Overdue</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowNewTaskDialog(true)}
          >
            New Task
          </Button>
        </Box>
      </Box>

      {loading ? (
        <Typography>Loading tasks...</Typography>
      ) : filteredTasks.length === 0 ? (
        <Alert severity="info">
          No tasks found. Create a new task to get started.
        </Alert>
      ) : (
        <>
          {renderTaskGroup('Overdue', groupedTasks.overdue, <WarningIcon color="error" />)}
          {renderTaskGroup('Due Today', groupedTasks.today, <TaskIcon color="primary" />)}
          {renderTaskGroup('Upcoming', groupedTasks.upcoming, <PendingIcon color="action" />)}
          {renderTaskGroup('No Due Date', groupedTasks.noDueDate, <TaskIcon />)}
        </>
      )}

      {/* Task Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => {
          setAnchorEl(null);
          handleDeleteTask(selectedTask);
        }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete Task</ListItemText>
        </MenuItem>
      </Menu>

      {/* New Task Dialog */}
      <Dialog
        open={showNewTaskDialog}
        onClose={() => setShowNewTaskDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Task</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Task Description"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                required
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={newTask.category}
                  onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                  label="Category"
                >
                  <MenuItem value="clinical">Clinical</MenuItem>
                  <MenuItem value="administrative">Administrative</MenuItem>
                  <MenuItem value="follow-up">Follow-up</MenuItem>
                  <MenuItem value="referral">Referral</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                  label="Priority"
                >
                  <MenuItem value="routine">Routine</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                  <MenuItem value="asap">ASAP</MenuItem>
                  <MenuItem value="stat">STAT</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="date"
                label="Due Date"
                value={newTask.dueDate}
                onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Assign To"
                value={newTask.assignee}
                onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
                placeholder="Enter assignee name"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                value={newTask.notes}
                onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })}
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowNewTaskDialog(false);
            resetNewTask();
          }}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateTask}
            variant="contained"
            disabled={!newTask.description}
          >
            Create Task
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FHIRTasksTab;