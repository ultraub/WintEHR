/**
 * Medications Section Component
 * Displays and manages patient's medication list
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  Button,
  Menu,
  MenuItem,
  useTheme,
  alpha
} from '@mui/material';
import {
  Medication as MedicationIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  Search as SearchIcon,
  GetApp as ExportIcon,
  Sync as ReconcileIcon,
  LocalPharmacy as PharmacyIcon,
  Cancel as DiscontinueIcon,
  Autorenew as RefillIcon,
  Assessment as EffectivenessIcon,
  Security as SafetyIcon
} from '@mui/icons-material';
import { ClinicalResourceCard } from '../../shared/cards';
import { ClinicalDataList } from '../../shared/tables';
import { useTabFilters, useTabSearch, useExportData } from '../../../../hooks/clinical';
import {
  getStatusColor,
  formatDate
} from '../../../../utils/clinicalHelpers';
import { 
  getMedicationStatus, 
  isMedicationActive, 
  FHIR_STATUS_VALUES 
} from '../../../../core/fhir/utils/fhirFieldUtils';
import {
  getMedicationName,
  getMedicationDosageDisplay,
  getMedicationSpecialInstructions
} from '../../../../core/fhir/utils/medicationDisplayUtils';

const MedicationsSection = ({
  medications = [],
  loading = false,
  error = null,
  patient,
  onAdd,
  onEdit,
  onHistory,
  onReconcile,
  onDiscontinue,
  onRefill,
  onEffectiveness,
  onSafety,
  department
}) => {
  const theme = useTheme();
  const [exportAnchor, setExportAnchor] = useState(null);
  
  // Use clinical hooks
  const {
    filters,
    setFilters
  } = useTabFilters({
    status: 'active'
  });
  
  const {
    searchTerm,
    setSearchTerm,
    searchItems
  } = useTabSearch(['medicationCodeableConcept.text', 'medicationReference.display']);
  
  const {
    exportToCSV,
    exportToJSON,
    exportToPDF,
    exporting
  } = useExportData();
  
  // Filter medications
  const filteredMedications = useMemo(() => {
    let result = medications;
    
    // Apply search
    if (searchTerm) {
      result = searchItems(result);
    }
    
    // Apply status filter
    if (filters.status !== 'all') {
      result = result.filter(med => {
        const status = getMedicationStatus(med);
        if (filters.status === 'active') return isMedicationActive(med);
        if (filters.status === 'stopped') return status === FHIR_STATUS_VALUES.MEDICATION_REQUEST.STOPPED;
        if (filters.status === 'completed') return status === FHIR_STATUS_VALUES.MEDICATION_REQUEST.COMPLETED;
        return false;
      });
    }
    
    // Sort by date (most recent first)
    result.sort((a, b) => {
      const dateA = new Date(a.authoredOn || 0);
      const dateB = new Date(b.authoredOn || 0);
      return dateB - dateA;
    });
    
    return result;
  }, [medications, searchTerm, filters, searchItems]);
  
  // Count statistics
  const activeCount = medications.filter(m => isMedicationActive(m)).length;
  const inactiveCount = medications.length - activeCount;
  
  // Handle export
  const handleExport = async (format) => {
    const exportFunctions = {
      csv: () => exportToCSV(
        filteredMedications,
        `medications_${patient?.id}_${new Date().toISOString().split('T')[0]}`,
        [
          { key: 'medicationCodeableConcept.text', label: 'Medication' },
          { key: 'status', label: 'Status' },
          { key: 'dosageInstruction[0].text', label: 'Dosage' },
          { key: 'authoredOn', label: 'Prescribed Date', format: 'date' },
          { key: 'requester.display', label: 'Prescriber' },
          { key: 'dispenseRequest.numberOfRepeatsAllowed', label: 'Refills' }
        ]
      ),
      json: () => exportToJSON(
        filteredMedications,
        `medications_${patient?.id}_${new Date().toISOString().split('T')[0]}`
      ),
      pdf: () => exportToPDF(
        filteredMedications,
        `medications_${patient?.id}_${new Date().toISOString().split('T')[0]}`,
        'Medication List',
        [
          { key: 'medicationCodeableConcept.text', label: 'Medication' },
          { key: 'status', label: 'Status' },
          { key: 'dosageInstruction[0].text', label: 'Dosage' },
          { key: 'authoredOn', label: 'Prescribed Date', format: 'date' }
        ]
      )
    };
    
    await exportFunctions[format]();
    setExportAnchor(null);
  };
  
  return (
    <ClinicalResourceCard
      title="Medications"
      icon={<MedicationIcon />}
      department={department}
      variant="clinical"
      expandable={false}
      subtitle={
        <Stack direction="row" spacing={1}>
          <Chip 
            label={`${activeCount} Active`} 
            size="small" 
            color="primary" 
            variant={filters.status === 'active' ? 'filled' : 'outlined'}
            onClick={() => setFilters({ ...filters, status: 'active' })}
          />
          <Chip 
            label={`${inactiveCount} Inactive`} 
            size="small" 
            variant={filters.status === 'inactive' ? 'filled' : 'outlined'}
            onClick={() => setFilters({ ...filters, status: 'inactive' })}
          />
          <Chip 
            label="All" 
            size="small" 
            variant={filters.status === 'all' ? 'filled' : 'outlined'}
            onClick={() => setFilters({ ...filters, status: 'all' })}
          />
        </Stack>
      }
      actions={
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Medication Reconciliation">
            <IconButton size="small" onClick={onReconcile}>
              <ReconcileIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export Medications">
            <IconButton 
              size="small" 
              onClick={(e) => setExportAnchor(e.currentTarget)}
              disabled={exporting}
            >
              <ExportIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      }
    >
      {/* Search Bar */}
      <TextField
        fullWidth
        placeholder="Search medications..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        size="small"
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          )
        }}
      />
      
      {/* Medications List */}
      <ClinicalDataList
        items={filteredMedications}
        loading={loading}
        error={error}
        emptyStateProps={{
          dataType: 'medication',
          action: onAdd,
          searchTerm: searchTerm
        }}
        getItemId={(medication) => medication.id}
        getItemPrimary={(medication) => getMedicationName(medication)}
        getItemSecondary={(medication) => {
          const parts = [];
          const dosage = getMedicationDosageDisplay(medication);
          if (dosage) parts.push(dosage);
          
          const instructions = getMedicationSpecialInstructions(medication);
          if (instructions) parts.push(instructions);
          
          if (medication.authoredOn) {
            parts.push(`Prescribed: ${formatDate(medication.authoredOn)}`);
          }
          
          return parts.join(' • ');
        }}
        getItemIcon={(medication) => (
          <MedicationIcon color={isMedicationActive(medication) ? 'primary' : 'action'} />
        )}
        getItemStatus={(medication) => getMedicationStatus(medication)}
        getItemChips={(medication) => {
          const chips = [];
          
          // Pharmacy chip
          if (medication.dispenseRequest?.performer?.display) {
            chips.push({
              label: medication.dispenseRequest.performer.display,
              size: 'small',
              icon: <PharmacyIcon />,
              variant: 'outlined'
            });
          }
          
          // Refills chip
          const refills = medication.dispenseRequest?.numberOfRepeatsAllowed;
          if (refills !== undefined) {
            chips.push({
              label: `${refills} refills`,
              size: 'small',
              variant: 'outlined'
            });
          }
          
          return chips;
        }}
        onItemClick={onEdit}
        onItemEdit={onEdit}
        onItemHistory={onHistory}
        expandable={true}
        renderExpandedContent={(medication) => (
          <Stack spacing={1} sx={{ pl: 2, pt: 1 }}>
            {/* Action buttons for active medications */}
            {isMedicationActive(medication) && (
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<RefillIcon />}
                  onClick={() => onRefill(medication)}
                >
                  Refill
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<DiscontinueIcon />}
                  onClick={() => onDiscontinue(medication)}
                >
                  Discontinue
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<EffectivenessIcon />}
                  onClick={() => onEffectiveness(medication)}
                >
                  Effectiveness
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<SafetyIcon />}
                  onClick={() => onSafety(medication)}
                >
                  Safety Check
                </Button>
              </Stack>
            )}
            
            {/* Additional details */}
            {medication.note?.map((note, index) => (
              <Typography key={`note-${note.text?.substring(0, 20) || ''}-${index}`} variant="body2" color="text.secondary">
                Note: {note.text}
              </Typography>
            ))}
            
            {medication.reasonCode?.map((reason, index) => (
              <Typography key={`reason-${(reason.text || reason.coding?.[0]?.display || '').substring(0, 20)}-${index}`} variant="body2" color="text.secondary">
                Indication: {reason.text || reason.coding?.[0]?.display}
              </Typography>
            ))}
          </Stack>
        )}
      />
      
      {/* Export Menu */}
      <Menu
        anchorEl={exportAnchor}
        open={Boolean(exportAnchor)}
        onClose={() => setExportAnchor(null)}
      >
        <MenuItem onClick={() => handleExport('csv')}>Export as CSV</MenuItem>
        <MenuItem onClick={() => handleExport('json')}>Export as JSON</MenuItem>
        <MenuItem onClick={() => handleExport('pdf')}>Export as PDF</MenuItem>
      </Menu>
    </ClinicalResourceCard>
  );
};

export default MedicationsSection;