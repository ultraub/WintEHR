/**
 * UI Composer Context for state management
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { createDefaultUISpec, validateUISpec } from '../utils/uiSpecSchema';
import componentRegistry from '../utils/componentRegistry';

const UIComposerContext = createContext();

// Action types
const ActionTypes = {
  SET_CURRENT_SPEC: 'SET_CURRENT_SPEC',
  UPDATE_SPEC: 'UPDATE_SPEC',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_AGENT_STATUS: 'SET_AGENT_STATUS',
  ADD_FEEDBACK: 'ADD_FEEDBACK',
  SET_PREVIEW_MODE: 'SET_PREVIEW_MODE',
  SET_GENERATION_STATUS: 'SET_GENERATION_STATUS',
  UPDATE_COMPONENT_STATUS: 'UPDATE_COMPONENT_STATUS',
  SET_DASHBOARD_LIST: 'SET_DASHBOARD_LIST',
  SET_CURRENT_REQUEST: 'SET_CURRENT_REQUEST',
  ADD_CONVERSATION_ENTRY: 'ADD_CONVERSATION_ENTRY',
  SET_DATA_CACHE: 'SET_DATA_CACHE',
  CLEAR_DATA_CACHE: 'CLEAR_DATA_CACHE'
};

// Initial state
const initialState = {
  // Current UI specification
  currentSpec: null,
  
  // Loading states
  loading: {
    spec: false,
    agents: false,
    components: false,
    data: false
  },
  
  // Errors
  errors: {
    spec: null,
    agents: null,
    components: null,
    data: null
  },
  
  // Agent status
  agentStatus: {
    design: { active: false, progress: 0, message: '' },
    builder: { active: false, progress: 0, message: '' },
    refinement: { active: false, progress: 0, message: '' }
  },
  
  // User feedback
  feedback: [],
  
  // Preview mode
  previewMode: 'edit', // 'edit' | 'preview' | 'fullscreen'
  
  // Generation status
  generationStatus: {
    phase: 'idle', // 'idle' | 'analyzing' | 'designing' | 'building' | 'refining' | 'complete'
    progress: 0,
    message: ''
  },
  
  // Component status tracking
  componentStatus: {}, // componentId -> { loading, error, ready }
  
  // Dashboard management
  dashboardList: [],
  
  // Current request
  currentRequest: '',
  
  // Conversation history
  conversation: [],
  
  // Data cache
  dataCache: new Map()
};

// Reducer
const uiComposerReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.SET_CURRENT_SPEC:
      return {
        ...state,
        currentSpec: action.payload,
        errors: { ...state.errors, spec: null }
      };
      
    case ActionTypes.UPDATE_SPEC:
      return {
        ...state,
        currentSpec: action.payload.spec,
        errors: { ...state.errors, spec: action.payload.error || null }
      };
      
    case ActionTypes.SET_LOADING:
      return {
        ...state,
        loading: {
          ...state.loading,
          [action.payload.type]: action.payload.loading
        }
      };
      
    case ActionTypes.SET_ERROR:
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.payload.type]: action.payload.error
        }
      };
      
    case ActionTypes.CLEAR_ERROR:
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.payload.type]: null
        }
      };
      
    case ActionTypes.SET_AGENT_STATUS:
      return {
        ...state,
        agentStatus: {
          ...state.agentStatus,
          [action.payload.agent]: action.payload.status
        }
      };
      
    case ActionTypes.ADD_FEEDBACK:
      return {
        ...state,
        feedback: [...state.feedback, action.payload]
      };
      
    case ActionTypes.SET_PREVIEW_MODE:
      return {
        ...state,
        previewMode: action.payload
      };
      
    case ActionTypes.SET_GENERATION_STATUS:
      return {
        ...state,
        generationStatus: action.payload
      };
      
    case ActionTypes.UPDATE_COMPONENT_STATUS:
      return {
        ...state,
        componentStatus: {
          ...state.componentStatus,
          [action.payload.componentId]: action.payload.status
        }
      };
      
    case ActionTypes.SET_DASHBOARD_LIST:
      return {
        ...state,
        dashboardList: action.payload
      };
      
    case ActionTypes.SET_CURRENT_REQUEST:
      return {
        ...state,
        currentRequest: action.payload
      };
      
    case ActionTypes.ADD_CONVERSATION_ENTRY:
      return {
        ...state,
        conversation: [...state.conversation, action.payload]
      };
      
    case ActionTypes.SET_DATA_CACHE:
      return {
        ...state,
        dataCache: new Map([...state.dataCache, ...action.payload])
      };
      
    case ActionTypes.CLEAR_DATA_CACHE:
      return {
        ...state,
        dataCache: new Map()
      };
      
    default:
      return state;
  }
};

// Provider component
export const UIComposerProvider = ({ children }) => {
  const [state, dispatch] = useReducer(uiComposerReducer, initialState);
  
  // Actions
  const setCurrentSpec = useCallback((spec) => {
    const validation = validateUISpec(spec);
    if (validation.valid) {
      dispatch({ type: ActionTypes.SET_CURRENT_SPEC, payload: spec });
    } else {
      dispatch({ 
        type: ActionTypes.SET_ERROR, 
        payload: { type: 'spec', error: validation.errors.join(', ') }
      });
    }
  }, []);
  
  const updateSpec = useCallback((spec) => {
    const validation = validateUISpec(spec);
    dispatch({ 
      type: ActionTypes.UPDATE_SPEC, 
      payload: { 
        spec: validation.valid ? spec : state.currentSpec, 
        error: validation.valid ? null : validation.errors.join(', ')
      }
    });
  }, [state.currentSpec]);
  
  const createNewSpec = useCallback((name, description) => {
    const newSpec = createDefaultUISpec(name, description);
    setCurrentSpec(newSpec);
    return newSpec;
  }, [setCurrentSpec]);
  
  const setLoading = useCallback((type, loading) => {
    dispatch({ 
      type: ActionTypes.SET_LOADING, 
      payload: { type, loading }
    });
  }, []);
  
  const setError = useCallback((type, error) => {
    dispatch({ 
      type: ActionTypes.SET_ERROR, 
      payload: { type, error }
    });
  }, []);
  
  const clearError = useCallback((type) => {
    dispatch({ 
      type: ActionTypes.CLEAR_ERROR, 
      payload: { type }
    });
  }, []);
  
  const setAgentStatus = useCallback((agent, status) => {
    dispatch({ 
      type: ActionTypes.SET_AGENT_STATUS, 
      payload: { agent, status }
    });
  }, []);
  
  const addFeedback = useCallback((feedback) => {
    const feedbackEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ...feedback
    };
    dispatch({ 
      type: ActionTypes.ADD_FEEDBACK, 
      payload: feedbackEntry
    });
    return feedbackEntry;
  }, []);
  
  const setPreviewMode = useCallback((mode) => {
    dispatch({ 
      type: ActionTypes.SET_PREVIEW_MODE, 
      payload: mode
    });
  }, []);
  
  const setGenerationStatus = useCallback((phase, progress = 0, message = '') => {
    dispatch({ 
      type: ActionTypes.SET_GENERATION_STATUS, 
      payload: { phase, progress, message }
    });
  }, []);
  
  const updateComponentStatus = useCallback((componentId, status) => {
    dispatch({ 
      type: ActionTypes.UPDATE_COMPONENT_STATUS, 
      payload: { componentId, status }
    });
  }, []);
  
  const setDashboardList = useCallback((dashboards) => {
    dispatch({ 
      type: ActionTypes.SET_DASHBOARD_LIST, 
      payload: dashboards
    });
  }, []);
  
  const setCurrentRequest = useCallback((request) => {
    dispatch({ 
      type: ActionTypes.SET_CURRENT_REQUEST, 
      payload: request
    });
  }, []);
  
  const addConversationEntry = useCallback((entry) => {
    const conversationEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ...entry
    };
    dispatch({ 
      type: ActionTypes.ADD_CONVERSATION_ENTRY, 
      payload: conversationEntry
    });
    return conversationEntry;
  }, []);
  
  const setDataCache = useCallback((cacheEntries) => {
    dispatch({ 
      type: ActionTypes.SET_DATA_CACHE, 
      payload: cacheEntries
    });
  }, []);
  
  const clearDataCache = useCallback(() => {
    dispatch({ type: ActionTypes.CLEAR_DATA_CACHE });
  }, []);
  
  // Computed values
  const isLoading = state.loading.spec || state.loading.agents || 
                   state.loading.components || state.loading.data;
  
  const hasErrors = !!(state.errors.spec || state.errors.agents || 
                      state.errors.components || state.errors.data);
  
  const canGenerate = state.currentRequest && !isLoading && !hasErrors;
  
  const value = {
    // State
    ...state,
    
    // Actions
    setCurrentSpec,
    updateSpec,
    createNewSpec,
    setLoading,
    setError,
    clearError,
    setAgentStatus,
    addFeedback,
    setPreviewMode,
    setGenerationStatus,
    updateComponentStatus,
    setDashboardList,
    setCurrentRequest,
    addConversationEntry,
    setDataCache,
    clearDataCache,
    
    // Computed
    isLoading,
    hasErrors,
    canGenerate
  };
  
  return (
    <UIComposerContext.Provider value={value}>
      {children}
    </UIComposerContext.Provider>
  );
};

// Hook to use the context
export const useUIComposer = () => {
  const context = useContext(UIComposerContext);
  if (!context) {
    throw new Error('useUIComposer must be used within a UIComposerProvider');
  }
  return context;
};

export default UIComposerContext;