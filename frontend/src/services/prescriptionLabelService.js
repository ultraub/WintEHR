/**
 * Prescription Label Service
 * Handles prescription label generation and printing
 */

import { format } from 'date-fns';

// Label templates for different label sizes
const LABEL_TEMPLATES = {
  standard: {
    width: '4in',
    height: '2.5in',
    margin: '0.25in'
  },
  large: {
    width: '4in',
    height: '3.5in',
    margin: '0.25in'
  },
  small: {
    width: '2.5in',
    height: '1.5in',
    margin: '0.15in'
  }
};

// Generate prescription label HTML
export const generatePrescriptionLabel = (prescription, options = {}) => {
  const {
    template = 'standard',
    includeBarcode = true,
    includeQRCode = false,
    pharmacyName = 'WintEHR PHARMACY',
    pharmacyAddress = '',
    pharmacyPhone = '',
    pharmacistName = '',
    deaNumber = ''
  } = options;

  const labelSize = LABEL_TEMPLATES[template];

  // Extract prescription details
  const medicationName = prescription.medicationCodeableConcept?.text ||
                        prescription.medicationCodeableConcept?.coding?.[0]?.display ||
                        'Unknown Medication';
  
  const patientRef = prescription.subject?.reference || '';
  const patientId = patientRef.replace('Patient/', '');
  const patientDisplay = prescription.subject?.display || `Patient ${patientId}`;
  
  const quantity = prescription.dispenseRequest?.quantity?.value || '';
  const unit = prescription.dispenseRequest?.quantity?.unit || 'units';
  const prescriber = prescription.requester?.display || 'Unknown Provider';
  
  // Check for special handling
  const isControlled = checkIfControlled(medicationName);
  const needsRefrigeration = checkIfRefrigerated(medicationName);
  const hasAllergies = prescription.note?.some(note => 
    note.text?.toLowerCase().includes('allergy') ||
    note.text?.toLowerCase().includes('allergic')
  );

  // Calculate expiration date (1 year default)
  const expirationDate = new Date();
  expirationDate.setFullYear(expirationDate.getFullYear() + 1);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Prescription Label - ${medicationName}</title>
      <style>
        @page {
          size: ${labelSize.width} ${labelSize.height};
          margin: ${labelSize.margin};
        }
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
        body {
          font-family: Arial, sans-serif;
          font-size: 12px;
          margin: 0;
          padding: 10px;
        }
        .label-container {
          border: 2px solid #000;
          padding: 10px;
          height: 100%;
          box-sizing: border-box;
          position: relative;
        }
        .header {
          text-align: center;
          font-weight: bold;
          font-size: 14px;
          margin-bottom: 10px;
          border-bottom: 1px solid #000;
          padding-bottom: 5px;
        }
        .pharmacy-info {
          text-align: center;
          font-size: 10px;
          margin-bottom: 10px;
        }
        .patient-info {
          margin-bottom: 10px;
          font-weight: bold;
        }
        .medication-name {
          font-weight: bold;
          font-size: 16px;
          margin: 10px 0;
          text-transform: uppercase;
        }
        .dosage-info {
          margin: 10px 0;
          padding: 5px;
          background-color: #f0f0f0;
          border: 1px solid #ccc;
        }
        .warning {
          color: #d32f2f;
          font-weight: bold;
          margin: 5px 0;
          padding: 3px;
          border: 1px solid #d32f2f;
          background-color: #ffebee;
        }
        .prescription-details {
          margin: 10px 0;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 5px;
        }
        .footer {
          position: absolute;
          bottom: 10px;
          left: 10px;
          right: 10px;
          font-size: 10px;
          border-top: 1px solid #000;
          padding-top: 5px;
        }
        .barcode {
          text-align: center;
          font-family: 'Courier New', monospace;
          font-size: 10px;
          margin: 5px 0;
        }
        .qr-code {
          text-align: center;
          margin: 5px 0;
        }
        .controlled-substance {
          background-color: #ffebee;
          border: 2px solid #d32f2f;
          padding: 5px;
          margin: 5px 0;
          text-align: center;
          font-weight: bold;
          color: #d32f2f;
        }
      </style>
    </head>
    <body onload="window.print()">
      <div class="label-container">
        <div class="header">${pharmacyName}</div>
        
        ${pharmacyAddress || pharmacyPhone ? `
          <div class="pharmacy-info">
            ${pharmacyAddress ? `${pharmacyAddress}<br>` : ''}
            ${pharmacyPhone ? `Tel: ${pharmacyPhone}` : ''}
          </div>
        ` : ''}
        
        <div class="patient-info">
          ${patientDisplay}
        </div>
        
        <div class="medication-name">${medicationName}</div>
        
        ${isControlled ? `
          <div class="controlled-substance">
            CONTROLLED SUBSTANCE - SCHEDULE ${getControlledSchedule(medicationName)}
            ${deaNumber ? `<br>DEA: ${deaNumber}` : ''}
          </div>
        ` : ''}
        
        <div class="dosage-info">
          <strong>DIRECTIONS FOR USE:</strong><br>
          ${prescription.dosageInstruction?.[0]?.text || 'Take as directed by prescriber'}
        </div>
        
        <div class="prescription-details">
          <div><strong>Qty:</strong> ${quantity} ${unit}</div>
          <div><strong>Rx #:</strong> ${prescription.id.substring(0, 8).toUpperCase()}</div>
          <div><strong>Prescriber:</strong> ${prescriber}</div>
          <div><strong>Date:</strong> ${format(new Date(), 'MM/dd/yyyy')}</div>
        </div>
        
        ${prescription.dispenseRequest?.numberOfRepeatsAllowed ? 
          `<div><strong>Refills:</strong> ${prescription.dispenseRequest.numberOfRepeatsAllowed} remaining</div>` : 
          '<div><strong>NO REFILLS</strong></div>'}
        
        ${needsRefrigeration ? '<div class="warning">❄️ KEEP REFRIGERATED</div>' : ''}
        ${hasAllergies ? '<div class="warning">⚠️ PATIENT HAS KNOWN ALLERGIES - SEE CHART</div>' : ''}
        
        ${includeBarcode ? `
          <div class="barcode">
            |||| ${prescription.id} ||||
          </div>
        ` : ''}
        
        ${includeQRCode ? `
          <div class="qr-code">
            [QR Code: ${prescription.id}]
          </div>
        ` : ''}
        
        <div class="footer">
          <div style="display: flex; justify-content: space-between;">
            <span><strong>Filled:</strong> ${format(new Date(), 'MM/dd/yyyy HH:mm')}</span>
            <span><strong>Use By:</strong> ${format(expirationDate, 'MM/dd/yyyy')}</span>
          </div>
          ${pharmacistName ? `<div><strong>RPh:</strong> ${pharmacistName}</div>` : ''}
        </div>
      </div>
    </body>
    </html>
  `;
};

// Print a single prescription label
export const printPrescriptionLabel = (prescription, options = {}) => {
  const labelHTML = generatePrescriptionLabel(prescription, options);
  
  const printWindow = window.open('', '_blank', 'width=450,height=600');
  printWindow.document.write(labelHTML);
  printWindow.document.close();
  
  return true;
};

// Print multiple prescription labels
export const printBatchLabels = (prescriptions, options = {}) => {
  const labels = prescriptions.map(rx => generatePrescriptionLabel(rx, options));
  
  const batchHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Batch Prescription Labels</title>
      <style>
        @media print {
          .page-break { page-break-after: always; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body onload="window.print()">
      ${labels.map((label, index) => `
        <div class="${index < labels.length - 1 ? 'page-break' : ''}">
          ${label.replace(/<\/?html>|<\/?head>|<\/?body.*?>|<!DOCTYPE.*?>/gi, '')}
        </div>
      `).join('')}
    </body>
    </html>
  `;
  
  const printWindow = window.open('', '_blank', 'width=450,height=600');
  printWindow.document.write(batchHTML);
  printWindow.document.close();
  
  return true;
};

// Generate label preview (returns data URL)
export const generateLabelPreview = async (prescription, options = {}) => {
  const labelHTML = generatePrescriptionLabel(prescription, options);
  
  // Create a temporary iframe to render the label
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.left = '-9999px';
  iframe.style.width = '400px';
  iframe.style.height = '250px';
  document.body.appendChild(iframe);
  
  iframe.contentDocument.write(labelHTML);
  iframe.contentDocument.close();
  
  // Wait for content to load
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Convert to canvas (would need html2canvas library for real implementation)
  // For now, return a placeholder
  document.body.removeChild(iframe);
  
  return 'data:image/png;base64,placeholder';
};

// Check if medication is controlled
const checkIfControlled = (medicationName) => {
  const controlledKeywords = [
    'oxycodone', 'morphine', 'fentanyl', 'hydrocodone',
    'amphetamine', 'methylphenidate', 'alprazolam', 'lorazepam',
    'codeine', 'tramadol', 'methadone', 'buprenorphine'
  ];
  
  const lowerName = medicationName.toLowerCase();
  return controlledKeywords.some(keyword => lowerName.includes(keyword));
};

// Get controlled substance schedule
const getControlledSchedule = (medicationName) => {
  const lowerName = medicationName.toLowerCase();
  
  // Schedule II
  if (['oxycodone', 'morphine', 'fentanyl', 'amphetamine', 'methylphenidate'].some(drug => lowerName.includes(drug))) {
    return 'II';
  }
  
  // Schedule III
  if (['codeine', 'buprenorphine'].some(drug => lowerName.includes(drug))) {
    return 'III';
  }
  
  // Schedule IV
  if (['alprazolam', 'lorazepam', 'tramadol'].some(drug => lowerName.includes(drug))) {
    return 'IV';
  }
  
  return 'II-V';
};

// Check if medication needs refrigeration
const checkIfRefrigerated = (medicationName) => {
  const refrigeratedKeywords = [
    'insulin', 'vaccine', 'immunoglobulin', 'interferon',
    'growth hormone', 'biologic', 'suspension'
  ];
  
  const lowerName = medicationName.toLowerCase();
  return refrigeratedKeywords.some(keyword => lowerName.includes(keyword));
};

// Label configuration presets
export const LABEL_PRESETS = {
  standard: {
    template: 'standard',
    includeBarcode: true,
    includeQRCode: false
  },
  controlled: {
    template: 'large',
    includeBarcode: true,
    includeQRCode: true,
    // Additional warnings for controlled substances
  },
  pediatric: {
    template: 'large',
    includeBarcode: true,
    // Larger font for important information
  }
};

// Export label data as JSON (for integration with label printers)
export const exportLabelData = (prescription) => {
  const medicationName = prescription.medicationCodeableConcept?.text || '';
  const patientDisplay = prescription.subject?.display || '';
  const quantity = prescription.dispenseRequest?.quantity?.value || '';
  const unit = prescription.dispenseRequest?.quantity?.unit || '';
  
  return {
    patient: patientDisplay,
    medication: medicationName,
    quantity: `${quantity} ${unit}`,
    directions: prescription.dosageInstruction?.[0]?.text || '',
    prescriber: prescription.requester?.display || '',
    rxNumber: prescription.id.substring(0, 8).toUpperCase(),
    dateDispensed: format(new Date(), 'yyyy-MM-dd'),
    expirationDate: format(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    refills: prescription.dispenseRequest?.numberOfRepeatsAllowed || 0,
    isControlled: checkIfControlled(medicationName),
    needsRefrigeration: checkIfRefrigerated(medicationName),
    barcode: prescription.id
  };
};

export default {
  generatePrescriptionLabel,
  printPrescriptionLabel,
  printBatchLabels,
  generateLabelPreview,
  exportLabelData,
  LABEL_PRESETS,
  LABEL_TEMPLATES
};