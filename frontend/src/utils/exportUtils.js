/**
 * Export utilities for clinical data
 * Supports CSV, JSON, and PDF export formats
 */

import { format, parseISO } from 'date-fns';
import { createPrintDocument, printDocument } from './printUtils';

/**
 * Convert data to CSV format
 * @param {Array} data - Array of objects to convert
 * @param {Array} columns - Column configuration [{key: 'field', label: 'Header'}]
 * @returns {string} CSV string
 */
export const generateCSV = (data, columns) => {
  if (!data || data.length === 0) return '';
  
  // Create header row
  const headers = columns.map(col => `"${col.label}"`).join(',');
  
  // Create data rows
  const rows = data.map(item => {
    return columns.map(col => {
      const value = getNestedValue(item, col.key);
      // Escape quotes and wrap in quotes
      const escaped = String(value || '').replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',');
  });
  
  return [headers, ...rows].join('\n');
};

/**
 * Get nested object value by dot notation path
 * @param {Object} obj - Object to get value from
 * @param {string} path - Dot notation path (e.g., 'code.text')
 * @returns {*} Value at path
 */
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => {
    return current?.[key];
  }, obj);
};

/**
 * Download data as CSV file
 * @param {Array} data - Data to export
 * @param {Array} columns - Column configuration
 * @param {string} filename - Filename without extension
 */
export const downloadCSV = (data, columns, filename) => {
  const csv = generateCSV(data, columns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
};

/**
 * Download data as JSON file
 * @param {*} data - Data to export
 * @param {string} filename - Filename without extension
 */
export const downloadJSON = (data, filename) => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  downloadBlob(blob, `${filename}.json`);
};

/**
 * Download blob as file
 * @param {Blob} blob - Blob to download
 * @param {string} filename - Filename with extension
 */
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export clinical data with patient header
 * @param {Object} options - Export options
 * @param {Object} options.patient - Patient information
 * @param {Array} options.data - Data to export
 * @param {Array} options.columns - Column configuration for CSV
 * @param {string} options.format - Export format ('csv', 'json', 'pdf')
 * @param {string} options.title - Export title
 * @param {Function} options.formatForPrint - Function to format data for PDF
 */
export const exportClinicalData = ({
  patient,
  data,
  columns,
  format,
  title,
  formatForPrint
}) => {
  const timestamp = format(new Date(), 'yyyy-MM-dd_HHmm');
  const filename = `${title.replace(/\s+/g, '_')}_${patient?.name?.[0]?.family || 'Patient'}_${timestamp}`;
  
  switch (format) {
    case 'csv':
      downloadCSV(data, columns, filename);
      break;
      
    case 'json':
      const exportData = {
        exportDate: new Date().toISOString(),
        title,
        patient: {
          id: patient?.id,
          name: patient?.name,
          birthDate: patient?.birthDate,
          gender: patient?.gender,
          mrn: patient?.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value
        },
        data
      };
      downloadJSON(exportData, filename);
      break;
      
    case 'pdf':
      const patientInfo = {
        name: patient ? 
          `${patient.name?.[0]?.given?.join(' ') || ''} ${patient.name?.[0]?.family || ''}`.trim() : 
          'Unknown Patient',
        mrn: patient?.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || patient?.id,
        birthDate: patient?.birthDate,
        gender: patient?.gender,
        phone: patient?.telecom?.find(t => t.system === 'phone')?.value
      };
      
      const content = formatForPrint ? formatForPrint(data) : generateTableHTML(data, columns);
      
      printDocument({
        title,
        patient: patientInfo,
        content
      });
      break;
      
    default:
      console.error('Unsupported export format:', format);
  }
};

/**
 * Generate HTML table from data
 * @param {Array} data - Data array
 * @param {Array} columns - Column configuration
 * @returns {string} HTML table string
 */
const generateTableHTML = (data, columns) => {
  if (!data || data.length === 0) {
    return '<p>No data available</p>';
  }
  
  const headers = columns.map(col => `<th>${col.label}</th>`).join('');
  const rows = data.map(item => {
    const cells = columns.map(col => {
      const value = getNestedValue(item, col.key);
      return `<td>${value || ''}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  
  return `
    <table>
      <thead>
        <tr>${headers}</tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
};

// Column configurations for common clinical data types
export const EXPORT_COLUMNS = {
  conditions: [
    { key: 'code.text', label: 'Condition' },
    { key: 'clinicalStatus.coding.0.code', label: 'Status' },
    { key: 'severity.text', label: 'Severity' },
    { key: 'onsetDateTime', label: 'Onset Date' },
    { key: 'recordedDate', label: 'Recorded Date' }
  ],
  
  medications: [
    { key: 'medicationCodeableConcept.text', label: 'Medication' },
    { key: 'status', label: 'Status' },
    { key: 'dosageInstruction.0.text', label: 'Dosage' },
    { key: 'authoredOn', label: 'Prescribed Date' },
    { key: 'requester.display', label: 'Prescriber' }
  ],
  
  allergies: [
    { key: 'code.text', label: 'Allergen' },
    { key: 'criticality', label: 'Criticality' },
    { key: 'type', label: 'Type' },
    { key: 'reaction.0.manifestation.0.text', label: 'Reaction' },
    { key: 'recordedDate', label: 'Recorded Date' }
  ],
  
  encounters: [
    { key: 'type.0.text', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'period.start', label: 'Start Date' },
    { key: 'period.end', label: 'End Date' },
    { key: 'participant.0.individual.display', label: 'Provider' },
    { key: 'location.0.location.display', label: 'Location' }
  ],
  
  orders: [
    { key: 'code.text', label: 'Order' },
    { key: 'resourceType', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'authoredOn', label: 'Ordered Date' },
    { key: 'requester.display', label: 'Ordered By' }
  ]
};