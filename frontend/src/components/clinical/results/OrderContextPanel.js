/**
 * Order Context Panel Component
 * 
 * Displays comprehensive order context for lab results, integrating
 * ServiceRequest resources for complete order-to-result correlation.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Stack,
  Alert,
  Skeleton,
  Button,
  IconButton,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Assignment as OrderIcon,
  Person as ProviderIcon,
  Schedule as DateIcon,
  Flag as PriorityIcon,
  Info as IndicationIcon,
  CheckCircle as CompletedIcon,
  Pending as PendingIcon,
  Error as ErrorIcon,
  Visibility as ViewIcon,
  Link as LinkIcon,
  AccessTime as TimingIcon,
  Assignment
} from '@mui/icons-material';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { fhirClient } from '../../../core/fhir/services/fhirClient';
import { providerAccountabilityService } from '../../../services/providerAccountabilityService';
import { getReferenceId } from '../../../core/fhir/utils/fhirFieldUtils';

const OrderContextPanel = ({ observation, onOrderSelect = null }) => {
  const [serviceRequest, setServiceRequest] = useState(null);
  const [orderContext, setOrderContext] = useState(null);
  const [orderingProvider, setOrderingProvider] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (observation?.basedOn?.[0]?.reference) {
      loadOrderContext();
    } else {
      // Clear context if no order reference
      setServiceRequest(null);
      setOrderContext(null);
      setOrderingProvider(null);
    }
  }, [observation]);

  const loadOrderContext = async () => {
    if (!observation.basedOn?.[0]?.reference) return;

    setLoading(true);
    setError(null);

    try {
      const orderReference = observation.basedOn[0].reference;
      const orderId = getReferenceId(orderReference);
      
      // Load the ServiceRequest
      const order = await fhirClient.read('ServiceRequest', orderId);
      setServiceRequest(order);

      // Extract order context
      const context = {
        id: order.id,
        status: order.status,
        intent: order.intent,
        priority: order.priority,
        category: order.category?.[0]?.text || order.category?.[0]?.coding?.[0]?.display,
        code: order.code?.text || order.code?.coding?.[0]?.display,
        clinicalIndication: extractClinicalIndication(order),
        orderDate: order.authoredOn,
        occurrenceDateTime: order.occurrenceDateTime,
        requester: order.requester,
        performer: order.performer?.[0],
        reasonCode: order.reasonCode?.[0]?.text || order.reasonCode?.[0]?.coding?.[0]?.display,
        reasonReference: order.reasonReference?.[0],
        note: order.note?.[0]?.text,
        supportingInfo: order.supportingInfo,
        specimen: order.specimen?.[0],
        bodySite: order.bodySite?.[0]?.text || order.bodySite?.[0]?.coding?.[0]?.display
      };
      setOrderContext(context);

      // Load ordering provider details
      if (order.requester?.reference) {
        const provider = await providerAccountabilityService.getProviderInfo(order.requester.reference);
        setOrderingProvider(provider);
      }

    } catch (err) {
      // Error loading order context - displaying user-friendly message
      setError('Failed to load order information');
    } finally {
      setLoading(false);
    }
  };

  const extractClinicalIndication = (order) => {
    // Check multiple possible sources for clinical indication
    if (order.reasonCode?.[0]?.text) {
      return order.reasonCode[0].text;
    }
    if (order.reasonCode?.[0]?.coding?.[0]?.display) {
      return order.reasonCode[0].coding[0].display;
    }
    if (order.reasonReference?.[0]?.display) {
      return order.reasonReference[0].display;
    }
    if (order.note?.[0]?.text) {
      return order.note[0].text;
    }
    return null;
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <CompletedIcon color="success" />;
      case 'active':
      case 'in-progress':
        return <PendingIcon color="primary" />;
      case 'cancelled':
      case 'stopped':
        return <ErrorIcon color="error" />;
      default:
        return <PendingIcon color="default" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'success';
      case 'active':
      case 'in-progress':
        return 'primary';
      case 'cancelled':
      case 'stopped':
        return 'error';
      case 'on-hold':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'stat':
      case 'urgent':
        return 'error';
      case 'asap':
        return 'warning';
      case 'routine':
        return 'default';
      default:
        return 'default';
    }
  };

  const formatTimingInfo = () => {
    if (!orderContext) return null;

    const orderDate = orderContext.orderDate ? parseISO(orderContext.orderDate) : null;
    const resultDate = observation.effectiveDateTime ? parseISO(observation.effectiveDateTime) : 
                      observation.issued ? parseISO(observation.issued) : null;

    if (orderDate && resultDate) {
      const turnaroundTime = resultDate - orderDate;
      const hours = Math.floor(turnaroundTime / (1000 * 60 * 60));
      const minutes = Math.floor((turnaroundTime % (1000 * 60 * 60)) / (1000 * 60));
      
      return {
        orderDate,
        resultDate,
        turnaroundTime: `${hours}h ${minutes}m`,
        isDelayed: hours > 24 // Consider >24h as delayed
      };
    }

    return { orderDate, resultDate };
  };

  if (!observation.basedOn?.[0]?.reference) {
    return (
      <Alert severity="info" icon={<OrderIcon />}>
        <Typography variant="body2">
          No order context available for this result. This may be a direct lab result or the order reference is missing.
        </Typography>
      </Alert>
    );
  }

  if (loading) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="rectangular" width="100%" height={60} />
            <Skeleton variant="text" width="80%" height={20} />
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        <Typography variant="body2">{error}</Typography>
        <Button 
          size="small" 
          onClick={loadOrderContext}
          sx={{ mt: 1 }}
        >
          Retry
        </Button>
      </Alert>
    );
  }

  if (!orderContext) return null;

  const timingInfo = formatTimingInfo();

  return (
    <Card variant="outlined" sx={{ mt: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <OrderIcon color="primary" />
            Order Context
          </Typography>
          
          <Stack direction="row" spacing={1} alignItems="center">
            {getStatusIcon(orderContext.status)}
            <Chip 
              label={orderContext.status || 'Unknown'} 
              size="small" 
              color={getStatusColor(orderContext.status)}
            />
            {orderContext.priority && (
              <Chip 
                label={orderContext.priority.toUpperCase()} 
                size="small" 
                color={getPriorityColor(orderContext.priority)}
                icon={<PriorityIcon />}
              />
            )}
            {onOrderSelect && (
              <Tooltip title="View full order details">
                <IconButton 
                  size="small" 
                  onClick={() => onOrderSelect(serviceRequest)}
                >
                  <ViewIcon />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Box>

        <Grid container spacing={3}>
          {/* Order Information */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Order Details
            </Typography>
            
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <Assignment fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Test Ordered"
                  secondary={orderContext.code || 'Not specified'}
                />
              </ListItem>
              
              <ListItem>
                <ListItemIcon>
                  <DateIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Order Date"
                  secondary={orderContext.orderDate ? 
                    format(parseISO(orderContext.orderDate), 'MMM d, yyyy h:mm a') : 
                    'Not specified'}
                />
              </ListItem>

              {orderContext.category && (
                <ListItem>
                  <ListItemIcon>
                    <LinkIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Category"
                    secondary={orderContext.category}
                  />
                </ListItem>
              )}
            </List>
          </Grid>

          {/* Provider Information */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Ordering Provider
            </Typography>
            
            {orderingProvider ? (
              <Box>
                <Typography variant="body1" fontWeight="bold">
                  {orderingProvider.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {orderingProvider.specialty}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {orderingProvider.organization}
                </Typography>
                {orderingProvider.contact?.email && (
                  <Chip 
                    label="Contact available" 
                    size="small" 
                    color="success" 
                    variant="outlined" 
                    sx={{ mt: 1 }}
                  />
                )}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {orderContext.requester?.display || 'Provider information not available'}
              </Typography>
            )}
          </Grid>

          {/* Clinical Indication */}
          {orderContext.clinicalIndication && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                <IndicationIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                Clinical Indication
              </Typography>
              <Alert severity="info" sx={{ mt: 1 }}>
                <Typography variant="body2">
                  {orderContext.clinicalIndication}
                </Typography>
              </Alert>
            </Grid>
          )}

          {/* Timing Information */}
          {timingInfo && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                <TimingIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                Timing Analysis
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Box textAlign="center">
                    <Typography variant="caption" color="text.secondary">Ordered</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {timingInfo.orderDate ? format(timingInfo.orderDate, 'MMM d, h:mm a') : 'Unknown'}
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={4}>
                  <Box textAlign="center">
                    <Typography variant="caption" color="text.secondary">Result Available</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {timingInfo.resultDate ? format(timingInfo.resultDate, 'MMM d, h:mm a') : 'Unknown'}
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={4}>
                  <Box textAlign="center">
                    <Typography variant="caption" color="text.secondary">Turnaround Time</Typography>
                    <Typography 
                      variant="body2" 
                      fontWeight="bold"
                      color={timingInfo.isDelayed ? 'error.main' : 'success.main'}
                    >
                      {timingInfo.turnaroundTime || 'Calculating...'}
                    </Typography>
                    {timingInfo.isDelayed && (
                      <Chip label="Delayed" size="small" color="error" sx={{ mt: 0.5 }} />
                    )}
                  </Box>
                </Grid>
              </Grid>
            </Grid>
          )}

          {/* Additional Information */}
          {(orderContext.note || orderContext.supportingInfo) && (
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Additional Information
              </Typography>
              
              {orderContext.note && (
                <Alert severity="info" sx={{ mb: 1 }}>
                  <Typography variant="body2">
                    <strong>Order Note:</strong> {orderContext.note}
                  </Typography>
                </Alert>
              )}
              
              {orderContext.supportingInfo && (
                <Typography variant="caption" color="text.secondary">
                  Supporting information available ({orderContext.supportingInfo.length} items)
                </Typography>
              )}
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
};

export default OrderContextPanel;