/**
 * Clinical Helper Functions
 * Centralized utility functions for clinical workspace components
 */

import { alpha } from '@mui/material/styles';

/**
 * Get color based on status
 * @param {string} status - The status value
 * @param {object} theme - MUI theme object
 * @returns {string} Color value
 */
export const getStatusColor = (status, theme) => {
  const statusColors = {
    active: theme.palette.success.main,
    inactive: theme.palette.grey[500],
    pending: theme.palette.warning.main,
    completed: theme.palette.info.main,
    cancelled: theme.palette.error.main,
    draft: theme.palette.grey[400],
    'in-progress': theme.palette.primary.main,
    stopped: theme.palette.error.light,
    'on-hold': theme.palette.warning.light,
    'entered-in-error': theme.palette.error.dark,
    unknown: theme.palette.grey[400]
  };
  
  return statusColors[status?.toLowerCase()] || statusColors.unknown;
};

/**
 * Get color based on priority
 * @param {string} priority - The priority value
 * @param {object} theme - MUI theme object
 * @returns {string} Color value
 */
export const getPriorityColor = (priority, theme) => {
  const priorityColors = {
    routine: theme.palette.info.main,
    urgent: theme.palette.warning.main,
    asap: theme.palette.warning.dark,
    stat: theme.palette.error.main,
    normal: theme.palette.info.main,
    high: theme.palette.warning.main,
    low: theme.palette.success.main
  };
  
  return priorityColors[priority?.toLowerCase()] || priorityColors.normal;
};

/**
 * Get color based on severity
 * @param {string} severity - The severity value
 * @param {object} theme - MUI theme object
 * @returns {string} Color value
 */
export const getSeverityColor = (severity, theme) => {
  const severityColors = {
    high: theme.palette.error.main,
    moderate: theme.palette.warning.main,
    low: theme.palette.info.main,
    severe: theme.palette.error.dark,
    mild: theme.palette.success.main,
    'life-threatening': theme.palette.error.dark,
    normal: theme.palette.success.main
  };
  
  return severityColors[severity?.toLowerCase()] || severityColors.normal;
};

/**
 * Get color based on result status
 * @param {string} status - The result status
 * @param {object} theme - MUI theme object
 * @returns {string} Color value
 */
export const getResultStatusColor = (status, theme) => {
  const statusColors = {
    final: theme.palette.success.main,
    preliminary: theme.palette.warning.main,
    amended: theme.palette.info.main,
    corrected: theme.palette.warning.dark,
    cancelled: theme.palette.error.main,
    'entered-in-error': theme.palette.error.dark,
    unknown: theme.palette.grey[400]
  };
  
  return statusColors[status?.toLowerCase()] || statusColors.unknown;
};

/**
 * Get background color for clinical cards
 * @param {string} type - The card type
 * @param {object} theme - MUI theme object
 * @returns {string} Background color
 */
export const getClinicalCardBackground = (type, theme) => {
  const backgrounds = {
    problem: alpha(theme.palette.warning.main, 0.05),
    medication: alpha(theme.palette.primary.main, 0.05),
    allergy: alpha(theme.palette.error.main, 0.05),
    lab: alpha(theme.palette.info.main, 0.05),
    imaging: alpha(theme.palette.secondary.main, 0.05),
    default: theme.palette.background.paper
  };
  
  return backgrounds[type] || backgrounds.default;
};

/**
 * Format date for display
 * @param {string|Date} date - The date to format
 * @param {string} format - Format type ('short', 'long', 'relative')
 * @returns {string} Formatted date
 */
export const formatClinicalDate = (date, format = 'short') => {
  if (!date) return 'Unknown';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return 'Invalid date';
  
  const options = {
    short: { month: 'short', day: 'numeric', year: 'numeric' },
    long: { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' },
    relative: null // Handle relative dates separately
  };
  
  if (format === 'relative') {
    const now = new Date();
    const diffTime = Math.abs(now - dateObj);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return dateObj > now ? 'Tomorrow' : 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ${dateObj > now ? 'from now' : 'ago'}`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ${dateObj > now ? 'from now' : 'ago'}`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ${dateObj > now ? 'from now' : 'ago'}`;
    return `${Math.floor(diffDays / 365)} years ${dateObj > now ? 'from now' : 'ago'}`;
  }
  
  return dateObj.toLocaleDateString('en-US', options[format] || options.short);
};

/**
 * Get initials from a name
 * @param {string} name - The full name
 * @returns {string} Initials
 */
export const getInitials = (name) => {
  if (!name) return '?';
  
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Truncate text with ellipsis
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Sort array by date field
 * @param {Array} items - Array to sort
 * @param {string} dateField - Name of date field
 * @param {string} direction - 'asc' or 'desc'
 * @returns {Array} Sorted array
 */
export const sortByDate = (items, dateField, direction = 'desc') => {
  return [...items].sort((a, b) => {
    const dateA = new Date(a[dateField]);
    const dateB = new Date(b[dateField]);
    
    if (isNaN(dateA.getTime())) return 1;
    if (isNaN(dateB.getTime())) return -1;
    
    return direction === 'desc' ? dateB - dateA : dateA - dateB;
  });
};

/**
 * Filter items by date range
 * @param {Array} items - Array to filter
 * @param {string} dateField - Name of date field
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Filtered array
 */
export const filterByDateRange = (items, dateField, startDate, endDate) => {
  if (!startDate && !endDate) return items;
  
  return items.filter(item => {
    const itemDate = new Date(item[dateField]);
    if (isNaN(itemDate.getTime())) return false;
    
    if (startDate && itemDate < startDate) return false;
    if (endDate && itemDate > endDate) return false;
    
    return true;
  });
};

/**
 * Get clinical alert level
 * @param {object} item - Clinical item
 * @param {string} type - Item type
 * @returns {string} Alert level ('critical', 'warning', 'info', 'none')
 */
export const getClinicalAlertLevel = (item, type) => {
  if (!item) return 'none';
  
  switch (type) {
    case 'lab':
      if (item.interpretation?.coding?.[0]?.code === 'H' || 
          item.interpretation?.coding?.[0]?.code === 'L') {
        return 'warning';
      }
      if (item.interpretation?.coding?.[0]?.code === 'HH' || 
          item.interpretation?.coding?.[0]?.code === 'LL') {
        return 'critical';
      }
      break;
      
    case 'medication':
      if (item.status === 'stopped' || item.status === 'cancelled') {
        return 'info';
      }
      if (item.priority === 'stat') {
        return 'critical';
      }
      break;
      
    case 'allergy':
      if (item.criticality === 'high') {
        return 'critical';
      }
      if (item.verificationStatus?.coding?.[0]?.code === 'unconfirmed') {
        return 'warning';
      }
      break;
      
    case 'problem':
      if (item.severity?.coding?.[0]?.code === 'severe') {
        return 'critical';
      }
      if (item.clinicalStatus?.coding?.[0]?.code === 'active') {
        return 'warning';
      }
      break;
  }
  
  return 'none';
};

/**
 * Generate unique ID for clinical items
 * @param {string} type - Item type
 * @param {object} item - The item
 * @returns {string} Unique ID
 */
export const generateClinicalItemId = (type, item) => {
  if (item.id) return item.id;
  
  // Generate ID based on type and key fields
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  
  switch (type) {
    case 'problem':
      return `prob_${item.code?.coding?.[0]?.code || random}_${timestamp}`;
    case 'medication':
      return `med_${item.medicationCodeableConcept?.coding?.[0]?.code || random}_${timestamp}`;
    case 'allergy':
      return `allergy_${item.code?.coding?.[0]?.code || random}_${timestamp}`;
    default:
      return `${type}_${random}_${timestamp}`;
  }
};

/**
 * Check if item matches search term
 * @param {object} item - Item to check
 * @param {string} searchTerm - Search term
 * @param {Array} searchFields - Fields to search in
 * @returns {boolean} Whether item matches
 */
export const matchesSearchTerm = (item, searchTerm, searchFields) => {
  if (!searchTerm) return true;
  
  const lowerSearch = searchTerm.toLowerCase();
  
  return searchFields.some(field => {
    const value = field.split('.').reduce((obj, key) => obj?.[key], item);
    return value?.toString().toLowerCase().includes(lowerSearch);
  });
};

/**
 * Group items by a field
 * @param {Array} items - Items to group
 * @param {string} groupField - Field to group by
 * @returns {object} Grouped items
 */
export const groupByField = (items, groupField) => {
  return items.reduce((groups, item) => {
    const key = groupField.split('.').reduce((obj, field) => obj?.[field], item) || 'Unknown';
    
    if (!groups[key]) {
      groups[key] = [];
    }
    
    groups[key].push(item);
    return groups;
  }, {});
};

/**
 * Calculate age from birth date
 * @param {string|Date} birthDate - Birth date
 * @returns {number} Age in years
 */
export const calculateAge = (birthDate) => {
  if (!birthDate) return null;
  
  const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  if (isNaN(birth.getTime())) return null;
  
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
};

/**
 * Format code display
 * @param {object} codeableConcept - FHIR CodeableConcept
 * @returns {string} Formatted display
 */
export const formatCodeDisplay = (codeableConcept) => {
  if (!codeableConcept) return '';
  
  if (codeableConcept.text) return codeableConcept.text;
  
  const coding = codeableConcept.coding?.[0];
  if (!coding) return '';
  
  return coding.display || coding.code || '';
};

/**
 * Get display value from FHIR reference
 * @param {object} reference - FHIR Reference
 * @returns {string} Display value
 */
export const getReferenceDisplay = (reference) => {
  if (!reference) return '';
  
  return reference.display || reference.reference?.split('/').pop() || '';
};