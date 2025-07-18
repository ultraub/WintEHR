/**
 * Query Validator Component
 * 
 * Validates FHIR queries and provides helpful feedback
 */

import React, { useMemo } from 'react';
import {
  Box,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Chip,
  Stack,
  Collapse,
  IconButton,
  LinearProgress,
  Paper
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Build as BuildIcon
} from '@mui/icons-material';

// Validation rules
const VALIDATION_RULES = {
  // Required checks
  resourceType: {
    level: 'error',
    check: (query) => !!query.resourceType,
    message: 'Resource type is required',
    fix: 'Select a resource type from the list'
  },
  
  // Parameter checks
  parameterValues: {
    level: 'error',
    check: (query) => {
      return query.searchParams.every(param => 
        param.name && param.value
      );
    },
    message: 'All search parameters must have both name and value',
    fix: 'Fill in missing parameter names or values'
  },
  
  // Date format checks
  dateFormat: {
    level: 'warning',
    check: (query) => {
      const dateParams = query.searchParams.filter(param => 
        param.name && param.name.includes('date') || param.name.includes('time')
      );
      const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}Z?)?$/;
      const comparatorRegex = /^(eq|ne|lt|le|gt|ge|sa|eb|ap)?\d{4}-\d{2}-\d{2}/;
      
      return dateParams.every(param => 
        dateRegex.test(param.value) || comparatorRegex.test(param.value)
      );
    },
    message: 'Date values should be in YYYY-MM-DD format',
    fix: 'Use format: 2024-01-15 or gt2024-01-15 for comparisons'
  },
  
  // Token format checks
  tokenFormat: {
    level: 'info',
    check: (query, resourceDef) => {
      if (!resourceDef) return true;
      
      const tokenParams = query.searchParams.filter(param => {
        const paramDef = resourceDef.searchParams?.[param.name];
        return paramDef?.type === 'token';
      });
      
      return tokenParams.every(param => {
        // Check for system|code format or just code
        return !param.value.includes(' ') || param.value.includes('|');
      });
    },
    message: 'Token parameters work best with system|code format',
    fix: 'Example: http://loinc.org|1234-5'
  },
  
  // Reference format checks
  referenceFormat: {
    level: 'warning',
    check: (query, resourceDef) => {
      if (!resourceDef) return true;
      
      const refParams = query.searchParams.filter(param => {
        const paramDef = resourceDef.searchParams?.[param.name];
        return paramDef?.type === 'reference';
      });
      
      const refRegex = /^[A-Z][a-zA-Z]*\/[a-zA-Z0-9\-\.]+$/;
      return refParams.every(param => 
        refRegex.test(param.value) || param.value.includes('/')
      );
    },
    message: 'Reference parameters should be in format: ResourceType/id',
    fix: 'Example: Patient/123 or Organization/abc'
  },
  
  // _has parameter validation
  hasParamFormat: {
    level: 'error',
    check: (query) => {
      return query.hasParams.every(param => 
        param.resource && param.reference && param.searchParam && param.value
      );
    },
    message: 'All _has parameters must be complete',
    fix: 'Fill in all fields for _has parameters'
  },
  
  // Composite parameter validation
  compositeParamFormat: {
    level: 'error',
    check: (query) => {
      return query.compositeParams.every(param => 
        param.values && param.values.every(v => v)
      );
    },
    message: 'All composite parameter components must have values',
    fix: 'Fill in all component values for composite parameters'
  },
  
  // Performance warnings
  performanceCount: {
    level: 'warning',
    check: (query) => query.count <= 100,
    message: 'Large result sets may impact performance',
    fix: 'Consider using a smaller _count value or adding more filters'
  },
  
  performanceNoFilters: {
    level: 'warning',
    check: (query) => {
      return query.searchParams.length > 0 || 
             query.hasParams.length > 0 || 
             query.compositeParams.length > 0;
    },
    message: 'Queries without filters may return many results',
    fix: 'Add search parameters to filter results'
  }
};

// Get validation score
const getValidationScore = (results) => {
  const total = results.length;
  const passed = results.filter(r => r.status === 'pass').length;
  return Math.round((passed / total) * 100);
};

function QueryValidator({ query, resourceDefinition, expanded = true }) {
  const [isExpanded, setIsExpanded] = React.useState(expanded);

  // Run validation
  const validationResults = useMemo(() => {
    const results = [];
    
    Object.entries(VALIDATION_RULES).forEach(([key, rule]) => {
      const passed = rule.check(query, resourceDefinition);
      results.push({
        key,
        level: rule.level,
        status: passed ? 'pass' : 'fail',
        message: rule.message,
        fix: rule.fix
      });
    });
    
    return results;
  }, [query, resourceDefinition]);

  // Group results by status
  const groupedResults = useMemo(() => {
    const errors = validationResults.filter(r => r.status === 'fail' && r.level === 'error');
    const warnings = validationResults.filter(r => r.status === 'fail' && r.level === 'warning');
    const info = validationResults.filter(r => r.status === 'fail' && r.level === 'info');
    const passed = validationResults.filter(r => r.status === 'pass');
    
    return { errors, warnings, info, passed };
  }, [validationResults]);

  // Calculate validation score
  const score = getValidationScore(validationResults);
  const hasIssues = groupedResults.errors.length > 0 || groupedResults.warnings.length > 0;

  // Determine overall status
  const overallStatus = groupedResults.errors.length > 0 ? 'error' : 
                       groupedResults.warnings.length > 0 ? 'warning' : 
                       groupedResults.info.length > 0 ? 'info' : 'success';

  const statusConfig = {
    error: { color: 'error', icon: ErrorIcon, title: 'Query has errors' },
    warning: { color: 'warning', icon: WarningIcon, title: 'Query has warnings' },
    info: { color: 'info', icon: InfoIcon, title: 'Query suggestions available' },
    success: { color: 'success', icon: CheckIcon, title: 'Query is valid' }
  };

  const config = statusConfig[overallStatus];
  const StatusIcon = config.icon;

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <Box
        sx={{
          p: 2,
          bgcolor: `${config.color}.lighter`,
          borderBottom: 1,
          borderColor: 'divider',
          cursor: 'pointer'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <StatusIcon color={config.color} />
            <Box>
              <Typography variant="subtitle1" fontWeight="medium">
                {config.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Validation score: {score}%
              </Typography>
            </Box>
          </Stack>
          
          <Stack direction="row" alignItems="center" spacing={1}>
            {groupedResults.errors.length > 0 && (
              <Chip 
                label={`${groupedResults.errors.length} errors`} 
                color="error" 
                size="small" 
              />
            )}
            {groupedResults.warnings.length > 0 && (
              <Chip 
                label={`${groupedResults.warnings.length} warnings`} 
                color="warning" 
                size="small" 
              />
            )}
            <IconButton size="small">
              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Stack>
        </Stack>
        
        <LinearProgress 
          variant="determinate" 
          value={score} 
          color={config.color}
          sx={{ mt: 1, height: 6, borderRadius: 1 }}
        />
      </Box>

      <Collapse in={isExpanded}>
        <Box sx={{ p: 2 }}>
          {/* Errors */}
          {groupedResults.errors.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="error" gutterBottom>
                Errors ({groupedResults.errors.length})
              </Typography>
              <List dense>
                {groupedResults.errors.map((result) => (
                  <ListItem key={result.key}>
                    <ListItemIcon>
                      <ErrorIcon color="error" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={result.message}
                      secondary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <BuildIcon fontSize="small" color="action" />
                          <Typography variant="caption">{result.fix}</Typography>
                        </Stack>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Warnings */}
          {groupedResults.warnings.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="warning.main" gutterBottom>
                Warnings ({groupedResults.warnings.length})
              </Typography>
              <List dense>
                {groupedResults.warnings.map((result) => (
                  <ListItem key={result.key}>
                    <ListItemIcon>
                      <WarningIcon color="warning" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={result.message}
                      secondary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <BuildIcon fontSize="small" color="action" />
                          <Typography variant="caption">{result.fix}</Typography>
                        </Stack>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Info */}
          {groupedResults.info.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="info.main" gutterBottom>
                Suggestions ({groupedResults.info.length})
              </Typography>
              <List dense>
                {groupedResults.info.map((result) => (
                  <ListItem key={result.key}>
                    <ListItemIcon>
                      <InfoIcon color="info" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={result.message}
                      secondary={result.fix}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Success message */}
          {!hasIssues && (
            <Alert severity="success" icon={<CheckIcon />}>
              Your query is valid and ready to execute!
            </Alert>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}

export default QueryValidator;