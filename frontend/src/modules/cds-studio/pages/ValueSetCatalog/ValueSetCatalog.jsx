/**
 * ValueSet Catalog — manager surface for all student-authored and system
 * ValueSets used across the CDS Studio.
 *
 * Lives as a Dialog because the rest of the studio surfaces (Credentials,
 * Monitoring) are also dialogs off the AppBar — keeps the navigation
 * pattern consistent and avoids carving a new top-level route. Future
 * deep-link work can lift this to its own route without touching the
 * internal API.
 *
 * Three actions per row:
 *   - "View codes" — expand inline to see the code list (no DB hit beyond
 *     the initial list).
 *   - "Edit" — opens ValueSetComposer in edit mode; save PUTs through
 *     cdsStudioApi.updateValueSet.
 *   - "Delete" — confirm dialog → cdsStudioApi.deleteValueSet (soft).
 *     Disabled for `wintehr-*` system VSes (those are seeded from
 *     terminology and shouldn't be student-deletable).
 *
 * Errors surface via a Snackbar so closing the inner confirm dialog
 * doesn't take the message with it.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
} from '@mui/icons-material';

import cdsStudioApi from '../../services/cdsStudioApi';
import ValueSetComposer from '../../components/builders/ValueSetComposer';

const isSystemVS = (vs) => (vs?.vs_id || '').startsWith('wintehr-');

const ValueSetCatalog = ({ open, onClose }) => {
  const [query, setQuery] = useState('');
  const [valueSets, setValueSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' });

  const load = useCallback(async (q) => {
    setLoading(true);
    setError(null);
    try {
      const results = await cdsStudioApi.listValueSets({
        search: q?.trim() || undefined,
        limit: 200,
      });
      setValueSets(Array.isArray(results) ? results : []);
    } catch (err) {
      setError(err?.message || 'Failed to load ValueSets');
      setValueSets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch on open and on debounced query change. 200ms matches the
  // composer's catalog search debounce — fast enough to feel responsive,
  // slow enough to avoid request-per-keystroke.
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => load(query), 200);
    return () => clearTimeout(handle);
  }, [open, query, load]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await cdsStudioApi.deleteValueSet(deleteTarget.vs_id);
      setSnackbar({
        open: true,
        message: `Deleted "${deleteTarget.title || deleteTarget.name}"`,
        severity: 'success',
      });
      setDeleteTarget(null);
      await load(query);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err?.message || 'Failed to delete ValueSet',
        severity: 'error',
      });
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, query, load]);

  const handleEditorSaved = useCallback(() => {
    setEditing(null);
    load(query);
    setSnackbar({ open: true, message: 'ValueSet updated', severity: 'success' });
  }, [query, load]);

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { height: '90vh' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          ValueSet Catalog
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Refresh">
            <IconButton onClick={() => load(query)} size="small">
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <IconButton onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, title, or description…"
              fullWidth
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: loading ? <CircularProgress size={18} /> : null,
              }}
            />

            {error && <Alert severity="error">{error}</Alert>}

            <TableContainer component={Paper} variant="outlined" sx={{ flex: 1 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell width={40} />
                    <TableCell>Name</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell align="right">Codes</TableCell>
                    <TableCell>Created by</TableCell>
                    <TableCell>Origin</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!loading && valueSets.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                          {query ? 'No matches — try a different search.' : 'No ValueSets yet.'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}

                  {valueSets.map((vs) => {
                    const expanded = expandedId === vs.vs_id;
                    const system = isSystemVS(vs);
                    const codeCount = Array.isArray(vs.codes) ? vs.codes.length : 0;
                    return (
                      <React.Fragment key={vs.vs_id}>
                        <TableRow
                          hover
                          onClick={() => setExpandedId(expanded ? null : vs.vs_id)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell>
                            <ExpandMoreIcon
                              fontSize="small"
                              sx={{
                                transition: '0.15s transform',
                                transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace">
                              {vs.name}
                            </Typography>
                          </TableCell>
                          <TableCell>{vs.title || <em>—</em>}</TableCell>
                          <TableCell align="right">
                            <Chip label={codeCount} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>{vs.created_by || <em>—</em>}</TableCell>
                          <TableCell>
                            <Chip
                              label={system ? 'system' : 'user'}
                              size="small"
                              color={system ? 'default' : 'primary'}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                            <Tooltip title={system ? 'System ValueSets cannot be edited' : 'Edit'}>
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={system}
                                  onClick={() => setEditing(vs)}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title={system ? 'System ValueSets cannot be deleted' : 'Delete'}>
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={system}
                                  onClick={() => setDeleteTarget(vs)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                        {expanded && (
                          <TableRow>
                            <TableCell colSpan={7} sx={{ bgcolor: 'background.default' }}>
                              <Box sx={{ p: 2 }}>
                                {vs.description && (
                                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    {vs.description}
                                  </Typography>
                                )}
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                  Canonical URL: <code>{vs.hapi_canonical_url}</code>
                                </Typography>
                                {Array.isArray(vs.codes) && vs.codes.length > 0 ? (
                                  <TableContainer component={Paper} variant="outlined">
                                    <Table size="small">
                                      <TableHead>
                                        <TableRow>
                                          <TableCell>System</TableCell>
                                          <TableCell>Code</TableCell>
                                          <TableCell>Display</TableCell>
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        {vs.codes.slice(0, 50).map((c) => (
                                          <TableRow key={`${c.system}|${c.code}`}>
                                            <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                                              {c.system?.split('/').pop()}
                                            </TableCell>
                                            <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                                              {c.code}
                                            </TableCell>
                                            <TableCell>{c.display || ''}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                    {vs.codes.length > 50 && (
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ p: 1, display: 'block', textAlign: 'center' }}
                                      >
                                        …and {vs.codes.length - 50} more
                                      </Typography>
                                    )}
                                  </TableContainer>
                                ) : (
                                  <Typography variant="caption" color="text.secondary">
                                    No codes.
                                  </Typography>
                                )}
                              </Box>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1, pl: 2 }}>
            {valueSets.length} ValueSet{valueSets.length === 1 ? '' : 's'}
            {query && ' matching'}
          </Typography>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Inline editor for the catalog's row-action "Edit" button. */}
      <ValueSetComposer
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        onSave={handleEditorSaved}
        editingValueSet={editing}
      />

      {/* Delete confirmation — matches the ServicesTable pattern. */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => !deleting && setDeleteTarget(null)}>
        <DialogTitle>Delete ValueSet?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteTarget && (
              <>
                This will remove <strong>{deleteTarget.title || deleteTarget.name}</strong>{' '}
                (<code>{deleteTarget.vs_id}</code>). Any service that references this
                ValueSet via <code>valueset "{deleteTarget.name}": '…'</code> will stop
                resolving until the declaration is updated.
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={confirmDelete} color="error" disabled={deleting} autoFocus>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ValueSetCatalog;
