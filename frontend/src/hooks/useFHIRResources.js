import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFHIRResource } from '../contexts/FHIRResourceContext';

/**
 * Hook for managing a specific resource type with loading and error states
 */
export function useResourceType(resourceType, autoLoad = false, searchParams = {}) {
  const {
    getResourcesByType,
    searchResources,
    isLoading,
    getError,
    currentPatient
  } = useFHIRResource();

  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState(null);

  const resources = getResourcesByType(resourceType);
  const loading = isLoading(resourceType) || localLoading;
  const error = getError(resourceType) || localError;

  const loadResources = useCallback(async (params = {}, forceRefresh = false) => {
    setLocalLoading(true);
    setLocalError(null);

    try {
      const finalParams = { ...searchParams, ...params };
      if (currentPatient && !finalParams.patient && !finalParams.subject) {
        finalParams.patient = currentPatient.id;
      }
      
      const result = await searchResources(resourceType, finalParams, forceRefresh);
      return result;
    } catch (err) {
      setLocalError(err.message);
      throw err;
    } finally {
      setLocalLoading(false);
    }
  }, [resourceType, searchResources, searchParams, currentPatient]);

  const refresh = useCallback(() => {
    return loadResources({}, true);
  }, [loadResources]);

  // Auto-load on mount if requested
  useEffect(() => {
    if (autoLoad && resources.length === 0 && !loading && !error) {
      loadResources();
    }
  }, [autoLoad, resources.length, loading, error, loadResources]);

  return {
    resources,
    loading,
    error,
    loadResources,
    refresh,
    isEmpty: resources.length === 0 && !loading
  };
}

/**
 * Hook for managing patient-specific resources
 */
export function usePatientResourceType(patientId, resourceType, autoLoad = true) {
  const {
    getPatientResources,
    searchResources,
    isLoading,
    getError
  } = useFHIRResource();

  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState(null);

  const resources = useMemo(() => {
    return patientId ? getPatientResources(patientId, resourceType) : [];
  }, [patientId, getPatientResources, resourceType]);

  const loading = isLoading(resourceType) || localLoading;
  const error = getError(resourceType) || localError;

  const loadResources = useCallback(async (params = {}, forceRefresh = false) => {
    if (!patientId) return { resources: [] };

    setLocalLoading(true);
    setLocalError(null);

    try {
      // Use reasonable count to prevent memory issues
      const defaultCount = resourceType === 'Observation' ? 100 : 50;
      const searchParams = { patient: patientId, _count: params._count || defaultCount, ...params };
      const result = await searchResources(resourceType, searchParams, forceRefresh);
      return result;
    } catch (err) {
      setLocalError(err.message);
      throw err;
    } finally {
      setLocalLoading(false);
    }
  }, [patientId, resourceType, searchResources]);

  const refresh = useCallback(() => {
    return loadResources({}, true);
  }, [loadResources]);

  // Auto-load on mount and when patientId changes
  useEffect(() => {
    if (autoLoad && patientId && resources.length === 0 && !loading && !error) {
      loadResources();
    }
  }, [autoLoad, patientId, resources.length, loading, error, loadResources]);

  return {
    resources,
    loading,
    error,
    loadResources,
    refresh,
    isEmpty: resources.length === 0 && !loading && patientId
  };
}

/**
 * Hook for managing encounters with additional encounter-specific logic
 */
export function useEncounters(patientId, autoLoad = true) {
  const baseHook = usePatientResourceType(patientId, 'Encounter', autoLoad);
  
  const encounters = useMemo(() => {
    return baseHook.resources.sort((a, b) => {
      const dateA = new Date(a.period?.start || a.period?.end || '1970-01-01');
      const dateB = new Date(b.period?.start || b.period?.end || '1970-01-01');
      return dateB - dateA; // Most recent first
    });
  }, [baseHook.resources]);

  const activeEncounters = useMemo(() => {
    return encounters.filter(enc => enc.status === 'in-progress' || enc.status === 'arrived');
  }, [encounters]);

  const recentEncounters = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return encounters.filter(enc => {
      const encDate = new Date(enc.period?.start || enc.period?.end || '1970-01-01');
      return encDate >= thirtyDaysAgo;
    });
  }, [encounters]);

  return {
    ...baseHook,
    encounters,
    activeEncounters,
    recentEncounters
  };
}

/**
 * Hook for managing conditions/problems with clinical logic
 */
export function useConditions(patientId, autoLoad = true) {
  const baseHook = usePatientResourceType(patientId, 'Condition', autoLoad);
  
  const conditions = useMemo(() => {
    return baseHook.resources.sort((a, b) => {
      const dateA = new Date(a.recordedDate || a.onsetDateTime || '1970-01-01');
      const dateB = new Date(b.recordedDate || b.onsetDateTime || '1970-01-01');
      return dateB - dateA;
    });
  }, [baseHook.resources]);

  const activeConditions = useMemo(() => {
    return conditions.filter(condition => 
      condition.clinicalStatus?.coding?.[0]?.code === 'active'
    );
  }, [conditions]);

  const chronicConditions = useMemo(() => {
    return activeConditions.filter(condition => {
      const categories = condition.category || [];
      return categories.some(cat => 
        cat.coding?.some(code => 
          code.code === 'problem-list-item' || code.display?.toLowerCase().includes('chronic')
        )
      );
    });
  }, [activeConditions]);

  return {
    ...baseHook,
    conditions,
    activeConditions,
    chronicConditions
  };
}

/**
 * Hook for managing medications with medication-specific logic
 */
export function useMedications(patientId, autoLoad = true) {
  const medicationRequests = usePatientResourceType(patientId, 'MedicationRequest', autoLoad);
  const medicationStatements = usePatientResourceType(patientId, 'MedicationStatement', autoLoad);

  const allMedications = useMemo(() => {
    return [
      ...medicationRequests.resources.map(med => ({ ...med, sourceType: 'MedicationRequest' })),
      ...medicationStatements.resources.map(med => ({ ...med, sourceType: 'MedicationStatement' }))
    ].sort((a, b) => {
      const dateA = new Date(a.authoredOn || a.effectiveDateTime || '1970-01-01');
      const dateB = new Date(b.authoredOn || b.effectiveDateTime || '1970-01-01');
      return dateB - dateA;
    });
  }, [medicationRequests.resources, medicationStatements.resources]);

  const activeMedications = useMemo(() => {
    return allMedications.filter(med => med.status === 'active');
  }, [allMedications]);

  const loading = medicationRequests.loading || medicationStatements.loading;
  const error = medicationRequests.error || medicationStatements.error;

  const refresh = useCallback(async () => {
    await Promise.all([
      medicationRequests.refresh(),
      medicationStatements.refresh()
    ]);
  }, [medicationRequests.refresh, medicationStatements.refresh]);

  return {
    allMedications,
    activeMedications,
    medicationRequests: medicationRequests.resources,
    medicationStatements: medicationStatements.resources,
    loading,
    error,
    refresh,
    isEmpty: allMedications.length === 0 && !loading
  };
}

/**
 * Hook for managing observations with clinical filtering
 */
export function useObservations(patientId, category = null, autoLoad = true) {
  const searchParams = category ? { category } : {};
  const baseHook = usePatientResourceType(patientId, 'Observation', autoLoad);

  const observations = useMemo(() => {
    let filtered = baseHook.resources;
    
    if (category) {
      filtered = filtered.filter(obs => 
        obs.category?.some(cat => 
          cat.coding?.some(code => code.code === category)
        )
      );
    }
    
    return filtered.sort((a, b) => {
      const dateA = new Date(a.effectiveDateTime || a.effectiveInstant || a.issued || '1970-01-01');
      const dateB = new Date(b.effectiveDateTime || b.effectiveInstant || b.issued || '1970-01-01');
      return dateB - dateA;
    });
  }, [baseHook.resources, category]);

  const vitals = useMemo(() => {
    return observations.filter(obs => 
      obs.category?.some(cat => 
        cat.coding?.some(code => code.code === 'vital-signs')
      )
    );
  }, [observations]);

  const labResults = useMemo(() => {
    return observations.filter(obs => 
      obs.category?.some(cat => 
        cat.coding?.some(code => code.code === 'laboratory')
      )
    );
  }, [observations]);

  return {
    ...baseHook,
    observations,
    vitals,
    labResults
  };
}

/**
 * Hook for managing document references with document-specific logic
 */
export function useDocumentReferences(patientId, autoLoad = true) {
  const baseHook = usePatientResourceType(patientId, 'DocumentReference', autoLoad);
  
  const documents = useMemo(() => {
    return baseHook.resources.sort((a, b) => {
      const dateA = new Date(a.date || a.created || a.meta?.lastUpdated || '1970-01-01');
      const dateB = new Date(b.date || b.created || b.meta?.lastUpdated || '1970-01-01');
      return dateB - dateA;
    });
  }, [baseHook.resources]);

  const documentsByType = useMemo(() => {
    const grouped = {};
    documents.forEach(doc => {
      const type = doc.type?.text || doc.type?.coding?.[0]?.display || 'Unknown';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(doc);
    });
    return grouped;
  }, [documents]);

  const recentDocuments = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return documents.filter(doc => {
      const docDate = new Date(doc.date || doc.created || doc.meta?.lastUpdated || '1970-01-01');
      return docDate >= thirtyDaysAgo;
    });
  }, [documents]);

  return {
    ...baseHook,
    documents,
    documentsByType,
    recentDocuments
  };
}

/**
 * Hook for managing care teams with team-specific logic
 */
export function useCareTeams(patientId, autoLoad = true) {
  const baseHook = usePatientResourceType(patientId, 'CareTeam', autoLoad);
  
  const careTeams = useMemo(() => {
    return baseHook.resources.sort((a, b) => {
      const dateA = new Date(a.period?.start || a.meta?.lastUpdated || '1970-01-01');
      const dateB = new Date(b.period?.start || b.meta?.lastUpdated || '1970-01-01');
      return dateB - dateA;
    });
  }, [baseHook.resources]);

  const activeCareTeams = useMemo(() => {
    return careTeams.filter(team => 
      team.status === 'active' && 
      (!team.period?.end || new Date(team.period.end) > new Date())
    );
  }, [careTeams]);

  const allParticipants = useMemo(() => {
    const participants = [];
    activeCareTeams.forEach(team => {
      if (team.participant) {
        team.participant.forEach(p => {
          participants.push({
            ...p,
            teamId: team.id,
            teamName: team.name
          });
        });
      }
    });
    return participants;
  }, [activeCareTeams]);

  return {
    ...baseHook,
    careTeams,
    activeCareTeams,
    allParticipants
  };
}

/**
 * Hook for managing imaging studies with imaging-specific logic
 */
export function useImagingStudies(patientId, autoLoad = true) {
  const baseHook = usePatientResourceType(patientId, 'ImagingStudy', autoLoad);
  
  const imagingStudies = useMemo(() => {
    return baseHook.resources.sort((a, b) => {
      const dateA = new Date(a.started || a.meta?.lastUpdated || '1970-01-01');
      const dateB = new Date(b.started || b.meta?.lastUpdated || '1970-01-01');
      return dateB - dateA;
    });
  }, [baseHook.resources]);

  const studiesByModality = useMemo(() => {
    const grouped = {};
    imagingStudies.forEach(study => {
      const modality = study.modality?.[0]?.display || study.modality?.[0]?.code || 'Unknown';
      if (!grouped[modality]) grouped[modality] = [];
      grouped[modality].push(study);
    });
    return grouped;
  }, [imagingStudies]);

  const availableStudies = useMemo(() => {
    return imagingStudies.filter(study => study.status === 'available');
  }, [imagingStudies]);

  const recentStudies = useMemo(() => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    return imagingStudies.filter(study => {
      const studyDate = new Date(study.started || study.meta?.lastUpdated || '1970-01-01');
      return studyDate >= ninetyDaysAgo;
    });
  }, [imagingStudies]);

  return {
    ...baseHook,
    imagingStudies,
    studiesByModality,
    availableStudies,
    recentStudies
  };
}

/**
 * Hook for managing coverage/insurance with financial logic
 */
export function useCoverage(patientId, autoLoad = true) {
  const baseHook = usePatientResourceType(patientId, 'Coverage', autoLoad);
  
  const coverage = useMemo(() => {
    return baseHook.resources.sort((a, b) => {
      const dateA = new Date(a.period?.start || a.meta?.lastUpdated || '1970-01-01');
      const dateB = new Date(b.period?.start || b.meta?.lastUpdated || '1970-01-01');
      return dateB - dateA;
    });
  }, [baseHook.resources]);

  const activeCoverage = useMemo(() => {
    const now = new Date();
    return coverage.filter(cov => {
      if (cov.status !== 'active') return false;
      
      // Check if within coverage period
      if (cov.period) {
        const start = cov.period.start ? new Date(cov.period.start) : null;
        const end = cov.period.end ? new Date(cov.period.end) : null;
        
        if (start && now < start) return false;
        if (end && now > end) return false;
      }
      
      return true;
    });
  }, [coverage]);

  const primaryCoverage = useMemo(() => {
    return activeCoverage.find(cov => cov.order === 1) || activeCoverage[0];
  }, [activeCoverage]);

  const coverageByPayer = useMemo(() => {
    const grouped = {};
    coverage.forEach(cov => {
      const payer = cov.payor?.[0]?.display || 'Unknown Payer';
      if (!grouped[payer]) grouped[payer] = [];
      grouped[payer].push(cov);
    });
    return grouped;
  }, [coverage]);

  return {
    ...baseHook,
    coverage,
    activeCoverage,
    primaryCoverage,
    coverageByPayer
  };
}

/**
 * Hook for managing procedures with procedure-specific logic
 */
export function useProcedures(patientId, autoLoad = true) {
  const baseHook = usePatientResourceType(patientId, 'Procedure', autoLoad);
  
  const procedures = useMemo(() => {
    return baseHook.resources.sort((a, b) => {
      const dateA = new Date(a.performedDateTime || a.performedPeriod?.start || a.meta?.lastUpdated || '1970-01-01');
      const dateB = new Date(b.performedDateTime || b.performedPeriod?.start || b.meta?.lastUpdated || '1970-01-01');
      return dateB - dateA;
    });
  }, [baseHook.resources]);

  const completedProcedures = useMemo(() => {
    return procedures.filter(proc => proc.status === 'completed');
  }, [procedures]);

  const proceduresByCategory = useMemo(() => {
    const grouped = {};
    procedures.forEach(proc => {
      const category = proc.category?.text || proc.category?.coding?.[0]?.display || 'Uncategorized';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(proc);
    });
    return grouped;
  }, [procedures]);

  const recentProcedures = useMemo(() => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    return procedures.filter(proc => {
      const procDate = new Date(proc.performedDateTime || proc.performedPeriod?.start || proc.meta?.lastUpdated || '1970-01-01');
      return procDate >= ninetyDaysAgo;
    });
  }, [procedures]);

  return {
    ...baseHook,
    procedures,
    completedProcedures,
    proceduresByCategory,
    recentProcedures
  };
}

/**
 * Hook for managing diagnostic reports with report-specific logic
 */
export function useDiagnosticReports(patientId, autoLoad = true) {
  const baseHook = usePatientResourceType(patientId, 'DiagnosticReport', autoLoad);
  
  const reports = useMemo(() => {
    return baseHook.resources.sort((a, b) => {
      const dateA = new Date(a.effectiveDateTime || a.issued || a.meta?.lastUpdated || '1970-01-01');
      const dateB = new Date(b.effectiveDateTime || b.issued || b.meta?.lastUpdated || '1970-01-01');
      return dateB - dateA;
    });
  }, [baseHook.resources]);

  const finalReports = useMemo(() => {
    return reports.filter(report => report.status === 'final');
  }, [reports]);

  const reportsByCategory = useMemo(() => {
    const grouped = {};
    reports.forEach(report => {
      const category = report.category?.[0]?.text || report.category?.[0]?.coding?.[0]?.display || 'Uncategorized';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(report);
    });
    return grouped;
  }, [reports]);

  const recentReports = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return reports.filter(report => {
      const reportDate = new Date(report.effectiveDateTime || report.issued || report.meta?.lastUpdated || '1970-01-01');
      return reportDate >= thirtyDaysAgo;
    });
  }, [reports]);

  return {
    ...baseHook,
    reports,
    finalReports,
    reportsByCategory,
    recentReports
  };
}

/**
 * Hook for managing immunizations with vaccination-specific logic
 */
export function useImmunizations(patientId, autoLoad = true) {
  const baseHook = usePatientResourceType(patientId, 'Immunization', autoLoad);
  
  const immunizations = useMemo(() => {
    return baseHook.resources.sort((a, b) => {
      const dateA = new Date(a.occurrenceDateTime || a.recorded || a.meta?.lastUpdated || '1970-01-01');
      const dateB = new Date(b.occurrenceDateTime || b.recorded || b.meta?.lastUpdated || '1970-01-01');
      return dateB - dateA;
    });
  }, [baseHook.resources]);

  const completedImmunizations = useMemo(() => {
    return immunizations.filter(imm => imm.status === 'completed');
  }, [immunizations]);

  const immunizationsByVaccine = useMemo(() => {
    const grouped = {};
    immunizations.forEach(imm => {
      const vaccine = imm.vaccineCode?.text || imm.vaccineCode?.coding?.[0]?.display || 'Unknown Vaccine';
      if (!grouped[vaccine]) grouped[vaccine] = [];
      grouped[vaccine].push(imm);
    });
    return grouped;
  }, [immunizations]);

  const recentImmunizations = useMemo(() => {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    return immunizations.filter(imm => {
      const immDate = new Date(imm.occurrenceDateTime || imm.recorded || imm.meta?.lastUpdated || '1970-01-01');
      return immDate >= oneYearAgo;
    });
  }, [immunizations]);

  return {
    ...baseHook,
    immunizations,
    completedImmunizations,
    immunizationsByVaccine,
    recentImmunizations
  };
}

/**
 * Hook for comprehensive patient summary data
 */
export function usePatientSummary(patientId) {
  const { currentPatient } = useFHIRResource();
  const encounters = useEncounters(patientId);
  const conditions = useConditions(patientId);
  const medications = useMedications(patientId);
  const observations = useObservations(patientId);
  const allergies = usePatientResourceType(patientId, 'AllergyIntolerance');
  const procedures = useProcedures(patientId);
  const documents = useDocumentReferences(patientId);
  const careTeams = useCareTeams(patientId);
  const imaging = useImagingStudies(patientId);
  const coverage = useCoverage(patientId);
  const diagnosticReports = useDiagnosticReports(patientId);
  const immunizations = useImmunizations(patientId);

  const loading = encounters.loading || conditions.loading || medications.loading || 
                 observations.loading || allergies.loading || procedures.loading ||
                 documents.loading || careTeams.loading || imaging.loading || coverage.loading ||
                 diagnosticReports.loading || immunizations.loading;

  const summary = useMemo(() => {
    if (!patientId || loading) return null;

    return {
      patient: currentPatient,
      demographics: {
        age: currentPatient ? calculateAge(currentPatient.birthDate) : null,
        gender: currentPatient?.gender,
        name: currentPatient?.name?.[0]
      },
      encounters: {
        total: encounters.encounters.length,
        active: encounters.activeEncounters.length,
        recent: encounters.recentEncounters.length
      },
      conditions: {
        total: conditions.conditions.length,
        active: conditions.activeConditions.length,
        chronic: conditions.chronicConditions.length
      },
      medications: {
        total: medications.allMedications.length,
        active: medications.activeMedications.length
      },
      observations: {
        total: observations.observations.length,
        vitals: observations.vitals.length,
        labs: observations.labResults.length
      },
      allergies: allergies.resources.length,
      procedures: {
        total: procedures.procedures.length,
        completed: procedures.completedProcedures.length,
        recent: procedures.recentProcedures.length
      },
      documents: {
        total: documents.documents.length,
        recent: documents.recentDocuments.length
      },
      careTeams: {
        total: careTeams.careTeams.length,
        active: careTeams.activeCareTeams.length,
        participants: careTeams.allParticipants.length
      },
      imaging: {
        total: imaging.imagingStudies.length,
        available: imaging.availableStudies.length,
        recent: imaging.recentStudies.length
      },
      coverage: {
        total: coverage.coverage.length,
        active: coverage.activeCoverage.length,
        primary: coverage.primaryCoverage ? 1 : 0
      },
      diagnosticReports: {
        total: diagnosticReports.reports.length,
        final: diagnosticReports.finalReports.length,
        recent: diagnosticReports.recentReports.length
      },
      immunizations: {
        total: immunizations.immunizations.length,
        completed: immunizations.completedImmunizations.length,
        recent: immunizations.recentImmunizations.length
      }
    };
  }, [patientId, loading, currentPatient, encounters, conditions, medications, observations, allergies, procedures]);

  return {
    summary,
    loading,
    refresh: async () => {
      await Promise.all([
        encounters.refresh(),
        conditions.refresh(),
        medications.refresh(),
        observations.refresh(),
        allergies.refresh(),
        procedures.refresh(),
        documents.refresh(),
        careTeams.refresh(),
        imaging.refresh(),
        coverage.refresh(),
        diagnosticReports.refresh(),
        immunizations.refresh()
      ]);
    }
  };
}

// Utility function
function calculateAge(birthDate) {
  if (!birthDate) return null;
  
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}