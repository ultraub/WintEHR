/**
 * Query Workspace Component for FHIR Explorer v4
 * 
 * Save, organize, and manage FHIR queries with full functionality
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Tabs,
  Tab,
  Badge,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  OutlinedInput,
  Checkbox,
  Alert,
  Tooltip,
  Paper,
  Stack,
  LinearProgress,
  Collapse,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Work as WorkIcon,
  Save as SaveIcon,
  Folder as FolderIcon,
  History as HistoryIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  MoreVert as MoreIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  ContentCopy as CopyIcon,
  Code as CodeIcon,
  Category as CategoryIcon,
  Label as LabelIcon,
  QueryStats as StatsIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  PlayArrow as PlayIcon,
  Share as ShareIcon,
  LocalOffer as TagIcon
} from '@mui/icons-material';
import { useQueryHistory } from '../hooks/useQueryHistory';

// Query categories
const QUERY_CATEGORIES = [
  { value: 'general', label: 'General', color: '#9e9e9e' },
  { value: 'patient', label: 'Patient', color: '#2196f3' },
  { value: 'clinical', label: 'Clinical', color: '#4caf50' },
  { value: 'administrative', label: 'Administrative', color: '#ff9800' },
  { value: 'financial', label: 'Financial', color: '#f44336' },
  { value: 'research', label: 'Research', color: '#9c27b0' }
];

function QueryWorkspace({ onNavigate, onLoadQuery }) {
  const {
    queryHistory,
    savedQueries,
    favorites,
    addToHistory,
    clearHistory,
    saveQuery,
    loadQuery,
    deleteQuery,
    clearSavedQueries,
    toggleFavorite,
    getFavoriteQueries,
    searchQueries,
    exportData,
    importData,
    getStatistics,
    hasHistory,
    hasSavedQueries,
    hasFavorites
  } = useQueryHistory();

  const [currentTab, setCurrentTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [editingQuery, setEditingQuery] = useState(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedQuery, setSelectedQuery] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [showStats, setShowStats] = useState(false);

  // Query form state
  const [queryForm, setQueryForm] = useState({
    name: '',
    description: '',
    category: 'general',
    tags: [],
    isPublic: false
  });

  // Get statistics
  const stats = useMemo(() => getStatistics(), [getStatistics]);

  // Get all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set();
    savedQueries.forEach(query => {
      query.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet);
  }, [savedQueries]);

  // Filter queries based on current tab and search
  const filteredQueries = useMemo(() => {
    let queries = [];
    
    switch (currentTab) {
      case 0: // All Saved
        queries = savedQueries;
        break;
      case 1: // Favorites
        queries = getFavoriteQueries();
        break;
      case 2: // History
        return queryHistory;
      default:
        queries = savedQueries;
    }

    // Apply category filter
    if (selectedCategory) {
      queries = queries.filter(q => q.category === selectedCategory);
    }

    // Apply tag filter
    if (selectedTags.length > 0) {
      queries = queries.filter(q => 
        selectedTags.some(tag => q.tags?.includes(tag))
      );
    }

    // Apply search
    if (searchTerm) {
      const results = searchQueries(searchTerm, {
        includeHistory: currentTab === 2,
        includeSaved: currentTab !== 2,
        category: selectedCategory || null,
        tags: selectedTags
      });
      queries = results.filter(r => 
        currentTab === 2 ? r.type === 'history' : r.type === 'saved'
      );
    }

    return queries;
  }, [currentTab, savedQueries, getFavoriteQueries, queryHistory, selectedCategory, selectedTags, searchTerm, searchQueries]);

  // Handle save query
  const handleSaveQuery = useCallback(() => {
    if (!editingQuery || !queryForm.name.trim()) return;

    try {
      const savedId = saveQuery({
        ...editingQuery,
        ...queryForm,
        tags: queryForm.tags.filter(t => t.trim())
      });
      
      setSaveDialogOpen(false);
      setEditingQuery(null);
      setQueryForm({
        name: '',
        description: '',
        category: 'general',
        tags: [],
        isPublic: false
      });
    } catch (error) {
      console.error('Failed to save query:', error);
    }
  }, [editingQuery, queryForm, saveQuery]);

  // Handle load query
  const handleLoadQuery = useCallback((query) => {
    try {
      const loadedQuery = query.id ? loadQuery(query.id) : query;
      if (onLoadQuery) {
        onLoadQuery(loadedQuery);
        onNavigate('discovery'); // Navigate to discovery to run the query
      }
    } catch (error) {
      console.error('Failed to load query:', error);
    }
  }, [loadQuery, onLoadQuery, onNavigate]);

  // Handle delete query
  const handleDeleteQuery = useCallback((queryId) => {
    if (window.confirm('Are you sure you want to delete this query?')) {
      deleteQuery(queryId);
      setMenuAnchor(null);
      setSelectedQuery(null);
    }
  }, [deleteQuery]);

  // Handle export
  const handleExport = useCallback(() => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fhir-queries-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportData]);

  // Handle import
  const handleImport = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const success = importData(data);
        if (success) {
          setImportDialogOpen(false);
        } else {
          alert('Failed to import queries. Please check the file format.');
        }
      } catch (error) {
        console.error('Import error:', error);
        alert('Invalid file format. Please select a valid query export file.');
      }
    };
    reader.readAsText(file);
  }, [importData]);

  // Render query item
  const renderQueryItem = (query, isHistory = false) => {
    const isFavorite = !isHistory && favorites.includes(query.id);
    
    return (
      <ListItem key={query.id} disablePadding>
        <ListItemButton onClick={() => handleLoadQuery(query)}>
          <ListItemIcon>
            <CodeIcon />
          </ListItemIcon>
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2">
                  {isHistory ? query.query.substring(0, 50) + '...' : query.name}
                </Typography>
                {!isHistory && (
                  <>
                    <Chip
                      label={query.category}
                      size="small"
                      sx={{
                        backgroundColor: QUERY_CATEGORIES.find(c => c.value === query.category)?.color,
                        color: 'white',
                        height: 20
                      }}
                    />
                    {query.tags?.map(tag => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ height: 20 }} />
                    ))}
                  </>
                )}
              </Box>
            }
            secondary={
              <Box>
                {!isHistory && query.description && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    {query.description}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  {isHistory ? (
                    <>
                      {query.resultCount} results • {query.executionTime}ms • {new Date(query.timestamp).toLocaleString()}
                    </>
                  ) : (
                    <>
                      Used {query.useCount || 0} times • Created {new Date(query.createdAt).toLocaleDateString()}
                    </>
                  )}
                </Typography>
              </Box>
            }
          />
          <ListItemSecondaryAction>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {!isHistory && (
                <IconButton onClick={(e) => { e.stopPropagation(); toggleFavorite(query.id); }}>
                  {isFavorite ? <StarIcon color="warning" /> : <StarBorderIcon />}
                </IconButton>
              )}
              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedQuery(query);
                  setMenuAnchor(e.currentTarget);
                }}
              >
                <MoreIcon />
              </IconButton>
            </Box>
          </ListItemSecondaryAction>
        </ListItemButton>
      </ListItem>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <WorkIcon color="primary" />
          Query Workspace
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage, organize, and share your FHIR queries
        </Typography>
      </Box>

      {/* Statistics Panel */}
      <Collapse in={showStats}>
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary">{stats.totalQueries}</Typography>
                <Typography variant="body2" color="text.secondary">Total Queries</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="secondary">{stats.savedCount}</Typography>
                <Typography variant="body2" color="text.secondary">Saved Queries</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="warning.main">{stats.favoriteCount}</Typography>
                <Typography variant="body2" color="text.secondary">Favorites</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">{stats.historyCount}</Typography>
                <Typography variant="body2" color="text.secondary">History Items</Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Collapse>

      {/* Controls */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search queries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchTerm('')}>
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                label="Category"
              >
                <MenuItem value="">All Categories</MenuItem>
                {QUERY_CATEGORIES.map(cat => (
                  <MenuItem key={cat.value} value={cat.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: cat.color }} />
                      {cat.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Tags</InputLabel>
              <Select
                multiple
                value={selectedTags}
                onChange={(e) => setSelectedTags(e.target.value)}
                input={<OutlinedInput label="Tags" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {allTags.map((tag) => (
                  <MenuItem key={tag} value={tag}>
                    <Checkbox checked={selectedTags.indexOf(tag) > -1} />
                    <ListItemText primary={tag} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Stack direction="row" spacing={1}>
              <Tooltip title="Toggle Statistics">
                <IconButton onClick={() => setShowStats(!showStats)} color={showStats ? 'primary' : 'default'}>
                  <StatsIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Export Queries">
                <IconButton onClick={handleExport}>
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Import Queries">
                <IconButton onClick={() => setImportDialogOpen(true)}>
                  <UploadIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Tabs value={currentTab} onChange={(e, v) => setCurrentTab(v)}>
          <Tab 
            label={
              <Badge badgeContent={savedQueries.length} color="primary">
                Saved Queries
              </Badge>
            } 
          />
          <Tab 
            label={
              <Badge badgeContent={favorites.length} color="warning">
                Favorites
              </Badge>
            } 
          />
          <Tab 
            label={
              <Badge badgeContent={queryHistory.length} color="secondary">
                History
              </Badge>
            } 
          />
        </Tabs>

        {/* Query List */}
        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
          {filteredQueries.length === 0 ? (
            <Alert severity="info">
              {searchTerm || selectedCategory || selectedTags.length > 0
                ? 'No queries match your filters'
                : currentTab === 0
                  ? 'No saved queries yet'
                  : currentTab === 1
                    ? 'No favorite queries yet'
                    : 'No query history yet'
              }
            </Alert>
          ) : (
            <List>
              {filteredQueries.map((query) => renderQueryItem(query, currentTab === 2))}
            </List>
          )}
        </Box>

        {/* Clear buttons */}
        {currentTab === 2 && hasHistory && (
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => {
                if (window.confirm('Are you sure you want to clear all query history?')) {
                  clearHistory();
                }
              }}
            >
              Clear History
            </Button>
          </Box>
        )}
      </Paper>

      {/* Query Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => {
          navigator.clipboard.writeText(selectedQuery?.query || '');
          setMenuAnchor(null);
        }}>
          <ListItemIcon><CopyIcon /></ListItemIcon>
          Copy Query
        </MenuItem>
        {selectedQuery && !selectedQuery.type && (
          <>
            <MenuItem onClick={() => {
              setEditingQuery(selectedQuery);
              setQueryForm({
                name: selectedQuery.name,
                description: selectedQuery.description || '',
                category: selectedQuery.category || 'general',
                tags: selectedQuery.tags || [],
                isPublic: selectedQuery.isPublic || false
              });
              setSaveDialogOpen(true);
              setMenuAnchor(null);
            }}>
              <ListItemIcon><EditIcon /></ListItemIcon>
              Edit
            </MenuItem>
            <MenuItem onClick={() => handleDeleteQuery(selectedQuery.id)}>
              <ListItemIcon><DeleteIcon /></ListItemIcon>
              Delete
            </MenuItem>
          </>
        )}
        {selectedQuery?.type === 'history' && (
          <MenuItem onClick={() => {
            setEditingQuery(selectedQuery);
            setQueryForm({
              name: '',
              description: '',
              category: 'general',
              tags: [],
              isPublic: false
            });
            setSaveDialogOpen(true);
            setMenuAnchor(null);
          }}>
            <ListItemIcon><SaveIcon /></ListItemIcon>
            Save Query
          </MenuItem>
        )}
      </Menu>

      {/* Save Query Dialog */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Save Query</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Query Name"
              value={queryForm.name}
              onChange={(e) => setQueryForm({ ...queryForm, name: e.target.value })}
              required
              autoFocus
            />
            <TextField
              fullWidth
              label="Description"
              value={queryForm.description}
              onChange={(e) => setQueryForm({ ...queryForm, description: e.target.value })}
              multiline
              rows={2}
            />
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={queryForm.category}
                onChange={(e) => setQueryForm({ ...queryForm, category: e.target.value })}
                label="Category"
              >
                {QUERY_CATEGORIES.map(cat => (
                  <MenuItem key={cat.value} value={cat.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: cat.color }} />
                      {cat.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Tags (comma separated)"
              value={queryForm.tags.join(', ')}
              onChange={(e) => setQueryForm({ 
                ...queryForm, 
                tags: e.target.value.split(',').map(t => t.trim()).filter(t => t)
              })}
              helperText="Add tags to help organize and find your queries"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={queryForm.isPublic}
                  onChange={(e) => setQueryForm({ ...queryForm, isPublic: e.target.checked })}
                />
              }
              label="Share with team"
            />
            {editingQuery && (
              <Alert severity="info">
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  {editingQuery.query}
                </Typography>
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveQuery} variant="contained" disabled={!queryForm.name.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)}>
        <DialogTitle>Import Queries</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Select a previously exported query file to import
          </Alert>
          <Button
            variant="contained"
            component="label"
            startIcon={<UploadIcon />}
            fullWidth
          >
            Choose File
            <input
              type="file"
              accept=".json"
              hidden
              onChange={handleImport}
            />
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default QueryWorkspace;