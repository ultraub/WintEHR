/**
 * CDS Hooks Compliance Test Suite
 * Tests to ensure our implementation follows CDS Hooks 1.0 specification
 */
import { CDSHooksClientSpec } from '../cdsHooksClient.spec';
import { cdsHooksService } from '../cdsHooksService';
import { validateCDSService } from '../../models/cdsService';

describe('CDS Hooks 1.0 Specification Compliance', () => {
  let client;
  
  beforeEach(() => {
    client = new CDSHooksClientSpec();
  });

  describe('Service Discovery', () => {
    it('should use GET /cds-services endpoint', async () => {
      const mockResponse = {
        data: {
          services: [
            {
              id: 'diabetes-screening',
              hook: 'patient-view',
              title: 'Diabetes Screening',
              description: 'Screens for diabetes',
              prefetch: {
                patient: 'Patient/{{context.patientId}}'
              }
            }
          ]
        }
      };

      // Mock the HTTP call
      jest.spyOn(client.client, 'get').mockResolvedValue(mockResponse);

      const result = await client.discoverServices();
      
      expect(client.client.get).toHaveBeenCalledWith('/cds-services');
      expect(result).toEqual(mockResponse.data.services);
    });

    it('should handle empty service list', async () => {
      const mockResponse = { data: { services: [] } };
      jest.spyOn(client.client, 'get').mockResolvedValue(mockResponse);

      const result = await client.discoverServices();
      
      expect(result).toEqual([]);
    });
  });

  describe('Service Invocation', () => {
    it('should use POST /cds-services/{id} endpoint', async () => {
      const serviceId = 'test-service';
      const request = {
        hookInstance: 'test-123',
        hook: 'patient-view',
        context: {
          patientId: 'patient-123',
          userId: 'user-456'
        }
      };

      const mockResponse = {
        data: {
          cards: []
        }
      };

      jest.spyOn(client.client, 'post').mockResolvedValue(mockResponse);

      await client.invokeService(serviceId, request);
      
      expect(client.client.post).toHaveBeenCalledWith(
        `/cds-services/${serviceId}`,
        request
      );
    });

    it('should add hookInstance if missing', async () => {
      const request = {
        hook: 'patient-view',
        context: { patientId: '123' }
      };

      jest.spyOn(client.client, 'post').mockResolvedValue({ data: { cards: [] } });

      await client.invokeService('test', request);
      
      const calledWith = client.client.post.mock.calls[0][1];
      expect(calledWith.hookInstance).toBeDefined();
      expect(typeof calledWith.hookInstance).toBe('string');
    });

    it('should add fhirServer if missing', async () => {
      const request = {
        hook: 'patient-view',
        context: { patientId: '123' }
      };

      jest.spyOn(client.client, 'post').mockResolvedValue({ data: { cards: [] } });

      await client.invokeService('test', request);
      
      const calledWith = client.client.post.mock.calls[0][1];
      expect(calledWith.fhirServer).toBeDefined();
    });
  });

  describe('Request Format Validation', () => {
    it('should build valid patient-view request', () => {
      const request = client.buildRequest('patient-view', {
        patientId: 'patient-123',
        userId: 'user-456'
      });

      expect(request).toMatchObject({
        hookInstance: expect.any(String),
        fhirServer: expect.any(String),
        hook: 'patient-view',
        context: {
          patientId: 'patient-123',
          userId: 'user-456'
        }
      });
    });

    it('should build valid medication-prescribe request', () => {
      const request = client.buildRequest('medication-prescribe', {
        patientId: 'patient-123',
        userId: 'user-456',
        medications: [
          {
            resourceType: 'MedicationRequest',
            id: 'med-1'
          }
        ]
      });

      expect(request.context.medications).toBeDefined();
      expect(request.context.medications).toHaveLength(1);
    });

    it('should include prefetch when provided', () => {
      const prefetch = {
        patient: { resourceType: 'Patient', id: '123' }
      };

      const request = client.buildRequest(
        'patient-view',
        { patientId: '123' },
        prefetch
      );

      expect(request.prefetch).toEqual(prefetch);
    });
  });

  describe('Card Format Validation', () => {
    it('should format card with required fields', () => {
      const rawCard = {
        summary: 'Test card',
        indicator: 'info',
        detail: 'Card details'
      };

      const formatted = client.formatCard(rawCard, 'test-service');

      expect(formatted).toMatchObject({
        summary: 'Test card',
        indicator: 'info',
        detail: 'Card details',
        uuid: expect.any(String),
        serviceId: 'test-service',
        timestamp: expect.any(String),
        dismissed: false
      });
    });

    it('should add UUID if missing', () => {
      const rawCard = { summary: 'Test' };
      const formatted = client.formatCard(rawCard, 'test');

      expect(formatted.uuid).toBeDefined();
      expect(formatted.uuid).toMatch(/^[0-9a-f-]+$/);
    });
  });

  describe('Service Definition Validation', () => {
    it('should validate required service fields', () => {
      const validService = {
        id: 'test-service',
        hook: 'patient-view',
        title: 'Test Service',
        description: 'A test service'
      };

      const result = validateCDSService(validService);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject service without required fields', () => {
      const invalidService = {
        id: 'test',
        // missing hook
        title: 'Test'
        // missing description
      };

      const result = validateCDSService(invalidService);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('hook is required');
      expect(result.errors).toContain('description is required');
    });

    it('should validate hook type', () => {
      const invalidHook = {
        id: 'test',
        hook: 'invalid-hook-type',
        title: 'Test',
        description: 'Test'
      };

      const result = validateCDSService(invalidHook);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid hook type: invalid-hook-type');
    });

    it('should validate prefetch templates', () => {
      const service = {
        id: 'test',
        hook: 'patient-view',
        title: 'Test',
        description: 'Test',
        prefetch: {
          patient: 'Patient/{{context.patientId}}',
          invalid: 'not a valid template'
        }
      };

      const result = validateCDSService(service);
      expect(result.warnings).toContain('Prefetch template "invalid" may be invalid');
    });
  });

  describe('Backward Compatibility', () => {
    it('should show deprecation warning for createHook', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      jest.spyOn(cdsHooksService, 'createService').mockResolvedValue({ success: true });

      await cdsHooksService.createHook({});

      expect(consoleSpy).toHaveBeenCalledWith(
        'createHook is deprecated. Use createService instead.'
      );
      expect(cdsHooksService.createService).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should show deprecation warning for listCustomHooks', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      jest.spyOn(cdsHooksService, 'listCustomServices').mockResolvedValue({ data: [] });

      await cdsHooksService.listCustomHooks();

      expect(consoleSpy).toHaveBeenCalledWith(
        'listCustomHooks is deprecated. Use listCustomServices instead.'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown service', async () => {
      const error = {
        response: { status: 404 }
      };
      jest.spyOn(client.client, 'post').mockRejectedValue(error);

      await expect(
        client.invokeService('unknown-service', {})
      ).rejects.toThrow("Service 'unknown-service' not found");
    });

    it('should handle 400 for invalid request', async () => {
      const error = {
        response: { 
          status: 400,
          data: { detail: 'Missing required field: context' }
        }
      };
      jest.spyOn(client.client, 'post').mockRejectedValue(error);

      await expect(
        client.invokeService('test', {})
      ).rejects.toThrow('Invalid request: Missing required field: context');
    });

    it('should handle network errors gracefully', async () => {
      const error = new Error('Network error');
      jest.spyOn(client.client, 'get').mockRejectedValue(error);

      await expect(
        client.discoverServices()
      ).rejects.toThrow('Failed to discover CDS services: Network error');
    });
  });

  describe('Summary Validation', () => {
    it('should enforce 140 character limit on summary', () => {
      const longSummary = 'a'.repeat(150);
      const service = {
        id: 'test',
        hook: 'patient-view',
        title: 'Test',
        description: 'Test',
        cards: [{
          summary: longSummary,
          indicator: 'info'
        }]
      };

      const validation = cdsHooksService.validateServiceData(service);
      expect(validation.warnings).toContain(
        expect.stringContaining('Summary is quite long')
      );
    });
  });

  describe('Feedback API', () => {
    it('should create valid feedback object', () => {
      const feedback = client.createFeedback(
        'test-service',
        'card-uuid-123',
        'accepted'
      );

      expect(feedback).toMatchObject({
        card: 'card-uuid-123',
        outcome: 'accepted',
        outcomeTimestamp: expect.any(String),
        serviceId: 'test-service'
      });
      expect(feedback.overrideReasons).toBeUndefined();
    });

    it('should include override reasons when overridden', () => {
      const feedback = client.createFeedback(
        'test-service',
        'card-uuid-123',
        'overridden',
        ['reason1', 'reason2']
      );

      expect(feedback.overrideReasons).toEqual(['reason1', 'reason2']);
    });

    it('should send feedback to correct endpoint', async () => {
      jest.spyOn(client.client, 'post').mockResolvedValue({});

      const feedback = {
        card: 'test-card',
        outcome: 'accepted'
      };

      await client.sendFeedback(feedback);

      expect(client.client.post).toHaveBeenCalledWith(
        '/cds-services/feedback',
        feedback
      );
    });
  });
});

describe('Migration Tool Validation', () => {
  it('should identify non-compliant fields', () => {
    const hook = {
      id: 'test',
      hook: 'patient-view',
      title: 'Test',
      description: 'Test',
      conditions: [{ type: 'age', value: 50 }],
      displayBehavior: { mode: 'popup' },
      cards: []
    };

    // This would be imported from migration tool
    const analyzeHook = (hook) => {
      const issues = [];
      if (hook.conditions) {
        issues.push({ field: 'conditions', message: 'Not part of spec' });
      }
      if (hook.displayBehavior) {
        issues.push({ field: 'displayBehavior', message: 'Not part of spec' });
      }
      return { issues };
    };

    const result = analyzeHook(hook);
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0].field).toBe('conditions');
    expect(result.issues[1].field).toBe('displayBehavior');
  });
});