/**
 * SMART Consent Screen Component
 *
 * Displays authorization consent for SMART app launch.
 * Shows the app details and requested permissions (scopes)
 * for user approval or denial.
 *
 * Educational Purpose:
 * Demonstrates OAuth2 consent flow where users:
 * - Review what app is requesting access
 * - Understand what data will be shared
 * - Approve or deny the authorization
 *
 * @module ConsentScreen
 */
import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Divider,
  Alert,
  CircularProgress,
  Chip,
  Collapse,
  IconButton,
  Paper
} from '@mui/material';
import {
  Check as CheckIcon,
  Close as CloseIcon,
  Security as SecurityIcon,
  Visibility as ReadIcon,
  Edit as WriteIcon,
  Person as PatientIcon,
  AccountCircle as UserIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';

import { useSMART } from '../../contexts/SMARTContext';

// ============================================================================
// Scope Configuration
// ============================================================================

const SCOPE_CONFIG = {
  // Launch scopes
  launch: {
    icon: <SecurityIcon />,
    category: 'launch',
    risk: 'low',
    description: 'Launch from within the EHR with context'
  },
  'launch/patient': {
    icon: <PatientIcon />,
    category: 'launch',
    risk: 'low',
    description: 'Receive the current patient context'
  },
  'launch/encounter': {
    icon: <SecurityIcon />,
    category: 'launch',
    risk: 'low',
    description: 'Receive the current encounter context'
  },

  // Identity scopes
  openid: {
    icon: <UserIcon />,
    category: 'identity',
    risk: 'low',
    description: 'Authenticate your identity'
  },
  fhirUser: {
    icon: <UserIcon />,
    category: 'identity',
    risk: 'low',
    description: 'Access your FHIR user profile'
  },
  profile: {
    icon: <UserIcon />,
    category: 'identity',
    risk: 'low',
    description: 'Access basic profile information'
  },
  offline_access: {
    icon: <SecurityIcon />,
    category: 'identity',
    risk: 'medium',
    description: 'Maintain access when you\'re not using the app'
  },

  // Wildcard resource scopes
  'patient/*.read': {
    icon: <ReadIcon />,
    category: 'data',
    risk: 'high',
    description: 'Read ALL patient health information'
  },
  'patient/*.write': {
    icon: <WriteIcon />,
    category: 'data',
    risk: 'critical',
    description: 'Create and modify ALL patient data'
  },
  'user/*.read': {
    icon: <ReadIcon />,
    category: 'data',
    risk: 'high',
    description: 'Read all data accessible to you'
  },
  'user/*.write': {
    icon: <WriteIcon />,
    category: 'data',
    risk: 'critical',
    description: 'Modify all data accessible to you'
  }
};

// Resource-specific scope patterns
const RESOURCE_SCOPES = {
  Patient: { display: 'Demographics', icon: <PatientIcon /> },
  Observation: { display: 'Vitals & Labs', icon: <ReadIcon /> },
  Condition: { display: 'Conditions', icon: <ReadIcon /> },
  MedicationRequest: { display: 'Medications', icon: <ReadIcon /> },
  AllergyIntolerance: { display: 'Allergies', icon: <WarningIcon /> },
  Procedure: { display: 'Procedures', icon: <ReadIcon /> },
  DiagnosticReport: { display: 'Reports', icon: <ReadIcon /> },
  Encounter: { display: 'Encounters', icon: <ReadIcon /> },
  Immunization: { display: 'Immunizations', icon: <ReadIcon /> },
  DocumentReference: { display: 'Documents', icon: <ReadIcon /> }
};

/**
 * Parse a scope into display information
 */
const parseScopeDisplay = (scope) => {
  // Check for exact match
  if (SCOPE_CONFIG[scope]) {
    return {
      scope,
      ...SCOPE_CONFIG[scope],
      display: scope
    };
  }

  // Parse resource-specific scopes (e.g., patient/Observation.read)
  const match = scope.match(/^(patient|user)\/(\*|[A-Z][a-zA-Z]+)\.(\*|read|write)$/);
  if (match) {
    const [, context, resource, action] = match;
    const isRead = action === 'read';
    const resourceInfo = RESOURCE_SCOPES[resource] || { display: resource, icon: <ReadIcon /> };

    return {
      scope,
      icon: isRead ? <ReadIcon /> : <WriteIcon />,
      category: 'data',
      risk: isRead ? 'low' : 'medium',
      display: `${isRead ? 'Read' : 'Write'} ${resourceInfo.display}`,
      description: `${isRead ? 'View' : 'Modify'} ${resourceInfo.display.toLowerCase()} data`,
      resource,
      action,
      context
    };
  }

  // Unknown scope
  return {
    scope,
    icon: <SecurityIcon />,
    category: 'unknown',
    risk: 'medium',
    display: scope,
    description: `Access: ${scope}`
  };
};

// ============================================================================
// Sub-Components
// ============================================================================

const RiskIndicator = ({ risk }) => {
  const config = {
    low: { color: 'success', label: 'Low Risk' },
    medium: { color: 'warning', label: 'Medium Risk' },
    high: { color: 'error', label: 'High Risk' },
    critical: { color: 'error', label: 'Critical' }
  };

  const { color, label } = config[risk] || config.medium;

  return (
    <Chip
      label={label}
      size="small"
      color={color}
      variant="outlined"
      sx={{ ml: 1, height: 20, fontSize: '0.65rem', borderRadius: 0 }}
    />
  );
};

const ScopeCategory = ({ title, scopes, expanded, onToggle }) => {
  if (!scopes.length) return null;

  return (
    <Box sx={{ mb: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          py: 1,
          px: 1,
          bgcolor: 'grey.50',
          '&:hover': { bgcolor: 'grey.100' }
        }}
        onClick={onToggle}
      >
        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
        <Chip
          label={scopes.length}
          size="small"
          sx={{ mr: 1, height: 20, fontSize: '0.7rem', borderRadius: 0 }}
        />
        {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      </Box>

      <Collapse in={expanded}>
        <List dense disablePadding>
          {scopes.map((scopeInfo, index) => (
            <ListItem
              key={scopeInfo.scope}
              sx={{
                py: 1,
                borderBottom: index < scopes.length - 1 ? '1px solid' : 'none',
                borderColor: 'divider'
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                {scopeInfo.icon}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2">{scopeInfo.display}</Typography>
                    <RiskIndicator risk={scopeInfo.risk} />
                  </Box>
                }
                secondary={scopeInfo.description}
              />
            </ListItem>
          ))}
        </List>
      </Collapse>
    </Box>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const ConsentScreen = ({
  open,
  sessionId,
  onApprove,
  onDeny,
  onClose
}) => {
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [consentData, setConsentData] = useState(null);
  const [approving, setApproving] = useState(false);
  const [denying, setDenying] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({
    data: true,
    identity: true,
    launch: false
  });

  // Context
  const { getConsentData, approveConsent, denyConsent } = useSMART();

  // Load consent data
  useEffect(() => {
    const loadConsentData = async () => {
      if (!sessionId) return;

      setLoading(true);
      setError(null);

      try {
        const data = await getConsentData(sessionId);
        setConsentData(data);
      } catch (err) {
        console.error('Failed to load consent data:', err);
        setError('Failed to load authorization request');
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      loadConsentData();
    }
  }, [sessionId, open, getConsentData]);

  // Parse and categorize scopes
  const categorizedScopes = useMemo(() => {
    if (!consentData?.scopes) return { data: [], identity: [], launch: [] };

    const parsed = consentData.scopes.map(parseScopeDisplay);

    return {
      data: parsed.filter(s => s.category === 'data'),
      identity: parsed.filter(s => s.category === 'identity'),
      launch: parsed.filter(s => s.category === 'launch'),
      unknown: parsed.filter(s => s.category === 'unknown')
    };
  }, [consentData]);

  // Check for high-risk scopes
  const hasHighRiskScopes = useMemo(() => {
    return Object.values(categorizedScopes)
      .flat()
      .some(s => s.risk === 'high' || s.risk === 'critical');
  }, [categorizedScopes]);

  // Handlers
  const handleToggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      const result = await approveConsent(sessionId, {
        grantedScopes: consentData.scopes
      });
      onApprove?.(result);
    } catch (err) {
      setError('Failed to approve authorization');
    } finally {
      setApproving(false);
    }
  };

  const handleDeny = async () => {
    setDenying(true);
    try {
      const result = await denyConsent(sessionId, 'User denied access');
      onDeny?.(result);
    } catch (err) {
      setError('Failed to deny authorization');
    } finally {
      setDenying(false);
    }
  };

  // Render
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 0 } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SecurityIcon color="primary" />
          <Typography variant="h6" component="span">
            Authorization Request
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ borderRadius: 0 }}>
            {error}
          </Alert>
        ) : consentData ? (
          <>
            {/* App Information */}
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                mb: 3,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                borderRadius: 0
              }}
            >
              <Avatar
                src={consentData.app?.logo_uri}
                sx={{ width: 56, height: 56, borderRadius: 0 }}
              >
                {consentData.app?.name?.charAt(0) || 'A'}
              </Avatar>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6">
                  {consentData.app?.name || 'Unknown App'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {consentData.app?.description || 'No description available'}
                </Typography>
              </Box>
            </Paper>

            {/* Warning for high-risk scopes */}
            {hasHighRiskScopes && (
              <Alert
                severity="warning"
                sx={{ mb: 2, borderRadius: 0 }}
                icon={<WarningIcon />}
              >
                <Typography variant="body2" fontWeight={600}>
                  This app is requesting broad access to patient data.
                </Typography>
                <Typography variant="caption">
                  Review the permissions carefully before approving.
                </Typography>
              </Alert>
            )}

            {/* Patient Context */}
            {consentData.patient && (
              <Box
                sx={{
                  p: 1.5,
                  mb: 2,
                  bgcolor: 'primary.50',
                  borderLeft: '4px solid',
                  borderColor: 'primary.main'
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  For patient:
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {consentData.patient.display || consentData.patient.id}
                </Typography>
              </Box>
            )}

            {/* Scope Categories */}
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
              <SecurityIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
              Requested Permissions
            </Typography>

            <Divider sx={{ mb: 2 }} />

            {categorizedScopes.data.length > 0 && (
              <ScopeCategory
                title="Patient Data Access"
                scopes={categorizedScopes.data}
                expanded={expandedCategories.data}
                onToggle={() => handleToggleCategory('data')}
              />
            )}

            {categorizedScopes.identity.length > 0 && (
              <ScopeCategory
                title="Identity & Authentication"
                scopes={categorizedScopes.identity}
                expanded={expandedCategories.identity}
                onToggle={() => handleToggleCategory('identity')}
              />
            )}

            {categorizedScopes.launch.length > 0 && (
              <ScopeCategory
                title="Launch Context"
                scopes={categorizedScopes.launch}
                expanded={expandedCategories.launch}
                onToggle={() => handleToggleCategory('launch')}
              />
            )}

            {/* Educational Note */}
            <Box
              sx={{
                p: 2,
                mt: 2,
                bgcolor: 'info.50',
                borderLeft: '4px solid',
                borderColor: 'info.main'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <InfoIcon fontSize="small" color="info" />
                <Typography variant="caption" fontWeight={600}>
                  Educational Note
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                This consent screen demonstrates OAuth2 authorization.
                When you approve, the app receives a token that grants
                access only to the scopes listed above. The token expires
                after a set time, and you can revoke access at any time.
              </Typography>
            </Box>
          </>
        ) : null}
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button
          onClick={handleDeny}
          disabled={loading || approving}
          startIcon={denying ? <CircularProgress size={16} /> : <CloseIcon />}
          color="inherit"
          sx={{ borderRadius: 0 }}
        >
          {denying ? 'Denying...' : 'Deny'}
        </Button>

        <Button
          onClick={handleApprove}
          disabled={loading || denying}
          variant="contained"
          color="primary"
          startIcon={approving ? <CircularProgress size={16} /> : <CheckIcon />}
          sx={{ borderRadius: 0 }}
        >
          {approving ? 'Approving...' : 'Approve Access'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

ConsentScreen.propTypes = {
  open: PropTypes.bool.isRequired,
  sessionId: PropTypes.string,
  onApprove: PropTypes.func,
  onDeny: PropTypes.func,
  onClose: PropTypes.func
};

export default ConsentScreen;
