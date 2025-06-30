import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Lightbulb as LightbulbIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  PlayArrow as PlayIcon,
} from '@mui/icons-material';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import api from '../services/api';
import axios from 'axios';

SyntaxHighlighter.registerLanguage('json', json);

const INDICATOR_ICONS = {
  info: <InfoIcon color="info" />,
  warning: <WarningIcon color="warning" />,
  critical: <ErrorIcon color="error" />,
};

const INDICATOR_COLORS = {
  info: 'info',
  warning: 'warning',
  critical: 'error',
};

function CDSDemo() {
  const [services, setServices] = useState([]);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [cdsResponse, setCdsResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCDSServices();
    fetchPatients();
  }, []);

  const fetchCDSServices = async () => {
    try {
      const response = await axios.get('/cds-hooks/');
      setServices(response.data.services);
    } catch (err) {
      console.error('Error fetching CDS services:', err);
      setError('Failed to load CDS services');
    }
  };

  const fetchPatients = async () => {
    try {
      const response = await api.get('/api/patients?limit=50');
      setPatients(response.data);
    } catch (err) {
      console.error('Error fetching patients:', err);
      setError('Failed to load patients');
    }
  };

  const executeCDSService = async () => {
    if (!selectedPatient || !selectedService) {
      setError('Please select both a patient and a CDS service');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const request = {
        hook: 'patient-view',
        context: {
          patientId: selectedPatient,
          userId: 'demo-user',
        },
        prefetch: {},
      };

      const response = await axios.post(`/cds-hooks/${selectedService}`, request);
      setCdsResponse(response.data);
    } catch (err) {
      console.error('Error executing CDS service:', err);
      setError(err.response?.data?.detail || 'Failed to execute CDS service');
    } finally {
      setLoading(false);
    }
  };

  const selectedPatientData = patients.find(p => p.id === selectedPatient);
  const selectedServiceData = services.find(s => s.id === selectedService);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        CDS Hooks Demo
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Clinical Decision Support (CDS) Hooks provide just-in-time clinical decision support
        within EHR workflows. This demo showcases various CDS services that analyze patient data
        and provide actionable recommendations.
      </Typography>

      <Grid container spacing={3}>
        {/* Control Panel */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              CDS Service Tester
            </Typography>
            
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Select Patient</InputLabel>
              <Select
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value)}
                label="Select Patient"
              >
                {patients.map((patient) => (
                  <MenuItem key={patient.id} value={patient.id}>
                    {patient.last_name}, {patient.first_name} ({patient.mrn})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Select CDS Service</InputLabel>
              <Select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                label="Select CDS Service"
              >
                {services.map((service) => (
                  <MenuItem key={service.id} value={service.id}>
                    {service.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              fullWidth
              variant="contained"
              onClick={executeCDSService}
              disabled={loading || !selectedPatient || !selectedService}
              startIcon={loading ? <CircularProgress size={20} /> : <PlayIcon />}
            >
              Execute CDS Service
            </Button>

            {selectedPatientData && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Selected Patient
                </Typography>
                <Card variant="outlined">
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="body2">
                      <strong>{selectedPatientData.first_name} {selectedPatientData.last_name}</strong>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      MRN: {selectedPatientData.mrn}
                    </Typography>
                    <br />
                    <Typography variant="caption" color="text.secondary">
                      DOB: {selectedPatientData.date_of_birth}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            )}

            {selectedServiceData && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Selected Service
                </Typography>
                <Card variant="outlined">
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="body2">
                      <strong>{selectedServiceData.title}</strong>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {selectedServiceData.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Results Panel */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">CDS Response</Typography>
              {cdsResponse && (
                <Tooltip title="Refresh">
                  <IconButton onClick={executeCDSService} size="small">
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
            
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {cdsResponse && (
              <Box>
                {cdsResponse.cards && cdsResponse.cards.length > 0 ? (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Clinical Decision Support Cards ({cdsResponse.cards.length})
                    </Typography>
                    {cdsResponse.cards.map((card, index) => (
                      <Card
                        key={index}
                        sx={{
                          mb: 2,
                          border: 1,
                          borderColor: `${INDICATOR_COLORS[card.indicator] || 'grey'}.300`,
                          borderLeft: 4,
                          borderLeftColor: `${INDICATOR_COLORS[card.indicator] || 'grey'}.main`,
                        }}
                      >
                        <CardContent>
                          <Box display="flex" alignItems="flex-start" mb={1}>
                            {INDICATOR_ICONS[card.indicator] || <InfoIcon />}
                            <Box ml={1} flexGrow={1}>
                              <Typography variant="h6" gutterBottom>
                                {card.summary}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" paragraph>
                                {card.detail}
                              </Typography>
                              
                              <Box display="flex" alignItems="center" gap={1} mb={2}>
                                <Chip
                                  label={card.indicator}
                                  size="small"
                                  color={INDICATOR_COLORS[card.indicator]}
                                />
                                {card.source && (
                                  <Chip
                                    label={card.source.label}
                                    size="small"
                                    variant="outlined"
                                  />
                                )}
                              </Box>

                              {card.suggestions && card.suggestions.length > 0 && (
                                <Box>
                                  <Typography variant="subtitle2" gutterBottom>
                                    Suggested Actions
                                  </Typography>
                                  {card.suggestions.map((suggestion, idx) => (
                                    <Button
                                      key={idx}
                                      variant="outlined"
                                      size="small"
                                      sx={{ mr: 1, mb: 1 }}
                                    >
                                      {suggestion.label}
                                    </Button>
                                  ))}
                                </Box>
                              )}

                              {card.links && card.links.length > 0 && (
                                <Box>
                                  <Typography variant="subtitle2" gutterBottom>
                                    References
                                  </Typography>
                                  {card.links.map((link, idx) => (
                                    <Button
                                      key={idx}
                                      variant="text"
                                      size="small"
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      sx={{ mr: 1, mb: 1 }}
                                    >
                                      {link.label}
                                    </Button>
                                  ))}
                                </Box>
                              )}
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                ) : (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    No clinical decision support recommendations at this time.
                  </Alert>
                )}

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2">Raw CDS Response</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ maxHeight: '400px', overflow: 'auto' }}>
                      <SyntaxHighlighter
                        language="json"
                        style={docco}
                        customStyle={{
                          fontSize: '12px',
                          borderRadius: '4px',
                          margin: 0,
                        }}
                      >
                        {JSON.stringify(cdsResponse, null, 2)}
                      </SyntaxHighlighter>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              </Box>
            )}

            {!cdsResponse && !error && !loading && (
              <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                minHeight="300px"
                color="text.secondary"
              >
                <LightbulbIcon sx={{ fontSize: 64, mb: 2 }} />
                <Typography>Select a patient and CDS service to see recommendations</Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Available Services */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Available CDS Services
            </Typography>
            
            <Grid container spacing={2}>
              {services.map((service) => (
                <Grid item xs={12} md={6} key={service.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {service.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        {service.description}
                      </Typography>
                      <Box>
                        <Chip label={service.hook} size="small" color="primary" />
                        <Chip label={service.id} size="small" variant="outlined" sx={{ ml: 1 }} />
                      </Box>
                      {service.prefetch && (
                        <Accordion sx={{ mt: 2 }}>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="subtitle2">Prefetch Requirements</Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <SyntaxHighlighter
                              language="json"
                              style={docco}
                              customStyle={{
                                fontSize: '11px',
                                borderRadius: '4px',
                                margin: 0,
                              }}
                            >
                              {JSON.stringify(service.prefetch, null, 2)}
                            </SyntaxHighlighter>
                          </AccordionDetails>
                        </Accordion>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default CDSDemo;