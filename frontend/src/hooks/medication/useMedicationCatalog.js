/**
 * Medication Catalog Hook
 * Provides access to medication catalog data
 */

import { useState, useEffect } from 'react';
import { cdsClinicalDataService } from '../../services/cdsClinicalDataService';

export const useMedicationCatalog = () => {
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadMedications = async () => {
      try {
        setLoading(true);
        const catalog = await cdsClinicalDataService.getMedicationCatalog();
        setMedications(catalog || []);
      } catch (err) {
        console.error('Error loading medication catalog:', err);
        setError(err.message || 'Failed to load medications');
        
        // Fallback to some sample medications for demo
        setMedications([
          {
            name: 'Warfarin',
            strength: '5',
            unit: 'mg',
            form: 'tablet',
            rxnormCode: '855332',
            commonDose: 5
          },
          {
            name: 'Aspirin',
            strength: '81',
            unit: 'mg',
            form: 'tablet',
            rxnormCode: '243670',
            commonDose: 81
          },
          {
            name: 'Metformin',
            strength: '1000',
            unit: 'mg',
            form: 'tablet',
            rxnormCode: '860974',
            commonDose: 1000
          },
          {
            name: 'Lisinopril',
            strength: '10',
            unit: 'mg',
            form: 'tablet',
            rxnormCode: '314076',
            commonDose: 10
          },
          {
            name: 'Ibuprofen',
            strength: '800',
            unit: 'mg',
            form: 'tablet',
            rxnormCode: '197805',
            commonDose: 800
          },
          {
            name: 'Simvastatin',
            strength: '40',
            unit: 'mg',
            form: 'tablet',
            rxnormCode: '36567',
            commonDose: 40
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadMedications();
  }, []);

  return {
    medications,
    loading,
    error
  };
};