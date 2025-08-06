import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import fhirClient from '../fhirClient';

// Create mock adapter
const mock = new MockAdapter(axios);

describe('fhirClient', () => {
  afterEach(() => {
    mock.reset();
  });

  describe('CRUD operations', () => {
    it('should read a resource', async () => {
      const mockPatient = {
        resourceType: 'Patient',
        id: '123',
        name: [{ given: ['John'], family: 'Doe' }]
      };

      mock.onGet('/fhir/R4/Patient/123').reply(200, mockPatient);

      const result = await fhirClient.read('Patient', '123');
      expect(result).toEqual(mockPatient);
    });

    it('should create a resource', async () => {
      const newPatient = {
        resourceType: 'Patient',
        name: [{ given: ['Jane'], family: 'Doe' }]
      };

      const createdPatient = { ...newPatient, id: '456' };

      mock.onPost('/fhir/R4/Patient').reply(201, createdPatient);

      const result = await fhirClient.create('Patient', newPatient);
      expect(result).toEqual(createdPatient);
    });

    it('should update a resource', async () => {
      const updatedPatient = {
        resourceType: 'Patient',
        id: '123',
        name: [{ given: ['John', 'Updated'], family: 'Doe' }]
      };

      mock.onPut('/fhir/R4/Patient/123').reply(200, updatedPatient);

      const result = await fhirClient.update('Patient', '123', updatedPatient);
      expect(result).toEqual(updatedPatient);
    });

    it('should delete a resource', async () => {
      mock.onDelete('/fhir/R4/Patient/123').reply(204);

      await expect(fhirClient.delete('Patient', '123')).resolves.not.toThrow();
    });

    it('should search for resources', async () => {
      const searchBundle = {
        resourceType: 'Bundle',
        type: 'searchset',
        entry: [
          { resource: { resourceType: 'Patient', id: '1' } },
          { resource: { resourceType: 'Patient', id: '2' } }
        ]
      };

      mock.onGet('/fhir/R4/Patient').reply(200, searchBundle);

      const result = await fhirClient.search('Patient', { name: 'Doe' });
      expect(result).toEqual(searchBundle);
    });
  });

  describe('Convenience methods', () => {
    it('should get patient conditions', async () => {
      const conditionsBundle = {
        resourceType: 'Bundle',
        entry: [
          { resource: { resourceType: 'Condition', id: '1' } }
        ]
      };

      mock.onGet('/fhir/R4/Condition?patient=123').reply(200, conditionsBundle);

      const result = await fhirClient.getConditions('123');
      expect(result).toHaveLength(1);
      expect(result[0].resourceType).toBe('Condition');
    });

    it('should create a condition', async () => {
      const newCondition = {
        resourceType: 'Condition',
        subject: { reference: 'Patient/123' }
      };

      const createdCondition = { ...newCondition, id: 'c1' };

      mock.onPost('/fhir/R4/Condition').reply(201, createdCondition);

      const result = await fhirClient.createCondition(newCondition);
      expect(result).toEqual(createdCondition);
    });
  });

  describe('Batch operations', () => {
    it('should execute batch requests', async () => {
      const batchBundle = {
        resourceType: 'Bundle',
        type: 'batch',
        entry: [
          {
            request: { method: 'GET', url: 'Patient/123' },
            response: { status: '200' },
            resource: { resourceType: 'Patient', id: '123' }
          }
        ]
      };

      mock.onPost('/fhir/R4').reply(200, batchBundle);

      const requests = [
        { method: 'GET', url: 'Patient/123' }
      ];

      const result = await fhirClient.batch(requests);
      expect(result).toEqual(batchBundle);
    });
  });

  describe('Static methods', () => {
    it('should build a reference', () => {
      const ref = fhirClient.buildReference('Patient', '123');
      expect(ref).toEqual({ reference: 'Patient/123' });
    });

    it('should extract ID from reference', () => {
      expect(fhirClient.extractId('Patient/123')).toBe('123');
      expect(fhirClient.extractId({ reference: 'Patient/456' })).toBe('456');
      expect(fhirClient.extractId('urn:uuid:789')).toBe('789');
    });

    it('should build an identifier', () => {
      const identifier = fhirClient.buildIdentifier('MRN', '12345');
      expect(identifier).toEqual({
        system: 'MRN',
        value: '12345'
      });
    });
  });

  describe('Error handling', () => {
    it('should handle 404 errors', async () => {
      mock.onGet('/fhir/R4/Patient/999').reply(404, {
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'error', code: 'not-found' }]
      });

      await expect(fhirClient.read('Patient', '999')).rejects.toThrow();
    });

    it('should handle validation errors', async () => {
      mock.onPost('/fhir/R4/Patient').reply(422, {
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'error', code: 'invalid' }]
      });

      await expect(fhirClient.create('Patient', {})).rejects.toThrow();
    });
  });
});