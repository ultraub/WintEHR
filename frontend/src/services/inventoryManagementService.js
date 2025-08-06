/**
 * Inventory Management Service
 * Handles medication inventory tracking and management
 */

import { fhirClient } from '../core/fhir/services/fhirClient';

// Mock inventory data structure (in production, this would come from a backend API)
const MOCK_INVENTORY = {
  medications: new Map()
};

// Initialize with some common medications
const initializeMockInventory = () => {
  const commonMedications = [
    { code: '308136', name: 'Lisinopril 10mg', quantity: 500, reorderPoint: 100, unit: 'tablets' },
    { code: '308191', name: 'Metformin 500mg', quantity: 800, reorderPoint: 200, unit: 'tablets' },
    { code: '197361', name: 'Atorvastatin 40mg', quantity: 300, reorderPoint: 75, unit: 'tablets' },
    { code: '310798', name: 'Amoxicillin 500mg', quantity: 450, reorderPoint: 100, unit: 'capsules' },
    { code: '313782', name: 'Omeprazole 20mg', quantity: 600, reorderPoint: 150, unit: 'capsules' },
    { code: '849574', name: 'Insulin Glargine', quantity: 25, reorderPoint: 10, unit: 'vials' },
    { code: '1049502', name: 'Oxycodone 5mg', quantity: 50, reorderPoint: 20, unit: 'tablets', controlled: true },
    { code: '197696', name: 'Levothyroxine 100mcg', quantity: 1000, reorderPoint: 250, unit: 'tablets' }
  ];

  commonMedications.forEach(med => {
    MOCK_INVENTORY.medications.set(med.code, {
      ...med,
      lotNumbers: generateMockLots(med),
      lastUpdated: new Date().toISOString()
    });
  });
};

// Generate mock lot numbers with expiration dates
const generateMockLots = (medication) => {
  const lots = [];
  const totalQuantity = medication.quantity;
  let remainingQuantity = totalQuantity;
  
  // Create 2-3 lots with different expiration dates
  const numLots = Math.min(3, Math.ceil(totalQuantity / 100));
  
  for (let i = 0; i < numLots; i++) {
    const lotQuantity = i === numLots - 1 ? remainingQuantity : Math.floor(totalQuantity / numLots);
    remainingQuantity -= lotQuantity;
    
    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + (12 + i * 6)); // 12, 18, 24 months
    
    lots.push({
      lotNumber: `LOT${Date.now()}${i}`,
      quantity: lotQuantity,
      expirationDate: expirationDate.toISOString(),
      manufacturer: 'Generic Pharma Inc.'
    });
  }
  
  return lots;
};

// Initialize on first load
if (MOCK_INVENTORY.medications.size === 0) {
  initializeMockInventory();
}

/**
 * Get current inventory levels for a medication
 * @param {string} medicationCode - RxNorm code or medication ID
 * @returns {Object} Inventory information
 */
export const getInventoryLevel = async (medicationCode) => {
  // In production, this would be an API call
  const inventory = MOCK_INVENTORY.medications.get(medicationCode);
  
  if (!inventory) {
    // Try to find by name if code doesn't match
    for (const [code, item] of MOCK_INVENTORY.medications) {
      if (item.name.toLowerCase().includes(medicationCode.toLowerCase())) {
        return item;
      }
    }
    return null;
  }
  
  return inventory;
};

/**
 * Get all inventory items
 * @param {Object} filters - Optional filters (lowStock, expiringSoon, etc.)
 * @returns {Array} Array of inventory items
 */
export const getAllInventory = async (filters = {}) => {
  const allItems = Array.from(MOCK_INVENTORY.medications.values());
  
  let filteredItems = allItems;
  
  // Apply filters
  if (filters.lowStock) {
    filteredItems = filteredItems.filter(item => 
      item.quantity <= item.reorderPoint
    );
  }
  
  if (filters.expiringSoon) {
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
    
    filteredItems = filteredItems.filter(item => 
      item.lotNumbers.some(lot => 
        new Date(lot.expirationDate) <= threeMonthsFromNow
      )
    );
  }
  
  if (filters.controlled) {
    filteredItems = filteredItems.filter(item => item.controlled);
  }
  
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filteredItems = filteredItems.filter(item => 
      item.name.toLowerCase().includes(searchLower) ||
      item.code.includes(searchLower)
    );
  }
  
  return filteredItems;
};

/**
 * Check if sufficient inventory exists for dispensing
 * @param {string} medicationCode - RxNorm code
 * @param {number} quantityNeeded - Quantity to dispense
 * @returns {Object} Availability status and details
 */
export const checkAvailability = async (medicationCode, quantityNeeded) => {
  const inventory = await getInventoryLevel(medicationCode);
  
  if (!inventory) {
    return {
      available: false,
      reason: 'Medication not in inventory',
      suggestion: 'Order from supplier or substitute'
    };
  }
  
  const totalAvailable = inventory.quantity;
  
  if (totalAvailable < quantityNeeded) {
    return {
      available: false,
      inStock: totalAvailable,
      needed: quantityNeeded,
      shortage: quantityNeeded - totalAvailable,
      reason: 'Insufficient quantity',
      suggestion: totalAvailable > 0 ? 
        `Only ${totalAvailable} ${inventory.unit} available. Partial fill possible.` :
        'Out of stock. Order from supplier.'
    };
  }
  
  // Check for expiring lots
  const now = new Date();
  const validLots = inventory.lotNumbers.filter(lot => 
    new Date(lot.expirationDate) > now
  );
  
  if (validLots.length === 0) {
    return {
      available: false,
      reason: 'All lots expired',
      suggestion: 'Remove expired stock and reorder'
    };
  }
  
  // Check if we need to use multiple lots
  const lotsNeeded = [];
  let remainingNeeded = quantityNeeded;
  
  for (const lot of validLots) {
    if (remainingNeeded <= 0) break;
    
    const useFromLot = Math.min(lot.quantity, remainingNeeded);
    lotsNeeded.push({
      ...lot,
      quantityToUse: useFromLot
    });
    remainingNeeded -= useFromLot;
  }
  
  return {
    available: true,
    totalInStock: totalAvailable,
    quantityNeeded,
    lotsToUse: lotsNeeded,
    willTriggerReorder: (totalAvailable - quantityNeeded) <= inventory.reorderPoint
  };
};

/**
 * Deduct inventory after dispensing
 * @param {string} medicationCode - RxNorm code
 * @param {number} quantity - Quantity dispensed
 * @param {string} lotNumber - Optional specific lot number
 * @returns {Object} Updated inventory status
 */
export const deductInventory = async (medicationCode, quantity, lotNumber = null) => {
  const inventory = MOCK_INVENTORY.medications.get(medicationCode);
  
  if (!inventory) {
    throw new Error('Medication not found in inventory');
  }
  
  // Deduct from specific lot or FIFO
  if (lotNumber) {
    const lot = inventory.lotNumbers.find(l => l.lotNumber === lotNumber);
    if (!lot) {
      throw new Error('Lot number not found');
    }
    if (lot.quantity < quantity) {
      throw new Error('Insufficient quantity in specified lot');
    }
    lot.quantity -= quantity;
  } else {
    // FIFO - use oldest lots first
    let remainingToDeduct = quantity;
    const sortedLots = [...inventory.lotNumbers].sort((a, b) => 
      new Date(a.expirationDate) - new Date(b.expirationDate)
    );
    
    for (const lot of sortedLots) {
      if (remainingToDeduct <= 0) break;
      
      const deductFromLot = Math.min(lot.quantity, remainingToDeduct);
      lot.quantity -= deductFromLot;
      remainingToDeduct -= deductFromLot;
    }
    
    if (remainingToDeduct > 0) {
      throw new Error('Insufficient total inventory');
    }
  }
  
  // Update total quantity
  inventory.quantity -= quantity;
  inventory.lastUpdated = new Date().toISOString();
  
  // Clean up empty lots
  inventory.lotNumbers = inventory.lotNumbers.filter(lot => lot.quantity > 0);
  
  // Check if reorder needed
  const needsReorder = inventory.quantity <= inventory.reorderPoint;
  
  // In production, this would trigger an event or notification
  if (needsReorder) {
    console.log(`Reorder alert: ${inventory.name} - Only ${inventory.quantity} ${inventory.unit} remaining`);
  }
  
  return {
    success: true,
    medication: inventory.name,
    quantityDispensed: quantity,
    remainingStock: inventory.quantity,
    needsReorder,
    reorderPoint: inventory.reorderPoint
  };
};

/**
 * Add inventory (receiving shipment)
 * @param {string} medicationCode - RxNorm code
 * @param {Object} shipmentData - Shipment details
 * @returns {Object} Updated inventory
 */
export const addInventory = async (medicationCode, shipmentData) => {
  const {
    quantity,
    lotNumber,
    expirationDate,
    manufacturer = 'Generic Pharma Inc.',
    invoiceNumber
  } = shipmentData;
  
  let inventory = MOCK_INVENTORY.medications.get(medicationCode);
  
  if (!inventory) {
    // Create new inventory item
    inventory = {
      code: medicationCode,
      name: shipmentData.medicationName || `Medication ${medicationCode}`,
      quantity: 0,
      reorderPoint: Math.floor(quantity * 0.2), // 20% as default reorder point
      unit: shipmentData.unit || 'units',
      lotNumbers: [],
      lastUpdated: new Date().toISOString()
    };
    MOCK_INVENTORY.medications.set(medicationCode, inventory);
  }
  
  // Add new lot
  inventory.lotNumbers.push({
    lotNumber,
    quantity,
    expirationDate,
    manufacturer,
    receivedDate: new Date().toISOString(),
    invoiceNumber
  });
  
  // Update total quantity
  inventory.quantity += quantity;
  inventory.lastUpdated = new Date().toISOString();
  
  return {
    success: true,
    medication: inventory.name,
    quantityAdded: quantity,
    newTotal: inventory.quantity,
    lotNumber
  };
};

/**
 * Get inventory alerts (low stock, expiring, etc.)
 * @returns {Object} Categorized alerts
 */
export const getInventoryAlerts = async () => {
  const alerts = {
    lowStock: [],
    outOfStock: [],
    expiringSoon: [],
    expired: []
  };
  
  const now = new Date();
  const threeMonthsFromNow = new Date();
  threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
  
  for (const [code, inventory] of MOCK_INVENTORY.medications) {
    // Check stock levels
    if (inventory.quantity === 0) {
      alerts.outOfStock.push({
        ...inventory,
        alertType: 'outOfStock',
        severity: 'critical'
      });
    } else if (inventory.quantity <= inventory.reorderPoint) {
      alerts.lowStock.push({
        ...inventory,
        alertType: 'lowStock',
        severity: 'warning',
        percentageRemaining: Math.round((inventory.quantity / inventory.reorderPoint) * 100)
      });
    }
    
    // Check expiration dates
    for (const lot of inventory.lotNumbers) {
      const expirationDate = new Date(lot.expirationDate);
      
      if (expirationDate <= now) {
        alerts.expired.push({
          ...inventory,
          lot,
          alertType: 'expired',
          severity: 'critical',
          daysExpired: Math.floor((now - expirationDate) / (1000 * 60 * 60 * 24))
        });
      } else if (expirationDate <= threeMonthsFromNow) {
        alerts.expiringSoon.push({
          ...inventory,
          lot,
          alertType: 'expiringSoon',
          severity: 'warning',
          daysUntilExpiration: Math.floor((expirationDate - now) / (1000 * 60 * 60 * 24))
        });
      }
    }
  }
  
  return alerts;
};

/**
 * Generate inventory report
 * @param {string} reportType - Type of report (summary, detailed, valuation)
 * @returns {Object} Report data
 */
export const generateInventoryReport = async (reportType = 'summary') => {
  const allInventory = await getAllInventory();
  
  const report = {
    generatedAt: new Date().toISOString(),
    reportType,
    totalItems: allInventory.length,
    totalUnits: 0,
    lowStockItems: 0,
    expiringItems: 0,
    controlledSubstances: 0
  };
  
  const threeMonthsFromNow = new Date();
  threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
  
  allInventory.forEach(item => {
    report.totalUnits += item.quantity;
    
    if (item.quantity <= item.reorderPoint) {
      report.lowStockItems++;
    }
    
    if (item.controlled) {
      report.controlledSubstances++;
    }
    
    const hasExpiringSoon = item.lotNumbers.some(lot => 
      new Date(lot.expirationDate) <= threeMonthsFromNow
    );
    if (hasExpiringSoon) {
      report.expiringItems++;
    }
  });
  
  if (reportType === 'detailed') {
    report.items = allInventory;
  }
  
  return report;
};

// Export all functions
export default {
  getInventoryLevel,
  getAllInventory,
  checkAvailability,
  deductInventory,
  addInventory,
  getInventoryAlerts,
  generateInventoryReport
};