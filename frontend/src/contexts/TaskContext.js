/**
 * Task Context Provider
 * Manages clinical tasks, inbox, and care team functionality
 */
import React, { createContext, useContext, useState } from 'react';
import api from '../services/api';
import { useClinical } from './ClinicalContext';

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
  const [inboxItems, setInboxItems] = useState([]);
  const [inboxStats, setInboxStats] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [taskStats, setTaskStats] = useState(null);
  const [careTeams, setCareTeams] = useState([]);
  const [patientLists, setPatientLists] = useState([]);

  // Inbox methods
  const loadInboxItems = async (filters) => {
    try {
      const response = await api.get('/api/clinical/inbox/', { params: filters });
      setInboxItems(response.data);
    } catch (error) {
      console.error('Error loading inbox items:', error);
      throw error;
    }
  };

  const loadInboxStats = async () => {
    try {
      const response = await api.get('/api/clinical/inbox/stats');
      setInboxStats(response.data);
    } catch (error) {
      console.error('Error loading inbox stats:', error);
      throw error;
    }
  };

  const markInboxItemRead = async (itemId) => {
    try {
      await api.get(`/api/clinical/inbox/${itemId}`);
      await loadInboxItems();
      await loadInboxStats();
    } catch (error) {
      console.error('Error marking inbox item as read:', error);
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
      console.error('Error acknowledging inbox items:', error);
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
      console.error('Error forwarding inbox items:', error);
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
      console.error('Error creating task from inbox:', error);
      throw error;
    }
  };

  // Task methods
  const loadTasks = async (filters) => {
    try {
      const response = await api.get('/api/clinical/tasks/', { params: filters });
      setTasks(response.data);
    } catch (error) {
      console.error('Error loading tasks:', error);
      throw error;
    }
  };

  const loadTaskStats = async () => {
    try {
      const response = await api.get('/api/clinical/tasks/stats');
      setTaskStats(response.data);
    } catch (error) {
      console.error('Error loading task stats:', error);
      throw error;
    }
  };

  const createTask = async (taskData) => {
    try {
      const response = await api.post('/api/clinical/tasks/', taskData);
      await loadTasks();
      return response.data;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  };

  const updateTask = async (taskId, updates) => {
    try {
      await api.put(`/api/clinical/tasks/${taskId}`, updates);
      await loadTasks();
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  };

  const completeTask = async (taskId, completionNotes) => {
    try {
      await api.post(`/api/clinical/tasks/${taskId}/complete`, completionNotes);
      await loadTasks();
      await loadTaskStats();
    } catch (error) {
      console.error('Error completing task:', error);
      throw error;
    }
  };

  // Care Team methods
  const loadPatientCareTeams = async (patientId) => {
    try {
      const response = await api.get(`/api/clinical/tasks/care-teams/patient/${patientId}`);
      setCareTeams(response.data);
    } catch (error) {
      console.error('Error loading patient care teams:', error);
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
      console.error('Error creating care team:', error);
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
      console.error('Error updating care team:', error);
      throw error;
    }
  };

  // Patient List methods
  const loadPatientLists = async () => {
    try {
      const response = await api.get('/api/clinical/tasks/patient-lists/');
      setPatientLists(response.data);
    } catch (error) {
      console.error('Error loading patient lists:', error);
      throw error;
    }
  };

  const createPatientList = async (listData) => {
    try {
      const response = await api.post('/api/clinical/tasks/patient-lists/', listData);
      await loadPatientLists();
      return response.data;
    } catch (error) {
      console.error('Error creating patient list:', error);
      throw error;
    }
  };

  const addPatientToList = async (listId, patientId) => {
    try {
      await api.put(`/api/clinical/tasks/patient-lists/${listId}/add-patient/${patientId}`);
      await loadPatientLists();
    } catch (error) {
      console.error('Error adding patient to list:', error);
      throw error;
    }
  };

  const removePatientFromList = async (listId, patientId) => {
    try {
      await api.delete(`/api/clinical/tasks/patient-lists/${listId}/remove-patient/${patientId}`);
      await loadPatientLists();
    } catch (error) {
      console.error('Error removing patient from list:', error);
      throw error;
    }
  };

  const getPatientListPatients = async (listId) => {
    try {
      const response = await api.get(`/api/clinical/tasks/patient-lists/${listId}/patients`);
      return response.data.patients;
    } catch (error) {
      console.error('Error getting patient list patients:', error);
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