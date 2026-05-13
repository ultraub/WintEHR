/**
 * CDSHooksContext — single source of truth for CDS Hooks 2.0 state.
 *
 * Before this context existed, two parallel state stores existed:
 *
 *   - `CDSContext.js` (now deleted) owned an `alerts` map keyed by hookType
 *     and an `executeCDSHooks(hookType, context)` method, with its own
 *     service discovery, displayBehavior decoration, and dedup logic.
 *   - `hooks/cds/useCDSHooks.js` (kept) owned a flat `cards` array per
 *     instance, with `executeHook(hookType, context)`. PR #117 wired
 *     dialog-scoped order-select firings through this hook.
 *
 * The duplication meant cards produced by one path were invisible to the
 * other, displayBehavior decoration only happened on the legacy path, and
 * `MedicationDialogEnhanced` had to pull from both contexts in parallel.
 *
 * The unified design lifts ONE `useCDSHooks` instance at the top of the
 * tree and exposes it via this context. Cards are stored by hookType so
 * global readers (header badge, alert pills, patient summary) and
 * dialog-scoped firings share the same store. displayBehavior decoration
 * happens once, in this provider, applied to every card before it reaches
 * a consumer.
 *
 * Dialog-scoped one-off firings (e.g. `useOrderSelectHook` from PR #117)
 * still work — they construct their own `useCDSHooks` instance and the
 * cards stay local to the dialog. Use those when the cards should NOT
 * appear in the global header/sidebar.
 */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import { cdsHooksClient } from '../services/cdsHooksClient';
import { cdsHooksService } from '../services/cdsHooksService';
import { cdsLogger } from '../config/logging';
import { PRESENTATION_MODES } from '../components/clinical/cds/CDSPresentation';
import { useAuth } from './AuthContext';

const CDSHooksContext = createContext(null);

// CDS Hooks 2.0 hook types used across the app. Kept here so consumers
// don't have to import a separate constants file. Patient-view is the
// only one fired automatically by this provider; the rest are fired by
// callers via fireHook() or by dialog-scoped useCDSHooks instances.
export const CDS_HOOK_TYPES = {
  PATIENT_VIEW: 'patient-view',
  MEDICATION_PRESCRIBE: 'medication-prescribe',
  ORDER_SIGN: 'order-sign',
  ORDER_SELECT: 'order-select',
  ENCOUNTER_START: 'encounter-start',
  ENCOUNTER_DISCHARGE: 'encounter-discharge',
};

// Map displayBehavior.defaultMode strings → CDSPresentation constants.
// Sourced from the old CDSContext; the wizard exposes 'card', 'compact',
// and 'drawer' on top of the original spec-aligned set.
const MODE_MAPPING = {
  'hard-stop': PRESENTATION_MODES.MODAL,
  'modal': PRESENTATION_MODES.MODAL,
  'popup': PRESENTATION_MODES.POPUP,
  'sidebar': PRESENTATION_MODES.SIDEBAR,
  'inline': PRESENTATION_MODES.INLINE,
  'banner': PRESENTATION_MODES.BANNER,
  'toast': PRESENTATION_MODES.TOAST,
  'card': PRESENTATION_MODES.CARD,
  'compact': PRESENTATION_MODES.COMPACT,
  'drawer': PRESENTATION_MODES.DRAWER,
};

// Decorate a raw card with displayBehavior metadata derived from its
// service's configuration. Pure transform — no I/O. Mirrors the
// enhanceCard logic that used to live in CDSContext.executeCDSHooks.
function decorateCard(card, service, hookType, hookConfigurations) {
  let presentationMode = PRESENTATION_MODES.POPUP;
  let acknowledgmentRequired = false;
  let reasonRequired = false;
  let snoozeEnabled = false;

  const hookConfig = service?.id ? hookConfigurations[service.id] : null;
  const displayBehavior = hookConfig?.displayBehavior;

  if (displayBehavior) {
    const cardIndicator = card.indicator || 'info';
    const indicatorOverride = displayBehavior.indicatorOverrides?.[cardIndicator];
    const configuredMode = indicatorOverride || displayBehavior.defaultMode || 'popup';
    presentationMode = MODE_MAPPING[configuredMode] || PRESENTATION_MODES.POPUP;
    acknowledgmentRequired = displayBehavior.acknowledgment?.required || false;
    reasonRequired = displayBehavior.acknowledgment?.reasonRequired || false;
    snoozeEnabled = displayBehavior.snooze?.enabled || false;
  }

  return {
    ...card,
    uuid: card.uuid || uuidv4(),
    serviceId: service?.id,
    serviceName: service?.title || service?.id,
    hookType,
    timestamp: new Date(),
    displayBehavior: {
      presentationMode,
      acknowledgmentRequired,
      reasonRequired,
      snoozeEnabled,
    },
  };
}

export const CDSHooksProvider = ({ children }) => {
  const { user } = useAuth();

  // The single shared store — cards keyed by hookType so global and
  // dialog-driven firings can coexist. The previous design used a flat
  // `cards` array which would overwrite cross-hook state.
  const [cardsByHookType, setCardsByHookType] = useState({});
  const [loadingByHookType, setLoadingByHookType] = useState({});
  const [error, setError] = useState(null);

  // Discovery & configuration are loaded once. Discovery returns the
  // CDS Hooks 2.0 spec /cds-services payload. Configurations come from
  // the WintEHR-specific management endpoint and carry displayBehavior.
  const [services, setServices] = useState([]);
  const [servicesLoaded, setServicesLoaded] = useState(false);
  const [hookConfigurations, setHookConfigurations] = useState({});

  // Mount-once init guards
  const initStartedRef = useRef(false);

  // Dedup: same hookType + JSON-stringified context within 5s is a no-op.
  // Lifted from CDSContext — prevents thundering-herd from chart-open
  // useEffects in multiple components.
  const lastExecutionTimeRef = useRef({});
  const executingHooksRef = useRef(new Set());

  // Discover services & load configurations once on mount.
  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    const loadServices = async () => {
      try {
        const discovered = await cdsHooksClient.discoverServices();
        setServices(discovered);
        setServicesLoaded(true);
        cdsLogger.info(`CDSHooksContext: discovered ${discovered.length} services`);
      } catch (err) {
        cdsLogger.error('CDSHooksContext: service discovery failed', err);
        setError(err?.message || 'Service discovery failed');
      }
    };

    const loadConfigurations = async () => {
      try {
        const response = await cdsHooksService.listCustomServices();
        const hooks = response.data || response;
        if (!Array.isArray(hooks)) {
          cdsLogger.error('CDSHooksContext: configurations payload is not an array', hooks);
          return;
        }
        const configMap = {};
        hooks.forEach((hook) => {
          configMap[hook.id] = hook;
        });
        setHookConfigurations(configMap);
        cdsLogger.debug(`CDSHooksContext: loaded ${hooks.length} hook configurations`);
      } catch (err) {
        cdsLogger.error('CDSHooksContext: failed to load configurations', err);
      }
    };

    loadServices();
    loadConfigurations();
  }, []);

  // Fire a CDS hook. Filters discovered services by hook type, dispatches
  // them in parallel, decorates resulting cards with displayBehavior, and
  // stores them in cardsByHookType[hookType]. Replaces any prior cards
  // for the same hookType — re-fires are common (patient change, redraw).
  const fireHook = useCallback(async (hookType, context) => {
    if (!hookType) return;

    const executionKey = `${hookType}-${JSON.stringify(context || {})}`;
    const now = Date.now();
    const lastTime = lastExecutionTimeRef.current[executionKey] || 0;
    if (now - lastTime < 5000) {
      cdsLogger.debug(`CDSHooksContext: skipping duplicate fire of ${hookType}`);
      return;
    }
    if (executingHooksRef.current.has(executionKey)) {
      cdsLogger.debug(`CDSHooksContext: ${hookType} already executing`);
      return;
    }
    if (!servicesLoaded || services.length === 0) {
      cdsLogger.debug(`CDSHooksContext: deferring ${hookType} until services load`);
      return;
    }

    executingHooksRef.current.add(executionKey);
    lastExecutionTimeRef.current[executionKey] = now;
    setLoadingByHookType((prev) => ({ ...prev, [hookType]: true }));
    setError(null);

    try {
      const matching = services.filter((s) => s.hook === hookType);
      if (matching.length === 0) {
        cdsLogger.debug(`CDSHooksContext: no services registered for ${hookType}`);
        setCardsByHookType((prev) => ({ ...prev, [hookType]: [] }));
        return;
      }

      // Parallel dispatch — preserves PR #113's perf fix (was serialized
      // for...of + await, now Promise.allSettled). Per-service failures
      // don't fail the batch.
      const settled = await Promise.allSettled(
        matching.map(async (service) => {
          const request = {
            hook: hookType,
            hookInstance: uuidv4(),
            context,
          };
          const response = await cdsHooksClient.callService(service.id, request);
          return { service, response };
        })
      );

      const allCards = [];
      settled.forEach((outcome, idx) => {
        if (outcome.status === 'fulfilled') {
          const { service, response } = outcome.value;
          if (Array.isArray(response?.cards)) {
            response.cards.forEach((card) => {
              allCards.push(decorateCard(card, service, hookType, hookConfigurations));
            });
          }
        } else {
          const failedId = matching[idx]?.id ?? '<unknown>';
          cdsLogger.warn(`CDSHooksContext: service ${failedId} failed`, outcome.reason);
        }
      });

      setCardsByHookType((prev) => ({ ...prev, [hookType]: allCards }));
      cdsLogger.info(`CDSHooksContext: received ${allCards.length} cards for ${hookType}`);
    } catch (err) {
      cdsLogger.error(`CDSHooksContext: ${hookType} fire failed`, err);
      setError(err?.message || `Failed to fire ${hookType}`);
    } finally {
      executingHooksRef.current.delete(executionKey);
      setLoadingByHookType((prev) => ({ ...prev, [hookType]: false }));
    }
  }, [services, servicesLoaded, hookConfigurations]);

  // Per-hook read accessor. Memoized via the underlying state — callers
  // can put `getCards('patient-view')` directly in render without
  // generating new arrays each frame.
  const getCards = useCallback(
    (hookType) => cardsByHookType[hookType] || [],
    [cardsByHookType]
  );

  const clearCards = useCallback((hookType) => {
    setCardsByHookType((prev) => ({ ...prev, [hookType]: [] }));
  }, []);

  // For convenience: callers fire patient-view by passing the patient id.
  // userId is pulled from auth context here so callers don't have to.
  const firePatientView = useCallback(
    (patientId) => {
      if (!patientId) return;
      return fireHook(CDS_HOOK_TYPES.PATIENT_VIEW, {
        patientId,
        userId: user?.id || user?.username || 'unknown',
      });
    },
    [fireHook, user]
  );

  const value = useMemo(
    () => ({
      // Discovery state
      services,
      servicesLoaded,
      hookConfigurations,

      // Cards
      cardsByHookType,
      getCards,
      clearCards,

      // Firing
      fireHook,
      firePatientView,

      // Telemetry
      loading: loadingByHookType,
      error,
    }),
    [
      services,
      servicesLoaded,
      hookConfigurations,
      cardsByHookType,
      getCards,
      clearCards,
      fireHook,
      firePatientView,
      loadingByHookType,
      error,
    ]
  );

  return <CDSHooksContext.Provider value={value}>{children}</CDSHooksContext.Provider>;
};

/**
 * Read the CDS context. Throws if used outside a `<CDSHooksProvider>`.
 */
export const useCDS = () => {
  const ctx = useContext(CDSHooksContext);
  if (!ctx) {
    throw new Error('useCDS must be used within a CDSHooksProvider');
  }
  return ctx;
};

/**
 * Convenience hook: fire patient-view on patient change and read the
 * resulting cards. Designed for clinical workspace + dashboard consumers
 * that need a one-call "give me alerts for this patient" interface.
 *
 * Dedup is handled by the provider — calling this hook from multiple
 * components with the same patientId results in a single underlying fire.
 */
export const usePatientCDSAlerts = (patientId) => {
  const { firePatientView, getCards, loading, servicesLoaded } = useCDS();
  const prevPatientIdRef = useRef(null);

  useEffect(() => {
    if (!patientId || !servicesLoaded) return;
    if (patientId === prevPatientIdRef.current) return;
    prevPatientIdRef.current = patientId;
    firePatientView(patientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, servicesLoaded]);

  const alerts = getCards(CDS_HOOK_TYPES.PATIENT_VIEW);

  return {
    alerts,
    loading: loading[CDS_HOOK_TYPES.PATIENT_VIEW] || false,
  };
};
