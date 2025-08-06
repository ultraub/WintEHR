/**
 * Location Card Component
 * 
 * Displays location information including address, distance, and facility details
 * in a clean, clickable card format.
 */

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Avatar,
  Typography,
  Stack,
  Chip,
  Button,
  IconButton,
  Box,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  alpha,
  useTheme
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Business as FacilityIcon,
  Phone as PhoneIcon,
  AccessTime as HoursIcon,
  Navigation as DirectionsIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  LocalHospital as HospitalIcon,
  MedicalServices as ClinicIcon,
  LocalPharmacy as PharmacyIcon,
  Science as LabIcon,
  CameraAlt as ImagingIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useProviderDirectory } from '../../hooks/useProviderDirectory';

const LocationCard = ({ 
  location, 
  distance,
  onClick, 
  onSelect,
  showDistance = true,
  showActions = true,
  compact = false,
  selectable = false,
  selected = false
}) => {
  const theme = useTheme();
  const { formatDistance } = useProviderDirectory();
  const [expanded, setExpanded] = useState(false);

  const handleCardClick = (event) => {
    // Prevent card click when clicking buttons or interactive elements
    if (event.target.closest('button') || event.target.closest('.MuiIconButton-root')) {
      return;
    }
    
    if (onClick) {
      onClick(location);
    }
  };

  const handleSelectLocation = () => {
    if (onSelect) {
      onSelect(location);
    }
  };

  const handleToggleExpanded = (event) => {
    event.stopPropagation();
    setExpanded(!expanded);
  };

  const handleGetDirections = (event) => {
    event.stopPropagation();
    const address = location.address;
    if (address) {
      const addressText = `${address.line?.join(' ') || ''} ${address.city || ''} ${address.state || ''} ${address.postalCode || ''}`.trim();
      window.open(`https://maps.google.com/maps?q=${encodeURIComponent(addressText)}`, '_blank');
    } else if (location.position) {
      window.open(`https://maps.google.com/maps?q=${location.position.latitude},${location.position.longitude}`, '_blank');
    }
  };

  const locationName = location.name || location.description || 'Unknown Location';
  const isActive = location.status === 'active' || location.status === undefined;
  const address = location.address;
  const telecom = location.telecom || [];
  const phone = telecom.find(t => t.system === 'phone')?.value;
  const position = location.position;

  // Get location type for icon
  const getLocationIcon = () => {
    const types = location.type || [];
    const physicalType = location.physicalType?.coding?.[0]?.code?.toLowerCase();
    
    for (const type of types) {
      for (const coding of type.coding || []) {
        const code = coding.code?.toLowerCase();
        if (code?.includes('hospital')) return <HospitalIcon />;
        if (code?.includes('clinic')) return <ClinicIcon />;
        if (code?.includes('pharmacy')) return <PharmacyIcon />;
        if (code?.includes('laboratory')) return <LabIcon />;
        if (code?.includes('imaging') || code?.includes('radiology')) return <ImagingIcon />;
      }
    }
    
    if (physicalType?.includes('building')) return <FacilityIcon />;
    
    return <LocationIcon />;
  };

  // Get location type display
  const getLocationTypeDisplay = () => {
    const types = location.type || [];
    if (types.length > 0) {
      return types[0].coding?.[0]?.display || types[0].text || 'Healthcare Facility';
    }
    return 'Healthcare Facility';
  };

  // Format address for display
  const formatAddress = (addr) => {
    if (!addr) return null;
    
    const line = addr.line?.join(', ') || '';
    const city = addr.city || '';
    const state = addr.state || '';
    const postalCode = addr.postalCode || '';
    
    const parts = [line, city, `${state} ${postalCode}`.trim()].filter(Boolean);
    return parts.join(', ');
  };

  const formattedAddress = formatAddress(address);

  return (
    <Card 
      sx={{ 
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
        border: selected ? `2px solid ${theme.palette.primary.main}` : '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        backgroundColor: selected ? alpha(theme.palette.primary.main, 0.05) : 'background.paper',
        '&:hover': onClick ? {
          transform: 'translateY(-2px)',
          boxShadow: theme.shadows[4],
          borderColor: 'primary.main'
        } : {},
        opacity: isActive ? 1 : 0.7,
        height: compact ? 'auto' : '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
      onClick={handleCardClick}
    >
      <CardContent sx={{ flex: 1 }}>
        <Stack spacing={2}>
          {/* Header with Icon and Basic Info */}
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Avatar 
              sx={{ 
                width: compact ? 40 : 56, 
                height: compact ? 40 : 56,
                bgcolor: isActive ? 'primary.main' : 'grey.400',
                fontSize: compact ? '1rem' : '1.5rem'
              }}
            >
              {getLocationIcon()}
            </Avatar>
            
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant={compact ? "subtitle1" : "h6"} fontWeight="bold" noWrap>
                {locationName}
              </Typography>
              
              <Typography variant="body2" color="text.secondary" noWrap>
                {getLocationTypeDisplay()}
              </Typography>
              
              {formattedAddress && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {formattedAddress}
                </Typography>
              )}
            </Box>

            {!compact && (
              <Stack spacing={1} alignItems="flex-end">
                {!isActive && (
                  <Chip 
                    label="Inactive" 
                    size="small" 
                    color="default" 
                    variant="outlined"
                  />
                )}
                
                {showDistance && distance !== undefined && (
                  <Chip 
                    label={formatDistance(distance)}
                    size="small"
                    color="info"
                    variant="outlined"
                  />
                )}
              </Stack>
            )}
          </Stack>

          {/* Contact and Position Info */}
          {!compact && (phone || position) && (
            <Stack direction="row" spacing={2} flexWrap="wrap">
              {phone && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <PhoneIcon fontSize="small" color="action" />
                  <Typography variant="caption" color="text.secondary">
                    {phone}
                  </Typography>
                </Stack>
              )}
              {position && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <LocationIcon fontSize="small" color="action" />
                  <Typography variant="caption" color="text.secondary">
                    {position.latitude.toFixed(4)}, {position.longitude.toFixed(4)}
                  </Typography>
                </Stack>
              )}
            </Stack>
          )}

          {/* Operating Hours (if available) */}
          {!compact && location.hoursOfOperation && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <HoursIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                Operating hours available
              </Typography>
            </Stack>
          )}

          {/* Expanded Details */}
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Stack spacing={2}>
              {/* Full Address */}
              {address && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Address
                  </Typography>
                  <Typography variant="body2">
                    {address.line?.map((line, index) => (
                      <div key={index}>{line}</div>
                    ))}
                    {address.city && <div>{address.city}, {address.state} {address.postalCode}</div>}
                    {address.country && <div>{address.country}</div>}
                  </Typography>
                </Box>
              )}

              {/* All Contact Information */}
              {telecom.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Contact Information
                  </Typography>
                  <List dense>
                    {telecom.map((contact, index) => (
                      <ListItem key={index} sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          {contact.system === 'phone' && <PhoneIcon fontSize="small" />}
                          {contact.system === 'email' && <PhoneIcon fontSize="small" />}
                          {contact.system !== 'phone' && contact.system !== 'email' && <InfoIcon fontSize="small" />}
                        </ListItemIcon>
                        <ListItemText
                          primary={contact.value}
                          secondary={contact.use || contact.system}
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* Operating Hours */}
              {location.hoursOfOperation && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Operating Hours
                  </Typography>
                  {location.hoursOfOperation.map((hours, index) => (
                    <Box key={index} sx={{ mb: 1 }}>
                      <Typography variant="body2">
                        {hours.daysOfWeek?.join(', ') || 'All days'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {hours.openingTime} - {hours.closingTime}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}

              {/* Managing Organization */}
              {location.managingOrganization && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Managing Organization
                  </Typography>
                  <Typography variant="body2">
                    {location.managingOrganization.display || location.managingOrganization.reference}
                  </Typography>
                </Box>
              )}

              {/* Location Description */}
              {location.description && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Description
                  </Typography>
                  <Typography variant="body2">
                    {location.description}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Collapse>
        </Stack>
      </CardContent>

      {/* Card Actions */}
      {showActions && (
        <CardActions sx={{ pt: 0 }}>
          <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
            {selectable && (
              <Button
                size="small"
                variant={selected ? "contained" : "outlined"}
                onClick={handleSelectLocation}
                startIcon={<LocationIcon />}
              >
                {selected ? 'Selected' : 'Select'}
              </Button>
            )}
            
            {!compact && (
              <Button
                size="small"
                onClick={handleToggleExpanded}
                endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              >
                {expanded ? 'Less' : 'Details'}
              </Button>
            )}

            {(address || position) && (
              <Tooltip title="Get Directions">
                <IconButton
                  size="small"
                  onClick={handleGetDirections}
                >
                  <DirectionsIcon />
                </IconButton>
              </Tooltip>
            )}

            <Box sx={{ flex: 1 }} />

            {showDistance && distance !== undefined && compact && (
              <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                {formatDistance(distance)}
              </Typography>
            )}

            {!isActive && (
              <Typography variant="caption" color="error" sx={{ alignSelf: 'center' }}>
                Inactive
              </Typography>
            )}
          </Stack>
        </CardActions>
      )}
    </Card>
  );
};

export default LocationCard;