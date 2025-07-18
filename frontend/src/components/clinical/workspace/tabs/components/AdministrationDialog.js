/**
 * Administration Dialog Component
 * Quick medication administration interface for pharmacy workflow
 * Part of Phase 2 Implementation: MedicationAdministration Integration
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Paper,
  Alert,
  AlertTitle,
  Chip,
  Stack,
  FormControlLabel,
  Checkbox,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Medication as MedicationIcon,
  CheckCircle as AdministerIcon,
  Cancel as MissedIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  LocalHospital as RouteIcon,
  Science as DoseIcon,
  AccessTime as TimeIcon,
  Notes as NotesIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { getMedicationName } from '../../../../../core/fhir/utils/medicationDisplayUtils';
import { useMedicationAdministrationValidation } from '../../../../../hooks/useMedicationAdministration';

const ADMINISTRATION_ROUTES = [
  { code: 'PO', display: 'Oral', system: 'http://snomed.info/sct' },
  { code: 'IV', display: 'Intravenous', system: 'http://snomed.info/sct' },
  { code: 'IM', display: 'Intramuscular', system: 'http://snomed.info/sct' },
  { code: 'SC', display: 'Subcutaneous', system: 'http://snomed.info/sct' },
  { code: 'SL', display: 'Sublingual', system: 'http://snomed.info/sct' },
  { code: 'TOP', display: 'Topical', system: 'http://snomed.info/sct' },
  { code: 'INH', display: 'Inhalation', system: 'http://snomed.info/sct' },
  { code: 'PR', display: 'Rectal', system: 'http://snomed.info/sct' }
];

const MISSED_DOSE_REASONS = [
  { code: 'patient-refusal', display: 'Patient Refusal' },
  { code: 'patient-unavailable', display: 'Patient Unavailable' },
  { code: 'medication-unavailable', display: 'Medication Unavailable' },
  { code: 'medical-precaution', display: 'Medical Precaution' },
  { code: 'contraindication', display: 'Contraindication' },
  { code: 'npo-status', display: 'NPO Status' },
  { code: 'other', display: 'Other' }
];

const AdministrationDialog = ({ 
  open, 
  onClose, 
  medicationRequest, 
  patientId,
  onAdminister,
  onMissedDose,
  mode = 'administer', // 'administer' or 'missed'
  currentUser = null 
}) => {
  const [administrationData, setAdministrationData] = useState({
    effectiveDateTime: '',
    route: '',
    dose: '',
    doseUnit: '',
    site: '',
    notes: '',
    witnessRequired: false,
    witness: '',
    patientResponse: '',
    deviceUsed: ''
  });

  const [missedDoseData, setMissedDoseData] = useState({
    reason: '',
    notes: '',
    alternativeAction: ''
  });

  const [administering, setAdministering] = useState(false);

  const { 
    validation, 
    loading: validationLoading 
  } = useMedicationAdministrationValidation(medicationRequest?.id, patientId);

  useEffect(() => {
    if (open && medicationRequest) {
      // Initialize with current time and default values from prescription
      const now = new Date();
      const dosageInstruction = medicationRequest.dosageInstruction?.[0];
      
      setAdministrationData({
        effectiveDateTime: now.toISOString().slice(0, 16),
        route: getDefaultRoute(dosageInstruction),
        dose: getDefaultDose(dosageInstruction),
        doseUnit: getDefaultDoseUnit(dosageInstruction),
        site: '',
        notes: '',
        witnessRequired: isHighRiskMedication(medicationRequest),
        witness: '',
        patientResponse: '',
        deviceUsed: ''
      });

      setMissedDoseData({
        reason: '',
        notes: '',
        alternativeAction: ''
      });
    }
  }, [open, medicationRequest]);

  const getDefaultRoute = (dosageInstruction) => {
    const routeCode = dosageInstruction?.route?.coding?.[0]?.code;
    return routeCode || 'PO';
  };

  const getDefaultDose = (dosageInstruction) => {
    const dose = dosageInstruction?.doseAndRate?.[0]?.doseQuantity?.value;
    return dose ? dose.toString() : '';
  };

  const getDefaultDoseUnit = (dosageInstruction) => {
    const unit = dosageInstruction?.doseAndRate?.[0]?.doseQuantity?.unit;
    return unit || 'tablet';
  };

  const isHighRiskMedication = (medicationRequest) => {
    // Check if medication is high-risk and requires witness
    const medicationName = getMedicationName(medicationRequest).toLowerCase();
    const highRiskMeds = ['insulin', 'warfarin', 'heparin', 'chemotherapy', 'narcotic'];
    return highRiskMeds.some(med => medicationName.includes(med));
  };

  const handleAdminister = async () => {
    if (!canAdminister()) return;

    setAdministering(true);
    try {
      const dosageInstruction = medicationRequest.dosageInstruction?.[0];
      
      const administrationRecord = {
        status: 'completed',
        medicationCodeableConcept: medicationRequest.medicationCodeableConcept,
        subject: { reference: `Patient/${patientId}` },
        effectiveDateTime: administrationData.effectiveDateTime,
        request: { reference: `MedicationRequest/${medicationRequest.id}` },
        performer: currentUser ? [{
          actor: {
            reference: `Practitioner/${currentUser.id}`,
            display: currentUser.name || 'Current User'
          }
        }] : [],
        dosage: {
          text: `${administrationData.dose} ${administrationData.doseUnit} ${ADMINISTRATION_ROUTES.find(r => r.code === administrationData.route)?.display}`,
          route: {
            coding: [{
              system: 'http://snomed.info/sct',
              code: administrationData.route,
              display: ADMINISTRATION_ROUTES.find(r => r.code === administrationData.route)?.display
            }]
          },
          dose: {
            value: parseFloat(administrationData.dose),
            unit: administrationData.doseUnit,
            system: 'http://unitsofmeasure.org'
          },
          site: administrationData.site ? {
            coding: [{
              system: 'http://snomed.info/sct',
              display: administrationData.site
            }]
          } : undefined
        },
        note: []
      };

      // Add notes
      if (administrationData.notes) {
        administrationRecord.note.push({
          text: `Administration notes: ${administrationData.notes}`,
          time: new Date().toISOString()
        });
      }

      if (administrationData.patientResponse) {
        administrationRecord.note.push({
          text: `Patient response: ${administrationData.patientResponse}`,
          time: new Date().toISOString()
        });
      }

      if (administrationData.witness) {
        administrationRecord.note.push({
          text: `Witnessed by: ${administrationData.witness}`,
          time: new Date().toISOString()
        });
      }

      // Add device information as extension
      if (administrationData.deviceUsed) {
        administrationRecord.extension = [{
          url: 'http://wintehr.com/fhir/StructureDefinition/administration-device',
          valueString: administrationData.deviceUsed
        }];
      }

      await onAdminister(administrationRecord);
      onClose();
    } catch (error) {
      // Error recording administration - user will need to retry
    } finally {
      setAdministering(false);
    }
  };

  const handleMissedDose = async () => {
    if (!missedDoseData.reason) return;

    setAdministering(true);
    try {
      const missedRecord = {
        status: 'not-done',
        statusReason: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/reason-medication-not-given',
            code: missedDoseData.reason,
            display: MISSED_DOSE_REASONS.find(r => r.code === missedDoseData.reason)?.display
          }]
        }],
        medicationCodeableConcept: medicationRequest.medicationCodeableConcept,
        subject: { reference: `Patient/${patientId}` },
        effectiveDateTime: new Date().toISOString(),
        request: { reference: `MedicationRequest/${medicationRequest.id}` },
        performer: currentUser ? [{
          actor: {
            reference: `Practitioner/${currentUser.id}`,
            display: currentUser.name || 'Current User'
          }
        }] : [],
        note: []
      };

      if (missedDoseData.notes) {
        missedRecord.note.push({
          text: `Missed dose notes: ${missedDoseData.notes}`,
          time: new Date().toISOString()
        });
      }

      if (missedDoseData.alternativeAction) {
        missedRecord.note.push({
          text: `Alternative action: ${missedDoseData.alternativeAction}`,
          time: new Date().toISOString()
        });
      }

      await onMissedDose(missedRecord);
      onClose();
    } catch (error) {
      // Error recording missed dose - user will need to retry
    } finally {
      setAdministering(false);
    }
  };

  const canAdminister = () => {
    if (mode === 'administer') {
      return administrationData.effectiveDateTime && 
             administrationData.route && 
             administrationData.dose &&
             (!administrationData.witnessRequired || administrationData.witness);
    } else {
      return missedDoseData.reason;
    }
  };

  if (!medicationRequest) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          {mode === 'administer' ? (
            <>
              <AdministerIcon color="success" />
              <Typography variant="h6">Record Medication Administration</Typography>
            </>
          ) : (
            <>
              <MissedIcon color="error" />
              <Typography variant="h6">Record Missed Dose</Typography>
            </>
          )}
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {/* Medication Information */}
          <Paper sx={{ p: 2, mb: 2 }} variant="outlined">
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              {getMedicationName(medicationRequest)}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Prescribed Dosage
                </Typography>
                <Typography variant="body2">
                  {medicationRequest.dosageInstruction?.[0]?.text || 'No dosage instructions'}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Prescribed By
                </Typography>
                <Typography variant="body2">
                  {medicationRequest.requester?.display || 'Unknown Provider'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Validation Issues */}
          {validation && !validation.valid && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <AlertTitle>Administration Issues Detected</AlertTitle>
              <List dense>
                {validation.issues.map((issue, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <WarningIcon color="error" />
                    </ListItemIcon>
                    <ListItemText primary={issue} />
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}

          {validation && validation.warnings.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <AlertTitle>Warnings</AlertTitle>
              <List dense>
                {validation.warnings.map((warning, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <InfoIcon color="warning" />
                    </ListItemIcon>
                    <ListItemText primary={warning} />
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}

          {mode === 'administer' ? (
            /* Administration Form */
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Administration Time"
                  type="datetime-local"
                  value={administrationData.effectiveDateTime}
                  onChange={(e) => setAdministrationData(prev => ({ 
                    ...prev, 
                    effectiveDateTime: e.target.value 
                  }))}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Route of Administration</InputLabel>
                  <Select
                    value={administrationData.route}
                    onChange={(e) => setAdministrationData(prev => ({ 
                      ...prev, 
                      route: e.target.value 
                    }))}
                    label="Route of Administration"
                  >
                    {ADMINISTRATION_ROUTES.map(route => (
                      <MenuItem key={route.code} value={route.code}>
                        {route.display} ({route.code})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Dose Administered"
                  type="number"
                  value={administrationData.dose}
                  onChange={(e) => setAdministrationData(prev => ({ 
                    ...prev, 
                    dose: e.target.value 
                  }))}
                  required
                  inputProps={{ step: 'any', min: 0 }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Dose Unit"
                  value={administrationData.doseUnit}
                  onChange={(e) => setAdministrationData(prev => ({ 
                    ...prev, 
                    doseUnit: e.target.value 
                  }))}
                  placeholder="tablet, mg, mL, etc."
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Administration Site (if applicable)"
                  value={administrationData.site}
                  onChange={(e) => setAdministrationData(prev => ({ 
                    ...prev, 
                    site: e.target.value 
                  }))}
                  placeholder="Left arm, abdomen, etc."
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Device Used (if applicable)"
                  value={administrationData.deviceUsed}
                  onChange={(e) => setAdministrationData(prev => ({ 
                    ...prev, 
                    deviceUsed: e.target.value 
                  }))}
                  placeholder="Insulin pen, nebulizer, etc."
                />
              </Grid>

              {administrationData.witnessRequired && (
                <Grid item xs={12}>
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <AlertTitle>Witness Required</AlertTitle>
                    This medication requires a witness for administration.
                  </Alert>
                  <TextField
                    fullWidth
                    label="Witness Name"
                    value={administrationData.witness}
                    onChange={(e) => setAdministrationData(prev => ({ 
                      ...prev, 
                      witness: e.target.value 
                    }))}
                    required
                    placeholder="Name of witnessing staff member"
                  />
                </Grid>
              )}

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Patient Response"
                  multiline
                  rows={2}
                  value={administrationData.patientResponse}
                  onChange={(e) => setAdministrationData(prev => ({ 
                    ...prev, 
                    patientResponse: e.target.value 
                  }))}
                  placeholder="Patient's response to administration, any immediate effects..."
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Administration Notes"
                  multiline
                  rows={3}
                  value={administrationData.notes}
                  onChange={(e) => setAdministrationData(prev => ({ 
                    ...prev, 
                    notes: e.target.value 
                  }))}
                  placeholder="Any additional notes about the administration..."
                />
              </Grid>
            </Grid>
          ) : (
            /* Missed Dose Form */
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel>Reason for Missed Dose</InputLabel>
                  <Select
                    value={missedDoseData.reason}
                    onChange={(e) => setMissedDoseData(prev => ({ 
                      ...prev, 
                      reason: e.target.value 
                    }))}
                    label="Reason for Missed Dose"
                  >
                    {MISSED_DOSE_REASONS.map(reason => (
                      <MenuItem key={reason.code} value={reason.code}>
                        {reason.display}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Alternative Action Taken"
                  value={missedDoseData.alternativeAction}
                  onChange={(e) => setMissedDoseData(prev => ({ 
                    ...prev, 
                    alternativeAction: e.target.value 
                  }))}
                  placeholder="Rescheduled for later, contacted physician, etc."
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Additional Notes"
                  multiline
                  rows={4}
                  value={missedDoseData.notes}
                  onChange={(e) => setMissedDoseData(prev => ({ 
                    ...prev, 
                    notes: e.target.value 
                  }))}
                  placeholder="Additional details about the missed dose..."
                />
              </Grid>
            </Grid>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={administering}>
          Cancel
        </Button>
        
        {mode === 'administer' ? (
          <Button
            onClick={handleAdminister}
            variant="contained"
            color="success"
            disabled={!canAdminister() || administering}
            startIcon={<AdministerIcon />}
          >
            {administering ? 'Recording...' : 'Record Administration'}
          </Button>
        ) : (
          <Button
            onClick={handleMissedDose}
            variant="contained"
            color="error"
            disabled={!canAdminister() || administering}
            startIcon={<MissedIcon />}
          >
            {administering ? 'Recording...' : 'Record Missed Dose'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AdministrationDialog;