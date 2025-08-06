/**
 * useExportData Hook
 * Manages data export functionality for clinical workspace
 */

import { useCallback, useState } from 'react';
import { exportClinicalData } from '../../core/export/exportUtils';

const useExportData = () => {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  // Generic export function
  const exportData = useCallback(async (data, options) => {
    setExporting(true);
    setExportError(null);

    try {
      await exportClinicalData({
        data,
        ...options
      });
    } catch (error) {
      setExportError(error.message || 'Export failed');
      throw error;
    } finally {
      setExporting(false);
    }
  }, []);

  // Export to CSV
  const exportToCSV = useCallback(async (data, filename, columns) => {
    return exportData(data, {
      format: 'csv',
      filename,
      columns
    });
  }, [exportData]);

  // Export to JSON
  const exportToJSON = useCallback(async (data, filename, prettyPrint = true) => {
    return exportData(data, {
      format: 'json',
      filename,
      prettyPrint
    });
  }, [exportData]);

  // Export to PDF
  const exportToPDF = useCallback(async (data, filename, title, columns, formatForPrint) => {
    return exportData(data, {
      format: 'pdf',
      filename,
      title,
      columns,
      formatForPrint
    });
  }, [exportData]);

  // Create export handlers for common clinical data types
  const createExportHandlers = useCallback((dataType, getData) => {
    const handlers = {
      problems: {
        csv: (format) => exportToCSV(
          getData(),
          `${dataType}_${new Date().toISOString().split('T')[0]}`,
          [
            { key: 'code.text', label: 'Problem' },
            { key: 'clinicalStatus.coding[0].code', label: 'Status' },
            { key: 'severity.coding[0].display', label: 'Severity' },
            { key: 'onsetDateTime', label: 'Onset Date', format: 'date' },
            { key: 'recorder.display', label: 'Recorded By' }
          ]
        ),
        json: (format) => exportToJSON(
          getData(),
          `${dataType}_${new Date().toISOString().split('T')[0]}`
        ),
        pdf: (format) => exportToPDF(
          getData(),
          `${dataType}_${new Date().toISOString().split('T')[0]}`,
          'Problem List',
          [
            { key: 'code.text', label: 'Problem' },
            { key: 'clinicalStatus.coding[0].code', label: 'Status' },
            { key: 'severity.coding[0].display', label: 'Severity' },
            { key: 'onsetDateTime', label: 'Onset Date', format: 'date' }
          ],
          (data) => {
            let html = '<h2>Problem List</h2>';
            data.forEach(condition => {
              html += `
                <div style="margin-bottom: 10px;">
                  <strong>${condition.code?.text || 'Unknown'}</strong><br/>
                  Status: ${condition.clinicalStatus?.coding?.[0]?.code || 'Unknown'}<br/>
                  Severity: ${condition.severity?.coding?.[0]?.display || 'Not specified'}<br/>
                  Onset: ${condition.onsetDateTime ? new Date(condition.onsetDateTime).toLocaleDateString() : 'Unknown'}
                </div>
              `;
            });
            return html;
          }
        )
      },
      
      medications: {
        csv: (format) => exportToCSV(
          getData(),
          `medications_${new Date().toISOString().split('T')[0]}`,
          [
            { key: 'medicationCodeableConcept.text', label: 'Medication' },
            { key: 'status', label: 'Status' },
            { key: 'dosageInstruction[0].text', label: 'Dosage' },
            { key: 'authoredOn', label: 'Prescribed Date', format: 'date' },
            { key: 'requester.display', label: 'Prescriber' }
          ]
        ),
        json: (format) => exportToJSON(
          getData(),
          `medications_${new Date().toISOString().split('T')[0]}`
        ),
        pdf: (format) => exportToPDF(
          getData(),
          `medications_${new Date().toISOString().split('T')[0]}`,
          'Medication List',
          [
            { key: 'medicationCodeableConcept.text', label: 'Medication' },
            { key: 'status', label: 'Status' },
            { key: 'dosageInstruction[0].text', label: 'Dosage' },
            { key: 'authoredOn', label: 'Prescribed Date', format: 'date' }
          ],
          (data) => {
            let html = '<h2>Medication List</h2>';
            data.forEach(med => {
              html += `
                <div style="margin-bottom: 10px;">
                  <strong>${med.medicationCodeableConcept?.text || 'Unknown'}</strong><br/>
                  Status: ${med.status}<br/>
                  Dosage: ${med.dosageInstruction?.[0]?.text || 'Not specified'}<br/>
                  Prescribed: ${med.authoredOn ? new Date(med.authoredOn).toLocaleDateString() : 'Unknown'}
                </div>
              `;
            });
            return html;
          }
        )
      },
      
      allergies: {
        csv: (format) => exportToCSV(
          getData(),
          `allergies_${new Date().toISOString().split('T')[0]}`,
          [
            { key: 'code.text', label: 'Allergen' },
            { key: 'clinicalStatus.coding[0].code', label: 'Status' },
            { key: 'criticality', label: 'Criticality' },
            { key: 'reaction[0].manifestation[0].text', label: 'Reaction' },
            { key: 'recordedDate', label: 'Recorded Date', format: 'date' }
          ]
        ),
        json: (format) => exportToJSON(
          getData(),
          `allergies_${new Date().toISOString().split('T')[0]}`
        ),
        pdf: (format) => exportToPDF(
          getData(),
          `allergies_${new Date().toISOString().split('T')[0]}`,
          'Allergy List',
          [
            { key: 'code.text', label: 'Allergen' },
            { key: 'clinicalStatus.coding[0].code', label: 'Status' },
            { key: 'criticality', label: 'Criticality' },
            { key: 'reaction[0].manifestation[0].text', label: 'Reaction' }
          ],
          (data) => {
            let html = '<h2>Allergy List</h2>';
            data.forEach(allergy => {
              html += `
                <div style="margin-bottom: 10px;">
                  <strong>${allergy.code?.text || 'Unknown'}</strong><br/>
                  Status: ${allergy.clinicalStatus?.coding?.[0]?.code || 'Unknown'}<br/>
                  Criticality: ${allergy.criticality || 'Not specified'}<br/>
                  Reaction: ${allergy.reaction?.[0]?.manifestation?.[0]?.text || 'Not specified'}
                </div>
              `;
            });
            return html;
          }
        )
      },
      
      labs: {
        csv: (format) => exportToCSV(
          getData(),
          `lab_results_${new Date().toISOString().split('T')[0]}`,
          [
            { key: 'code.text', label: 'Test Name' },
            { key: 'valueQuantity.value', label: 'Value' },
            { key: 'valueQuantity.unit', label: 'Unit' },
            { key: 'referenceRange[0].text', label: 'Reference Range' },
            { key: 'status', label: 'Status' },
            { key: 'effectiveDateTime', label: 'Date', format: 'date' }
          ]
        ),
        json: (format) => exportToJSON(
          getData(),
          `lab_results_${new Date().toISOString().split('T')[0]}`
        ),
        pdf: (format) => exportToPDF(
          getData(),
          `lab_results_${new Date().toISOString().split('T')[0]}`,
          'Lab Results',
          [
            { key: 'code.text', label: 'Test Name' },
            { key: 'valueQuantity.value', label: 'Value' },
            { key: 'valueQuantity.unit', label: 'Unit' },
            { key: 'referenceRange[0].text', label: 'Reference Range' },
            { key: 'status', label: 'Status' }
          ],
          (data) => {
            let html = '<h2>Lab Results</h2>';
            data.forEach(lab => {
              html += `
                <div style="margin-bottom: 10px;">
                  <strong>${lab.code?.text || 'Unknown'}</strong><br/>
                  Value: ${lab.valueQuantity?.value || ''} ${lab.valueQuantity?.unit || ''}<br/>
                  Reference: ${lab.referenceRange?.[0]?.text || 'Not specified'}<br/>
                  Status: ${lab.status}<br/>
                  Date: ${lab.effectiveDateTime ? new Date(lab.effectiveDateTime).toLocaleDateString() : 'Unknown'}
                </div>
              `;
            });
            return html;
          }
        )
      }
    };

    return handlers[dataType] || handlers.problems;
  }, [exportToCSV, exportToJSON, exportToPDF]);

  return {
    // States
    exporting,
    exportError,
    
    // Generic export
    exportData,
    
    // Format-specific exports
    exportToCSV,
    exportToJSON,
    exportToPDF,
    
    // Handler creator
    createExportHandlers
  };
};

export default useExportData;