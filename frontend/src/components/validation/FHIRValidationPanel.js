/**
 * FHIRValidationPanel Component
 * Interactive UI for FHIR resource validation with real-time feedback
 */
import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  IconButton,
  Tooltip,
  Stack,
  TextField,
  Switch,
  FormControlLabel,
  Divider,
  CircularProgress,
  
  LinearProgress
} from '@mui/material';
import SafeBadge from '../common/SafeBadge';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  Settings as SettingsIcon,
  Code as CodeIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material';
import { useResourceValidation, useFHIRValidation } from '../../hooks/useFHIRValidation';

const ValidationSummary = ({ validationResult, isValidating }) => {
  if (isValidating) {
    return (
      <Card variant="outlined">
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={24} />
          <Typography variant="body2">Validating resource...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (!validationResult) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            No validation results available
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const { isValid, errors, warnings, information } = validationResult;
  const totalIssues = errors.length + warnings.length + (information?.length || 0);

  return (
    <Card variant="outlined">
      <CardHeader
        avatar={
          isValid ? (
            <SuccessIcon color="success" />
          ) : (
            <ErrorIcon color="error" />
          )
        }
        title={
          <Typography variant="h6">
            Validation {isValid ? 'Passed' : 'Failed'}
          </Typography>
        }
        subheader={`${totalIssues} issue${totalIssues !== 1 ? 's' : ''} found`}
      />
      <CardContent sx={{ pt: 0 }}>
        <Stack direction="row" spacing={2}>
          {errors.length > 0 && (
            <Chip
              icon={<ErrorIcon />}
              label={`${errors.length} Error${errors.length !== 1 ? 's' : ''}`}
              color="error"
              size="small"
            />
          )}
          {warnings.length > 0 && (
            <Chip
              icon={<WarningIcon />}
              label={`${warnings.length} Warning${warnings.length !== 1 ? 's' : ''}`}
              color="warning"
              size="small"
            />
          )}
          {information && information.length > 0 && (
            <Chip
              icon={<InfoIcon />}
              label={`${information.length} Info`}
              color="info"
              size="small"
            />
          )}
          {totalIssues === 0 && (
            <Chip
              icon={<SuccessIcon />}
              label="No Issues"
              color="success"
              size="small"
            />
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

const ValidationIssuesList = ({ issues, severity, expanded = false }) => {
  if (!issues || issues.length === 0) return null;

  const getIcon = () => {
    switch (severity) {
      case 'error': return <ErrorIcon color="error" />;
      case 'warning': return <WarningIcon color="warning" />;
      case 'information': return <InfoIcon color="info" />;
      default: return <InfoIcon />;
    }
  };

  const getColor = () => {
    switch (severity) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'information': return 'info';
      default: return 'primary'; // Use primary color for default badges
    }
  };

  return (
    <Accordion defaultExpanded={expanded}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {getIcon()}
          <Typography variant="subtitle2">
            {severity.charAt(0).toUpperCase() + severity.slice(1)}s ({issues.length})
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <List dense>
          {issues.map((issue, index) => (
            <ListItem key={index}>
              <ListItemIcon>
                <SafeBadge badgeContent={index + 1} color={getColor()} max={999}>
                  {getIcon()}
                </SafeBadge>
              </ListItemIcon>
              <ListItemText
                primary={issue.message}
                secondary={issue.path ? `Path: ${issue.path}` : undefined}
                primaryTypographyProps={{ variant: 'body2' }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
          ))}
        </List>
      </AccordionDetails>
    </Accordion>
  );
};

const ValidationSettings = ({ options, onOptionsChange }) => {
  return (
    <Card variant="outlined">
      <CardHeader
        avatar={<SettingsIcon />}
        title="Validation Settings"
        titleTypographyProps={{ variant: 'subtitle1' }}
      />
      <CardContent>
        <Stack spacing={2}>
          <FormControlLabel
            control={
              <Switch
                checked={options.strictMode || false}
                onChange={(e) => onOptionsChange({ ...options, strictMode: e.target.checked })}
              />
            }
            label="Strict Mode"
          />
          <FormControlLabel
            control={
              <Switch
                checked={options.validateReferences !== false}
                onChange={(e) => onOptionsChange({ ...options, validateReferences: e.target.checked })}
              />
            }
            label="Validate References"
          />
          <FormControlLabel
            control={
              <Switch
                checked={options.validateCoding !== false}
                onChange={(e) => onOptionsChange({ ...options, validateCoding: e.target.checked })}
              />
            }
            label="Validate Coding"
          />
          <FormControlLabel
            control={
              <Switch
                checked={options.validateProfiles || false}
                onChange={(e) => onOptionsChange({ ...options, validateProfiles: e.target.checked })}
              />
            }
            label="Validate Profiles"
          />
        </Stack>
      </CardContent>
    </Card>
  );
};

const ResourceEditor = ({ resource, onChange, onValidate }) => {
  const [resourceText, setResourceText] = useState(
    resource ? JSON.stringify(resource, null, 2) : ''
  );
  const [parseError, setParseError] = useState(null);

  const handleResourceChange = (value) => {
    setResourceText(value);
    setParseError(null);
    
    try {
      const parsed = JSON.parse(value);
      onChange(parsed);
    } catch (error) {
      setParseError(error.message);
    }
  };

  return (
    <Card variant="outlined">
      <CardHeader
        avatar={<CodeIcon />}
        title="FHIR Resource"
        titleTypographyProps={{ variant: 'subtitle1' }}
        action={
          <Button
            variant="outlined"
            size="small"
            startIcon={<AssignmentIcon />}
            onClick={onValidate}
          >
            Validate
          </Button>
        }
      />
      <CardContent>
        <TextField
          multiline
          fullWidth
          rows={15}
          value={resourceText}
          onChange={(e) => handleResourceChange(e.target.value)}
          placeholder="Paste your FHIR resource JSON here..."
          error={!!parseError}
          helperText={parseError}
          variant="outlined"
          sx={{
            '& .MuiInputBase-root': {
              fontFamily: 'monospace',
              fontSize: '0.875rem'
            }
          }}
        />
      </CardContent>
    </Card>
  );
};

const FHIRValidationPanel = ({ initialResource = null, onResourceChange }) => {
  const [resource, setResource] = useState(initialResource);
  const [options, setOptions] = useState({
    strictMode: false,
    validateReferences: true,
    validateCoding: true,
    validateProfiles: false
  });

  const { clearCache, getValidationStats, updateOptions } = useFHIRValidation(options);
  const { validationResult, isValidating, revalidate } = useResourceValidation(resource, options);

  const stats = useMemo(() => getValidationStats(), [getValidationStats, validationResult]);

  const handleResourceChange = (newResource) => {
    setResource(newResource);
    onResourceChange?.(newResource);
  };

  const handleOptionsChange = (newOptions) => {
    setOptions(newOptions);
    updateOptions(newOptions);
  };

  const handleClearCache = () => {
    clearCache();
    revalidate();
  };

  return (
    <Box sx={{ p: 2 }}>
      <Paper elevation={0} sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" component="h1">
            FHIR Resource Validation
          </Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh Validation">
              <IconButton onClick={revalidate} disabled={isValidating}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Clear Cache">
              <IconButton onClick={handleClearCache}>
                <ClearIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        {/* Stats */}
        {stats.cacheSize > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Validation cache: {stats.cacheSize} resources, {stats.totalErrors} errors, {stats.totalWarnings} warnings
          </Alert>
        )}

        {/* Loading indicator */}
        {isValidating && <LinearProgress sx={{ mb: 2 }} />}

        <Stack spacing={3}>
          {/* Resource Editor */}
          <ResourceEditor
            resource={resource}
            onChange={handleResourceChange}
            onValidate={revalidate}
          />

          {/* Validation Summary */}
          <ValidationSummary
            validationResult={validationResult}
            isValidating={isValidating}
          />

          {/* Validation Issues */}
          {validationResult && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Validation Details
              </Typography>
              
              <Stack spacing={1}>
                <ValidationIssuesList
                  issues={validationResult.errors}
                  severity="error"
                  expanded={validationResult.errors.length > 0}
                />
                
                <ValidationIssuesList
                  issues={validationResult.warnings}
                  severity="warning"
                  expanded={false}
                />
                
                {validationResult.information && (
                  <ValidationIssuesList
                    issues={validationResult.information}
                    severity="information"
                    expanded={false}
                  />
                )}
              </Stack>
            </Box>
          )}

          <Divider />

          {/* Settings */}
          <ValidationSettings
            options={options}
            onOptionsChange={handleOptionsChange}
          />
        </Stack>
      </Paper>
    </Box>
  );
};

export default FHIRValidationPanel;