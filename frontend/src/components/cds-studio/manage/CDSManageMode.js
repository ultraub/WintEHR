/**
 * CDS Manage Mode - Manage, analyze, and organize CDS hooks
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Button,
  TextField,
  InputAdornment,
  Stack,
  Alert,
  Tooltip,
  Menu,
  MenuItem
} from '@mui/material';
import {
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as DuplicateIcon,
  MoreVert as MoreIcon,
  Analytics as AnalyticsIcon,
  Group as TeamIcon,
  History as HistoryIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { cdsHooksService } from '../../../services/cdsHooksService';
import { useCDSStudio } from '../../../pages/CDSHooksStudio';

const CDSManageMode = () => {
  const { actions } = useCDSStudio();
  const [hooks, setHooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedHook, setSelectedHook] = useState(null);

  useEffect(() => {
    loadHooks();
  }, []);

  const loadHooks = async () => {
    try {
      setLoading(true);
      const customHooks = await cdsHooksService.getHooks();
      setHooks(customHooks);
    } catch (error) {
      console.error('Failed to load hooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (hook) => {
    actions.setCurrentHook(hook);
    // Switch to build mode would be handled by parent
  };

  const handleDelete = async (hookId) => {
    if (window.confirm('Are you sure you want to delete this hook?')) {
      try {
        await cdsHooksService.deleteHook(hookId);
        await loadHooks();
      } catch (error) {
        console.error('Failed to delete hook:', error);
      }
    }
  };

  const handleDuplicate = async (hook) => {
    const duplicate = {
      ...hook,
      id: undefined,
      title: `${hook.title} (Copy)`,
      _meta: {
        ...hook._meta,
        created: new Date(),
        modified: new Date()
      }
    };
    
    try {
      await cdsHooksService.createHook(duplicate);
      await loadHooks();
    } catch (error) {
      console.error('Failed to duplicate hook:', error);
    }
  };

  const filteredHooks = hooks.filter(hook => 
    hook.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hook.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: hooks.length,
    byType: hooks.reduce((acc, hook) => {
      acc[hook.hook] = (acc[hook.hook] || 0) + 1;
      return acc;
    }, {}),
    active: hooks.filter(h => h.enabled !== false).length
  };

  return (
    <Box>
      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Hooks
              </Typography>
              <Typography variant="h4">
                {stats.total}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Active Hooks
              </Typography>
              <Typography variant="h4">
                {stats.active}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Hook Types
              </Typography>
              <Typography variant="h4">
                {Object.keys(stats.byType).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Team Members
              </Typography>
              <Typography variant="h4">
                5
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Actions */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <TextField
          placeholder="Search hooks..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ width: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
        />
        
        <Stack direction="row" spacing={2}>
          <Button startIcon={<AnalyticsIcon />}>
            Analytics
          </Button>
          <Button startIcon={<TeamIcon />}>
            Team
          </Button>
          <Button startIcon={<HistoryIcon />}>
            History
          </Button>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={() => {
              actions.setCurrentHook({
                id: '',
                title: '',
                description: '',
                hook: 'patient-view',
                conditions: [],
                cards: [],
                prefetch: {}
              });
            }}
          >
            New Hook
          </Button>
        </Stack>
      </Box>

      {/* Hooks Table */}
      {loading ? (
        <Alert severity="info">Loading hooks...</Alert>
      ) : filteredHooks.length === 0 ? (
        <Alert severity="warning">
          {searchTerm ? `No hooks found matching "${searchTerm}"` : 'No hooks created yet'}
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Hook Type</TableCell>
                <TableCell>Conditions</TableCell>
                <TableCell>Cards</TableCell>
                <TableCell>Modified</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredHooks.map(hook => (
                <TableRow key={hook.id}>
                  <TableCell>
                    <Typography variant="subtitle2">{hook.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {hook.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={hook.hook} size="small" />
                  </TableCell>
                  <TableCell>{hook.conditions?.length || 0}</TableCell>
                  <TableCell>{hook.cards?.length || 0}</TableCell>
                  <TableCell>
                    {new Date(hook._meta?.modified || Date.now()).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={hook.enabled !== false ? 'Active' : 'Inactive'}
                      color={hook.enabled !== false ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleEdit(hook)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Duplicate">
                        <IconButton size="small" onClick={() => handleDuplicate(hook)}>
                          <DuplicateIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => handleDelete(hook.id)} color="error">
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                      <IconButton 
                        size="small"
                        onClick={(e) => {
                          setAnchorEl(e.currentTarget);
                          setSelectedHook(hook);
                        }}
                      >
                        <MoreIcon />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* More Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => setAnchorEl(null)}>View Analytics</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>View History</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Export</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Share</MenuItem>
      </Menu>
    </Box>
  );
};

export default CDSManageMode;