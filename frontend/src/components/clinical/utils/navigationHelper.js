/**
 * Navigation Helper for Clinical Workspace
 * Centralizes navigation logic and tab mappings
 * Part of Phase 3.1 - Fix Navigation Issues
 */

// Standard tab identifiers matching TAB_CONFIG in ClinicalWorkspaceEnhanced
export const TAB_IDS = {
  SUMMARY: 'summary',
  CHART_REVIEW: 'chart-review',
  ENCOUNTERS: 'encounters',
  RESULTS: 'results',
  ORDERS: 'orders',
  PHARMACY: 'pharmacy',
  IMAGING: 'imaging',
  DOCUMENTATION: 'documentation',
  CARE_PLAN: 'care-plan',
  TIMELINE: 'timeline'
};

// Resource type to tab mapping
export const RESOURCE_TYPE_TO_TAB = {
  // Core clinical resources
  'Condition': TAB_IDS.CHART_REVIEW,
  'MedicationRequest': TAB_IDS.CHART_REVIEW,  // Medications are in Chart Review tab
  'MedicationStatement': TAB_IDS.CHART_REVIEW,  // Medications are in Chart Review tab
  'AllergyIntolerance': TAB_IDS.CHART_REVIEW,
  'Immunization': TAB_IDS.CHART_REVIEW,
  
  // Results and observations
  'Observation': TAB_IDS.RESULTS,
  'DiagnosticReport': TAB_IDS.RESULTS,
  
  // Orders
  'ServiceRequest': TAB_IDS.ORDERS,
  'MedicationOrder': TAB_IDS.ORDERS,
  
  // Encounters
  'Encounter': TAB_IDS.ENCOUNTERS,
  'Appointment': TAB_IDS.ENCOUNTERS,
  
  // Documentation
  'DocumentReference': TAB_IDS.DOCUMENTATION,
  'ClinicalImpression': TAB_IDS.DOCUMENTATION,
  
  // Care planning
  'CarePlan': TAB_IDS.CARE_PLAN,
  'Goal': TAB_IDS.CARE_PLAN,
  'CareTeam': TAB_IDS.CARE_PLAN,
  
  // Procedures and imaging
  'Procedure': TAB_IDS.CHART_REVIEW,
  'ImagingStudy': TAB_IDS.IMAGING,
  'Media': TAB_IDS.IMAGING
};

// Tab display names
export const TAB_DISPLAY_NAMES = {
  [TAB_IDS.SUMMARY]: 'Summary',
  [TAB_IDS.CHART_REVIEW]: 'Chart Review',
  [TAB_IDS.ENCOUNTERS]: 'Encounters',
  [TAB_IDS.RESULTS]: 'Results',
  [TAB_IDS.ORDERS]: 'Orders',
  [TAB_IDS.PHARMACY]: 'Pharmacy',
  [TAB_IDS.IMAGING]: 'Imaging',
  [TAB_IDS.DOCUMENTATION]: 'Documentation',
  [TAB_IDS.CARE_PLAN]: 'Care Plan',
  [TAB_IDS.TIMELINE]: 'Timeline'
};

/**
 * Get the appropriate tab for a resource type
 * @param {string} resourceType - FHIR resource type
 * @returns {string} Tab ID
 */
export const getTabForResourceType = (resourceType) => {
  return RESOURCE_TYPE_TO_TAB[resourceType] || TAB_IDS.SUMMARY;
};

/**
 * Build navigation parameters for tab navigation
 * @param {string} tabId - Target tab ID
 * @param {Object} options - Navigation options
 * @param {string} options.resourceId - Resource ID to highlight
 * @param {string} options.resourceType - Resource type
 * @param {string} options.action - Action to perform (view, edit, etc.)
 * @returns {Object} Navigation parameters
 */
export const buildNavigationParams = (tabId, options = {}) => {
  const params = {
    tab: tabId
  };

  if (options.resourceId) {
    params.resourceId = options.resourceId;
  }

  if (options.resourceType) {
    params.resourceType = options.resourceType;
  }

  if (options.action) {
    params.action = options.action;
  }

  return params;
};

/**
 * Navigate to a specific tab with optional resource context
 * @param {Function} onNavigateToTab - Navigation handler from parent
 * @param {string} tabId - Target tab ID
 * @param {Object} options - Navigation options
 */
export const navigateToTab = (onNavigateToTab, tabId, options = {}) => {
  if (typeof onNavigateToTab !== 'function') {
    console.error('navigateToTab: onNavigateToTab prop is required');
    return;
  }

  const params = buildNavigationParams(tabId, options);
  
  // Call the navigation handler
  onNavigateToTab(tabId, params);
};

/**
 * Navigate to a resource's appropriate tab
 * @param {Function} onNavigateToTab - Navigation handler from parent
 * @param {string} resourceType - FHIR resource type
 * @param {string} resourceId - Resource ID
 * @param {Object} options - Additional options
 */
export const navigateToResource = (onNavigateToTab, resourceType, resourceId, options = {}) => {
  const tabId = getTabForResourceType(resourceType);
  
  navigateToTab(onNavigateToTab, tabId, {
    resourceType,
    resourceId,
    ...options
  });
};

/**
 * Get display name for a tab
 * @param {string} tabId - Tab ID
 * @returns {string} Display name
 */
export const getTabDisplayName = (tabId) => {
  return TAB_DISPLAY_NAMES[tabId] || 'Unknown';
};

/**
 * Check if a tab ID is valid
 * @param {string} tabId - Tab ID to check
 * @returns {boolean} Whether the tab ID is valid
 */
export const isValidTab = (tabId) => {
  return Object.values(TAB_IDS).includes(tabId);
};

/**
 * Parse navigation parameters from URL or object
 * @param {URLSearchParams|Object} params - Parameters to parse
 * @returns {Object} Parsed navigation context
 */
export const parseNavigationParams = (params) => {
  const context = {
    tab: TAB_IDS.SUMMARY,
    resourceId: null,
    resourceType: null,
    action: null
  };

  if (params instanceof URLSearchParams) {
    context.tab = params.get('tab') || TAB_IDS.SUMMARY;
    context.resourceId = params.get('resourceId');
    context.resourceType = params.get('resourceType');
    context.action = params.get('action');
  } else if (params && typeof params === 'object') {
    context.tab = params.tab || TAB_IDS.SUMMARY;
    context.resourceId = params.resourceId;
    context.resourceType = params.resourceType;
    context.action = params.action;
  }

  // Validate tab ID
  if (!isValidTab(context.tab)) {
    context.tab = TAB_IDS.SUMMARY;
  }

  return context;
};

// Export all constants and functions
export default {
  TAB_IDS,
  RESOURCE_TYPE_TO_TAB,
  TAB_DISPLAY_NAMES,
  getTabForResourceType,
  buildNavigationParams,
  navigateToTab,
  navigateToResource,
  getTabDisplayName,
  isValidTab,
  parseNavigationParams
};