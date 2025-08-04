/**
 * Dashboard Data Service
 * Efficiently fetches and processes FHIR data for dashboard displays
 */

import { fhirClient } from '../../core/fhir/services/fhirClient';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

class DashboardDataService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get patient population statistics
   */
  async getPopulationStats() {
    const cacheKey = 'population-stats';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      // Fetch various patient statistics in parallel
      const [
        totalPatients,
        activePatients,
        conditions,
        medications,
        allergies
      ] = await Promise.all([
        fhirClient.search('Patient', { _summary: 'count' }),
        fhirClient.search('Encounter', { 
          status: 'in-progress,arrived',
          _summary: 'count' 
        }),
        fhirClient.search('Condition', {
          'clinical-status': 'active',
          _summary: 'count'
        }),
        fhirClient.search('MedicationRequest', {
          status: 'active',
          _summary: 'count'
        }),
        fhirClient.search('AllergyIntolerance', {
          'clinical-status': 'active',
          _summary: 'count'
        })
      ]);

      const stats = {
        totalPatients: totalPatients.total || 0,
        activePatients: activePatients.total || 0,
        activeConditions: conditions.total || 0,
        activeMedications: medications.total || 0,
        activeAllergies: allergies.total || 0,
        timestamp: new Date().toISOString()
      };

      this.setCache(cacheKey, stats);
      return stats;
    } catch (error) {
      console.error('Error fetching population stats:', error);
      return {
        totalPatients: 0,
        activePatients: 0,
        activeConditions: 0,
        activeMedications: 0,
        activeAllergies: 0,
        error: true
      };
    }
  }

  /**
   * Get chronic disease registry data
   */
  async getChronicDiseaseStats() {
    const cacheKey = 'chronic-disease-stats';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      // Common chronic disease SNOMED codes
      const diseaseQueries = [
        { name: 'Diabetes', code: '44054006', icon: '🩸' },
        { name: 'Hypertension', code: '38341003', icon: '❤️' },
        { name: 'Heart Failure', code: '84114007', icon: '💔' },
        { name: 'COPD', code: '13645005', icon: '🫁' },
        { name: 'Asthma', code: '195967001', icon: '💨' },
        { name: 'CKD', code: '709044004', icon: '🩺' }
      ];

      const diseaseStats = await Promise.all(
        diseaseQueries.map(async (disease) => {
          const result = await fhirClient.search('Condition', {
            code: disease.code,
            'clinical-status': 'active',
            _summary: 'count'
          });
          return {
            ...disease,
            count: result.total || 0,
            percentage: 0 // Will calculate after getting total
          };
        })
      );

      // Get total patient count for percentage calculation
      const totalPatients = await fhirClient.search('Patient', { _summary: 'count' });
      const total = totalPatients.total || 1;

      // Calculate percentages
      diseaseStats.forEach(stat => {
        stat.percentage = Math.round((stat.count / total) * 100);
      });

      const data = {
        diseases: diseaseStats,
        totalPatients: total,
        timestamp: new Date().toISOString()
      };

      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching chronic disease stats:', error);
      return { diseases: [], error: true };
    }
  }

  /**
   * Get care gaps for preventive care
   */
  async getCareGaps() {
    const cacheKey = 'care-gaps';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const today = new Date();
      const oneYearAgo = subDays(today, 365);
      
      // Check for various preventive care measures
      const [
        totalPatients,
        fluVaccinations,
        a1cTests,
        mammograms,
        colonoscopies
      ] = await Promise.all([
        fhirClient.search('Patient', { _summary: 'count' }),
        fhirClient.search('Immunization', {
          'vaccine-code': '88', // Influenza vaccine
          date: `ge${oneYearAgo.toISOString()}`,
          _summary: 'count'
        }),
        fhirClient.search('Observation', {
          code: '4548-4', // A1C
          date: `ge${subDays(today, 180).toISOString()}`, // Last 6 months
          _summary: 'count'
        }),
        fhirClient.search('Procedure', {
          code: '71651007', // Mammography
          date: `ge${subDays(today, 730).toISOString()}`, // Last 2 years
          _summary: 'count'
        }),
        fhirClient.search('Procedure', {
          code: '73761001', // Colonoscopy
          date: `ge${subDays(today, 3650).toISOString()}`, // Last 10 years
          _summary: 'count'
        })
      ]);

      const total = totalPatients.total || 1;

      // For diabetes patients, get actual count
      const diabetesConditions = await fhirClient.search('Condition', {
        code: '44054006', // Type 2 diabetes
        'clinical-status': 'active',
        _summary: 'count'
      });
      const diabetesPatients = diabetesConditions.total || Math.floor(total * 0.1);

      const gaps = [
        {
          measure: 'Flu Vaccination',
          description: 'Annual flu shot',
          completed: fluVaccinations.total || 0,
          eligible: total,
          percentage: Math.min(100, Math.round(((fluVaccinations.total || 0) / Math.max(1, total)) * 100)),
          icon: '💉',
          color: '#4caf50'
        },
        {
          measure: 'Diabetes A1C',
          description: 'A1C test in last 6 months',
          completed: Math.min(a1cTests.total || 0, diabetesPatients),
          eligible: diabetesPatients,
          percentage: 0,
          icon: '🩸',
          color: '#ff9800'
        },
        {
          measure: 'Mammography',
          description: 'Breast cancer screening',
          completed: mammograms.total || 0,
          eligible: Math.floor(total * 0.25), // Estimate 25% eligible
          percentage: 0,
          icon: '🎗️',
          color: '#e91e63'
        },
        {
          measure: 'Colonoscopy',
          description: 'Colorectal cancer screening',
          completed: colonoscopies.total || 0,
          eligible: Math.floor(total * 0.3), // Estimate 30% eligible
          percentage: 0,
          icon: '🔍',
          color: '#2196f3'
        }
      ];

      // Calculate percentages for measures with eligible populations
      gaps.forEach(gap => {
        if (gap.eligible > 0 && gap.percentage === 0) {
          gap.percentage = Math.min(100, Math.round((gap.completed / gap.eligible) * 100));
        }
      });

      const data = {
        gaps,
        totalPatients: total,
        timestamp: new Date().toISOString()
      };

      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching care gaps:', error);
      return { gaps: [], error: true };
    }
  }

  /**
   * Get medication safety data
   */
  async getMedicationSafetyStats() {
    const cacheKey = 'medication-safety';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      // For demo purposes, generate realistic-looking data
      const totalPatients = await fhirClient.search('Patient', { _summary: 'count' });
      const total = totalPatients.total || 1;

      // Generate realistic counts based on total patients
      const safetyStats = [
        { 
          category: 'Anticoagulants', 
          count: Math.floor(total * 0.15), // ~15% of patients
          icon: '💊',
          risk: 'high',
          description: 'Warfarin, Apixaban, Rivaroxaban'
        },
        { 
          category: 'Insulin', 
          count: Math.floor(total * 0.08), // ~8% of patients
          icon: '💉',
          risk: 'high',
          description: 'All insulin formulations'
        },
        { 
          category: 'Opioids', 
          count: Math.floor(total * 0.05), // ~5% of patients
          icon: '⚠️',
          risk: 'critical',
          description: 'Oxycodone, Morphine, Fentanyl'
        },
        { 
          category: 'Benzodiazepines', 
          count: Math.floor(total * 0.04), // ~4% of patients
          icon: '😴',
          risk: 'high',
          description: 'Lorazepam, Alprazolam, Diazepam'
        }
      ];

      // Polypharmacy count - realistic estimate
      const polypharmacyCount = Math.floor(total * 0.12); // ~12% of patients

      // Safety incidents (mock data for demo)
      const safetyIncidents = [
        { type: 'Medication Error', count: 3, trend: 'down', severity: 'moderate' },
        { type: 'Patient Falls', count: 2, trend: 'stable', severity: 'high' },
        { type: 'Healthcare Associated Infections', count: 1, trend: 'down', severity: 'critical' },
        { type: 'Pressure Injuries', count: 0, trend: 'stable', severity: 'moderate' },
        { type: 'Wrong Site Surgery', count: 0, trend: 'stable', severity: 'critical' }
      ];

      // Clinical alerts
      const clinicalAlerts = [
        {
          id: 1,
          type: 'Drug Interaction',
          severity: 'high',
          patient: 'Smith, John',
          message: 'Warfarin + Aspirin interaction detected',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          status: 'active'
        },
        {
          id: 2,
          type: 'Critical Lab',
          severity: 'critical',
          patient: 'Johnson, Mary',
          message: 'Potassium 6.8 mEq/L (Critical High)',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          status: 'acknowledged'
        },
        {
          id: 3,
          type: 'Allergy Alert',
          severity: 'high',
          patient: 'Williams, Robert',
          message: 'Penicillin allergy - Amoxicillin ordered',
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          status: 'resolved'
        }
      ];

      const data = {
        highRiskCategories: safetyStats,
        polypharmacy: {
          count: polypharmacyCount,
          threshold: 5,
          icon: '💊💊💊'
        },
        safetyIncidents,
        clinicalAlerts,
        totalActiveMedications: Math.floor(total * 0.65), // Estimate ~65% of patients on meds
        timestamp: new Date().toISOString()
      };

      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching medication safety stats:', error);
      return { highRiskCategories: [], polypharmacy: { count: 0 }, error: true };
    }
  }

  /**
   * Get trending data for visualizations
   */
  async getTrendingData(days = 30) {
    const cacheKey = `trending-${days}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const endDate = new Date();
      const startDate = subDays(endDate, days);

      // Fetch encounters for the period
      const encounters = await fhirClient.search('Encounter', {
        date: `ge${startDate.toISOString()}`,
        _count: 500,
        _sort: 'date'
      });

      // Process encounters by date
      const encountersByDate = {};
      const encounterTypes = {};

      (encounters.resources || []).forEach(enc => {
        // Count by date
        const date = enc.period?.start || enc.date;
        if (date) {
          const dateKey = format(new Date(date), 'yyyy-MM-dd');
          encountersByDate[dateKey] = (encountersByDate[dateKey] || 0) + 1;
        }

        // Count by type
        const type = enc.type?.[0]?.text || enc.type?.[0]?.coding?.[0]?.display || 'Unknown';
        encounterTypes[type] = (encounterTypes[type] || 0) + 1;
      });

      // Create daily trend data
      const trendData = [];
      for (let i = 0; i < days; i++) {
        const date = subDays(endDate, days - i - 1);
        const dateKey = format(date, 'yyyy-MM-dd');
        trendData.push({
          date: dateKey,
          encounters: encountersByDate[dateKey] || 0,
          dayOfWeek: format(date, 'EEE')
        });
      }

      // Get top encounter types
      const topTypes = Object.entries(encounterTypes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([type, count]) => ({ type, count }));

      const data = {
        dailyTrend: trendData,
        encounterTypes: topTypes,
        totalEncounters: encounters.total || 0,
        averagePerDay: Math.round((encounters.total || 0) / days),
        timestamp: new Date().toISOString()
      };

      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching trending data:', error);
      return { dailyTrend: [], encounterTypes: [], error: true };
    }
  }

  /**
   * Cache management
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
  }
}

export default new DashboardDataService();