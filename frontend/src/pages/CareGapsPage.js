import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  Button,
  Stack,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import SafeBadge from '../components/common/SafeBadge';
import { Timeline as CareGapIcon, Assignment as ActionIcon, Notifications as AlertIcon } from '@mui/icons-material';

const CareGapsPage = () => {
  const mockCareGaps = [
    {
      patient: 'Sarah Johnson',
      gap: 'Annual Mammography',
      priority: 'high',
      dueDate: '2024-03-15',
      lastCompleted: '2022-02-10'
    },
    {
      patient: 'Robert Chen',
      gap: 'Diabetic Eye Exam',
      priority: 'medium',
      dueDate: '2024-04-20',
      lastCompleted: '2023-01-15'
    },
    {
      patient: 'Maria Garcia',
      gap: 'Colorectal Cancer Screening',
      priority: 'high',
      dueDate: '2024-02-28',
      lastCompleted: 'Never'
    },
    {
      patient: 'James Wilson',
      gap: 'Blood Pressure Check',
      priority: 'low',
      dueDate: '2024-05-10',
      lastCompleted: '2023-11-05'
    },
  ];

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  const criticalGaps = mockCareGaps.filter(gap => gap.priority === 'high').length;

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <SafeBadge badgeContent={criticalGaps} color="error">
          <CareGapIcon color="primary" />
        </SafeBadge>
        <Typography variant="h4" component="h1">
          Care Gaps Analysis
        </Typography>
        <Button variant="contained" startIcon={<ActionIcon />}>
          Create Action Plan
        </Button>
        <Button variant="outlined" startIcon={<AlertIcon />}>
          Send Reminders
        </Button>
      </Stack>

      <Alert 
        severity="warning" 
        sx={{ 
          mb: 3, 
          '& .MuiAlert-message': { fontWeight: 'bold' }
        }}
      >
        ⚠️ MOCK DATA DISPLAYED - This is sample data for demonstration purposes, not real Synthea patient data
      </Alert>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Active Care Gaps
              </Typography>
              
              <List>
                {mockCareGaps.map((gap, index) => (
                  <ListItem key={index} divider>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle1">{gap.patient}</Typography>
                          <Chip 
                            label={gap.priority} 
                            color={getPriorityColor(gap.priority)}
                            size="small"
                          />
                        </Stack>
                      }
                      secondary={
                        <Stack spacing={0.5}>
                          <Typography variant="body2" color="primary">
                            {gap.gap}
                          </Typography>
                          <Typography variant="caption">
                            Due: {gap.dueDate} | Last: {gap.lastCompleted}
                          </Typography>
                        </Stack>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Button size="small" variant="outlined">
                        Schedule
                      </Button>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Gap Summary
                </Typography>
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography>High Priority</Typography>
                    <Chip label={criticalGaps} color="error" size="small" />
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography>Medium Priority</Typography>
                    <Chip label="1" color="warning" size="small" />
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography>Low Priority</Typography>
                    <Chip label="1" color="info" size="small" />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Care Gap Types
                </Typography>
                <Typography variant="body2" component="div">
                  • Preventive screenings<br/>
                  • Chronic disease monitoring<br/>
                  • Immunization compliance<br/>
                  • Follow-up appointments<br/>
                  • Medication adherence<br/>
                  • Health maintenance visits
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CareGapsPage;