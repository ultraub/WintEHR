/**
 * FHIR Data Migration System
 * Handles data consistency, versioning, and migration between FHIR versions
 */

import { validateResource } from './fhirValidation';
import { fhirClient } from '../services/fhirClient';

/**
 * Migration result class
 */
class MigrationResult {
  constructor() {
    this.success = true;
    this.resourcesProcessed = 0;
    this.resourcesMigrated = 0;
    this.errors = [];
    this.warnings = [];
    this.changes = [];
    this.startTime = new Date();
    this.endTime = null;
  }

  addError(message, resourceId = null, details = null) {
    this.errors.push({
      message,
      resourceId,
      details,
      timestamp: new Date()
    });
    this.success = false;
  }

  addWarning(message, resourceId = null, details = null) {
    this.warnings.push({
      message,
      resourceId,
      details,
      timestamp: new Date()
    });
  }

  addChange(description, resourceId, before, after) {
    this.changes.push({
      description,
      resourceId,
      before,
      after,
      timestamp: new Date()
    });
  }

  complete() {
    this.endTime = new Date();
  }

  get duration() {
    if (!this.endTime) return null;
    return this.endTime.getTime() - this.startTime.getTime();
  }

  toSummary() {
    return {
      success: this.success,
      duration: this.duration,
      resourcesProcessed: this.resourcesProcessed,
      resourcesMigrated: this.resourcesMigrated,
      errorsCount: this.errors.length,
      warningsCount: this.warnings.length,
      changesCount: this.changes.length
    };
  }
}

/**
 * Base migration class
 */
class BaseMigration {
  constructor(id, description, version) {
    this.id = id;
    this.description = description;
    this.version = version;
    this.dependencies = [];
  }

  /**
   * Check if this migration should run
   */
  shouldRun(resource) {
    return true;
  }

  /**
   * Apply migration to a resource
   */
  async apply(resource, context = {}) {
    throw new Error('apply() method must be implemented');
  }

  /**
   * Rollback migration (if supported)
   */
  async rollback(resource, context = {}) {
    throw new Error('Rollback not supported for this migration');
  }

  /**
   * Validate migration result
   */
  async validate(originalResource, migratedResource) {
    const validationResult = validateResource(migratedResource);
    return validationResult.isValid;
  }
}

/**
 * FHIR R4 to R4.0.1 Migration
 */
class FHIRR4to401Migration extends BaseMigration {
  constructor() {
    super(
      'fhir-r4-to-r4.0.1',
      'Migrate FHIR R4 resources to R4.0.1 specification',
      '4.0.1'
    );
  }

  shouldRun(resource) {
    // Check if resource needs R4.0.1 updates
    const metaProfile = resource.meta?.profile?.[0];
    return !metaProfile || !metaProfile.includes('4.0.1');
  }

  async apply(resource, context = {}) {
    const migrated = JSON.parse(JSON.stringify(resource));
    let changed = false;

    // Update meta.profile to R4.0.1
    if (!migrated.meta) {
      migrated.meta = {};
      changed = true;
    }

    if (!migrated.meta.profile || !migrated.meta.profile.some(p => p.includes('4.0.1'))) {
      const baseProfile = `http://hl7.org/fhir/StructureDefinition/${resource.resourceType}`;
      migrated.meta.profile = [`${baseProfile}|4.0.1`];
      changed = true;
    }

    // Update lastUpdated if changed
    if (changed) {
      migrated.meta.lastUpdated = new Date().toISOString();
    }

    return { resource: migrated, changed };
  }
}

/**
 * Reference Integrity Migration
 */
class ReferenceIntegrityMigration extends BaseMigration {
  constructor() {
    super(
      'reference-integrity',
      'Fix broken references and validate reference integrity',
      '1.0.0'
    );
  }

  shouldRun(resource) {
    return this.hasReferences(resource);
  }

  hasReferences(obj, path = '') {
    if (!obj || typeof obj !== 'object') return false;
    
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'reference' && typeof value === 'string') {
        return true;
      }
      if (typeof value === 'object') {
        if (this.hasReferences(value, `${path}.${key}`)) {
          return true;
        }
      }
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          if (this.hasReferences(value[i], `${path}.${key}[${i}]`)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  async apply(resource, context = {}) {
    const migrated = JSON.parse(JSON.stringify(resource));
    let changed = false;
    const changes = [];

    await this.processReferences(migrated, '', changes, context);
    
    if (changes.length > 0) {
      changed = true;
      if (!migrated.meta) migrated.meta = {};
      migrated.meta.lastUpdated = new Date().toISOString();
    }

    return { resource: migrated, changed, changes };
  }

  async processReferences(obj, path, changes, context) {
    if (!obj || typeof obj !== 'object') return;

    for (const [key, value] of Object.entries(obj)) {
      if (key === 'reference' && typeof value === 'string') {
        const fixedRef = await this.fixReference(value, context);
        if (fixedRef !== value) {
          obj[key] = fixedRef;
          changes.push({
            path: `${path}.${key}`,
            from: value,
            to: fixedRef,
            type: 'reference_fix'
          });
        }
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        await this.processReferences(value, `${path}.${key}`, changes, context);
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          await this.processReferences(value[i], `${path}.${key}[${i}]`, changes, context);
        }
      }
    }
  }

  async fixReference(reference, context) {
    // Fix common reference issues
    if (reference.startsWith('urn:uuid:')) {
      // UUID references are generally ok
      return reference;
    }

    if (reference.includes('//')) {
      // Fix double slashes
      const fixed = reference.replace(/\/+/g, '/');
      return fixed;
    }

    // Validate reference format
    const parts = reference.split('/');
    if (parts.length >= 2) {
      const [resourceType, id] = parts;
      
      // Validate resource type exists
      const validResourceTypes = ['Patient', 'Condition', 'Observation', 'MedicationRequest', 'Encounter', 'Practitioner', 'Organization'];
      if (!validResourceTypes.includes(resourceType)) {
        
      }

      // Validate ID format
      const idPattern = /^[A-Za-z0-9\-\.]{1,64}$/;
      if (!idPattern.test(id)) {
        
      }
    }

    return reference;
  }
}

/**
 * Code System Migration
 */
class CodeSystemMigration extends BaseMigration {
  constructor() {
    super(
      'code-system-migration',
      'Update coding systems to latest versions and fix deprecated codes',
      '1.0.0'
    );
  }

  shouldRun(resource) {
    return this.hasCoding(resource);
  }

  hasCoding(obj) {
    if (!obj || typeof obj !== 'object') return false;
    
    if (obj.coding && Array.isArray(obj.coding)) return true;
    if (obj.code && obj.system) return true;

    for (const value of Object.values(obj)) {
      if (typeof value === 'object') {
        if (this.hasCoding(value)) return true;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (this.hasCoding(item)) return true;
        }
      }
    }
    return false;
  }

  async apply(resource, context = {}) {
    const migrated = JSON.parse(JSON.stringify(resource));
    let changed = false;
    const changes = [];

    await this.processCoding(migrated, '', changes);
    
    if (changes.length > 0) {
      changed = true;
      if (!migrated.meta) migrated.meta = {};
      migrated.meta.lastUpdated = new Date().toISOString();
    }

    return { resource: migrated, changed, changes };
  }

  async processCoding(obj, path, changes) {
    if (!obj || typeof obj !== 'object') return;

    // Handle CodeableConcept
    if (obj.coding && Array.isArray(obj.coding)) {
      for (let i = 0; i < obj.coding.length; i++) {
        const coding = obj.coding[i];
        const updatedCoding = await this.updateCoding(coding);
        if (JSON.stringify(updatedCoding) !== JSON.stringify(coding)) {
          obj.coding[i] = updatedCoding;
          changes.push({
            path: `${path}.coding[${i}]`,
            from: coding,
            to: updatedCoding,
            type: 'coding_update'
          });
        }
      }
    }

    // Handle single coding
    if (obj.system && obj.code) {
      const updatedCoding = await this.updateCoding(obj);
      if (JSON.stringify(updatedCoding) !== JSON.stringify(obj)) {
        Object.assign(obj, updatedCoding);
        changes.push({
          path,
          from: { system: obj.system, code: obj.code },
          to: updatedCoding,
          type: 'coding_update'
        });
      }
    }

    // Recurse through other properties
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'coding') continue; // Already handled
      
      if (typeof value === 'object' && !Array.isArray(value)) {
        await this.processCoding(value, `${path}.${key}`, changes);
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          await this.processCoding(value[i], `${path}.${key}[${i}]`, changes);
        }
      }
    }
  }

  async updateCoding(coding) {
    const updated = { ...coding };

    // Common code system updates
    const systemMappings = {
      'http://snomed.info/sct': 'http://snomed.info/sct', // Current
      'http://snomed.info/id': 'http://snomed.info/sct', // Deprecated
      'http://loinc.org': 'http://loinc.org', // Current
      'http://www.nlm.nih.gov/research/umls/rxnorm': 'http://www.nlm.nih.gov/research/umls/rxnorm' // Current
    };

    if (updated.system && systemMappings[updated.system]) {
      updated.system = systemMappings[updated.system];
    }

    // Add version if missing for major code systems
    if (updated.system === 'http://snomed.info/sct' && !updated.version) {
      updated.version = 'http://snomed.info/sct/731000124108'; // US Edition
    }

    return updated;
  }
}

/**
 * Data Consistency Migration
 */
class DataConsistencyMigration extends BaseMigration {
  constructor() {
    super(
      'data-consistency',
      'Fix data consistency issues and normalize formats',
      '1.0.0'
    );
  }

  async apply(resource, context = {}) {
    const migrated = JSON.parse(JSON.stringify(resource));
    let changed = false;
    const changes = [];

    // Fix missing required fields
    const requiredFields = this.getRequiredFields(resource.resourceType);
    for (const field of requiredFields) {
      if (!this.hasField(migrated, field)) {
        this.setDefaultValue(migrated, field);
        changed = true;
        changes.push({
          type: 'required_field_added',
          field,
          value: this.getFieldValue(migrated, field)
        });
      }
    }

    // Normalize date formats
    const dateChanges = await this.normalizeDates(migrated);
    if (dateChanges.length > 0) {
      changed = true;
      changes.push(...dateChanges);
    }

    // Fix status values
    const statusChanges = await this.normalizeStatuses(migrated);
    if (statusChanges.length > 0) {
      changed = true;
      changes.push(...statusChanges);
    }

    if (changed) {
      if (!migrated.meta) migrated.meta = {};
      migrated.meta.lastUpdated = new Date().toISOString();
    }

    return { resource: migrated, changed, changes };
  }

  getRequiredFields(resourceType) {
    const requirements = {
      'Patient': ['id'],
      'Condition': ['subject', 'code'],
      'MedicationRequest': ['status', 'intent', 'subject'],
      'Observation': ['status', 'code', 'subject']
    };
    return requirements[resourceType] || ['id'];
  }

  hasField(obj, path) {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (!current || typeof current !== 'object' || !(part in current)) {
        return false;
      }
      current = current[part];
    }
    return current !== undefined && current !== null;
  }

  setDefaultValue(obj, path) {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }
    
    const lastPart = parts[parts.length - 1];
    if (!(lastPart in current)) {
      current[lastPart] = this.getDefaultForField(path, obj.resourceType);
    }
  }

  getDefaultForField(field, resourceType) {
    const defaults = {
      'id': () => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      'status': () => 'unknown',
      'intent': () => 'order'
    };
    
    const fieldName = field.split('.').pop();
    return defaults[fieldName] ? defaults[fieldName]() : 'unknown';
  }

  getFieldValue(obj, path) {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      current = current[part];
    }
    return current;
  }

  async normalizeDates(resource) {
    const changes = [];
    await this.processDateFields(resource, '', changes);
    return changes;
  }

  async processDateFields(obj, path, changes) {
    if (!obj || typeof obj !== 'object') return;

    const dateFields = ['date', 'dateTime', 'instant', 'time', 'effectiveDateTime', 'authoredOn', 'lastUpdated'];
    
    for (const [key, value] of Object.entries(obj)) {
      if (dateFields.some(field => key.toLowerCase().includes(field.toLowerCase())) && typeof value === 'string') {
        const normalized = this.normalizeDate(value);
        if (normalized !== value) {
          obj[key] = normalized;
          changes.push({
            type: 'date_normalized',
            path: `${path}.${key}`,
            from: value,
            to: normalized
          });
        }
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        await this.processDateFields(value, `${path}.${key}`, changes);
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          await this.processDateFields(value[i], `${path}.${key}[${i}]`, changes);
        }
      }
    }
  }

  normalizeDate(dateString) {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString; // Return original if invalid
      }
      
      // Normalize to ISO format
      if (dateString.includes('T')) {
        return date.toISOString();
      } else {
        return date.toISOString().split('T')[0];
      }
    } catch {
      return dateString;
    }
  }

  async normalizeStatuses(resource) {
    const changes = [];
    const statusMappings = {
      'active': 'active',
      'Active': 'active',
      'ACTIVE': 'active',
      'completed': 'completed',
      'Completed': 'completed',
      'COMPLETED': 'completed'
    };

    await this.processStatusFields(resource, '', changes, statusMappings);
    return changes;
  }

  async processStatusFields(obj, path, changes, mappings) {
    if (!obj || typeof obj !== 'object') return;

    if (obj.status && typeof obj.status === 'string' && mappings[obj.status]) {
      const normalized = mappings[obj.status];
      if (normalized !== obj.status) {
        changes.push({
          type: 'status_normalized',
          path: `${path}.status`,
          from: obj.status,
          to: normalized
        });
        obj.status = normalized;
      }
    }

    for (const [key, value] of Object.entries(obj)) {
      if (key === 'status') continue; // Already handled
      
      if (typeof value === 'object' && !Array.isArray(value)) {
        await this.processStatusFields(value, `${path}.${key}`, changes, mappings);
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          await this.processStatusFields(value[i], `${path}.${key}[${i}]`, changes, mappings);
        }
      }
    }
  }
}

/**
 * Migration Manager
 */
class MigrationManager {
  constructor() {
    this.migrations = [
      new ReferenceIntegrityMigration(),
      new CodeSystemMigration(),
      new DataConsistencyMigration(),
      new FHIRR4to401Migration()
    ];
    this.executedMigrations = new Set();
  }

  /**
   * Run all applicable migrations on a resource
   */
  async migrateResource(resource, context = {}) {
    const result = new MigrationResult();
    result.resourcesProcessed = 1;

    try {
      let currentResource = JSON.parse(JSON.stringify(resource));
      let totalChanged = false;

      for (const migration of this.migrations) {
        if (migration.shouldRun(currentResource)) {
          try {
            const migrationResult = await migration.apply(currentResource, context);
            
            if (migrationResult.changed) {
              totalChanged = true;
              result.addChange(
                `Migration ${migration.id}: ${migration.description}`,
                currentResource.id,
                currentResource,
                migrationResult.resource
              );
              currentResource = migrationResult.resource;
            }

            // Validate migration result
            const isValid = await migration.validate(resource, currentResource);
            if (!isValid) {
              result.addWarning(
                `Migration ${migration.id} produced invalid resource`,
                currentResource.id
              );
            }

          } catch (error) {
            result.addError(
              `Migration ${migration.id} failed: ${error.message}`,
              currentResource.id,
              error
            );
          }
        }
      }

      if (totalChanged) {
        result.resourcesMigrated = 1;
      }

      result.migratedResource = currentResource;

    } catch (error) {
      result.addError(
        `Resource migration failed: ${error.message}`,
        resource.id,
        error
      );
    }

    result.complete();
    return result;
  }

  /**
   * Run migrations on multiple resources
   */
  async migrateResources(resources, options = {}) {
    const { 
      batchSize = 10, 
      onProgress = null,
      dryRun = false,
      saveResults = true 
    } = options;

    const overallResult = new MigrationResult();
    const migratedResources = [];

    for (let i = 0; i < resources.length; i += batchSize) {
      const batch = resources.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (resource) => {
        const result = await this.migrateResource(resource);
        overallResult.resourcesProcessed++;
        
        if (result.success && result.resourcesMigrated > 0) {
          overallResult.resourcesMigrated++;
          if (!dryRun && saveResults) {
            // Save migrated resource back to database
            try {
              await this.saveResource(result.migratedResource);
            } catch (error) {
              result.addError(
                `Failed to save migrated resource: ${error.message}`,
                resource.id,
                error
              );
            }
          }
        }

        // Merge results
        overallResult.errors.push(...result.errors);
        overallResult.warnings.push(...result.warnings);
        overallResult.changes.push(...result.changes);

        return result;
      });

      const batchResults = await Promise.all(batchPromises);
      migratedResources.push(...batchResults.map(r => r.migratedResource).filter(Boolean));

      // Report progress
      if (onProgress) {
        onProgress({
          processed: overallResult.resourcesProcessed,
          total: resources.length,
          migrated: overallResult.resourcesMigrated,
          errors: overallResult.errors.length
        });
      }
    }

    overallResult.complete();
    overallResult.migratedResources = migratedResources;
    return overallResult;
  }

  /**
   * Save a resource back to the database
   */
  async saveResource(resource) {
    try {
      // Use PUT to update the resource
      const response = await fhirClient.update(resource.resourceType, resource.id, resource);
      return response;
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Get migration status for resources
   */
  async getMigrationStatus(resourceType = null) {
    try {
      const searchParams = resourceType ? { _type: resourceType } : {};
      const resources = await fhirClient.search('', { ...searchParams, _count: 1000 });
      
      const status = {
        total: resources.total || 0,
        needsMigration: 0,
        upToDate: 0,
        errors: 0
      };

      for (const resource of resources.resources || []) {
        let needsMigration = false;
        
        for (const migration of this.migrations) {
          if (migration.shouldRun(resource)) {
            needsMigration = true;
            break;
          }
        }

        if (needsMigration) {
          status.needsMigration++;
        } else {
          status.upToDate++;
        }
      }

      return status;
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Add a custom migration
   */
  addMigration(migration) {
    if (!(migration instanceof BaseMigration)) {
      throw new Error('Migration must extend BaseMigration');
    }
    this.migrations.push(migration);
  }
}

// Export the migration system
export {
  MigrationManager,
  BaseMigration,
  MigrationResult,
  FHIRR4to401Migration,
  ReferenceIntegrityMigration,
  CodeSystemMigration,
  DataConsistencyMigration
};

export default MigrationManager;