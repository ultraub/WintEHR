/**
 * CDS Service Code Editor Component
 * Monaco-based code editor for writing CDS Hooks 2.0 service logic
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import {
  Box,
  Paper,
  Typography,
  Button,
  ButtonGroup,
  Tabs,
  Tab,
  Tooltip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Drawer,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  PlayArrow as RunIcon,
  Stop as StopIcon,
  Save as SaveIcon,
  Code as CodeIcon,
  Description as TemplateIcon,
  Help as HelpIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Functions as FunctionIcon,
  DataObject as DataIcon,
  Api as ApiIcon
} from '@mui/icons-material';
import { SERVICE_TEMPLATES, SERVICE_CATEGORIES } from '../templates/ServiceTemplates';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import js from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';

SyntaxHighlighter.registerLanguage('javascript', js);

// Monaco editor configuration
const EDITOR_OPTIONS = {
  fontSize: 14,
  minimap: { enabled: true },
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  automaticLayout: true,
  formatOnPaste: true,
  formatOnType: true,
  suggestOnTriggerCharacters: true,
  quickSuggestions: {
    other: true,
    comments: false,
    strings: true
  }
};

// CDS Hooks 2.0 type definitions for Monaco
const CDS_TYPES = `
declare interface CDSHookRequest {
  hook: string;
  hookInstance: string;
  fhirServer: string;
  context: Record<string, any>;
  prefetch?: Record<string, any>;
}

declare interface CDSCard {
  uuid: string;
  summary: string;
  indicator: 'info' | 'warning' | 'critical';
  detail?: string;
  source?: {
    label: string;
    url?: string;
    icon?: string;
  };
  suggestions?: CDSSuggestion[];
  links?: CDSLink[];
  overrideReasons?: OverrideReason[];
}

declare interface CDSSuggestion {
  label: string;
  uuid: string;
  actions?: CDSAction[];
}

declare interface CDSAction {
  type: 'create' | 'update' | 'delete';
  resource?: any;
  resourceId?: string;
}

declare interface SystemAction {
  type: 'create' | 'update' | 'delete';
  resource?: any;
  resourceId?: string;
}

declare interface CDSHookResponse {
  cards: CDSCard[];
  systemActions?: SystemAction[];
}

declare interface OverrideReason {
  code: string;
  display: string;
}
`;

// Helper code snippets
const CODE_SNIPPETS = {
  patientAge: `// Calculate patient age
calculateAge(birthDate) {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}`,
  
  daysSince: `// Calculate days since a date
daysSince(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const diffTime = Math.abs(today - date);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}`,
  
  generateUUID: `// Generate UUID v4
generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}`,
  
  checkCode: `// Check if resource has specific code
hasCode(resource, system, code) {
  return resource?.code?.coding?.some(coding => 
    coding.system === system && coding.code === code
  );
}`,
  
  extractMedication: `// Extract medication name
extractMedicationName(medicationRequest) {
  if (medicationRequest.medicationCodeableConcept?.text) {
    return medicationRequest.medicationCodeableConcept.text;
  }
  if (medicationRequest.medicationCodeableConcept?.coding?.[0]?.display) {
    return medicationRequest.medicationCodeableConcept.coding[0].display;
  }
  return 'Unknown medication';
}`
};

const ServiceCodeEditor = ({ 
  initialCode = '', 
  metadata = {},
  onSave,
  onRun,
  onValidate
}) => {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const [code, setCode] = useState(initialCode);
  const [activeTab, setActiveTab] = useState(0);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState(null);
  const [errors, setErrors] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showHelpDrawer, setShowHelpDrawer] = useState(false);
  const [testContext, setTestContext] = useState({
    patientId: 'test-patient-123',
    userId: 'test-user-456'
  });
  const [testPrefetch, setTestPrefetch] = useState({});

  // Configure Monaco on mount
  useEffect(() => {
    if (monacoRef.current) {
      // Add CDS type definitions
      monacoRef.current.languages.typescript.javascriptDefaults.addExtraLib(
        CDS_TYPES,
        'cds-types.d.ts'
      );

      // Add intellisense for common patterns
      monacoRef.current.languages.registerCompletionItemProvider('javascript', {
        provideCompletionItems: (model, position) => {
          const suggestions = [
            {
              label: 'shouldExecute',
              kind: monacoRef.current.languages.CompletionItemKind.Method,
              insertText: 'shouldExecute(context, prefetch) {\n  // Return true if service should run\n  return true;\n}',
              detail: 'Determine if service should execute'
            },
            {
              label: 'execute',
              kind: monacoRef.current.languages.CompletionItemKind.Method,
              insertText: 'execute(context, prefetch) {\n  return {\n    cards: []\n  };\n}',
              detail: 'Main service execution method'
            },
            {
              label: 'CDSCard',
              kind: monacoRef.current.languages.CompletionItemKind.Snippet,
              insertText: `{
  uuid: this.generateUUID(),
  summary: '\${1:Card summary}',
  indicator: '\${2|info,warning,critical|}',
  detail: '\${3:Detailed explanation}',
  source: {
    label: '\${4:Source label}'
  }
}`,
              detail: 'CDS Card template'
            }
          ];

          return { suggestions };
        }
      });
    }
  }, []);

  // Handle editor mount
  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Configure JavaScript defaults
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      esModuleInterop: true,
      allowJs: true,
      typeRoots: ['node_modules/@types']
    });

    // Format on load
    setTimeout(() => {
      editor.getAction('editor.action.formatDocument').run();
    }, 100);
  };

  // Validate code
  const validateCode = useCallback(async () => {
    try {
      setErrors([]);
      
      // Basic syntax check
      new Function(code);
      
      // Check for required methods
      const hasClass = /class\s+\w+Service\s*{/.test(code);
      const hasMetadata = /static\s+metadata\s*=/.test(code);
      const hasExecute = /execute\s*\(/.test(code);
      
      const validationErrors = [];
      
      if (!hasClass) {
        validationErrors.push({
          severity: 'error',
          message: 'Service must be defined as a class (e.g., class MyService { ... })'
        });
      }
      
      if (!hasMetadata) {
        validationErrors.push({
          severity: 'error',
          message: 'Service must have static metadata property'
        });
      }
      
      if (!hasExecute) {
        validationErrors.push({
          severity: 'error',
          message: 'Service must have execute() method'
        });
      }
      
      setErrors(validationErrors);
      
      if (onValidate) {
        const result = await onValidate(code);
        if (result.errors) {
          setErrors([...validationErrors, ...result.errors]);
        }
      }
      
      return validationErrors.length === 0;
    } catch (error) {
      setErrors([{
        severity: 'error',
        message: `Syntax error: ${error.message}`
      }]);
      return false;
    }
  }, [code, onValidate]);

  // Run code in test mode
  const handleRun = useCallback(async () => {
    if (!await validateCode()) {
      return;
    }
    
    setRunning(true);
    setOutput(null);
    
    try {
      // Create test request
      const testRequest = {
        hook: metadata.hook || 'patient-view',
        hookInstance: 'test-' + Date.now(),
        fhirServer: window.location.origin + '/fhir/R4',
        context: testContext,
        prefetch: testPrefetch
      };
      
      if (onRun) {
        const result = await onRun(code, testRequest);
        setOutput(result);
      } else {
        // Local execution for testing
        try {
          const ServiceClass = eval(`(${code})`);
          const service = new ServiceClass();
          
          let shouldRun = true;
          if (service.shouldExecute) {
            shouldRun = service.shouldExecute(testContext, testPrefetch);
          }
          
          if (shouldRun) {
            const result = service.execute(testContext, testPrefetch);
            setOutput(result);
          } else {
            setOutput({ 
              cards: [],
              _debug: { message: 'Service shouldExecute() returned false' }
            });
          }
        } catch (execError) {
          setErrors([{
            severity: 'error',
            message: `Execution error: ${execError.message}`
          }]);
        }
      }
    } catch (error) {
      setErrors([{
        severity: 'error',
        message: `Failed to run service: ${error.message}`
      }]);
    } finally {
      setRunning(false);
    }
  }, [code, metadata, testContext, testPrefetch, validateCode, onRun]);

  // Save code
  const handleSave = useCallback(async () => {
    if (!await validateCode()) {
      return;
    }
    
    if (onSave) {
      await onSave(code, metadata);
    }
  }, [code, metadata, validateCode, onSave]);

  // Apply template
  const applyTemplate = (templateId) => {
    const template = SERVICE_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setCode(template.template.code);
      setShowTemplateDialog(false);
    }
  };

  // Insert code snippet
  const insertSnippet = (snippet) => {
    const editor = editorRef.current;
    if (editor) {
      const position = editor.getPosition();
      editor.executeEdits('', [{
        range: new monacoRef.current.Range(
          position.lineNumber,
          position.column,
          position.lineNumber,
          position.column
        ),
        text: snippet,
        forceMoveMarkers: true
      }]);
      editor.focus();
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <Paper sx={{ p: 1, borderRadius: 0 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <ButtonGroup size="small">
            <Tooltip title="Run service (F5)">
              <Button
                startIcon={running ? <StopIcon /> : <RunIcon />}
                onClick={handleRun}
                disabled={running}
                color="primary"
              >
                {running ? 'Running...' : 'Run'}
              </Button>
            </Tooltip>
            <Tooltip title="Save service (Ctrl+S)">
              <Button
                startIcon={<SaveIcon />}
                onClick={handleSave}
              >
                Save
              </Button>
            </Tooltip>
            <Tooltip title="Validate code">
              <Button
                startIcon={<CheckIcon />}
                onClick={validateCode}
              >
                Validate
              </Button>
            </Tooltip>
          </ButtonGroup>

          <ButtonGroup size="small">
            <Tooltip title="Load template">
              <Button
                startIcon={<TemplateIcon />}
                onClick={() => setShowTemplateDialog(true)}
              >
                Templates
              </Button>
            </Tooltip>
            <Tooltip title="Show help">
              <Button
                startIcon={<HelpIcon />}
                onClick={() => setShowHelpDrawer(true)}
              >
                Help
              </Button>
            </Tooltip>
          </ButtonGroup>
        </Box>
      </Paper>

      {/* Main content area */}
      <Box sx={{ flex: 1, display: 'flex' }}>
        {/* Editor panel */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
            <Tab label="Code" icon={<CodeIcon />} iconPosition="start" />
            <Tab label="Test Data" icon={<DataIcon />} iconPosition="start" />
            <Tab label="Output" icon={<ApiIcon />} iconPosition="start" />
          </Tabs>

          {/* Code editor tab */}
          {activeTab === 0 && (
            <Box sx={{ flex: 1, position: 'relative' }}>
              <Editor
                height="100%"
                defaultLanguage="javascript"
                value={code}
                onChange={setCode}
                onMount={handleEditorMount}
                options={EDITOR_OPTIONS}
                theme="vs-light"
              />
              
              {/* Error overlay */}
              {errors.length > 0 && (
                <Paper
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    maxHeight: '30%',
                    overflow: 'auto',
                    p: 2,
                    backgroundColor: 'background.paper',
                    borderTop: 1,
                    borderColor: 'divider'
                  }}
                  elevation={4}
                >
                  <Typography variant="subtitle2" gutterBottom>
                    Validation Errors
                  </Typography>
                  {errors.map((error, index) => (
                    <Alert 
                      key={index} 
                      severity={error.severity || 'error'}
                      sx={{ mb: 1 }}
                    >
                      {error.message}
                    </Alert>
                  ))}
                </Paper>
              )}
            </Box>
          )}

          {/* Test data tab */}
          {activeTab === 1 && (
            <Box sx={{ p: 2, overflow: 'auto' }}>
              <Typography variant="h6" gutterBottom>
                Test Context
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={10}
                value={JSON.stringify(testContext, null, 2)}
                onChange={(e) => {
                  try {
                    setTestContext(JSON.parse(e.target.value));
                  } catch (err) {
                    // Invalid JSON, ignore
                  }
                }}
                sx={{ mb: 2, fontFamily: 'monospace' }}
              />
              
              <Typography variant="h6" gutterBottom>
                Test Prefetch Data
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={10}
                value={JSON.stringify(testPrefetch, null, 2)}
                onChange={(e) => {
                  try {
                    setTestPrefetch(JSON.parse(e.target.value));
                  } catch (err) {
                    // Invalid JSON, ignore
                  }
                }}
                sx={{ fontFamily: 'monospace' }}
              />
            </Box>
          )}

          {/* Output tab */}
          {activeTab === 2 && (
            <Box sx={{ p: 2, overflow: 'auto' }}>
              {output ? (
                <>
                  <Typography variant="h6" gutterBottom>
                    Service Output
                  </Typography>
                  <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                    <SyntaxHighlighter
                      language="json"
                      style={docco}
                      customStyle={{ margin: 0 }}
                    >
                      {JSON.stringify(output, null, 2)}
                    </SyntaxHighlighter>
                  </Paper>
                </>
              ) : (
                <Alert severity="info">
                  Run the service to see output here
                </Alert>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* Template selection dialog */}
      <Dialog
        open={showTemplateDialog}
        onClose={() => setShowTemplateDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Select Service Template</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
            >
              <MenuItem value="">All Categories</MenuItem>
              {Object.entries(SERVICE_CATEGORIES).map(([key, value]) => (
                <MenuItem key={key} value={value}>{value}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <List>
            {SERVICE_TEMPLATES
              .filter(t => !selectedTemplate || t.category === selectedTemplate)
              .map(template => (
                <ListItemButton
                  key={template.id}
                  onClick={() => applyTemplate(template.id)}
                >
                  <ListItemText
                    primary={template.name}
                    secondary={template.description}
                  />
                  <Chip 
                    label={template.category} 
                    size="small" 
                    color="primary"
                  />
                </ListItemButton>
              ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTemplateDialog(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Help drawer */}
      <Drawer
        anchor="right"
        open={showHelpDrawer}
        onClose={() => setShowHelpDrawer(false)}
        sx={{ '& .MuiDrawer-paper': { width: 400 } }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            CDS Service Editor Help
          </Typography>
          
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Service Structure</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                Every CDS service must be a JavaScript class with:
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary="static metadata"
                    secondary="Service configuration (id, title, hook, prefetch)"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="execute(context, prefetch)"
                    secondary="Main logic returning cards and systemActions"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="shouldExecute(context, prefetch)"
                    secondary="Optional: Determine if service should run"
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Code Snippets</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                {Object.entries(CODE_SNIPPETS).map(([key, snippet]) => (
                  <Button
                    key={key}
                    size="small"
                    startIcon={<FunctionIcon />}
                    onClick={() => insertSnippet(snippet)}
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    {key}
                  </Button>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Available Hooks</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary="patient-view"
                    secondary="When patient chart is opened"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="medication-prescribe"
                    secondary="When prescribing medications"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="order-select"
                    secondary="When selecting orders"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="order-sign"
                    secondary="When signing orders"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="allergyintolerance-create"
                    secondary="When adding allergies (2.0)"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="appointment-book"
                    secondary="When booking appointments (2.0)"
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Card Indicators</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                <ListItem>
                  <ListItemIcon><InfoIcon color="info" /></ListItemIcon>
                  <ListItemText 
                    primary="info"
                    secondary="Informational message"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><WarningIcon color="warning" /></ListItemIcon>
                  <ListItemText 
                    primary="warning"
                    secondary="Warning that needs attention"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><ErrorIcon color="error" /></ListItemIcon>
                  <ListItemText 
                    primary="critical"
                    secondary="Critical issue requiring action"
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Keyboard Shortcuts</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary="F5"
                    secondary="Run service"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Ctrl+S / Cmd+S"
                    secondary="Save service"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Ctrl+Space"
                    secondary="Show suggestions"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Alt+Shift+F"
                    secondary="Format code"
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>
        </Box>
      </Drawer>
    </Box>
  );
};

export default ServiceCodeEditor;