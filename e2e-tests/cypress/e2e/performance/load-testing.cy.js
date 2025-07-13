// Performance Tests - Load Testing and Performance Benchmarks
describe('Performance and Load Testing', () => {
  
  const PERFORMANCE_THRESHOLDS = {
    pageLoad: 3000,      // 3 seconds
    apiResponse: 500,    // 500ms
    searchResponse: 1000, // 1 second
    renderTime: 100      // 100ms
  };
  
  beforeEach(() => {
    cy.login();
  });

  describe('Page Load Performance', () => {
    it('should load dashboard within performance threshold', () => {
      const startTime = Date.now();
      
      cy.visit('/');
      cy.get('[data-testid="patient-list"]').should('be.visible');
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).to.be.lessThan(PERFORMANCE_THRESHOLDS.pageLoad);
      
      // Use Performance API
      cy.window().its('performance').then(performance => {
        const navigation = performance.getEntriesByType('navigation')[0];
        expect(navigation.loadEventEnd - navigation.navigationStart).to.be.lessThan(PERFORMANCE_THRESHOLDS.pageLoad);
      });
    });

    it('should load patient workspace efficiently', () => {
      cy.visit('/');
      cy.get('[data-testid="patient-list-item"]').first().then($el => {
        const startTime = Date.now();
        
        cy.wrap($el).click();
        cy.get('[data-testid="patient-workspace"]').should('be.visible');
        cy.get('[data-testid="summary-tab-content"]').should('be.visible');
        
        const loadTime = Date.now() - startTime;
        expect(loadTime).to.be.lessThan(PERFORMANCE_THRESHOLDS.pageLoad);
      });
    });

    it('should navigate between tabs quickly', () => {
      cy.visit('/');
      cy.get('[data-testid="patient-list-item"]').first().click();
      
      const tabs = ['summary', 'chart-review', 'results', 'orders'];
      
      tabs.forEach(tab => {
        const startTime = Date.now();
        
        cy.navigateToTab(tab);
        cy.get(`[data-testid="${tab}-tab-content"]`).should('be.visible');
        
        const loadTime = Date.now() - startTime;
        expect(loadTime).to.be.lessThan(PERFORMANCE_THRESHOLDS.renderTime);
      });
    });
  });

  describe('API Response Performance', () => {
    beforeEach(() => {
      cy.intercept('GET', '/fhir/R4/**').as('fhirGet');
      cy.intercept('POST', '/fhir/R4/**').as('fhirPost');
      cy.intercept('PUT', '/fhir/R4/**').as('fhirPut');
    });

    it('should respond to FHIR GET requests quickly', () => {
      cy.visit('/');
      cy.get('[data-testid="patient-list-item"]').first().click();
      
      cy.wait('@fhirGet').then(interception => {
        const duration = interception.response.duration || 0;
        expect(duration).to.be.lessThan(PERFORMANCE_THRESHOLDS.apiResponse);
      });
    });

    it('should handle concurrent FHIR requests efficiently', () => {
      cy.visit('/');
      cy.get('[data-testid="patient-list-item"]').first().click();
      cy.navigateToTab('chart-review');
      
      // Multiple requests should be made concurrently
      const requestPromises = [];
      for (let i = 0; i < 5; i++) {
        requestPromises.push(cy.wait('@fhirGet', { timeout: 10000 }));
      }
      
      // All requests should complete within threshold
      Promise.all(requestPromises).then(interceptions => {
        interceptions.forEach(interception => {
          const duration = interception.response.duration || 0;
          expect(duration).to.be.lessThan(PERFORMANCE_THRESHOLDS.apiResponse);
        });
      });
    });

    it('should create resources efficiently', () => {
      cy.visit('/');
      cy.get('[data-testid="patient-list-item"]').first().click();
      cy.navigateToTab('chart-review');
      
      const startTime = Date.now();
      
      // Create a new condition
      cy.get('[data-testid="add-condition"]').click();
      cy.get('[data-testid="condition-search"]').type('Hypertension');
      cy.get('[data-testid="condition-option"]').first().click();
      cy.get('[data-testid="save-condition"]').click();
      
      cy.wait('@fhirPost').then(interception => {
        const duration = interception.response.duration || 0;
        expect(duration).to.be.lessThan(PERFORMANCE_THRESHOLDS.apiResponse);
        
        const totalTime = Date.now() - startTime;
        expect(totalTime).to.be.lessThan(PERFORMANCE_THRESHOLDS.pageLoad);
      });
    });
  });

  describe('Search Performance', () => {
    it('should perform patient search quickly', () => {
      cy.visit('/');
      
      const startTime = Date.now();
      cy.get('[data-testid="patient-search"]').type('John');
      cy.get('[data-testid="patient-list-item"]').should('have.length.greaterThan', 0);
      
      const searchTime = Date.now() - startTime;
      expect(searchTime).to.be.lessThan(PERFORMANCE_THRESHOLDS.searchResponse);
    });

    it('should handle large result sets efficiently', () => {
      cy.visit('/');
      cy.get('[data-testid="patient-list-item"]').first().click();
      cy.navigateToTab('results');
      
      const startTime = Date.now();
      cy.get('[data-testid="results-section"]').should('be.visible');
      cy.get('[data-testid="lab-results"]').should('be.visible');
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).to.be.lessThan(PERFORMANCE_THRESHOLDS.searchResponse);
    });

    it('should perform medication search with autocomplete quickly', () => {
      cy.visit('/');
      cy.get('[data-testid="patient-list-item"]').first().click();
      cy.navigateToTab('orders');
      
      cy.get('[data-testid="new-order-button"]').click();
      cy.get('[data-testid="order-type-medication"]').click();
      
      const startTime = Date.now();
      cy.get('[data-testid="medication-search"]').type('Asp');
      cy.get('[data-testid="medication-dropdown"]').should('be.visible');
      cy.get('[data-testid="medication-option"]').should('have.length.greaterThan', 0);
      
      const searchTime = Date.now() - startTime;
      expect(searchTime).to.be.lessThan(PERFORMANCE_THRESHOLDS.searchResponse);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not have memory leaks during navigation', () => {
      cy.visit('/');
      
      // Get initial memory usage
      let initialMemory;
      cy.window().then(win => {
        if (win.performance.memory) {
          initialMemory = win.performance.memory.usedJSHeapSize;
        }
      });
      
      // Navigate through multiple patients and tabs
      for (let i = 0; i < 5; i++) {
        cy.get('[data-testid="patient-list-item"]').eq(i % 3).click();
        cy.navigateToTab('summary');
        cy.navigateToTab('chart-review');
        cy.navigateToTab('results');
        cy.get('[data-testid="back-to-patients"]').click();
      }
      
      // Check memory usage hasn't grown excessively
      cy.window().then(win => {
        if (win.performance.memory && initialMemory) {
          const currentMemory = win.performance.memory.usedJSHeapSize;
          const memoryIncrease = currentMemory - initialMemory;
          const memoryIncreaseRatio = memoryIncrease / initialMemory;
          
          // Memory shouldn't increase by more than 50%
          expect(memoryIncreaseRatio).to.be.lessThan(0.5);
        }
      });
    });

    it('should clean up event listeners and subscriptions', () => {
      cy.visit('/');
      cy.get('[data-testid="patient-list-item"]').first().click();
      
      // Check for proper cleanup by monitoring WebSocket connections
      cy.window().then(win => {
        const connections = [];
        
        // Mock WebSocket to track connections
        const originalWebSocket = win.WebSocket;
        win.WebSocket = function(url) {
          const ws = new originalWebSocket(url);
          connections.push(ws);
          return ws;
        };
        
        // Navigate to different tabs
        cy.navigateToTab('summary');
        cy.navigateToTab('chart-review');
        cy.navigateToTab('results');
        
        // Go back to patient list
        cy.get('[data-testid="back-to-patients"]').click();
        
        cy.then(() => {
          // Check that connections are properly closed
          const activeConnections = connections.filter(ws => ws.readyState === WebSocket.OPEN);
          expect(activeConnections.length).to.be.lessThan(2); // Should have at most 1 active connection
        });
      });
    });
  });

  describe('Large Dataset Performance', () => {
    it('should handle patients with many conditions efficiently', () => {
      // Find a patient with many conditions
      cy.searchFHIRResources('Condition', { _count: 100 }).then(response => {
        if (response.body.total > 50) {
          const patientId = response.body.entry[0].resource.subject.reference.split('/')[1];
          
          const startTime = Date.now();
          cy.navigateToPatient(patientId);
          cy.navigateToTab('chart-review');
          cy.get('[data-testid="conditions-section"]').should('be.visible');
          
          const loadTime = Date.now() - startTime;
          expect(loadTime).to.be.lessThan(PERFORMANCE_THRESHOLDS.pageLoad);
        }
      });
    });

    it('should paginate large result sets efficiently', () => {
      cy.visit('/');
      
      // Test patient list pagination
      cy.get('[data-testid="page-size-selector"]').select('100');
      
      const startTime = Date.now();
      cy.get('[data-testid="patient-list-item"]').should('have.length.lessThan', 101);
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).to.be.lessThan(PERFORMANCE_THRESHOLDS.searchResponse);
      
      // Test pagination navigation
      if (cy.get('[data-testid="next-page"]').should('exist')) {
        const pageStartTime = Date.now();
        cy.get('[data-testid="next-page"]').click();
        cy.get('[data-testid="patient-list-item"]').should('be.visible');
        
        const pageLoadTime = Date.now() - pageStartTime;
        expect(pageLoadTime).to.be.lessThan(PERFORMANCE_THRESHOLDS.searchResponse);
      }
    });

    it('should handle complex FHIR queries efficiently', () => {
      // Test complex search with multiple parameters
      const complexSearch = {
        'given': 'John',
        'family': 'Doe',
        'birthdate': 'ge1980-01-01',
        '_sort': 'family',
        '_count': '20'
      };
      
      const startTime = Date.now();
      cy.searchFHIRResources('Patient', complexSearch).then(response => {
        const searchTime = Date.now() - startTime;
        
        expect(response.status).to.equal(200);
        expect(searchTime).to.be.lessThan(PERFORMANCE_THRESHOLDS.searchResponse);
      });
    });
  });

  describe('Concurrent User Simulation', () => {
    it('should handle multiple simultaneous operations', () => {
      cy.visit('/');
      cy.get('[data-testid="patient-list-item"]').first().click();
      
      // Simulate multiple concurrent operations
      const operations = [];
      
      // Operation 1: Load chart review
      operations.push(
        cy.navigateToTab('chart-review').then(() => {
          cy.get('[data-testid="conditions-section"]').should('be.visible');
        })
      );
      
      // Operation 2: Load results
      operations.push(
        cy.navigateToTab('results').then(() => {
          cy.get('[data-testid="results-section"]').should('be.visible');
        })
      );
      
      // Operation 3: Search for medications
      operations.push(
        cy.navigateToTab('orders').then(() => {
          cy.get('[data-testid="new-order-button"]').click();
          cy.get('[data-testid="order-type-medication"]').click();
          cy.get('[data-testid="medication-search"]').type('Aspirin');
          cy.get('[data-testid="medication-dropdown"]').should('be.visible');
        })
      );
      
      // All operations should complete successfully
      Promise.all(operations).then(() => {
        cy.log('All concurrent operations completed successfully');
      });
    });

    it('should maintain performance under load', () => {
      // Simulate rapid user interactions
      cy.visit('/');
      
      const rapidOperations = [];
      for (let i = 0; i < 10; i++) {
        rapidOperations.push(
          cy.get('[data-testid="patient-search"]')
            .clear()
            .type(`Patient${i}`)
            .then(() => {
              cy.get('[data-testid="patient-list-item"]').should('be.visible');
            })
        );
      }
      
      // Measure overall performance
      const startTime = Date.now();
      Promise.all(rapidOperations).then(() => {
        const totalTime = Date.now() - startTime;
        const averageTime = totalTime / rapidOperations.length;
        
        expect(averageTime).to.be.lessThan(PERFORMANCE_THRESHOLDS.searchResponse / 2);
      });
    });
  });

  describe('Performance Monitoring and Metrics', () => {
    it('should collect performance metrics', () => {
      cy.visit('/');
      
      // Enable performance monitoring
      cy.window().then(win => {
        // Mark performance milestones
        win.performance.mark('app-start');
        
        cy.get('[data-testid="patient-list"]').should('be.visible').then(() => {
          win.performance.mark('patient-list-loaded');
          win.performance.measure('patient-list-load-time', 'app-start', 'patient-list-loaded');
          
          const measures = win.performance.getEntriesByType('measure');
          const loadMeasure = measures.find(m => m.name === 'patient-list-load-time');
          
          expect(loadMeasure.duration).to.be.lessThan(PERFORMANCE_THRESHOLDS.pageLoad);
        });
      });
    });

    it('should track resource timing', () => {
      cy.visit('/');
      
      cy.window().its('performance').then(performance => {
        const resources = performance.getEntriesByType('resource');
        
        // Check API call timings
        const apiCalls = resources.filter(r => r.name.includes('/fhir/R4/'));
        apiCalls.forEach(apiCall => {
          expect(apiCall.duration).to.be.lessThan(PERFORMANCE_THRESHOLDS.apiResponse);
        });
        
        // Check static resource timings
        const staticResources = resources.filter(r => 
          r.name.includes('.js') || r.name.includes('.css') || r.name.includes('.json')
        );
        staticResources.forEach(resource => {
          expect(resource.duration).to.be.lessThan(2000); // 2 seconds for static resources
        });
      });
    });

    it('should monitor runtime performance', () => {
      cy.visit('/');
      cy.get('[data-testid="patient-list-item"]').first().click();
      
      // Navigate through tabs and monitor performance
      const tabs = ['summary', 'chart-review', 'results', 'orders'];
      
      tabs.forEach((tab, index) => {
        cy.window().then(win => {
          const markName = `tab-${tab}-start`;
          win.performance.mark(markName);
          
          cy.navigateToTab(tab);
          cy.get(`[data-testid="${tab}-tab-content"]`).should('be.visible');
          
          cy.then(() => {
            const endMarkName = `tab-${tab}-end`;
            win.performance.mark(endMarkName);
            win.performance.measure(`tab-${tab}-render`, markName, endMarkName);
            
            const measures = win.performance.getEntriesByType('measure');
            const renderMeasure = measures.find(m => m.name === `tab-${tab}-render`);
            
            expect(renderMeasure.duration).to.be.lessThan(PERFORMANCE_THRESHOLDS.renderTime);
          });
        });
      });
    });

    afterEach(() => {
      // Clean up performance marks and measures
      cy.window().then(win => {
        if (win.performance.clearMarks) {
          win.performance.clearMarks();
        }
        if (win.performance.clearMeasures) {
          win.performance.clearMeasures();
        }
      });
    });
  });
});