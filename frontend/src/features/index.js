// Features - Master Barrel Exports
// Export all feature modules for clean imports

// Feature modules
export * as Allergies from './allergies';
export * as Medications from './medications';
export * as Orders from './orders';
export * as Results from './results';

// Individual component exports for direct access
export { AddAllergyDialog, EditAllergyDialog } from './allergies';
export { EditMedicationDialog, PrescribeMedicationDialog } from './medications';
export { CPOEDialog, OrdersTab } from './orders';
export { ResultsTab } from './results';

// Additional features (to be exported as they're migrated)
// export * as Conditions from './conditions';
// export * as Encounters from './encounters';
// export * as Documentation from './documentation';
// export * as Imaging from './imaging';
// export * as Pharmacy from './pharmacy';
// export * as CDS from './cds';