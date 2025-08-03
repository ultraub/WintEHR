/**
 * Enhanced Imaging Search Service
 * Provides comprehensive FHIR R4 ImagingStudy search capabilities with advanced filtering
 */

export class EnhancedImagingSearchService {
  constructor() {
    this.baseUrl = '/fhir/R4';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Search imaging studies with comprehensive FHIR R4 parameters
   * @param {string} patientId - Patient identifier
   * @param {Object} searchParams - Enhanced search parameters
   * @returns {Object} Enhanced search results with studies, performers, and orders
   */
  async searchImagingStudies(patientId, searchParams = {}) {
    const cacheKey = this.generateCacheKey(patientId, searchParams);
    const cached = this.getCachedResult(cacheKey);
    
    if (cached) {
      return cached;
    }

    const baseParams = {
      subject: `Patient/${patientId}`,
      _include: 'ImagingStudy:performer',
      _revinclude: 'ServiceRequest:subject',
      _sort: '-started',
      _count: searchParams._count || 50
    };

    const combinedParams = { ...baseParams, ...this.buildFHIRSearchParams(searchParams) };

    try {
      const response = await fetch(`${this.baseUrl}/ImagingStudy?${new URLSearchParams(combinedParams)}`);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status} ${response.statusText}`);
      }

      const bundle = await response.json();
      
      const result = {
        studies: this.extractStudies(bundle),
        performers: this.extractPerformers(bundle),
        orders: this.extractOrders(bundle),
        total: bundle.total || 0,
        searchParams: combinedParams,
        timestamp: new Date().toISOString()
      };

      this.setCacheResult(cacheKey, result);
      return result;
      
    } catch (error) {
      console.error('Enhanced imaging search failed:', error);
      throw new Error(`Failed to search imaging studies: ${error.message}`);
    }
  }

  /**
   * Build FHIR R4 compliant search parameters
   * @param {Object} searchParams - Input search parameters
   * @returns {Object} FHIR compliant search parameters
   */
  buildFHIRSearchParams(searchParams) {
    const fhirParams = {};

    // Modality filtering (supports multiple modalities)
    if (searchParams.modality && searchParams.modality.length > 0) {
      if (Array.isArray(searchParams.modality)) {
        fhirParams.modality = searchParams.modality.join(',');
      } else {
        fhirParams.modality = searchParams.modality;
      }
    }

    // Status filtering
    if (searchParams.status && searchParams.status !== 'all') {
      fhirParams.status = searchParams.status;
    }

    // Date range filtering (started parameter)
    if (searchParams.started) {
      if (searchParams.started.from) {
        fhirParams.started = `ge${this.formatDateForFHIR(searchParams.started.from)}`;
      }
      if (searchParams.started.to) {
        const existing = fhirParams.started || '';
        fhirParams.started = existing ? 
          `${existing}&started=le${this.formatDateForFHIR(searchParams.started.to)}` : 
          `le${this.formatDateForFHIR(searchParams.started.to)}`;
      }
    }

    // Performer-based filtering (radiologist/technologist)
    if (searchParams.performer) {
      fhirParams['performer.actor'] = searchParams.performer.startsWith('Practitioner/') ? 
        searchParams.performer : `Practitioner/${searchParams.performer}`;
    }

    // Identifier search (accession number, study instance UID)
    if (searchParams.identifier) {
      fhirParams.identifier = searchParams.identifier;
    }

    // Body site filtering
    if (searchParams.bodySite) {
      fhirParams['bodysite'] = searchParams.bodySite;
    }

    // Facility/Location filtering
    if (searchParams.facility) {
      fhirParams['endpoint.connection-type'] = 'dicom-wado-rs';
      // Add facility-specific filtering via extensions
    }

    // Text search across multiple fields
    if (searchParams.textSearch) {
      // FHIR _text parameter for full-text search
      fhirParams._text = searchParams.textSearch;
    }

    // Series count filtering
    if (searchParams.minSeries) {
      fhirParams['series-count'] = `ge${searchParams.minSeries}`;
    }
    if (searchParams.maxSeries) {
      const existing = fhirParams['series-count'] || '';
      fhirParams['series-count'] = existing ? 
        `${existing}&series-count=le${searchParams.maxSeries}` : 
        `le${searchParams.maxSeries}`;
    }

    // Instance count filtering
    if (searchParams.minInstances) {
      fhirParams['instance-count'] = `ge${searchParams.minInstances}`;
    }
    if (searchParams.maxInstances) {
      const existing = fhirParams['instance-count'] || '';
      fhirParams['instance-count'] = existing ? 
        `${existing}&instance-count=le${searchParams.maxInstances}` : 
        `le${searchParams.maxInstances}`;
    }

    return fhirParams;
  }

  /**
   * Extract ImagingStudy resources from bundle
   * @param {Object} bundle - FHIR Bundle response
   * @returns {Array} Array of ImagingStudy resources
   */
  extractStudies(bundle) {
    if (!bundle.entry) return [];
    
    return bundle.entry
      .filter(entry => entry.resource?.resourceType === 'ImagingStudy')
      .map(entry => ({
        ...entry.resource,
        // Add computed fields for enhanced functionality
        _computedFields: {
          totalInstances: this.calculateTotalInstances(entry.resource),
          primaryModality: this.getPrimaryModality(entry.resource),
          studyDuration: this.calculateStudyDuration(entry.resource),
          hasMultipleModalities: this.hasMultipleModalities(entry.resource)
        }
      }));
  }

  /**
   * Extract Practitioner resources (performers) from bundle
   * @param {Object} bundle - FHIR Bundle response
   * @returns {Array} Array of Practitioner resources
   */
  extractPerformers(bundle) {
    if (!bundle.entry) return [];
    
    return bundle.entry
      .filter(entry => entry.resource?.resourceType === 'Practitioner')
      .map(entry => entry.resource);
  }

  /**
   * Extract ServiceRequest resources (orders) from bundle
   * @param {Object} bundle - FHIR Bundle response
   * @returns {Array} Array of ServiceRequest resources
   */
  extractOrders(bundle) {
    if (!bundle.entry) return [];
    
    return bundle.entry
      .filter(entry => entry.resource?.resourceType === 'ServiceRequest')
      .map(entry => entry.resource);
  }

  /**
   * Search imaging studies by specific criteria
   * @param {string} patientId - Patient identifier
   * @param {Object} criteria - Specific search criteria
   * @returns {Promise<Array>} Filtered imaging studies
   */
  async searchByModality(patientId, modality) {
    return this.searchImagingStudies(patientId, { modality: [modality] });
  }

  async searchByDateRange(patientId, fromDate, toDate) {
    return this.searchImagingStudies(patientId, {
      started: { from: fromDate, to: toDate }
    });
  }

  async searchByPerformer(patientId, performerId) {
    return this.searchImagingStudies(patientId, { performer: performerId });
  }

  async searchByAccessionNumber(patientId, accessionNumber) {
    return this.searchImagingStudies(patientId, { identifier: accessionNumber });
  }

  /**
   * Get available search filters for a patient
   * @param {string} patientId - Patient identifier
   * @returns {Object} Available filter options
   */
  async getAvailableFilters(patientId) {
    try {
      // Get basic study data to determine available filters
      const basicSearch = await this.searchImagingStudies(patientId, { _count: 50 }); // Reduced to prevent memory issues
      
      const filters = {
        modalities: this.extractUniqueModalities(basicSearch.studies),
        performers: this.extractUniquePerformers(basicSearch.performers),
        bodyParts: this.extractUniqueBodyParts(basicSearch.studies),
        facilities: this.extractUniqueFacilities(basicSearch.studies),
        dateRange: this.calculateDateRange(basicSearch.studies),
        statusOptions: this.extractUniqueStatuses(basicSearch.studies)
      };

      return filters;
    } catch (error) {
      console.error('Failed to get available filters:', error);
      return this.getDefaultFilters();
    }
  }

  /**
   * Helper methods for data processing
   */
  calculateTotalInstances(study) {
    if (study.numberOfInstances) return study.numberOfInstances;
    
    return study.series?.reduce((total, series) => {
      return total + (series.numberOfInstances || 0);
    }, 0) || 0;
  }

  getPrimaryModality(study) {
    if (!study.modality?.length) return 'Unknown';
    return study.modality[0].code || study.modality[0].display || 'Unknown';
  }

  calculateStudyDuration(study) {
    if (!study.started) return null;
    
    const startTime = new Date(study.started);
    const endTime = study.series?.reduce((latest, series) => {
      if (series.started) {
        const seriesStart = new Date(series.started);
        return seriesStart > latest ? seriesStart : latest;
      }
      return latest;
    }, startTime);

    if (endTime && endTime > startTime) {
      return Math.round((endTime - startTime) / 1000 / 60); // Duration in minutes
    }
    
    return null;
  }

  hasMultipleModalities(study) {
    return study.modality?.length > 1 || false;
  }

  extractUniqueModalities(studies) {
    const modalities = new Set();
    studies.forEach(study => {
      study.modality?.forEach(mod => {
        modalities.add(mod.code || mod.display);
      });
    });
    return Array.from(modalities).sort();
  }

  extractUniquePerformers(performers) {
    return performers.map(performer => ({
      id: performer.id,
      name: this.formatProviderName(performer),
      specialty: performer.qualification?.[0]?.code?.text
    }));
  }

  extractUniqueBodyParts(studies) {
    const bodyParts = new Set();
    studies.forEach(study => {
      study.bodySite?.forEach(site => {
        bodyParts.add(site.display || site.coding?.[0]?.display);
      });
    });
    return Array.from(bodyParts).filter(Boolean).sort();
  }

  extractUniqueFacilities(studies) {
    const facilities = new Set();
    studies.forEach(study => {
      // Extract facility information from extensions or other fields
      const facility = study.extension?.find(ext => 
        ext.url.includes('facility') || ext.url.includes('location')
      );
      if (facility) {
        facilities.add(facility.valueString || facility.valueReference?.display);
      }
    });
    return Array.from(facilities).filter(Boolean).sort();
  }

  calculateDateRange(studies) {
    if (!studies.length) return null;
    
    const dates = studies
      .map(study => study.started)
      .filter(Boolean)
      .map(date => new Date(date))
      .sort();

    return {
      earliest: dates[0]?.toISOString().split('T')[0],
      latest: dates[dates.length - 1]?.toISOString().split('T')[0]
    };
  }

  extractUniqueStatuses(studies) {
    const statuses = new Set();
    studies.forEach(study => {
      if (study.status) statuses.add(study.status);
    });
    return Array.from(statuses).sort();
  }

  formatProviderName(provider) {
    if (!provider.name?.length) return 'Unknown Provider';
    
    const name = provider.name[0];
    const given = name.given?.join(' ') || '';
    const family = name.family || '';
    const prefix = name.prefix?.join(' ') || '';
    
    return `${prefix} ${given} ${family}`.trim();
  }

  formatDateForFHIR(date) {
    if (date instanceof Date) {
      return date.toISOString().split('T')[0];
    }
    return date;
  }

  getDefaultFilters() {
    return {
      modalities: ['CT', 'MR', 'US', 'CR', 'DX', 'NM', 'PT'],
      performers: [],
      bodyParts: [],
      facilities: [],
      dateRange: null,
      statusOptions: ['available', 'pending', 'cancelled']
    };
  }

  /**
   * Cache management
   */
  generateCacheKey(patientId, searchParams) {
    return `${patientId}-${JSON.stringify(searchParams)}`;
  }

  getCachedResult(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCacheResult(cacheKey, data) {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  clearCache() {
    this.cache.clear();
  }
}

// Export singleton instance
export const enhancedImagingSearchService = new EnhancedImagingSearchService();