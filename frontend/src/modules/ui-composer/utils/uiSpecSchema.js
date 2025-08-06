/**
 * UI Specification Schema for Clinical UI Composer
 * Defines the structure for dynamically generated clinical interfaces
 */

export const UI_SPEC_VERSION = "1.0";

export const COMPONENT_TYPES = {
  CHART: 'chart',
  GRID: 'grid',
  SUMMARY: 'summary',
  FORM: 'form',
  TIMELINE: 'timeline',
  STAT: 'stat',
  CONTAINER: 'container',
  TEXT: 'text'
};

export const LAYOUT_TYPES = {
  DASHBOARD: 'dashboard',
  REPORT: 'report',
  FOCUSED_VIEW: 'focused-view'
};

export const DATA_SCOPES = {
  POPULATION: 'population',
  PATIENT: 'patient',
  ENCOUNTER: 'encounter'
};

export const CHART_TYPES = {
  LINE: 'line',
  BAR: 'bar',
  PIE: 'pie',
  SCATTER: 'scatter',
  AREA: 'area'
};

export const GRID_TYPES = {
  PATIENT_LIST: 'patient-list',
  RESULT_LIST: 'result-list',
  MEDICATION_LIST: 'medication-list',
  GENERIC_TABLE: 'generic-table'
};

/**
 * Creates a default UI specification
 */
export const createDefaultUISpec = (name = 'New Dashboard', description = '') => ({
  version: UI_SPEC_VERSION,
  metadata: {
    name,
    description,
    created: new Date().toISOString(),
    clinicalContext: {
      scope: DATA_SCOPES.POPULATION,
      dataRequirements: []
    }
  },
  layout: {
    type: LAYOUT_TYPES.DASHBOARD,
    structure: {
      type: COMPONENT_TYPES.CONTAINER,
      props: {
        direction: 'column',
        spacing: 2
      },
      children: []
    }
  },
  dataSources: [],
  generatedComponents: {}
});

/**
 * Validates a UI specification
 */
export const validateUISpec = (spec) => {
  const errors = [];
  
  if (!spec.version) {
    errors.push('Missing version');
  }
  
  if (!spec.metadata || !spec.metadata.name) {
    errors.push('Missing metadata.name');
  }
  
  if (!spec.layout || !spec.layout.type) {
    errors.push('Missing layout.type');
  }
  
  if (!spec.layout.structure) {
    errors.push('Missing layout.structure');
  }
  
  if (!Array.isArray(spec.dataSources)) {
    errors.push('dataSources must be an array');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Creates a component specification
 */
export const createComponentSpec = (type, props = {}, children = []) => ({
  type,
  props: {
    id: `component-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...props
  },
  children,
  dataBinding: null
});

/**
 * Creates a data source specification
 */
export const createDataSourceSpec = (resourceType, query = {}, transform = null) => ({
  id: `datasource-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  resourceType,
  query,
  transform,
  caching: {
    enabled: true,
    ttl: 300000 // 5 minutes
  }
});

/**
 * Creates a chart component specification
 */
export const createChartSpec = (chartType, title, dataSourceId, xField, yField, options = {}) => ({
  ...createComponentSpec(COMPONENT_TYPES.CHART, {
    chartType,
    title,
    xField,
    yField,
    ...options
  }),
  dataBinding: {
    dataSourceId,
    fields: { x: xField, y: yField }
  }
});

/**
 * Creates a grid component specification
 */
export const createGridSpec = (gridType, title, dataSourceId, columns, options = {}) => ({
  ...createComponentSpec(COMPONENT_TYPES.GRID, {
    gridType,
    title,
    columns,
    ...options
  }),
  dataBinding: {
    dataSourceId,
    fields: { columns }
  }
});

/**
 * Creates a summary component specification
 */
export const createSummarySpec = (title, dataSourceId, aggregationType, field, options = {}) => ({
  ...createComponentSpec(COMPONENT_TYPES.SUMMARY, {
    title,
    aggregationType, // count, sum, avg, min, max
    field,
    ...options
  }),
  dataBinding: {
    dataSourceId,
    fields: { value: field }
  }
});

/**
 * Helper to find component by ID in the specification tree
 */
export const findComponentById = (spec, componentId) => {
  const traverse = (node) => {
    if (node.props && node.props.id === componentId) {
      return node;
    }
    
    if (node.children) {
      for (const child of node.children) {
        const found = traverse(child);
        if (found) return found;
      }
    }
    
    return null;
  };
  
  return traverse(spec.layout.structure);
};

/**
 * Helper to update component in specification tree
 */
export const updateComponentInSpec = (spec, componentId, updates) => {
  const traverse = (node) => {
    if (node.props && node.props.id === componentId) {
      Object.assign(node.props, updates);
      return true;
    }
    
    if (node.children) {
      for (const child of node.children) {
        if (traverse(child)) return true;
      }
    }
    
    return false;
  };
  
  const newSpec = JSON.parse(JSON.stringify(spec));
  traverse(newSpec.layout.structure);
  return newSpec;
};

/**
 * Helper to add component to specification tree
 */
export const addComponentToSpec = (spec, parentId, componentSpec) => {
  const traverse = (node) => {
    if (node.props && node.props.id === parentId) {
      if (!node.children) node.children = [];
      node.children.push(componentSpec);
      return true;
    }
    
    if (node.children) {
      for (const child of node.children) {
        if (traverse(child)) return true;
      }
    }
    
    return false;
  };
  
  const newSpec = JSON.parse(JSON.stringify(spec));
  traverse(newSpec.layout.structure);
  return newSpec;
};

export default {
  UI_SPEC_VERSION,
  COMPONENT_TYPES,
  LAYOUT_TYPES,
  DATA_SCOPES,
  CHART_TYPES,
  GRID_TYPES,
  createDefaultUISpec,
  validateUISpec,
  createComponentSpec,
  createDataSourceSpec,
  createChartSpec,
  createGridSpec,
  createSummarySpec,
  findComponentById,
  updateComponentInSpec,
  addComponentToSpec
};