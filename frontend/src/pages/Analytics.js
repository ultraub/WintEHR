import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Tab,
  Tabs,
} from '@mui/material';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`analytics-tabpanel-${index}`}
      aria-labelledby={`analytics-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function Analytics() {
  const [tabValue, setTabValue] = useState(0);
  const [demographics, setDemographics] = useState(null);
  const [diseasePrevalence, setDiseasePrevalence] = useState(null);
  const [medicationPatterns, setMedicationPatterns] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [demoResponse, diseaseResponse, medResponse] = await Promise.all([
        api.get('/api/analytics/demographics'),
        api.get('/api/analytics/disease-prevalence'),
        api.get('/api/analytics/medication-patterns'),
      ]);

      setDemographics(demoResponse.data);
      setDiseasePrevalence(diseaseResponse.data);
      setMedicationPatterns(medResponse.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Clinical Analytics Dashboard
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Population health analytics and clinical quality measures demonstrating healthcare informatics concepts.
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Demographics" />
          <Tab label="Disease Prevalence" />
          <Tab label="Medication Analytics" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        {demographics && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Gender Distribution
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={demographics.gender_distribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                      label={(entry) => `${entry.gender}: ${entry.percentage}%`}
                    >
                      {demographics.gender_distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Age Distribution
                </Typography>
                <Grid container spacing={2}>
                  {Object.entries(demographics.age_distribution).map(([group, data]) => (
                    <Grid item xs={6} key={group}>
                      <Card>
                        <CardContent>
                          <Typography variant="h4" color="primary">
                            {data.count}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {group.replace('_', ' ')} ({data.percentage}%)
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Race/Ethnicity Distribution
                </Typography>
                {demographics.race_distribution && demographics.race_distribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={demographics.race_distribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="race" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography variant="body1" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                    No race/ethnicity data available. This data needs to be imported from patient records.
                  </Typography>
                )}
              </Paper>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {diseasePrevalence && diseasePrevalence.conditions && diseasePrevalence.conditions.length > 0 ? (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Chronic Disease Prevalence
                </Typography>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={diseasePrevalence.conditions.filter(c => c.count > 0).sort((a, b) => b.prevalence_rate - a.prevalence_rate)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="condition" angle={-45} textAnchor="end" height={100} />
                    <YAxis label={{ value: 'Prevalence Rate (%)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Bar dataKey="prevalence_rate" fill="#00C49F" />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Disease Prevalence Summary
                </Typography>
                <Grid container spacing={2}>
                  {diseasePrevalence.conditions.filter(c => c.count > 0).map((condition, index) => (
                    <Grid item xs={12} sm={6} md={4} key={index}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            {condition.condition}
                          </Typography>
                          <Typography variant="h4" color="primary">
                            {condition.prevalence_rate}%
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {condition.count} patients
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        ) : (
          <Alert severity="info">
            No disease prevalence data available. The system tracks chronic conditions like diabetes, hypertension, and heart disease to analyze population health trends.
          </Alert>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        {medicationPatterns && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Most Prescribed Medications
                </Typography>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={medicationPatterns.top_medications}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="medication" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="prescription_count" fill="#FF8042" />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Polypharmacy Analysis
                </Typography>
                <Card sx={{ mt: 2 }}>
                  <CardContent>
                    <Typography variant="h4" color="warning.main">
                      {medicationPatterns.polypharmacy.polypharmacy_rate}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Patients on 5+ medications
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {medicationPatterns.polypharmacy.patients_with_5plus_meds} of {medicationPatterns.polypharmacy.total_patients_with_meds} patients
                    </Typography>
                  </CardContent>
                </Card>
                
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Polypharmacy (5+ medications) increases risk of drug interactions and adverse effects.
                </Alert>
              </Paper>
            </Grid>
          </Grid>
        )}
      </TabPanel>
    </Box>
  );
}

export default Analytics;