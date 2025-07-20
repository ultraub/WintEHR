/**
 * ClinicalWorkspaceWrapper Component
 * Manages state for the clinical workspace and provides it to child components
 * Fixes the tab navigation issue by properly managing activeModule state
 */
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import EnhancedClinicalLayout from './layouts/EnhancedClinicalLayout';
import ClinicalWorkspaceEnhanced from './ClinicalWorkspaceEnhanced';

const ClinicalWorkspaceWrapper = () => {
  // Get tab from URL params if present
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  
  // Manage active module state
  const [activeModule, setActiveModule] = useState(tabFromUrl || 'summary');
  
  // Update URL when module changes
  const handleModuleChange = (moduleId) => {
    setActiveModule(moduleId);
    
    // Update URL params to reflect current tab
    setSearchParams({ tab: moduleId });
  };
  
  // Sync with URL changes (e.g., browser back/forward)
  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeModule) {
      setActiveModule(tabFromUrl);
    }
  }, [tabFromUrl]);

  return (
    <EnhancedClinicalLayout 
      activeModule={activeModule}
      onModuleChange={handleModuleChange}
    >
      <ClinicalWorkspaceEnhanced />
    </EnhancedClinicalLayout>
  );
};

export default ClinicalWorkspaceWrapper;