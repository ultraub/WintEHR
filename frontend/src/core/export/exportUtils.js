/**
 * Export utilities for clinical data
 * Supports CSV, JSON, and PDF export formats
 */

import { format } from 'date-fns';
import { printDocument } from './printUtils';

/**
 * Get nested object value by dot notation path
 * @param {Object} obj - Object to get value from
 * @param {string} path - Dot notation path (e.g., 'code.text' or 'coding[0].code')
 * @returns {*} Value at path
 */
const getNestedValue = (obj, path) => {
  if (!obj || !path) return null;
  
  // Handle array notation like 'coding[0].code'
  const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
  
  return normalizedPath.split('.').reduce((current, key) => {
    return current?.[key];
  }, obj);
};

/**
 * Format value based on type
 * @param {*} value - Value to format
 * @param {string} format - Format type ('date', 'datetime', etc.)
 * @returns {string} Formatted value
 */
const formatValue = (value, formatType) => {
  if (!value) return '';
  
  switch (formatType) {
    case 'date':
      try {
        return format(new Date(value), 'MM/dd/yyyy');
      } catch {
        return value;
      }
    case 'datetime':
      try {
        return format(new Date(value), 'MM/dd/yyyy HH:mm');
      } catch {
        return value;
      }
    default:
      return String(value);
  }
};

/**
 * Convert data to CSV format
 * @param {Array} data - Array of objects to convert
 * @param {Array} columns - Column configuration [{key: 'field', label: 'Header', format: 'date'}]
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
      const formattedValue = formatValue(value, col.format);
      // Escape quotes and wrap in quotes
      const escaped = String(formattedValue || '').replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',');
  });
  
  return [headers, ...rows].join('\n');
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
 * @param {boolean} prettyPrint - Whether to format JSON
 */
export const downloadJSON = (data, filename, prettyPrint = true) => {
  const json = JSON.stringify(data, null, prettyPrint ? 2 : 0);
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
 * Export clinical data with options
 * @param {Object} options - Export options
 * @param {Array} options.data - Data to export
 * @param {string} options.format - Export format ('csv', 'json', 'pdf')
 * @param {string} options.filename - Filename without extension
 * @param {Array} options.columns - Column configuration for CSV
 * @param {string} options.title - Title for PDF export
 * @param {boolean} options.prettyPrint - Pretty print JSON
 * @param {Function} options.formatForPrint - Custom format function for PDF
 */
export const exportClinicalData = async (options) => {
  const {
    data,
    format = 'csv',
    filename = 'clinical_data',
    columns = [],
    title = 'Clinical Data Export',
    prettyPrint = true,
    formatForPrint
  } = options;
  
  if (!data || data.length === 0) {
    throw new Error('No data to export');
  }
  
  switch (format) {
    case 'csv':
      if (!columns || columns.length === 0) {
        throw new Error('Columns configuration required for CSV export');
      }
      downloadCSV(data, columns, filename);
      break;
      
    case 'json':
      downloadJSON(data, filename, prettyPrint);
      break;
      
    case 'pdf':
      const content = formatForPrint ? 
        formatForPrint(data) : 
        generateTableHTML(data, columns);
      
      printDocument({
        title,
        content,
        filename
      });
      break;
      
    default:
      throw new Error(`Unsupported export format: ${format}`);
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
      const formattedValue = formatValue(value, col.format);
      return `<td>${formattedValue || ''}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  
  return `
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background-color: #f5f5f5;">${headers}</tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
};