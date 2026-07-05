/**
 * useAdministrationTasks — the Tasks-pane data hook (#116 Phase 5.2).
 *
 * Wraps `GET /api/clinical/administration/tasks`, which returns the patient's
 * non-medication recording tasks (immunization / specimen / procedure orders)
 * bucketed by type and flagged `fulfilled` when a recording resource already
 * links back to the order.
 *
 * Like `useScheduledTasks`, it triggers a quiet refetch on the relevant
 * WebSocket events so a card flips to "done" when a peer records the task —
 * the server is the source of truth for fulfilment, so we refetch rather
 * than mutate local state.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { buildUrl } from '../../../../config/apiConfig';
import api from '../../../../services/api';
import { useClinicalWorkflow } from '../../../../contexts/ClinicalWorkflowContext';
import { CLINICAL_EVENTS } from '../../../../constants/clinicalEvents';

const REFRESH_EVENTS = [
  CLINICAL_EVENTS.IMMUNIZATION_ADMINISTERED,
  CLINICAL_EVENTS.SPECIMEN_COLLECTED,
  CLINICAL_EVENTS.PROCEDURE_PERFORMED,
];

/**
 * @param {object} params
 * @param {string} params.patientId — bare FHIR id, no "Patient/" prefix
 * @returns {{
 *   data: object|null,
 *   loading: boolean,
 *   error: Error|null,
 *   refetch: () => void,
 * }}
 */
export function useAdministrationTasks({ patientId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { subscribe } = useClinicalWorkflow();
  const abortRef = useRef(null);

  const fetchTasks = useCallback(async () => {
    if (!patientId) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(buildUrl('backend', '/api/clinical/administration/tasks'), {
        params: { patient_id: patientId },
        signal: controller.signal,
      });
      setData(res.data);
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return;
      console.error('useAdministrationTasks: fetch failed', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchTasks();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchTasks]);

  // Live updates — refetch when any non-medication recording event lands
  // for this patient.
  useEffect(() => {
    if (!subscribe) return undefined;
    const unsubs = REFRESH_EVENTS.map((evtName) =>
      subscribe(evtName, (evt) => {
        if (!patientId) return;
        const evtPatient = evt?.patient_id || evt?.patientId;
        if (evtPatient && evtPatient !== patientId) return;
        fetchTasks();
      }),
    );
    return () => unsubs.forEach((u) => { if (typeof u === 'function') u(); });
  }, [subscribe, fetchTasks, patientId]);

  return { data, loading, error, refetch: fetchTasks };
}
