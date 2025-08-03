# Inventory Management Guide

**Created**: 2025-08-03  
**Status**: IMPLEMENTED

## Overview

WintEHR now includes a comprehensive inventory management system for tracking medication stock levels, managing shipments, and preventing stockouts. The system integrates with the pharmacy workflow to provide real-time inventory checking during dispensing.

## Features

### Real-Time Inventory Tracking
- **Stock Levels**: Track current quantity for all medications
- **Lot Management**: Multiple lots with expiration dates
- **Reorder Points**: Automatic alerts when stock is low
- **FIFO Dispensing**: First-in-first-out lot usage

### Inventory Alerts
- **Low Stock**: Items at or below reorder point
- **Out of Stock**: Zero quantity items
- **Expiring Soon**: Items expiring within 90 days
- **Expired**: Items past expiration date

### Integration with Pharmacy Queue
- **Stock Check**: One-click inventory check from prescription cards
- **Availability Display**: Visual indicators for stock status
- **Dispensing Validation**: Prevents dispensing without stock

### Inventory Management Page
- **Dashboard View**: Summary cards for key metrics
- **Searchable Table**: Filter by name, code, or status
- **Receive Shipments**: Add new inventory with lot tracking
- **Reports**: Generate inventory reports in JSON format

## Usage Instructions

### Checking Stock from Pharmacy Queue

1. **Individual Check**:
   - Click the three-dot menu on any prescription
   - Select "Check Stock"
   - Stock status appears on the prescription card
   - Shows available quantity and reorder status

2. **Stock Status Indicators**:
   - **Green Alert**: Sufficient stock available
   - **Yellow Alert**: Low stock or partial fill needed
   - **Red Alert**: Out of stock or expired

### Managing Inventory

1. **Access Inventory Page**:
   - From Pharmacy page, click FAB button
   - Select "Manage Inventory"
   - Or navigate directly to `/inventory`

2. **View Current Stock**:
   - Summary cards show total items, low stock, out of stock
   - Table displays all medications with:
     - Current quantity
     - Reorder point
     - Status chips
     - Lot information

3. **Search and Filter**:
   - Search by medication name or code
   - Filter by:
     - Low stock items
     - Expiring soon
     - Controlled substances
     - All items

### Receiving Shipments

1. **Add New Inventory**:
   - Click "Receive Shipment" button
   - Enter shipment details:
     - Medication code (RxNorm)
     - Medication name
     - Quantity received
     - Lot number
     - Expiration date
     - Manufacturer (optional)
     - Invoice number (optional)

2. **Lot Tracking**:
   - Each shipment creates a new lot
   - System tracks expiration by lot
   - FIFO dispensing uses oldest lots first

### Generating Reports

1. **Summary Report**:
   - Overview of inventory status
   - Total items, units, alerts
   - Downloads as JSON file

2. **Detailed Report**:
   - Complete inventory listing
   - All lot information
   - Expiration dates
   - Suitable for audits

## Inventory Data Structure

### Medication Item
```javascript
{
  code: "308136",              // RxNorm code
  name: "Lisinopril 10mg",     // Medication name
  quantity: 500,               // Total units in stock
  reorderPoint: 100,           // Alert threshold
  unit: "tablets",             // Unit of measure
  controlled: false,           // Controlled substance flag
  lotNumbers: [...]            // Array of lots
}
```

### Lot Information
```javascript
{
  lotNumber: "LOT123456",
  quantity: 250,
  expirationDate: "2026-12-31",
  manufacturer: "Generic Pharma Inc.",
  receivedDate: "2025-01-15",
  invoiceNumber: "INV-2025-001"
}
```

## Automatic Features

### Low Stock Alerts
- Triggered when quantity ≤ reorder point
- Visual warnings in pharmacy queue
- Dashboard alerts on inventory page
- Included in reports

### Expiration Management
- Automatic detection of expiring lots
- 90-day warning threshold
- Expired items flagged immediately
- FIFO ensures older stock used first

### Controlled Substances
- Special tracking for DEA scheduled medications
- Additional security warnings
- Separate filtering options
- Audit trail ready

## Mock Data

The system initializes with mock inventory for common medications:
- Lisinopril 10mg
- Metformin 500mg
- Atorvastatin 40mg
- Amoxicillin 500mg
- Omeprazole 20mg
- Insulin Glargine
- Oxycodone 5mg (controlled)
- Levothyroxine 100mcg

Each medication has 2-3 mock lots with different expiration dates.

## Integration Points

### With Dispensing Workflow
1. Check stock before dispensing
2. Automatic deduction on dispense
3. Lot selection for dispensing
4. Reorder alerts after dispensing

### With Label Printing
- Lot numbers can be included on labels
- Expiration dates printed
- Barcode integration ready

### With Reporting
- Inventory levels in pharmacy reports
- Dispensing history by lot
- Expiration reports for compliance

## Future Enhancements

1. **Backend Integration**: Replace mock data with real inventory API
2. **Barcode Scanning**: Scan medications for quick lookup
3. **Automatic Reordering**: Integration with suppliers
4. **Par Levels**: Department-specific stock levels
5. **Waste Tracking**: Document expired/damaged medications
6. **Cost Analysis**: Track inventory value and costs
7. **Multi-Location**: Support for multiple pharmacy locations
8. **Temperature Monitoring**: For refrigerated medications

## Troubleshooting

### Stock Not Updating
- Ensure you're checking the correct RxNorm code
- Try searching by medication name
- Check lot expiration dates

### Cannot Receive Shipment
- All required fields must be filled
- Expiration date must be in future
- Quantity must be positive number

### Reports Not Downloading
- Check browser download settings
- Ensure popup blocker isn't active
- Try different browser if needed

## Best Practices

1. **Regular Inventory Checks**: Review low stock items daily
2. **Expiration Reviews**: Check expiring items weekly
3. **Accurate Receiving**: Double-check lot numbers and expiration dates
4. **FIFO Compliance**: Let system handle lot selection
5. **Reorder Point Maintenance**: Adjust based on usage patterns
6. **Controlled Substance Audits**: Regular counts for DEA compliance

## Compliance Notes

This inventory system helps meet:
- **DEA Requirements**: Controlled substance tracking
- **State Board Rules**: Expiration date management
- **Joint Commission**: Medication storage standards
- **USP Standards**: Proper inventory practices

---

**Note**: This is currently using mock data. In production, integrate with your actual inventory management system or database.