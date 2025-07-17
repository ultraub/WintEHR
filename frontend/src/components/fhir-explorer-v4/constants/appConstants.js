/**
 * FHIR Explorer v4 Application Constants
 * 
 * Centralized constants to avoid circular dependencies
 */

// Application modes and views
export const APP_MODES = {
  DASHBOARD: 'dashboard',
  DISCOVERY: 'discovery',
  QUERY_BUILDING: 'query-building',
  VISUALIZATION: 'visualization',
  LEARNING: 'learning'
};

export const DISCOVERY_VIEWS = {
  CATALOG: 'catalog',
  SCHEMA: 'schema',
  RELATIONSHIPS: 'relationships'
};

export const QUERY_VIEWS = {
  VISUAL: 'visual',
  NATURAL_LANGUAGE: 'natural-language',
  AI_ASSISTANT: 'ai-assistant',
  PLAYGROUND: 'playground'
};

export const VISUALIZATION_VIEWS = {
  CHARTS: 'charts',
  TIMELINE: 'timeline',
  NETWORK: 'network',
  ANALYTICS: 'analytics'
};

export const LEARNING_VIEWS = {
  TUTORIALS: 'tutorials',
  SCENARIOS: 'scenarios',
  HELP: 'help'
};