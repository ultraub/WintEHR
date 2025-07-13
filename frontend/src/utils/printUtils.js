/**
 * Print utilities for clinical documentation
 */

import { format, parseISO } from 'date-fns';
import { NOTE_TEMPLATES } from '../services/noteTemplatesService';
import { documentReferenceConverter } from './fhir/DocumentReferenceConverter';

/**
 * Create a print-friendly HTML document
 * @param {Object} options - Print options
 * @param {string} options.title - Document title
 * @param {Object} options.patient - Patient information
 * @param {string} options.content - HTML content to print
 * @param {string} options.footer - Optional footer text
 * @returns {string} HTML document string
 */
export const createPrintDocument = ({ title, patient, content, footer }) => {
  const currentDate = format(new Date(), 'MMMM d, yyyy h:mm a');
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${title} - ${patient?.name || 'Patient'}</title>
        <style>
          @media print {
            body {
              font-family: Arial, sans-serif;
              font-size: 12pt;
              line-height: 1.5;
              margin: 0.5in;
              color: #000;
            }
            .header {
              border-bottom: 2px solid #333;
              margin-bottom: 20px;
              padding-bottom: 10px;
            }
            .header h1 {
              margin: 0;
              font-size: 18pt;
              color: #333;
            }
            .header .subtitle {
              margin: 5px 0;
              font-size: 14pt;
              color: #666;
            }
            .patient-info {
              background-color: #f5f5f5;
              padding: 15px;
              margin-bottom: 20px;
              border-radius: 5px;
            }
            .patient-info table {
              width: 100%;
              border-collapse: collapse;
            }
            .patient-info td {
              padding: 5px 10px;
              vertical-align: top;
            }
            .patient-info .label {
              font-weight: bold;
              width: 120px;
            }
            .content {
              margin: 20px 0;
            }
            .content h2 {
              font-size: 16pt;
              color: #333;
              margin-top: 20px;
              margin-bottom: 10px;
              border-bottom: 1px solid #ddd;
              padding-bottom: 5px;
            }
            .content h3 {
              font-size: 14pt;
              color: #444;
              margin-top: 15px;
              margin-bottom: 8px;
            }
            .content table {
              width: 100%;
              border-collapse: collapse;
              margin: 10px 0;
            }
            .content table th,
            .content table td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            .content table th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            .content .section {
              margin-bottom: 20px;
            }
            .content .note-box {
              border: 1px solid #ddd;
              padding: 15px;
              margin: 10px 0;
              background-color: #f9f9f9;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              font-size: 10pt;
              color: #666;
              text-align: center;
            }
            .no-print {
              display: none !important;
            }
            .page-break {
              page-break-before: always;
            }
            .avoid-break {
              page-break-inside: avoid;
            }
          }
          @media screen {
            body {
              font-family: Arial, sans-serif;
              max-width: 8.5in;
              margin: 0 auto;
              padding: 20px;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${title}</h1>
          <div class="subtitle">Printed on ${currentDate}</div>
        </div>
        
        <div class="patient-info">
          <table>
            <tr>
              <td class="label">Patient Name:</td>
              <td>${patient?.name || 'Not specified'}</td>
              <td class="label">MRN:</td>
              <td>${patient?.mrn || patient?.id || 'Not specified'}</td>
            </tr>
            <tr>
              <td class="label">Date of Birth:</td>
              <td>${patient?.birthDate ? format(parseISO(patient.birthDate), 'MMMM d, yyyy') : 'Not specified'}</td>
              <td class="label">Age:</td>
              <td>${patient?.age || calculateAge(patient?.birthDate) || 'Not specified'}</td>
            </tr>
            <tr>
              <td class="label">Gender:</td>
              <td>${patient?.gender || 'Not specified'}</td>
              <td class="label">Phone:</td>
              <td>${patient?.phone || 'Not specified'}</td>
            </tr>
          </table>
        </div>
        
        <div class="content">
          ${content}
        </div>
        
        <div class="footer">
          ${footer || `
            <p>This document is confidential and intended solely for the use of the individual or entity to whom it is addressed.</p>
            <p>Page <span class="page-number"></span></p>
          `}
        </div>
      </body>
    </html>
  `;
};

/**
 * Calculate age from birthdate
 * @param {string} birthDate - ISO date string
 * @returns {string} Age string
 */
const calculateAge = (birthDate) => {
  if (!birthDate) return null;
  try {
    const birth = parseISO(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return `${age} years`;
  } catch (error) {
    return null;
  }
};

/**
 * Print a document using a new window
 * @param {Object} options - Print options (same as createPrintDocument)
 */
export const printDocument = (options) => {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  const document = createPrintDocument(options);
  
  printWindow.document.open();
  printWindow.document.write(document);
  printWindow.document.close();
  
  // Wait for content to load before printing
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
    // Don't close immediately to allow user to cancel
    printWindow.onafterprint = () => {
      printWindow.close();
    };
  };
};

/**
 * Format lab results for printing
 * @param {Array} results - Array of FHIR Observation resources
 * @returns {string} HTML string
 */
export const formatLabResultsForPrint = (results) => {
  if (!results || results.length === 0) {
    return '<p>No lab results available.</p>';
  }

  const groupedByDate = results.reduce((acc, result) => {
    const date = result.effectiveDateTime || result.issued;
    const dateKey = date ? format(parseISO(date), 'MMMM d, yyyy') : 'Unknown Date';
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(result);
    return acc;
  }, {});

  let html = '';
  Object.entries(groupedByDate).forEach(([date, dateResults]) => {
    html += `<h2>${date}</h2>`;
    html += '<table class="avoid-break">';
    html += '<thead><tr><th>Test</th><th>Result</th><th>Reference Range</th><th>Status</th></tr></thead>';
    html += '<tbody>';
    
    dateResults.forEach(result => {
      const testName = result.code?.text || result.code?.coding?.[0]?.display || 'Unknown Test';
      const value = result.valueQuantity ? 
        `${result.valueQuantity.value} ${result.valueQuantity.unit || ''}` :
        result.valueString || 'Pending';
      const refRange = result.referenceRange?.[0] ?
        `${result.referenceRange[0].low?.value || ''} - ${result.referenceRange[0].high?.value || ''} ${result.referenceRange[0].low?.unit || ''}` :
        'N/A';
      const interpretation = result.interpretation?.[0]?.coding?.[0]?.code;
      const status = interpretation === 'H' ? 'High' : 
                    interpretation === 'L' ? 'Low' : 
                    interpretation === 'A' ? 'Abnormal' : 'Normal';
      
      html += '<tr>';
      html += `<td>${testName}</td>`;
      html += `<td>${value}</td>`;
      html += `<td>${refRange}</td>`;
      html += `<td>${status}</td>`;
      html += '</tr>';
    });
    
    html += '</tbody></table>';
  });

  return html;
};

/**
 * Format medications for printing
 * @param {Array} medications - Array of FHIR MedicationRequest resources
 * @returns {string} HTML string
 */
export const formatMedicationsForPrint = (medications) => {
  if (!medications || medications.length === 0) {
    return '<p>No active medications.</p>';
  }

  let html = '<table class="avoid-break">';
  html += '<thead><tr><th>Medication</th><th>Dosage</th><th>Frequency</th><th>Status</th><th>Prescriber</th></tr></thead>';
  html += '<tbody>';

  medications.forEach(med => {
    const medName = med.medicationCodeableConcept?.text || 
                   med.medicationCodeableConcept?.coding?.[0]?.display ||
                   'Unknown Medication';
    const dosage = med.dosageInstruction?.[0]?.text || 'See instructions';
    const frequency = med.dosageInstruction?.[0]?.timing?.repeat?.frequency ?
      `${med.dosageInstruction[0].timing.repeat.frequency} times per ${med.dosageInstruction[0].timing.repeat.period} ${med.dosageInstruction[0].timing.repeat.periodUnit}` :
      'As directed';
    const status = med.status || 'active';
    const prescriber = med.requester?.display || 'Unknown';

    html += '<tr>';
    html += `<td>${medName}</td>`;
    html += `<td>${dosage}</td>`;
    html += `<td>${frequency}</td>`;
    html += `<td>${status}</td>`;
    html += `<td>${prescriber}</td>`;
    html += '</tr>';
  });

  html += '</tbody></table>';
  return html;
};

/**
 * Format conditions/problems for printing
 * @param {Array} conditions - Array of FHIR Condition resources
 * @returns {string} HTML string
 */
export const formatConditionsForPrint = (conditions) => {
  if (!conditions || conditions.length === 0) {
    return '<p>No active conditions.</p>';
  }

  let html = '<table class="avoid-break">';
  html += '<thead><tr><th>Condition</th><th>Onset Date</th><th>Status</th><th>Severity</th></tr></thead>';
  html += '<tbody>';

  conditions.forEach(condition => {
    const name = condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown';
    const onset = condition.onsetDateTime ? 
      format(parseISO(condition.onsetDateTime), 'MMM d, yyyy') : 
      'Unknown';
    const status = condition.clinicalStatus?.coding?.[0]?.code || 'active';
    const severity = condition.severity?.text || 
                    condition.severity?.coding?.[0]?.display || 
                    'Not specified';

    html += '<tr>';
    html += `<td>${name}</td>`;
    html += `<td>${onset}</td>`;
    html += `<td>${status}</td>`;
    html += `<td>${severity}</td>`;
    html += '</tr>';
  });

  html += '</tbody></table>';
  return html;
};

/**
 * Format encounters for printing
 * @param {Array} encounters - Array of FHIR Encounter resources
 * @returns {string} HTML string
 */
export const formatEncountersForPrint = (encounters) => {
  if (!encounters || encounters.length === 0) {
    return '<p>No encounters recorded.</p>';
  }

  let html = '';
  encounters.forEach(encounter => {
    const type = encounter.type?.[0]?.text || 
                encounter.type?.[0]?.coding?.[0]?.display || 
                'Encounter';
    const date = encounter.period?.start ? 
      format(parseISO(encounter.period.start), 'MMMM d, yyyy h:mm a') : 
      'Unknown date';
    const provider = encounter.participant?.find(p => 
      p.type?.[0]?.coding?.[0]?.code === 'ATND'
    )?.individual?.display || 'Unknown provider';
    const reason = encounter.reasonCode?.[0]?.text || 
                  encounter.reasonCode?.[0]?.coding?.[0]?.display || 
                  'Not specified';

    html += '<div class="section avoid-break">';
    html += `<h3>${type} - ${date}</h3>`;
    html += '<div class="note-box">';
    html += `<p><strong>Provider:</strong> ${provider}</p>`;
    html += `<p><strong>Reason for Visit:</strong> ${reason}</p>`;
    html += `<p><strong>Status:</strong> ${encounter.status}</p>`;
    html += '</div>';
    html += '</div>';
  });

  return html;
};

/**
 * Format clinical note for printing
 * @param {Object} note - FHIR DocumentReference resource
 * @param {Object} patient - Patient information
 * @param {Object} template - Note template information
 * @returns {Object} Print document options
 */
export const formatClinicalNoteForPrint = (note, patient, template) => {
  if (!note) {
    return {
      title: 'Clinical Note',
      patient,
      content: '<p>No note content available.</p>',
      footer: 'Printed from MedGenEMR'
    };
  }

  // Extract note content using standardized converter
  let content = '';
  try {
    const extractedContent = documentReferenceConverter.extractDocumentContent(note);
    
    if (extractedContent.error) {
      content = '<p>Error loading note content.</p>';
    } else if (extractedContent.type === 'soap' && extractedContent.sections) {
      // Handle SOAP format
      content = formatSectionedNoteForPrint(extractedContent.sections, template);
    } else if (template?.structure === 'sections' && extractedContent.content) {
      // Try to parse as sections if template expects sections
      try {
        const sections = JSON.parse(extractedContent.content);
        content = formatSectionedNoteForPrint(sections, template);
      } catch (e) {
        content = `<div class="note-box">${formatPlainTextNote(extractedContent.content)}</div>`;
      }
    } else {
      content = `<div class="note-box">${formatPlainTextNote(extractedContent.content || '')}</div>`;
    }
  } catch (error) {
    content = '<p>Error loading note content.</p>';
  }

  // Add note metadata
  const noteDate = note.date ? format(parseISO(note.date), 'MMMM d, yyyy h:mm a') : 'Unknown';
  const author = note.author?.[0]?.display || 'Unknown';
  const status = note.docStatus || 'preliminary';
  const noteType = template?.label || note.type?.coding?.[0]?.display || 'Clinical Note';

  const metadata = `
    <div class="note-metadata avoid-break">
      <table>
        <tr>
          <td class="label">Note Type:</td>
          <td>${noteType}</td>
          <td class="label">Date:</td>
          <td>${noteDate}</td>
        </tr>
        <tr>
          <td class="label">Author:</td>
          <td>${author}</td>
          <td class="label">Status:</td>
          <td style="text-transform: capitalize;">${status}</td>
        </tr>
      </table>
    </div>
  `;

  return {
    title: `${noteType} - ${patient?.name || 'Patient'}`,
    patient,
    content: metadata + content,
    footer: 'Printed from MedGenEMR Clinical Documentation System'
  };
};

/**
 * Format sectioned note content for printing
 * @param {Object} sections - Note sections object
 * @param {Object} template - Note template
 * @returns {string} HTML string
 */
const formatSectionedNoteForPrint = (sections, template) => {
  let html = '<div class="sectioned-note">';
  
  Object.entries(template.sections || {}).forEach(([sectionKey, sectionConfig]) => {
    const sectionContent = sections[sectionKey] || '';
    if (sectionContent.trim()) {
      html += `
        <div class="note-section avoid-break">
          <h3>${sectionConfig.label}</h3>
          <div class="section-content">${formatPlainTextNote(sectionContent)}</div>
        </div>
      `;
    }
  });
  
  html += '</div>';
  return html;
};

/**
 * Format plain text note content for printing (preserve line breaks)
 * @param {string} text - Plain text content
 * @returns {string} HTML string
 */
const formatPlainTextNote = (text) => {
  return text
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
    .replace(/<p><\/p>/g, '');
};

/**
 * Export clinical note data in various formats
 * @param {Object} options - Export options
 * @param {Object} options.note - FHIR DocumentReference resource
 * @param {Object} options.patient - Patient information
 * @param {Object} options.template - Note template
 * @param {string} options.format - Export format ('json', 'txt')
 * @returns {Promise<Blob>} Exported data as blob
 */
export const exportClinicalNote = async (options) => {
  const { note, patient, template, format = 'txt' } = options;
  
  switch (format) {
    case 'json':
      return exportNoteAsJSON(note, patient, template);
    case 'txt':
      return exportNoteAsText(note, patient, template);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
};

/**
 * Export note as JSON blob
 */
const exportNoteAsJSON = (note, patient, template) => {
  const exportData = {
    exportDate: new Date().toISOString(),
    patient: {
      name: patient?.name,
      id: patient?.id,
      mrn: patient?.mrn
    },
    note: {
      id: note.id,
      type: template?.label || note.type?.coding?.[0]?.display,
      date: note.date,
      author: note.author?.[0]?.display,
      status: note.docStatus,
      content: (() => {
        try {
          const extractedContent = documentReferenceConverter.extractDocumentContent(note);
          return extractedContent.error ? 
            'Error: Unable to decode note content' : 
            extractedContent.content || '';
        } catch (error) {
          return 'Error: Unable to decode note content';
        }
      })()
    },
    template: template ? {
      id: template.id,
      label: template.label,
      structure: template.structure
    } : null
  };
  
  const jsonString = JSON.stringify(exportData, null, 2);
  return new Blob([jsonString], { type: 'application/json' });
};

/**
 * Export note as plain text blob
 */
const exportNoteAsText = (note, patient, template) => {
  const noteDate = note.date ? format(parseISO(note.date), 'MMMM d, yyyy h:mm a') : 'Unknown';
  const author = note.author?.[0]?.display || 'Unknown';
  const noteType = template?.label || note.type?.coding?.[0]?.display || 'Clinical Note';
  
  let content = '';
  try {
    const extractedContent = documentReferenceConverter.extractDocumentContent(note);
    
    if (extractedContent.error) {
      content = 'Error loading note content.';
    } else if (extractedContent.type === 'soap' && extractedContent.sections) {
      // Handle SOAP format
      Object.entries(extractedContent.sections).forEach(([sectionKey, sectionContent]) => {
        if (sectionContent && sectionContent.trim()) {
          content += `\n${sectionKey.toUpperCase()}\n`;
          content += '='.repeat(sectionKey.length) + '\n';
          content += sectionContent + '\n';
        }
      });
    } else if (template?.structure === 'sections' && extractedContent.content) {
      // Try to parse as sections if template expects sections
      try {
        const sections = JSON.parse(extractedContent.content);
        Object.entries(template.sections || {}).forEach(([sectionKey, sectionConfig]) => {
          const sectionContent = sections[sectionKey] || '';
          if (sectionContent.trim()) {
            content += `\n${sectionConfig.label.toUpperCase()}\n`;
            content += '='.repeat(sectionConfig.label.length) + '\n';
            content += sectionContent + '\n';
          }
        });
      } catch (e) {
        content = extractedContent.content || '';
      }
    } else {
      content = extractedContent.content || '';
    }
  } catch (error) {
    content = 'Error loading note content.';
  }

  const textContent = `
${noteType.toUpperCase()}
${'='.repeat(noteType.length)}

Patient: ${patient?.name || 'Unknown'}
MRN: ${patient?.mrn || patient?.id || 'Unknown'}
Date: ${noteDate}
Author: ${author}
Status: ${note.docStatus || 'preliminary'}

${content}

---
Exported from MedGenEMR on ${format(new Date(), 'MMMM d, yyyy h:mm a')}
  `.trim();
  
  return new Blob([textContent], { type: 'text/plain' });
};