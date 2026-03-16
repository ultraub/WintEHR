/**
 * SMART Demo App - Built-in Patient Summary Viewer
 *
 * A simple SMART app that demonstrates the complete OAuth flow
 * and displays patient clinical data. This serves as both a
 * functional app and an educational example.
 *
 * Educational Purpose:
 * - Shows how SMART apps receive patient context
 * - Demonstrates FHIR resource fetching with tokens
 * - Displays the OAuth flow step-by-step
 *
 * @module SMARTDemoApp
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  CircularProgress,
  Alert,
  AlertTitle,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent
} from '@mui/material';
import {
  Person as PatientIcon,
  LocalHospital as ConditionIcon,
  Medication as MedicationIcon,
  Warning as AllergyIcon,
  Science as LabIcon,
  ExpandMore as ExpandMoreIcon,
  Security as SecurityIcon,
  Code as CodeIcon,
  CheckCircle as SuccessIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

// =============================================================================
// OAuth Flow Steps (Educational)
// =============================================================================

const OAUTH_STEPS = [
  {
    label: 'App Launch',
    description: 'EHR initiates launch with patient context'
  },
  {
    label: 'Authorization Request',
    description: 'App requests authorization with required scopes'
  },
  {
    label: 'User Consent',
    description: 'User reviews and approves requested permissions'
  },
  {
    label: 'Authorization Code',
    description: 'Server returns authorization code to app'
  },
  {
    label: 'Token Exchange',
    description: 'App exchanges code for access token'
  },
  {
    label: 'FHIR Access',
    description: 'App uses token to access patient data'
  }
];

// =============================================================================
// Main Component
// =============================================================================

const SMARTDemoApp = () => {
  const [searchParams] = useSearchParams();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [conditions, setConditions] = useState([]);
  const [medications, setMedications] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [observations, setObservations] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [showRawData, setShowRawData] = useState(false);

  // Parse token from URL (in real app, this comes from token exchange)
  const accessToken = searchParams.get('access_token');
  const patientId = searchParams.get('patient');
  const scope = searchParams.get('scope');

  // Simulated mode for demo without real OAuth
  const isSimulated = !accessToken && patientId;

  useEffect(() => {
    const loadPatientData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Simulate OAuth flow progression
        for (let i = 0; i <= 5; i++) {
          setCurrentStep(i);
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Build headers (with or without token)
        const headers = {
          'Content-Type': 'application/json'
        };
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }

        // Determine patient ID to use
        const pid = patientId || 'demo-patient';

        // Fetch patient demographics
        const patientResponse = await fetch(`/api/fhir/Patient/${pid}`, { headers });
        if (patientResponse.ok) {
          const patient = await patientResponse.json();
          setPatientData(patient);
        }

        // Fetch conditions
        const conditionsResponse = await fetch(
          `/api/fhir/Condition?patient=Patient/${pid}&_count=20`,
          { headers }
        );
        if (conditionsResponse.ok) {
          const bundle = await conditionsResponse.json();
          setConditions(bundle.entry?.map(e => e.resource) || []);
        }

        // Fetch medications
        const medsResponse = await fetch(
          `/api/fhir/MedicationRequest?patient=Patient/${pid}&_count=20`,
          { headers }
        );
        if (medsResponse.ok) {
          const bundle = await medsResponse.json();
          setMedications(bundle.entry?.map(e => e.resource) || []);
        }

        // Fetch allergies
        const allergiesResponse = await fetch(
          `/api/fhir/AllergyIntolerance?patient=Patient/${pid}&_count=20`,
          { headers }
        );
        if (allergiesResponse.ok) {
          const bundle = await allergiesResponse.json();
          setAllergies(bundle.entry?.map(e => e.resource) || []);
        }

        // Fetch recent observations
        const obsResponse = await fetch(
          `/api/fhir/Observation?patient=Patient/${pid}&_sort=-date&_count=10`,
          { headers }
        );
        if (obsResponse.ok) {
          const bundle = await obsResponse.json();
          setObservations(bundle.entry?.map(e => e.resource) || []);
        }

        // Store token info if available
        if (accessToken) {
          // Decode JWT payload for display (educational)
          try {
            const parts = accessToken.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(atob(parts[1]));
              setTokenInfo(payload);
            }
          } catch {
            // Token is opaque, not JWT
          }
        }

      } catch (err) {
        console.error('Failed to load patient data:', err);
        setError('Failed to load patient data. This may be a demo without real data.');
      } finally {
        setLoading(false);
      }
    };

    loadPatientData();
  }, [accessToken, patientId]);

  // Extract patient name
  const patientName = useMemo(() => {
    if (!patientData?.name?.[0]) return 'Unknown Patient';
    const name = patientData.name[0];
    return `${name.given?.join(' ') || ''} ${name.family || ''}`.trim();
  }, [patientData]);

  // Loading state
  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper sx={{ p: 4, borderRadius: 0 }}>
          <Typography variant="h5" gutterBottom>
            <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            SMART App Authorization
          </Typography>

          <Stepper activeStep={currentStep} orientation="vertical" sx={{ mt: 3 }}>
            {OAUTH_STEPS.map((step, index) => (
              <Step key={step.label}>
                <StepLabel>{step.label}</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary">
                    {step.description}
                  </Typography>
                  {index === currentStep && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                      <CircularProgress size={16} sx={{ mr: 1 }} />
                      <Typography variant="caption">Processing...</Typography>
                    </Box>
                  )}
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </Paper>
      </Container>
    );
  }

  // Error state
  if (error && !patientData) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="warning" sx={{ borderRadius: 0 }}>
          <AlertTitle>Demo Mode</AlertTitle>
          {error}
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2">
              This SMART Demo App demonstrates how apps receive and display patient data.
              Launch it from the SMART Apps menu in the Clinical Workspace to see real data.
            </Typography>
          </Box>
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <PatientIcon sx={{ fontSize: 48, color: 'primary.main' }} />
            <Box>
              <Typography variant="h4" fontWeight={600}>
                {patientName}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                {patientData?.gender && (
                  <Chip label={patientData.gender} size="small" variant="outlined" />
                )}
                {patientData?.birthDate && (
                  <Chip label={`DOB: ${patientData.birthDate}`} size="small" variant="outlined" />
                )}
                {isSimulated && (
                  <Chip label="Demo Mode" size="small" color="warning" />
                )}
              </Box>
            </Box>
          </Box>

          <Box>
            <Tooltip title="Show raw FHIR data">
              <IconButton onClick={() => setShowRawData(!showRawData)}>
                <CodeIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh data">
              <IconButton onClick={() => window.location.reload()}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Token Info (Educational) */}
        {tokenInfo && (
          <Accordion sx={{ mt: 2, borderRadius: 0 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SecurityIcon fontSize="small" color="success" />
                <Typography variant="subtitle2">
                  Access Token Information (Educational)
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    Subject (User)
                  </Typography>
                  <Typography variant="body2">{tokenInfo.sub || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    Client ID
                  </Typography>
                  <Typography variant="body2">{tokenInfo.client_id || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    Patient Context
                  </Typography>
                  <Typography variant="body2">{tokenInfo.patient || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    Expires
                  </Typography>
                  <Typography variant="body2">
                    {tokenInfo.exp
                      ? new Date(tokenInfo.exp * 1000).toLocaleString()
                      : 'N/A'
                    }
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Granted Scopes
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    {(tokenInfo.scope || scope || '').split(' ').map((s, i) => (
                      <Chip key={i} label={s} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        )}
      </Paper>

      {/* Clinical Data Grid */}
      <Grid container spacing={3}>
        {/* Conditions */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 0, height: '100%' }}>
            <CardHeader
              avatar={<ConditionIcon color="error" />}
              title="Conditions"
              subheader={`${conditions.length} active conditions`}
              sx={{ pb: 0 }}
            />
            <CardContent>
              <List dense>
                {conditions.slice(0, 5).map((condition, index) => (
                  <ListItem key={condition.id || index}>
                    <ListItemText
                      primary={condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown'}
                      secondary={condition.clinicalStatus?.coding?.[0]?.code || 'unknown status'}
                    />
                  </ListItem>
                ))}
                {conditions.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary="No conditions found"
                      secondary="Patient has no recorded conditions"
                    />
                  </ListItem>
                )}
                {conditions.length > 5 && (
                  <ListItem>
                    <ListItemText
                      secondary={`+ ${conditions.length - 5} more conditions`}
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Medications */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 0, height: '100%' }}>
            <CardHeader
              avatar={<MedicationIcon color="primary" />}
              title="Medications"
              subheader={`${medications.length} current medications`}
              sx={{ pb: 0 }}
            />
            <CardContent>
              <List dense>
                {medications.slice(0, 5).map((med, index) => (
                  <ListItem key={med.id || index}>
                    <ListItemText
                      primary={
                        med.medicationCodeableConcept?.text ||
                        med.medicationCodeableConcept?.coding?.[0]?.display ||
                        'Unknown medication'
                      }
                      secondary={med.status || 'unknown status'}
                    />
                  </ListItem>
                ))}
                {medications.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary="No medications found"
                      secondary="Patient has no recorded medications"
                    />
                  </ListItem>
                )}
                {medications.length > 5 && (
                  <ListItem>
                    <ListItemText
                      secondary={`+ ${medications.length - 5} more medications`}
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Allergies */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 0, height: '100%' }}>
            <CardHeader
              avatar={<AllergyIcon color="warning" />}
              title="Allergies"
              subheader={`${allergies.length} known allergies`}
              sx={{ pb: 0 }}
            />
            <CardContent>
              <List dense>
                {allergies.slice(0, 5).map((allergy, index) => (
                  <ListItem key={allergy.id || index}>
                    <ListItemText
                      primary={
                        allergy.code?.text ||
                        allergy.code?.coding?.[0]?.display ||
                        'Unknown allergen'
                      }
                      secondary={
                        allergy.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display ||
                        'Unknown reaction'
                      }
                    />
                  </ListItem>
                ))}
                {allergies.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary="No allergies recorded"
                      secondary="NKDA - No Known Drug Allergies"
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Observations */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 0, height: '100%' }}>
            <CardHeader
              avatar={<LabIcon color="info" />}
              title="Recent Observations"
              subheader={`${observations.length} recent results`}
              sx={{ pb: 0 }}
            />
            <CardContent>
              <List dense>
                {observations.slice(0, 5).map((obs, index) => (
                  <ListItem key={obs.id || index}>
                    <ListItemText
                      primary={obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown'}
                      secondary={
                        obs.valueQuantity
                          ? `${obs.valueQuantity.value} ${obs.valueQuantity.unit || ''}`
                          : obs.valueCodeableConcept?.text || 'No value'
                      }
                    />
                  </ListItem>
                ))}
                {observations.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary="No observations found"
                      secondary="No recent lab results or vitals"
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Raw Data View (Educational) */}
      {showRawData && (
        <Paper sx={{ mt: 3, p: 2, borderRadius: 0 }}>
          <Typography variant="h6" gutterBottom>
            <CodeIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Raw FHIR Data (Educational)
          </Typography>
          <Box
            component="pre"
            sx={{
              bgcolor: 'grey.100',
              p: 2,
              overflow: 'auto',
              maxHeight: 400,
              fontSize: '0.75rem',
              borderRadius: 0
            }}
          >
            {JSON.stringify(
              { patient: patientData, conditions, medications, allergies },
              null,
              2
            )}
          </Box>
        </Paper>
      )}

      {/* Educational Footer */}
      <Paper sx={{ mt: 3, p: 2, bgcolor: 'info.50', borderRadius: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <InfoIcon color="info" />
          <Typography variant="subtitle2">About This Demo App</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          This is a built-in SMART on FHIR demonstration app. It shows how third-party
          applications can securely access patient data through the SMART authorization
          framework. The app receives a patient context and access token, then uses
          the FHIR API to retrieve and display clinical information.
        </Typography>
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Scopes used: launch, patient/Patient.read, patient/Condition.read,
            patient/MedicationRequest.read, patient/AllergyIntolerance.read,
            patient/Observation.read
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default SMARTDemoApp;
