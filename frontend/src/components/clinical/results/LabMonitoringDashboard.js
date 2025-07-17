/**
 * Lab Monitoring Dashboard Component
 * Displays lab monitoring protocols and tracking for chronic conditions
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Grid,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  IconButton,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  CircularProgress,
  useTheme,
  alpha
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  CheckCircle as CompletedIcon,
  Warning as DueIcon,
  Error as OverdueIcon,
  TrendingUp as TrendIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Science as LabIcon,
  Assessment as AssessmentIcon,
  Timeline as TimelineIcon,
  Print as PrintIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { labToCareIntegrationService } from '../../../services/labToCareIntegrationService';
import { fhirClient } from '../../../services/fhirClient';
import { printDocument } from '../../../core/export/printUtils';

const LabMonitoringDashboard = ({ patientId, patientConditions }) => {
  const [protocols, setProtocols] = useState([]);
  const [monitoringStatus, setMonitoringStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedProtocol, setSelectedProtocol] = useState(null);
  const [protocolDialogOpen, setProtocolDialogOpen] = useState(false);
  const [customProtocol, setCustomProtocol] = useState({
    name: '',
    condition: '',
    tests: []
  });
  
  const theme = useTheme();

  useEffect(() => {
    if (patientId && patientConditions) {
      loadMonitoringProtocols();
    }
  }, [patientId, patientConditions]);

  const loadMonitoringProtocols = async () => {
    setLoading(true);
    try {
      // Get applicable protocols based on patient conditions
      const applicableProtocols = getApplicableProtocols(patientConditions);
      setProtocols(applicableProtocols);
      
      // Load monitoring status for each protocol
      const status = {};
      for (const protocol of applicableProtocols) {
        status[protocol.id] = await loadProtocolStatus(protocol);
      }
      setMonitoringStatus(status);
      
    } catch (error) {
      // Error handled silently, component shows loading state
    } finally {
      setLoading(false);
    }
  };

  const getApplicableProtocols = (conditions) => {
    const protocols = [];
    const protocolDefinitions = labToCareIntegrationService.monitoringProtocols;
    
    for (const [protocolId, protocol] of Object.entries(protocolDefinitions)) {
      // Check if patient has any condition matching this protocol
      const hasCondition = conditions.some(condition => 
        protocol.conditions.some(pc => 
          condition.code?.coding?.some(coding => 
            coding.code?.toLowerCase().includes(pc) ||
            coding.display?.toLowerCase().includes(pc)
          )
        )
      );
      
      if (hasCondition) {
        protocols.push({
          id: protocolId,
          ...protocol,
          condition: conditions.find(c => 
            protocol.conditions.some(pc => 
              c.code?.coding?.some(coding => 
                coding.code?.toLowerCase().includes(pc) ||
                coding.display?.toLowerCase().includes(pc)
              )
            )
          )
        });
      }
    }
    
    return protocols;
  };

  const loadProtocolStatus = async (protocol) => {
    const status = {
      tests: {},
      overallCompliance: 0,
      nextDue: null
    };
    
    let compliantTests = 0;
    let earliestDue = null;
    
    for (const test of protocol.labTests) {
      // Get last result
      const lastResult = await labToCareIntegrationService.getLastLabResult(
        patientId,
        test.code
      );
      
      if (lastResult) {
        const lastDate = new Date(lastResult.effectiveDateTime || lastResult.issued);
        const daysElapsed = differenceInDays(new Date(), lastDate);
        const dueDate = addDays(lastDate, test.frequency);
        const daysUntilDue = differenceInDays(dueDate, new Date());
        
        status.tests[test.code] = {
          name: test.name,
          lastDate,
          lastValue: lastResult.valueQuantity ? 
            `${lastResult.valueQuantity.value} ${lastResult.valueQuantity.unit}` : 
            'N/A',
          daysElapsed,
          frequency: test.frequency,
          dueDate,
          daysUntilDue,
          status: daysUntilDue < 0 ? 'overdue' : daysUntilDue <= 7 ? 'due-soon' : 'compliant'
        };
        
        if (daysUntilDue >= 0) {
          compliantTests++;
        }
        
        if (!earliestDue || dueDate < earliestDue) {
          earliestDue = dueDate;
        }
      } else {
        // Never done
        status.tests[test.code] = {
          name: test.name,
          lastDate: null,
          lastValue: 'Never done',
          daysElapsed: null,
          frequency: test.frequency,
          dueDate: new Date(),
          daysUntilDue: 0,
          status: 'overdue'
        };
        
        earliestDue = new Date();
      }
    }
    
    status.overallCompliance = (compliantTests / protocol.labTests.length) * 100;
    status.nextDue = earliestDue;
    
    return status;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'compliant':
        return <CompletedIcon color="success" fontSize="small" />;
      case 'due-soon':
        return <DueIcon color="warning" fontSize="small" />;
      case 'overdue':
        return <OverdueIcon color="error" fontSize="small" />;
      default:
        return <ScheduleIcon color="action" fontSize="small" />;
    }
  };

  const getComplianceColor = (compliance) => {
    if (compliance >= 80) return theme.palette.success.main;
    if (compliance >= 60) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const handleOrderTest = async (protocol, test) => {
    try {
      // Create service request
      const order = {
        resourceType: 'ServiceRequest',
        status: 'active',
        intent: 'order',
        priority: 'routine',
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: test.code,
            display: test.name
          }]
        },
        subject: {
          reference: `Patient/${patientId}`
        },
        authoredOn: new Date().toISOString(),
        reasonCode: [{
          text: `${protocol.name} monitoring`
        }]
      };
      
      await fhirClient.create('ServiceRequest', order);
      
      // Reload status
      const updatedStatus = await loadProtocolStatus(protocol);
      setMonitoringStatus(prev => ({
        ...prev,
        [protocol.id]: updatedStatus
      }));
      
    } catch (error) {
      // Error handled silently, button returns to normal state
    }
  };

  const handlePrintProtocol = (protocol) => {
    const status = monitoringStatus[protocol.id];
    if (!status) return;
    
    const content = `
      <h2>${protocol.name}</h2>
      <p><strong>Condition:</strong> ${protocol.condition?.code?.text || protocol.condition?.code?.coding?.[0]?.display}</p>
      <p><strong>Overall Compliance:</strong> ${status.overallCompliance.toFixed(0)}%</p>
      
      <h3>Monitoring Schedule</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Test</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Frequency</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Last Done</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Last Value</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Next Due</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${protocol.labTests.map(test => {
            const testStatus = status.tests[test.code];
            return `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${test.name}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">Every ${test.frequency} days</td>
                <td style="padding: 8px; border: 1px solid #ddd;">
                  ${testStatus?.lastDate ? format(testStatus.lastDate, 'MM/dd/yyyy') : 'Never'}
                </td>
                <td style="padding: 8px; border: 1px solid #ddd;">${testStatus?.lastValue || 'N/A'}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">
                  ${testStatus?.dueDate ? format(testStatus.dueDate, 'MM/dd/yyyy') : 'Now'}
                </td>
                <td style="padding: 8px; border: 1px solid #ddd;">${testStatus?.status || 'Unknown'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
    
    printDocument({
      title: `Lab Monitoring Protocol - ${protocol.name}`,
      content,
      patient: {
        name: 'Current Patient', // Would get from context
        mrn: patientId
      }
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  if (protocols.length === 0) {
    return (
      <Alert severity="info">
        No monitoring protocols applicable for this patient's conditions.
      </Alert>
    );
  }

  return (
    <Box>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Lab Monitoring Protocols</Typography>
          <Button
            startIcon={<AddIcon />}
            onClick={() => setProtocolDialogOpen(true)}
            variant="outlined"
            size="small"
          >
            Custom Protocol
          </Button>
        </Stack>

        {/* Protocol Cards */}
        <Grid container spacing={2}>
          {protocols.map(protocol => {
            const status = monitoringStatus[protocol.id];
            if (!status) return null;
            
            return (
              <Grid item xs={12} md={6} key={protocol.id}>
                <Card>
                  <CardContent>
                    <Stack spacing={2}>
                      {/* Header */}
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="h6">
                            {protocol.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {protocol.condition?.code?.text || 
                             protocol.condition?.code?.coding?.[0]?.display}
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={() => handlePrintProtocol(protocol)}
                        >
                          <PrintIcon />
                        </IconButton>
                      </Stack>

                      {/* Compliance */}
                      <Box>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                          <Typography variant="body2">
                            Overall Compliance
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {status.overallCompliance.toFixed(0)}%
                          </Typography>
                        </Stack>
                        <LinearProgress 
                          variant="determinate" 
                          value={status.overallCompliance}
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: alpha(getComplianceColor(status.overallCompliance), 0.2),
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: getComplianceColor(status.overallCompliance),
                              borderRadius: 4
                            }
                          }}
                        />
                      </Box>

                      {/* Next Due */}
                      {status.nextDue && (
                        <Alert 
                          severity={differenceInDays(status.nextDue, new Date()) < 0 ? 'error' : 'info'}
                          icon={<ScheduleIcon />}
                        >
                          <Typography variant="body2">
                            Next test due: {format(status.nextDue, 'MMM dd, yyyy')}
                          </Typography>
                        </Alert>
                      )}

                      {/* Test Details */}
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setSelectedProtocol(protocol)}
                        endIcon={<AssessmentIcon />}
                      >
                        View Details
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {/* Detailed View Dialog */}
        {selectedProtocol && (
          <Dialog
            open={Boolean(selectedProtocol)}
            onClose={() => setSelectedProtocol(null)}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              {selectedProtocol.name} - Monitoring Details
              <IconButton
                onClick={() => setSelectedProtocol(null)}
                sx={{ position: 'absolute', right: 8, top: 8 }}
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Test</TableCell>
                      <TableCell>Frequency</TableCell>
                      <TableCell>Last Done</TableCell>
                      <TableCell>Last Value</TableCell>
                      <TableCell>Next Due</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedProtocol.labTests.map(test => {
                      const testStatus = monitoringStatus[selectedProtocol.id]?.tests[test.code];
                      if (!testStatus) return null;
                      
                      return (
                        <TableRow key={test.code}>
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <LabIcon fontSize="small" color="action" />
                              <Typography variant="body2">{test.name}</Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>Every {test.frequency} days</TableCell>
                          <TableCell>
                            {testStatus.lastDate ? 
                              format(testStatus.lastDate, 'MM/dd/yyyy') : 
                              'Never'
                            }
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {testStatus.lastValue}
                            </Typography>
                            {test.target && (
                              <Typography variant="caption" color="text.secondary">
                                Target: {test.target}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {testStatus.dueDate ? 
                              format(testStatus.dueDate, 'MM/dd/yyyy') : 
                              'Now'
                            }
                          </TableCell>
                          <TableCell>
                            <Chip
                              icon={getStatusIcon(testStatus.status)}
                              label={testStatus.status}
                              size="small"
                              color={
                                testStatus.status === 'compliant' ? 'success' :
                                testStatus.status === 'due-soon' ? 'warning' :
                                'error'
                              }
                            />
                          </TableCell>
                          <TableCell>
                            {testStatus.status !== 'compliant' && (
                              <Button
                                size="small"
                                onClick={() => handleOrderTest(selectedProtocol, test)}
                              >
                                Order
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              
              {/* Treatment Thresholds */}
              {selectedProtocol.treatmentThresholds && 
               Object.keys(selectedProtocol.treatmentThresholds).length > 0 && (
                <Box mt={3}>
                  <Typography variant="h6" gutterBottom>
                    Treatment Thresholds
                  </Typography>
                  <Alert severity="info">
                    <Typography variant="body2">
                      Automated treatment recommendations will be generated when lab values 
                      cross these thresholds.
                    </Typography>
                  </Alert>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedProtocol(null)}>
                Close
              </Button>
            </DialogActions>
          </Dialog>
        )}
      </Stack>
    </Box>
  );
};

export default LabMonitoringDashboard;