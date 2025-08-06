/**
 * Care Team Summary Component
 * Displays provider-centric care team information with roles, specialties, and contact details
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemAvatar,
  Avatar,
  Typography,
  Box,
  Chip,
  IconButton,
  Divider,
  Stack,
  Tooltip,
  Button,
  Skeleton,
  Alert
} from '@mui/material';
import {
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  Business as OrganizationIcon,
  LocalHospital as HospitalIcon,
  MedicalServices as SpecialtyIcon,
  ArrowForward as ArrowIcon,
  Group as TeamIcon,
  Star as PrimaryIcon
} from '@mui/icons-material';
import useProviderDirectory from '../../../../hooks/useProviderDirectory';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';

const CareTeamSummary = ({ patientId, onViewFullTeam }) => {
  const [careTeamProviders, setCareTeamProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const { getProviderProfile, searchProviders } = useProviderDirectory();
  const { getPatientResources } = useFHIRResource();

  useEffect(() => {
    if (patientId) {
      loadCareTeam();
    }
  }, [patientId]);

  const loadCareTeam = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get care team resources
      const careTeams = getPatientResources(patientId, 'CareTeam') || [];
      
      // Get encounters to extract providers
      const encounters = getPatientResources(patientId, 'Encounter') || [];
      
      // Get medication requests to find prescribing providers
      const medications = getPatientResources(patientId, 'MedicationRequest') || [];
      
      // Extract unique provider references
      const providerRefs = new Set();
      
      // From care teams
      careTeams.forEach(team => {
        team.participant?.forEach(participant => {
          if (participant.member?.reference?.startsWith('Practitioner/')) {
            providerRefs.add(participant.member.reference);
          }
        });
      });
      
      // From encounters
      encounters.forEach(encounter => {
        encounter.participant?.forEach(participant => {
          if (participant.individual?.reference?.startsWith('Practitioner/')) {
            providerRefs.add(participant.individual.reference);
          }
          if (participant.actor?.reference?.startsWith('Practitioner/')) {
            providerRefs.add(participant.actor.reference);
          }
        });
      });
      
      // From medication requests
      medications.forEach(med => {
        if (med.requester?.reference?.startsWith('Practitioner/')) {
          providerRefs.add(med.requester.reference);
        }
      });
      
      // Resolve provider details
      const providers = await Promise.all(
        Array.from(providerRefs).slice(0, 6).map(async (ref) => {
          try {
            const providerId = ref.split('/')[1];
            const profile = await getProviderProfile(providerId);
            
            return {
              id: providerId,
              reference: ref,
              profile,
              // Determine primary role from encounters
              isPrimary: encounters.some(enc => 
                enc.participant?.some(p => 
                  (p.individual?.reference === ref || p.actor?.reference === ref) &&
                  p.type?.some(t => 
                    t.coding?.some(c => c.code === 'ATND' || c.code === 'PPRF')
                  )
                )
              ),
              // Get recent encounter date
              lastSeen: encounters
                .filter(enc => 
                  enc.participant?.some(p => 
                    p.individual?.reference === ref || p.actor?.reference === ref
                  )
                )
                .map(enc => enc.period?.start)
                .filter(Boolean)
                .sort((a, b) => new Date(b) - new Date(a))[0]
            };
          } catch (error) {
            // Error resolving provider - skipping this provider
            return null;
          }
        })
      );
      
      // Filter out null providers and sort by primary status and recent activity
      const validProviders = providers
        .filter(Boolean)
        .sort((a, b) => {
          // Primary providers first
          if (a.isPrimary && !b.isPrimary) return -1;
          if (!a.isPrimary && b.isPrimary) return 1;
          
          // Then by most recent activity
          const aDate = new Date(a.lastSeen || 0);
          const bDate = new Date(b.lastSeen || 0);
          return bDate - aDate;
        });
      
      setCareTeamProviders(validProviders);
      
    } catch (error) {
      // Error loading care team - displaying user-friendly error
      setError('Failed to load care team information');
    } finally {
      setLoading(false);
    }
  };

  const formatProviderRole = (provider) => {
    if (!provider.profile?.roles?.length) return 'Provider';
    
    const primaryRole = provider.profile.roles[0];
    const specialty = primaryRole.specialty?.[0];
    
    if (specialty?.coding?.[0]?.display) {
      return specialty.coding[0].display;
    }
    
    if (specialty?.text) {
      return specialty.text;
    }
    
    return 'Provider';
  };

  const formatProviderName = (provider) => {
    if (!provider.profile) return 'Unknown Provider';
    
    return provider.profile.displayName || 
           provider.profile.name?.[0]?.text || 
           'Unknown Provider';
  };

  const formatProviderLocation = (provider) => {
    if (!provider.profile?.roles?.length) return null;
    
    const role = provider.profile.roles[0];
    if (role.location?.length > 0) {
      return role.location[0].display || 'Location available';
    }
    
    if (role.organization?.display) {
      return role.organization.display;
    }
    
    return null;
  };

  const getProviderContactInfo = (provider) => {
    if (!provider.profile) return { phone: null, email: null };
    
    const telecom = provider.profile.telecom || [];
    
    return {
      phone: telecom.find(t => t.system === 'phone')?.value,
      email: telecom.find(t => t.system === 'email')?.value
    };
  };

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'No recent visits';
    
    const date = new Date(lastSeen);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`;
    return `${Math.ceil(diffDays / 365)} years ago`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader 
          title="Care Team"
          avatar={<TeamIcon />}
        />
        <CardContent>
          <Stack spacing={2}>
            {[1, 2, 3].map(i => (
              <Box key={`skeleton-${i}`} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Skeleton variant="circular" width={40} height={40} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="text" width="40%" />
                </Box>
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader 
          title="Care Team"
          avatar={<TeamIcon />}
        />
        <CardContent>
          <Alert severity="error">
            {error}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Care Team"
        subheader={`${careTeamProviders.length} active providers`}
        avatar={<TeamIcon />}
        action={
          onViewFullTeam && (
            <IconButton onClick={onViewFullTeam} aria-label="View full care team">
              <ArrowIcon />
            </IconButton>
          )
        }
      />
      <CardContent>
        {careTeamProviders.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No care team providers found
          </Typography>
        ) : (
          <List disablePadding>
            {careTeamProviders.map((provider, index) => {
              const contactInfo = getProviderContactInfo(provider);
              const location = formatProviderLocation(provider);
              
              return (
                <React.Fragment key={provider.id}>
                  <ListItem 
                    alignItems="flex-start"
                    sx={{ 
                      px: 0,
                      '&:hover': { backgroundColor: 'action.hover' },
                      borderRadius: 1,
                      cursor: 'pointer'
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: provider.isPrimary ? 'primary.main' : 'secondary.main' }}>
                        <PersonIcon />
                      </Avatar>
                    </ListItemAvatar>
                    
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="subtitle2" component="span">
                            {formatProviderName(provider)}
                          </Typography>
                          {provider.isPrimary && (
                            <Tooltip title="Primary Care Provider">
                              <PrimaryIcon fontSize="small" color="primary" />
                            </Tooltip>
                          )}
                        </Box>
                      }
                      secondary={
                        <Stack spacing={0.5}>
                          {/* Role and Specialty */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <SpecialtyIcon fontSize="small" color="action" />
                            <Typography variant="body2" color="text.secondary">
                              {formatProviderRole(provider)}
                            </Typography>
                          </Box>
                          
                          {/* Location */}
                          {location && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <LocationIcon fontSize="small" color="action" />
                              <Typography variant="body2" color="text.secondary">
                                {location}
                              </Typography>
                            </Box>
                          )}
                          
                          {/* Contact Info */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            {contactInfo.phone && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <PhoneIcon fontSize="small" color="action" />
                                <Typography variant="caption" color="text.secondary">
                                  {contactInfo.phone}
                                </Typography>
                              </Box>
                            )}
                            {contactInfo.email && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <EmailIcon fontSize="small" color="action" />
                                <Typography variant="caption" color="text.secondary">
                                  {contactInfo.email}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                          
                          {/* Last Seen */}
                          <Typography variant="caption" color="text.secondary">
                            Last seen: {formatLastSeen(provider.lastSeen)}
                          </Typography>
                        </Stack>
                      }
                    />
                  </ListItem>
                  {index < careTeamProviders.length - 1 && <Divider sx={{ my: 1 }} />}
                </React.Fragment>
              );
            })}
          </List>
        )}
        
        {/* View All Button */}
        {careTeamProviders.length > 0 && onViewFullTeam && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<TeamIcon />}
              onClick={onViewFullTeam}
            >
              View Full Care Team
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default CareTeamSummary;