# Pharmacy Print Labels Guide

**Created**: 2025-08-03  
**Status**: IMPLEMENTED

## Overview

WintEHR pharmacy module now includes comprehensive prescription label printing functionality, supporting both individual and batch printing of prescription labels with full regulatory compliance features.

## Features

### Individual Label Printing
- **Quick Print**: Print labels directly from the pharmacy queue
- **One-Click Access**: Available in the action menu for each prescription
- **Smart Templates**: Automatically selects appropriate label size based on medication type

### Batch Label Printing
- **Multi-Select Interface**: Select multiple prescriptions for batch printing
- **Category Filtering**: Quick selection by queue status (Ready, Dispensing, etc.)
- **Page Breaks**: Automatic page breaks between labels for easy separation
- **Print Preview**: Option to preview labels before printing

### Label Information

Each prescription label includes:

#### Required Information
- Patient name and identifier
- Medication name and strength
- Dosage instructions
- Quantity dispensed
- Prescriber name
- Prescription number (Rx #)
- Date dispensed
- Expiration date
- Refills remaining

#### Safety Features
- **Controlled Substance Warnings**: DEA schedule and special handling
- **Refrigeration Requirements**: Temperature storage alerts
- **Allergy Warnings**: Patient allergy notifications
- **Barcode/QR Code**: For inventory tracking (optional)

#### Pharmacy Information
- Pharmacy name and address
- Pharmacy phone number
- Pharmacist name
- DEA number (for controlled substances)

## Usage Instructions

### Printing Individual Labels

1. **From Pharmacy Queue**:
   - Click the three-dot menu on any prescription card
   - Select "Print Label"
   - Label opens in new window with print dialog

2. **Automatic Features**:
   - Controlled substances use larger label template
   - QR codes added for Schedule II-V medications
   - Special warnings highlighted in red

### Batch Printing Labels

1. **Access Batch Print**:
   - Click the floating action button (FAB) in bottom right
   - Select "Print Labels" from the speed dial menu

2. **Select Prescriptions**:
   - Use category checkboxes to select all in a category
   - Or individually select specific prescriptions
   - Counter shows total selected

3. **Print**:
   - Click "Print Labels (X)" button
   - All selected labels print with page breaks
   - Print dialog allows printer selection

### Label Templates

Three label sizes are available:

#### Standard (4" x 2.5")
- Default for most prescriptions
- Fits standard pharmacy label stock
- Includes all required information

#### Large (4" x 3.5")
- Used for controlled substances
- Extra space for warnings
- Includes QR code by default

#### Small (2.5" x 1.5")
- Compact labels for vials
- Essential information only
- Used for unit dose packaging

## Configuration

### Pharmacy Settings

Configure default pharmacy information in the label service:

```javascript
const labelOptions = {
  pharmacyName: 'Your Pharmacy Name',
  pharmacyAddress: '123 Main St, City, ST 12345',
  pharmacyPhone: '(555) 123-4567',
  pharmacistName: 'John Doe, RPh',
  deaNumber: 'BJ1234567'
};
```

### Template Customization

Modify label templates in `prescriptionLabelService.js`:

```javascript
const LABEL_TEMPLATES = {
  standard: {
    width: '4in',
    height: '2.5in',
    margin: '0.25in'
  },
  // Add custom templates here
};
```

### Print Settings

Browser print settings recommendations:
- **Margins**: Set to minimum or none
- **Scale**: 100% (no scaling)
- **Background**: Enable background graphics
- **Headers/Footers**: Disable

## Special Handling

### Controlled Substances

Automatically detected medications:
- Schedule II: Oxycodone, Morphine, Fentanyl, Amphetamine
- Schedule III: Codeine, Buprenorphine
- Schedule IV: Alprazolam, Lorazepam, Tramadol

Features:
- Larger label size
- DEA schedule prominently displayed
- DEA number included
- Security warnings

### Refrigerated Medications

Automatically detected:
- Insulin products
- Vaccines
- Biologics
- Certain suspensions

Features:
- Snowflake icon (❄️)
- "KEEP REFRIGERATED" warning
- Storage temperature if specified

### Allergy Warnings

When patient has known allergies:
- Warning symbol (⚠️)
- "PATIENT HAS ALLERGIES - SEE CHART"
- Red border on warning section

## Integration Points

### With Dispensing Workflow
1. Labels can be printed at any stage
2. Recommended to print when moving to "Ready" status
3. Batch print all "Ready" prescriptions at once

### With Inventory System
- Barcode on label links to inventory
- QR code can encode lot numbers
- Integration ready for barcode scanners

### With Electronic Signatures
- Space reserved for pharmacist initials
- Can be integrated with e-signature pads
- Timestamp included for verification

## Troubleshooting

### Common Issues

**Labels Not Printing**:
- Check browser popup blocker
- Ensure printer is selected in dialog
- Verify print preview shows correctly

**Formatting Issues**:
- Check browser zoom is at 100%
- Disable "Fit to page" in print settings
- Use recommended label stock

**Missing Information**:
- Verify prescription has all required fields
- Check FHIR resource completeness
- Ensure patient/prescriber references valid

### Browser Compatibility

Tested and supported:
- Chrome 90+ (recommended)
- Firefox 88+
- Safari 14+
- Edge 90+

### Label Printer Support

Compatible with:
- Zebra label printers (via drivers)
- Dymo LabelWriter series
- Brother QL series
- Standard laser/inkjet printers

## Future Enhancements

1. **Direct Thermal Printing**: Native thermal printer support
2. **Custom Label Designer**: Drag-and-drop label layout
3. **Barcode Formats**: Support for GS1 DataMatrix
4. **Multi-Language**: Bilingual label support
5. **Electronic Logging**: Automatic print audit trail
6. **Cloud Printing**: Google Cloud Print integration

## Regulatory Compliance

The label printing system helps meet requirements for:
- **FDA**: Prescription drug labeling requirements
- **DEA**: Controlled substance labeling
- **State Boards**: Pharmacy practice acts
- **USP**: Medication labeling standards

## API Reference

### Print Single Label
```javascript
import { printPrescriptionLabel } from '@/services/prescriptionLabelService';

printPrescriptionLabel(prescription, {
  template: 'standard',
  includeBarcode: true,
  pharmacyName: 'WintEHR Pharmacy'
});
```

### Print Batch Labels
```javascript
import { printBatchLabels } from '@/services/prescriptionLabelService';

printBatchLabels(prescriptions, {
  template: 'standard',
  includeBarcode: true
});
```

### Export Label Data
```javascript
import { exportLabelData } from '@/services/prescriptionLabelService';

const labelData = exportLabelData(prescription);
// Returns JSON for integration with label printers
```

---

**Note**: Always verify label accuracy before dispensing. Pharmacist verification required for all prescriptions.