/**
 * Query History Management Hook
 * 
 * Manages query history, saved queries, and query favorites
 * for the FHIR Explorer v4 application
 */

import { useState, useEffect, useCallback } from 'react';

// Storage keys
const QUERY_HISTORY_KEY = 'fhir-explorer-query-history';
const SAVED_QUERIES_KEY = 'fhir-explorer-saved-queries';
const QUERY_FAVORITES_KEY = 'fhir-explorer-query-favorites';

// Configuration
const MAX_HISTORY_SIZE = 50;
const MAX_SAVED_QUERIES = 100;

/**
 * Custom hook for query history management
 */
export const useQueryHistory = () => {
  const [queryHistory, setQueryHistory] = useState([]);
  const [savedQueries, setSavedQueries] = useState([]);
  const [favorites, setFavorites] = useState([]);

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const history = JSON.parse(localStorage.getItem(QUERY_HISTORY_KEY) || '[]');
      const saved = JSON.parse(localStorage.getItem(SAVED_QUERIES_KEY) || '[]');
      const favs = JSON.parse(localStorage.getItem(QUERY_FAVORITES_KEY) || '[]');
      
      setQueryHistory(history);
      setSavedQueries(saved);
      setFavorites(favs);
    } catch (err) {
      console.error('Failed to load query data from localStorage:', err);
    }
  }, []);

  // Save query history to localStorage
  const saveHistoryToStorage = useCallback((history) => {
    try {
      localStorage.setItem(QUERY_HISTORY_KEY, JSON.stringify(history));
    } catch (err) {
      console.error('Failed to save query history:', err);
    }
  }, []);

  // Save saved queries to localStorage
  const saveSavedQueriesToStorage = useCallback((saved) => {
    try {
      localStorage.setItem(SAVED_QUERIES_KEY, JSON.stringify(saved));
    } catch (err) {
      console.error('Failed to save saved queries:', err);
    }
  }, []);

  // Save favorites to localStorage
  const saveFavoritesToStorage = useCallback((favs) => {
    try {
      localStorage.setItem(QUERY_FAVORITES_KEY, JSON.stringify(favs));
    } catch (err) {
      console.error('Failed to save favorites:', err);
    }
  }, []);

  // Add query to history
  const addToHistory = useCallback((queryData) => {
    const {
      query,
      resultCount = 0,
      executionTime = 0,
      resourceType = null,
      timestamp = new Date().toISOString(),
      error = null
    } = queryData;

    // Validate required fields
    if (!query || typeof query !== 'string') {
      console.warn('Invalid query data provided to addToHistory');
      return;
    }

    const historyEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      query: query.trim(),
      resultCount,
      executionTime,
      resourceType,
      timestamp,
      error
    };

    setQueryHistory(prevHistory => {
      // Remove duplicate queries (same query string)
      const filteredHistory = prevHistory.filter(item => item.query !== query);
      
      // Add new entry at the beginning
      const newHistory = [historyEntry, ...filteredHistory];
      
      // Limit history size
      const limitedHistory = newHistory.slice(0, MAX_HISTORY_SIZE);
      
      // Save to localStorage
      saveHistoryToStorage(limitedHistory);
      
      return limitedHistory;
    });
  }, [saveHistoryToStorage]);

  // Save a query with metadata
  const saveQuery = useCallback((queryData) => {
    const {
      query,
      name,
      description = '',
      tags = [],
      resourceType = null,
      isPublic = false,
      category = 'general'
    } = queryData;

    // Validate required fields
    if (!query || !name) {
      throw new Error('Query and name are required');
    }

    const savedQuery = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      query: query.trim(),
      name: name.trim(),
      description: description.trim(),
      tags: Array.isArray(tags) ? tags : [],
      resourceType,
      isPublic,
      category,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      useCount: 0
    };

    setSavedQueries(prevSaved => {
      // Check for duplicate names
      const existingIndex = prevSaved.findIndex(item => item.name === name);
      let newSaved;
      
      if (existingIndex >= 0) {
        // Update existing query
        newSaved = [...prevSaved];
        newSaved[existingIndex] = {
          ...newSaved[existingIndex],
          ...savedQuery,
          id: newSaved[existingIndex].id, // Keep original ID
          createdAt: newSaved[existingIndex].createdAt, // Keep original creation date
          useCount: newSaved[existingIndex].useCount // Keep use count
        };
      } else {
        // Add new query
        newSaved = [savedQuery, ...prevSaved];
      }
      
      // Limit saved queries
      const limitedSaved = newSaved.slice(0, MAX_SAVED_QUERIES);
      
      // Save to localStorage
      saveSavedQueriesToStorage(limitedSaved);
      
      return limitedSaved;
    });

    return savedQuery.id;
  }, [saveSavedQueriesToStorage]);

  // Load a saved query
  const loadQuery = useCallback((queryId) => {
    const query = savedQueries.find(q => q.id === queryId);
    if (!query) {
      throw new Error('Query not found');
    }

    // Increment use count
    setSavedQueries(prevSaved => {
      const newSaved = prevSaved.map(q => 
        q.id === queryId 
          ? { ...q, useCount: (q.useCount || 0) + 1, lastUsed: new Date().toISOString() }
          : q
      );
      saveSavedQueriesToStorage(newSaved);
      return newSaved;
    });

    return query;
  }, [savedQueries, saveSavedQueriesToStorage]);

  // Delete a saved query
  const deleteQuery = useCallback((queryId) => {
    setSavedQueries(prevSaved => {
      const newSaved = prevSaved.filter(q => q.id !== queryId);
      saveSavedQueriesToStorage(newSaved);
      return newSaved;
    });

    // Also remove from favorites if present
    setFavorites(prevFavorites => {
      const newFavorites = prevFavorites.filter(fav => fav !== queryId);
      saveFavoritesToStorage(newFavorites);
      return newFavorites;
    });
  }, [saveSavedQueriesToStorage, saveFavoritesToStorage]);

  // Toggle query favorite status
  const toggleFavorite = useCallback((queryId) => {
    setFavorites(prevFavorites => {
      const isFavorite = prevFavorites.includes(queryId);
      const newFavorites = isFavorite
        ? prevFavorites.filter(fav => fav !== queryId)
        : [...prevFavorites, queryId];
      
      saveFavoritesToStorage(newFavorites);
      return newFavorites;
    });
  }, [saveFavoritesToStorage]);

  // Get favorite queries
  const getFavoriteQueries = useCallback(() => {
    return savedQueries.filter(query => favorites.includes(query.id));
  }, [savedQueries, favorites]);

  // Search queries
  const searchQueries = useCallback((searchTerm, options = {}) => {
    const {
      includeHistory = true,
      includeSaved = true,
      resourceType = null,
      category = null,
      tags = []
    } = options;

    const results = [];
    const term = searchTerm.toLowerCase().trim();

    if (includeSaved) {
      savedQueries.forEach(query => {
        // Filter by resource type if specified
        if (resourceType && query.resourceType !== resourceType) {
          return;
        }

        // Filter by category if specified
        if (category && query.category !== category) {
          return;
        }

        // Filter by tags if specified
        if (tags.length > 0 && !tags.some(tag => query.tags.includes(tag))) {
          return;
        }

        // Search in name, description, and query
        const searchableText = `${query.name} ${query.description} ${query.query}`.toLowerCase();
        if (searchableText.includes(term)) {
          results.push({
            ...query,
            type: 'saved',
            isFavorite: favorites.includes(query.id)
          });
        }
      });
    }

    if (includeHistory && !resourceType && !category && tags.length === 0) {
      queryHistory.forEach(query => {
        const searchableText = query.query.toLowerCase();
        if (searchableText.includes(term)) {
          results.push({
            ...query,
            type: 'history'
          });
        }
      });
    }

    return results;
  }, [savedQueries, queryHistory, favorites]);

  // Clear history
  const clearHistory = useCallback(() => {
    setQueryHistory([]);
    saveHistoryToStorage([]);
  }, [saveHistoryToStorage]);

  // Clear all saved queries
  const clearSavedQueries = useCallback(() => {
    setSavedQueries([]);
    setFavorites([]);
    saveSavedQueriesToStorage([]);
    saveFavoritesToStorage([]);
  }, [saveSavedQueriesToStorage, saveFavoritesToStorage]);

  // Export data
  const exportData = useCallback(() => {
    return {
      queryHistory,
      savedQueries,
      favorites,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
  }, [queryHistory, savedQueries, favorites]);

  // Import data
  const importData = useCallback((data) => {
    try {
      const { queryHistory: importedHistory, savedQueries: importedSaved, favorites: importedFavorites } = data;

      if (importedHistory && Array.isArray(importedHistory)) {
        setQueryHistory(importedHistory.slice(0, MAX_HISTORY_SIZE));
        saveHistoryToStorage(importedHistory.slice(0, MAX_HISTORY_SIZE));
      }

      if (importedSaved && Array.isArray(importedSaved)) {
        setSavedQueries(importedSaved.slice(0, MAX_SAVED_QUERIES));
        saveSavedQueriesToStorage(importedSaved.slice(0, MAX_SAVED_QUERIES));
      }

      if (importedFavorites && Array.isArray(importedFavorites)) {
        setFavorites(importedFavorites);
        saveFavoritesToStorage(importedFavorites);
      }

      return true;
    } catch (err) {
      console.error('Failed to import data:', err);
      return false;
    }
  }, [saveHistoryToStorage, saveSavedQueriesToStorage, saveFavoritesToStorage]);

  // Get statistics
  const getStatistics = useCallback(() => {
    const totalQueries = queryHistory.length + savedQueries.length;
    const favoriteCount = favorites.length;
    const categoryCounts = savedQueries.reduce((acc, query) => {
      acc[query.category] = (acc[query.category] || 0) + 1;
      return acc;
    }, {});
    
    const resourceTypeCounts = savedQueries.reduce((acc, query) => {
      if (query.resourceType) {
        acc[query.resourceType] = (acc[query.resourceType] || 0) + 1;
      }
      return acc;
    }, {});

    const recentActivity = queryHistory.slice(0, 5);
    const popularQueries = savedQueries
      .sort((a, b) => (b.useCount || 0) - (a.useCount || 0))
      .slice(0, 5);

    return {
      totalQueries,
      historyCount: queryHistory.length,
      savedCount: savedQueries.length,
      favoriteCount,
      categoryCounts,
      resourceTypeCounts,
      recentActivity,
      popularQueries
    };
  }, [queryHistory, savedQueries, favorites]);

  return {
    // State
    queryHistory,
    savedQueries,
    favorites,

    // History management
    addToHistory,
    clearHistory,

    // Saved query management
    saveQuery,
    loadQuery,
    deleteQuery,
    clearSavedQueries,

    // Favorites management
    toggleFavorite,
    getFavoriteQueries,

    // Search and filtering
    searchQueries,

    // Data management
    exportData,
    importData,

    // Statistics
    getStatistics,

    // Computed values
    hasHistory: queryHistory.length > 0,
    hasSavedQueries: savedQueries.length > 0,
    hasFavorites: favorites.length > 0
  };
};