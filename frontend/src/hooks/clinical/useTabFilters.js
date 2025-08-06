/**
 * useTabFilters Hook
 * Manages filter states for clinical workspace tabs
 */

import { useState, useCallback, useMemo } from 'react';

const useTabFilters = (initialFilters = {}) => {
  // Core filter states
  const [filters, setFilters] = useState({
    status: 'all',
    severity: 'all',
    priority: 'all',
    category: 'all',
    verificationStatus: 'all',
    dateRange: {
      enabled: false,
      operator: 'between',
      startDate: null,
      endDate: null,
      singleDate: null
    },
    ...initialFilters
  });

  // Sort configuration
  const [sortConfig, setSortConfig] = useState({
    field: 'date',
    direction: 'desc'
  });

  // Update single filter
  const updateFilter = useCallback((filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  }, []);

  // Update multiple filters at once
  const updateFilters = useCallback((updates) => {
    setFilters(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  // Reset all filters
  const resetFilters = useCallback(() => {
    setFilters({
      status: 'all',
      severity: 'all',
      priority: 'all',
      category: 'all',
      verificationStatus: 'all',
      dateRange: {
        enabled: false,
        operator: 'between',
        startDate: null,
        endDate: null,
        singleDate: null
      },
      ...initialFilters
    });
  }, [initialFilters]);

  // Update date range filter
  const updateDateRange = useCallback((updates) => {
    setFilters(prev => ({
      ...prev,
      dateRange: {
        ...prev.dateRange,
        ...updates
      }
    }));
  }, []);

  // Update sort configuration
  const updateSort = useCallback((field, direction = null) => {
    setSortConfig(prev => {
      // If same field, toggle direction
      if (prev.field === field && !direction) {
        return {
          field,
          direction: prev.direction === 'asc' ? 'desc' : 'asc'
        };
      }
      
      // Otherwise set new field and direction
      return {
        field,
        direction: direction || 'desc'
      };
    });
  }, []);

  // Apply filters to data
  const applyFilters = useCallback((data, filterConfig = {}) => {
    let filtered = [...data];

    // Status filter
    if (filters.status !== 'all') {
      const statusField = filterConfig.statusField || 'status';
      filtered = filtered.filter(item => {
        const status = statusField.split('.').reduce((obj, key) => obj?.[key], item);
        return status === filters.status;
      });
    }

    // Severity filter
    if (filters.severity !== 'all') {
      const severityField = filterConfig.severityField || 'severity';
      filtered = filtered.filter(item => {
        const severity = severityField.split('.').reduce((obj, key) => obj?.[key], item);
        return severity?.toLowerCase() === filters.severity.toLowerCase();
      });
    }

    // Priority filter
    if (filters.priority !== 'all') {
      const priorityField = filterConfig.priorityField || 'priority';
      filtered = filtered.filter(item => {
        const priority = priorityField.split('.').reduce((obj, key) => obj?.[key], item);
        return priority?.toLowerCase() === filters.priority.toLowerCase();
      });
    }

    // Category filter
    if (filters.category !== 'all') {
      const categoryField = filterConfig.categoryField || 'category';
      filtered = filtered.filter(item => {
        const category = categoryField.split('.').reduce((obj, key) => obj?.[key], item);
        return category === filters.category;
      });
    }

    // Verification status filter
    if (filters.verificationStatus !== 'all') {
      const verificationField = filterConfig.verificationField || 'verificationStatus.coding[0].code';
      filtered = filtered.filter(item => {
        const verification = verificationField.split('.').reduce((obj, key) => {
          // Handle array index notation
          const match = key.match(/(\w+)\[(\d+)\]/);
          if (match) {
            return obj?.[match[1]]?.[parseInt(match[2])];
          }
          return obj?.[key];
        }, item);
        return verification === filters.verificationStatus;
      });
    }

    // Date range filter
    if (filters.dateRange.enabled) {
      const dateField = filterConfig.dateField || 'date';
      filtered = filtered.filter(item => {
        const itemDate = dateField.split('.').reduce((obj, key) => obj?.[key], item);
        if (!itemDate) return false;
        
        const date = new Date(itemDate);
        if (isNaN(date.getTime())) return false;

        const { operator, startDate, endDate, singleDate } = filters.dateRange;

        switch (operator) {
          case 'between':
            if (!startDate || !endDate) return true;
            return date >= startDate && date <= endDate;
            
          case 'before':
          case 'lt':
            if (!singleDate) return true;
            return date < singleDate;
            
          case 'after':
          case 'gt':
            if (!singleDate) return true;
            return date > singleDate;
            
          case 'on':
          case 'eq':
            if (!singleDate) return true;
            const singleDateStart = new Date(singleDate);
            singleDateStart.setHours(0, 0, 0, 0);
            const singleDateEnd = new Date(singleDate);
            singleDateEnd.setHours(23, 59, 59, 999);
            return date >= singleDateStart && date <= singleDateEnd;
            
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [filters]);

  // Apply sorting to data
  const applySort = useCallback((data, sortField = null) => {
    const field = sortField || sortConfig.field;
    const direction = sortConfig.direction;

    return [...data].sort((a, b) => {
      const aValue = field.split('.').reduce((obj, key) => obj?.[key], a);
      const bValue = field.split('.').reduce((obj, key) => obj?.[key], b);

      // Handle null/undefined
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Handle dates
      if (field.includes('date') || field.includes('Date')) {
        const aDate = new Date(aValue);
        const bDate = new Date(bValue);
        
        if (isNaN(aDate.getTime())) return 1;
        if (isNaN(bDate.getTime())) return -1;
        
        return direction === 'asc' ? aDate - bDate : bDate - aDate;
      }

      // Handle numbers
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle strings
      const aStr = aValue.toString().toLowerCase();
      const bStr = bValue.toString().toLowerCase();
      
      if (direction === 'asc') {
        return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      } else {
        return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
      }
    });
  }, [sortConfig]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return filters.status !== 'all' ||
           filters.severity !== 'all' ||
           filters.priority !== 'all' ||
           filters.category !== 'all' ||
           filters.verificationStatus !== 'all' ||
           filters.dateRange.enabled;
  }, [filters]);

  // Get active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status !== 'all') count++;
    if (filters.severity !== 'all') count++;
    if (filters.priority !== 'all') count++;
    if (filters.category !== 'all') count++;
    if (filters.verificationStatus !== 'all') count++;
    if (filters.dateRange.enabled) count++;
    return count;
  }, [filters]);

  return {
    // States
    filters,
    sortConfig,
    hasActiveFilters,
    activeFilterCount,
    
    // Update functions
    updateFilter,
    updateFilters,
    resetFilters,
    updateDateRange,
    updateSort,
    
    // Apply functions
    applyFilters,
    applySort
  };
};

export default useTabFilters;