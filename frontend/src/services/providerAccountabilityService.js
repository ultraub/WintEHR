/**
 * Provider Accountability Service
 * 
 * Manages provider attribution and accountability workflows for lab results,
 * integrating with Practitioner and PractitionerRole FHIR R4 resources.
 */

import { fhirClient } from '../core/fhir/services/fhirClient';
import { CLINICAL_EVENTS } from '../contexts/ClinicalWorkflowContext';

class ProviderAccountabilityService {
  constructor() {
    this.providerCache = new Map();
    this.organizationCache = new Map();
    this.accountabilityRules = this.initializeRules();
  }

  initializeRules() {
    return {
      criticalValueNotification: {
        timeLimit: 30, // minutes
        requiredActions: ['acknowledge', 'document', 'follow-up'],
        escalationLevels: [
          { level: 1, time: 15, action: 'reminder' },
          { level: 2, time: 30, action: 'supervisor_notification' },
          { level: 3, time: 60, action: 'department_alert' }
        ]
      },
      abnormalResultReview: {
        timeLimit: 24 * 60, // minutes (24 hours)
        requiredActions: ['review', 'acknowledge'],
        escalationLevels: [
          { level: 1, time: 12 * 60, action: 'reminder' },
          { level: 2, time: 24 * 60, action: 'supervisor_notification' }
        ]
      },
      orderCompletion: {
        timeLimit: 72 * 60, // minutes (72 hours)
        requiredActions: ['review-result', 'complete-order'],
        escalationLevels: [
          { level: 1, time: 48 * 60, action: 'reminder' },
          { level: 2, time: 72 * 60, action: 'supervisor_notification' }
        ]
      }
    };
  }

  /**
   * Get comprehensive provider information with caching
   */
  async getProviderInfo(providerReference) {
    if (!providerReference) return null;

    if (this.providerCache.has(providerReference)) {
      return this.providerCache.get(providerReference);
    }

    try {
      const providerId = this.extractReferenceId(providerReference);
      const provider = await fhirClient.read('Practitioner', providerId);
      
      // Get provider role information for additional context
      const roles = await fhirClient.search('PractitionerRole', {
        practitioner: providerId,
        _include: 'PractitionerRole:organization'
      });

      const primaryRole = roles.resources[0];
      let organization = null;
      
      if (primaryRole?.organization?.reference) {
        const orgId = this.extractReferenceId(primaryRole.organization.reference);
        organization = await this.getOrganizationInfo(primaryRole.organization.reference);
      }

      const providerInfo = {
        id: provider.id,
        reference: providerReference,
        name: this.formatProviderName(provider.name),
        fullName: provider.name?.[0]?.text || this.formatProviderName(provider.name),
        specialty: primaryRole?.specialty?.[0]?.text || primaryRole?.specialty?.[0]?.coding?.[0]?.display,
        organization: organization?.name || primaryRole?.organization?.display,
        organizationId: organization?.id,
        department: primaryRole?.location?.[0]?.display,
        contact: {
          email: provider.telecom?.find(t => t.system === 'email')?.value,
          phone: provider.telecom?.find(t => t.system === 'phone')?.value,
          extension: provider.telecom?.find(t => t.system === 'phone' && t.use === 'work')?.value
        },
        active: provider.active !== false,
        qualification: provider.qualification?.map(q => ({
          code: q.code?.text || q.code?.coding?.[0]?.display,
          issuer: q.issuer?.display
        })) || [],
        role: {
          code: primaryRole?.code?.[0]?.text || primaryRole?.code?.[0]?.coding?.[0]?.display,
          active: primaryRole?.active !== false,
          period: primaryRole?.period
        }
      };

      this.providerCache.set(providerReference, providerInfo);
      return providerInfo;
    } catch (error) {
      console.error('Error fetching provider info:', error);
      return {
        id: null,
        reference: providerReference,
        name: 'Unknown Provider',
        fullName: 'Unknown Provider',
        specialty: null,
        organization: null,
        contact: {},
        active: false,
        qualification: [],
        role: {}
      };
    }
  }

  /**
   * Get organization information with caching
   */
  async getOrganizationInfo(orgReference) {
    if (!orgReference) return null;

    if (this.organizationCache.has(orgReference)) {
      return this.organizationCache.get(orgReference);
    }

    try {
      const orgId = this.extractReferenceId(orgReference);
      const organization = await fhirClient.read('Organization', orgId);
      
      const orgInfo = {
        id: organization.id,
        reference: orgReference,
        name: organization.name,
        type: organization.type?.[0]?.text || organization.type?.[0]?.coding?.[0]?.display,
        address: organization.address?.[0] ? {
          line: organization.address[0].line?.join(', '),
          city: organization.address[0].city,
          state: organization.address[0].state,
          postalCode: organization.address[0].postalCode,
          country: organization.address[0].country
        } : null,
        contact: {
          phone: organization.telecom?.find(t => t.system === 'phone')?.value,
          email: organization.telecom?.find(t => t.system === 'email')?.value,
          url: organization.telecom?.find(t => t.system === 'url')?.value
        },
        active: organization.active !== false
      };

      this.organizationCache.set(orgReference, orgInfo);
      return orgInfo;
    } catch (error) {
      console.error('Error fetching organization info:', error);
      return null;
    }
  }

  /**
   * Extract provider information from an observation or service request
   */
  async extractProviderContext(resource) {
    const context = {
      ordering: null,
      performing: null,
      reporting: null,
      responsible: null
    };

    // Get ordering provider from basedOn ServiceRequest
    if (resource.basedOn?.[0]?.reference) {
      try {
        const orderId = this.extractReferenceId(resource.basedOn[0].reference);
        const order = await fhirClient.read('ServiceRequest', orderId);
        
        if (order.requester?.reference) {
          context.ordering = await this.getProviderInfo(order.requester.reference);
        }
        
        // Also get the responsible provider if different
        if (order.performer?.[0]?.reference && order.performer[0].reference !== order.requester?.reference) {
          context.responsible = await this.getProviderInfo(order.performer[0].reference);
        }
      } catch (error) {
        console.error('Error getting ordering provider:', error);
      }
    }

    // Get performing provider/organization
    if (resource.performer?.[0]?.reference) {
      const performerRef = resource.performer[0].reference;
      
      if (performerRef.startsWith('Practitioner/')) {
        context.performing = await this.getProviderInfo(performerRef);
      } else if (performerRef.startsWith('Organization/')) {
        context.performing = await this.getOrganizationInfo(performerRef);
      }
    }

    // Get reporting provider (for diagnostic reports)
    if (resource.resultsInterpreter?.[0]?.reference) {
      context.reporting = await this.getProviderInfo(resource.resultsInterpreter[0].reference);
    }

    return context;
  }

  /**
   * Track provider accountability for a result
   */
  async trackProviderAccountability(observation, orderReference = null) {
    const accountability = {
      resultId: observation.id,
      resourceType: observation.resourceType,
      patientId: this.extractReferenceId(observation.subject?.reference),
      timestamp: new Date().toISOString(),
      effectiveDateTime: observation.effectiveDateTime || observation.issued,
      providers: await this.extractProviderContext(observation),
      actions: [],
      status: 'pending-review',
      priority: 'routine',
      requiredActions: [],
      timeLimit: null,
      escalationSchedule: []
    };

    // Determine accountability level based on result type
    const isCritical = this.isCriticalResult(observation);
    const isAbnormal = this.isAbnormalResult(observation);

    if (isCritical) {
      accountability.priority = 'critical';
      accountability.requiredActions = this.accountabilityRules.criticalValueNotification.requiredActions;
      accountability.timeLimit = this.accountabilityRules.criticalValueNotification.timeLimit;
      accountability.escalationSchedule = this.accountabilityRules.criticalValueNotification.escalationLevels;
    } else if (isAbnormal) {
      accountability.priority = 'high';
      accountability.requiredActions = this.accountabilityRules.abnormalResultReview.requiredActions;
      accountability.timeLimit = this.accountabilityRules.abnormalResultReview.timeLimit;
      accountability.escalationSchedule = this.accountabilityRules.abnormalResultReview.escalationLevels;
    } else {
      accountability.priority = 'routine';
      accountability.requiredActions = this.accountabilityRules.orderCompletion.requiredActions;
      accountability.timeLimit = this.accountabilityRules.orderCompletion.timeLimit;
      accountability.escalationSchedule = this.accountabilityRules.orderCompletion.escalationLevels;
    }

    // Store accountability record
    await this.storeAccountabilityRecord(accountability);

    return accountability;
  }

  /**
   * Get provider-specific results for filtering
   */
  async getProviderResults(patientId, providerRef, resultType = 'all') {
    try {
      let searchParams = {
        patient: patientId,
        _sort: '-date',
        _count: 1000
      };

      // Add provider-specific search based on result type
      if (resultType === 'ordered') {
        // Search for results based on orders from this provider
        const serviceRequests = await fhirClient.search('ServiceRequest', {
          patient: patientId,
          requester: providerRef,
          _sort: '-authored'
        });

        const orderIds = serviceRequests.resources.map(sr => `ServiceRequest/${sr.id}`);
        
        if (orderIds.length > 0) {
          // Search observations that reference these orders
          const observations = await fhirClient.search('Observation', {
            patient: patientId,
            'based-on': orderIds.join(','),
            _sort: '-date'
          });
          
          return observations.resources || [];
        }
        
        return [];
      } else if (resultType === 'performed') {
        // Search for results performed by this provider/organization
        searchParams.performer = providerRef;
      } else {
        // Search for all results involving this provider
        const orderedResults = await this.getProviderResults(patientId, providerRef, 'ordered');
        const performedResults = await this.getProviderResults(patientId, providerRef, 'performed');
        
        // Combine and deduplicate
        const allResults = [...orderedResults, ...performedResults];
        const uniqueResults = allResults.filter((result, index, self) => 
          index === self.findIndex(r => r.id === result.id)
        );
        
        return uniqueResults.sort((a, b) => {
          const dateA = new Date(a.effectiveDateTime || a.issued || 0);
          const dateB = new Date(b.effectiveDateTime || b.issued || 0);
          return dateB - dateA;
        });
      }

      const response = await fhirClient.search('Observation', searchParams);
      return response.resources || [];
    } catch (error) {
      console.error('Error getting provider results:', error);
      return [];
    }
  }

  /**
   * Get all providers involved in patient care (for filtering)
   */
  async getPatientProviders(patientId) {
    try {
      const providers = new Map();

      // Get providers from service requests
      const serviceRequests = await fhirClient.search('ServiceRequest', {
        patient: patientId,
        _include: 'ServiceRequest:requester',
        _include: 'ServiceRequest:performer',
        _sort: '-authored'
      });

      serviceRequests.resources.forEach(sr => {
        if (sr.requester?.reference) {
          providers.set(sr.requester.reference, { type: 'ordering', count: (providers.get(sr.requester.reference)?.count || 0) + 1 });
        }
        if (sr.performer?.[0]?.reference && sr.performer[0].reference !== sr.requester?.reference) {
          providers.set(sr.performer[0].reference, { type: 'performing', count: (providers.get(sr.performer[0].reference)?.count || 0) + 1 });
        }
      });

      // Get providers from observations
      const observations = await fhirClient.search('Observation', {
        patient: patientId,
        _include: 'Observation:performer',
        _sort: '-date',
        _count: 500
      });

      observations.resources.forEach(obs => {
        if (obs.performer?.[0]?.reference) {
          const ref = obs.performer[0].reference;
          if (ref.startsWith('Practitioner/')) {
            providers.set(ref, { type: 'performing', count: (providers.get(ref)?.count || 0) + 1 });
          }
        }
      });

      // Get detailed provider information
      const providerDetails = [];
      for (const [reference, info] of providers.entries()) {
        if (reference.startsWith('Practitioner/')) {
          const providerInfo = await this.getProviderInfo(reference);
          if (providerInfo && providerInfo.id) {
            providerDetails.push({
              ...providerInfo,
              involvement: info.type,
              resultCount: info.count
            });
          }
        }
      }

      return providerDetails.sort((a, b) => b.resultCount - a.resultCount);
    } catch (error) {
      console.error('Error getting patient providers:', error);
      return [];
    }
  }

  /**
   * Utility methods
   */
  formatProviderName(nameArray) {
    if (!nameArray || !Array.isArray(nameArray) || nameArray.length === 0) {
      return 'Unknown Provider';
    }

    const name = nameArray[0];
    const given = name.given?.join(' ') || '';
    const family = name.family || '';
    const prefix = name.prefix?.join(' ') || '';
    const suffix = name.suffix?.join(' ') || '';

    let fullName = '';
    if (prefix) fullName += prefix + ' ';
    if (given) fullName += given + ' ';
    if (family) fullName += family;
    if (suffix) fullName += ', ' + suffix;

    return fullName.trim() || 'Unknown Provider';
  }

  extractReferenceId(reference) {
    if (!reference) return null;
    
    if (typeof reference === 'string') {
      if (reference.startsWith('http://') || reference.startsWith('https://')) {
        const parts = reference.split('/');
        return parts[parts.length - 1];
      }
      return reference.split('/').pop();
    }
    
    if (reference.reference) {
      return this.extractReferenceId(reference.reference);
    }
    
    return null;
  }

  isCriticalResult(observation) {
    // This would integrate with the critical value detection service
    // For now, simplified logic
    const interpretation = observation.interpretation?.[0]?.coding?.[0]?.code;
    return interpretation === 'HH' || interpretation === 'LL' || interpretation === 'AA';
  }

  isAbnormalResult(observation) {
    const interpretation = observation.interpretation?.[0]?.coding?.[0]?.code;
    return ['H', 'L', 'A', 'HH', 'LL', 'AA'].includes(interpretation);
  }

  async storeAccountabilityRecord(accountability) {
    // In production, this would store in database or create FHIR Task resource
    // For now, we'll use console logging and local storage
    console.log('Storing accountability record:', accountability);
    
    // Could create a Task resource to track accountability
    try {
      const task = {
        resourceType: 'Task',
        status: 'requested',
        intent: 'order',
        priority: accountability.priority === 'critical' ? 'urgent' : 'routine',
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '33747-0',
            display: 'Result review task'
          }]
        },
        for: {
          reference: `Patient/${accountability.patientId}`
        },
        focus: {
          reference: `${accountability.resourceType}/${accountability.resultId}`
        },
        authoredOn: accountability.timestamp,
        requester: {
          display: 'EMR System'
        },
        owner: accountability.providers.ordering ? {
          reference: accountability.providers.ordering.reference
        } : undefined,
        description: `Review ${accountability.priority} lab result and complete required actions: ${accountability.requiredActions.join(', ')}`,
        restriction: accountability.timeLimit ? {
          period: {
            end: new Date(Date.now() + accountability.timeLimit * 60 * 1000).toISOString()
          }
        } : undefined
      };

      await fhirClient.create('Task', task);
    } catch (error) {
      console.error('Error creating accountability task:', error);
    }
  }

  /**
   * Clear provider cache (for testing or refresh)
   */
  clearCache() {
    this.providerCache.clear();
    this.organizationCache.clear();
  }

  /**
   * Get service statistics
   */
  getServiceStatistics() {
    return {
      cachedProviders: this.providerCache.size,
      cachedOrganizations: this.organizationCache.size,
      accountabilityRules: Object.keys(this.accountabilityRules).length
    };
  }
}

// Export singleton instance
export const providerAccountabilityService = new ProviderAccountabilityService();

// Also export class for testing
export default ProviderAccountabilityService;