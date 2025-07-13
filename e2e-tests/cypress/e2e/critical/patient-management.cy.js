// Critical Tests - Patient Management and Registration
describe('Patient Management Workflows', () => {
  
  let testPatientId;
  
  beforeEach(() => {
    cy.login();
    cy.visit('/');
  });

  describe('Patient Search and Selection', () => {
    it('should search and filter patients effectively', () => {
      // Test patient search functionality
      cy.get('[data-testid="patient-search"]').should('be.visible');
      cy.get('[data-testid="patient-search"]').type('John');
      
      // Verify search results filter the list
      cy.get('[data-testid="patient-list-item"]').should('have.length.greaterThan', 0);
      cy.get('[data-testid="patient-list-item"]').each($el => {
        cy.wrap($el).should('contain.text', 'John');
      });
      
      // Clear search
      cy.get('[data-testid="patient-search"]').clear();
      cy.get('[data-testid="patient-list-item"]').should('have.length.greaterThan', 1);
      
      // Test pagination
      cy.get('[data-testid="pagination"]').should('be.visible');
      cy.get('[data-testid="page-size-selector"]').select('10');
      cy.get('[data-testid="patient-list-item"]').should('have.length.lessThan', 11);
    });

    it('should display comprehensive patient information', () => {
      cy.get('[data-testid="patient-list-item"]').first().then($el => {
        testPatientId = $el.attr('data-patient-id');
      });
      
      cy.get('[data-testid="patient-list-item"]').first().click();
      
      // Verify patient header displays complete demographics
      cy.get('[data-testid="patient-name"]').should('be.visible').and('not.be.empty');
      cy.get('[data-testid="patient-dob"]').should('be.visible');
      cy.get('[data-testid="patient-gender"]').should('be.visible');
      cy.get('[data-testid="patient-mrn"]').should('be.visible');
      
      // Verify contact information
      cy.get('[data-testid="patient-address"]').should('be.visible');
      cy.get('[data-testid="patient-phone"]').should('be.visible');
      
      // Verify insurance information if available
      cy.get('body').then($body => {
        if ($body.find('[data-testid="insurance-info"]').length > 0) {
          cy.get('[data-testid="insurance-info"]').should('be.visible');
        }
      });
    });

    it('should handle patient selection and context switching', () => {
      // Select first patient
      cy.get('[data-testid="patient-list-item"]').first().click();
      cy.get('[data-testid="patient-workspace"]').should('be.visible');
      
      let firstPatientName;
      cy.get('[data-testid="patient-name"]').invoke('text').then(name => {
        firstPatientName = name;
      });
      
      // Navigate back to patient list
      cy.get('[data-testid="back-to-patients"]').click();
      cy.get('[data-testid="patient-list"]').should('be.visible');
      
      // Select different patient
      cy.get('[data-testid="patient-list-item"]').eq(1).click();
      cy.get('[data-testid="patient-workspace"]').should('be.visible');
      
      // Verify context switched
      cy.get('[data-testid="patient-name"]').invoke('text').then(name => {
        expect(name).not.to.equal(firstPatientName);
      });
    });
  });

  describe('Patient Registration Workflow', () => {
    it('should create new patient with complete demographics', () => {
      cy.get('[data-testid="new-patient-button"]').click();
      
      // Fill in patient demographics
      cy.get('[data-testid="patient-first-name"]').type('John');
      cy.get('[data-testid="patient-last-name"]').type('TestPatient');
      cy.get('[data-testid="patient-dob"]').type('1980-01-01');
      cy.get('[data-testid="patient-gender"]').select('male');
      cy.get('[data-testid="patient-ssn"]').type('123-45-6789');
      
      // Contact information
      cy.get('[data-testid="patient-address-line1"]').type('123 Test Street');
      cy.get('[data-testid="patient-city"]').type('Test City');
      cy.get('[data-testid="patient-state"]').type('CA');
      cy.get('[data-testid="patient-zip"]').type('90210');
      cy.get('[data-testid="patient-phone"]').type('555-123-4567');
      cy.get('[data-testid="patient-email"]').type('john.test@example.com');
      
      // Insurance information
      cy.get('[data-testid="insurance-provider"]').type('Test Insurance');
      cy.get('[data-testid="insurance-member-id"]').type('INS123456');
      cy.get('[data-testid="insurance-group"]').type('GROUP123');
      
      // Emergency contact
      cy.get('[data-testid="emergency-contact-name"]').type('Jane TestContact');
      cy.get('[data-testid="emergency-contact-phone"]').type('555-987-6543');
      cy.get('[data-testid="emergency-contact-relationship"]').select('spouse');
      
      // Submit registration
      cy.get('[data-testid="submit-patient-registration"]').click();
      
      // Verify success
      cy.expectToast('Patient registered successfully');
      cy.get('[data-testid="patient-workspace"]').should('be.visible');
      cy.get('[data-testid="patient-name"]').should('contain', 'John TestPatient');
      
      // Verify FHIR Patient resource created
      cy.wait('@fhirCreate').then(interception => {
        expect(interception.response.statusCode).to.equal(201);
        expect(interception.response.body.resourceType).to.equal('Patient');
        expect(interception.response.body.name[0].given[0]).to.equal('John');
        expect(interception.response.body.name[0].family).to.equal('TestPatient');
      });
    });

    it('should validate required fields and show appropriate errors', () => {
      cy.get('[data-testid="new-patient-button"]').click();
      
      // Try to submit without required fields
      cy.get('[data-testid="submit-patient-registration"]').click();
      
      // Verify validation errors
      cy.get('[data-testid="first-name-error"]').should('contain', 'required');
      cy.get('[data-testid="last-name-error"]').should('contain', 'required');
      cy.get('[data-testid="dob-error"]').should('contain', 'required');
      cy.get('[data-testid="gender-error"]').should('contain', 'required');
      
      // Fill minimal required fields
      cy.get('[data-testid="patient-first-name"]').type('Min');
      cy.get('[data-testid="patient-last-name"]').type('Required');
      cy.get('[data-testid="patient-dob"]').type('1990-01-01');
      cy.get('[data-testid="patient-gender"]').select('female');
      
      // Should now allow submission
      cy.get('[data-testid="submit-patient-registration"]').click();
      cy.expectToast('Patient registered successfully');
    });
  });

  describe('Patient Update and Maintenance', () => {
    beforeEach(() => {
      cy.get('[data-testid="patient-list-item"]').first().click();
    });

    it('should update patient demographics', () => {
      cy.get('[data-testid="edit-patient-info"]').click();
      
      // Update contact information
      cy.get('[data-testid="patient-phone"]').clear().type('555-999-8888');
      cy.get('[data-testid="patient-email"]').clear().type('updated@example.com');
      
      // Update address
      cy.get('[data-testid="patient-address-line1"]').clear().type('456 Updated Street');
      cy.get('[data-testid="patient-city"]').clear().type('New City');
      
      // Save changes
      cy.get('[data-testid="save-patient-updates"]').click();
      
      // Verify success
      cy.expectToast('Patient information updated');
      
      // Verify changes persisted
      cy.reload();
      cy.get('[data-testid="patient-list-item"]').first().click();
      cy.get('[data-testid="patient-phone"]').should('contain', '555-999-8888');
      cy.get('[data-testid="patient-address"]').should('contain', '456 Updated Street');
    });

    it('should manage patient insurance information', () => {
      cy.get('[data-testid="insurance-tab"]').click();
      
      // Add new insurance
      cy.get('[data-testid="add-insurance"]').click();
      cy.get('[data-testid="insurance-provider"]').type('Secondary Insurance');
      cy.get('[data-testid="insurance-type"]').select('secondary');
      cy.get('[data-testid="insurance-member-id"]').type('SEC789');
      cy.get('[data-testid="insurance-effective-date"]').type('2024-01-01');
      cy.get('[data-testid="save-insurance"]').click();
      
      // Verify insurance added
      cy.expectToast('Insurance added successfully');
      cy.get('[data-testid="insurance-list"]').should('contain', 'Secondary Insurance');
      
      // Update insurance status
      cy.get('[data-testid="insurance-item"]').first().find('[data-testid="edit-insurance"]').click();
      cy.get('[data-testid="insurance-status"]').select('inactive');
      cy.get('[data-testid="insurance-end-date"]').type('2024-12-31');
      cy.get('[data-testid="save-insurance"]').click();
      
      // Verify update
      cy.expectToast('Insurance updated successfully');
      cy.get('[data-testid="insurance-status"]').should('contain', 'Inactive');
    });
  });

  describe('Patient Privacy and Security', () => {
    beforeEach(() => {
      cy.get('[data-testid="patient-list-item"]').first().click();
    });

    it('should handle patient privacy settings', () => {
      cy.get('[data-testid="privacy-settings"]').click();
      
      // Set privacy restrictions
      cy.get('[data-testid="restrict-directory"]').check();
      cy.get('[data-testid="restrict-communication"]').check();
      cy.get('[data-testid="privacy-notes"]').type('Patient requested maximum privacy');
      
      // Save privacy settings
      cy.get('[data-testid="save-privacy-settings"]').click();
      cy.expectToast('Privacy settings updated');
      
      // Verify privacy indicators
      cy.get('[data-testid="privacy-indicator"]').should('be.visible');
    });

    it('should audit patient access and modifications', () => {
      // Perform various patient operations
      cy.navigateToTab('chart-review');
      cy.get('[data-testid="conditions-section"]').should('be.visible');
      
      cy.navigateToTab('results');
      cy.get('[data-testid="results-section"]').should('be.visible');
      
      // Check audit log
      cy.visit('/administration/audit');
      cy.get('[data-testid="audit-filter-patient"]').type(testPatientId);
      cy.get('[data-testid="apply-audit-filter"]').click();
      
      // Verify audit entries
      cy.get('[data-testid="audit-entry"]').should('have.length.greaterThan', 0);
      cy.get('[data-testid="audit-entry"]').should('contain', 'Patient accessed');
    });
  });

  describe('Patient Relationships and Contacts', () => {
    beforeEach(() => {
      cy.get('[data-testid="patient-list-item"]').first().click();
    });

    it('should manage emergency contacts', () => {
      cy.get('[data-testid="contacts-tab"]').click();
      
      // Add emergency contact
      cy.get('[data-testid="add-emergency-contact"]').click();
      cy.get('[data-testid="contact-name"]').type('Emergency Person');
      cy.get('[data-testid="contact-phone"]').type('555-911-1234');
      cy.get('[data-testid="contact-relationship"]').select('friend');
      cy.get('[data-testid="contact-priority"]').select('1');
      cy.get('[data-testid="save-contact"]').click();
      
      // Verify contact added
      cy.expectToast('Emergency contact added');
      cy.get('[data-testid="emergency-contacts"]').should('contain', 'Emergency Person');
      
      // Test contact validation
      cy.get('[data-testid="contact-phone"]').should('contain', '555-911-1234');
      cy.get('[data-testid="contact-relationship"]').should('contain', 'Friend');
    });

    it('should handle patient relationships and family history', () => {
      cy.get('[data-testid="family-history-tab"]').click();
      
      // Add family history entry
      cy.get('[data-testid="add-family-history"]').click();
      cy.get('[data-testid="family-member-relationship"]').select('father');
      cy.get('[data-testid="family-condition"]').type('Diabetes');
      cy.get('[data-testid="family-condition-option"]').first().click();
      cy.get('[data-testid="age-at-onset"]').type('45');
      cy.get('[data-testid="save-family-history"]').click();
      
      // Verify family history added
      cy.expectToast('Family history added');
      cy.get('[data-testid="family-history-list"]').should('contain', 'Father');
      cy.get('[data-testid="family-history-list"]').should('contain', 'Diabetes');
    });
  });

  describe('Patient Data Export and Sharing', () => {
    beforeEach(() => {
      cy.get('[data-testid="patient-list-item"]').first().click();
    });

    it('should export complete patient record', () => {
      cy.get('[data-testid="export-patient-data"]').click();
      
      // Select export options
      cy.get('[data-testid="export-format"]').select('pdf');
      cy.get('[data-testid="include-demographics"]').check();
      cy.get('[data-testid="include-conditions"]').check();
      cy.get('[data-testid="include-medications"]').check();
      cy.get('[data-testid="include-lab-results"]').check();
      cy.get('[data-testid="include-imaging"]').check();
      
      // Set date range
      cy.get('[data-testid="export-start-date"]').type('2023-01-01');
      cy.get('[data-testid="export-end-date"]').type('2024-12-31');
      
      // Generate export
      cy.get('[data-testid="generate-export"]').click();
      
      // Verify export initiated
      cy.expectToast('Patient data export initiated');
      cy.get('[data-testid="export-status"]').should('contain', 'Processing');
      
      // Wait for completion (mock or actual)
      cy.get('[data-testid="download-export"]', { timeout: 10000 }).should('be.visible');
    });

    it('should handle patient data sharing requests', () => {
      cy.get('[data-testid="share-patient-data"]').click();
      
      // Fill sharing request
      cy.get('[data-testid="recipient-name"]').type('Dr. Specialist');
      cy.get('[data-testid="recipient-organization"]').type('Specialist Clinic');
      cy.get('[data-testid="sharing-purpose"]').type('Consultation referral');
      cy.get('[data-testid="data-categories"]').check(['demographics', 'conditions', 'medications']);
      
      // Set sharing permissions
      cy.get('[data-testid="sharing-duration"]').select('30-days');
      cy.get('[data-testid="require-acknowledgment"]').check();
      
      // Submit sharing request
      cy.get('[data-testid="submit-sharing-request"]').click();
      
      // Verify request processed
      cy.expectToast('Data sharing request created');
      cy.get('[data-testid="sharing-requests"]').should('contain', 'Dr. Specialist');
    });
  });

  describe('Patient Workflow Integration', () => {
    beforeEach(() => {
      cy.get('[data-testid="patient-list-item"]').first().click();
    });

    it('should maintain patient context across all clinical modules', () => {
      const patientId = 'test-patient-id';
      cy.get('[data-testid="patient-id"]').invoke('text').as('currentPatientId');
      
      // Navigate through all tabs and verify patient context
      const tabs = ['summary', 'chart-review', 'results', 'orders', 'encounters', 'imaging', 'pharmacy'];
      
      tabs.forEach(tab => {
        cy.navigateToTab(tab);
        cy.get('@currentPatientId').then(id => {
          cy.get('[data-testid="current-patient-context"]').should('contain', id);
        });
      });
    });

    it('should handle patient context in external integrations', () => {
      // Test CDS Hooks with patient context
      cy.navigateToTab('summary');
      cy.get('[data-testid="cds-cards"]').should('be.visible');
      
      // Verify patient-specific recommendations
      cy.get('[data-testid="cds-card"]').should('have.length.greaterThan', 0);
      cy.get('[data-testid="cds-card"]').first().should('contain.text', 'patient');
      
      // Test patient-specific alerts
      cy.get('[data-testid="patient-alerts"]').should('be.visible');
    });
  });
});