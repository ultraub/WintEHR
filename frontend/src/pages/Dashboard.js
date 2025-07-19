import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
  Button,
  IconButton,
} from '@mui/material';
import SafeBadge from '../components/common/SafeBadge';
import {
  People as PeopleIcon,
  EventNote as EventNoteIcon,
  LocalHospital as HospitalIcon,
  TrendingUp as TrendingUpIcon,
  Person as PersonIcon,
  Assignment as TaskIcon,
  Science as LabIcon,
  Schedule as ScheduleIcon,
  ArrowForward as ArrowForwardIcon,
  Notifications as NotificationsIcon,
  Assessment as AssessmentIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format, startOfDay, endOfDay } from 'date-fns';
import { fhirClient } from '../services/fhirClient';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [todaysSchedule, setTodaysSchedule] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [criticalAlerts, setCriticalAlerts] = useState([]);
  const [recentLabResults, setRecentLabResults] = useState([]);
  const [qualityMetrics, setQualityMetrics] = useState(null);
  const [encounterTrends, setEncounterTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Use FHIR endpoints to gather dashboard data
      const promises = [
        // Dashboard stats - count resources
        Promise.all([
          fhirClient.search('Patient', { _summary: 'count' }),
          fhirClient.search('Encounter', { 
            _summary: 'count' 
          }),
          fhirClient.search('Task', { 
            status: 'requested,accepted,in-progress',
            _summary: 'count' 
          }),
          fhirClient.search('Practitioner', { _summary: 'count' })
        ]).then(([patients, encounters, tasks, practitioners]) => ({
          data: {
            total_patients: patients.total || 0,
            today_encounters: encounters.total || 0,
            total_encounters: encounters.total || 0,
            pending_tasks: tasks.total || 0,
            active_providers: practitioners.total || 0,
            recent_encounters: 10
          }
        })),
        
        // Recent activity - get recent encounters with summary data
        fhirClient.search('Encounter', {
          _sort: '-date',
          _count: 10,
          _include: 'Encounter:patient',
          _summary: 'true'  // Only essential fields for list view
        }).then(result => ({
          data: result.resources || []
        })),
        
        // Encounter trends - fetch real data from last 30 days
        (async () => {
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - 30);
          
          try {
            // Fetch all encounters from the last 30 days
            const result = await fhirClient.search('Encounter', {
              date: `ge${startDate.toISOString()}`,
              _count: 100, // Reasonable limit for trend analysis
              _sort: 'date'
            });
            
            // Group encounters by date
            const encountersByDate = {};
            (result.resources || []).forEach(encounter => {
              const date = encounter.period?.start || encounter.date;
              if (date) {
                const dateKey = format(new Date(date), 'yyyy-MM-dd');
                encountersByDate[dateKey] = (encountersByDate[dateKey] || 0) + 1;
              }
            });
            
            // Create array for last 7 days with counts
            const trendData = [];
            for (let i = 6; i >= 0; i--) {
              const date = new Date();
              date.setDate(date.getDate() - i);
              const dateKey = format(date, 'yyyy-MM-dd');
              trendData.push({
                date: date.toISOString(),
                count: encountersByDate[dateKey] || 0
              });
            }
            
            return { data: trendData };
          } catch (error) {
            
            // Return empty data on error
            return {
              data: Array.from({ length: 7 }, (_, i) => ({
                date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString(),
                count: 0
              }))
            };
          }
        })()
      ];

      // Add provider-specific data if logged in
      if (currentUser?.id) {
        promises.push(
          // Get today's encounters using FHIR
          fhirClient.search('Encounter', {
            date: [`ge${startOfDay(new Date()).toISOString()}`, `le${endOfDay(new Date()).toISOString()}`],
            _sort: '-date'
          }).then(result => {
            // Transform FHIR encounters to expected format
            const transformedEncounters = result.resources.map(enc => {
              const type = enc.type?.[0];
              const period = enc.period || {};
              return {
                id: enc.id,
                patient_id: fhirClient.extractId(enc.subject),
                encounter_type: type?.text || type?.coding?.[0]?.display || 'Unknown',
                encounter_date: period.start || enc.date,
                status: enc.status,
                provider: enc.participant?.find(p => 
                  p.type?.[0]?.coding?.[0]?.code === 'ATND'
                )?.individual?.display || 'Unknown Provider'
              };
            });
            return { data: transformedEncounters };
          }),
          // Get pending tasks using FHIR
          fhirClient.search('Task', {
            owner: `Practitioner/${currentUser.id}`,
            status: 'requested,accepted,in-progress',
            _sort: '-authored-on',
            _count: 5
          }).then(result => {
            // Transform FHIR tasks to expected format
            const transformedTasks = result.resources.map(task => ({
              id: task.id,
              title: task.description || task.code?.text || 'Task',
              priority: task.priority || 'routine',
              patient_id: fhirClient.extractId(task.for),
              patient_name: task.for?.display || 'Unknown Patient',
              due_date: task.restriction?.period?.end,
              status: task.status,
              type: task.code?.coding?.[0]?.code || 'review'
            }));
            return { data: transformedTasks };
          }),
          // Get critical alerts based on FHIR data
          (async () => {
            const alerts = [];
            
            // Get recent lab results with critical values
            const criticalLabs = await fhirClient.search('Observation', {
              category: 'laboratory',
              status: 'final',
              _sort: '-date',
              _count: 20
            });
            
            // Check for critical lab values
            criticalLabs.resources.forEach(obs => {
              const interpretation = obs.interpretation?.[0]?.coding?.[0]?.code;
              if (interpretation && ['H', 'HH', 'L', 'LL', 'A', 'AA'].includes(interpretation)) {
                const isCritical = ['HH', 'LL', 'AA'].includes(interpretation);
                alerts.push({
                  id: obs.id,
                  type: isCritical ? 'critical' : 'warning',
                  title: isCritical ? 'Critical Lab Result' : 'Abnormal Lab Result',
                  message: `${obs.code?.text || obs.code?.coding?.[0]?.display}: ${
                    obs.valueQuantity ? `${obs.valueQuantity.value} ${obs.valueQuantity.unit}` : obs.valueString
                  }`,
                  patient_id: fhirClient.extractId(obs.subject),
                  patient_name: obs.subject?.display || 'Unknown Patient',
                  created_at: obs.effectiveDateTime || new Date().toISOString(),
                  resource_type: 'Observation',
                  resource_id: obs.id
                });
              }
            });
            
            // Get recent vital signs that are out of range
            const vitalSigns = await fhirClient.search('Observation', {
              category: 'vital-signs',
              status: 'final',
              date: `ge${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}`, // Last 24 hours
              _count: 50
            });
            
            // Check for critical vital signs
            vitalSigns.resources.forEach(obs => {
              const code = obs.code?.coding?.[0]?.code;
              let value = null;
              let isCritical = false;
              let message = '';
              
              // Extract value
              if (obs.valueQuantity) {
                value = obs.valueQuantity.value;
              } else if (obs.component) {
                // Handle blood pressure
                const systolic = obs.component.find(c => c.code?.coding?.[0]?.code === '8480-6')?.valueQuantity?.value;
                const diastolic = obs.component.find(c => c.code?.coding?.[0]?.code === '8462-4')?.valueQuantity?.value;
                if (systolic && diastolic) {
                  // Check for hypertensive crisis
                  if (systolic >= 180 || diastolic >= 120) {
                    isCritical = true;
                    message = `Blood Pressure: ${systolic}/${diastolic} mmHg - Hypertensive Crisis`;
                  } else if (systolic >= 140 || diastolic >= 90) {
                    message = `Blood Pressure: ${systolic}/${diastolic} mmHg - Stage 2 Hypertension`;
                  }
                }
              }
              
              // Check other vital signs
              if (value !== null && !message) {
                switch (code) {
                  case '8867-4': // Heart rate
                    if (value < 40 || value > 130) {
                      isCritical = value < 30 || value > 150;
                      message = `Heart Rate: ${value} bpm - ${isCritical ? 'Critical' : 'Abnormal'}`;
                    }
                    break;
                  case '9279-1': // Respiratory rate
                    if (value < 10 || value > 30) {
                      isCritical = value < 8 || value > 35;
                      message = `Respiratory Rate: ${value} /min - ${isCritical ? 'Critical' : 'Abnormal'}`;
                    }
                    break;
                  case '2708-6': // Oxygen saturation
                    if (value < 92) {
                      isCritical = value < 88;
                      message = `Oxygen Saturation: ${value}% - ${isCritical ? 'Critical' : 'Low'}`;
                    }
                    break;
                  case '8310-5': // Body temperature
                    if (value < 35 || value > 38.5) {
                      isCritical = value < 34 || value > 40;
                      message = `Temperature: ${value}°C - ${isCritical ? 'Critical' : 'Abnormal'}`;
                    }
                    break;
                  default:
                    // Other vital signs not specifically handled
                    break;
                }
              }
              
              if (message) {
                alerts.push({
                  id: `vital-${obs.id}`,
                  type: isCritical ? 'critical' : 'warning',
                  title: isCritical ? 'Critical Vital Sign' : 'Abnormal Vital Sign',
                  message,
                  patient_id: fhirClient.extractId(obs.subject),
                  patient_name: obs.subject?.display || 'Unknown Patient',
                  created_at: obs.effectiveDateTime || new Date().toISOString(),
                  resource_type: 'Observation',
                  resource_id: obs.id
                });
              }
            });
            
            // Sort alerts by criticality and date
            alerts.sort((a, b) => {
              if (a.type === 'critical' && b.type !== 'critical') return -1;
              if (a.type !== 'critical' && b.type === 'critical') return 1;
              return new Date(b.created_at) - new Date(a.created_at);
            });
            
            return { data: alerts.slice(0, 10) }; // Return top 10 alerts
          })(),
          // Get recent lab results using FHIR
          fhirClient.search('Observation', {
            category: 'laboratory',
            status: 'final',
            _sort: '-date',
            _count: 10
          }).then(result => {
            // Transform FHIR observations to expected format
            const transformedLabs = result.resources.map(obs => {
              const abnormal = obs.interpretation?.[0]?.coding?.[0]?.code !== 'N';
              return {
                id: obs.id,
                test_name: obs.code?.text || obs.code?.coding?.[0]?.display || 'Lab Test',
                patient_id: fhirClient.extractId(obs.subject),
                patient_name: obs.subject?.display || 'Unknown Patient',
                collection_date: obs.effectiveDateTime || obs.effectivePeriod?.start,
                abnormal_flag: abnormal,
                value: obs.valueQuantity ? 
                  `${obs.valueQuantity.value} ${obs.valueQuantity.unit}` : 
                  obs.valueString || 'N/A',
                reviewed: false // Would need extension to track this
              };
            });
            return { data: transformedLabs };
          }),
          // Calculate quality measures based on FHIR data
          (async () => {
            const measures = [];
            
            // Get all patients for denominator calculations
            const patientsResult = await fhirClient.search('Patient', { _count: 100 });
            const totalPatients = patientsResult.total || patientsResult.resources.length;
            
            // Measure 1: Diabetes A1C Control
            const diabetesPatients = await fhirClient.search('Condition', {
              code: '44054006', // SNOMED code for Type 2 diabetes
              _count: 100
            });
            
            if (diabetesPatients.resources.length > 0) {
              const patientIds = [...new Set(diabetesPatients.resources.map(c => fhirClient.extractId(c.subject)))];
              let controlledCount = 0;
              let testedCount = 0;
              
              // Check A1C values for each diabetic patient
              for (const patientId of patientIds) {
                const a1cResults = await fhirClient.search('Observation', {
                  patient: patientId,
                  code: '4548-4', // A1C LOINC code
                  date: `ge${new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()}`, // Last 6 months
                  _sort: '-date',
                  _count: 1
                });
                
                if (a1cResults.resources.length > 0) {
                  testedCount++;
                  const latestA1c = a1cResults.resources[0];
                  if (latestA1c.valueQuantity && latestA1c.valueQuantity.value < 7) {
                    controlledCount++;
                  }
                }
              }
              
              measures.push({
                id: 'diabetes-a1c-control',
                name: 'Diabetes: A1C Control (<7%)',
                description: 'Percentage of patients with diabetes who have A1C under control',
                numerator: controlledCount,
                denominator: patientIds.length,
                score: patientIds.length > 0 ? Math.round((controlledCount / patientIds.length) * 100) : 0,
                target: 70,
                status: controlledCount / patientIds.length >= 0.7 ? 'met' : 'not-met'
              });
              
              measures.push({
                id: 'diabetes-a1c-testing',
                name: 'Diabetes: A1C Testing',
                description: 'Percentage of patients with diabetes who had A1C test in last 6 months',
                numerator: testedCount,
                denominator: patientIds.length,
                score: patientIds.length > 0 ? Math.round((testedCount / patientIds.length) * 100) : 0,
                target: 90,
                status: testedCount / patientIds.length >= 0.9 ? 'met' : 'not-met'
              });
            }
            
            // Measure 2: Blood Pressure Control
            const hyperTensionPatients = await fhirClient.search('Condition', {
              code: '38341003', // SNOMED code for Hypertension
              _count: 100
            });
            
            if (hyperTensionPatients.resources.length > 0) {
              const patientIds = [...new Set(hyperTensionPatients.resources.map(c => fhirClient.extractId(c.subject)))];
              let controlledCount = 0;
              let measuredCount = 0;
              
              for (const patientId of patientIds) {
                const bpResults = await fhirClient.search('Observation', {
                  patient: patientId,
                  code: '85354-9', // Blood pressure panel
                  date: `ge${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()}`, // Last 3 months
                  _sort: '-date',
                  _count: 1
                });
                
                if (bpResults.resources.length > 0) {
                  measuredCount++;
                  const latestBP = bpResults.resources[0];
                  const systolic = latestBP.component?.find(c => c.code?.coding?.[0]?.code === '8480-6')?.valueQuantity?.value;
                  const diastolic = latestBP.component?.find(c => c.code?.coding?.[0]?.code === '8462-4')?.valueQuantity?.value;
                  
                  if (systolic && diastolic && systolic < 140 && diastolic < 90) {
                    controlledCount++;
                  }
                }
              }
              
              measures.push({
                id: 'bp-control',
                name: 'Blood Pressure Control',
                description: 'Percentage of patients with hypertension who have BP <140/90',
                numerator: controlledCount,
                denominator: patientIds.length,
                score: patientIds.length > 0 ? Math.round((controlledCount / patientIds.length) * 100) : 0,
                target: 75,
                status: controlledCount / patientIds.length >= 0.75 ? 'met' : 'not-met'
              });
            }
            
            // Measure 3: Preventive Care - Immunizations
            const fluVaccinations = await fhirClient.search('Immunization', {
              'vaccine-code': '88', // Influenza vaccine
              date: `ge${new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()}`, // Last year
              _count: 100
            });
            
            const uniqueVaccinatedPatients = [...new Set(fluVaccinations.resources.map(imm => fhirClient.extractId(imm.patient)))];
            
            measures.push({
              id: 'flu-vaccination',
              name: 'Influenza Vaccination',
              description: 'Percentage of patients who received flu vaccine in the last year',
              numerator: uniqueVaccinatedPatients.length,
              denominator: totalPatients,
              score: totalPatients > 0 ? Math.round((uniqueVaccinatedPatients.length / totalPatients) * 100) : 0,
              target: 80,
              status: uniqueVaccinatedPatients.length / totalPatients >= 0.8 ? 'met' : 'not-met'
            });
            
            // Calculate overall score
            const overallScore = measures.length > 0 
              ? Math.round(measures.reduce((sum, m) => sum + m.score, 0) / measures.length)
              : 0;
            const measuresMet = measures.filter(m => m.status === 'met').length;
            
            return {
              data: {
                overall_score: overallScore,
                measures_met: measuresMet,
                total_measures: measures.length,
                measures: measures,
                top_measures: measures.sort((a, b) => b.score - a.score).slice(0, 5)
              }
            };
          })()
        );
      }

      const results = await Promise.all(promises);
      
      setStats(results[0].data);
      setRecentActivity(results[1].data);
      setEncounterTrends(results[2].data);
      
      if (currentUser?.id) {
        setTodaysSchedule(results[3]?.data || []);
        setPendingTasks(results[4]?.data || []);
        setCriticalAlerts(results[5]?.data || []);
        setRecentLabResults(results[6]?.data || []);
        setQualityMetrics(results[7]?.data || null);
        
        // Also get patient name for today's encounters
        if (results[3]?.data?.length > 0) {
          const patientIds = results[3].data.map(enc => enc.patient_id).filter(Boolean);
          const uniquePatientIds = [...new Set(patientIds)];
          
          // Fetch patient names
          const patientPromises = uniquePatientIds.map(id => 
            fhirClient.read('Patient', id).catch(() => null)
          );
          
          const patients = await Promise.all(patientPromises);
          const patientMap = {};
          patients.forEach(patient => {
            if (patient) {
              const name = patient.name?.[0];
              const displayName = name ? 
                `${name.given?.join(' ') || ''} ${name.family || ''}`.trim() : 
                'Unknown Patient';
              patientMap[patient.id] = displayName;
            }
          });
          
          // Update encounters with patient names
          const encountersWithNames = results[3].data.map(enc => ({
            ...enc,
            patient_name: patientMap[enc.patient_id] || 'Unknown Patient'
          }));
          setTodaysSchedule(encountersWithNames);
        }
      }
      
      setError(null);
    } catch (err) {
      
      setError('Failed to load dashboard data');
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

  const statCards = currentUser ? [
    {
      title: 'My Patients',
      value: stats?.my_patients || 0,
      icon: <PeopleIcon />,
      color: '#1976d2',
      action: () => navigate('/patients'),
    },
    {
      title: "Today's Appointments",
      value: todaysSchedule.length,
      icon: <ScheduleIcon />,
      color: '#388e3c',
      subtitle: 'View Schedule',
      action: () => navigate('/encounters'),
    },
    {
      title: 'Pending Tasks',
      value: pendingTasks.length,
      icon: <TaskIcon />,
      color: '#f57c00',
      subtitle: 'Requires action',
      action: () => navigate('/tasks'),
    },
    {
      title: 'Unreviewed Labs',
      value: recentLabResults.length,
      icon: <LabIcon />,
      color: '#d32f2f',
      subtitle: 'Need review',
      action: () => navigate('/lab-results'),
    },
  ] : [
    {
      title: 'Total Patients',
      value: stats?.total_patients || 0,
      icon: <PeopleIcon />,
      color: '#1976d2',
    },
    {
      title: 'Total Encounters',
      value: stats?.total_encounters || 0,
      icon: <EventNoteIcon />,
      color: '#388e3c',
    },
    {
      title: 'Active Providers',
      value: stats?.active_providers || 0,
      icon: <HospitalIcon />,
      color: '#f57c00',
    },
    {
      title: 'Recent Encounters',
      value: stats?.recent_encounters || 0,
      icon: <TrendingUpIcon />,
      color: '#d32f2f',
      subtitle: 'Last 7 days',
    },
  ];

  return (
    <div>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <div>
          <Typography variant="h4" gutterBottom>
            {currentUser ? `Welcome back, Dr. ${currentUser.name}` : 'Dashboard'}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </Typography>
        </div>
        {criticalAlerts.length > 0 && (
          <SafeBadge badgeContent={criticalAlerts.length} color="error">
            <IconButton color="error" onClick={() => navigate('/alerts')}>
              <NotificationsIcon />
            </IconButton>
          </SafeBadge>
        )}
      </Box>

      {/* Critical Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="body2">
            You have {criticalAlerts.length} critical alert{criticalAlerts.length > 1 ? 's' : ''} requiring immediate attention
          </Typography>
        </Alert>
      )}
      
      <Grid container spacing={3}>
        {/* Stat Cards */}
        {statCards.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card 
              sx={{ 
                height: '100%', 
                cursor: stat.action ? 'pointer' : 'default',
                '&:hover': stat.action ? { boxShadow: 4 } : {} 
              }}
              onClick={stat.action}
            >
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      {stat.title}
                    </Typography>
                    <Typography variant="h4" component="div">
                      {stat.value}
                    </Typography>
                    {stat.subtitle && (
                      <Typography variant="caption" color="textSecondary">
                        {stat.subtitle}
                      </Typography>
                    )}
                  </Box>
                  <Avatar sx={{ bgcolor: stat.color, width: 56, height: 56 }}>
                    {stat.icon}
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}

        {/* Encounter Trends Chart */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, height: '300px' }}>
            <Typography variant="h6" gutterBottom>
              {currentUser ? 'My Patient Encounters (Last 30 Days)' : 'Patient Encounters (Last 30 Days)'}
            </Typography>
            <ResponsiveContainer width="100%" height="85%">
              <LineChart data={encounterTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => format(new Date(date), 'MMM d')}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')}
                  formatter={(value) => [`${value} encounters`, 'Count']}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#E91E63" 
                  strokeWidth={2}
                  dot={{ fill: '#E91E63', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Today's Schedule */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '400px' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Today's Schedule</Typography>
              <Button 
                size="small" 
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/encounters')}
              >
                View All
              </Button>
            </Box>
            <List sx={{ maxHeight: '320px', overflow: 'auto' }}>
              {todaysSchedule.length > 0 ? (
                todaysSchedule.map((appointment, index) => (
                  <ListItem 
                    key={index} 
                    alignItems="flex-start"
                    sx={{ 
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                    onClick={() => navigate(`/patients/${appointment.patient_id}`)}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: appointment.status === 'completed' ? '#4caf50' : '#ff9800' }}>
                        <PersonIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body1">
                            {appointment.patient_name || 'Unknown Patient'}
                          </Typography>
                          <Chip 
                            label={format(new Date(appointment.encounter_date), 'h:mm a')}
                            size="small"
                            color={appointment.status === 'completed' ? 'success' : 'warning'}
                          />
                        </Box>
                      }
                      secondary={
                        <React.Fragment>
                          <Typography component="span" variant="body2" color="text.primary">
                            {appointment.encounter_type || 'Office Visit'}
                          </Typography>
                          {appointment.chief_complaint && (
                            <>
                              {' — '}
                              {appointment.chief_complaint}
                            </>
                          )}
                        </React.Fragment>
                      }
                    />
                  </ListItem>
                ))
              ) : (
                <Box display="flex" justifyContent="center" alignItems="center" height="300px">
                  <Typography color="textSecondary">No appointments scheduled for today</Typography>
                </Box>
              )}
            </List>
          </Paper>
        </Grid>

        {/* Pending Tasks & Orders */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '400px' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Pending Tasks</Typography>
              <Button 
                size="small" 
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/clinical-workspace/placeholder', { state: { tab: 'tasks' } })}
              >
                View All
              </Button>
            </Box>
            <List sx={{ maxHeight: '320px', overflow: 'auto' }}>
              {pendingTasks.length > 0 ? (
                pendingTasks.map((task, index) => (
                  <ListItem key={index} alignItems="flex-start">
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: task.priority === 'high' ? '#f44336' : '#ff9800' }}>
                        <TaskIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="body1">{task.title}</Typography>
                          <Chip 
                            label={task.priority}
                            size="small"
                            color={task.priority === 'high' ? 'error' : 'warning'}
                          />
                        </Box>
                      }
                      secondary={
                        <React.Fragment>
                          <Typography component="span" variant="body2" color="text.primary">
                            {task.patient_name}
                          </Typography>
                          {task.due_date && (
                            <>
                              {' — Due: '}
                              {format(new Date(task.due_date), 'MMM d')}
                            </>
                          )}
                        </React.Fragment>
                      }
                    />
                  </ListItem>
                ))
              ) : (
                <Box display="flex" justifyContent="center" alignItems="center" height="300px">
                  <Typography color="textSecondary">No pending tasks</Typography>
                </Box>
              )}
            </List>
          </Paper>
        </Grid>

        {/* Quality Metrics Summary */}
        {currentUser && qualityMetrics && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Quality Metrics</Typography>
                <Button 
                  size="small" 
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => navigate('/quality')}
                >
                  View Details
                </Button>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="primary">
                        {qualityMetrics.overall_score || 0}%
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Overall Score
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="success.main">
                        {qualityMetrics.measures_met || 0}/{qualityMetrics.total_measures || 0}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Measures Met
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              {qualityMetrics.top_measures && (
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>Performance by Measure</Typography>
                  {qualityMetrics.top_measures.slice(0, 3).map((measure, index) => (
                    <Box key={index} mb={1}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2">{measure.name}</Typography>
                        <Typography variant="body2" color={measure.score >= measure.target ? 'success.main' : 'error.main'}>
                          {measure.score}%
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          </Grid>
        )}

        {/* Recent Lab Results */}
        {currentUser && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Recent Lab Results</Typography>
                <Button 
                  size="small" 
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => navigate('/lab-results')}
                >
                  View All
                </Button>
              </Box>
              <List>
                {recentLabResults.length > 0 ? (
                  recentLabResults.slice(0, 5).map((lab, index) => (
                    <ListItem key={index} divider={index < 4}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: lab.abnormal_flag ? '#f44336' : '#4caf50' }}>
                          <LabIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box display="flex" justifyContent="space-between">
                            <Typography variant="body2">{lab.test_name}</Typography>
                            {lab.abnormal_flag && (
                              <Chip label="Abnormal" size="small" color="error" />
                            )}
                          </Box>
                        }
                        secondary={
                          <React.Fragment>
                            <Typography component="span" variant="caption">
                              {lab.patient_name} — {format(new Date(lab.collection_date), 'MMM d')}
                            </Typography>
                          </React.Fragment>
                        }
                      />
                    </ListItem>
                  ))
                ) : (
                  <Box display="flex" justifyContent="center" alignItems="center" height="200px">
                    <Typography color="textSecondary">No unreviewed lab results</Typography>
                  </Box>
                )}
              </List>
            </Paper>
          </Grid>
        )}

        {/* Quick Actions */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Grid container spacing={2}>
              <Grid item>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => navigate('/patients/new')}
                >
                  New Patient
                </Button>
              </Grid>
              <Grid item>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<EventNoteIcon />}
                  onClick={() => navigate('/encounters/schedule')}
                >
                  Schedule Appointment
                </Button>
              </Grid>
              <Grid item>
                <Button
                  variant="outlined"
                  startIcon={<LabIcon />}
                  onClick={() => navigate('/clinical-workspace/placeholder', { state: { tab: 'orders', orderType: 'laboratory' } })}
                >
                  Enter Lab Results
                </Button>
              </Grid>
              <Grid item>
                <Button
                  variant="outlined"
                  startIcon={<TaskIcon />}
                  onClick={() => navigate('/clinical-workspace/placeholder', { state: { tab: 'tasks', action: 'new' } })}
                >
                  Create Task
                </Button>
              </Grid>
              <Grid item>
                <Button
                  variant="outlined"
                  startIcon={<AssessmentIcon />}
                  onClick={() => navigate('/quality')}
                >
                  Quality Reports
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </div>
  );
}

export default Dashboard;