/**
 * Custom hook for medication list management
 * Provides a simple interface to medication list operations
 */

import { useState, useEffect, useCallback } from 'react';
import { medicationCRUDService } from '../../services/MedicationCRUDService';
import { medicationWorkflowService } from '../../services/MedicationWorkflowService';

export const useMedicationLists = (patientId) => {
  const [lists, setLists] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [initialized, setInitialized] = useState(false);

  // Load medication lists
  const loadLists = useCallback(async () => {
    if (!patientId) return;

    setLoading(true);
    setError(null);
    
    try {
      // Initialize lists if needed
      if (!initialized) {
        await medicationCRUDService.initializePatientMedicationLists(patientId);
        setInitialized(true);
      }

      // Get all lists
      const patientLists = await medicationCRUDService.getPatientMedicationLists(patientId);
      
      // Organize by type
      const listsByType = {};
      patientLists.forEach(list => {
        const listType = medicationCRUDService.getListTypeFromCode(
          list.code?.coding?.[0]?.code
        );
        if (listType) {
          listsByType[listType] = list;
        }
      });

      setLists(listsByType);
    } catch (err) {
      console.error('Error loading medication lists:', err);
      setError(err.message || 'Failed to load medication lists');
    } finally {
      setLoading(false);
    }
  }, [patientId, initialized]);

  // Add medication to list
  const addMedicationToList = useCallback(async (listType, medicationRequest, reason) => {
    if (!patientId) return;

    try {
      const result = await medicationCRUDService.addMedicationToList(
        patientId,
        listType,
        medicationRequest,
        reason
      );
      
      // Reload lists
      await loadLists();
      
      return result;
    } catch (err) {
      console.error('Error adding medication to list:', err);
      throw err;
    }
  }, [patientId, loadLists]);

  // Remove medication from list
  const removeMedicationFromList = useCallback(async (listType, medicationRequestId) => {
    if (!patientId) return;

    try {
      const result = await medicationCRUDService.removeMedicationFromList(
        patientId,
        listType,
        medicationRequestId
      );
      
      // Reload lists
      await loadLists();
      
      return result;
    } catch (err) {
      console.error('Error removing medication from list:', err);
      throw err;
    }
  }, [patientId, loadLists]);

  // Perform reconciliation
  const reconcileLists = useCallback(async () => {
    if (!patientId) return;

    try {
      // Get list IDs
      const listIds = Object.values(lists)
        .filter(list => list.id && list.code?.coding?.[0]?.code !== '80738-8') // Exclude reconciliation lists
        .map(list => list.id);

      if (listIds.length === 0) {
        throw new Error('No medication lists available for reconciliation');
      }

      const result = await medicationCRUDService.reconcileMedicationLists(
        patientId,
        listIds
      );
      
      // Reload lists to include new reconciliation list
      await loadLists();
      
      return result;
    } catch (err) {
      console.error('Error reconciling medication lists:', err);
      throw err;
    }
  }, [patientId, lists, loadLists]);

  // Get reconciliation analysis
  const getReconciliationAnalysis = useCallback(async () => {
    if (!patientId) return null;

    try {
      // Get medication data
      const medicationData = await medicationWorkflowService.getMedicationReconciliation(
        patientId
      );

      // Categorize medications
      const categorized = medicationWorkflowService.categorizeMedicationsBySource(medicationData);
      
      // Analyze reconciliation needs
      const analysis = medicationWorkflowService.analyzeReconciliationNeeds(categorized);
      
      return analysis;
    } catch (err) {
      console.error('Error analyzing reconciliation needs:', err);
      return null;
    }
  }, [patientId]);

  // Load lists on mount and patient change
  useEffect(() => {
    loadLists();
  }, [loadLists]);

  // Subscribe to updates
  useEffect(() => {
    if (!patientId) return;

    const unsubscribe = medicationCRUDService.subscribeToListUpdates(
      patientId,
      'global',
      () => {
        loadLists();
      }
    );

    return unsubscribe;
  }, [patientId, loadLists]);

  // Get list statistics
  const getListStats = useCallback(() => {
    const stats = {
      current: { total: 0, active: 0 },
      home: { total: 0, active: 0 },
      discharge: { total: 0, active: 0 },
      reconciliation: { total: 0, conflicts: 0 }
    };

    Object.entries(lists).forEach(([type, list]) => {
      const activeEntries = list.entry?.filter(e => !e.deleted) || [];
      stats[type] = {
        total: activeEntries.length,
        active: activeEntries.filter(e => 
          !e.flag || e.flag.coding?.[0]?.code !== 'discontinued'
        ).length
      };

      if (type === 'reconciliation') {
        stats[type].conflicts = activeEntries.filter(e => 
          e.flag?.coding?.[0]?.code === 'review-needed'
        ).length;
      }
    });

    return stats;
  }, [lists]);

  return {
    lists,
    loading,
    error,
    reload: loadLists,
    addMedicationToList,
    removeMedicationFromList,
    reconcileLists,
    getReconciliationAnalysis,
    getListStats
  };
};

// Hook for subscribing to medication list updates
export const useMedicationListUpdates = (patientId, listType, callback) => {
  useEffect(() => {
    if (!patientId || !callback) return;

    const unsubscribe = medicationCRUDService.subscribeToListUpdates(
      patientId,
      listType,
      callback
    );

    return unsubscribe;
  }, [patientId, listType, callback]);
};

// Hook for medication reconciliation workflow
export const useMedicationReconciliation = (patientId) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const analyzeReconciliation = useCallback(async () => {
    if (!patientId) return;

    setLoading(true);
    setError(null);

    try {
      // Get medication data
      const medicationData = await medicationWorkflowService.getMedicationReconciliation(
        patientId
      );

      // Categorize medications
      const categorized = medicationWorkflowService.categorizeMedicationsBySource(medicationData);
      
      // Analyze reconciliation needs
      const reconciliationAnalysis = medicationWorkflowService.analyzeReconciliationNeeds(categorized);
      
      setAnalysis({
        categorized,
        analysis: reconciliationAnalysis,
        timestamp: new Date().toISOString()
      });

      return reconciliationAnalysis;
    } catch (err) {
      console.error('Error analyzing reconciliation:', err);
      setError(err.message || 'Failed to analyze reconciliation');
      return null;
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  // Process reconciliation action
  const processAction = useCallback(async (action) => {
    if (!patientId) return;

    try {
      // This would handle individual reconciliation actions
      // For now, we'll use the list management to add/remove medications
      
      switch (action.action) {
        case 'start':
          await medicationCRUDService.addMedicationToList(
            patientId,
            'current',
            action.medication.resource,
            'Started during reconciliation'
          );
          break;
          
        case 'discontinue':
          await medicationCRUDService.removeMedicationFromList(
            patientId,
            'current',
            action.medication.id
          );
          break;
          
        case 'modify':
          // Would update the medication request with new dosage
          console.log('Dosage modification not yet implemented');
          break;
      }

      // Re-analyze after action
      await analyzeReconciliation();
    } catch (err) {
      console.error('Error processing reconciliation action:', err);
      throw err;
    }
  }, [patientId, analyzeReconciliation]);

  return {
    analysis,
    loading,
    error,
    analyzeReconciliation,
    processAction
  };
};