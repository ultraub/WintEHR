/**
 * FHIR Client Service - JavaScript Compatibility Layer
 * 
 * This file provides backward compatibility for imports that expect a .js extension.
 * The actual implementation is in the TypeScript file.
 * 
 * @deprecated Use TypeScript imports directly when possible
 */

// Import the TypeScript class
import FHIRClient from './fhirClient.ts';

// Create and export singleton instance
export const fhirClient = new FHIRClient();

// Export the class as default for those who need it
export default FHIRClient;