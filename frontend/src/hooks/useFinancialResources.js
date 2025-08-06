import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFHIRResource } from '../contexts/FHIRResourceContext';
import { usePatientResourceType } from './useFHIRResources';

/**
 * Hook for managing all financial-related FHIR resources
 * Includes Coverage, Claim, ExplanationOfBenefit, and Account resources
 */
export function useFinancialResources(patientId, autoLoad = true) {
  const coverage = usePatientResourceType(patientId, 'Coverage', autoLoad);
  const claims = usePatientResourceType(patientId, 'Claim', autoLoad);
  const explanationOfBenefits = usePatientResourceType(patientId, 'ExplanationOfBenefit', autoLoad);
  const accounts = usePatientResourceType(patientId, 'Account', autoLoad);

  const loading = coverage.loading || claims.loading || explanationOfBenefits.loading || accounts.loading;
  const error = coverage.error || claims.error || explanationOfBenefits.error || accounts.error;

  // Coverage analysis
  const activeCoverage = useMemo(() => {
    const now = new Date();
    return coverage.resources.filter(cov => {
      if (cov.status !== 'active') return false;
      
      if (cov.period) {
        const start = cov.period.start ? new Date(cov.period.start) : null;
        const end = cov.period.end ? new Date(cov.period.end) : null;
        
        if (start && now < start) return false;
        if (end && now > end) return false;
      }
      
      return true;
    });
  }, [coverage.resources]);

  const primaryCoverage = useMemo(() => {
    return activeCoverage.find(cov => cov.order === 1) || activeCoverage[0];
  }, [activeCoverage]);

  // Claims analysis
  const claimsByStatus = useMemo(() => {
    const grouped = {};
    claims.resources.forEach(claim => {
      const status = claim.status || 'unknown';
      if (!grouped[status]) grouped[status] = [];
      grouped[status].push(claim);
    });
    return grouped;
  }, [claims.resources]);

  const recentClaims = useMemo(() => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    return claims.resources.filter(claim => {
      const claimDate = new Date(claim.created || claim.meta?.lastUpdated || '1970-01-01');
      return claimDate >= sixMonthsAgo;
    }).sort((a, b) => {
      const dateA = new Date(a.created || a.meta?.lastUpdated || '1970-01-01');
      const dateB = new Date(b.created || b.meta?.lastUpdated || '1970-01-01');
      return dateB - dateA;
    });
  }, [claims.resources]);

  // EOB analysis
  const eobsByStatus = useMemo(() => {
    const grouped = {};
    explanationOfBenefits.resources.forEach(eob => {
      const status = eob.status || 'unknown';
      if (!grouped[status]) grouped[status] = [];
      grouped[status].push(eob);
    });
    return grouped;
  }, [explanationOfBenefits.resources]);

  const totalPayments = useMemo(() => {
    return explanationOfBenefits.resources.reduce((total, eob) => {
      const payment = eob.payment?.amount?.value || 0;
      return total + payment;
    }, 0);
  }, [explanationOfBenefits.resources]);

  const totalAdjudications = useMemo(() => {
    let totalCharged = 0;
    let totalPaid = 0;
    let totalPatientResponsibility = 0;

    explanationOfBenefits.resources.forEach(eob => {
      eob.item?.forEach(item => {
        // Sum up adjudications
        item.adjudication?.forEach(adj => {
          const category = adj.category?.coding?.[0]?.code;
          const amount = adj.amount?.value || 0;
          
          switch (category) {
            case 'submitted':
            case 'eligible':
              totalCharged += amount;
              break;
            case 'benefit':
            case 'paid':
              totalPaid += amount;
              break;
            case 'deductible':
            case 'copay':
            case 'coinsurance':
              totalPatientResponsibility += amount;
              break;
          }
        });
      });
    });

    return {
      totalCharged,
      totalPaid,
      totalPatientResponsibility,
      totalOutstanding: totalCharged - totalPaid - totalPatientResponsibility
    };
  }, [explanationOfBenefits.resources]);

  // Account analysis
  const activeAccounts = useMemo(() => {
    return accounts.resources.filter(account => account.status === 'active');
  }, [accounts.resources]);

  const accountBalances = useMemo(() => {
    return accounts.resources.reduce((total, account) => {
      const balance = account.balance?.[0]?.amount?.value || 0;
      return total + balance;
    }, 0);
  }, [accounts.resources]);

  // Financial summary
  const financialSummary = useMemo(() => {
    if (loading) return null;

    return {
      coverage: {
        total: coverage.resources.length,
        active: activeCoverage.length,
        primary: primaryCoverage ? 1 : 0
      },
      claims: {
        total: claims.resources.length,
        recent: recentClaims.length,
        byStatus: Object.keys(claimsByStatus).reduce((acc, status) => {
          acc[status] = claimsByStatus[status].length;
          return acc;
        }, {})
      },
      explanationOfBenefits: {
        total: explanationOfBenefits.resources.length,
        totalPayments,
        adjudications: totalAdjudications,
        byStatus: Object.keys(eobsByStatus).reduce((acc, status) => {
          acc[status] = eobsByStatus[status].length;
          return acc;
        }, {})
      },
      accounts: {
        total: accounts.resources.length,
        active: activeAccounts.length,
        totalBalance: accountBalances
      }
    };
  }, [
    loading, coverage.resources.length, activeCoverage.length, primaryCoverage,
    claims.resources.length, recentClaims.length, claimsByStatus,
    explanationOfBenefits.resources.length, totalPayments, totalAdjudications, eobsByStatus,
    accounts.resources.length, activeAccounts.length, accountBalances
  ]);

  const refresh = useCallback(async () => {
    await Promise.all([
      coverage.refresh(),
      claims.refresh(),
      explanationOfBenefits.refresh(),
      accounts.refresh()
    ]);
  }, [coverage.refresh, claims.refresh, explanationOfBenefits.refresh, accounts.refresh]);

  return {
    // Raw resources
    coverage: coverage.resources,
    claims: claims.resources,
    explanationOfBenefits: explanationOfBenefits.resources,
    accounts: accounts.resources,
    
    // Processed data
    activeCoverage,
    primaryCoverage,
    claimsByStatus,
    recentClaims,
    eobsByStatus,
    totalPayments,
    totalAdjudications,
    activeAccounts,
    accountBalances,
    financialSummary,
    
    // State
    loading,
    error,
    refresh,
    isEmpty: !loading && coverage.resources.length === 0 && claims.resources.length === 0 && 
             explanationOfBenefits.resources.length === 0 && accounts.resources.length === 0
  };
}

/**
 * Hook for managing coverage/insurance specifically
 */
export function useCoverage(patientId, autoLoad = true) {
  const baseHook = usePatientResourceType(patientId, 'Coverage', autoLoad);
  
  const coverage = useMemo(() => {
    return baseHook.resources.sort((a, b) => {
      const dateA = new Date(a.period?.start || a.meta?.lastUpdated || '1970-01-01');
      const dateB = new Date(b.period?.start || b.meta?.lastUpdated || '1970-01-01');
      return dateB - dateA;
    });
  }, [baseHook.resources]);

  const activeCoverage = useMemo(() => {
    const now = new Date();
    return coverage.filter(cov => {
      if (cov.status !== 'active') return false;
      
      if (cov.period) {
        const start = cov.period.start ? new Date(cov.period.start) : null;
        const end = cov.period.end ? new Date(cov.period.end) : null;
        
        if (start && now < start) return false;
        if (end && now > end) return false;
      }
      
      return true;
    });
  }, [coverage]);

  const primaryCoverage = useMemo(() => {
    return activeCoverage.find(cov => cov.order === 1) || activeCoverage[0];
  }, [activeCoverage]);

  const coverageByPayer = useMemo(() => {
    const grouped = {};
    coverage.forEach(cov => {
      const payer = cov.payor?.[0]?.display || 'Unknown Payer';
      if (!grouped[payer]) grouped[payer] = [];
      grouped[payer].push(cov);
    });
    return grouped;
  }, [coverage]);

  return {
    ...baseHook,
    coverage,
    activeCoverage,
    primaryCoverage,
    coverageByPayer
  };
}

export default useFinancialResources;