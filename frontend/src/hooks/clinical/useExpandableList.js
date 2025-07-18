/**
 * useExpandableList Hook
 * Manages expandable list item states for clinical workspace
 */

import { useState, useCallback, useMemo } from 'react';

const useExpandableList = (initialExpanded = {}) => {
  const [expandedItems, setExpandedItems] = useState(initialExpanded);
  const [expandAll, setExpandAll] = useState(false);

  // Toggle single item
  const toggleItem = useCallback((itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  }, []);

  // Expand single item
  const expandItem = useCallback((itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: true
    }));
  }, []);

  // Collapse single item
  const collapseItem = useCallback((itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: false
    }));
  }, []);

  // Toggle all items
  const toggleAll = useCallback((itemIds = null) => {
    if (!itemIds) {
      // If no IDs provided, just toggle the expandAll state
      setExpandAll(prev => !prev);
      return;
    }

    const allExpanded = itemIds.every(id => expandedItems[id]);
    
    if (allExpanded) {
      // Collapse all
      const collapsed = {};
      itemIds.forEach(id => {
        collapsed[id] = false;
      });
      setExpandedItems(collapsed);
      setExpandAll(false);
    } else {
      // Expand all
      const expanded = { ...expandedItems };
      itemIds.forEach(id => {
        expanded[id] = true;
      });
      setExpandedItems(expanded);
      setExpandAll(true);
    }
  }, [expandedItems]);

  // Expand multiple items
  const expandItems = useCallback((itemIds) => {
    const updates = {};
    itemIds.forEach(id => {
      updates[id] = true;
    });
    setExpandedItems(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  // Collapse multiple items
  const collapseItems = useCallback((itemIds) => {
    const updates = {};
    itemIds.forEach(id => {
      updates[id] = false;
    });
    setExpandedItems(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  // Reset all expanded states
  const resetExpanded = useCallback(() => {
    setExpandedItems(initialExpanded);
    setExpandAll(false);
  }, [initialExpanded]);

  // Check if item is expanded
  const isExpanded = useCallback((itemId) => {
    return expandedItems[itemId] || false;
  }, [expandedItems]);

  // Get count of expanded items
  const expandedCount = useMemo(() => {
    return Object.values(expandedItems).filter(Boolean).length;
  }, [expandedItems]);

  // Get list of expanded item IDs
  const expandedIds = useMemo(() => {
    return Object.entries(expandedItems)
      .filter(([_, expanded]) => expanded)
      .map(([id]) => id);
  }, [expandedItems]);

  // Check if all items in list are expanded
  const areAllExpanded = useCallback((itemIds) => {
    if (!itemIds || itemIds.length === 0) return false;
    return itemIds.every(id => expandedItems[id]);
  }, [expandedItems]);

  // Check if any items in list are expanded
  const areAnyExpanded = useCallback((itemIds) => {
    if (!itemIds || itemIds.length === 0) return false;
    return itemIds.some(id => expandedItems[id]);
  }, [expandedItems]);

  return {
    // States
    expandedItems,
    expandAll,
    expandedCount,
    expandedIds,
    
    // Single item functions
    toggleItem,
    expandItem,
    collapseItem,
    isExpanded,
    
    // Multiple item functions
    toggleAll,
    expandItems,
    collapseItems,
    resetExpanded,
    
    // Check functions
    areAllExpanded,
    areAnyExpanded
  };
};

export default useExpandableList;