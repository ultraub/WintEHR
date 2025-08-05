/**
 * Tests for CDS Hooks Client Service - CDS Hooks 2.0
 */

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { cdsHooksClient } from '../cdsHooksClient';
import { v4 as uuidv4 } from 'uuid';

// Create mock adapter
const mock = new MockAdapter(axios);

describe('CDSHooksClient', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    mock.reset();
    
    // Reset client state
    cdsHooksClient.servicesCache = null;
    cdsHooksClient.servicesCacheTime = null;
    cdsHooksClient.requestCache.clear();
    cdsHooksClient.inFlightRequests.clear();
  });

  afterAll(() => {
    mock.restore();
  });

  describe('Service Discovery', () => {
    const mockServices = {
      services: [
        {
          id: 'patient-greeting',
          title: 'Patient Greeting Service',
          description: 'Displays a greeting when patient chart is opened',
          hook: 'patient-view',
          prefetch: {
            patient: 'Patient/{{context.patientId}}'
          }
        },
        {
          id: 'drug-interaction-checker',
          title: 'Drug Interaction Checker',
          description: 'Checks for drug-drug interactions',
          hook: 'medication-prescribe',
          prefetch: {
            patient: 'Patient/{{context.patientId}}',
            medications: 'MedicationRequest?patient={{context.patientId}}'
          }
        }
      ]
    };

    test('should discover available services', async () => {
      mock.onGet('/cds-services').reply(200, mockServices);

      const services = await cdsHooksClient.discoverServices();

      expect(services).toEqual(mockServices.services);
      expect(services).toHaveLength(2);
      expect(services[0].hook).toBe('patient-view');
    });

    test('should cache service discovery results', async () => {
      mock.onGet('/cds-services').reply(200, mockServices);

      // First call
      const services1 = await cdsHooksClient.discoverServices();
      expect(mock.history.get).toHaveLength(1);

      // Second call should use cache
      const services2 = await cdsHooksClient.discoverServices();
      expect(mock.history.get).toHaveLength(1); // No additional request
      expect(services2).toEqual(services1);
    });

    test('should handle discovery errors gracefully', async () => {
      mock.onGet('/cds-services').networkError();

      const services = await cdsHooksClient.discoverServices();

      expect(services).toEqual([]);
    });

    test('should deduplicate concurrent discovery requests', async () => {
      mock.onGet('/cds-services').reply(200, mockServices);

      // Make multiple concurrent requests
      const promises = [
        cdsHooksClient.discoverServices(),
        cdsHooksClient.discoverServices(),
        cdsHooksClient.discoverServices()
      ];

      const results = await Promise.all(promises);

      // Should only make one actual request
      expect(mock.history.get).toHaveLength(1);
      
      // All results should be the same
      expect(results[0]).toEqual(results[1]);
      expect(results[1]).toEqual(results[2]);
    });
  });

  describe('Hook Execution', () => {
    const mockResponse = {
      cards: [
        {
          uuid: uuidv4(),
          summary: 'Test Alert',
          indicator: 'warning',
          detail: 'This is a test alert',
          source: {
            label: 'Test Service'
          }
        }
      ]
    };

    test('should execute hook with proper request format', async () => {
      const hookId = 'test-service';
      const context = {
        patientId: 'patient-123',
        userId: 'user-456'
      };

      mock.onPost(`/cds-services/${hookId}`).reply(200, mockResponse);

      const result = await cdsHooksClient.executeHook(hookId, {
        hook: 'patient-view',
        hookInstance: 'test-instance',
        context
      });

      expect(result).toEqual(mockResponse);
      
      // Check request format
      const request = JSON.parse(mock.history.post[0].data);
      expect(request.hook).toBe('patient-view');
      expect(request.context).toEqual(context);
    });

    test('should cache hook execution results', async () => {
      const hookId = 'test-service';
      const context = { patientId: 'patient-123' };

      mock.onPost(`/cds-services/${hookId}`).reply(200, mockResponse);

      // First call
      await cdsHooksClient.executeHook(hookId, { hook: 'patient-view', context });
      expect(mock.history.post).toHaveLength(1);

      // Second call with same params should use cache
      await cdsHooksClient.executeHook(hookId, { hook: 'patient-view', context });
      expect(mock.history.post).toHaveLength(1);
    });

    test('should handle hook execution errors', async () => {
      const hookId = 'test-service';
      
      mock.onPost(`/cds-services/${hookId}`).reply(500);

      const result = await cdsHooksClient.executeHook(hookId, {
        hook: 'patient-view',
        context: { patientId: 'patient-123' }
      });

      expect(result).toEqual({ cards: [] });
    });
  });

  describe('CDS Hooks 2.0 Features', () => {
    describe('Feedback API', () => {
      test('should send card feedback for accepted suggestion', async () => {
        const serviceId = 'test-service';
        const feedbackData = {
          feedback: [{
            card: uuidv4(),
            outcome: 'accepted',
            outcomeTimestamp: new Date().toISOString(),
            acceptedSuggestions: [{ id: uuidv4() }]
          }]
        };

        mock.onPost(`/cds-services/${serviceId}/feedback`).reply(200);

        const result = await cdsHooksClient.sendFeedback(serviceId, feedbackData);

        expect(mock.history.post).toHaveLength(1);
        expect(JSON.parse(mock.history.post[0].data)).toEqual(feedbackData);
      });

      test('should send override feedback with reason', async () => {
        const serviceId = 'test-service';
        const feedbackData = {
          feedback: [{
            card: uuidv4(),
            outcome: 'overridden',
            outcomeTimestamp: new Date().toISOString(),
            overrideReason: {
              code: 'patient-preference',
              userComment: 'Patient declined'
            }
          }]
        };

        mock.onPost(`/cds-services/${serviceId}/feedback`).reply(200);

        await cdsHooksClient.sendFeedback(serviceId, feedbackData);

        const sentData = JSON.parse(mock.history.post[0].data);
        expect(sentData.feedback[0].overrideReason).toBeDefined();
      });
    });

    describe('System Actions', () => {
      test('should apply system actions', async () => {
        const systemActions = [
          {
            type: 'update',
            resource: {
              resourceType: 'ServiceRequest',
              id: '123',
              status: 'active'
            }
          }
        ];

        const context = { hookInstance: uuidv4() };

        mock.onPost('/cds-services/apply-system-actions').reply(200, {
          processed: 1,
          errors: 0
        });

        const result = await cdsHooksClient.applySystemActions(systemActions, context);

        expect(result.processed).toBe(1);
        expect(result.errors).toBe(0);
      });
    });

    describe('New 2.0 Hooks', () => {
      test('should fire allergyintolerance-create hook', async () => {
        const mockServices = {
          services: [{
            id: 'allergy-validator',
            hook: 'allergyintolerance-create'
          }]
        };

        mock.onGet('/cds-services').reply(200, mockServices);
        mock.onPost('/cds-services/allergy-validator').reply(200, { cards: [] });

        const result = await cdsHooksClient.fireAllergyIntoleranceCreate(
          'patient-123',
          'user-456',
          { resourceType: 'AllergyIntolerance', code: { text: 'Peanuts' } }
        );

        expect(result).toBeDefined();
        expect(result.cards).toEqual([]);
      });

      test('should fire appointment-book hook', async () => {
        const mockServices = {
          services: [{
            id: 'appointment-validator',
            hook: 'appointment-book'
          }]
        };

        mock.onGet('/cds-services').reply(200, mockServices);
        mock.onPost('/cds-services/appointment-validator').reply(200, { cards: [] });

        const result = await cdsHooksClient.fireAppointmentBook(
          'patient-123',
          'user-456',
          [{ resourceType: 'Appointment', start: '2024-01-01T10:00:00Z' }]
        );

        expect(result).toBeDefined();
      });
    });

    describe('JWT Authentication', () => {
      test('should set auth token in headers', () => {
        const token = 'test-jwt-token';
        
        cdsHooksClient.setAuthToken(token);

        expect(cdsHooksClient.httpClient.defaults.headers.common['Authorization'])
          .toBe(`Bearer ${token}`);
      });

      test('should remove auth token when set to null', () => {
        cdsHooksClient.setAuthToken('test-token');
        cdsHooksClient.setAuthToken(null);

        expect(cdsHooksClient.httpClient.defaults.headers.common['Authorization'])
          .toBeUndefined();
      });
    });
  });

  describe('Hook-Specific Methods', () => {
    test('should fire patient-view hook with all services', async () => {
      const mockServices = {
        services: [
          { id: 'greeting', hook: 'patient-view', title: 'Greeting' },
          { id: 'alerts', hook: 'patient-view', title: 'Alerts' }
        ]
      };

      const mockCards = [
        { uuid: uuidv4(), summary: 'Hello', indicator: 'info' },
        { uuid: uuidv4(), summary: 'Alert', indicator: 'warning' }
      ];

      mock.onGet('/cds-services').reply(200, mockServices);
      mock.onPost('/cds-services/greeting').reply(200, { cards: [mockCards[0]] });
      mock.onPost('/cds-services/alerts').reply(200, { cards: [mockCards[1]] });

      const cards = await cdsHooksClient.firePatientView('patient-123', 'user-456');

      expect(cards).toHaveLength(2);
      expect(cards[0].serviceId).toBe('greeting');
      expect(cards[1].serviceId).toBe('alerts');
    });

    test('should fire medication-prescribe with prefetch', async () => {
      const mockServices = {
        services: [{
          id: 'med-check',
          hook: 'medication-prescribe',
          prefetch: {
            patient: 'Patient/{{context.patientId}}'
          }
        }]
      };

      mock.onGet('/cds-services').reply(200, mockServices);
      mock.onPost('/cds-services/med-check').reply(200, { 
        cards: [{
          uuid: uuidv4(),
          summary: 'Drug interaction warning',
          indicator: 'warning'
        }]
      });

      const medications = [{
        resourceType: 'MedicationRequest',
        medicationCodeableConcept: { text: 'Aspirin' }
      }];

      const cards = await cdsHooksClient.fireMedicationPrescribe(
        'patient-123',
        'user-456',
        medications
      );

      expect(cards).toHaveLength(1);
      expect(cards[0].summary).toContain('Drug interaction');
    });

    test('should add UUID to hook responses', async () => {
      const mockServices = {
        services: [{ id: 'test', hook: 'patient-view' }]
      };

      const mockResponse = {
        cards: [{
          // No UUID in response
          summary: 'Test card',
          indicator: 'info'
        }]
      };

      mock.onGet('/cds-services').reply(200, mockServices);
      mock.onPost('/cds-services/test').reply(200, mockResponse);

      const result = await cdsHooksClient.executeHookType('patient-view', {
        patientId: 'patient-123'
      });

      // Should add UUID to cards that don't have one
      expect(result.cards[0].uuid).toBeDefined();
      expect(result.cards[0].uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      mock.onGet('/cds-services').networkError();

      const services = await cdsHooksClient.discoverServices();
      expect(services).toEqual([]);
    });

    test('should handle timeout errors', async () => {
      mock.onPost('/cds-services/test').timeout();

      const result = await cdsHooksClient.executeHook('test', {
        hook: 'patient-view',
        context: { patientId: '123' }
      });

      expect(result).toEqual({ cards: [] });
    });

    test('should use cached data on error if available', async () => {
      const mockServices = { services: [{ id: 'test', hook: 'patient-view' }] };
      
      // First successful call
      mock.onGet('/cds-services').replyOnce(200, mockServices);
      await cdsHooksClient.discoverServices();
      
      // Force cache expiration
      cdsHooksClient.servicesCacheTime = Date.now() - (10 * 60 * 1000);
      
      // Second call fails
      mock.onGet('/cds-services').networkError();
      const services = await cdsHooksClient.discoverServices();
      
      // Should return cached data
      expect(services).toEqual(mockServices.services);
    });
  });
});