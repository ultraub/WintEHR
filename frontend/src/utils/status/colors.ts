/**
 * Status Color Utilities
 *
 * Centralized color functions for clinical status, priority, and severity indicators.
 * Extracted from clinicalHelpers.js for better organization and reusability.
 */

import { Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

/**
 * Status types used across clinical workflows
 */
export type ClinicalStatus =
  | 'active' | 'inactive' | 'pending' | 'completed' | 'cancelled'
  | 'draft' | 'in-progress' | 'stopped' | 'on-hold' | 'entered-in-error' | 'unknown';

export type Priority = 'routine' | 'urgent' | 'asap' | 'stat' | 'normal' | 'high' | 'low';

export type Severity = 'high' | 'moderate' | 'low' | 'severe' | 'mild' | 'life-threatening' | 'normal';

export type ResultStatus = 'final' | 'preliminary' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';

export type ClinicalCardType = 'problem' | 'medication' | 'allergy' | 'lab' | 'imaging' | 'default';

/**
 * Get color based on clinical status
 * @param status - The status value
 * @param theme - MUI theme object
 * @returns Color value from theme palette
 */
export const getStatusColor = (status: string | undefined, theme: Theme): string => {
  const statusColors: Record<string, string> = {
    active: theme.palette.success.main,
    inactive: theme.palette.grey[500],
    pending: theme.palette.warning.main,
    completed: theme.palette.info.main,
    cancelled: theme.palette.error.main,
    draft: theme.palette.grey[400],
    'in-progress': theme.palette.primary.main,
    stopped: theme.palette.error.light,
    'on-hold': theme.palette.warning.light,
    'entered-in-error': theme.palette.error.dark,
    unknown: theme.palette.grey[400]
  };

  return statusColors[status?.toLowerCase() ?? ''] || statusColors.unknown;
};

/**
 * Get color based on priority level
 * @param priority - The priority value
 * @param theme - MUI theme object
 * @returns Color value from theme palette
 */
export const getPriorityColor = (priority: string | undefined, theme: Theme): string => {
  const priorityColors: Record<string, string> = {
    routine: theme.palette.info.main,
    urgent: theme.palette.warning.main,
    asap: theme.palette.warning.dark,
    stat: theme.palette.error.main,
    normal: theme.palette.info.main,
    high: theme.palette.warning.main,
    low: theme.palette.success.main
  };

  return priorityColors[priority?.toLowerCase() ?? ''] || priorityColors.normal;
};

/**
 * Get color based on clinical severity
 * @param severity - The severity value
 * @param theme - MUI theme object
 * @returns Color value from theme palette
 */
export const getSeverityColor = (severity: string | undefined, theme: Theme): string => {
  const severityColors: Record<string, string> = {
    high: theme.palette.error.main,
    moderate: theme.palette.warning.main,
    low: theme.palette.info.main,
    severe: theme.palette.error.dark,
    mild: theme.palette.success.main,
    'life-threatening': theme.palette.error.dark,
    normal: theme.palette.success.main
  };

  return severityColors[severity?.toLowerCase() ?? ''] || severityColors.normal;
};

/**
 * Get color based on result status
 * @param status - The result status
 * @param theme - MUI theme object
 * @returns Color value from theme palette
 */
export const getResultStatusColor = (status: string | undefined, theme: Theme): string => {
  const statusColors: Record<string, string> = {
    final: theme.palette.success.main,
    preliminary: theme.palette.warning.main,
    amended: theme.palette.info.main,
    corrected: theme.palette.warning.dark,
    cancelled: theme.palette.error.main,
    'entered-in-error': theme.palette.error.dark,
    unknown: theme.palette.grey[400]
  };

  return statusColors[status?.toLowerCase() ?? ''] || statusColors.unknown;
};

/**
 * Get background color for clinical cards
 * @param type - The card type
 * @param theme - MUI theme object
 * @returns Background color with alpha transparency
 */
export const getClinicalCardBackground = (type: ClinicalCardType, theme: Theme): string => {
  const backgrounds: Record<ClinicalCardType, string> = {
    problem: alpha(theme.palette.warning.main, 0.05),
    medication: alpha(theme.palette.primary.main, 0.05),
    allergy: alpha(theme.palette.error.main, 0.05),
    lab: alpha(theme.palette.info.main, 0.05),
    imaging: alpha(theme.palette.secondary.main, 0.05),
    default: theme.palette.background.paper
  };

  return backgrounds[type] || backgrounds.default;
};

/**
 * Clinical alert level type
 */
export type AlertLevel = 'critical' | 'warning' | 'info' | 'none';

/**
 * Get clinical alert level based on item type and values
 * @param item - Clinical item to evaluate
 * @param type - Item type (lab, medication, allergy, problem)
 * @returns Alert level
 */
export const getClinicalAlertLevel = (item: Record<string, unknown> | null, type: string): AlertLevel => {
  if (!item) return 'none';

  switch (type) {
    case 'lab': {
      const interpretation = item.interpretation as { coding?: Array<{ code?: string }> } | undefined;
      const code = interpretation?.coding?.[0]?.code;
      if (code === 'H' || code === 'L') return 'warning';
      if (code === 'HH' || code === 'LL') return 'critical';
      break;
    }

    case 'medication': {
      const status = item.status as string | undefined;
      const priority = item.priority as string | undefined;
      if (status === 'stopped' || status === 'cancelled') return 'info';
      if (priority === 'stat') return 'critical';
      break;
    }

    case 'allergy': {
      const criticality = item.criticality as string | undefined;
      const verificationStatus = item.verificationStatus as { coding?: Array<{ code?: string }> } | undefined;
      if (criticality === 'high') return 'critical';
      if (verificationStatus?.coding?.[0]?.code === 'unconfirmed') return 'warning';
      break;
    }

    case 'problem': {
      const severity = item.severity as { coding?: Array<{ code?: string }> } | undefined;
      const clinicalStatus = item.clinicalStatus as { coding?: Array<{ code?: string }> } | undefined;
      if (severity?.coding?.[0]?.code === 'severe') return 'critical';
      if (clinicalStatus?.coding?.[0]?.code === 'active') return 'warning';
      break;
    }
  }

  return 'none';
};
