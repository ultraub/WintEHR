/**
 * Pharmacy Queue List Component
 * List-based pharmacy prescription queue management
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Grid,
  TextField,
  MenuItem,
  Badge,
  Skeleton
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  LocalPharmacy as PharmacyIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { pharmacyService } from '../../services/pharmacyService';
import { format } from 'date-fns';

const PharmacyQueueList = ({ onSelectPrescription, height = '600px' }) => {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    priority: ''
  });
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);

  // Load queue data
  const loadQueue = useCallback(async () => {
    try {
      setError(null);
      
      // Build filter params
      const filterParams = {};
      if (filters.status) filterParams.status = filters.status;
      if (filters.priority) filterParams.priority = filters.priority;
      
      // Fetch queue and stats in parallel
      const [queueData, statsData] = await Promise.all([
        pharmacyService.getPharmacyQueue(filterParams),
        pharmacyService.getQueueStatistics()
      ]);
      
      setQueue(queueData);
      setStats(statsData);
    } catch (err) {
      console.error('Error loading pharmacy queue:', err);
      setError(err.message || 'Failed to load pharmacy queue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  // Initial load and refresh
  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Auto-refresh every minute
  useEffect(() => {
    const interval = setInterval(() => {
      loadQueue();
    }, 60000);
    
    return () => clearInterval(interval);
  }, [loadQueue]);

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    loadQueue();
  };

  // Handle filter change
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Get status color
  const getStatusColor = (status) => {
    const statusConfig = pharmacyService.getStatusOptions().find(s => s.value === status);
    return statusConfig?.color || 'default';
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    const priorityConfig = pharmacyService.getPriorityLevels().find(p => p.value === priority);
    return priorityConfig?.color || 'default';
  };

  // Get priority label
  const getPriorityLabel = (priority) => {
    const priorityConfig = pharmacyService.getPriorityLevels().find(p => p.value === priority);
    return priorityConfig?.label || `Priority ${priority}`;
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a');
    } catch {
      return dateString;
    }
  };

  // Calculate time waiting
  const getWaitTime = (prescribedDate) => {
    if (!prescribedDate) return null;
    
    const prescribed = new Date(prescribedDate);
    const now = new Date();
    const hoursWaiting = Math.floor((now - prescribed) / (1000 * 60 * 60));
    
    if (hoursWaiting < 1) return 'Less than 1 hour';
    if (hoursWaiting === 1) return '1 hour';
    if (hoursWaiting < 24) return `${hoursWaiting} hours`;
    
    const days = Math.floor(hoursWaiting / 24);
    return days === 1 ? '1 day' : `${days} days`;
  };

  // Handle prescription click
  const handlePrescriptionClick = (item) => {
    if (onSelectPrescription) {
      onSelectPrescription(item);
    }
  };

  // Render loading state
  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        {[1, 2, 3].map(i => (
          <Card key={i} sx={{ mb: 2 }}>
            <CardContent>
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="text" width="40%" />
              <Skeleton variant="rectangular" height={60} sx={{ mt: 1 }} />
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ height, display: 'flex', flexDirection: 'column' }}>
      {/* Header with filters */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6}>
            <Typography variant="h6" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PharmacyIcon />
              Pharmacy Queue
              {stats && (
                <Badge badgeContent={stats.total} color="primary" sx={{ ml: 2 }}>
                  <span />
                </Badge>
              )}
            </Typography>
          </Grid>
          
          <Grid item xs={12} sm={6} sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <TextField
              select
              size="small"
              label="Status"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="">All</MenuItem>
              {pharmacyService.getStatusOptions().map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            
            <TextField
              select
              size="small"
              label="Priority"
              value={filters.priority}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="">All</MenuItem>
              {pharmacyService.getPriorityLevels().map(level => (
                <MenuItem key={level.value} value={level.value}>
                  {level.label}
                </MenuItem>
              ))}
            </TextField>
            
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh} disabled={refreshing}>
                <RefreshIcon className={refreshing ? 'rotating' : ''} />
              </IconButton>
            </Tooltip>
          </Grid>
        </Grid>

        {/* Statistics */}
        {stats && (
          <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {stats.overdue > 0 && (
              <Chip
                icon={<WarningIcon />}
                label={`${stats.overdue} Overdue`}
                color="error"
                size="small"
              />
            )}
            <Chip
              icon={<ScheduleIcon />}
              label={`Avg wait: ${stats.avgWaitTime}h`}
              size="small"
            />
            {Object.entries(stats.byStatus).map(([status, count]) => (
              <Chip
                key={status}
                label={`${status}: ${count}`}
                color={getStatusColor(status)}
                size="small"
                variant="outlined"
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Error message */}
      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}

      {/* Queue items */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {queue.length === 0 ? (
          <Alert severity="info">
            No prescriptions in the queue
          </Alert>
        ) : (
          queue.map((item) => (
            <Card 
              key={item.medication_request_id} 
              sx={{ 
                mb: 2,
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: 'action.hover'
                },
                border: item.priority === 1 ? 2 : 1,
                borderColor: item.priority === 1 ? 'error.main' : 'divider'
              }}
              onClick={() => handlePrescriptionClick(item)}
            >
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={8}>
                    <Typography variant="h6" gutterBottom>
                      {item.medication_name}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Patient: {item.patient_id}
                    </Typography>
                    
                    {item.quantity && (
                      <Typography variant="body2">
                        Quantity: {item.quantity} {item.unit}
                      </Typography>
                    )}
                    
                    <Typography variant="body2" color="text.secondary">
                      Prescribed: {formatDate(item.prescribed_date)}
                      {item.prescribed_date && (
                        <span> ({getWaitTime(item.prescribed_date)})</span>
                      )}
                    </Typography>
                    
                    {item.prescriber && (
                      <Typography variant="body2" color="text.secondary">
                        Prescriber: {item.prescriber}
                      </Typography>
                    )}
                  </Grid>
                  
                  <Grid item xs={12} sm={4} sx={{ textAlign: 'right' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
                      <Chip
                        label={getPriorityLabel(item.priority)}
                        color={getPriorityColor(item.priority)}
                        size="small"
                      />
                      
                      <Chip
                        label={item.status}
                        color={getStatusColor(item.status)}
                        size="small"
                        icon={item.status === 'completed' ? <CheckIcon /> : undefined}
                      />
                      
                      {item.due_date && new Date(item.due_date) < new Date() && (
                        <Chip
                          label="Overdue"
                          color="error"
                          size="small"
                          icon={<WarningIcon />}
                        />
                      )}
                    </Box>
                  </Grid>
                </Grid>

                {item.pharmacy_notes && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    {item.pharmacy_notes}
                  </Alert>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </Box>

      <style jsx>{`
        @keyframes rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        .rotating {
          animation: rotate 1s linear infinite;
        }
      `}</style>
    </Box>
  );
};

export default PharmacyQueueList;