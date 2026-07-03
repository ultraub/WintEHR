/**
 * useScheduledTasks — the MAR grid's data hook (#116 Phase 5.1).
 *
 * Wraps the new `GET /api/clinical/administration/scheduled-tasks` endpoint
 * with three responsibilities the grid would otherwise have to handle itself:
 *
 * 1. **Re-fetch on window/patient change.** The grid lets the user re-frame
 *    the time window (shift / today / 4h); each change is a new fetch.
 *
 * 2. **Live updates.** Subscribes to the workspace WebSocket for
 *    `MEDICATION_ADMINISTERED` events on the current patient. When a peer
 *    nurse charts a dose, the grid cell flips without a manual refresh.
 *    The WebSocket payload doesn't carry the full server-computed match,
 *    so we trigger a quiet refetch rather than mutate local state.
 *
 * 3. **Auto-tick.** "Due now" is a function of wall-clock time. Without a
 *    periodic re-render the grid would stay frozen at its initial state.
 *    A 60s interval bumps a counter so cell-state classifiers re-evaluate.
 *
 * The hook deliberately keeps `pending` administrations in a short-lived
 * local map (200ms lifetime, keyed by request id), so the cell that the
 * user just clicked flashes "saving" before the server confirms — avoids
 * the awkward "did my click register?" moment between submit and refetch.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { buildUrl } from '../../../../config/apiConfig';
import api from '../../../../services/api';
import { useClinicalWorkflow } from '../../../../contexts/ClinicalWorkflowContext';
import { CLINICAL_EVENTS } from '../../../../constants/clinicalEvents';

const TICK_INTERVAL_MS = 60_000;

/**
 * @param {object} params
 * @param {string} params.patientId — bare FHIR id, no "Patient/" prefix
 * @param {Date} params.windowStart
 * @param {Date} params.windowEnd
 * @returns {{
 *   data: object|null,
 *   loading: boolean,
 *   error: Error|null,
 *   refetch: () => void,
 *   tick: number,
 *   markPending: (rxId: string) => void,
 *   pendingRequestIds: Set<string>,
 * }}
 */
export function useScheduledTasks({ patientId, windowStart, windowEnd }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const [pendingRequestIds, setPendingRequestIds] = useState(() => new Set());

  const { subscribe } = useClinicalWorkflow();
  const abortRef = useRef(null);

  const fetchTasks = useCallback(async () => {
    if (!patientId || !windowStart || !windowEnd) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(buildUrl('backend', '/api/clinical/administration/scheduled-tasks'), {
        params: {
          patient_id: patientId,
          window_start: windowStart.toISOString(),
          window_end: windowEnd.toISOString(),
        },
        signal: controller.signal,
      });
      setData(res.data);
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return;
      console.error('useScheduledTasks: fetch failed', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [patientId, windowStart, windowEnd]);

  useEffect(() => {
    fetchTasks();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchTasks]);

  // Auto-tick — re-renders cells so the "due now" classification recomputes.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Live updates from peer nurses recording doses.
  useEffect(() => {
    if (!subscribe) return;
    const unsub = subscribe(CLINICAL_EVENTS.MEDICATION_ADMINISTERED, (evt) => {
      // Only refetch if the event is for our patient. The event payload
      // includes patient_id when sourced from the admin router.
      if (!evt || !patientId) return;
      const evtPatient = evt.patient_id || evt.patientId;
      if (evtPatient && evtPatient !== patientId) return;
      fetchTasks();
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [subscribe, fetchTasks, patientId]);

  // Optimistic "saving" indicator the cell can flash for 200ms while the
  // server round-trips. The cleanup auto-clears so stale pending ids don't
  // leak across unrelated saves.
  const markPending = useCallback((rxId) => {
    setPendingRequestIds((prev) => new Set(prev).add(rxId));
    setTimeout(() => {
      setPendingRequestIds((prev) => {
        const next = new Set(prev);
        next.delete(rxId);
        return next;
      });
    }, 200);
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchTasks,
    tick,
    markPending,
    pendingRequestIds,
  };
}
