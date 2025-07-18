/**
 * useTabSearch Hook
 * Manages search functionality for clinical workspace tabs
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

const useTabSearch = (initialSearchFields = [], debounceDelay = 300) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchFields, setSearchFields] = useState(initialSearchFields);
  const [highlightSearch, setHighlightSearch] = useState(true);
  const [searchHistory, setSearchHistory] = useState([]);
  const searchTimeoutRef = useRef(null);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Debounced search term
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, debounceDelay);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, debounceDelay]);

  // Update search term
  const updateSearchTerm = useCallback((value) => {
    setSearchTerm(value);
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
  }, []);

  // Add to search history
  const addToHistory = useCallback((term) => {
    if (term && !searchHistory.includes(term)) {
      setSearchHistory(prev => [term, ...prev.slice(0, 9)]); // Keep last 10
    }
  }, [searchHistory]);

  // Search function
  const searchItems = useCallback((items, fields = null) => {
    const fieldsToSearch = fields || searchFields;
    const term = debouncedSearchTerm.toLowerCase().trim();
    
    if (!term) return items;

    return items.filter(item => {
      return fieldsToSearch.some(field => {
        // Handle nested fields with dot notation
        const value = field.split('.').reduce((obj, key) => {
          // Handle array index notation
          const match = key.match(/(\w+)\[(\d+)\]/);
          if (match) {
            return obj?.[match[1]]?.[parseInt(match[2])];
          }
          return obj?.[key];
        }, item);

        if (value == null) return false;

        // Convert to string and search
        const stringValue = typeof value === 'object' 
          ? JSON.stringify(value) 
          : value.toString();
          
        return stringValue.toLowerCase().includes(term);
      });
    });
  }, [debouncedSearchTerm, searchFields]);

  // Highlight search term in text
  const highlightSearchTerm = useCallback((text) => {
    if (!highlightSearch || !debouncedSearchTerm || !text) return text;

    const term = debouncedSearchTerm.toLowerCase();
    const textLower = text.toString().toLowerCase();
    
    if (!textLower.includes(term)) return text;

    // Create regex for case-insensitive search
    const regex = new RegExp(`(${debouncedSearchTerm})`, 'gi');
    const parts = text.toString().split(regex);

    return parts.map((part, index) => {
      if (part.toLowerCase() === term) {
        return { text: part, highlight: true, key: index };
      }
      return { text: part, highlight: false, key: index };
    });
  }, [debouncedSearchTerm, highlightSearch]);

  // Get highlighted text component (for React rendering)
  const getHighlightedText = useCallback((text) => {
    const highlighted = highlightSearchTerm(text);
    
    if (typeof highlighted === 'string') return highlighted;

    return highlighted.map(({ text, highlight, key }) => 
      highlight ? 
        <mark key={key} style={{ backgroundColor: 'yellow', padding: 0 }}>{text}</mark> : 
        text
    );
  }, [highlightSearchTerm]);

  // Search with multiple terms (OR operation)
  const searchWithMultipleTerms = useCallback((items, fields = null) => {
    const fieldsToSearch = fields || searchFields;
    const terms = debouncedSearchTerm.toLowerCase().trim().split(/\s+/);
    
    if (!terms.length || (terms.length === 1 && !terms[0])) return items;

    return items.filter(item => {
      return terms.some(term => {
        return fieldsToSearch.some(field => {
          const value = field.split('.').reduce((obj, key) => obj?.[key], item);
          if (value == null) return false;
          
          const stringValue = typeof value === 'object' 
            ? JSON.stringify(value) 
            : value.toString();
            
          return stringValue.toLowerCase().includes(term);
        });
      });
    });
  }, [debouncedSearchTerm, searchFields]);

  // Search with multiple terms (AND operation)
  const searchWithAllTerms = useCallback((items, fields = null) => {
    const fieldsToSearch = fields || searchFields;
    const terms = debouncedSearchTerm.toLowerCase().trim().split(/\s+/);
    
    if (!terms.length || (terms.length === 1 && !terms[0])) return items;

    return items.filter(item => {
      return terms.every(term => {
        return fieldsToSearch.some(field => {
          const value = field.split('.').reduce((obj, key) => obj?.[key], item);
          if (value == null) return false;
          
          const stringValue = typeof value === 'object' 
            ? JSON.stringify(value) 
            : value.toString();
            
          return stringValue.toLowerCase().includes(term);
        });
      });
    });
  }, [debouncedSearchTerm, searchFields]);

  // Fuzzy search (simple implementation)
  const fuzzySearch = useCallback((items, fields = null, threshold = 0.8) => {
    const fieldsToSearch = fields || searchFields;
    const term = debouncedSearchTerm.toLowerCase().trim();
    
    if (!term) return items;

    const calculateSimilarity = (str1, str2) => {
      const longer = str1.length > str2.length ? str1 : str2;
      const shorter = str1.length > str2.length ? str2 : str1;
      
      if (longer.length === 0) return 1.0;
      
      const editDistance = (s1, s2) => {
        const costs = [];
        for (let i = 0; i <= s1.length; i++) {
          let lastValue = i;
          for (let j = 0; j <= s2.length; j++) {
            if (i === 0) {
              costs[j] = j;
            } else if (j > 0) {
              let newValue = costs[j - 1];
              if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
              }
              costs[j - 1] = lastValue;
              lastValue = newValue;
            }
          }
          if (i > 0) costs[s2.length] = lastValue;
        }
        return costs[s2.length];
      };
      
      const distance = editDistance(longer, shorter);
      return (longer.length - distance) / longer.length;
    };

    return items.filter(item => {
      return fieldsToSearch.some(field => {
        const value = field.split('.').reduce((obj, key) => obj?.[key], item);
        if (value == null) return false;
        
        const stringValue = value.toString().toLowerCase();
        
        // Check if it's an exact substring match first
        if (stringValue.includes(term)) return true;
        
        // Then check fuzzy match
        return calculateSimilarity(stringValue, term) >= threshold;
      });
    });
  }, [debouncedSearchTerm, searchFields]);

  // Get search summary
  const getSearchSummary = useCallback((totalItems, filteredItems) => {
    if (!debouncedSearchTerm) return null;
    
    const count = filteredItems.length;
    const term = debouncedSearchTerm;
    
    if (count === 0) {
      return `No results found for "${term}"`;
    } else if (count === totalItems) {
      return `Showing all ${count} results`;
    } else {
      return `Found ${count} of ${totalItems} results for "${term}"`;
    }
  }, [debouncedSearchTerm]);

  return {
    // States
    searchTerm,
    debouncedSearchTerm,
    searchFields,
    highlightSearch,
    searchHistory,
    
    // Update functions
    updateSearchTerm,
    clearSearch,
    setSearchFields,
    setHighlightSearch,
    addToHistory,
    
    // Search functions
    searchItems,
    searchWithMultipleTerms,
    searchWithAllTerms,
    fuzzySearch,
    
    // Utility functions
    highlightSearchTerm,
    getHighlightedText,
    getSearchSummary
  };
};

export default useTabSearch;