/**
 * Task Context Provider
 * Manages clinical tasks using FHIR Task resources, inbox, and care team functionality
 */
import React, { createContext, useContext, useState } from 'react';
import api from '../services/api';
import { fhirClient } from '../services/fhirClient';
import { useClinical } from './ClinicalContext';
import { useFHIRResource } from './FHIRResourceContext';

const TaskContext = createContext(undefined);

export const useTask = () => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTask must be used within a TaskProvider');
  }
  return context;
};

export const TaskProvider = ({ children }) => {
  const { currentPatient } = useClinical();
  const { refreshPatientResources } = useFHIRResource();
  const [inboxItems, setInboxItems] = useState([]);
  const [inboxStats, setInboxStats] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [taskStats, setTaskStats] = useState(null);
  const [careTeams, setCareTeams] = useState([]);
  const [patientLists, setPatientLists] = useState([]);

  // Transform FHIR Task to internal format
  const transformFHIRTask = (fhirTask) => {
    return {
      id: fhirTask.id,
      status: fhirTask.status,
      priority: fhirTask.priority || 'routine',
      intent: fhirTask.intent,
      taskType: fhirTask.code?.coding?.[0]?.code || 'review',
      taskTypeDisplay: fhirTask.code?.text || fhirTask.code?.coding?.[0]?.display,
      description: fhirTask.description,
      patientId: fhirTask.for?.reference?.split('/')[1],
      encounterId: fhirTask.encounter?.reference?.split('/')[1],
      assignedTo: fhirTask.owner?.reference?.split('/')[1],
      createdBy: fhirTask.requester?.reference?.split('/')[1],
      createdAt: fhirTask.authoredOn,
      updatedAt: fhirTask.lastModified,
      dueDate: fhirTask.restriction?.period?.end,
      reason: fhirTask.reasonCode?.text,
      businessStatus: fhirTask.businessStatus?.text,
      notes: fhirTask.note?.map(n => ({
        text: n.text,
        createdAt: n.time,
        createdBy: n.authorReference?.reference?.split('/')[1]
      })) || [],
      startDate: fhirTask.executionPeriod?.start,
      completedDate: fhirTask.executionPeriod?.end
    };
  };

  // Transform internal task to FHIR Task
  const transformToFHIRTask = (task) => {
    const fhirTask = {
      resourceType: 'Task',
      status: task.status || 'requested',
      intent: task.intent || 'order',
      priority: task.priority || 'routine',
      authoredOn: task.createdAt || new Date().toISOString()
    };

    // Set task type/code
    if (task.taskType || task.code) {
      fhirTask.code = {
        coding: [{
          system: 'http://medgenemr.com/task-type',
          code: task.taskType || task.code || 'review',
          display: task.taskTypeDisplay || getTaskTypeDisplay(task.taskType)
        }]
      };
      if (task.description) {
        fhirTask.code.text = task.description;
      }
    }

    // Set description
    if (task.description) {
      fhirTask.description = task.description;
    }

    // Set patient reference
    if (task.patientId) {
      fhirTask.for = { reference: `Patient/${task.patientId}` };
    }

    // Set encounter reference
    if (task.encounterId) {
      fhirTask.encounter = { reference: `Encounter/${task.encounterId}` };
    }

    // Set owner (assigned to)
    if (task.assignedTo) {
      fhirTask.owner = { reference: `Practitioner/${task.assignedTo}` };
    }

    // Set requester (created by)
    if (task.createdBy) {
      fhirTask.requester = { reference: `Practitioner/${task.createdBy}` };
    }

    // Set due date
    if (task.dueDate) {
      fhirTask.restriction = {
        period: { end: task.dueDate }
      };
    }

    // Set reason
    if (task.reason) {
      fhirTask.reasonCode = { text: task.reason };
    }

    // Set business status
    if (task.businessStatus) {
      fhirTask.businessStatus = { text: task.businessStatus };
    }

    // Set notes
    if (task.notes && task.notes.length > 0) {
      fhirTask.note = task.notes.map(note => {
        const fhirNote = { text: note.text };
        if (note.createdAt) fhirNote.time = note.createdAt;
        if (note.createdBy) fhirNote.authorReference = { reference: `Practitioner/${note.createdBy}` };
        return fhirNote;
      });
    }

    // Set execution period
    if (task.startDate || task.completedDate) {
      fhirTask.executionPeriod = {};
      if (task.startDate) fhirTask.executionPeriod.start = task.startDate;
      if (task.completedDate) fhirTask.executionPeriod.end = task.completedDate;
    }

    if (task.id) {
      fhirTask.id = task.id;
    }

    return fhirTask;
  };

  // Helper to get task type display
  const getTaskTypeDisplay = (taskType) => {
    const displays = {
      'review': 'Review',
      'follow-up': 'Follow-up',
      'lab-review': 'Lab Review',
      'med-recon': 'Medication Reconciliation',
      'prior-auth': 'Prior Authorization',
      'outreach': 'Patient Outreach',
      'referral': 'Referral',
      'documentation': 'Documentation'
    };
    return displays[taskType] || 'Task';
  };

  // Inbox methods
  const loadInboxItems = async (filters) => {
    try {
      const response = await api.get('/api/clinical/inbox/', { params: filters });
      setInboxItems(response.data);
    } catch (error) {
      // Inbox endpoints not available - set empty state for graceful degradation
      if (error.response?.status === 404) {
        setInboxItems([]);
        return;
      }
      throw error;
    }
  };

  const loadInboxStats = async () => {
    try {
      const response = await api.get('/api/clinical/inbox/stats');
      setInboxStats(response.data);
    } catch (error) {
      // Inbox stats endpoint not available - set empty state for graceful degradation
      if (error.response?.status === 404) {
        setInboxStats({ total: 0, unread: 0, urgent: 0 });
        return;
      }
      throw error;
    }
  };

  const markInboxItemRead = async (itemId) => {
    try {
      await api.get(`/api/clinical/inbox/${itemId}`);
      await loadInboxItems();
      await loadInboxStats();
    } catch (error) {
      
      throw error;
    }
  };

  const acknowledgeInboxItems = async (itemIds) => {
    try {
      await api.post('/api/clinical/inbox/bulk-action', {
        action: 'acknowledge',
        item_ids: itemIds
      });
      await loadInboxItems();
      await loadInboxStats();
    } catch (error) {
      
      throw error;
    }
  };

  const forwardInboxItems = async (itemIds, recipientId, note) => {
    try {
      await api.post('/api/clinical/inbox/bulk-action', {
        action: 'forward',
        item_ids: itemIds,
        forward_to_id: recipientId,
        forward_note: note
      });
      await loadInboxItems();
    } catch (error) {
      
      throw error;
    }
  };

  const createTaskFromInbox = async (itemId, taskData) => {
    try {
      await api.post('/api/clinical/inbox/create-task', {
        item_id: itemId,
        ...taskData
      });
      await loadInboxItems();
      await loadTasks();
    } catch (error) {
      
      throw error;
    }
  };

  // Task methods
  const loadTasks = async (filters = {}) => {
    try {
      const searchParams = {};
      
      // Map filters to FHIR search parameters
      if (filters.patient_id) {
        searchParams.patient = filters.patient_id;
      }
      if (filters.status) {
        searchParams.status = filters.status;
      }
      if (filters.priority) {
        searchParams.priority = filters.priority;
      }
      if (filters.assigned_to) {
        searchParams.owner = `Practitioner/${filters.assigned_to}`;
      }
      if (filters.due_before) {
        searchParams.period = `le${filters.due_before}`;
      }
      
      searchParams._sort = '-authored-on';
      searchParams._count = filters.limit || 50;
      
      const result = await fhirClient.search('Task', searchParams);
      const tasks = (result.resources || []).map(transformFHIRTask);
      setTasks(tasks);
    } catch (error) {
      
      throw error;
    }
  };

  const loadTaskStats = async () => {
    try {
      // Get task counts by status
      const statuses = ['requested', 'accepted', 'in-progress', 'completed', 'cancelled'];
      const counts = {};
      
      // Get counts for each status
      await Promise.all(statuses.map(async (status) => {
        const result = await fhirClient.search('Task', {
          status,
          _summary: 'count'
        });
        counts[status] = result.total || 0;
      }));
      
      // Calculate stats
      const stats = {
        total: Object.values(counts).reduce((sum, count) => sum + count, 0),
        pending: counts['requested'] || 0,
        in_progress: (counts['accepted'] || 0) + (counts['in-progress'] || 0),
        completed: counts['completed'] || 0,
        overdue: 0 // Would need to query with date filter
      };
      
      setTaskStats(stats);
    } catch (error) {
      
      throw error;
    }
  };

  const createTask = async (taskData) => {
    try {
      const fhirTask = transformToFHIRTask(taskData);
      const result = await fhirClient.create('Task', fhirTask);
      
      // Refresh patient resources to update all contexts
      if (currentPatient?.id) {
        await refreshPatientResources(currentPatient.id);
      }
      
      await loadTasks();
      await loadTaskStats();
      
      return { ...taskData, id: result.id };
    } catch (error) {
      
      throw error;
    }
  };

  const updateTask = async (taskId, updates) => {
    try {
      // Get current task
      const currentFhirTask = await fhirClient.read('Task', taskId);
      const currentTask = transformFHIRTask(currentFhirTask);
      
      // Merge updates
      const updatedTask = { ...currentTask, ...updates };
      
      // Transform to FHIR and update
      const fhirTask = transformToFHIRTask(updatedTask);
      await fhirClient.update('Task', taskId, fhirTask);
      
      // Refresh patient resources to update all contexts
      if (currentPatient?.id) {
        await refreshPatientResources(currentPatient.id);
      }
      
      await loadTasks();
      await loadTaskStats();
    } catch (error) {
      
      throw error;
    }
  };

  const completeTask = async (taskId, completionNotes) => {
    try {
      // Get current task
      const currentFhirTask = await fhirClient.read('Task', taskId);
      
      // Update status to completed
      currentFhirTask.status = 'completed';
      currentFhirTask.lastModified = new Date().toISOString();
      
      // Set completion date
      if (!currentFhirTask.executionPeriod) {
        currentFhirTask.executionPeriod = {};
      }
      currentFhirTask.executionPeriod.end = new Date().toISOString();
      
      // Add completion notes
      if (completionNotes?.notes) {
        if (!currentFhirTask.note) currentFhirTask.note = [];
        currentFhirTask.note.push({
          text: completionNotes.notes,
          time: new Date().toISOString()
        });
      }
      
      // Update business status if provided
      if (completionNotes?.outcome) {
        currentFhirTask.businessStatus = { text: completionNotes.outcome };
      }
      
      await fhirClient.update('Task', taskId, currentFhirTask);
      
      // Refresh patient resources to update all contexts
      if (currentPatient?.id) {
        await refreshPatientResources(currentPatient.id);
      }
      
      await loadTasks();
      await loadTaskStats();
    } catch (error) {
      
      throw error;
    }
  };

  // Care Team methods
  const loadPatientCareTeams = async (patientId) => {
    try {
      const response = await api.get(`/api/clinical/tasks/care-teams/patient/${patientId}`);
      setCareTeams(response.data);
    } catch (error) {
      
      throw error;
    }
  };

  const createCareTeam = async (teamData) => {
    try {
      const response = await api.post('/api/clinical/tasks/care-teams/', teamData);
      if (currentPatient) {
        await loadPatientCareTeams(currentPatient.id);
      }
      return response.data;
    } catch (error) {
      
      throw error;
    }
  };

  const updateCareTeamMembers = async (teamId, members) => {
    try {
      await api.put(`/api/clinical/tasks/care-teams/${teamId}/members`, members);
      if (currentPatient) {
        await loadPatientCareTeams(currentPatient.id);
      }
    } catch (error) {
      
      throw error;
    }
  };

  // Patient List methods
  const loadPatientLists = async () => {
    try {
      const response = await api.get('/api/clinical/tasks/patient-lists/');
      setPatientLists(response.data);
    } catch (error) {
      
      throw error;
    }
  };

  const createPatientList = async (listData) => {
    try {
      const response = await api.post('/api/clinical/tasks/patient-lists/', listData);
      await loadPatientLists();
      return response.data;
    } catch (error) {
      
      throw error;
    }
  };

  const addPatientToList = async (listId, patientId) => {
    try {
      await api.put(`/api/clinical/tasks/patient-lists/${listId}/add-patient/${patientId}`);
      await loadPatientLists();
    } catch (error) {
      
      throw error;
    }
  };

  const removePatientFromList = async (listId, patientId) => {
    try {
      await api.delete(`/api/clinical/tasks/patient-lists/${listId}/remove-patient/${patientId}`);
      await loadPatientLists();
    } catch (error) {
      
      throw error;
    }
  };

  const getPatientListPatients = async (listId) => {
    try {
      const response = await api.get(`/api/clinical/tasks/patient-lists/${listId}/patients`);
      return response.data.patients;
    } catch (error) {
      
      throw error;
    }
  };

  const value = {
    // Inbox
    inboxItems,
    inboxStats,
    loadInboxItems,
    loadInboxStats,
    markInboxItemRead,
    acknowledgeInboxItems,
    forwardInboxItems,
    createTaskFromInbox,
    
    // Tasks
    tasks,
    taskStats,
    loadTasks,
    loadTaskStats,
    createTask,
    updateTask,
    completeTask,
    
    // Care Team
    careTeams,
    loadPatientCareTeams,
    createCareTeam,
    updateCareTeamMembers,
    
    // Patient Lists
    patientLists,
    loadPatientLists,
    createPatientList,
    addPatientToList,
    removePatientFromList,
    getPatientListPatients
  };

  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  );
};