/**
 * Module SDK — the ONLY sanctioned import surface for module code
 * (module platform Phase 3, docs/MODULES.md).
 *
 * Everything a module may use from the host application is re-exported
 * here, and module directories are lint-forbidden from deep-importing
 * core paths (`no-restricted-imports` override in eslint.config).
 * This boundary is what makes out-of-repo modules possible: their
 * imports resolve against ONE stable surface, and core internals can
 * move freely as long as this file keeps its contract.
 *
 * Third-party packages (react, @mui/material, @mui/icons-material,
 * date-fns, ...) are NOT re-exported — modules import those directly;
 * they are versioned by package.json, not by this file.
 *
 * Additions to this surface are deliberate API decisions: keep them
 * minimal, named, and documented. Removals are breaking changes for
 * every module ever written — treat accordingly.
 */

// --- FHIR data access -------------------------------------------------
// The canonical FHIR client (read/search/create/update/delete + caching,
// dedup, retry). All module FHIR I/O goes through this or the contexts.
export { fhirClient } from '../core/fhir/services/fhirClient';
export { extractBundleResources } from '../core/fhir/utils/bundleUtils';

// --- Patient-data contexts -------------------------------------------
export {
  useFHIRResource,
  usePatient,
  usePatientResources,
} from '../contexts/FHIRResourceContext';

// --- Clinical events (pub/sub + WebSocket bridge) ---------------------
export { useClinicalWorkflow } from '../contexts/ClinicalWorkflowContext';
export { CLINICAL_EVENTS } from '../constants/clinicalEvents';

// --- Auth --------------------------------------------------------------
export { useAuth } from '../contexts/AuthContext';

// --- Backend (non-FHIR) API transport ----------------------------------
// api is the axios instance for /api/* endpoints; buildUrl resolves
// host-agnostic URLs (never hardcode a host — root CLAUDE.md rule).
export { default as api } from '../services/api';
export { buildUrl } from '../config/apiConfig';

// --- Theming ------------------------------------------------------------
// One hue per clinical domain; module accents are registered here too.
export { categoricalAccents } from '../themes/categoricalAccents';
export { getSeverityColor } from '../themes/clinicalThemeUtils';
