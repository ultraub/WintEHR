/**
 * CQL Editor — Monaco-based editor with a small toolbar wrapped around it.
 *
 * Toolbar actions:
 *   - Validate: POST CQL to /api/cds-visual-builder/cql/validate, show issues
 *   - Insert template: replace the buffer with a starter (cqlTemplates.js)
 *   - Compose ValueSet: opens the ValueSetComposer modal (Phase 4); on save,
 *     inserts a `valueset "Name": '<url>'` line at cursor.
 *   - Open Advanced tab: shows the live FHIR Library + PlanDefinition preview
 *     (FHIRPreviewPane) — useful for students who want to see what the
 *     wizard generates from their CQL.
 *
 * Validation results render as Monaco "markers" (the squiggly underlines
 * Monaco uses to surface errors/warnings). We translate the backend's
 * issue-list shape:
 *   {severity: 'error'|'warning'|'information', diagnostics: '...'}
 * into Monaco markers attached to the model.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  ButtonGroup,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  PlayArrow as ValidateIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  LibraryAddCheck as TemplateIcon,
  PlaylistAdd as ValueSetIcon,
  Code as AdvancedIcon,
  Edit as EditIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import Editor from '@monaco-editor/react';

import { CQL_LANGUAGE_ID, registerCQLLanguage } from '../../monaco/cqlLanguage';
import { CQL_STARTER_TEMPLATES, getTemplate } from './cqlTemplates';
import ValueSetComposer from './ValueSetComposer';
import cdsStudioApi from '../../services/cdsStudioApi';

const TAB_EDITOR = 'editor';
const TAB_ADVANCED = 'advanced';

const SEVERITY_TO_MONACO = {
  // Monaco's MarkerSeverity values: Hint=1, Info=2, Warning=4, Error=8.
  // We use raw numbers so we don't need a direct Monaco import here.
  fatal: 8,
  error: 8,
  warning: 4,
  information: 2,
  info: 2,
  hint: 1,
};

function severityChipColor(severity) {
  if (severity === 'error' || severity === 'fatal') return 'error';
  if (severity === 'warning') return 'warning';
  return 'info';
}

/** One-line status summary for the toolbar chip. Returns null when no validation has run yet. */
function summarizeIssues(issues) {
  if (issues === null) return null;
  if (issues.length === 0) {
    return { color: 'success', icon: <CheckIcon fontSize="small" />, label: 'Valid' };
  }
  const errorCount = issues.filter((i) => i.severity === 'error' || i.severity === 'fatal').length;
  const warnCount = issues.filter((i) => i.severity === 'warning').length;
  if (errorCount > 0) {
    return {
      color: 'error',
      icon: <ErrorIcon fontSize="small" />,
      label: `${errorCount} error${errorCount === 1 ? '' : 's'}`,
    };
  }
  if (warnCount > 0) {
    return {
      color: 'warning',
      icon: <WarningIcon fontSize="small" />,
      label: `${warnCount} warning${warnCount === 1 ? '' : 's'}`,
    };
  }
  return { color: 'info', icon: null, label: `${issues.length} note${issues.length === 1 ? '' : 's'}` };
}

/**
 * @param {object} props
 * @param {string} props.value — current CQL text
 * @param {(next: string) => void} props.onChange
 * @param {() => void} [props.onOpenValueSetComposer] — invoked when student
 *   clicks "Compose ValueSet". Phase 4 wires this to the modal.
 * @param {() => Promise<{library: object, plan_definition: object} | null>}
 *   [props.onLoadFHIRPreview] — called when the Advanced tab is opened.
 *   Returns the generated FHIR resources for read-only display, or null if
 *   the service hasn't been saved yet.
 * @param {string} [props.height] — editor height (default '380px')
 */
const CQLEditor = ({
  value = '',
  onChange,
  onOpenValueSetComposer,
  onLoadFHIRPreview,
  height = '380px',
}) => {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

  const [activeTab, setActiveTab] = useState(TAB_EDITOR);
  const [validating, setValidating] = useState(false);
  const [issues, setIssues] = useState(null); // null = never validated
  const [issuesExpanded, setIssuesExpanded] = useState(true);
  const [templateMenuAnchor, setTemplateMenuAnchor] = useState(null);
  const [fhirPreview, setFhirPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const handleEditorMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    registerCQLLanguage(monaco);
  }, []);

  const handleChange = useCallback(
    (next) => {
      onChange?.(next || '');
      // Stale issues confuse students; clear them on any keystroke. They can
      // re-run validate when they're ready.
      if (issues !== null) setIssues(null);
      // Clear stale FHIR preview when the buffer changes.
      if (fhirPreview) setFhirPreview(null);
    },
    [onChange, issues, fhirPreview],
  );

  /** Push issues into Monaco's marker store so they render as squigglies. */
  const paintMarkers = useCallback((issueList) => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor) return;
    const model = editor.getModel();
    if (!model) return;

    // Without parsed line/column info from HAPI we apply markers to line 1
    // for now; the issue list panel below the editor is the primary surface.
    const markers = issueList.map((issue) => ({
      severity: SEVERITY_TO_MONACO[issue.severity] ?? SEVERITY_TO_MONACO.info,
      message: issue.diagnostics,
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: model.getLineMaxColumn(1),
    }));
    monaco.editor.setModelMarkers(model, 'cql-validate', markers);
  }, []);

  /** POST current CQL to the backend validate endpoint, render markers + issue list. */
  const runValidate = useCallback(async () => {
    if (!value || !value.trim()) {
      setIssues([{ severity: 'warning', diagnostics: 'CQL is empty.' }]);
      return;
    }
    setValidating(true);
    try {
      const result = await cdsStudioApi.validateCQL(value);
      const list = (result.issues || []).map((i) => ({
        severity: i.severity || 'information',
        diagnostics: i.diagnostics || '(no diagnostic message returned)',
      }));
      setIssues(list);
      paintMarkers(list);
    } catch (err) {
      setIssues([
        {
          severity: 'error',
          diagnostics: err?.message || 'Validation request failed',
        },
      ]);
      paintMarkers([]);
    } finally {
      setValidating(false);
    }
  }, [value, paintMarkers]);

  /** Insert a starter template — replace buffer wholesale. */
  const insertTemplate = useCallback(
    (templateId) => {
      const t = getTemplate(templateId);
      if (!t) return;
      onChange?.(t.cql);
      setTemplateMenuAnchor(null);
      setIssues(null);
      setFhirPreview(null);
    },
    [onChange],
  );

  /**
   * Insert a `valueset "Name": '<url>'` declaration at the current cursor
   * position. Called after the ValueSetComposer modal saves a new ValueSet.
   *
   * Tries Monaco's executeEdits API first (preserves cursor position and
   * undo history). Falls back to string concatenation if the editor isn't
   * mounted yet for some reason — onChange always fires either way.
   */
  const insertValueSetDeclaration = useCallback(
    ({ name, hapi_canonical_url }) => {
      const declaration = `valueset "${name}": '${hapi_canonical_url}'\n`;

      const editor = editorRef.current;
      if (editor) {
        const selection = editor.getSelection();
        editor.executeEdits('insert-valueset', [
          {
            range: selection,
            text: declaration,
            forceMoveMarkers: true,
          },
        ]);
        editor.focus();
      } else {
        // Fallback for the unlikely case the editor isn't mounted yet.
        onChange?.(declaration + (value || ''));
      }
      // Clear stale validation since the buffer changed via Monaco's edit API
      // (which won't trigger our handleChange).
      setIssues(null);
      setFhirPreview(null);
    },
    [onChange, value],
  );

  /** Open the Advanced tab — load FHIR preview if a loader was provided. */
  const handleTabChange = useCallback(
    async (_e, next) => {
      setActiveTab(next);
      if (next !== TAB_ADVANCED || !onLoadFHIRPreview) return;
      if (fhirPreview || previewLoading) return; // already loaded / loading
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const result = await onLoadFHIRPreview();
        setFhirPreview(result || null);
      } catch (err) {
        setPreviewError(err?.message || 'Failed to load FHIR preview');
      } finally {
        setPreviewLoading(false);
      }
    },
    [onLoadFHIRPreview, fhirPreview, previewLoading],
  );

  /** Compact status indicator that lives next to the Validate button. */
  const statusBadge = useMemo(() => summarizeIssues(issues), [issues]);

  /** Render summary + per-line issue rows. */
  const issuePanel = useMemo(() => {
    if (issues === null) return null;
    if (issues.length === 0) {
      return (
        <Alert severity="success" sx={{ borderRadius: 0 }}>
          <AlertTitle>CQL is valid</AlertTitle>
          HAPI compiled the expression with no errors or warnings.
        </Alert>
      );
    }
    const errorCount = issues.filter((i) => i.severity === 'error' || i.severity === 'fatal').length;
    const warnCount = issues.filter((i) => i.severity === 'warning').length;
    const infoCount = issues.length - errorCount - warnCount;

    return (
      <Box>
        <Alert
          severity={errorCount > 0 ? 'error' : warnCount > 0 ? 'warning' : 'info'}
          sx={{ borderRadius: 0 }}
          action={
            <IconButton
              size="small"
              onClick={() => setIssuesExpanded((v) => !v)}
              aria-label={issuesExpanded ? 'Collapse issues' : 'Expand issues'}
            >
              {issuesExpanded ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
            </IconButton>
          }
        >
          <AlertTitle>
            {errorCount > 0 && `${errorCount} error${errorCount === 1 ? '' : 's'}`}
            {errorCount > 0 && warnCount > 0 ? ', ' : ''}
            {warnCount > 0 && `${warnCount} warning${warnCount === 1 ? '' : 's'}`}
            {errorCount === 0 && warnCount === 0 && `${infoCount} note${infoCount === 1 ? '' : 's'}`}
          </AlertTitle>
        </Alert>
        <Collapse in={issuesExpanded}>
          <Box sx={{ bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider' }}>
            {issues.map((issue, idx) => (
              <Box
                key={idx}
                sx={{
                  display: 'flex',
                  gap: 1,
                  alignItems: 'flex-start',
                  px: 2,
                  py: 1,
                  borderBottom: idx < issues.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                  fontFamily: 'Monaco, Menlo, monospace',
                  fontSize: 13,
                }}
              >
                <Chip
                  label={issue.severity}
                  size="small"
                  color={severityChipColor(issue.severity)}
                  sx={{ flexShrink: 0, textTransform: 'uppercase', fontSize: 10 }}
                />
                <Typography variant="body2" sx={{ fontFamily: 'inherit' }}>
                  {issue.diagnostics}
                </Typography>
              </Box>
            ))}
          </Box>
        </Collapse>
      </Box>
    );
  }, [issues, issuesExpanded]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Tabs value={activeTab} onChange={handleTabChange} sx={{ minHeight: 36 }}>
        <Tab
          value={TAB_EDITOR}
          label="Editor"
          icon={<EditIcon fontSize="small" />}
          iconPosition="start"
          sx={{ minHeight: 36 }}
        />
        <Tab
          value={TAB_ADVANCED}
          label="Advanced (FHIR preview)"
          icon={<AdvancedIcon fontSize="small" />}
          iconPosition="start"
          sx={{ minHeight: 36 }}
        />
      </Tabs>

      {activeTab === TAB_EDITOR && (
        <>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Tooltip title="Validate CQL against HAPI's compiler">
              <span>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={validating ? <CircularProgress size={14} /> : <ValidateIcon />}
                  onClick={runValidate}
                  disabled={validating}
                >
                  Validate
                </Button>
              </span>
            </Tooltip>

            {/* Live status pill — most students miss the Alert further down,
                so put the validation outcome right next to the button that
                produced it. Disappears when the buffer changes (handleChange
                resets `issues` to null). */}
            {statusBadge && (
              <Chip
                size="small"
                color={statusBadge.color}
                icon={statusBadge.icon || undefined}
                label={statusBadge.label}
                sx={{ fontWeight: 600 }}
              />
            )}

            <ButtonGroup size="small" variant="outlined">
              <Button
                startIcon={<TemplateIcon />}
                onClick={(e) => setTemplateMenuAnchor(e.currentTarget)}
              >
                Insert template
              </Button>
              <Button
                startIcon={<ValueSetIcon />}
                onClick={() => {
                  // Allow the parent to override (rare); otherwise use the
                  // internal modal which lives next to the editor.
                  if (onOpenValueSetComposer) {
                    onOpenValueSetComposer();
                  } else {
                    setComposerOpen(true);
                  }
                }}
              >
                Compose ValueSet
              </Button>
            </ButtonGroup>

            <Box sx={{ flex: 1 }} />
            <Typography variant="caption" color="text.secondary">
              Required: <code>define Applicability:</code> · Optional:{' '}
              <code>CardSummary</code>, <code>CardDetail</code>
            </Typography>
          </Stack>

          <Menu
            anchorEl={templateMenuAnchor}
            open={Boolean(templateMenuAnchor)}
            onClose={() => setTemplateMenuAnchor(null)}
          >
            {CQL_STARTER_TEMPLATES.map((t) => (
              <MenuItem
                key={t.id}
                onClick={() => insertTemplate(t.id)}
                sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
              >
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {t.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t.description}
                </Typography>
              </MenuItem>
            ))}
          </Menu>

          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            <Editor
              height={height}
              language={CQL_LANGUAGE_ID}
              value={value}
              onChange={handleChange}
              onMount={handleEditorMount}
              theme="vs-dark"
              loading={
                <Box
                  sx={{
                    height,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: '#1e1e1e',
                  }}
                >
                  <CircularProgress />
                </Box>
              }
              options={{
                fontSize: 14,
                lineHeight: 20,
                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
                fontLigatures: true,
                minimap: { enabled: false },
                lineNumbers: 'on',
                rulers: [80, 120],
                wordWrap: 'on',
                wrappingIndent: 'indent',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                insertSpaces: true,
                scrollbar: {
                  vertical: 'visible',
                  horizontal: 'visible',
                  useShadows: false,
                  verticalScrollbarSize: 10,
                  horizontalScrollbarSize: 10,
                },
                suggest: { enabled: true, showWords: true, showSnippets: true },
                quickSuggestions: { other: true, comments: false, strings: false },
                parameterHints: { enabled: true },
                formatOnPaste: false,
                matchBrackets: 'always',
                bracketPairColorization: { enabled: true },
              }}
            />
          </Box>

          {issuePanel}
        </>
      )}

      {activeTab === TAB_ADVANCED && (
        <FHIRPreviewPanel
          loading={previewLoading}
          error={previewError}
          preview={fhirPreview}
        />
      )}

      <ValueSetComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSave={insertValueSetDeclaration}
      />
    </Box>
  );
};

/** Inline read-only viewer for the Library + PlanDefinition the wizard generates. */
const FHIRPreviewPanel = ({ loading, error, preview }) => {
  if (loading) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <CircularProgress size={20} />
      </Box>
    );
  }
  if (error) {
    return (
      <Alert severity="error" sx={{ borderRadius: 0 }}>
        {error}
      </Alert>
    );
  }
  if (!preview) {
    return (
      <Alert severity="info" sx={{ borderRadius: 0 }}>
        Save the service draft once to see the generated FHIR Library and
        PlanDefinition. The save flow uploads them to HAPI; this tab shows
        exactly what HAPI received.
      </Alert>
    );
  }
  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          Library
        </Typography>
        <PreviewBlock json={preview.library} />
      </Box>
      <Divider />
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          PlanDefinition
        </Typography>
        <PreviewBlock json={preview.plan_definition} />
      </Box>
    </Stack>
  );
};

const PreviewBlock = ({ json }) => (
  <Box
    component="pre"
    sx={{
      m: 0,
      p: 2,
      bgcolor: '#1e1e1e',
      color: '#d4d4d4',
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
      fontSize: 12,
      lineHeight: 1.5,
      overflow: 'auto',
      maxHeight: 400,
      borderRadius: 1,
    }}
  >
    {json ? JSON.stringify(json, null, 2) : '(empty)'}
  </Box>
);

export default CQLEditor;
