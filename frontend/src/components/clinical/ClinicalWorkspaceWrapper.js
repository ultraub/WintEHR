/**
 * ClinicalWorkspaceWrapper Component
 * Manages state for the clinical workspace and provides it to child components
 * Fixes the tab navigation issue by properly managing activeModule state
 */
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import EnhancedClinicalLayout from './layouts/EnhancedClinicalLayout';
import ClinicalWorkspaceEnhanced from './ClinicalWorkspaceEnhanced';
import { parseNavigationParams } from './utils/navigationHelper';

const ClinicalWorkspaceWrapper = () => {
  // Get all navigation params from URL
  const [searchParams, setSearchParams] = useSearchParams();
  const navigationContext = parseNavigationParams(searchParams);
  
  // Manage active module state
  const [activeModule, setActiveModule] = useState(navigationContext.tab);
  const [navigationParams, setNavigationParams] = useState(navigationContext);
  
  // Update URL when module changes with optional navigation context
  const handleModuleChange = (moduleId, params = {}) => {
    setActiveModule(moduleId);
    
    // Build new search params from navigation context
    const newSearchParams = new URLSearchParams();
    newSearchParams.set('tab', moduleId);
    
    // Add optional parameters
    if (params.resourceId) {
      newSearchParams.set('resourceId', params.resourceId);
    }
    if (params.resourceType) {
      newSearchParams.set('resourceType', params.resourceType);
    }
    if (params.action) {
      newSearchParams.set('action', params.action);
    }
    
    setSearchParams(newSearchParams);
    setNavigationParams({ tab: moduleId, ...params });
  };
  
  // Sync with URL changes (e.g., browser back/forward)
  useEffect(() => {
    const newContext = parseNavigationParams(searchParams);
    if (newContext.tab !== activeModule) {
      setActiveModule(newContext.tab);
    }
    setNavigationParams(newContext);
  }, [searchParams, activeModule]);

  return (
    <EnhancedClinicalLayout 
      activeModule={activeModule}
      onModuleChange={handleModuleChange}
      navigationContext={navigationParams}
    >
      <ClinicalWorkspaceEnhanced 
        activeModule={activeModule}
        navigationContext={navigationParams}
        onNavigateToTab={handleModuleChange}
      />
    </EnhancedClinicalLayout>
  );
};

export default ClinicalWorkspaceWrapper;