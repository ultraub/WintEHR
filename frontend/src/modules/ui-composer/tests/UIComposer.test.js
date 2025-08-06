/**
 * UI Composer Tests
 * Basic tests for UI Composer functionality
 */

import { 
  createDefaultUISpec, 
  validateUISpec, 
  createComponentSpec,
  createDataSourceSpec,
  COMPONENT_TYPES,
  LAYOUT_TYPES,
  DATA_SCOPES
} from '../utils/uiSpecSchema';

import componentRegistry from '../utils/componentRegistry';
import DesignAgent from '../agents/DesignAgent';
import { extractPatientDemographics } from '../utils/clinicalDataHelpers';

describe('UI Composer', () => {
  
  describe('UI Specification Schema', () => {
    test('should create default UI spec', () => {
      const spec = createDefaultUISpec('Test Dashboard', 'A test dashboard');
      
      expect(spec.version).toBe('1.0');
      expect(spec.metadata.name).toBe('Test Dashboard');
      expect(spec.metadata.description).toBe('A test dashboard');
      expect(spec.layout.type).toBe(LAYOUT_TYPES.DASHBOARD);
      expect(spec.dataSources).toEqual([]);
    });
    
    test('should validate UI spec', () => {
      const validSpec = createDefaultUISpec('Test', 'Test description');
      const validation = validateUISpec(validSpec);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });
    
    test('should detect invalid UI spec', () => {
      const invalidSpec = {};
      const validation = validateUISpec(invalidSpec);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
    
    test('should create component spec', () => {
      const componentSpec = createComponentSpec(
        COMPONENT_TYPES.CHART,
        { title: 'Test Chart' }
      );
      
      expect(componentSpec.type).toBe(COMPONENT_TYPES.CHART);
      expect(componentSpec.props.title).toBe('Test Chart');
      expect(componentSpec.props.id).toBeDefined();
      expect(componentSpec.children).toEqual([]);
    });
    
    test('should create data source spec', () => {
      const dataSourceSpec = createDataSourceSpec('Patient', { _count: 10 });
      
      expect(dataSourceSpec.resourceType).toBe('Patient');
      expect(dataSourceSpec.query).toEqual({ _count: 10 });
      expect(dataSourceSpec.id).toBeDefined();
      expect(dataSourceSpec.caching.enabled).toBe(true);
    });
  });
  
  describe('Component Registry', () => {
    beforeEach(() => {
      componentRegistry.clear();
    });
    
    test('should register component', () => {
      const componentId = 'test-component';
      const componentCode = 'const TestComponent = () => <div>Test</div>';
      
      const entry = componentRegistry.register(componentId, componentCode);
      
      expect(entry.id).toBe(componentId);
      expect(entry.code).toBe(componentCode);
      expect(componentRegistry.has(componentId)).toBe(true);
    });
    
    test('should handle loading states', () => {
      const componentId = 'test-component';
      
      componentRegistry.setLoading(componentId, true);
      expect(componentRegistry.isLoading(componentId)).toBe(true);
      
      componentRegistry.setLoading(componentId, false);
      expect(componentRegistry.isLoading(componentId)).toBe(false);
    });
    
    test('should handle errors', () => {
      const componentId = 'test-component';
      const error = 'Test error';
      
      componentRegistry.setError(componentId, error);
      expect(componentRegistry.getError(componentId)).toBe(error);
      
      componentRegistry.clearError(componentId);
      expect(componentRegistry.getError(componentId)).toBeNull();
    });
    
    test('should get registry stats', () => {
      componentRegistry.register('comp1', 'code1');
      componentRegistry.register('comp2', 'code2');
      componentRegistry.setLoading('comp1', true);
      componentRegistry.setError('comp2', 'error');
      
      const stats = componentRegistry.getStats();
      
      expect(stats.total).toBe(2);
      expect(stats.loading).toBe(1);
      expect(stats.errors).toBe(1);
    });
  });
  
  describe('Design Agent', () => {
    let designAgent;
    
    beforeEach(() => {
      designAgent = new DesignAgent();
    });
    
    test('should require Claude for analysis', async () => {
      // Mock window.claude not available
      const originalClaude = window.claude;
      window.claude = null;
      
      await expect(designAgent.analyzeRequest('show all patients', {}))
        .resolves
        .toMatchObject({
          success: false,
          error: expect.stringContaining('Claude is not available')
        });
      
      window.claude = originalClaude;
    });
    
    test('should handle Claude API with proper prompt', async () => {
      // Test that the agent builds proper prompts
      const prompt = designAgent.buildAnalysisPrompt('show all diabetic patients', {
        patientId: 'test-123',
        userRole: 'physician'
      });
      
      expect(prompt).toContain('show all diabetic patients');
      expect(prompt).toContain('test-123');
      expect(prompt).toContain('physician');
      expect(prompt).toContain('FHIR');
    });
  });
  
  describe('Clinical Data Helpers', () => {
    test('should extract patient demographics', () => {
      const mockPatient = {
        id: 'patient-123',
        name: [{
          given: ['Patient'],
          family: 'Test123'
        }],
        gender: 'male',
        birthDate: '1990-01-01',
        address: [{
          line: ['123 Main St'],
          city: 'Anytown',
          state: 'CA',
          postalCode: '12345'
        }]
      };
      
      const demographics = extractPatientDemographics(mockPatient);
      
      expect(demographics.id).toBe('patient-123');
      expect(demographics.fullName).toBe('Patient Test123');
      expect(demographics.gender).toBe('male');
      expect(demographics.birthDate).toBe('1990-01-01');
      expect(demographics.address.city).toBe('Anytown');
    });
    
    test('should handle missing patient data', () => {
      const demographics = extractPatientDemographics(null);
      expect(demographics).toBeNull();
      
      const emptyPatient = {};
      const demographics2 = extractPatientDemographics(emptyPatient);
      expect(demographics2.fullName).toBe('');
    });
  });
  
  describe('Example Requests', () => {
    const exampleRequests = [
      'Show all diabetic patients with recent HbA1c > 8',
      'Create a medication adherence dashboard for hypertensive patients',
      'Display a timeline of lab results for this patient focused on kidney function',
      'Build an order entry form with decision support for antibiotic selection'
    ];
    
    test('should be ready to handle example requests with Claude', () => {
      const designAgent = new DesignAgent();
      
      // Verify example requests are defined
      expect(exampleRequests.length).toBeGreaterThan(0);
      
      // Verify agent is ready to process with Claude
      exampleRequests.forEach(request => {
        const prompt = designAgent.buildAnalysisPrompt(request, {});
        expect(prompt).toContain(request);
        expect(prompt).toContain('FHIR');
        expect(prompt).toContain('components');
      });
    });
  });
});

// Mock window.claude for testing
if (typeof window !== 'undefined') {
  window.claude = {
    complete: jest.fn().mockResolvedValue({
      match: jest.fn().mockReturnValue(['{"intent": "test", "scope": "population", "components": []}'])
    })
  };
}

export default {};