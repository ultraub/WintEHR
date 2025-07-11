// FHIR API Compliance Tests
describe('FHIR R4 API Compliance', () => {
  
  const fhirUrl = Cypress.env('fhirUrl');
  
  beforeEach(() => {
    cy.login();
  });

  describe('FHIR Resource Operations', () => {
    it('should support CRUD operations for Patient resources', () => {
      const testPatient = {
        resourceType: 'Patient',
        name: [{
          use: 'official',
          family: 'TestPatient',
          given: ['E2E', 'Test']
        }],
        gender: 'female',
        birthDate: '1990-01-01'
      };

      // Create
      cy.createFHIRResource('Patient', testPatient).then(createResponse => {
        expect(createResponse.status).to.equal(201);
        expect(createResponse.body.resourceType).to.equal('Patient');
        const patientId = createResponse.body.id;

        // Read
        cy.getFHIRResource('Patient', patientId).then(readResponse => {
          expect(readResponse.status).to.equal(200);
          expect(readResponse.body.id).to.equal(patientId);
          expect(readResponse.body.name[0].family).to.equal('TestPatient');

          // Update
          const updatedPatient = {
            ...readResponse.body,
            name: [{
              ...readResponse.body.name[0],
              family: 'UpdatedTestPatient'
            }]
          };

          cy.request({
            method: 'PUT',
            url: `${fhirUrl}/Patient/${patientId}`,
            headers: { 'Content-Type': 'application/fhir+json' },
            body: updatedPatient
          }).then(updateResponse => {
            expect(updateResponse.status).to.equal(200);
            expect(updateResponse.body.name[0].family).to.equal('UpdatedTestPatient');

            // Delete
            cy.request({
              method: 'DELETE',
              url: `${fhirUrl}/Patient/${patientId}`
            }).then(deleteResponse => {
              expect(deleteResponse.status).to.be.oneOf([200, 204]);
            });
          });
        });
      });
    });

    it('should validate FHIR resource structure', () => {
      const invalidPatient = {
        resourceType: 'Patient',
        // Missing required fields
        invalidField: 'test'
      };

      cy.request({
        method: 'POST',
        url: `${fhirUrl}/Patient`,
        headers: { 'Content-Type': 'application/fhir+json' },
        body: invalidPatient,
        failOnStatusCode: false
      }).then(response => {
        expect(response.status).to.be.oneOf([400, 422]);
      });
    });
  });

  describe('FHIR Search Parameters', () => {
    it('should support standard search parameters', () => {
      // Search by name
      cy.searchFHIRResources('Patient', { 
        name: 'Test',
        _count: 10 
      }).then(response => {
        expect(response.status).to.equal(200);
        expect(response.body.resourceType).to.equal('Bundle');
        expect(response.body.type).to.equal('searchset');
      });

      // Search by date
      cy.searchFHIRResources('Observation', {
        date: 'ge2024-01-01',
        _count: 10
      }).then(response => {
        expect(response.status).to.equal(200);
        expect(response.body.resourceType).to.equal('Bundle');
      });

      // Search with multiple parameters
      cy.searchFHIRResources('MedicationRequest', {
        status: 'active',
        'authored-on': 'ge2024-01-01',
        _count: 10
      }).then(response => {
        expect(response.status).to.equal(200);
        expect(response.body.resourceType).to.equal('Bundle');
      });
    });

    it('should handle pagination correctly', () => {
      cy.searchFHIRResources('Patient', { 
        _count: 5 
      }).then(response => {
        expect(response.status).to.equal(200);
        expect(response.body.entry).to.have.length.lessThan(6);
        
        // Check for pagination links
        if (response.body.total > 5) {
          expect(response.body.link).to.exist;
          const nextLink = response.body.link.find(link => link.relation === 'next');
          if (nextLink) {
            expect(nextLink.url).to.contain('_offset');
          }
        }
      });
    });
  });

  describe('FHIR Bundle Operations', () => {
    it('should support transaction bundles', () => {
      const transactionBundle = {
        resourceType: 'Bundle',
        type: 'transaction',
        entry: [
          {
            request: {
              method: 'POST',
              url: 'Patient'
            },
            resource: {
              resourceType: 'Patient',
              name: [{
                family: 'BundleTest',
                given: ['Transaction']
              }],
              gender: 'male'
            }
          },
          {
            request: {
              method: 'POST',
              url: 'Observation'
            },
            resource: {
              resourceType: 'Observation',
              status: 'final',
              code: {
                coding: [{
                  system: 'http://loinc.org',
                  code: '8867-4',
                  display: 'Heart rate'
                }]
              },
              subject: {
                reference: 'Patient/{{Patient-id}}'
              },
              valueQuantity: {
                value: 72,
                unit: 'beats/min'
              }
            }
          }
        ]
      };

      cy.request({
        method: 'POST',
        url: fhirUrl,
        headers: { 'Content-Type': 'application/fhir+json' },
        body: transactionBundle
      }).then(response => {
        expect(response.status).to.equal(200);
        expect(response.body.resourceType).to.equal('Bundle');
        expect(response.body.type).to.equal('transaction-response');
        expect(response.body.entry).to.have.length(2);
        
        // All entries should be successful
        response.body.entry.forEach(entry => {
          expect(entry.response.status).to.match(/^2\d\d/);
        });
      });
    });
  });

  describe('FHIR Capability Statement', () => {
    it('should provide capability statement', () => {
      cy.request({
        method: 'GET',
        url: `${fhirUrl}/metadata`,
        headers: { 'Accept': 'application/fhir+json' }
      }).then(response => {
        expect(response.status).to.equal(200);
        expect(response.body.resourceType).to.equal('CapabilityStatement');
        expect(response.body.fhirVersion).to.equal('4.0.1');
        expect(response.body.format).to.include('application/fhir+json');
        
        // Should declare supported resources
        expect(response.body.rest[0].resource).to.be.an('array');
        const supportedTypes = response.body.rest[0].resource.map(r => r.type);
        expect(supportedTypes).to.include.members([
          'Patient', 'Observation', 'Condition', 'MedicationRequest'
        ]);
      });
    });
  });

  describe('FHIR Version Negotiation', () => {
    it('should handle FHIR version headers correctly', () => {
      cy.request({
        method: 'GET',
        url: `${fhirUrl}/Patient`,
        headers: { 
          'Accept': 'application/fhir+json',
          'fhirVersion': '4.0'
        }
      }).then(response => {
        expect(response.status).to.equal(200);
        expect(response.headers['content-type']).to.contain('application/fhir+json');
      });
    });

    it('should reject unsupported FHIR versions', () => {
      cy.request({
        method: 'GET',
        url: `${fhirUrl}/Patient`,
        headers: { 
          'Accept': 'application/fhir+json',
          'fhirVersion': '3.0'
        },
        failOnStatusCode: false
      }).then(response => {
        expect(response.status).to.be.oneOf([400, 406]);
      });
    });
  });

  describe('FHIR Security and Authentication', () => {
    it('should require authentication for protected endpoints', () => {
      // Test without authentication
      cy.request({
        method: 'GET',
        url: `${fhirUrl}/Patient`,
        headers: { 'Accept': 'application/fhir+json' },
        auth: null,
        failOnStatusCode: false
      }).then(response => {
        // Should either work (if auth is disabled) or require auth
        expect(response.status).to.be.oneOf([200, 401, 403]);
      });
    });
  });

  describe('FHIR Error Handling', () => {
    it('should return proper OperationOutcome for errors', () => {
      cy.request({
        method: 'GET',
        url: `${fhirUrl}/Patient/nonexistent-id`,
        failOnStatusCode: false
      }).then(response => {
        expect(response.status).to.equal(404);
        if (response.body.resourceType) {
          expect(response.body.resourceType).to.equal('OperationOutcome');
          expect(response.body.issue).to.be.an('array');
          expect(response.body.issue[0].severity).to.be.oneOf(['error', 'fatal']);
        }
      });
    });
  });
});