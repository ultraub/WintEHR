/**
 * ServiceBuilderV2 Component
 * Simplified wrapper/orchestrator for CDS service building
 * Routes to appropriate builder based on user preference and complexity
 * 
 * Leverages proven WintEHR patterns with optional catalog integration
 */

import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Button,
  Stack,
  Chip,
  Alert,
  AlertTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  FormControlLabel,
  Switch,
  Divider,
  Grid
} from '@mui/material';
import {
  Build as BuildIcon,
  Psychology as CDSIcon,
  Category as CatalogIcon,
  Code as CodeIcon,
  Autorenew as AutoIcon
} from '@mui/icons-material';

// Import the enhanced builder
import EnhancedCDSBuilder from './EnhancedCDSBuilder';

// Builder options
const BUILDER_OPTIONS = {
  STANDARD: 'standard',
  ENHANCED: 'enhanced'
};

const COMPLEXITY_LEVELS = {
  SIMPLE: 'simple',
  ADVANCED: 'advanced'
};

const ServiceBuilderV2 = ({
  initialServiceId = null,
  initialService = null,
  onServiceSave,
  onServiceTest,
  onClose
}) => {
  // State for builder selection
  const [builderType, setBuilderType] = useState(BUILDER_OPTIONS.ENHANCED);
  const [complexityLevel, setComplexityLevel] = useState(COMPLEXITY_LEVELS.SIMPLE);
  const [catalogIntegrationEnabled, setCatalogIntegrationEnabled] = useState(true);
  const [showBuilderSelection, setShowBuilderSelection] = useState(true);

  // Automatically determine builder type based on service complexity
  useEffect(() => {
    if (initialService) {
      // Analyze service complexity
      const hasMultipleConditions = initialService.conditions && initialService.conditions.length > 3;
      const hasComplexLogic = initialService.conditions && initialService.conditions.some(c => 
        ['lab_value', 'medication', 'condition'].includes(c.type)
      );
      const hasCatalogIntegration = initialService.catalogIntegration?.enabled;

      if (hasComplexLogic || hasCatalogIntegration || hasMultipleConditions) {
        setBuilderType(BUILDER_OPTIONS.ENHANCED);
        setComplexityLevel(COMPLEXITY_LEVELS.ADVANCED);
        setCatalogIntegrationEnabled(hasCatalogIntegration || hasComplexLogic);
      } else {
        setBuilderType(BUILDER_OPTIONS.STANDARD);
        setComplexityLevel(COMPLEXITY_LEVELS.SIMPLE);
        setCatalogIntegrationEnabled(false);
      }
      
      // Skip builder selection if we have an existing service
      setShowBuilderSelection(false);
    }
  }, [initialService]);

  // Handle builder selection confirmation
  const handleBuilderSelection = () => {
    setShowBuilderSelection(false);
  };

  // Handle builder type change
  const handleBuilderTypeChange = (newType) => {
    setBuilderType(newType);
    
    // Auto-configure based on builder type
    if (newType === BUILDER_OPTIONS.ENHANCED) {
      setCatalogIntegrationEnabled(true);
      setComplexityLevel(COMPLEXITY_LEVELS.ADVANCED);
    } else {
      setCatalogIntegrationEnabled(false);
      setComplexityLevel(COMPLEXITY_LEVELS.SIMPLE);
    }
  };

  // Render builder selection interface
  const renderBuilderSelection = () => (
    <Paper sx={{ p: 4, maxWidth: 800, mx: 'auto', mt: 4 }}>
      <Stack spacing={3}>
        <Stack direction="row" spacing={2} alignItems="center">
          <BuildIcon color="primary" fontSize="large" />
          <Typography variant="h4" fontWeight="bold">
            CDS Service Builder
          </Typography>
          <Chip label="v2.0" color="primary" />
        </Stack>

        <Alert severity="info" icon={<CDSIcon />}>
          <AlertTitle>Choose Your Builder Experience</AlertTitle>
          Select the builder that best matches your needs and complexity requirements.
        </Alert>

        <Grid container spacing={3}>
          {/* Standard Builder Option */}
          <Grid item xs={12} md={6}>
            <Card
              variant={builderType === BUILDER_OPTIONS.STANDARD ? "outlined" : "elevation"}
              sx={{
                cursor: 'pointer',
                border: builderType === BUILDER_OPTIONS.STANDARD ? 2 : 1,
                borderColor: builderType === BUILDER_OPTIONS.STANDARD ? 'primary.main' : 'divider',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 }
              }}
              onClick={() => handleBuilderTypeChange(BUILDER_OPTIONS.STANDARD)}
            >
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <CodeIcon color="primary" />
                    <Typography variant="h6">Standard Builder</Typography>
                    <Chip label="Proven" color="success" size="small" />
                  </Stack>

                  <Typography variant="body2" color="text.secondary">
                    Ideal for straightforward CDS hooks with basic conditions and alerts.
                    Uses WintEHR's proven stepper-based interface.
                  </Typography>

                  <Stack spacing={1}>
                    <Typography variant="caption" fontWeight="bold">Features:</Typography>
                    <Typography variant="caption">• 6-step guided workflow</Typography>
                    <Typography variant="caption">• Basic condition builders</Typography>
                    <Typography variant="caption">• Template system</Typography>
                    <Typography variant="caption">• Proven reliability</Typography>
                  </Stack>

                  <Stack spacing={1}>
                    <Typography variant="caption" fontWeight="bold">Best for:</Typography>
                    <Typography variant="caption">• Simple age/gender conditions</Typography>
                    <Typography variant="caption">• Basic medication alerts</Typography>
                    <Typography variant="caption">• Straightforward workflows</Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Enhanced Builder Option */}
          <Grid item xs={12} md={6}>
            <Card
              variant={builderType === BUILDER_OPTIONS.ENHANCED ? "outlined" : "elevation"}
              sx={{
                cursor: 'pointer',
                border: builderType === BUILDER_OPTIONS.ENHANCED ? 2 : 1,
                borderColor: builderType === BUILDER_OPTIONS.ENHANCED ? 'primary.main' : 'divider',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 }
              }}
              onClick={() => handleBuilderTypeChange(BUILDER_OPTIONS.ENHANCED)}
            >
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <CatalogIcon color="primary" />
                    <Typography variant="h6">Enhanced Builder</Typography>
                    <Chip label="Catalog-Enabled" color="primary" size="small" />
                  </Stack>

                  <Typography variant="body2" color="text.secondary">
                    Advanced builder with dynamic catalog integration for complex clinical logic.
                    Production-ready CDS Hooks 2.0 services.
                  </Typography>

                  <Stack spacing={1}>
                    <Typography variant="caption" fontWeight="bold">Features:</Typography>
                    <Typography variant="caption">• Dynamic catalog integration</Typography>
                    <Typography variant="caption">• Real clinical data conditions</Typography>
                    <Typography variant="caption">• Advanced templates</Typography>
                    <Typography variant="caption">• Production optimization</Typography>
                  </Stack>

                  <Stack spacing={1}>
                    <Typography variant="caption" fontWeight="bold">Best for:</Typography>
                    <Typography variant="caption">• Lab value conditions with reference ranges</Typography>
                    <Typography variant="caption">• Medication interaction checking</Typography>
                    <Typography variant="caption">• Condition-based screening</Typography>
                    <Typography variant="caption">• Complex clinical workflows</Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Additional Options */}
        <Divider />

        <Stack spacing={2}>
          <Typography variant="h6">Configuration Options</Typography>

          <FormControlLabel
            control={
              <Switch
                checked={catalogIntegrationEnabled}
                onChange={(e) => setCatalogIntegrationEnabled(e.target.checked)}
                disabled={builderType === BUILDER_OPTIONS.STANDARD}
              />
            }
            label="Enable Catalog Integration"
          />

          {catalogIntegrationEnabled && (
            <Alert severity="info" sx={{ ml: 4 }}>
              Catalog integration provides access to dynamic medication, condition, and lab test data
              from your WintEHR instance for building sophisticated clinical logic.
            </Alert>
          )}

          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Complexity Level</InputLabel>
            <Select
              value={complexityLevel}
              onChange={(e) => setComplexityLevel(e.target.value)}
              label="Complexity Level"
            >
              <MenuItem value={COMPLEXITY_LEVELS.SIMPLE}>Simple</MenuItem>
              <MenuItem value={COMPLEXITY_LEVELS.ADVANCED}>Advanced</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        {/* Action Buttons */}
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          {onClose && (
            <Button onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button
            variant="contained"
            onClick={handleBuilderSelection}
            startIcon={<AutoIcon />}
          >
            Start Building
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );

  // Render builder based on selection or skip selection if editing
  if (showBuilderSelection) {
    return renderBuilderSelection();
  }

  // Currently only Enhanced Builder is available
  // Standard Builder can be added later when needed
  return (
    <EnhancedCDSBuilder
      onSave={onServiceSave}
      onCancel={onClose}
      editingHook={initialService}
      catalogIntegrationEnabled={catalogIntegrationEnabled}
      complexityLevel={complexityLevel}
    />
  );
};

export default ServiceBuilderV2;