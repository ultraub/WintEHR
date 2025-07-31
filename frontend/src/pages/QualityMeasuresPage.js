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
  LinearProgress,
  Chip
} from '@mui/material';
import { Assessment as QualityIcon, TrendingUp as TrendIcon, GetApp as ExportIcon } from '@mui/icons-material';

const QualityMeasuresPage = () => {
  const mockMeasures = [
    { name: 'Diabetes Care - HbA1c Testing', score: 87, target: 90, status: 'improving' },
    { name: 'Hypertension Control', score: 92, target: 85, status: 'achieved' },
    { name: 'Preventive Care - Mammography', score: 78, target: 80, status: 'needs_attention' },
    { name: 'Immunizations - Influenza', score: 95, target: 90, status: 'achieved' },
    { name: 'Medication Adherence', score: 82, target: 85, status: 'improving' },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'achieved': return 'success';
      case 'improving': return 'warning';
      case 'needs_attention': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <QualityIcon color="primary" />
        <Typography variant="h4" component="h1">
          Quality Measures
        </Typography>
        <Button variant="contained" startIcon={<ExportIcon />}>
          Export Report
        </Button>
        <Button variant="outlined" startIcon={<TrendIcon />}>
          View Trends
        </Button>
      </Stack>

      <Alert 
        severity="warning" 
        sx={{ 
          mb: 3, 
          backgroundColor: '#fff3cd', 
          border: '2px solid #ffcc02',
          '& .MuiAlert-message': { fontWeight: 'bold' }
        }}
      >
        ⚠️ MOCK DATA DISPLAYED - This is sample data for demonstration purposes, not real Synthea patient data
      </Alert>

      <Grid container spacing={3}>
        {mockMeasures.map((measure, index) => (
          <Grid item xs={12} md={6} lg={4} key={index}>
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6" noWrap>
                    {measure.name}
                  </Typography>
                  
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="h4" color="primary">
                      {measure.score}%
                    </Typography>
                    <Chip 
                      label={measure.status.replace('_', ' ')} 
                      color={getStatusColor(measure.status)}
                      size="small"
                    />
                  </Stack>
                  
                  <Box>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Typography variant="body2">Progress to Target</Typography>
                      <Typography variant="body2">{measure.target}% target</Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(measure.score / measure.target) * 100}
                      color={measure.score >= measure.target ? 'success' : 'primary'}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Quality Improvement Features
          </Typography>
          <Typography variant="body2" component="div">
            • Real-time quality measure calculation<br/>
            • HEDIS and CMS measure support<br/>
            • Population health analytics<br/>
            • Care gap identification<br/>
            • Provider performance dashboards<br/>
            • Automated reporting and submissions<br/>
            • Benchmarking against national averages<br/>
            • Quality improvement action plans
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default QualityMeasuresPage;