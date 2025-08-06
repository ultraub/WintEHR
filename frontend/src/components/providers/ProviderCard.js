/**
 * Provider Card Component
 * 
 * Displays provider information with roles, specialties, and locations
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
  Person as PersonIcon,
  LocationOn as LocationIcon,
  Business as OrganizationIcon,
  LocalHospital as SpecialtyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Schedule as ScheduleIcon,
  StarBorder as StarIcon,
  Navigation as DirectionsIcon
} from '@mui/icons-material';
import { useProviderDirectory } from '../../hooks/useProviderDirectory';

const ProviderCard = ({ 
  provider, 
  onClick, 
  onSelect,
  showDistance = false,
  showActions = true,
  compact = false,
  selectable = false,
  selected = false
}) => {
  const theme = useTheme();
  const { getProviderDisplayName, getSpecialtyDisplay, formatDistance } = useProviderDirectory();
  const [expanded, setExpanded] = useState(false);

  const handleCardClick = (event) => {
    // Prevent card click when clicking buttons or interactive elements
    if (event.target.closest('button') || event.target.closest('.MuiIconButton-root')) {
      return;
    }
    
    if (onClick) {
      onClick(provider);
    }
  };

  const handleSelectProvider = () => {
    if (onSelect) {
      onSelect(provider);
    }
  };

  const handleToggleExpanded = (event) => {
    event.stopPropagation();
    setExpanded(!expanded);
  };

  const practitioner = provider.practitioner || {};
  const roles = provider.roles || [];
  const specialties = provider.specialties || [];
  const locations = provider.locations || [];
  const organizations = provider.organizations || [];
  const primaryLocation = provider.primaryLocation;
  const distance = provider.distance;

  const providerName = getProviderDisplayName(practitioner);
  const isActive = provider.active !== false;

  // Get primary specialty for display
  const primarySpecialty = specialties[0];
  const additionalSpecialtiesCount = specialties.length - 1;

  // Get contact information
  const telecom = practitioner.telecom || [];
  const phone = telecom.find(t => t.system === 'phone')?.value;
  const email = telecom.find(t => t.system === 'email')?.value;

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
          {/* Header with Avatar and Basic Info */}
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Avatar 
              sx={{ 
                width: compact ? 40 : 56, 
                height: compact ? 40 : 56,
                bgcolor: isActive ? 'primary.main' : 'grey.400',
                fontSize: compact ? '1rem' : '1.5rem'
              }}
            >
              <PersonIcon />
            </Avatar>
            
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant={compact ? "subtitle1" : "h6"} fontWeight="bold" noWrap>
                {providerName}
              </Typography>
              
              {primarySpecialty && (
                <Typography variant="body2" color="text.secondary" noWrap>
                  {getSpecialtyDisplay(primarySpecialty)}
                  {additionalSpecialtiesCount > 0 && ` +${additionalSpecialtiesCount} more`}
                </Typography>
              )}
              
              {primaryLocation && (
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                  <LocationIcon fontSize="small" color="action" />
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {primaryLocation.name}
                    {showDistance && distance && ` • ${formatDistance(distance)}`}
                  </Typography>
                </Stack>
              )}
            </Box>

            {!compact && (
              <Stack spacing={1}>
                {!isActive && (
                  <Chip 
                    label="Inactive" 
                    size="small" 
                    color="default" 
                    variant="outlined"
                  />
                )}
                
                {showDistance && distance && (
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

          {/* Specialties Chips */}
          {!compact && specialties.length > 0 && (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {specialties.slice(0, 3).map((specialty, index) => (
                <Chip
                  key={index}
                  label={getSpecialtyDisplay(specialty)}
                  size="small"
                  variant="outlined"
                  color="primary"
                  icon={<SpecialtyIcon />}
                />
              ))}
              {specialties.length > 3 && (
                <Chip
                  label={`+${specialties.length - 3} more`}
                  size="small"
                  variant="outlined"
                  color="default"
                />
              )}
            </Stack>
          )}

          {/* Quick Contact Info */}
          {!compact && (phone || email) && (
            <Stack direction="row" spacing={2}>
              {phone && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <PhoneIcon fontSize="small" color="action" />
                  <Typography variant="caption" color="text.secondary">
                    {phone}
                  </Typography>
                </Stack>
              )}
              {email && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <EmailIcon fontSize="small" color="action" />
                  <Typography variant="caption" color="text.secondary">
                    {email}
                  </Typography>
                </Stack>
              )}
            </Stack>
          )}

          {/* Expanded Details */}
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Stack spacing={2}>
              {/* All Locations */}
              {locations.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Locations ({locations.length})
                  </Typography>
                  <List dense>
                    {locations.map((location, index) => (
                      <ListItem key={index} sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <LocationIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={location.name}
                          secondary={location.address?.[0]?.text}
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* Organizations */}
              {organizations.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Organizations
                  </Typography>
                  <List dense>
                    {organizations.map((org, index) => (
                      <ListItem key={index} sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <OrganizationIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={org.name}
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* Role Details */}
              {roles.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Roles ({roles.length})
                  </Typography>
                  {roles.map((role, index) => (
                    <Box key={index} sx={{ mb: 1 }}>
                      <Typography variant="body2">
                        {role.role?.code?.[0]?.coding?.[0]?.display || 'Healthcare Provider'}
                      </Typography>
                      {role.period && (
                        <Typography variant="caption" color="text.secondary">
                          {role.period.start ? `Since ${new Date(role.period.start).getFullYear()}` : ''}
                          {role.period.end ? ` - ${new Date(role.period.end).getFullYear()}` : ''}
                        </Typography>
                      )}
                    </Box>
                  ))}
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
                onClick={handleSelectProvider}
                startIcon={<StarIcon />}
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

            {showDistance && primaryLocation && (
              <Tooltip title="Get Directions">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    const address = primaryLocation.address?.[0];
                    if (address) {
                      const addressText = `${address.line?.join(' ') || ''} ${address.city || ''} ${address.state || ''} ${address.postalCode || ''}`.trim();
                      window.open(`https://maps.google.com/maps?q=${encodeURIComponent(addressText)}`, '_blank');
                    }
                  }}
                >
                  <DirectionsIcon />
                </IconButton>
              </Tooltip>
            )}

            <Box sx={{ flex: 1 }} />

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

export default ProviderCard;