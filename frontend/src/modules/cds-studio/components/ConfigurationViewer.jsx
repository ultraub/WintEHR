import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Divider,
  IconButton,
  Tooltip,
  Alert,
  Chip
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Code as CodeIcon,
  Description as DescriptionIcon
} from '@mui/icons-material';

const ConfigurationViewer = ({ configView }) => {
  const [view, setView] = useState('split'); // 'split', 'json', 'breakdown'

  if (!configView) {
    return (
      <Alert severity="info">
        No configuration data available. Load a service to view its configuration.
      </Alert>
    );
  }

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(
      JSON.stringify(configView.plan_definition_json, null, 2)
    );
  };

  const handleDownloadJSON = () => {
    const blob = new Blob(
      [JSON.stringify(configView.plan_definition_json, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${configView.plan_definition_json.id || 'service'}-plan-definition.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderJSON = () => (
    <Card sx={{ height: '100%', borderRadius: 0 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <CodeIcon color="primary" />
            <Typography variant="h6">PlanDefinition JSON</Typography>
          </Box>
          <Box display="flex" gap={1}>
            <Tooltip title="Copy to clipboard">
              <IconButton size="small" onClick={handleCopyJSON}>
                <CopyIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Download JSON">
              <IconButton size="small" onClick={handleDownloadJSON}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        <Box
          sx={{
            bgcolor: '#1e1e1e',
            color: '#d4d4d4',
            p: 2,
            borderRadius: 1,
            overflowX: 'auto',
            maxHeight: 600,
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            lineHeight: 1.6
          }}
        >
          <pre style={{ margin: 0 }}>
            {JSON.stringify(configView.plan_definition_json, null, 2)}
          </pre>
        </Box>
      </CardContent>
    </Card>
  );

  const renderBreakdown = () => (
    <Card sx={{ height: '100%', borderRadius: 0 }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={3}>
          <DescriptionIcon color="primary" />
          <Typography variant="h6">Human-Readable Breakdown</Typography>
        </Box>

        {/* Service Origin */}
        <Box mb={3}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Service Origin
          </Typography>
          <Chip
            label={configView.breakdown.service_origin}
            size="small"
            color={configView.breakdown.service_origin === 'built-in' ? 'primary' : 'warning'}
            sx={{ mb: 1 }}
          />
          <Typography variant="body2" color="text.secondary">
            {configView.breakdown.service_origin_explanation}
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Hook Type */}
        <Box mb={3}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Hook Type
          </Typography>
          <Chip
            label={configView.breakdown.hook_type}
            size="small"
            variant="outlined"
            sx={{ mb: 1 }}
          />
          <Typography variant="body2" color="text.secondary">
            {configView.breakdown.hook_type_description}
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Execution Method */}
        <Box mb={3}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Execution Method
          </Typography>
          <Typography variant="body1" fontFamily="monospace" gutterBottom>
            {configView.breakdown.execution_method}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {configView.breakdown.execution_details}
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Prefetch Summary */}
        {configView.breakdown.prefetch_summary && (
          <>
            <Box mb={3}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Prefetch Configuration
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {configView.breakdown.prefetch_summary}
              </Typography>
            </Box>
            <Divider sx={{ my: 2 }} />
          </>
        )}

        {/* Extensions */}
        {configView.breakdown.extensions && configView.breakdown.extensions.length > 0 && (
          <Box mb={3}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              FHIR Extensions
            </Typography>
            {configView.breakdown.extensions.map((ext, idx) => (
              <Box key={idx} mb={2}>
                <Typography variant="body2" fontWeight="bold">
                  {ext.url}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                  {ext.explanation}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box>
      {/* View Toggle */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
        <Button
          variant={view === 'json' ? 'contained' : 'outlined'}
          size="small"
          onClick={() => setView('json')}
        >
          JSON Only
        </Button>
        <Button
          variant={view === 'breakdown' ? 'contained' : 'outlined'}
          size="small"
          onClick={() => setView('breakdown')}
        >
          Breakdown Only
        </Button>
        <Button
          variant={view === 'split' ? 'contained' : 'outlined'}
          size="small"
          onClick={() => setView('split')}
        >
          Split View
        </Button>
      </Box>

      {/* Content */}
      {view === 'split' && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            {renderJSON()}
          </Grid>
          <Grid item xs={12} md={6}>
            {renderBreakdown()}
          </Grid>
        </Grid>
      )}

      {view === 'json' && (
        <Box>{renderJSON()}</Box>
      )}

      {view === 'breakdown' && (
        <Box>{renderBreakdown()}</Box>
      )}
    </Box>
  );
};

export default ConfigurationViewer;
