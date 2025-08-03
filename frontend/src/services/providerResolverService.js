/**
 * Provider Resolver Service
 * Resolves and manages Practitioner and PractitionerRole resources for imaging workflows
 */

export class ProviderResolverService {
  constructor() {
    this.providerCache = new Map();
    this.roleCache = new Map();
    this.specialtyCache = new Map();
    this.cacheTimeout = 15 * 60 * 1000; // 15 minutes
    this.baseUrl = '/fhir/R4';
  }

  /**
   * Resolve a provider reference to full provider information
   * @param {string} reference - FHIR reference (e.g., "Practitioner/123")
   * @returns {Promise<Object>} Enhanced provider object with roles and specialties
   */
  async resolveProvider(reference) {
    if (!reference) return null;

    const cacheKey = this.extractReferenceId(reference);
    const cached = this.getCachedProvider(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // Fetch the practitioner resource
      const practitionerResponse = await fetch(`${this.baseUrl}/${reference}`);
      if (!practitionerResponse.ok) {
        throw new Error(`Failed to fetch practitioner: ${practitionerResponse.status}`);
      }
      
      const practitioner = await practitionerResponse.json();

      // Fetch associated roles
      const rolesResponse = await fetch(
        `${this.baseUrl}/PractitionerRole?practitioner=${practitioner.id}&_include=PractitionerRole:organization`
      );
      
      let roles = [];
      if (rolesResponse.ok) {
        const rolesBundle = await rolesResponse.json();
        roles = this.extractPractitionerRoles(rolesBundle);
      }

      // Build enhanced provider object
      const enhancedProvider = {
        ...practitioner,
        roles: roles,
        specialties: this.extractSpecialties(roles),
        organizations: this.extractOrganizations(roles),
        imagingSpecialties: this.getRadiologySpecialties(roles),
        isRadiologist: this.isRadiologist(roles),
        isTechnologist: this.isTechnologist(roles),
        displayName: this.formatProviderName(practitioner),
        credentials: this.extractCredentials(practitioner, roles)
      };

      this.setCachedProvider(cacheKey, enhancedProvider);
      return enhancedProvider;

    } catch (error) {
      console.error('Failed to resolve provider:', error);
      return this.createUnknownProvider(reference);
    }
  }

  /**
   * Find available radiologists by specialty
   * @param {string} specialty - Radiology subspecialty
   * @param {string} organizationId - Optional organization filter
   * @returns {Promise<Array>} Available radiologists
   */
  async findAvailableRadiologists(specialty = null, organizationId = null) {
    try {
      const params = new URLSearchParams({
        'specialty': '394914008', // Radiology specialty code
        '_include': 'PractitionerRole:practitioner'
      });

      if (organizationId) {
        params.append('organization', organizationId);
      }

      if (specialty) {
        // Add subspecialty filter
        params.append('specialty', this.getSpecialtyCode(specialty));
      }

      const response = await fetch(`${this.baseUrl}/PractitionerRole?${params}`);
      const bundle = await response.json();

      const practitioners = this.extractPractitionersFromBundle(bundle);
      
      // Enhance with availability and workload data
      const enhancedPractitioners = await Promise.all(
        practitioners.map(async (practitioner) => ({
          ...practitioner,
          availability: await this.getProviderAvailability(practitioner.id),
          currentWorkload: await this.getProviderWorkload(practitioner.id),
          subspecialties: this.extractRadiologySubspecialties(practitioner.roles)
        }))
      );

      return enhancedPractitioners.filter(p => p.isRadiologist);

    } catch (error) {
      console.error('Failed to find radiologists:', error);
      return [];
    }
  }

  /**
   * Assign radiologist based on study characteristics
   * @param {Object} study - ImagingStudy resource
   * @returns {Promise<Object>} Assigned radiologist
   */
  async assignRadiologist(study) {
    const modality = study.modality?.[0]?.code;
    const bodySite = study.bodySite?.[0]?.coding?.[0]?.code;
    const priority = study.priority || 'routine';

    // Determine required subspecialty
    const requiredSpecialty = this.determineRequiredSpecialty(modality, bodySite);
    
    // Find available radiologists
    const availableRadiologists = await this.findAvailableRadiologists(requiredSpecialty);
    
    if (!availableRadiologists.length) {
      // Fallback to general radiologists
      return this.findAvailableRadiologists();
    }

    // Apply assignment algorithm
    return this.selectOptimalRadiologist(availableRadiologists, study, priority);
  }

  /**
   * Get technologists for specific modality
   * @param {string} modality - Imaging modality
   * @param {string} organizationId - Optional organization filter
   * @returns {Promise<Array>} Available technologists
   */
  async getTechnologistsForModality(modality, organizationId = null) {
    try {
      const params = new URLSearchParams({
        'specialty': '159033005', // Radiologic technologist
        '_include': 'PractitionerRole:practitioner'
      });

      if (organizationId) {
        params.append('organization', organizationId);
      }

      // Add modality-specific qualifications
      const modalityQualification = this.getModalityQualification(modality);
      if (modalityQualification) {
        params.append('qualification', modalityQualification);
      }

      const response = await fetch(`${this.baseUrl}/PractitionerRole?${params}`);
      const bundle = await response.json();

      const technologists = this.extractPractitionersFromBundle(bundle)
        .filter(p => p.isTechnologist);

      return technologists;

    } catch (error) {
      console.error('Failed to get technologists:', error);
      return [];
    }
  }

  /**
   * Get provider statistics for imaging department
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Object>} Provider statistics
   */
  async getImagingProviderStats(organizationId) {
    try {
      const radiologists = await this.findAvailableRadiologists(null, organizationId);
      const technologists = await this.getTechnologistsForModality(null, organizationId);

      const stats = {
        totalRadiologists: radiologists.length,
        totalTechnologists: technologists.length,
        radiologistsBySpecialty: this.groupBySpecialty(radiologists),
        technologistsByModality: this.groupByModalityExpertise(technologists),
        averageWorkload: this.calculateAverageWorkload(radiologists),
        availableNow: radiologists.filter(r => r.availability?.isAvailable).length
      };

      return stats;

    } catch (error) {
      console.error('Failed to get provider stats:', error);
      return null;
    }
  }

  /**
   * Helper methods for data extraction and processing
   */
  extractReferenceId(reference) {
    if (!reference) return null;
    return reference.includes('/') ? reference.split('/').pop() : reference;
  }

  extractPractitionerRoles(bundle) {
    if (!bundle.entry) return [];
    
    return bundle.entry
      .filter(entry => entry.resource?.resourceType === 'PractitionerRole')
      .map(entry => entry.resource);
  }

  extractPractitionersFromBundle(bundle) {
    if (!bundle.entry) return [];
    
    const practitioners = bundle.entry
      .filter(entry => entry.resource?.resourceType === 'Practitioner')
      .map(entry => entry.resource);

    const roles = this.extractPractitionerRoles(bundle);

    return practitioners.map(practitioner => ({
      ...practitioner,
      roles: roles.filter(role => 
        role.practitioner?.reference?.includes(practitioner.id)
      ),
      specialties: this.extractSpecialties(roles.filter(role => 
        role.practitioner?.reference?.includes(practitioner.id)
      )),
      isRadiologist: this.isRadiologist(roles.filter(role => 
        role.practitioner?.reference?.includes(practitioner.id)
      )),
      isTechnologist: this.isTechnologist(roles.filter(role => 
        role.practitioner?.reference?.includes(practitioner.id)
      )),
      displayName: this.formatProviderName(practitioner)
    }));
  }

  extractSpecialties(roles) {
    const specialties = [];
    roles.forEach(role => {
      role.specialty?.forEach(specialty => {
        const specialtyText = specialty.coding?.[0]?.display || specialty.text;
        if (specialtyText && !specialties.includes(specialtyText)) {
          specialties.push(specialtyText);
        }
      });
    });
    return specialties;
  }

  extractOrganizations(roles) {
    const organizations = [];
    roles.forEach(role => {
      if (role.organization?.display) {
        organizations.push({
          id: role.organization.reference?.split('/').pop(),
          name: role.organization.display
        });
      }
    });
    return organizations;
  }

  extractCredentials(practitioner, roles) {
    const credentials = [];
    
    // From practitioner qualifications
    practitioner.qualification?.forEach(qual => {
      credentials.push(qual.code?.text || qual.code?.coding?.[0]?.display);
    });

    // From role qualifications
    roles.forEach(role => {
      role.qualification?.forEach(qual => {
        const credText = qual.code?.text || qual.code?.coding?.[0]?.display;
        if (credText && !credentials.includes(credText)) {
          credentials.push(credText);
        }
      });
    });

    return credentials.filter(Boolean);
  }

  getRadiologySpecialties(roles) {
    const radiologySpecialties = [
      'Diagnostic Radiology',
      'Interventional Radiology',
      'Nuclear Medicine',
      'Radiation Oncology',
      'Neuroradiology',
      'Pediatric Radiology',
      'Musculoskeletal Radiology',
      'Abdominal Radiology',
      'Thoracic Radiology',
      'Breast Imaging',
      'Emergency Radiology',
      'Cardiac Imaging'
    ];

    return this.extractSpecialties(roles).filter(specialty =>
      radiologySpecialties.some(radSpec => 
        specialty.toLowerCase().includes(radSpec.toLowerCase())
      )
    );
  }

  isRadiologist(roles) {
    return roles.some(role =>
      role.specialty?.some(specialty =>
        specialty.coding?.some(coding =>
          coding.code === '394914008' || // Radiology
          coding.display?.toLowerCase().includes('radiolog')
        )
      )
    );
  }

  isTechnologist(roles) {
    return roles.some(role =>
      role.specialty?.some(specialty =>
        specialty.coding?.some(coding =>
          coding.code === '159033005' || // Radiologic technologist
          coding.display?.toLowerCase().includes('technolog')
        )
      )
    );
  }

  formatProviderName(practitioner) {
    if (!practitioner.name?.length) return 'Unknown Provider';
    
    const name = practitioner.name[0];
    const prefix = name.prefix?.join(' ') || '';
    const given = name.given?.join(' ') || '';
    const family = name.family || '';
    const suffix = name.suffix?.join(' ') || '';
    
    return `${prefix} ${given} ${family} ${suffix}`.trim();
  }

  determineRequiredSpecialty(modality, bodySite) {
    const specialtyMap = {
      'CT': {
        'neurologic': 'Neuroradiology',
        'musculoskeletal': 'Musculoskeletal Radiology',
        'chest': 'Thoracic Radiology',
        'abdomen': 'Abdominal Radiology',
        'pelvis': 'Abdominal Radiology'
      },
      'MR': {
        'neurologic': 'Neuroradiology',
        'musculoskeletal': 'Musculoskeletal Radiology',
        'cardiac': 'Cardiac Imaging'
      },
      'US': {
        'obstetric': 'Obstetric Ultrasound',
        'cardiac': 'Cardiac Imaging',
        'vascular': 'Vascular Imaging'
      },
      'MG': {
        'breast': 'Breast Imaging'
      },
      'NM': {
        'cardiac': 'Nuclear Cardiology',
        'oncologic': 'Nuclear Medicine'
      }
    };

    const modalitySpecialties = specialtyMap[modality];
    if (modalitySpecialties && bodySite) {
      return modalitySpecialties[bodySite] || 'Diagnostic Radiology';
    }

    return 'Diagnostic Radiology';
  }

  selectOptimalRadiologist(radiologists, study, priority) {
    // Score radiologists based on multiple factors
    const scoredRadiologists = radiologists.map(rad => {
      let score = 0;
      
      // Specialty match
      const requiredSpecialty = this.determineRequiredSpecialty(
        study.modality?.[0]?.code,
        study.bodySite?.[0]?.coding?.[0]?.code
      );
      
      if (rad.subspecialties?.includes(requiredSpecialty)) {
        score += 50;
      }
      
      // Availability
      if (rad.availability?.isAvailable) {
        score += 30;
      }
      
      // Workload (prefer less busy radiologists)
      const workloadPenalty = Math.min(rad.currentWorkload || 0, 20);
      score -= workloadPenalty;
      
      // Priority handling experience
      if (priority === 'urgent' && rad.credentials?.includes('Emergency Radiology')) {
        score += 25;
      }
      
      return { ...rad, assignmentScore: score };
    });

    // Sort by score and return the best match
    scoredRadiologists.sort((a, b) => b.assignmentScore - a.assignmentScore);
    return scoredRadiologists[0] || null;
  }

  async getProviderAvailability(providerId) {
    // Placeholder for availability checking logic
    // In a real system, this would check scheduling systems
    return {
      isAvailable: Math.random() > 0.3, // 70% available
      nextAvailable: new Date(Date.now() + Math.random() * 24 * 60 * 60 * 1000),
      hoursThisWeek: Math.floor(Math.random() * 40) + 20
    };
  }

  async getProviderWorkload(providerId) {
    // Placeholder for workload calculation
    // In a real system, this would check current assignments
    return Math.floor(Math.random() * 15); // 0-15 current studies
  }

  getSpecialtyCode(specialtyName) {
    const specialtyCodes = {
      'Neuroradiology': '394918000',
      'Interventional Radiology': '408440000',
      'Nuclear Medicine': '394649004',
      'Pediatric Radiology': '394916005'
    };
    
    return specialtyCodes[specialtyName] || '394914008'; // Default to general radiology
  }

  getModalityQualification(modality) {
    const qualificationCodes = {
      'CT': 'CT-qualified',
      'MR': 'MRI-qualified',
      'US': 'Ultrasound-qualified',
      'NM': 'Nuclear-medicine-qualified'
    };
    
    return qualificationCodes[modality];
  }

  groupBySpecialty(radiologists) {
    return radiologists.reduce((acc, rad) => {
      rad.subspecialties?.forEach(specialty => {
        if (!acc[specialty]) acc[specialty] = 0;
        acc[specialty]++;
      });
      return acc;
    }, {});
  }

  groupByModalityExpertise(technologists) {
    return technologists.reduce((acc, tech) => {
      tech.credentials?.forEach(cred => {
        if (cred.includes('qualified')) {
          const modality = cred.split('-')[0];
          if (!acc[modality]) acc[modality] = 0;
          acc[modality]++;
        }
      });
      return acc;
    }, {});
  }

  calculateAverageWorkload(providers) {
    if (!providers.length) return 0;
    const totalWorkload = providers.reduce((sum, p) => sum + (p.currentWorkload || 0), 0);
    return Math.round(totalWorkload / providers.length * 10) / 10;
  }

  createUnknownProvider(reference) {
    return {
      id: this.extractReferenceId(reference),
      name: [{ text: 'Unknown Provider' }],
      displayName: 'Unknown Provider',
      roles: [],
      specialties: [],
      organizations: [],
      imagingSpecialties: [],
      isRadiologist: false,
      isTechnologist: false,
      credentials: []
    };
  }

  /**
   * Cache management
   */
  getCachedProvider(providerId) {
    const cached = this.providerCache.get(providerId);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCachedProvider(providerId, provider) {
    this.providerCache.set(providerId, {
      data: provider,
      timestamp: Date.now()
    });

    // Clean up old cache entries
    if (this.providerCache.size > 100) {
      const oldestKey = this.providerCache.keys().next().value;
      this.providerCache.delete(oldestKey);
    }
  }

  clearCache() {
    this.providerCache.clear();
    this.roleCache.clear();
    this.specialtyCache.clear();
  }
}

// Export singleton instance
export const providerResolverService = new ProviderResolverService();