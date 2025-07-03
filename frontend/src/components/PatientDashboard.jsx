/**
 * Patient Dashboard Component
 * 
 * Demonstrates FHIR-endpoint-agnostic design:
 * - Works with any FHIR R4 server
 * - Uses EMR extensions when available
 * - Gracefully degrades functionality
 */

import React, { useState, useEffect } from 'react';
import { 
  useFHIR, 
  usePatient, 
  useFHIRSearch, 
  useClinicalCanvas,
  useEMR 
} from '../hooks/useFHIR';
import { fhirClient } from '../services/fhirClient';

function PatientDashboard({ patientId }) {
  const [activeView, setActiveView] = useState('summary');
  const [canvasPrompt, setCanvasPrompt] = useState('');
  const [generatedUI, setGeneratedUI] = useState(null);

  // Core FHIR data - works with any FHIR server
  const patient = usePatient(patientId);
  const vitals = useFHIRSearch('Observation', {
    patient: patientId,
    category: 'vital-signs',
    _sort: '-date',
    _count: 10
  });
  const conditions = useFHIRSearch('Condition', {
    patient: patientId,
    'clinical-status': 'active'
  });
  const medications = useFHIRSearch('MedicationRequest', {
    patient: patientId,
    status: 'active'
  });
  const allergies = useFHIRSearch('AllergyIntolerance', {
    patient: patientId
  });

  // EMR features - optional enhancements
  const emr = useEMR();
  const canvas = useClinicalCanvas();

  // Load UI state when component mounts
  useEffect(() => {
    async function loadUIState() {
      const state = await emr.getUIState('patient-dashboard');
      if (state.state.activeView) {
        setActiveView(state.state.activeView);
      }
    }
    loadUIState();
  }, [emr]);

  // Save UI state when view changes
  useEffect(() => {
    emr.saveUIState('patient-dashboard', { activeView });
  }, [activeView, emr]);

  // Generate UI with Clinical Canvas
  const handleGenerateUI = async () => {
    if (!canvasPrompt) return;

    try {
      const ui = await canvas.generate(canvasPrompt, {
        patientId,
        userId: emr.user?.id
      });
      setGeneratedUI(ui);
    } catch (error) {
      console.error('Failed to generate UI:', error);
    }
  };

  // Loading state
  if (patient.loading) {
    return <div className="loading">Loading patient data...</div>;
  }

  // Error state
  if (patient.error) {
    return <div className="error">Error loading patient: {patient.error.message}</div>;
  }

  const patientData = patient.data;

  return (
    <div className="patient-dashboard">
      {/* Patient Header - Always shown */}
      <PatientHeader patient={patientData} />

      {/* Allergy Alerts - Critical information */}
      {allergies.data && allergies.data.length > 0 && (
        <AllergyAlerts allergies={allergies.data} />
      )}

      {/* View Tabs */}
      <div className="view-tabs">
        <button 
          className={activeView === 'summary' ? 'active' : ''}
          onClick={() => setActiveView('summary')}
        >
          Summary
        </button>
        <button 
          className={activeView === 'vitals' ? 'active' : ''}
          onClick={() => setActiveView('vitals')}
        >
          Vitals
        </button>
        <button 
          className={activeView === 'medications' ? 'active' : ''}
          onClick={() => setActiveView('medications')}
        >
          Medications
        </button>
        <button 
          className={activeView === 'conditions' ? 'active' : ''}
          onClick={() => setActiveView('conditions')}
        >
          Conditions
        </button>
        {emr.isAvailable && (
          <button 
            className={activeView === 'canvas' ? 'active' : ''}
            onClick={() => setActiveView('canvas')}
          >
            Clinical Canvas
          </button>
        )}
      </div>

      {/* Content based on active view */}
      <div className="view-content">
        {activeView === 'summary' && (
          <PatientSummary 
            patient={patientData}
            vitals={vitals.data}
            conditions={conditions.data}
            medications={medications.data}
          />
        )}

        {activeView === 'vitals' && (
          <VitalsView 
            vitals={vitals.data}
            loading={vitals.loading}
            onRefresh={vitals.refresh}
          />
        )}

        {activeView === 'medications' && (
          <MedicationsView 
            medications={medications.data}
            loading={medications.loading}
            onRefresh={medications.refresh}
            canEdit={emr.isAvailable}
          />
        )}

        {activeView === 'conditions' && (
          <ConditionsView 
            conditions={conditions.data}
            loading={conditions.loading}
            onRefresh={conditions.refresh}
          />
        )}

        {activeView === 'canvas' && emr.isAvailable && (
          <div className="clinical-canvas">
            <h2>Clinical Canvas - AI-Powered UI Generation</h2>
            <div className="canvas-input">
              <input
                type="text"
                value={canvasPrompt}
                onChange={(e) => setCanvasPrompt(e.target.value)}
                placeholder="Describe the UI you want (e.g., 'Show vitals with trending for the last week')"
              />
              <button 
                onClick={handleGenerateUI}
                disabled={canvas.loading}
              >
                Generate
              </button>
            </div>
            
            {canvas.loading && <div>Generating UI...</div>}
            
            {generatedUI && (
              <div className="generated-ui">
                <h3>Generated UI Specification</h3>
                <pre>{JSON.stringify(generatedUI, null, 2)}</pre>
                {/* In real app, this would render the actual UI components */}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-components
function PatientHeader({ patient }) {
  const name = patient.name?.[0];
  const displayName = name ? `${name.given?.join(' ')} ${name.family}` : 'Unknown';
  const mrn = patient.identifier?.find(id => id.type?.text === 'MRN')?.value;

  return (
    <div className="patient-header">
      <h1>{displayName}</h1>
      <div className="demographics">
        <span>MRN: {mrn || 'Unknown'}</span>
        <span>DOB: {patient.birthDate}</span>
        <span>Gender: {patient.gender}</span>
      </div>
    </div>
  );
}

function AllergyAlerts({ allergies }) {
  const activeAllergies = allergies.filter(
    a => a.clinicalStatus?.coding?.[0]?.code === 'active'
  );

  if (activeAllergies.length === 0) return null;

  return (
    <div className="allergy-alerts">
      <strong>⚠️ Allergies:</strong>
      {activeAllergies.map((allergy, idx) => (
        <span key={idx} className="allergy">
          {allergy.code?.text || allergy.code?.coding?.[0]?.display || 'Unknown'}
        </span>
      ))}
    </div>
  );
}

function PatientSummary({ patient, vitals, conditions, medications }) {
  return (
    <div className="patient-summary">
      <div className="summary-grid">
        <div className="summary-card">
          <h3>Recent Vitals</h3>
          {vitals && vitals.length > 0 ? (
            <VitalsSummary vitals={vitals.slice(0, 5)} />
          ) : (
            <p>No vital signs recorded</p>
          )}
        </div>

        <div className="summary-card">
          <h3>Active Conditions</h3>
          {conditions && conditions.length > 0 ? (
            <ul>
              {conditions.map((condition, idx) => (
                <li key={idx}>
                  {condition.code?.text || condition.code?.coding?.[0]?.display}
                </li>
              ))}
            </ul>
          ) : (
            <p>No active conditions</p>
          )}
        </div>

        <div className="summary-card">
          <h3>Current Medications</h3>
          {medications && medications.length > 0 ? (
            <ul>
              {medications.map((med, idx) => (
                <li key={idx}>
                  {med.medicationCodeableConcept?.text || 
                   med.medicationCodeableConcept?.coding?.[0]?.display}
                </li>
              ))}
            </ul>
          ) : (
            <p>No active medications</p>
          )}
        </div>
      </div>
    </div>
  );
}

function VitalsSummary({ vitals }) {
  // Group vitals by type
  const vitalsByCode = {};
  vitals.forEach(obs => {
    const code = obs.code?.coding?.[0]?.code;
    if (!vitalsByCode[code]) {
      vitalsByCode[code] = {
        display: obs.code?.coding?.[0]?.display || code,
        latest: obs
      };
    }
  });

  return (
    <div className="vitals-summary">
      {Object.values(vitalsByCode).map((vital, idx) => (
        <div key={idx} className="vital-item">
          <span className="vital-name">{vital.display}:</span>
          <span className="vital-value">
            {vital.latest.valueQuantity?.value} {vital.latest.valueQuantity?.unit}
          </span>
        </div>
      ))}
    </div>
  );
}

function VitalsView({ vitals, loading, onRefresh }) {
  if (loading) return <div>Loading vitals...</div>;
  if (!vitals || vitals.length === 0) return <div>No vital signs recorded</div>;

  return (
    <div className="vitals-view">
      <div className="view-header">
        <h2>Vital Signs</h2>
        <button onClick={onRefresh}>Refresh</button>
      </div>
      
      <table className="vitals-table">
        <thead>
          <tr>
            <th>Date/Time</th>
            <th>Type</th>
            <th>Value</th>
            <th>Unit</th>
          </tr>
        </thead>
        <tbody>
          {vitals.map((vital, idx) => (
            <tr key={idx}>
              <td>{new Date(vital.effectiveDateTime).toLocaleString()}</td>
              <td>{vital.code?.coding?.[0]?.display}</td>
              <td>{vital.valueQuantity?.value}</td>
              <td>{vital.valueQuantity?.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MedicationsView({ medications, loading, onRefresh, canEdit }) {
  if (loading) return <div>Loading medications...</div>;
  if (!medications || medications.length === 0) return <div>No active medications</div>;

  return (
    <div className="medications-view">
      <div className="view-header">
        <h2>Medications</h2>
        <button onClick={onRefresh}>Refresh</button>
      </div>

      <div className="medications-list">
        {medications.map((med, idx) => (
          <div key={idx} className="medication-item">
            <h4>
              {med.medicationCodeableConcept?.text || 
               med.medicationCodeableConcept?.coding?.[0]?.display}
            </h4>
            <p className="dosage">
              {med.dosageInstruction?.[0]?.text || 'No dosage information'}
            </p>
            <p className="dates">
              Ordered: {new Date(med.authoredOn).toLocaleDateString()}
            </p>
            {canEdit && (
              <div className="actions">
                <button>Discontinue</button>
                <button>Renew</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ConditionsView({ conditions, loading, onRefresh }) {
  if (loading) return <div>Loading conditions...</div>;
  if (!conditions || conditions.length === 0) return <div>No active conditions</div>;

  return (
    <div className="conditions-view">
      <div className="view-header">
        <h2>Conditions</h2>
        <button onClick={onRefresh}>Refresh</button>
      </div>

      <div className="conditions-list">
        {conditions.map((condition, idx) => (
          <div key={idx} className="condition-item">
            <h4>
              {condition.code?.text || condition.code?.coding?.[0]?.display}
            </h4>
            <p className="status">
              Status: {condition.clinicalStatus?.coding?.[0]?.display}
            </p>
            {condition.onsetDateTime && (
              <p className="onset">
                Onset: {new Date(condition.onsetDateTime).toLocaleDateString()}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default PatientDashboard;