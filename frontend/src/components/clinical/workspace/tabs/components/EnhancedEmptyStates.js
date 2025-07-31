/**
 * Enhanced Empty State Components for Clinical Workspace
 * Provides helpful illustrations, actionable suggestions, and encouraging language
 */
import React from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  Paper,
  useTheme,
  alpha,
  Avatar
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Assignment as TaskIcon,
  LocalHospital as MedicalIcon,
  Science as LabIcon,
  Medication as MedicationIcon,
  Vaccines as VaccinesIcon,
  Image as ImagingIcon,
  Description as DocumentIcon,
  Timeline as TimelineIcon,
  TrendingUp as TrendingUpIcon,
  Help as HelpIcon,
  Lightbulb as IdeaIcon,
  CheckCircle as SuccessIcon,
  Info as InfoIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { InteractiveButton } from './EnhancedInteractions';
import { getSmoothTransition, getBorderRadius } from '../../../../../themes/clinicalThemeUtils';

/**
 * Base empty state component with consistent styling
 */
const BaseEmptyState = ({ 
  icon, 
  title, 
  description, 
  actions, 
  severity = 'info',
  size = 'medium',
  sx = {} 
}) => {
  const theme = useTheme();
  
  const sizeConfig = {
    small: { iconSize: 40, spacing: 1, titleVariant: 'h6', descVariant: 'body2' },
    medium: { iconSize: 64, spacing: 2, titleVariant: 'h5', descVariant: 'body1' },
    large: { iconSize: 80, spacing: 3, titleVariant: 'h4', descVariant: 'h6' }
  };
  
  const severityConfig = {
    info: { 
      color: theme.palette.info.main, 
      bg: alpha(theme.palette.info.main, 0.05),
      border: alpha(theme.palette.info.main, 0.2)
    },
    success: { 
      color: theme.palette.success.main, 
      bg: alpha(theme.palette.success.main, 0.05),
      border: alpha(theme.palette.success.main, 0.2)
    },
    warning: { 
      color: theme.palette.warning.main, 
      bg: alpha(theme.palette.warning.main, 0.05),
      border: alpha(theme.palette.warning.main, 0.2)
    },
    neutral: { 
      color: theme.palette.grey[500], 
      bg: alpha(theme.palette.grey[300], 0.05),
      border: alpha(theme.palette.grey[300], 0.2)
    }
  };
  
  const config = sizeConfig[size];
  const severityStyle = severityConfig[severity];
  
  return (
    <Paper
      elevation={0}
      sx={{
        p: 4,
        textAlign: 'center',
        backgroundColor: severityStyle.bg,
        border: `1px solid ${severityStyle.border}`,
        borderRadius: getBorderRadius('lg'),
        ...getSmoothTransition(['background-color', 'border-color']),
        ...sx
      }}
    >
      <Stack spacing={config.spacing} alignItems="center">
        {icon && (
          <Avatar
            sx={{
              width: config.iconSize,
              height: config.iconSize,
              backgroundColor: alpha(severityStyle.color, 0.1),
              color: severityStyle.color,
              fontSize: config.iconSize * 0.5,
              ...getSmoothTransition(['background-color', 'color'])
            }}
          >
            {icon}
          </Avatar>
        )}
        
        <Box>
          <Typography 
            variant={config.titleVariant} 
            sx={{ 
              fontWeight: 600, 
              color: 'text.primary',
              mb: 0.5
            }}
          >
            {title}
          </Typography>
          
          {description && (
            <Typography 
              variant={config.descVariant} 
              color="text.secondary"
              sx={{ maxWidth: 400, mx: 'auto', lineHeight: 1.6 }}
            >
              {description}
            </Typography>
          )}
        </Box>
        
        {actions && (
          <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center">
            {actions}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
};

/**
 * Empty state for conditions
 */
export const EmptyConditions = ({ onAdd }) => (
  <BaseEmptyState
    icon={<MedicalIcon />}
    title="No Active Conditions"
    description="This patient currently has no documented active conditions. Add a condition to start building their clinical profile."
    severity="success"
    actions={[
      <InteractiveButton
        key="add"
        startIcon={<AddIcon />}
        onClick={onAdd}
        variant="contained"
        color="primary"
        hoverEffect="lift"
      >
        Add Condition
      </InteractiveButton>
    ]}
  />
);

/**
 * Empty state for medications
 */
export const EmptyMedications = ({ onAdd }) => (
  <BaseEmptyState
    icon={<MedicationIcon />}
    title="No Active Medications"
    description="No medications are currently prescribed for this patient. Start building their medication profile by adding prescriptions."
    severity="info"
    actions={[
      <InteractiveButton
        key="add"
        startIcon={<AddIcon />}
        onClick={onAdd}
        variant="contained"
        color="primary"
        hoverEffect="lift"
      >
        Prescribe Medication
      </InteractiveButton>
    ]}
  />
);

/**
 * Empty state for allergies
 */
export const EmptyAllergies = ({ onAdd }) => (
  <BaseEmptyState
    icon={<SuccessIcon />}
    title="No Known Allergies"
    description="Great news! This patient has no documented allergies. You can add any allergies discovered during care."
    severity="success"
    actions={[
      <InteractiveButton
        key="add"
        startIcon={<AddIcon />}
        onClick={onAdd}
        variant="outlined"
        color="success"
        hoverEffect="lift"
      >
        Document Allergy
      </InteractiveButton>
    ]}
  />
);

/**
 * Empty state for immunizations
 */
export const EmptyImmunizations = ({ onAdd }) => (
  <BaseEmptyState
    icon={<VaccinesIcon />}
    title="No Immunization Records"
    description="No immunizations have been recorded for this patient. Add vaccination history to ensure complete preventive care."
    severity="warning"
    actions={[
      <InteractiveButton
        key="add"
        startIcon={<AddIcon />}
        onClick={onAdd}
        variant="contained"
        color="warning"
        hoverEffect="lift"
      >
        Add Immunization
      </InteractiveButton>
    ]}
  />
);

/**
 * Empty state for procedures
 */
export const EmptyProcedures = ({ onAdd }) => (
  <BaseEmptyState
    icon={<TaskIcon />}
    title="No Procedure Records"
    description="No procedures have been documented for this patient. Add any past or planned procedures to maintain comprehensive records."
    severity="info"
    actions={[
      <InteractiveButton
        key="add"
        startIcon={<AddIcon />}
        onClick={onAdd}
        variant="contained"
        color="primary"
        hoverEffect="lift"
      >
        Document Procedure
      </InteractiveButton>
    ]}
  />
);

/**
 * Empty state for care plans
 */
export const EmptyCarePlans = ({ onAdd }) => (
  <BaseEmptyState
    icon={<TimelineIcon />}
    title="No Care Plans"
    description="No care plans have been created for this patient. Develop structured care plans to guide treatment and coordinate care."
    severity="info"
    actions={[
      <InteractiveButton
        key="add"
        startIcon={<AddIcon />}
        onClick={onAdd}
        variant="contained"
        color="primary"
        hoverEffect="lift"
      >
        Create Care Plan
      </InteractiveButton>
    ]}
  />
);

/**
 * Empty state for clinical documents
 */
export const EmptyDocuments = ({ onAdd }) => (
  <BaseEmptyState
    icon={<DocumentIcon />}
    title="No Clinical Documents"
    description="No clinical documents have been uploaded for this patient. Add reports, images, or other clinical documentation."
    severity="neutral"
    actions={[
      <InteractiveButton
        key="add"
        startIcon={<AddIcon />}
        onClick={onAdd}
        variant="contained"
        color="primary"
        hoverEffect="lift"
      >
        Upload Document
      </InteractiveButton>
    ]}
  />
);

/**
 * Empty state for encounters
 */
export const EmptyEncounters = () => (
  <BaseEmptyState
    icon={<MedicalIcon />}
    title="No Recent Encounters"
    description="No recent encounters are available for this patient. Encounters will appear here as they are created during patient visits."
    severity="neutral"
  />
);

/**
 * Empty state for lab results
 */
export const EmptyLabResults = ({ onOrder }) => (
  <BaseEmptyState
    icon={<LabIcon />}
    title="No Lab Results"
    description="No laboratory results are available for this patient. Order lab tests to begin tracking clinical values and trends."
    severity="info"
    actions={onOrder ? [
      <InteractiveButton
        key="order"
        startIcon={<AddIcon />}
        onClick={onOrder}
        variant="contained"
        color="primary"
        hoverEffect="lift"
      >
        Order Lab Tests
      </InteractiveButton>
    ] : undefined}
  />
);

/**
 * Empty state for imaging results
 */
export const EmptyImagingResults = ({ onOrder }) => (
  <BaseEmptyState
    icon={<ImagingIcon />}
    title="No Imaging Studies"
    description="No imaging studies are available for this patient. Order imaging studies to support diagnostic and treatment decisions."
    severity="info"
    actions={onOrder ? [
      <InteractiveButton
        key="order"
        startIcon={<AddIcon />}
        onClick={onOrder}
        variant="contained"
        color="primary"
        hoverEffect="lift"
      >
        Order Imaging
      </InteractiveButton>
    ] : undefined}
  />
);

/**
 * Empty state for vitals/observations
 */
export const EmptyVitals = () => (
  <BaseEmptyState
    icon={<TrendingUpIcon />}
    title="No Vital Signs"
    description="No vital signs have been recorded for this patient. Vital signs will appear here once they are documented during visits."
    severity="neutral"
    size="small"
  />
);

/**
 * Empty search results
 */
export const EmptySearchResults = ({ query, onClear }) => (
  <BaseEmptyState
    icon={<SearchIcon />}
    title="No Results Found"
    description={`No results match "${query}". Try adjusting your search terms or clearing filters.`}
    severity="neutral"
    size="small"
    actions={onClear ? [
      <InteractiveButton
        key="clear"
        onClick={onClear}
        variant="outlined"
        size="small"
        hoverEffect="scale"
      >
        Clear Search
      </InteractiveButton>
    ] : undefined}
  />
);

/**
 * Loading failed state
 */
export const LoadingFailed = ({ onRetry, error }) => (
  <BaseEmptyState
    icon={<WarningIcon />}
    title="Unable to Load Data"
    description={error ? `Error: ${error.message}` : "There was a problem loading the data. Please try again."}
    severity="warning"
    size="small"
    actions={onRetry ? [
      <InteractiveButton
        key="retry"
        onClick={onRetry}
        variant="contained"
        color="warning"
        size="small"
        hoverEffect="lift"
      >
        Try Again
      </InteractiveButton>
    ] : undefined}
  />
);

/**
 * Generic helpful empty state with tips
 */
export const HelpfulEmptyState = ({ 
  icon = <IdeaIcon />, 
  title, 
  description, 
  tips = [],
  actions,
  severity = 'info'
}) => (
  <BaseEmptyState
    icon={icon}
    title={title}
    description={
      <Box>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>
        {tips.length > 0 && (
          <Box sx={{ textAlign: 'left', maxWidth: 400, mx: 'auto' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              💡 Helpful Tips:
            </Typography>
            <Box component="ul" sx={{ pl: 2, m: 0 }}>
              {tips.map((tip, index) => (
                <Typography 
                  key={index} 
                  component="li" 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ mb: 0.5 }}
                >
                  {tip}
                </Typography>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    }
    severity={severity}
    actions={actions}
  />
);

export default {
  BaseEmptyState,
  EmptyConditions,
  EmptyMedications,
  EmptyAllergies,
  EmptyImmunizations,
  EmptyProcedures,
  EmptyCarePlans,
  EmptyDocuments,
  EmptyEncounters,
  EmptyLabResults,
  EmptyImagingResults,
  EmptyVitals,
  EmptySearchResults,
  LoadingFailed,
  HelpfulEmptyState
};