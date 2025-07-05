import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  Button,
  Stack,
  Grid,
  TextField,
  InputAdornment,
  Avatar,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  IconButton
} from '@mui/material';
import {
  Assignment as WorkspaceIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  Launch as LaunchIcon,
  AccessTime as RecentIcon
} from '@mui/icons-material';
import { useFHIRResource } from '../contexts/FHIRResourceContext';

const ClinicalWorkspacePage = () => {
  const navigate = useNavigate();
  const { searchResources } = useFHIRResource();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [recentPatients] = useState([
    { id: 'patient-1', name: 'Sarah Johnson', lastAccessed: '2024-01-05', status: 'Active' },
    { id: 'patient-2', name: 'Robert Chen', lastAccessed: '2024-01-04', status: 'Active' },
    { id: 'patient-3', name: 'Maria Garcia', lastAccessed: '2024-01-03', status: 'Completed' },
  ]);

  useEffect(() => {
    const loadPatients = async () => {
      try {
        const result = await searchResources('Patient', { _count: 20 });
        setPatients(result.resources || []);
      } catch (error) {
        console.error('Failed to load patients:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPatients();
  }, [searchResources]);

  const handlePatientSelect = (patientId) => {
    navigate(`/patients/${patientId}/clinical`);
  };

  const filteredPatients = patients.filter(patient => {
    if (!searchTerm) return true;
    const name = `${patient.name?.[0]?.given?.join(' ') || ''} ${patient.name?.[0]?.family || ''}`.toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <WorkspaceIcon color="primary" />
          <Typography variant="h4" component="h1">
            Clinical Workspace
          </Typography>
        </Stack>
        <Button 
          variant="contained" 
          onClick={() => navigate('/patients')}
          startIcon={<PersonIcon />}
        >
          Browse All Patients
        </Button>
      </Stack>

      <Alert 
        severity="success" 
        sx={{ 
          mb: 3,
          '& .MuiAlert-message': { fontWeight: 'bold' }
        }}
      >
        🩺 Welcome to the Clinical Workspace! This provides comprehensive patient chart review, 
        documentation, order management, and care planning tools. Select a patient below to begin.
      </Alert>

      {/* Search */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            fullWidth
            placeholder="Search patients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Recent Patients */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <RecentIcon />
                <Typography variant="h6">
                  Recently Accessed
                </Typography>
              </Stack>
              
              <List>
                {recentPatients.map((patient) => (
                  <ListItem key={patient.id} divider>
                    <ListItemAvatar>
                      <Avatar>
                        <PersonIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={patient.name}
                      secondary={`Last accessed: ${patient.lastAccessed}`}
                    />
                    <ListItemSecondaryAction>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip 
                          label={patient.status} 
                          color={patient.status === 'Active' ? 'success' : 'default'}
                          size="small"
                        />
                        <IconButton 
                          onClick={() => handlePatientSelect(patient.id)}
                          color="primary"
                        >
                          <LaunchIcon />
                        </IconButton>
                      </Stack>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* All Patients */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                All Patients ({filteredPatients.length})
              </Typography>
              
              {loading ? (
                <Typography>Loading patients...</Typography>
              ) : (
                <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                  {filteredPatients.slice(0, 10).map((patient) => {
                    const name = `${patient.name?.[0]?.given?.join(' ') || ''} ${patient.name?.[0]?.family || ''}`.trim();
                    const gender = patient.gender || 'Unknown';
                    const birthDate = patient.birthDate || '';
                    
                    return (
                      <ListItem key={patient.id} divider>
                        <ListItemAvatar>
                          <Avatar>
                            {name.charAt(0)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={name || 'Unknown Patient'}
                          secondary={`${gender}${birthDate ? ` • Born ${birthDate}` : ''}`}
                        />
                        <ListItemSecondaryAction>
                          <IconButton 
                            onClick={() => handlePatientSelect(patient.id)}
                            color="primary"
                          >
                            <LaunchIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Workspace Features */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Clinical Workspace Features
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2">Chart Review</Typography>
              <Typography variant="body2" color="text.secondary">
                Comprehensive patient history, medications, allergies, and clinical timeline
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2">Documentation</Typography>
              <Typography variant="body2" color="text.secondary">
                Smart note templates, voice dictation, and structured data entry
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2">Order Management</Typography>
              <Typography variant="body2" color="text.secondary">
                CPOE, lab orders, imaging, referrals with clinical decision support
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2">Care Planning</Typography>
              <Typography variant="body2" color="text.secondary">
                Goal setting, care plans, and population health management
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ClinicalWorkspacePage;