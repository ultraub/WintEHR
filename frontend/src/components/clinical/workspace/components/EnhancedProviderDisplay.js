/**
 * Enhanced Provider Display Component
 * 
 * Displays detailed provider information with roles, specialties, and locations
 * for use in encounters and other clinical contexts.
 */

import React, { useState, useEffect } from 'react';
import {
  Stack,
  Typography,
  Chip,
  Avatar,
  Box,
  Tooltip,
  IconButton,
  Skeleton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Person as PersonIcon,
  LocationOn as LocationIcon,
  Business as OrganizationIcon,
  LocalHospital as SpecialtyIcon,
  Info as InfoIcon,
  Phone as PhoneIcon,
  Email as EmailIcon
} from '@mui/icons-material';
import { useProviderDirectory } from '../../../../hooks/useProviderDirectory';
import ProviderCard from '../../../providers/ProviderCard';

const EnhancedProviderDisplay = ({ encounter, compact = false, showActions = false }) => {
  const { getProviderProfile, loading, error } = useProviderDirectory();
  const [providerDetails, setProviderDetails] = useState(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    const loadProviderDetails = async () => {
      // Find the primary provider from encounter participants
      const primaryProvider = encounter.participant?.find(p => 
        p.type?.[0]?.coding?.[0]?.code === 'PPRF' || 
        p.type?.[0]?.coding?.[0]?.code === 'ATND'
      );

      if (primaryProvider?.individual?.reference) {
        setLoadingProfile(true);
        try {
          const providerId = primaryProvider.individual.reference.split('/')[1];
          const profile = await getProviderProfile(providerId);
          setProviderDetails(profile);
        } catch (err) {
          // Failed to load provider profile - will show basic info only
        } finally {
          setLoadingProfile(false);
        }
      }
    };

    loadProviderDetails();
  }, [encounter, getProviderProfile]);

  const handleViewProfile = () => {
    setProfileDialogOpen(true);
  };

  // If loading, show skeleton
  if (loadingProfile) {
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <Skeleton variant="circular" width={compact ? 24 : 32} height={compact ? 24 : 32} />
        <Skeleton variant="text" width={120} />
        {!compact && <Skeleton variant="rectangular" width={60} height={20} />}
      </Stack>
    );
  }

  // If no provider details available, show basic info
  if (!providerDetails) {
    const basicProvider = encounter.participant?.find(p => 
      p.type?.[0]?.coding?.[0]?.code === 'PPRF' || 
      p.type?.[0]?.coding?.[0]?.code === 'ATND'
    );

    const providerName = basicProvider?.actor?.display || 
                        basicProvider?.individual?.display || 
                        'No provider recorded';

    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <PersonIcon fontSize={compact ? "small" : "medium"} color="action" />
        <Typography variant={compact ? "caption" : "body2"} color="text.secondary">
          {providerName}
        </Typography>
      </Stack>
    );
  }

  const practitioner = providerDetails.practitioner || {};
  const primarySpecialty = providerDetails.specialties?.[0];
  const primaryLocation = providerDetails.primaryLocation;
  const primaryOrganization = providerDetails.organizations?.[0];

  // Get provider name
  const providerName = providerDetails.name || 'Unknown Provider';

  // Get specialty display
  const specialtyDisplay = primarySpecialty?.coding?.[0]?.display || 
                          primarySpecialty?.text || 
                          'Healthcare Provider';

  // Get location display
  const locationDisplay = primaryLocation?.name || 
                         primaryLocation?.description || 
                         'Location not specified';

  // Compact display for space-constrained areas
  if (compact) {
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.main' }}>
          <PersonIcon sx={{ fontSize: 14 }} />
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="caption" noWrap>
            {providerName}
          </Typography>
          {primarySpecialty && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {specialtyDisplay}
            </Typography>
          )}
        </Box>
        {showActions && (
          <Tooltip title="View Provider Profile">
            <IconButton size="small" onClick={handleViewProfile}>
              <InfoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    );
  }

  // Full display with detailed information
  return (
    <>
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <Avatar sx={{ bgcolor: 'primary.main' }}>
          <PersonIcon />
        </Avatar>
        
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="body2" fontWeight="medium">
              {providerName}
            </Typography>
            {showActions && (
              <Tooltip title="View Provider Profile">
                <IconButton size="small" onClick={handleViewProfile}>
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>

          {/* Specialties */}
          {providerDetails.specialties && providerDetails.specialties.length > 0 && (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mb: 1 }}>
              {providerDetails.specialties.slice(0, 2).map((specialty, index) => (
                <Chip
                  key={index}
                  label={specialty.coding?.[0]?.display || specialty.text}
                  size="small"
                  variant="outlined"
                  color="primary"
                  icon={<SpecialtyIcon />}
                />
              ))}
              {providerDetails.specialties.length > 2 && (
                <Chip
                  label={`+${providerDetails.specialties.length - 2} more`}
                  size="small"
                  variant="outlined"
                  color="default"
                />
              )}
            </Stack>
          )}

          {/* Location and Organization */}
          <Stack spacing={0.5}>
            {primaryLocation && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <LocationIcon fontSize="small" color="action" />
                <Typography variant="caption" color="text.secondary">
                  {locationDisplay}
                </Typography>
              </Stack>
            )}

            {primaryOrganization && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <OrganizationIcon fontSize="small" color="action" />
                <Typography variant="caption" color="text.secondary">
                  {primaryOrganization.name}
                </Typography>
              </Stack>
            )}
          </Stack>

          {/* Contact Info */}
          {practitioner.telecom && (
            <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
              {practitioner.telecom
                .filter(t => t.system === 'phone' || t.system === 'email')
                .slice(0, 2)
                .map((contact, index) => (
                  <Stack key={index} direction="row" spacing={0.5} alignItems="center">
                    {contact.system === 'phone' && <PhoneIcon fontSize="small" color="action" />}
                    {contact.system === 'email' && <EmailIcon fontSize="small" color="action" />}
                    <Typography variant="caption" color="text.secondary">
                      {contact.value}
                    </Typography>
                  </Stack>
                ))}
            </Stack>
          )}
        </Box>
      </Stack>

      {/* Provider Profile Dialog */}
      <Dialog 
        open={profileDialogOpen} 
        onClose={() => setProfileDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Provider Profile
        </DialogTitle>
        <DialogContent>
          {providerDetails && (
            <ProviderCard 
              provider={providerDetails}
              compact={false}
              showActions={false}
              selectable={false}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProfileDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default EnhancedProviderDisplay;