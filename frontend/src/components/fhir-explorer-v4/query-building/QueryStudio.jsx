/**
 * Query Studio - Unified FHIR Query Building Experience
 * 
 * Combines Visual Builder and Playground into a single, powerful interface
 * with multiple modes, dark theme support, and enhanced productivity features
 * 
 * @since 2025-01-26
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  Divider,
  IconButton,
  Tooltip,
  Button,
  Chip,
  Alert,
  Fade,
  Slide,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  useTheme,
  alpha,
  Collapse,
  Badge,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Tab,
  Tabs,
  CircularProgress
} from '@mui/material';
import {
  ViewModule as VisualIcon,
  Code as CodeIcon,
  SplitScreen as SplitIcon,
  PlayArrow as RunIcon,
  Save as SaveIcon,
  Share as ShareIcon,
  History as HistoryIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Lightbulb as SuggestIcon,
  BugReport as DebugIcon,
  Speed as OptimizeIcon,
  CheckCircle as ValidIcon,
  Error as ErrorIcon,
  Warning as WarnIcon,
  ExpandMore as ExpandIcon,
  ChevronRight as CollapseIcon,
  Bookmark as BookmarkIcon,
  Timer as TimerIcon,
  DataObject as JsonIcon,
  Terminal as TerminalIcon,
  Api as ApiIcon,
  Help as HelpIcon,
  FullscreenExit,
  Fullscreen,
  DarkMode,
  LightMode,
  Sync as SyncIcon,
  Edit as EditIcon,
  Visibility as PreviewIcon
} from '@mui/icons-material';

// Import components from existing implementations
import VisualQueryBuilder from './VisualQueryBuilder';
import QueryPlayground from './QueryPlayground';
import QueryTemplates from './components/QueryTemplates';
import QueryValidator from './components/QueryValidator';
import QuerySuggestions from './components/QuerySuggestions';

// Import FHIR resources and utilities
import { FHIR_RESOURCES } from '../constants/fhirResources';

const STUDIO_MODES = {
  VISUAL: 'visual',
  CODE: 'code',
  SPLIT: 'split'
};

const EXPORT_FORMATS = {
  CURL: 'cURL',
  JAVASCRIPT: 'JavaScript (fetch)',
  PYTHON: 'Python (requests)',
  POSTMAN: 'Postman Collection',
  OPENAPI: 'OpenAPI Spec'
};

/**
 * Enhanced Results Viewer with dark mode support
 */
const ResultsViewer = ({ results, error, executionTime, onExport }) => {
  const theme = useTheme();
  const [viewMode, setViewMode] = useState('formatted');
  const [expanded, setExpanded] = useState(true);

  if (!results && !error) return null;

  const resultData = results?.data || results;
  const resourceCount = resultData?.entry?.length || 0;
  const totalCount = resultData?.total || resourceCount;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        backgroundColor: theme.palette.mode === 'dark' 
          ? alpha(theme.palette.background.paper, 0.6)
          : theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`
      }}
    >
      {/* Results Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          Results
        </Typography>
        
        <Stack direction="row" spacing={1} alignItems="center">
          {executionTime && (
            <Chip
              icon={<TimerIcon />}
              label={`${executionTime}ms`}
              size="small"
              color={executionTime > 1000 ? 'warning' : 'success'}
            />
          )}
          {resourceCount > 0 && (
            <Chip
              label={`${resourceCount} returned${totalCount > resourceCount ? ` of ${totalCount}` : ''}`}
              size="small"
              color="primary"
            />
          )}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, mode) => mode && setViewMode(mode)}
            size="small"
          >
            <ToggleButton value="formatted">
              <Tooltip title="Formatted JSON">
                <JsonIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="raw">
              <Tooltip title="Raw Response">
                <TerminalIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandIcon /> : <CollapseIcon />}
          </IconButton>
          <IconButton size="small" onClick={onExport}>
            <DownloadIcon />
          </IconButton>
        </Stack>
      </Box>

      <Collapse in={expanded}>
        {error ? (
          <Alert 
            severity="error" 
            sx={{ 
              backgroundColor: theme.palette.mode === 'dark'
                ? alpha(theme.palette.error.main, 0.1)
                : undefined
            }}
          >
            <Typography variant="subtitle2" gutterBottom>Query Error</Typography>
            <Typography variant="body2">{error}</Typography>
          </Alert>
        ) : (
          <Box
            sx={{
              maxHeight: 400,
              overflow: 'auto',
              backgroundColor: theme.palette.mode === 'dark'
                ? theme.palette.grey[900]
                : theme.palette.grey[50],
              borderRadius: 1,
              p: 2,
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              '& pre': {
                margin: 0,
                color: theme.palette.text.primary
              }
            }}
          >
            {viewMode === 'formatted' ? (
              <pre>{JSON.stringify(resultData, null, 2)}</pre>
            ) : (
              <pre>{JSON.stringify(resultData)}</pre>
            )}
          </Box>
        )}
      </Collapse>
    </Paper>
  );
};

/**
 * Query Export Dialog
 */
const ExportDialog = ({ open, onClose, query, results }) => {
  const theme = useTheme();
  const [format, setFormat] = useState('CURL');
  const [copied, setCopied] = useState(false);

  const generateExportCode = useCallback(() => {
    const baseUrl = window.location.origin;
    const fullUrl = `${baseUrl}/api/fhir/R4${query}`;

    switch (format) {
      case 'CURL':
        return `curl -X GET "${fullUrl}" \\
  -H "Accept: application/fhir+json" \\
  -H "Authorization: Bearer YOUR_TOKEN"`;

      case 'JAVASCRIPT':
        return `fetch('${fullUrl}', {
  method: 'GET',
  headers: {
    'Accept': 'application/fhir+json',
    'Authorization': 'Bearer YOUR_TOKEN'
  }
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));`;

      case 'PYTHON':
        return `import requests

url = "${fullUrl}"
headers = {
    "Accept": "application/fhir+json",
    "Authorization": "Bearer YOUR_TOKEN"
}

response = requests.get(url, headers=headers)
data = response.json()
print(data)`;

      case 'POSTMAN':
        return JSON.stringify({
          info: {
            name: "FHIR Query",
            schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
          },
          item: [{
            name: "FHIR Query",
            request: {
              method: "GET",
              header: [
                { key: "Accept", value: "application/fhir+json" },
                { key: "Authorization", value: "Bearer YOUR_TOKEN" }
              ],
              url: { raw: fullUrl }
            }
          }]
        }, null, 2);

      default:
        return '';
    }
  }, [format, query]);

  const handleCopy = () => {
    navigator.clipboard.writeText(generateExportCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Export Query</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Export Format</InputLabel>
            <Select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              label="Export Format"
            >
              {Object.entries(EXPORT_FORMATS).map(([key, label]) => (
                <MenuItem key={key} value={key}>{label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box
            sx={{
              p: 2,
              backgroundColor: theme.palette.mode === 'dark'
                ? theme.palette.grey[900]
                : theme.palette.grey[50],
              borderRadius: 1,
              position: 'relative',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              overflow: 'auto',
              maxHeight: 400
            }}
          >
            <pre style={{ margin: 0, color: theme.palette.text.primary }}>
              {generateExportCode()}
            </pre>
            <IconButton
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                backgroundColor: theme.palette.background.paper
              }}
              onClick={handleCopy}
              size="small"
            >
              {copied ? <CheckCircle color="success" /> : <CopyIcon />}
            </IconButton>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={handleCopy}>
          Copy to Clipboard
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * Main Query Studio Component
 */
function QueryStudio({ onNavigate, useFHIRData, useQueryHistory }) {
  const theme = useTheme();
  const [mode, setMode] = useState(STUDIO_MODES.VISUAL);
  const [query, setQuery] = useState('/Patient?_count=10');
  const [visualQuery, setVisualQuery] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [executionTime, setExecutionTime] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [syncModes, setSyncModes] = useState(true);
  
  const fhirData = useFHIRData?.() || null;
  const queryHistory = useQueryHistory?.() || null;

  // Sync between visual and code modes
  useEffect(() => {
    if (syncModes && mode === STUDIO_MODES.VISUAL && visualQuery) {
      // Update code view when visual query changes
      const generatedUrl = generateQueryFromVisual(visualQuery);
      if (generatedUrl) {
        setQuery(generatedUrl);
      }
    }
  }, [visualQuery, mode, syncModes]);

  // Generate query URL from visual query object
  const generateQueryFromVisual = useCallback((vQuery) => {
    if (!vQuery || !vQuery.resourceType) return '';
    
    const params = new URLSearchParams();
    
    // Add search parameters
    vQuery.searchParams?.forEach(param => {
      if (param.value) {
        const key = param.operator ? `${param.name}${param.operator}` : param.name;
        params.append(key, param.value);
      }
    });
    
    // Add other parameters...
    if (vQuery.count && vQuery.count !== 20) {
      params.append('_count', vQuery.count);
    }
    
    const queryString = params.toString();
    return `/${vQuery.resourceType}${queryString ? `?${queryString}` : ''}`;
  }, []);

  // Execute query
  const executeQuery = useCallback(async () => {
    if (!fhirData || !fhirData.searchResources) {
      setError('FHIR data service not available');
      return;
    }

    setExecuting(true);
    setError(null);
    setResults(null);
    
    const startTime = performance.now();

    try {
      // Parse query and execute
      const match = query.match(/^\/([A-Z][a-zA-Z]+)(\?.*)?$/);
      if (!match) {
        throw new Error('Invalid query format');
      }
      
      const resourceType = match[1];
      const queryString = match[2];
      const params = queryString ? Object.fromEntries(new URLSearchParams(queryString.substring(1))) : {};
      
      const result = await fhirData.searchResources(resourceType, params);
      
      const endTime = performance.now();
      setExecutionTime(Math.round(endTime - startTime));
      
      setResults(result);
      
      // Add to history
      if (queryHistory?.addToHistory) {
        queryHistory.addToHistory({
          query,
          resultCount: result.resources?.length || 0,
          totalCount: result.total || 0,
          executionTime: Math.round(endTime - startTime),
          resourceType
        });
      }
    } catch (err) {
      setError(err.message || 'Query execution failed');
    } finally {
      setExecuting(false);
    }
  }, [query, fhirData, queryHistory]);

  // Export results
  const handleExport = useCallback(() => {
    if (!results) return;
    
    const data = JSON.stringify(results.bundle || results, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fhir-query-results-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results]);

  // Render the appropriate view based on mode
  const renderQueryInterface = () => {
    switch (mode) {
      case STUDIO_MODES.VISUAL:
        return (
          <Box sx={{ height: '100%' }}>
            <VisualQueryBuilder
              onNavigate={onNavigate}
              onExecuteQuery={executeQuery}
              useFHIRData={useFHIRData}
              useQueryHistory={useQueryHistory}
              onQueryChange={setVisualQuery}
              embedded
            />
          </Box>
        );

      case STUDIO_MODES.CODE:
        return (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                backgroundColor: theme.palette.mode === 'dark'
                  ? alpha(theme.palette.background.paper, 0.6)
                  : theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`
              }}
            >
              <TextField
                fullWidth
                multiline
                rows={4}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter FHIR query (e.g., /Patient?name=Smith)"
                sx={{
                  '& .MuiInputBase-input': {
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    color: theme.palette.text.primary
                  },
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.mode === 'dark'
                      ? theme.palette.grey[900]
                      : theme.palette.grey[50]
                  }
                }}
              />
            </Paper>
          </Box>
        );

      case STUDIO_MODES.SPLIT:
        return (
          <Grid container spacing={2} sx={{ height: '100%' }}>
            <Grid item xs={12} md={6}>
              <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Visual Builder</Typography>
                {renderQueryInterface.call({ mode: STUDIO_MODES.VISUAL })}
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ flex: 1 }}>Generated Query</Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={syncModes}
                        onChange={(e) => setSyncModes(e.target.checked)}
                        size="small"
                      />
                    }
                    label="Sync"
                  />
                </Box>
                {renderQueryInterface.call({ mode: STUDIO_MODES.CODE })}
              </Box>
            </Grid>
          </Grid>
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.mode === 'dark'
            ? alpha(theme.palette.background.paper, 0.8)
            : theme.palette.background.default
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Query Studio
          </Typography>
          
          {/* Mode Selector */}
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(e, newMode) => newMode && setMode(newMode)}
            size="small"
            sx={{
              backgroundColor: theme.palette.mode === 'dark'
                ? alpha(theme.palette.background.paper, 0.6)
                : theme.palette.background.paper
            }}
          >
            <ToggleButton value={STUDIO_MODES.VISUAL}>
              <Tooltip title="Visual Builder">
                <VisualIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value={STUDIO_MODES.CODE}>
              <Tooltip title="Code Editor">
                <CodeIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value={STUDIO_MODES.SPLIT}>
              <Tooltip title="Split View">
                <SplitIcon />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
          
          <Box sx={{ flex: 1 }} />
          
          {/* Action Buttons */}
          <Button
            variant="contained"
            startIcon={executing ? <CircularProgress size={20} /> : <RunIcon />}
            onClick={executeQuery}
            disabled={executing || !query}
            sx={{
              backgroundColor: theme.palette.success.main,
              '&:hover': {
                backgroundColor: theme.palette.success.dark
              }
            }}
          >
            {executing ? 'Executing...' : 'Execute'}
          </Button>
          
          <IconButton onClick={() => setShowTemplates(true)}>
            <BookmarkIcon />
          </IconButton>
          
          <IconButton onClick={() => setShowExport(true)} disabled={!query}>
            <ShareIcon />
          </IconButton>
          
          <IconButton onClick={() => setFullscreen(!fullscreen)}>
            {fullscreen ? <FullscreenExit /> : <Fullscreen />}
          </IconButton>
        </Stack>
      </Paper>

      {/* Main Content */}
      <Box sx={{ flex: 1, overflow: 'hidden', p: 2 }}>
        <Grid container spacing={2} sx={{ height: '100%' }}>
          <Grid item xs={12} lg={results || error ? 7 : 12}>
            {renderQueryInterface()}
          </Grid>
          
          {(results || error) && (
            <Grid item xs={12} lg={5}>
              <ResultsViewer
                results={results}
                error={error}
                executionTime={executionTime}
                onExport={handleExport}
              />
            </Grid>
          )}
        </Grid>
      </Box>

      {/* Export Dialog */}
      <ExportDialog
        open={showExport}
        onClose={() => setShowExport(false)}
        query={query}
        results={results}
      />

      {/* Templates Drawer */}
      <Drawer
        anchor="right"
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        PaperProps={{
          sx: {
            width: 350,
            backgroundColor: theme.palette.mode === 'dark'
              ? theme.palette.background.paper
              : theme.palette.background.default
          }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>Query Templates</Typography>
          <QueryTemplates
            onSelectTemplate={(template) => {
              setQuery(template.query);
              setShowTemplates(false);
            }}
          />
        </Box>
      </Drawer>
    </Box>
  );
}

export default QueryStudio;