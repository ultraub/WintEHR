/**
 * Clinical Cross-Reference Service
 * Builds bidirectional links between notes and clinical data
 */

import { fhirClient } from './fhirClient';

export class ClinicalCrossReferenceService {
  constructor() {
    this.crossRefCache = new Map();
    this.reverseIndexCache = new Map();
  }

  /**
   * Create cross-references when a note is created
   * @param {Object} documentRef - FHIR DocumentReference
   * @param {Array} linkedResources - Array of linked resource references
   * @returns {Array} Created cross-reference entries
   */
  async createCrossReferences(documentRef, linkedResources = []) {
    try {
      const crossRefs = [];
      
      for (const resourceRef of linkedResources) {
        const crossRef = {
          resourceType: 'Basic',
          id: `crossref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          meta: {
            profile: ['http://medgenemr.com/fhir/StructureDefinition/clinical-cross-reference']
          },
          code: {
            coding: [{
              system: 'http://medgenemr.com/fhir/CodeSystem/cross-reference-type',
              code: 'clinical-documentation-link',
              display: 'Clinical Documentation Link'
            }]
          },
          subject: {
            reference: `Patient/${documentRef.subject.reference.split('/')[1]}`
          },
          created: new Date().toISOString(),
          extension: [
            {
              url: 'http://medgenemr.com/fhir/StructureDefinition/source-document',
              valueReference: {
                reference: `DocumentReference/${documentRef.id}`,
                display: documentRef.description
              }
            },
            {
              url: 'http://medgenemr.com/fhir/StructureDefinition/target-resource',
              valueReference: {
                reference: resourceRef.reference,
                display: resourceRef.display
              }
            },
            {
              url: 'http://medgenemr.com/fhir/StructureDefinition/link-type',
              valueString: this.determineLinkType(resourceRef)
            },
            {
              url: 'http://medgenemr.com/fhir/StructureDefinition/link-strength',
              valueString: this.determineLinkStrength(documentRef, resourceRef)
            }
          ]
        };

        const created = await fhirClient.create('Basic', crossRef);
        crossRefs.push(created);
      }

      // Invalidate cache
      this.invalidateCache(documentRef.subject.reference.split('/')[1]);
      
      return crossRefs;

    } catch (error) {
      console.error('Error creating cross-references:', error);
      return [];
    }
  }

  /**
   * Get all notes linked to a specific clinical resource
   * @param {string} resourceType - FHIR resource type
   * @param {string} resourceId - Resource ID
   * @returns {Array} Linked DocumentReferences
   */
  async getLinkedNotes(resourceType, resourceId) {
    try {
      const resourceRef = `${resourceType}/${resourceId}`;
      
      // Search for cross-references pointing to this resource
      const crossRefs = await fhirClient.search('Basic', {
        'code': 'clinical-documentation-link',
        '_profile': 'http://medgenemr.com/fhir/StructureDefinition/clinical-cross-reference'
      });

      const linkedNotes = [];
      
      if (crossRefs?.entry) {
        for (const entry of crossRefs.entry) {
          const crossRef = entry.resource;
          
          // Check if this cross-reference targets our resource
          const targetExtension = crossRef.extension?.find(ext => 
            ext.url === 'http://medgenemr.com/fhir/StructureDefinition/target-resource'
          );
          
          if (targetExtension?.valueReference?.reference === resourceRef) {
            // Get the source document
            const sourceExtension = crossRef.extension?.find(ext => 
              ext.url === 'http://medgenemr.com/fhir/StructureDefinition/source-document'
            );
            
            if (sourceExtension?.valueReference?.reference) {
              const docId = sourceExtension.valueReference.reference.split('/')[1];
              try {
                const document = await fhirClient.read('DocumentReference', docId);
                
                // Add cross-reference metadata
                linkedNotes.push({
                  ...document,
                  crossReference: {
                    linkType: crossRef.extension?.find(ext => 
                      ext.url === 'http://medgenemr.com/fhir/StructureDefinition/link-type'
                    )?.valueString,
                    linkStrength: crossRef.extension?.find(ext => 
                      ext.url === 'http://medgenemr.com/fhir/StructureDefinition/link-strength'
                    )?.valueString,
                    created: crossRef.created
                  }
                });
              } catch (err) {
                console.warn(`Could not fetch document ${docId}:`, err);
              }
            }
          }
        }
      }

      return linkedNotes.sort((a, b) => 
        new Date(b.date || b.crossReference.created) - new Date(a.date || a.crossReference.created)
      );

    } catch (error) {
      console.error('Error getting linked notes:', error);
      return [];
    }
  }

  /**
   * Get all clinical data linked to a specific note
   * @param {string} documentId - DocumentReference ID
   * @returns {Object} Linked clinical resources by type
   */
  async getLinkedClinicalData(documentId) {
    try {
      const cacheKey = `linked-data-${documentId}`;
      
      if (this.crossRefCache.has(cacheKey)) {
        const cached = this.crossRefCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minute cache
          return cached.data;
        }
      }

      // Search for cross-references from this document
      const crossRefs = await fhirClient.search('Basic', {
        'code': 'clinical-documentation-link',
        '_profile': 'http://medgenemr.com/fhir/StructureDefinition/clinical-cross-reference'
      });

      const linkedData = {
        conditions: [],
        medications: [],
        observations: [],
        procedures: [],
        diagnosticReports: [],
        encounters: [],
        carePlans: [],
        other: []
      };

      if (crossRefs?.entry) {
        for (const entry of crossRefs.entry) {
          const crossRef = entry.resource;
          
          // Check if this cross-reference originates from our document
          const sourceExtension = crossRef.extension?.find(ext => 
            ext.url === 'http://medgenemr.com/fhir/StructureDefinition/source-document'
          );
          
          if (sourceExtension?.valueReference?.reference === `DocumentReference/${documentId}`) {
            // Get the target resource
            const targetExtension = crossRef.extension?.find(ext => 
              ext.url === 'http://medgenemr.com/fhir/StructureDefinition/target-resource'
            );
            
            if (targetExtension?.valueReference?.reference) {
              const [resourceType, resourceId] = targetExtension.valueReference.reference.split('/');
              
              try {
                const resource = await fhirClient.read(resourceType, resourceId);
                
                // Add cross-reference metadata
                const enrichedResource = {
                  ...resource,
                  crossReference: {
                    linkType: crossRef.extension?.find(ext => 
                      ext.url === 'http://medgenemr.com/fhir/StructureDefinition/link-type'
                    )?.valueString,
                    linkStrength: crossRef.extension?.find(ext => 
                      ext.url === 'http://medgenemr.com/fhir/StructureDefinition/link-strength'
                    )?.valueString,
                    created: crossRef.created
                  }
                };

                // Categorize by resource type
                switch (resourceType.toLowerCase()) {
                  case 'condition':
                    linkedData.conditions.push(enrichedResource);
                    break;
                  case 'medicationrequest':
                  case 'medicationstatement':
                  case 'medicationdispense':
                    linkedData.medications.push(enrichedResource);
                    break;
                  case 'observation':
                    linkedData.observations.push(enrichedResource);
                    break;
                  case 'procedure':
                    linkedData.procedures.push(enrichedResource);
                    break;
                  case 'diagnosticreport':
                    linkedData.diagnosticReports.push(enrichedResource);
                    break;
                  case 'encounter':
                    linkedData.encounters.push(enrichedResource);
                    break;
                  case 'careplan':
                    linkedData.carePlans.push(enrichedResource);
                    break;
                  default:
                    linkedData.other.push(enrichedResource);
                }
              } catch (err) {
                console.warn(`Could not fetch ${resourceType}/${resourceId}:`, err);
              }
            }
          }
        }
      }

      // Cache the result
      this.crossRefCache.set(cacheKey, {
        data: linkedData,
        timestamp: Date.now()
      });

      return linkedData;

    } catch (error) {
      console.error('Error getting linked clinical data:', error);
      return {
        conditions: [],
        medications: [],
        observations: [],
        procedures: [],
        diagnosticReports: [],
        encounters: [],
        carePlans: [],
        other: []
      };
    }
  }

  /**
   * Build reverse index for a patient's clinical data
   * @param {string} patientId - Patient ID
   * @returns {Object} Reverse index mapping
   */
  async buildReverseIndex(patientId) {
    try {
      const cacheKey = `reverse-index-${patientId}`;
      
      if (this.reverseIndexCache.has(cacheKey)) {
        const cached = this.reverseIndexCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 10 * 60 * 1000) { // 10 minute cache
          return cached.data;
        }
      }

      // Get all cross-references for this patient
      const crossRefs = await fhirClient.search('Basic', {
        'subject': `Patient/${patientId}`,
        'code': 'clinical-documentation-link',
        '_profile': 'http://medgenemr.com/fhir/StructureDefinition/clinical-cross-reference'
      });

      const reverseIndex = new Map();

      if (crossRefs?.entry) {
        for (const entry of crossRefs.entry) {
          const crossRef = entry.resource;
          
          const sourceExtension = crossRef.extension?.find(ext => 
            ext.url === 'http://medgenemr.com/fhir/StructureDefinition/source-document'
          );
          const targetExtension = crossRef.extension?.find(ext => 
            ext.url === 'http://medgenemr.com/fhir/StructureDefinition/target-resource'
          );
          
          if (sourceExtension && targetExtension) {
            const sourceRef = sourceExtension.valueReference.reference;
            const targetRef = targetExtension.valueReference.reference;
            
            // Build bidirectional mapping
            if (!reverseIndex.has(sourceRef)) {
              reverseIndex.set(sourceRef, { linkedTo: [], linkedFrom: [] });
            }
            if (!reverseIndex.has(targetRef)) {
              reverseIndex.set(targetRef, { linkedTo: [], linkedFrom: [] });
            }
            
            reverseIndex.get(sourceRef).linkedTo.push({
              reference: targetRef,
              linkType: crossRef.extension?.find(ext => 
                ext.url === 'http://medgenemr.com/fhir/StructureDefinition/link-type'
              )?.valueString,
              linkStrength: crossRef.extension?.find(ext => 
                ext.url === 'http://medgenemr.com/fhir/StructureDefinition/link-strength'
              )?.valueString
            });
            
            reverseIndex.get(targetRef).linkedFrom.push({
              reference: sourceRef,
              linkType: crossRef.extension?.find(ext => 
                ext.url === 'http://medgenemr.com/fhir/StructureDefinition/link-type'
              )?.valueString,
              linkStrength: crossRef.extension?.find(ext => 
                ext.url === 'http://medgenemr.com/fhir/StructureDefinition/link-strength'
              )?.valueString
            });
          }
        }
      }

      // Cache the result
      this.reverseIndexCache.set(cacheKey, {
        data: reverseIndex,
        timestamp: Date.now()
      });

      return reverseIndex;

    } catch (error) {
      console.error('Error building reverse index:', error);
      return new Map();
    }
  }

  /**
   * Get cross-reference summary for a resource
   * @param {string} resourceType - FHIR resource type
   * @param {string} resourceId - Resource ID
   * @returns {Object} Cross-reference summary
   */
  async getCrossReferenceSummary(resourceType, resourceId) {
    try {
      const resourceRef = `${resourceType}/${resourceId}`;
      const linkedNotes = await this.getLinkedNotes(resourceType, resourceId);
      
      const summary = {
        totalNotes: linkedNotes.length,
        notesByType: {},
        linksByStrength: {
          strong: 0,
          medium: 0,
          weak: 0
        },
        mostRecentNote: null,
        oldestNote: null
      };

      linkedNotes.forEach(note => {
        // Count by note type
        const noteType = note.type?.coding?.[0]?.display || 'Unknown';
        summary.notesByType[noteType] = (summary.notesByType[noteType] || 0) + 1;
        
        // Count by link strength
        const strength = note.crossReference?.linkStrength || 'medium';
        summary.linksByStrength[strength]++;
      });

      if (linkedNotes.length > 0) {
        summary.mostRecentNote = linkedNotes[0];
        summary.oldestNote = linkedNotes[linkedNotes.length - 1];
      }

      return summary;

    } catch (error) {
      console.error('Error getting cross-reference summary:', error);
      return {
        totalNotes: 0,
        notesByType: {},
        linksByStrength: { strong: 0, medium: 0, weak: 0 },
        mostRecentNote: null,
        oldestNote: null
      };
    }
  }

  /**
   * Find related clinical data based on cross-references
   * @param {string} resourceType - FHIR resource type  
   * @param {string} resourceId - Resource ID
   * @returns {Object} Related clinical data
   */
  async findRelatedClinicalData(resourceType, resourceId) {
    try {
      const linkedNotes = await this.getLinkedNotes(resourceType, resourceId);
      const relatedData = {
        relatedConditions: new Set(),
        relatedMedications: new Set(),
        relatedObservations: new Set(),
        relatedProcedures: new Set()
      };

      // For each linked note, get its linked clinical data
      for (const note of linkedNotes) {
        const noteLinkedData = await this.getLinkedClinicalData(note.id);
        
        noteLinkedData.conditions.forEach(condition => 
          relatedData.relatedConditions.add(condition.id)
        );
        noteLinkedData.medications.forEach(medication => 
          relatedData.relatedMedications.add(medication.id)
        );
        noteLinkedData.observations.forEach(observation => 
          relatedData.relatedObservations.add(observation.id)
        );
        noteLinkedData.procedures.forEach(procedure => 
          relatedData.relatedProcedures.add(procedure.id)
        );
      }

      return {
        relatedConditions: Array.from(relatedData.relatedConditions),
        relatedMedications: Array.from(relatedData.relatedMedications),
        relatedObservations: Array.from(relatedData.relatedObservations),
        relatedProcedures: Array.from(relatedData.relatedProcedures)
      };

    } catch (error) {
      console.error('Error finding related clinical data:', error);
      return {
        relatedConditions: [],
        relatedMedications: [],
        relatedObservations: [],
        relatedProcedures: []
      };
    }
  }

  // Helper methods

  determineLinkType(resourceRef) {
    const [resourceType] = resourceRef.reference.split('/');
    
    switch (resourceType.toLowerCase()) {
      case 'condition':
        return 'problem-documentation';
      case 'medicationrequest':
      case 'medicationstatement':
        return 'medication-documentation';
      case 'observation':
        return 'result-documentation';
      case 'procedure':
        return 'procedure-documentation';
      case 'diagnosticreport':
        return 'diagnostic-documentation';
      case 'encounter':
        return 'encounter-documentation';
      case 'careplan':
        return 'care-plan-documentation';
      default:
        return 'clinical-documentation';
    }
  }

  determineLinkStrength(documentRef, resourceRef) {
    // Determine link strength based on various factors
    
    // Strong links: explicit references in document context
    if (documentRef.context?.related?.some(rel => 
      rel.reference === resourceRef.reference)) {
      return 'strong';
    }
    
    // Strong links: document extensions indicate direct linkage
    if (documentRef.extension?.some(ext => 
      ext.valueReference?.reference === resourceRef.reference)) {
      return 'strong';
    }
    
    // Medium links: same encounter or timeframe
    if (documentRef.context?.encounter && 
        resourceRef.encounter === documentRef.context.encounter[0]?.reference) {
      return 'medium';
    }
    
    // Default to weak for inferred relationships
    return 'weak';
  }

  invalidateCache(patientId) {
    // Clear caches for this patient
    this.reverseIndexCache.delete(`reverse-index-${patientId}`);
    
    // Clear related document caches
    for (const key of this.crossRefCache.keys()) {
      if (key.includes(patientId)) {
        this.crossRefCache.delete(key);
      }
    }
  }

  /**
   * Delete cross-references when a note is deleted
   * @param {string} documentId - DocumentReference ID
   */
  async deleteCrossReferences(documentId) {
    try {
      // Find all cross-references for this document
      const crossRefs = await fhirClient.search('Basic', {
        'code': 'clinical-documentation-link',
        '_profile': 'http://medgenemr.com/fhir/StructureDefinition/clinical-cross-reference'
      });

      const toDelete = [];
      
      if (crossRefs?.entry) {
        for (const entry of crossRefs.entry) {
          const crossRef = entry.resource;
          
          const sourceExtension = crossRef.extension?.find(ext => 
            ext.url === 'http://medgenemr.com/fhir/StructureDefinition/source-document'
          );
          
          if (sourceExtension?.valueReference?.reference === `DocumentReference/${documentId}`) {
            toDelete.push(crossRef.id);
          }
        }
      }

      // Delete the cross-references
      for (const id of toDelete) {
        await fhirClient.delete('Basic', id);
      }

      return toDelete.length;

    } catch (error) {
      console.error('Error deleting cross-references:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const clinicalCrossReferenceService = new ClinicalCrossReferenceService();