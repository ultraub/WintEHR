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
      
      // Try to fetch real data, fallback to mock data
      try {
        const [demoResponse, diseaseResponse, medResponse] = await Promise.all([
          api.get('/api/analytics/demographics'),
          api.get('/api/analytics/disease-prevalence'),
          api.get('/api/analytics/medication-patterns'),
        ]);
        
        setDemographics(demoResponse.data);
        setDiseasePrevalence(diseaseResponse.data);
        setMedicationPatterns(medResponse.data);
      } catch (apiError) {
        console.warn('API endpoints not available, using mock data:', apiError);
        
        // Set error to show mock data warning
        setError('DISPLAYING MOCK DATA - API endpoints not available');
        
        // Provide mock data with proper structure
        setDemographics({
          gender_distribution: [
            { gender: 'Male', count: 425, percentage: 48.5 },
            { gender: 'Female', count: 451, percentage: 51.5 },
          ],
          age_distribution: {
            '0-18': { count: 156, percentage: 17.8 },
            '19-35': { count: 234, percentage: 26.7 },
            '36-50': { count: 198, percentage: 22.6 },
            '51-65': { count: 187, percentage: 21.4 },
            '65+': { count: 101, percentage: 11.5 },
          },
          race_distribution: [
            { race: 'White', count: 425, percentage: 48.5 },
            { race: 'Hispanic', count: 234, percentage: 26.7 },
            { race: 'Black', count: 123, percentage: 14.0 },
            { race: 'Asian', count: 87, percentage: 9.9 },
            { race: 'Other', count: 7, percentage: 0.8 },
          ]
        });
        
        setDiseasePrevalence({
          conditions: [
            { condition: 'Hypertension', count: 156, prevalence_rate: 17.8 },
            { condition: 'Diabetes', count: 98, prevalence_rate: 11.2 },
            { condition: 'Asthma', count: 87, prevalence_rate: 9.9 },
            { condition: 'Depression', count: 76, prevalence_rate: 8.7 },
            { condition: 'Anxiety', count: 65, prevalence_rate: 7.4 },
            { condition: 'COPD', count: 54, prevalence_rate: 6.2 },
          ]
        });
        
        setMedicationPatterns({
          therapeutic_classes: [
            { class: 'Cardiovascular', count: 245, percentage: 28.0 },
            { class: 'Endocrine', count: 189, percentage: 21.6 },
            { class: 'Respiratory', count: 134, percentage: 15.3 },
            { class: 'Neurological', count: 112, percentage: 12.8 },
            { class: 'Gastrointestinal', count: 98, percentage: 11.2 },
            { class: 'Other', count: 98, percentage: 11.1 },
          ],
          top_medications: [
            { medication: 'Lisinopril', prescription_count: 145 },
            { medication: 'Metformin', prescription_count: 123 },
            { medication: 'Atorvastatin', prescription_count: 98 },
            { medication: 'Amlodipine', prescription_count: 87 },
            { medication: 'Levothyroxine', prescription_count: 76 },
            { medication: 'Albuterol', prescription_count: 65 },
          ],
          polypharmacy: {
            polypharmacy_rate: 23.4,
            patients_with_5plus_meds: 204,
            total_patients_with_meds: 872
          }
        });
      }
    } catch (err) {
      console.error('Error in analytics:', err);
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

  const isMockData = error && error.includes('MOCK DATA');

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Clinical Analytics Dashboard
      </Typography>
      
      {isMockData && (
        <Alert 
          severity="warning" 
          sx={{ 
            mb: 3, 
            backgroundColor: '#fff3cd', 
            border: '2px solid #ffcc02',
            '& .MuiAlert-message': { fontWeight: 'bold' }
          }}
        >
          ⚠️ MOCK DATA DISPLAYED - This is sample data for demonstration purposes, not real Synthea patient data
        </Alert>
      )}
      
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