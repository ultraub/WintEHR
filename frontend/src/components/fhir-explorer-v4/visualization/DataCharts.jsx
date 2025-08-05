/**
 * Data Charts Component for FHIR Explorer v4
 * 
 * Interactive charts and graphs for clinical data visualization
 * Leverages existing analytics APIs for real-time healthcare insights
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButtonGroup,
  ToggleButton,
  useTheme,
  Tooltip
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LabelList
} from 'recharts';
import {
  Analytics as AnalyticsIcon,
  People as PeopleIcon,
  LocalPharmacy as PharmacyIcon,
  MonitorHeart as HealthIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  TrendingUp as TrendingUpIcon,
  DonutLarge as DonutIcon,
  ShowChart as LineIcon,
  BarChart as BarIcon,
  PieChart as PieIcon,
  LocalPharmacy as MedicationIcon,
  Warning as WarningIcon,
  ArrowDownward as ArrowDownwardIcon
} from '@mui/icons-material';
import ChartTypeSelector from './components/ChartTypeSelector';
import VitalSignsChart from './components/VitalSignsChart';
import { exportToPNG, exportToPDF, exportToJSON } from './utils/timelineExport';
import { getChartColors } from '../../../themes/chartColors';

// Safe wrapper component for charts to handle errors
class SafeChartWrapper extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Chart rendering error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: this.props.height || 300 }}>
          <Typography variant="body2" color="text.secondary">Error rendering chart</Typography>
        </Box>
      );
    }

    return this.props.children;
  }
}

function DataCharts({ onNavigate, fhirData }) {
  const theme = useTheme();
  const chartColors = getChartColors(theme);
  
  // Use the palette colors for charts with fallback
  const CHART_COLORS = chartColors?.palette || ['#1976D2', '#388E3C', '#F57C00', '#D32F2F', '#7B1FA2', '#0288D1', '#388E3C', '#FFA726'];
  
  const [currentTab, setCurrentTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState('bar');
  const [aggregationPeriod, setAggregationPeriod] = useState('month');
  
  // Analytics data state - Initialize with empty structures to avoid null issues
  const [demographicsData, setDemographicsData] = useState({ 
    ageGroups: [], 
    genderDistribution: [], 
    totalPatients: 0,
    averageAge: 0,
    raceDistribution: [],
    ethnicityDistribution: []
  });
  const [diseasePrevalenceData, setDiseasePrevalenceData] = useState([]);
  const [medicationPatternsData, setMedicationPatternsData] = useState([]);
  const [vitalSignsData, setVitalSignsData] = useState({});
  const [qualityMetricsData, setQualityMetricsData] = useState(null);
  const [riskScoresData, setRiskScoresData] = useState([]);
  const [refreshInterval, setRefreshInterval] = useState(null);

  // Calculate clinical quality metrics
  const calculateQualityMetrics = useCallback((patients, conditions, medications, observations) => {
    const metrics = {
      diabeticPatients: 0,
      diabeticsWithA1c: 0,
      hypertensivePatients: 0,
      hypertensivesControlled: 0,
      patientsWithScreenings: 0,
      medicationAdherence: 0
    };
    
    // Helper to extract patient ID from reference
    const getPatientId = (reference) => {
      if (!reference) return null;
      // Handle both "Patient/123" and "urn:uuid:123" formats
      if (reference.includes('urn:uuid:')) {
        return reference.split(':').pop();
      }
      return reference.split('/').pop();
    };
    
    // Find diabetic patients
    const diabeticPatientIds = new Set();
    const hypertensivePatientIds = new Set();
    
    conditions.forEach(condition => {
      if (!condition || !condition.code) return;
      
      const codes = condition.code.coding || [];
      const text = condition.code.text || '';
      
      // Check for diabetes (ICD-10 E10-E14, SNOMED 73211009)
      const isDiabetes = codes.some(c => 
        c.code?.startsWith('E10') || c.code?.startsWith('E11') || 
        c.code?.startsWith('E12') || c.code?.startsWith('E13') ||
        c.code === '73211009' || c.display?.toLowerCase().includes('diabetes')
      ) || text.toLowerCase().includes('diabetes');
      
      // Check for hypertension (ICD-10 I10, SNOMED 38341003)
      const isHypertension = codes.some(c => 
        c.code === 'I10' || c.code === '38341003' || 
        c.display?.toLowerCase().includes('hypertension')
      ) || text.toLowerCase().includes('hypertension');
      
      const patientId = getPatientId(condition.subject?.reference);
      if (patientId) {
        if (isDiabetes && condition.clinicalStatus?.coding?.[0]?.code === 'active') {
          diabeticPatientIds.add(patientId);
        }
        if (isHypertension && condition.clinicalStatus?.coding?.[0]?.code === 'active') {
          hypertensivePatientIds.add(patientId);
        }
      }
    });
    
    metrics.diabeticPatients = diabeticPatientIds.size;
    metrics.hypertensivePatients = hypertensivePatientIds.size;
    
    // Track HbA1c tests and BP control
    const patientsWithA1c = new Set();
    const patientsWithControlledBP = new Set();
    
    observations.forEach(obs => {
      if (!obs || !obs.code || obs.status !== 'final') return;
      
      const loincCode = obs.code.coding?.find(c => c.system?.includes('loinc'))?.code;
      const patientId = getPatientId(obs.subject?.reference);
      
      if (!patientId) return;
      
      // HbA1c test (LOINC 4548-4)
      if (loincCode === '4548-4' && diabeticPatientIds.has(patientId)) {
        patientsWithA1c.add(patientId);
      }
      
      // Blood pressure (LOINC 85354-9 or component codes)
      if (hypertensivePatientIds.has(patientId)) {
        const isSystolic = loincCode === '8480-6';
        const isDiastolic = loincCode === '8462-4';
        
        if ((isSystolic || isDiastolic) && obs.valueQuantity?.value) {
          const value = obs.valueQuantity.value;
          // Consider controlled if systolic < 140 and diastolic < 90
          if ((isSystolic && value < 140) || (isDiastolic && value < 90)) {
            patientsWithControlledBP.add(patientId);
          }
        }
      }
    });
    
    metrics.diabeticsWithA1c = patientsWithA1c.size;
    metrics.hypertensivesControlled = patientsWithControlledBP.size;
    
    // Calculate medication adherence (active vs total)
    const patientMedications = {};
    medications.forEach(med => {
      const patientId = getPatientId(med.subject?.reference);
      if (patientId) {
        if (!patientMedications[patientId]) {
          patientMedications[patientId] = { total: 0, active: 0 };
        }
        patientMedications[patientId].total++;
        if (med.status === 'active') {
          patientMedications[patientId].active++;
        }
      }
    });
    
    const adherenceRates = Object.values(patientMedications).map(p => 
      p.total > 0 ? p.active / p.total : 0
    );
    metrics.medicationAdherence = adherenceRates.length > 0 
      ? adherenceRates.reduce((sum, rate) => sum + rate, 0) / adherenceRates.length 
      : 0;
    
    return metrics;
  }, []);

  // Calculate risk scores
  const calculateRiskScores = useCallback((patients, conditions, medications, observations) => {
    const riskCategories = {
      low: 0,
      moderate: 0,
      high: 0,
      critical: 0
    };
    
    // Helper to extract patient ID from reference
    const getPatientId = (reference) => {
      if (!reference) return null;
      // Handle both "Patient/123" and "urn:uuid:123" formats
      if (reference.includes('urn:uuid:')) {
        return reference.split(':').pop();
      }
      return reference.split('/').pop();
    };
    
    patients.forEach(patient => {
      if (!patient || !patient.id) return;
      
      let riskScore = 0;
      const patientId = patient.id;
      
      // Age risk
      if (patient.birthDate) {
        const birthDate = new Date(patient.birthDate);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        
        if (age >= 80) riskScore += 3;
        else if (age >= 65) riskScore += 2;
        else if (age >= 50) riskScore += 1;
      }
      
      // Chronic conditions
      const patientConditions = conditions.filter(c => {
        const conditionPatientId = getPatientId(c.subject?.reference);
        return conditionPatientId === patientId && c.clinicalStatus?.coding?.[0]?.code === 'active';
      });
      
      patientConditions.forEach(condition => {
        const codes = condition.code?.coding || [];
        const text = condition.code?.text?.toLowerCase() || '';
        
        // Score based on condition severity
        if (codes.some(c => c.code?.startsWith('E10') || c.code?.startsWith('E11')) || 
            text.includes('diabetes')) {
          riskScore += 2;
        }
        if (codes.some(c => c.code === 'I10') || text.includes('hypertension')) {
          riskScore += 1;
        }
        if (codes.some(c => c.code?.startsWith('I20') || c.code?.startsWith('I21') || 
            c.code?.startsWith('I50')) || text.includes('heart') || text.includes('cardiac')) {
          riskScore += 3;
        }
        if (codes.some(c => c.code?.startsWith('N18')) || text.includes('kidney') || 
            text.includes('renal')) {
          riskScore += 2;
        }
        if (codes.some(c => c.code?.startsWith('J44')) || text.includes('copd') || 
            text.includes('chronic obstructive')) {
          riskScore += 2;
        }
      });
      
      // Medication count (polypharmacy risk)
      const patientMeds = medications.filter(m => {
        const medPatientId = getPatientId(m.subject?.reference);
        return medPatientId === patientId && m.status === 'active';
      });
      
      if (patientMeds.length >= 15) riskScore += 3;
      else if (patientMeds.length >= 10) riskScore += 2;
      else if (patientMeds.length >= 5) riskScore += 1;
      
      // Recent abnormal vital signs
      const recentDate = new Date();
      recentDate.setMonth(recentDate.getMonth() - 3); // Last 3 months
      
      const recentObs = observations.filter(obs => {
        const obsPatientId = getPatientId(obs.subject?.reference);
        return obsPatientId === patientId && 
               obs.status === 'final' &&
               new Date(obs.effectiveDateTime || obs.issued) > recentDate;
      });
      
      // Check for abnormal vitals
      recentObs.forEach(obs => {
        const loincCode = obs.code?.coding?.find(c => c.system?.includes('loinc'))?.code;
        const value = obs.valueQuantity?.value;
        
        if (value) {
          // High blood pressure
          if (loincCode === '8480-6' && value > 140) riskScore += 1; // Systolic
          if (loincCode === '8462-4' && value > 90) riskScore += 1; // Diastolic
          // Abnormal heart rate
          if (loincCode === '8867-4' && (value < 60 || value > 100)) riskScore += 1;
          // Low oxygen saturation
          if (loincCode === '2708-6' && value < 95) riskScore += 2;
        }
      });
      
      // Categorize risk
      if (riskScore >= 10) riskCategories.critical++;
      else if (riskScore >= 6) riskCategories.high++;
      else if (riskScore >= 3) riskCategories.moderate++;
      else riskCategories.low++;
    });
    
    return Object.entries(riskCategories).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1) + ' Risk',
      value
    }));
  }, []);

  // Process FHIR data into analytics
  const processAnalyticsData = useCallback(() => {
    if (!fhirData || !fhirData.resources) {
      console.log('No FHIR data available for analytics');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Log available resources for debugging
      console.log('Available FHIR resources:', Object.keys(fhirData.resources).map(key => 
        `${key}: ${fhirData.resources[key]?.length || 0}`
      ));
      
      // Process demographics from Patient resources
      const patients = Array.isArray(fhirData.resources.Patient) ? fhirData.resources.Patient : [];
      console.log(`Processing ${patients.length} patients`);
      const demographics = processPatientDemographics(patients);
      setDemographicsData(demographics);
      
      // Process disease prevalence from Condition resources
      const conditions = Array.isArray(fhirData.resources.Condition) ? fhirData.resources.Condition : [];
      console.log(`Processing ${conditions.length} conditions`);
      const diseases = processDiseasePrevalence(conditions);
      setDiseasePrevalenceData(diseases);
      
      // Process medication patterns from MedicationRequest resources
      const medications = Array.isArray(fhirData.resources.MedicationRequest) ? fhirData.resources.MedicationRequest : [];
      console.log(`Processing ${medications.length} medication requests`);
      const medPatterns = processMedicationPatterns(medications);
      setMedicationPatternsData(medPatterns);
      
      // Process vital signs from Observation resources
      const observations = Array.isArray(fhirData.resources.Observation) ? fhirData.resources.Observation : [];
      console.log(`Processing ${observations.length} observations`);
      const vitals = processVitalSigns(observations);
      setVitalSignsData(vitals);
      
      // Calculate quality metrics
      const qualityMetrics = calculateQualityMetrics(patients, conditions, medications, observations);
      console.log('Quality metrics:', qualityMetrics);
      setQualityMetricsData(qualityMetrics);
      
      // Calculate risk scores
      const riskScores = calculateRiskScores(patients, conditions, medications, observations);
      console.log('Risk scores:', riskScores);
      setRiskScoresData(riskScores);
      
    } catch (err) {
      console.error('Error processing analytics data:', err);
      setError(err.message || 'Failed to process analytics data');
    } finally {
      setLoading(false);
    }
  }, [fhirData, calculateQualityMetrics, calculateRiskScores]);

  // Process patient demographics with more insights
  const processPatientDemographics = (patients) => {
    if (!Array.isArray(patients) || patients.length === 0) {
      return {
        ageGroups: [],
        genderDistribution: [],
        totalPatients: 0,
        averageAge: 0,
        raceDistribution: [],
        ethnicityDistribution: []
      };
    }
    
    const ageGroups = { '0-17': 0, '18-34': 0, '35-49': 0, '50-64': 0, '65-79': 0, '80+': 0 };
    const genderDistribution = { male: 0, female: 0, other: 0 };
    const raceDistribution = {};
    const ethnicityDistribution = {};
    let totalAge = 0;
    let ageCount = 0;
    
    patients.forEach(patient => {
      if (!patient) return;
      
      // Age calculation
      if (patient.birthDate) {
        const birthDate = new Date(patient.birthDate);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        
        totalAge += age;
        ageCount++;
        
        if (age < 18) ageGroups['0-17']++;
        else if (age < 35) ageGroups['18-34']++;
        else if (age < 50) ageGroups['35-49']++;
        else if (age < 65) ageGroups['50-64']++;
        else if (age < 80) ageGroups['65-79']++;
        else ageGroups['80+']++;
      }
      
      // Gender distribution
      const gender = patient.gender?.toLowerCase() || 'other';
      genderDistribution[gender] = (genderDistribution[gender] || 0) + 1;
      
      // Race distribution
      if (patient.extension) {
        const raceExt = patient.extension.find(ext => 
          ext.url === 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-race'
        );
        if (raceExt?.extension) {
          const ombCategory = raceExt.extension.find(e => e.url === 'ombCategory');
          if (ombCategory?.valueCoding?.display) {
            const race = ombCategory.valueCoding.display;
            raceDistribution[race] = (raceDistribution[race] || 0) + 1;
          }
        }
      }
      
      // Ethnicity distribution
      if (patient.extension) {
        const ethnicityExt = patient.extension.find(ext => 
          ext.url === 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity'
        );
        if (ethnicityExt?.extension) {
          const ombCategory = ethnicityExt.extension.find(e => e.url === 'ombCategory');
          if (ombCategory?.valueCoding?.display) {
            const ethnicity = ombCategory.valueCoding.display;
            ethnicityDistribution[ethnicity] = (ethnicityDistribution[ethnicity] || 0) + 1;
          }
        }
      }
    });
    
    return {
      ageGroups: Object.entries(ageGroups).map(([name, value]) => ({ name, value: value || 0 })),
      genderDistribution: Object.entries(genderDistribution)
        .map(([name, value]) => ({ 
          name: name.charAt(0).toUpperCase() + name.slice(1), 
          value: value || 0 
        })),
      raceDistribution: Object.entries(raceDistribution)
        .map(([name, value]) => ({ name, value: value || 0 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
      ethnicityDistribution: Object.entries(ethnicityDistribution)
        .map(([name, value]) => ({ name, value: value || 0 })),
      totalPatients: patients.length,
      averageAge: ageCount > 0 ? Math.round(totalAge / ageCount) : 0
    };
  };

  // Process disease prevalence - Only include actual clinical diagnoses
  const processDiseasePrevalence = (conditions) => {
    if (!Array.isArray(conditions) || conditions.length === 0) {
      return [];
    }
    
    const diseaseCount = {};
    
    conditions.forEach(condition => {
      if (!condition) return;
      
      // Filter out non-clinical conditions
      const category = condition.category?.[0]?.coding?.[0]?.code;
      const clinicalStatus = condition.clinicalStatus?.coding?.[0]?.code;
      
      // Only include problem-list-item and encounter-diagnosis categories
      // Exclude resolved conditions
      if (category && (category === 'problem-list-item' || category === 'encounter-diagnosis') && 
          clinicalStatus && clinicalStatus === 'active') {
        
        // Get the condition name from the best available source
        let conditionName = 'Unknown';
        if (condition.code?.coding?.[0]) {
          const coding = condition.code.coding[0];
          // Prefer display name, fallback to text
          conditionName = coding.display || condition.code.text || coding.code || 'Unknown';
        } else if (condition.code?.text) {
          conditionName = condition.code.text;
        }
        
        // Skip social history items
        const socialHistoryTerms = ['education', 'employment', 'housing', 'social', 'criminal', 'victim'];
        if (socialHistoryTerms.some(term => conditionName.toLowerCase().includes(term))) {
          return;
        }
        
        diseaseCount[conditionName] = (diseaseCount[conditionName] || 0) + 1;
      }
    });
    
    return Object.entries(diseaseCount)
      .map(([name, value]) => ({ 
        name: name.length > 40 ? name.substring(0, 37) + '...' : name, 
        value: value || 0,
        fullName: name
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10
  };

  // Process medication patterns - Group by therapeutic class
  const processMedicationPatterns = (medications) => {
    if (!Array.isArray(medications) || medications.length === 0) {
      return [];
    }
    
    const medClassCount = {};
    const activeOnly = medications.filter(med => {
      const status = med?.status;
      return status === 'active' || status === 'completed';
    });
    
    activeOnly.forEach(med => {
      if (!med) return;
      
      // Try to determine therapeutic class
      let therapeuticClass = 'Other';
      const medName = med.medicationCodeableConcept?.text || 
                      med.medicationCodeableConcept?.coding?.[0]?.display || '';
      
      // Simple classification based on common medication names
      const lowerName = medName.toLowerCase();
      if (lowerName.includes('statin') || lowerName.includes('atorvastatin') || 
          lowerName.includes('simvastatin') || lowerName.includes('rosuvastatin')) {
        therapeuticClass = 'Statins (Cholesterol)';
      } else if (lowerName.includes('metformin') || lowerName.includes('insulin') || 
                 lowerName.includes('glipizide')) {
        therapeuticClass = 'Diabetes Medications';
      } else if (lowerName.includes('lisinopril') || lowerName.includes('losartan') || 
                 lowerName.includes('amlodipine') || lowerName.includes('metoprolol')) {
        therapeuticClass = 'Cardiovascular';
      } else if (lowerName.includes('aspirin') || lowerName.includes('warfarin') || 
                 lowerName.includes('clopidogrel')) {
        therapeuticClass = 'Anticoagulants/Antiplatelets';
      } else if (lowerName.includes('omeprazole') || lowerName.includes('pantoprazole')) {
        therapeuticClass = 'Proton Pump Inhibitors';
      } else if (lowerName.includes('levothyroxine')) {
        therapeuticClass = 'Thyroid Medications';
      } else if (lowerName.includes('albuterol') || lowerName.includes('fluticasone')) {
        therapeuticClass = 'Respiratory';
      } else if (lowerName.includes('ibuprofen') || lowerName.includes('acetaminophen') || 
                 lowerName.includes('naproxen')) {
        therapeuticClass = 'Pain/Anti-inflammatory';
      } else if (lowerName.includes('sertraline') || lowerName.includes('escitalopram') || 
                 lowerName.includes('fluoxetine')) {
        therapeuticClass = 'Antidepressants';
      } else if (lowerName.includes('alprazolam') || lowerName.includes('lorazepam')) {
        therapeuticClass = 'Anxiolytics';
      } else if (lowerName.includes('amoxicillin') || lowerName.includes('azithromycin') || 
                 lowerName.includes('ciprofloxacin')) {
        therapeuticClass = 'Antibiotics';
      }
      
      medClassCount[therapeuticClass] = (medClassCount[therapeuticClass] || 0) + 1;
    });
    
    return Object.entries(medClassCount)
      .map(([name, value]) => ({ name, value: value || 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 classes
  };

  // Process vital signs with better categorization
  const processVitalSigns = (observations) => {
    const vitals = {};
    const vitalSignCodes = {
      '8480-6': 'systolic',
      '8462-4': 'diastolic',
      '8867-4': 'heartRate',
      '9279-1': 'respiratoryRate',
      '8310-5': 'temperature',
      '2708-6': 'oxygenSaturation',
      '29463-7': 'weight',
      '8302-2': 'height',
      '39156-5': 'bmi'
    };
    
    observations.forEach(obs => {
      if (!obs || obs.status !== 'final') return;
      
      const code = obs.code?.coding?.[0]?.code;
      const vitalType = vitalSignCodes[code];
      
      if (vitalType) {
        const value = obs.valueQuantity?.value;
        const unit = obs.valueQuantity?.unit || obs.valueQuantity?.code;
        const date = new Date(obs.effectiveDateTime || obs.issued || obs.meta?.lastUpdated);
        
        if (value && date && !isNaN(date.getTime())) {
          if (!vitals[vitalType]) vitals[vitalType] = [];
          vitals[vitalType].push({ 
            date: date.toISOString(), 
            value,
            unit,
            timestamp: date.getTime()
          });
        }
      }
    });
    
    // Sort by date for each vital type
    Object.keys(vitals).forEach(key => {
      vitals[key].sort((a, b) => a.timestamp - b.timestamp);
    });
    
    return vitals;
  };

  // Auto-refresh setup
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(processAnalyticsData, 30000); // Refresh every 30 seconds
      setRefreshInterval(interval);
      return () => clearInterval(interval);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [autoRefresh, processAnalyticsData]);

  // Initial data load
  useEffect(() => {
    processAnalyticsData();
  }, [processAnalyticsData]);

  // Export chart data
  const exportChartData = useCallback((data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);


  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    try {
      if (active && payload && Array.isArray(payload) && payload.length > 0) {
        return (
          <Paper sx={{ p: 2, border: '1px solid #ccc' }}>
            <Typography variant="body2" fontWeight="bold">{label || ''}</Typography>
            {payload.filter(entry => entry != null).map((entry, index) => {
              const percentage = entry?.payload?.percentage;
              const percentageText = percentage !== undefined && percentage !== null ? ` (${percentage.toFixed(1)}%)` : '';
              return (
                <Typography key={`tooltip-${index}`} variant="body2" color={entry?.color || 'inherit'}>
                  {`${entry?.name || 'Unknown'}: ${entry?.value || 0}${percentageText}`}
                </Typography>
              );
            })}
          </Paper>
        );
      }
    } catch (error) {
      console.error('Error in CustomTooltip:', error);
    }
    return null;
  };

  // Demographics Charts Tab
  const DemographicsTab = () => {
    const totalPatients = Math.max(demographicsData?.totalPatients || 0, 1);
    
    const ageGroupsWithPercentages = useMemo(() => {
      if (!demographicsData?.ageGroups) return [];
      return demographicsData.ageGroups
        .filter(item => item && typeof item.value === 'number' && item.value >= 0)
        .map(item => ({
          ...item,
          name: item.name || 'Unknown',
          value: item.value || 0,
          percentage: (item.value / totalPatients * 100)
        }));
    }, [demographicsData?.ageGroups, totalPatients]);
    
    const genderWithPercentages = useMemo(() => {
      if (!demographicsData?.genderDistribution) return [];
      return demographicsData.genderDistribution
        .filter(item => item && typeof item.value === 'number' && item.value >= 0)
        .map(item => ({
          ...item,
          name: item.name || 'Unknown',
          value: item.value || 0,
          percentage: (item.value / totalPatients * 100)
        }));
    }, [demographicsData?.genderDistribution, totalPatients]);
    
    if (!demographicsData || !demographicsData.ageGroups || !demographicsData.genderDistribution) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      );
    }

    return (
      <Grid container spacing={3}>
        {/* Key Metrics */}
        <Grid item xs={12}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                <CardContent>
                  <Typography variant="h4">{demographicsData.totalPatients}</Typography>
                  <Typography variant="body2">Total Patients</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'info.light', color: 'info.contrastText' }}>
                <CardContent>
                  <Typography variant="h4">{demographicsData.averageAge}</Typography>
                  <Typography variant="body2">Average Age</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'success.light', color: 'success.contrastText' }}>
                <CardContent>
                  <Typography variant="h4">
                    {demographicsData.genderDistribution.find(g => g.name === 'Male')?.value || 0}
                  </Typography>
                  <Typography variant="body2">Male Patients</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                <CardContent>
                  <Typography variant="h4">
                    {demographicsData.genderDistribution.find(g => g.name === 'Female')?.value || 0}
                  </Typography>
                  <Typography variant="body2">Female Patients</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>
        
        {/* Age Distribution */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Age Distribution"
              avatar={<PeopleIcon color="primary" />}
              action={
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <ChartTypeSelector
                    value={selectedChartType}
                    onChange={setSelectedChartType}
                    availableTypes={['bar', 'line', 'area', 'pie']}
                  />
                  <IconButton size="small" onClick={() => exportChartData(ageGroupsWithPercentages, 'age-distribution')}>
                    <DownloadIcon />
                  </IconButton>
                </Box>
              }
            />
            <CardContent>
              {Array.isArray(ageGroupsWithPercentages) && ageGroupsWithPercentages.length > 0 ? (
                <SafeChartWrapper height={300}>
                  {selectedChartType === 'bar' && (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={ageGroupsWithPercentages}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <RechartsTooltip />
                        <Bar dataKey="value" fill={CHART_COLORS[0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                  {selectedChartType === 'line' && (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={ageGroupsWithPercentages}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <RechartsTooltip />
                        <Line type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                  {selectedChartType === 'area' && (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={ageGroupsWithPercentages}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <RechartsTooltip />
                        <Area type="monotone" dataKey="value" fill={CHART_COLORS[0]} stroke={CHART_COLORS[0]} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                  {selectedChartType === 'pie' && (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={ageGroupsWithPercentages}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {ageGroupsWithPercentages.map((entry, index) => (
                            <Cell key={`cell-age-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </SafeChartWrapper>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                  <Typography variant="body2" color="text.secondary">No data available</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Gender Distribution */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Gender Distribution"
              avatar={<DonutIcon color="secondary" />}
              action={
                <IconButton size="small" onClick={() => exportChartData(genderWithPercentages, 'gender-distribution')}>
                  <DownloadIcon />
                </IconButton>
              }
            />
            <CardContent>
              {Array.isArray(genderWithPercentages) && genderWithPercentages.length > 0 ? (
                <SafeChartWrapper height={300}>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={genderWithPercentages}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {genderWithPercentages.map((entry, index) => (
                          <Cell key={`cell-gender-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </SafeChartWrapper>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                  <Typography variant="body2" color="text.secondary">No data available</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Race Distribution */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Race Distribution"
              avatar={<PeopleIcon color="info" />}
            />
            <CardContent>
              {Array.isArray(demographicsData?.raceDistribution) && demographicsData.raceDistribution.length > 0 ? (
                <SafeChartWrapper height={300}>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={demographicsData.raceDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({name, value, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {demographicsData.raceDistribution.map((entry, index) => (
                          <Cell key={`cell-race-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </SafeChartWrapper>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                  <Typography variant="body2" color="text.secondary">No race data available</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Ethnicity Distribution */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Ethnicity Distribution"
              avatar={<PeopleIcon color="warning" />}
            />
            <CardContent>
              {Array.isArray(demographicsData?.ethnicityDistribution) && demographicsData.ethnicityDistribution.length > 0 ? (
                <SafeChartWrapper height={300}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={demographicsData.ethnicityDistribution} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <RechartsTooltip />
                      <Bar dataKey="value" fill="#ff9800" />
                    </BarChart>
                  </ResponsiveContainer>
                </SafeChartWrapper>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                  <Typography variant="body2" color="text.secondary">No ethnicity data available</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Clinical Analytics Tab
  const ClinicalAnalyticsTab = () => {
    // Calculate total for percentage calculations
    const totalDiseases = diseasePrevalenceData?.reduce((sum, item) => sum + (item?.value || 0), 0) || 1;
    const totalMedications = medicationPatternsData?.reduce((sum, item) => sum + (item?.value || 0), 0) || 1;
    
    // Add percentage to disease data
    const diseaseData = (diseasePrevalenceData || []).map(item => ({
      ...item,
      percentage: (item.value / totalDiseases * 100)
    }));
    
    // Add percentage to medication data
    const medicationData = (medicationPatternsData || []).map(item => ({
      ...item,
      percentage: (item.value / totalMedications * 100)
    }));
    
    if (!diseasePrevalenceData && !medicationPatternsData && !qualityMetricsData && !riskScoresData) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      );
    }

    return (
      <Grid container spacing={3}>
        {/* Quality Metrics Cards */}
        {qualityMetricsData && (
          <Grid item xs={12}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                  <CardContent>
                    <Typography variant="h5">
                      {qualityMetricsData.diabeticPatients || 0}
                    </Typography>
                    <Typography variant="body2">Diabetic Patients</Typography>
                    {qualityMetricsData.diabeticPatients > 0 && (
                      <Typography variant="caption">
                        {Math.round((qualityMetricsData.diabeticsWithA1c / qualityMetricsData.diabeticPatients) * 100)}% with HbA1c
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ bgcolor: 'info.light', color: 'info.contrastText' }}>
                  <CardContent>
                    <Typography variant="h5">
                      {qualityMetricsData.hypertensivePatients || 0}
                    </Typography>
                    <Typography variant="body2">Hypertensive Patients</Typography>
                    {qualityMetricsData.hypertensivePatients > 0 && (
                      <Typography variant="caption">
                        {Math.round((qualityMetricsData.hypertensivesControlled / qualityMetricsData.hypertensivePatients) * 100)}% controlled
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ bgcolor: 'success.light', color: 'success.contrastText' }}>
                  <CardContent>
                    <Typography variant="h5">
                      {riskScoresData?.find(r => r.name === 'High Risk')?.value || 0}
                    </Typography>
                    <Typography variant="body2">High Risk Patients</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                  <CardContent>
                    <Typography variant="h5">
                      {riskScoresData?.find(r => r.name === 'Critical Risk')?.value || 0}
                    </Typography>
                    <Typography variant="body2">Critical Risk Patients</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Grid>
        )}

        {/* Clinical Conditions */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Clinical Diagnoses"
              avatar={<HealthIcon color="error" />}
              subheader={`Active conditions from ${demographicsData?.totalPatients || 0} patients`}
              action={
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Chip label={diseaseData.length} size="small" color="primary" />
                  <IconButton size="small" onClick={() => exportChartData(diseaseData, 'clinical-diagnoses')}>
                    <DownloadIcon />
                  </IconButton>
                </Box>
              }
            />
            <CardContent>
              {Array.isArray(diseaseData) && diseaseData.length > 0 ? (
                <SafeChartWrapper height={400}>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={diseaseData.slice(0, 10)} layout="horizontal" margin={{ top: 5, right: 30, left: 150, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={140} 
                        tick={{ fontSize: 11 }}
                        interval={0}
                      />
                      <RechartsTooltip 
                        content={({active, payload}) => {
                          if (active && payload && payload[0]) {
                            return (
                              <Paper sx={{ p: 1, border: '1px solid #ccc' }}>
                                <Typography variant="caption" display="block">
                                  {payload[0].payload.fullName || payload[0].payload.name}
                                </Typography>
                                <Typography variant="body2" color="primary">
                                  Count: {payload[0].value}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {payload[0].payload.percentage.toFixed(1)}% of all conditions
                                </Typography>
                              </Paper>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="value" fill={CHART_COLORS[3]} />
                    </BarChart>
                  </ResponsiveContainer>
                </SafeChartWrapper>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                  <Typography variant="body2" color="text.secondary">No active clinical diagnoses found</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Medication Classes */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Medication Therapeutic Classes"
              avatar={<MedicationIcon color="primary" />}
              subheader={`Active medications grouped by therapeutic class`}
              action={
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Chip 
                    label={`${medicationData.reduce((sum, m) => sum + m.value, 0)} active`} 
                    size="small" 
                    color="secondary" 
                  />
                  <IconButton size="small" onClick={() => exportChartData(medicationData, 'medication-classes')}>
                    <DownloadIcon />
                  </IconButton>
                </Box>
              }
            />
            <CardContent>
              {Array.isArray(medicationData) && medicationData.length > 0 ? (
                <SafeChartWrapper height={400}>
                  <ResponsiveContainer width="100%" height={400}>
                    <PieChart>
                      <Pie
                        data={medicationData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({name, percent}) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {medicationData.map((entry, index) => (
                          <Cell key={`cell-med-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </SafeChartWrapper>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                  <Typography variant="body2" color="text.secondary">No active medications found</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Risk Stratification */}
        {riskScoresData && riskScoresData.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardHeader
                title="Patient Risk Stratification"
                avatar={<WarningIcon color="warning" />}
                subheader="Based on age, chronic conditions, and medication count"
              />
              <CardContent>
                <SafeChartWrapper height={250}>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={riskScoresData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <RechartsTooltip />
                      <Bar dataKey="value" fill="#ff9800">
                        {riskScoresData.map((entry, index) => {
                          const colors = ['#4caf50', '#ff9800', '#f44336', '#d32f2f'];
                          return <Cell key={`cell-risk-${index}`} fill={colors[index]} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </SafeChartWrapper>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    );
  };

  // Vital Signs Tab
  const VitalSignsTab = () => {
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [selectedVitalType, setSelectedVitalType] = useState('Blood Pressure');
    
    const observations = fhirData?.resources?.Observation || [];
    const patients = fhirData?.resources?.Patient || [];
    
    // Helper to extract patient ID from reference
    const getPatientId = (reference) => {
      if (!reference) return null;
      if (reference.includes('urn:uuid:')) {
        return reference.split(':').pop();
      }
      return reference.split('/').pop();
    };
    
    // Group observations by patient and filter for vital signs only
    const patientVitalSigns = useMemo(() => {
      const grouped = {};
      const vitalSignCodes = ['8480-6', '8462-4', '8867-4', '9279-1', '8310-5', '2708-6', '29463-7', '8302-2', '39156-5'];
      
      observations.forEach(obs => {
        if (!obs || obs.status !== 'final') return;
        
        const loincCode = obs.code?.coding?.find(c => c.system?.includes('loinc'))?.code;
        if (!loincCode || !vitalSignCodes.includes(loincCode)) return;
        
        const patientId = getPatientId(obs.subject?.reference);
        if (patientId) {
          if (!grouped[patientId]) {
            grouped[patientId] = [];
          }
          grouped[patientId].push(obs);
        }
      });
      
      return grouped;
    }, [observations]);
    
    const patientIds = Object.keys(patientVitalSigns);
    
    // Set initial patient if not set
    useEffect(() => {
      if (!selectedPatientId && patientIds.length > 0) {
        setSelectedPatientId(patientIds[0]);
      }
    }, [selectedPatientId, patientIds]);
    
    // Get patient name
    const getPatientName = (patientId) => {
      const patient = patients.find(p => p.id === patientId);
      if (patient?.name?.[0]) {
        const name = patient.name[0];
        return `${name.given?.join(' ') || ''} ${name.family || ''}`.trim() || 'Unknown Patient';
      }
      return 'Unknown Patient';
    };
    
    // Process vital signs for selected patient
    const vitalSignsData = useMemo(() => {
      if (!selectedPatientId || !patientVitalSigns[selectedPatientId]) return {};
      
      return processVitalSigns(patientVitalSigns[selectedPatientId]);
    }, [selectedPatientId, patientVitalSigns]);
    
    return (
      <Grid container spacing={3}>
        {/* Patient and Vital Type Selection */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Select Patient</InputLabel>
                  <Select
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    label="Select Patient"
                  >
                    {patientIds.map(id => (
                      <MenuItem key={id} value={id}>
                        {getPatientName(id)} (ID: {id})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">
                  {patientVitalSigns[selectedPatientId]?.length || 0} vital sign observations
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
        
        {/* Vital Signs Chart */}
        {selectedPatientId && (
          <Grid item xs={12}>
            <VitalSignsChart
              observations={patientVitalSigns[selectedPatientId] || []}
              patientId={selectedPatientId}
              timeRange="30d"
            />
          </Grid>
        )}
        
        {/* Summary Statistics */}
        <Grid item xs={12}>
          <Card>
            <CardHeader
              title="Vital Signs Summary"
              avatar={<HealthIcon color="primary" />}
              subheader={`${patientIds.length} patients with vital sign data`}
            />
            <CardContent>
              <Grid container spacing={2}>
                {Object.entries(vitalSignsData).map(([key, data]) => {
                  if (!data || data.length === 0) return null;
                  const latest = data[data.length - 1];
                  return (
                    <Grid item xs={12} sm={6} md={3} key={key}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Latest {key.replace(/([A-Z])/g, ' $1').trim()}
                        </Typography>
                        <Typography variant="h6">
                          {latest.value} {latest.unit}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(latest.date).toLocaleDateString()}
                        </Typography>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Trends Tab
  const TrendsTab = () => {
    // Process time-series data for trends
    const trendsData = useMemo(() => {
      if (!fhirData?.resources) return [];
      
      const periodData = {};
      const now = new Date();
      
      // Define the date range based on aggregation period
      const getDateKey = (date) => {
        const d = new Date(date);
        if (!d || isNaN(d.getTime())) return null;
        
        switch (aggregationPeriod) {
          case 'day':
            return d.toISOString().split('T')[0];
          case 'week':
            const weekStart = new Date(d);
            weekStart.setDate(d.getDate() - d.getDay());
            return weekStart.toISOString().split('T')[0];
          case 'month':
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          case 'year':
            return String(d.getFullYear());
          default:
            return d.toISOString().split('T')[0];
        }
      };
      
      // Process each resource type
      Object.entries(fhirData.resources).forEach(([resourceType, resources]) => {
        if (!Array.isArray(resources)) return;
        
        resources.forEach(resource => {
          // Try multiple date fields
          let date = resource.meta?.lastUpdated || resource.effectiveDateTime || 
                     resource.authoredOn || resource.date || resource.issued ||
                     resource.recordedDate || resource.created;
          
          if (!date) return;
          
          const dateKey = getDateKey(date);
          if (!dateKey) return;
          
          if (!periodData[dateKey]) {
            periodData[dateKey] = {
              date: dateKey,
              Patient: 0,
              Encounter: 0,
              Observation: 0,
              Condition: 0,
              MedicationRequest: 0,
              Procedure: 0,
              DiagnosticReport: 0,
              AllergyIntolerance: 0
            };
          }
          
          if (periodData[dateKey][resourceType] !== undefined) {
            periodData[dateKey][resourceType]++;
          }
        });
      });
      
      // Sort by date and take last 30 periods
      const sortedData = Object.values(periodData)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30);
      
      // Format dates for display
      return sortedData.map(item => ({
        ...item,
        displayDate: aggregationPeriod === 'month' 
          ? new Date(item.date + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
          : item.date
      }));
    }, [fhirData, aggregationPeriod]);
    
    // Calculate growth metrics
    const growthMetrics = useMemo(() => {
      if (trendsData.length < 2) return null;
      
      const latest = trendsData[trendsData.length - 1];
      const previous = trendsData[trendsData.length - 2];
      
      const calculateGrowth = (resourceType) => {
        const current = latest[resourceType] || 0;
        const prev = previous[resourceType] || 0;
        const growth = prev > 0 ? ((current - prev) / prev) * 100 : 0;
        return { current, growth: growth.toFixed(1) };
      };
      
      return {
        Patient: calculateGrowth('Patient'),
        Encounter: calculateGrowth('Encounter'),
        Observation: calculateGrowth('Observation'),
        Condition: calculateGrowth('Condition'),
        MedicationRequest: calculateGrowth('MedicationRequest')
      };
    }, [trendsData]);
    
    return (
      <Grid container spacing={3}>
        {/* Growth Metrics */}
        {growthMetrics && (
          <Grid item xs={12}>
            <Grid container spacing={2}>
              {Object.entries(growthMetrics).map(([resourceType, metrics]) => (
                <Grid item xs={12} sm={6} md={2.4} key={resourceType}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      {resourceType}
                    </Typography>
                    <Typography variant="h6">
                      {metrics.current}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      color={metrics.growth > 0 ? 'success.main' : metrics.growth < 0 ? 'error.main' : 'text.secondary'}
                    >
                      {metrics.growth > 0 ? '+' : ''}{metrics.growth}%
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Grid>
        )}
        
        {/* Trends Chart */}
        <Grid item xs={12}>
          <Card>
            <CardHeader
              title="Resource Activity Trends"
              avatar={<TrendingUpIcon color="primary" />}
              subheader={`Showing ${trendsData.length} ${aggregationPeriod}s of data`}
              action={
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Period</InputLabel>
                  <Select value={aggregationPeriod} onChange={(e) => setAggregationPeriod(e.target.value)} label="Period">
                    <MenuItem value="day">Daily</MenuItem>
                    <MenuItem value="week">Weekly</MenuItem>
                    <MenuItem value="month">Monthly</MenuItem>
                    <MenuItem value="year">Yearly</MenuItem>
                  </Select>
                </FormControl>
              }
            />
            <CardContent>
              {Array.isArray(trendsData) && trendsData.length > 0 ? (
                <SafeChartWrapper height={400}>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={trendsData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="displayDate" 
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="Condition" 
                        stroke={CHART_COLORS[3]} 
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="MedicationRequest" 
                        stroke={CHART_COLORS[4]} 
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Observation" 
                        stroke={CHART_COLORS[2]} 
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Encounter" 
                        stroke={CHART_COLORS[1]} 
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Patient" 
                        stroke={CHART_COLORS[0]} 
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </SafeChartWrapper>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                  <Typography variant="body2" color="text.secondary">No trends data available</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  const tabLabels = useMemo(() => [
    { label: 'Demographics', icon: PeopleIcon },
    { label: 'Clinical Analytics', icon: AnalyticsIcon },
    { label: 'Vital Signs', icon: HealthIcon },
    { label: 'Trends', icon: TrendingUpIcon }
  ], []);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingUpIcon color="primary" />
          Data Charts
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControlLabel
            control={<Switch checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />}
            label="Auto-refresh"
          />
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={processAnalyticsData}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Status Information */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <Typography variant="body2" color="text.secondary">
              Real-time analytics from {fhirData?.totalResources || 0} FHIR resources
              {demographicsData?.totalPatients > 0 && (
                <> • {demographicsData.totalPatients} patients • Average age: {demographicsData.averageAge}</>
              )}
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              {loading ? (
                <Chip
                  label="Loading..."
                  color="warning"
                  size="small"
                />
              ) : (
                <Chip
                  label="Live Data"
                  color="success"
                  size="small"
                  icon={<AnalyticsIcon />}
                />
              )}
              {autoRefresh && (
                <Chip
                  label="Auto-refresh ON"
                  color="info"
                  size="small"
                  icon={<RefreshIcon />}
                />
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Tab Navigation */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={currentTab}
          onChange={(_, newValue) => setCurrentTab(newValue)}
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
        >
          {tabLabels.map((tab, index) => {
            if (!tab || !tab.label) return null;
            const TabIcon = tab.icon;
            return (
              <Tab
                key={`tab-${index}`}
                label={tab.label}
                icon={TabIcon ? <TabIcon /> : null}
                iconPosition="start"
              />
            );
          }).filter(Boolean)}
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <Box sx={{ mt: 3 }}>
        {currentTab === 0 && <DemographicsTab />}
        {currentTab === 1 && <ClinicalAnalyticsTab />}
        {currentTab === 2 && <VitalSignsTab />}
        {currentTab === 3 && <TrendsTab />}
      </Box>
    </Box>
  );
}

export default DataCharts;