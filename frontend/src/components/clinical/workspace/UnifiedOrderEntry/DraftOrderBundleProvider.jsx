/**
 * DraftOrderBundleProvider — shared draft state for the Unified Order Entry
 * surface (#116, Phase 4.1).
 *
 * One draft list spans every tab (Lab, Imaging, Procedure). Each tab adds
 * FHIR ServiceRequest resources to the bundle; the right-pane DraftOrderList
 * displays the full set; the Sign All step iterates over them. Pulling the
 * state into a context keeps tabs decoupled — tabs don't talk to each other
 * directly, they just push into / read from this shared store.
 *
 * Why a context (rather than parent state passed via props):
 * - Tabs (`LabOrderTab`, `ImagingOrderTab`, `ProcedureOrderTab`) and the
 *   `DraftOrderList` are siblings under `UnifiedOrderEntry`. Lifting state
 *   to the shell and threading prop-drilling through each tab clutters the
 *   API and forces tab components to know about the bundle shape.
 * - Future tabs (Phase 4.2 med/immunization, Phase 4.3 nursing/diet/order
 *   sets) can drop in without changing the shell signature.
 *
 * The draft Bundle this provider tracks is in the same shape as
 * `buildDraftOrderBundle(drafts)` from utils/cdsDraftBundle: one Bundle with
 * an `entry[]` of resources and per-resource ids. We don't recompute the
 * bundle on every read — instead we expose the raw `drafts` array and let
 * consumers (the unified CDS hook firer, the Sign All handler) call
 * buildDraftOrderBundle when they need the wire format.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { v4 as uuidv4 } from 'uuid';

const DraftOrderBundleContext = createContext(null);

/**
 * @param {object} props
 * @param {string} props.patientId — Bare FHIR id (no `Patient/` prefix).
 *   Used by tabs to build the `subject.reference` field on new drafts.
 * @param {string} [props.encounterId] — Optional encounter context.
 * @param {React.ReactNode} props.children
 */
export const DraftOrderBundleProvider = ({ patientId, encounterId, children }) => {
  // Each entry: { localId, resource } where resource is a FHIR
  // ServiceRequest/MedicationRequest/Immunization with status='draft'.
  // localId is a UUID assigned at add-time so the right-pane can key on it
  // and the Sign All flow can remove items one at a time without colliding
  // with resource.id (which is empty until HAPI assigns one on POST).
  const [drafts, setDrafts] = useState([]);

  // Currently-focused draft id for highlighting in the right pane after a
  // tab adds a new draft. Cleared after a short window or when the user
  // switches tabs / clicks a different draft. Implemented as state so the
  // list can render the highlight; tabs can call `markRecentlyAdded(id)`.
  const [recentlyAddedId, setRecentlyAddedId] = useState(null);

  const addDraft = useCallback((resource) => {
    if (!resource?.resourceType) return null;
    const localId = uuidv4();
    setDrafts((prev) => [...prev, { localId, resource }]);
    setRecentlyAddedId(localId);
    return localId;
  }, []);

  const removeDraft = useCallback((localId) => {
    setDrafts((prev) => prev.filter((d) => d.localId !== localId));
    setRecentlyAddedId((prev) => (prev === localId ? null : prev));
  }, []);

  const clearDrafts = useCallback(() => {
    setDrafts([]);
    setRecentlyAddedId(null);
  }, []);

  const updateDraft = useCallback((localId, updater) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.localId === localId
          ? { localId, resource: typeof updater === 'function' ? updater(d.resource) : updater }
          : d,
      ),
    );
  }, []);

  const value = useMemo(
    () => ({
      patientId,
      encounterId,
      drafts,
      draftCount: drafts.length,
      addDraft,
      removeDraft,
      clearDrafts,
      updateDraft,
      recentlyAddedId,
      setRecentlyAddedId,
    }),
    [patientId, encounterId, drafts, addDraft, removeDraft, clearDrafts, updateDraft, recentlyAddedId],
  );

  return (
    <DraftOrderBundleContext.Provider value={value}>
      {children}
    </DraftOrderBundleContext.Provider>
  );
};

/** Read the draft bundle state. Throws if used outside the provider. */
export const useDraftOrderBundle = () => {
  const ctx = useContext(DraftOrderBundleContext);
  if (!ctx) {
    throw new Error('useDraftOrderBundle must be used within a DraftOrderBundleProvider');
  }
  return ctx;
};
