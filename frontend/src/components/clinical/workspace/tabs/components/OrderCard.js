/**
 * OrderCard Component
 * Card component for displaying individual orders
 */
import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  Chip,
  IconButton,
  Button,
  Stack,
  Menu,
  MenuItem,
  Checkbox,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  CheckCircle as CompleteIcon,
  Cancel as CancelIcon,
  Medication as MedicationIcon,
  Science as LabIcon,
  Image as ImagingIcon,
  Assignment as ServiceIcon,
  Schedule as ScheduleIcon,
  Person as ProviderIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';

const OrderCard = ({
  order,
  selected = false,
  onSelect,
  onEdit,
  onDelete,
  onSend,
  onComplete,
  onCancel,
  onAction,
  showActions = true,
  dense = false
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);

  const getOrderIcon = () => {
    switch (order.resourceType) {
      case 'MedicationRequest':
        return <MedicationIcon color="primary" />;
      case 'ServiceRequest':
        if (order.category?.[0]?.coding?.[0]?.code === 'laboratory') {
          return <LabIcon color="secondary" />;
        } else if (order.category?.[0]?.coding?.[0]?.code === 'imaging') {
          return <ImagingIcon color="info" />;
        }
        return <ServiceIcon color="action" />;
      default:
        return <ServiceIcon color="action" />;
    }
  };

  const getOrderTitle = () => {
    if (order.resourceType === 'MedicationRequest') {
      return order.medicationCodeableConcept?.text || 
             order.medicationCodeableConcept?.coding?.[0]?.display || 
             'Unknown Medication';
    } else if (order.resourceType === 'ServiceRequest') {
      return order.code?.text || 
             order.code?.coding?.[0]?.display || 
             'Unknown Service';
    }
    return 'Unknown Order';
  };

  const getStatusColor = (status) => {
    const statusColors = {
      active: 'primary',
      completed: 'success',
      cancelled: 'error',
      'entered-in-error': 'error',
      draft: 'default',
      'on-hold': 'warning'
    };
    return statusColors[status] || 'default';
  };

  const getPriorityColor = (priority) => {
    const priorityColors = {
      urgent: 'error',
      asap: 'warning',
      stat: 'error',
      routine: 'default'
    };
    return priorityColors[priority] || 'default';
  };

  const handleMenuOpen = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleAction = (action) => {
    handleMenuClose();
    if (onAction) {
      onAction(order, action);
    }
  };

  const orderDate = order.authoredOn || order.occurrenceDateTime;

  return (
    <Card
      elevation={selected ? 3 : 1}
      sx={{
        mb: 1,
        borderLeft: selected ? `4px solid ${theme.palette.primary.main}` : 'none',
        borderColor: selected ? 'primary.main' : 'divider',
        backgroundColor: selected ? alpha(theme.palette.primary.main, 0.05) : 'background.paper',
        transition: 'all 0.2s ease'
      }}
    >
      <CardContent sx={{ pb: dense ? 1 : 2 }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          {onSelect && (
            <Checkbox
              checked={selected}
              onChange={(e) => onSelect(order, e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              sx={{ mt: -1 }}
            />
          )}
          
          <Box sx={{ minWidth: 40 }}>
            {getOrderIcon()}
          </Box>
          
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              {getOrderTitle()}
            </Typography>
            
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
              <Chip
                label={order.status}
                size="small"
                color={getStatusColor(order.status)}
              />
              {order.priority && (
                <Chip
                  label={order.priority}
                  size="small"
                  color={getPriorityColor(order.priority)}
                  variant="outlined"
                />
              )}
            </Stack>

            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {orderDate && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <ScheduleIcon fontSize="small" color="action" />
                  <Typography variant="caption">
                    {(() => {
                      try {
                        return format(parseISO(orderDate), 'MMM d, yyyy');
                      } catch {
                        return 'Invalid date';
                      }
                    })()}
                  </Typography>
                </Stack>
              )}
              
              {order.requester && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <ProviderIcon fontSize="small" color="action" />
                  <Typography variant="caption">
                    {order.requester?.display || 'Unknown provider'}
                  </Typography>
                </Stack>
              )}

              {order.dispenseRequest && (
                <Typography variant="caption" color="text.secondary">
                  Quantity: {order.dispenseRequest?.quantity?.value} {order.dispenseRequest?.quantity?.unit}
                  {order.dispenseRequest?.numberOfRepeatsAllowed && 
                    ` • Refills: ${order.dispenseRequest.numberOfRepeatsAllowed}`
                  }
                </Typography>
              )}
              
              {order.note?.[0]?.text && (
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  Note: {order.note[0].text}
                </Typography>
              )}
            </Stack>
          </Box>

          {showActions && (
            <IconButton onClick={handleMenuOpen} size="small">
              <MoreIcon />
            </IconButton>
          )}
        </Stack>
      </CardContent>

      {showActions && order.status === 'active' && (
        <CardActions sx={{ pt: 0 }}>
          {onSend && (
            <Button 
              size="small" 
              startIcon={<SendIcon />}
              onClick={() => onSend(order)}
            >
              Send
            </Button>
          )}
          {onEdit && (
            <Button 
              size="small" 
              startIcon={<EditIcon />}
              onClick={() => onEdit(order)}
            >
              Edit
            </Button>
          )}
          {onComplete && (
            <Button 
              size="small" 
              startIcon={<CompleteIcon />}
              onClick={() => onComplete(order)}
              color="success"
            >
              Complete
            </Button>
          )}
        </CardActions>
      )}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {onEdit && (
          <MenuItem onClick={() => handleAction('edit')}>
            <EditIcon fontSize="small" sx={{ mr: 1 }} />
            Edit Order
          </MenuItem>
        )}
        {onSend && order.status === 'active' && (
          <MenuItem onClick={() => handleAction('send')}>
            <SendIcon fontSize="small" sx={{ mr: 1 }} />
            Send to Pharmacy
          </MenuItem>
        )}
        {onComplete && order.status === 'active' && (
          <MenuItem onClick={() => handleAction('complete')}>
            <CompleteIcon fontSize="small" sx={{ mr: 1 }} />
            Mark Complete
          </MenuItem>
        )}
        {onCancel && order.status === 'active' && (
          <MenuItem onClick={() => handleAction('cancel')}>
            <CancelIcon fontSize="small" sx={{ mr: 1 }} />
            Cancel Order
          </MenuItem>
        )}
        {onDelete && (
          <MenuItem onClick={() => handleAction('delete')}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Delete Order
          </MenuItem>
        )}
      </Menu>
    </Card>
  );
};

export default OrderCard;