// Critical Tests - Imaging and DICOM Workflow
describe('Comprehensive Imaging Workflow', () => {
  
  let testPatientId;
  let testStudyId;
  
  beforeEach(() => {
    cy.login();
    cy.visit('/');
    
    // Get test patient
    cy.get('[data-testid="patient-list-item"]').first().then($el => {
      testPatientId = $el.attr('data-patient-id');
    });
    
    cy.get('[data-testid="patient-list-item"]').first().click();
  });

  describe('Imaging Study Management', () => {
    it('should display and navigate imaging studies', () => {
      cy.navigateToTab('imaging');
      
      // Verify imaging studies load
      cy.get('[data-testid="imaging-studies"]').should('be.visible');
      
      // Check study list view
      cy.get('[data-testid="study-list"]').should('be.visible');
      cy.get('[data-testid="study-item"]').should('have.length.greaterThan', 0);
      
      // Verify study information
      cy.get('[data-testid="study-item"]').first().within(() => {
        cy.get('[data-testid="study-date"]').should('be.visible');
        cy.get('[data-testid="study-description"]').should('be.visible');
        cy.get('[data-testid="study-modality"]').should('be.visible');
        cy.get('[data-testid="study-status"]').should('be.visible');
      });
      
      // Test study selection
      cy.get('[data-testid="study-item"]').first().click();
      cy.get('[data-testid="study-details"]').should('be.visible');
    });

    it('should handle different imaging modalities', () => {
      cy.navigateToTab('imaging');
      
      // Test modality filtering
      cy.get('[data-testid="modality-filter"]').should('be.visible');
      cy.get('[data-testid="modality-filter"]').select('CT');
      
      // Verify filtered results
      cy.get('[data-testid="study-item"]').each($study => {
        cy.wrap($study).find('[data-testid="study-modality"]').should('contain', 'CT');
      });
      
      // Test other modalities
      const modalities = ['MR', 'XR', 'US', 'CR'];
      modalities.forEach(modality => {
        cy.get('[data-testid="modality-filter"]').select(modality);
        cy.get('[data-testid="study-item"]').should('be.visible');
      });
      
      // Clear filter
      cy.get('[data-testid="modality-filter"]').select('All');
      cy.get('[data-testid="study-item"]').should('have.length.greaterThan', 0);
    });

    it('should display study metadata and series information', () => {
      cy.navigateToTab('imaging');
      cy.get('[data-testid="study-item"]').first().click();
      
      // Verify study metadata
      cy.get('[data-testid="study-metadata"]').should('be.visible');
      cy.get('[data-testid="study-uid"]').should('be.visible');
      cy.get('[data-testid="study-datetime"]').should('be.visible');
      cy.get('[data-testid="referring-physician"]').should('be.visible');
      cy.get('[data-testid="study-description"]').should('be.visible');
      
      // Verify series information
      cy.get('[data-testid="series-list"]').should('be.visible');
      cy.get('[data-testid="series-item"]').should('have.length.greaterThan', 0);
      
      cy.get('[data-testid="series-item"]').first().within(() => {
        cy.get('[data-testid="series-number"]').should('be.visible');
        cy.get('[data-testid="series-description"]').should('be.visible');
        cy.get('[data-testid="image-count"]').should('be.visible');
      });
    });
  });

  describe('DICOM Viewer Functionality', () => {
    beforeEach(() => {
      cy.navigateToTab('imaging');
      cy.get('[data-testid="study-item"]').first().click();
    });

    it('should load and display DICOM images', () => {
      // Open DICOM viewer
      cy.get('[data-testid="open-viewer"]').click();
      cy.get('[data-testid="dicom-viewer"]').should('be.visible');
      
      // Verify viewer components
      cy.get('[data-testid="viewer-canvas"]').should('be.visible');
      cy.get('[data-testid="viewer-toolbar"]').should('be.visible');
      cy.get('[data-testid="image-navigation"]').should('be.visible');
      
      // Verify image loaded
      cy.get('[data-testid="viewer-canvas"]').should('have.attr', 'width').and('not.equal', '0');
      cy.get('[data-testid="current-image-info"]').should('be.visible');
    });

    it('should navigate through image series', () => {
      cy.get('[data-testid="open-viewer"]').click();
      
      // Test navigation controls
      cy.get('[data-testid="next-image"]').should('be.visible');
      cy.get('[data-testid="previous-image"]').should('be.visible');
      cy.get('[data-testid="first-image"]').should('be.visible');
      cy.get('[data-testid="last-image"]').should('be.visible');
      
      // Navigate through images
      cy.get('[data-testid="current-image-number"]').invoke('text').as('initialImage');
      
      cy.get('[data-testid="next-image"]').click();
      cy.get('@initialImage').then(initial => {
        cy.get('[data-testid="current-image-number"]').should('not.contain', initial);
      });
      
      // Test keyboard navigation
      cy.get('[data-testid="viewer-canvas"]').focus();
      cy.get('[data-testid="viewer-canvas"]').type('{rightarrow}');
      cy.get('[data-testid="viewer-canvas"]').type('{leftarrow}');
      
      // Test mouse wheel navigation
      cy.get('[data-testid="viewer-canvas"]').trigger('wheel', { deltaY: 100 });
    });

    it('should provide image manipulation tools', () => {
      cy.get('[data-testid="open-viewer"]').click();
      
      // Test windowing controls
      cy.get('[data-testid="window-width"]').should('be.visible');
      cy.get('[data-testid="window-center"]').should('be.visible');
      
      // Test preset windows
      cy.get('[data-testid="window-presets"]').should('be.visible');
      cy.get('[data-testid="preset-lung"]').click();
      cy.get('[data-testid="preset-bone"]').click();
      cy.get('[data-testid="preset-soft-tissue"]').click();
      
      // Test zoom controls
      cy.get('[data-testid="zoom-in"]').should('be.visible');
      cy.get('[data-testid="zoom-out"]').should('be.visible');
      cy.get('[data-testid="zoom-fit"]').click();
      cy.get('[data-testid="zoom-actual"]').click();
      
      // Test pan functionality
      cy.get('[data-testid="pan-tool"]').click();
      cy.get('[data-testid="viewer-canvas"]').trigger('mousedown', { which: 1, clientX: 100, clientY: 100 });
      cy.get('[data-testid="viewer-canvas"]').trigger('mousemove', { clientX: 150, clientY: 150 });
      cy.get('[data-testid="viewer-canvas"]').trigger('mouseup');
      
      // Test reset view
      cy.get('[data-testid="reset-view"]').click();
    });

    it('should support measurement and annotation tools', () => {
      cy.get('[data-testid="open-viewer"]').click();
      
      // Test measurement tools
      cy.get('[data-testid="measurement-tools"]').should('be.visible');
      
      // Length measurement
      cy.get('[data-testid="length-tool"]').click();
      cy.get('[data-testid="viewer-canvas"]').click(100, 100);
      cy.get('[data-testid="viewer-canvas"]').click(200, 200);
      cy.get('[data-testid="measurement-result"]').should('be.visible');
      
      // Angle measurement
      cy.get('[data-testid="angle-tool"]').click();
      cy.get('[data-testid="viewer-canvas"]').click(150, 100);
      cy.get('[data-testid="viewer-canvas"]').click(200, 150);
      cy.get('[data-testid="viewer-canvas"]').click(250, 100);
      cy.get('[data-testid="angle-result"]').should('be.visible');
      
      // ROI measurement
      cy.get('[data-testid="roi-tool"]').click();
      cy.get('[data-testid="viewer-canvas"]').click(100, 100);
      cy.get('[data-testid="viewer-canvas"]').click(200, 100);
      cy.get('[data-testid="viewer-canvas"]').click(200, 200);
      cy.get('[data-testid="viewer-canvas"]').click(100, 200);
      cy.get('[data-testid="viewer-canvas"]').dblclick();
      cy.get('[data-testid="roi-statistics"]').should('be.visible');
      
      // Test annotation tools
      cy.get('[data-testid="annotation-tools"]').should('be.visible');
      cy.get('[data-testid="text-annotation"]').click();
      cy.get('[data-testid="viewer-canvas"]').click(150, 150);
      cy.get('[data-testid="annotation-input"]').type('Test annotation');
      cy.get('[data-testid="save-annotation"]').click();
      
      // Verify annotation appears
      cy.get('[data-testid="annotation-text"]').should('contain', 'Test annotation');
    });

    it('should handle multi-planar reconstruction for 3D datasets', () => {
      // Skip if not 3D dataset
      cy.get('body').then($body => {
        if ($body.find('[data-testid="mpr-available"]').length > 0) {
          cy.get('[data-testid="open-viewer"]').click();
          
          // Enable MPR mode
          cy.get('[data-testid="mpr-mode"]').click();
          cy.get('[data-testid="mpr-viewer"]').should('be.visible');
          
          // Verify three orthogonal views
          cy.get('[data-testid="axial-view"]').should('be.visible');
          cy.get('[data-testid="coronal-view"]').should('be.visible');
          cy.get('[data-testid="sagittal-view"]').should('be.visible');
          
          // Test cross-reference lines
          cy.get('[data-testid="axial-view"]').click(100, 100);
          cy.get('[data-testid="crosshair-coronal"]').should('be.visible');
          cy.get('[data-testid="crosshair-sagittal"]').should('be.visible');
          
          // Test slice synchronization
          cy.get('[data-testid="sync-slices"]').check();
          cy.get('[data-testid="axial-view"]').trigger('wheel', { deltaY: 100 });
          cy.get('[data-testid="slice-position"]').should('be.visible');
        }
      });
    });
  });

  describe('Imaging Orders and Workflow Integration', () => {
    it('should create and track imaging orders', () => {
      cy.navigateToTab('orders');
      
      // Create new imaging order
      cy.get('[data-testid="new-order-button"]').click();
      cy.get('[data-testid="order-type-imaging"]').click();
      
      // Select imaging study type
      cy.get('[data-testid="imaging-type"]').select('CT');
      cy.get('[data-testid="body-part"]').select('Chest');
      cy.get('[data-testid="contrast"]').select('with-contrast');
      
      // Clinical information
      cy.get('[data-testid="clinical-indication"]').type('Chest pain, rule out pulmonary embolism');
      cy.get('[data-testid="ordering-provider"]').select('Dr. Smith');
      cy.get('[data-testid="priority"]').select('urgent');
      
      // Scheduling preferences
      cy.get('[data-testid="preferred-date"]').type('2024-01-16');
      cy.get('[data-testid="preferred-time"]').select('morning');
      cy.get('[data-testid="special-instructions"]').type('Patient claustrophobic, may need sedation');
      
      // Submit order
      cy.get('[data-testid="submit-imaging-order"]').click();
      
      // Verify success
      cy.expectToast('Imaging order created successfully');
      cy.get('[data-testid="imaging-orders"]').should('contain', 'CT Chest');
      cy.get('[data-testid="order-status"]').should('contain', 'Ordered');
      
      // Verify ServiceRequest created
      cy.wait('@fhirCreate').then(interception => {
        expect(interception.response.body.resourceType).to.equal('ServiceRequest');
        expect(interception.response.body.code.coding[0].display).to.contain('CT');
      });
    });

    it('should handle radiology reporting workflow', () => {
      // Navigate to radiology module
      cy.visit('/radiology');
      
      // Find study for reporting
      cy.get('[data-testid="studies-for-reading"]').should('be.visible');
      cy.get('[data-testid="study-item"]').first().click();
      
      // Open reporting interface
      cy.get('[data-testid="create-report"]').click();
      cy.get('[data-testid="reporting-interface"]').should('be.visible');
      
      // Fill in report sections
      cy.get('[data-testid="technique"]').type('Contrast-enhanced CT of the chest performed');
      cy.get('[data-testid="findings"]').type('No evidence of pulmonary embolism. Lungs are clear.');
      cy.get('[data-testid="impression"]').type('No acute pulmonary pathology');
      
      // Set report status
      cy.get('[data-testid="report-status"]').select('final');
      cy.get('[data-testid="radiologist"]').select('Dr. Radiologist');
      
      // Submit report
      cy.get('[data-testid="submit-report"]').click();
      
      // Verify report created
      cy.expectToast('Radiology report created');
      cy.get('[data-testid="report-status"]').should('contain', 'Final');
      
      // Verify DiagnosticReport created
      cy.wait('@fhirCreate').then(interception => {
        expect(interception.response.body.resourceType).to.equal('DiagnosticReport');
        expect(interception.response.body.conclusion).to.contain('No acute pulmonary pathology');
      });
    });

    it('should integrate imaging results with clinical workflow', () => {
      // Navigate back to patient chart
      cy.visit('/');
      cy.get('[data-testid="patient-list-item"]').first().click();
      cy.navigateToTab('results');
      
      // Verify imaging results appear
      cy.get('[data-testid="imaging-results"]').should('be.visible');
      cy.get('[data-testid="diagnostic-report"]').should('have.length.greaterThan', 0);
      
      // View detailed imaging report
      cy.get('[data-testid="diagnostic-report"]').first().click();
      cy.get('[data-testid="report-details"]').should('be.visible');
      cy.get('[data-testid="report-findings"]').should('be.visible');
      cy.get('[data-testid="report-impression"]').should('be.visible');
      
      // Link to imaging viewer
      cy.get('[data-testid="view-images"]').click();
      cy.get('[data-testid="dicom-viewer"]').should('be.visible');
      
      // Verify study linked correctly
      cy.get('[data-testid="linked-report"]').should('be.visible');
    });
  });

  describe('Advanced Imaging Features', () => {
    it('should support DICOM metadata display and search', () => {
      cy.navigateToTab('imaging');
      cy.get('[data-testid="study-item"]').first().click();
      
      // View DICOM metadata
      cy.get('[data-testid="view-metadata"]').click();
      cy.get('[data-testid="dicom-metadata"]').should('be.visible');
      
      // Verify key DICOM tags
      cy.get('[data-testid="patient-name-tag"]').should('be.visible');
      cy.get('[data-testid="study-date-tag"]').should('be.visible');
      cy.get('[data-testid="modality-tag"]').should('be.visible');
      cy.get('[data-testid="study-description-tag"]').should('be.visible');
      
      // Search metadata
      cy.get('[data-testid="metadata-search"]').type('Patient');
      cy.get('[data-testid="metadata-results"]').should('contain', 'Patient');
      
      // Export metadata
      cy.get('[data-testid="export-metadata"]').click();
      cy.get('[data-testid="metadata-format"]').select('json');
      cy.get('[data-testid="download-metadata"]').click();
    });

    it('should handle imaging study comparison', () => {
      cy.navigateToTab('imaging');
      
      // Select multiple studies for comparison
      cy.get('[data-testid="study-item"]').first().find('[data-testid="select-study"]').check();
      cy.get('[data-testid="study-item"]').eq(1).find('[data-testid="select-study"]').check();
      
      // Open comparison viewer
      cy.get('[data-testid="compare-studies"]').click();
      cy.get('[data-testid="comparison-viewer"]').should('be.visible');
      
      // Verify side-by-side display
      cy.get('[data-testid="left-viewer"]').should('be.visible');
      cy.get('[data-testid="right-viewer"]').should('be.visible');
      
      // Test synchronized navigation
      cy.get('[data-testid="sync-navigation"]').check();
      cy.get('[data-testid="left-viewer"]').trigger('wheel', { deltaY: 100 });
      
      // Test synchronized windowing
      cy.get('[data-testid="sync-windowing"]').check();
      cy.get('[data-testid="window-preset"]').select('lung');
    });

    it('should support imaging workflow automation', () => {
      // Test auto-routing based on study type
      cy.navigateToTab('imaging');
      cy.get('[data-testid="workflow-settings"]').click();
      
      // Configure auto-routing rules
      cy.get('[data-testid="add-routing-rule"]').click();
      cy.get('[data-testid="rule-condition"]').select('modality');
      cy.get('[data-testid="rule-value"]').select('CT');
      cy.get('[data-testid="rule-action"]').select('route-to-radiologist');
      cy.get('[data-testid="target-radiologist"]').select('Dr. CT Specialist');
      cy.get('[data-testid="save-routing-rule"]').click();
      
      // Test hanging protocol configuration
      cy.get('[data-testid="hanging-protocols"]').click();
      cy.get('[data-testid="add-protocol"]').click();
      cy.get('[data-testid="protocol-name"]').type('Chest CT Protocol');
      cy.get('[data-testid="protocol-modality"]').select('CT');
      cy.get('[data-testid="protocol-body-part"]').select('Chest');
      cy.get('[data-testid="default-layout"]').select('2x2');
      cy.get('[data-testid="default-window"]').select('lung');
      cy.get('[data-testid="save-protocol"]').click();
      
      cy.expectToast('Hanging protocol saved');
    });
  });

  describe('Imaging Quality Assurance', () => {
    it('should validate DICOM conformance and image quality', () => {
      cy.navigateToTab('imaging');
      cy.get('[data-testid="study-item"]').first().click();
      
      // Run DICOM validation
      cy.get('[data-testid="validate-dicom"]').click();
      cy.get('[data-testid="validation-results"]').should('be.visible');
      
      // Check validation status
      cy.get('[data-testid="dicom-conformance"]').should('contain', 'Pass');
      cy.get('[data-testid="image-quality"]').should('be.visible');
      
      // Review validation details
      cy.get('[data-testid="validation-details"]').click();
      cy.get('[data-testid="tag-validation"]').should('be.visible');
      cy.get('[data-testid="image-integrity"]').should('be.visible');
    });

    it('should handle imaging study archival and retrieval', () => {
      cy.navigateToTab('imaging');
      
      // Test study archival
      cy.get('[data-testid="study-item"]').first().find('[data-testid="archive-study"]').click();
      cy.get('[data-testid="archive-confirmation"]').should('be.visible');
      cy.get('[data-testid="confirm-archive"]').click();
      
      cy.expectToast('Study archived successfully');
      
      // Test archived study retrieval
      cy.get('[data-testid="show-archived"]').check();
      cy.get('[data-testid="archived-studies"]').should('be.visible');
      
      // Retrieve archived study
      cy.get('[data-testid="archived-study"]').first().find('[data-testid="retrieve-study"]').click();
      cy.expectToast('Study retrieval initiated');
    });

    it('should monitor imaging system performance and usage', () => {
      cy.visit('/administration/imaging-analytics');
      
      // Verify analytics dashboard
      cy.get('[data-testid="imaging-analytics"]').should('be.visible');
      
      // Check key metrics
      cy.get('[data-testid="studies-per-day"]').should('be.visible');
      cy.get('[data-testid="average-read-time"]').should('be.visible');
      cy.get('[data-testid="turnaround-time"]').should('be.visible');
      cy.get('[data-testid="storage-usage"]').should('be.visible');
      
      // Test date range filtering
      cy.get('[data-testid="date-range"]').select('last-30-days');
      cy.get('[data-testid="refresh-analytics"]').click();
      
      // Export analytics report
      cy.get('[data-testid="export-analytics"]').click();
      cy.get('[data-testid="report-format"]').select('pdf');
      cy.get('[data-testid="generate-report"]').click();
      
      cy.expectToast('Analytics report generated');
    });
  });
});