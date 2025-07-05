/**
 * PopulationHealthMode Component (Placeholder)
 * Will provide population analytics and quality measure tracking
 */
import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  Button
} from '@mui/material';
import { 
  Analytics as PopulationIcon,
  TrendingUp,
  TrendingDown,
  Group as GroupIcon 
} from '@mui/icons-material';

const MetricCard = ({ title, value, target, trend, color = 'primary' }) => (
  <Card>
    <CardContent>
      <Typography color="text.secondary" gutterBottom variant="body2">
        {title}
      </Typography>
      <Typography variant="h4" component="div" color={color}>
        {value}%
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
        {trend > 0 ? (
          <TrendingUp color="success" fontSize="small" />
        ) : (
          <TrendingDown color="error" fontSize="small" />
        )}
        <Typography variant="body2" sx={{ ml: 1 }}>
          {trend > 0 ? '+' : ''}{trend}% from last month
        </Typography>
      </Box>
      <LinearProgress 
        variant="determinate" 
        value={(value / target) * 100} 
        sx={{ mt: 2, height: 8, borderRadius: 4 }}
        color={color}
      />
      <Typography variant="caption" color="text.secondary">
        Target: {target}%
      </Typography>
    </CardContent>
  </Card>
);

const PopulationHealthMode = () => {
  return (
    <Paper elevation={0} sx={{ height: '100%', p: 3, overflow: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <PopulationIcon color="error" fontSize="large" />
        <Typography variant="h5">Population Health Analytics</Typography>
        <Chip 
          icon={<GroupIcon />} 
          label="1,247 Active Patients" 
          color="primary" 
          variant="outlined" 
        />
      </Box>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        Advanced population analytics and quality measure tracking coming soon.
      </Alert>
      
      {/* Quality Measures */}
      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Quality Measures Performance
      </Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Diabetes Control (HbA1c < 8%)"
            value={72}
            target={80}
            trend={3.2}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Blood Pressure Control"
            value={68}
            target={75}
            trend={-1.5}
            color="warning"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Preventive Care Screening"
            value={85}
            target={90}
            trend={5.1}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Medication Adherence"
            value={78}
            target={85}
            trend={2.3}
            color="info"
          />
        </Grid>
      </Grid>
      
      {/* Population Breakdown */}
      <Typography variant="h6" gutterBottom>
        Care Gaps by Condition
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Condition</TableCell>
              <TableCell align="center">Patients</TableCell>
              <TableCell align="center">With Care Gaps</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Diabetes</TableCell>
              <TableCell align="center">234</TableCell>
              <TableCell align="center">
                <Chip label="67" color="error" size="small" />
              </TableCell>
              <TableCell align="center">
                <Button size="small">View List</Button>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Hypertension</TableCell>
              <TableCell align="center">412</TableCell>
              <TableCell align="center">
                <Chip label="89" color="warning" size="small" />
              </TableCell>
              <TableCell align="center">
                <Button size="small">View List</Button>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Asthma</TableCell>
              <TableCell align="center">156</TableCell>
              <TableCell align="center">
                <Chip label="23" color="success" size="small" />
              </TableCell>
              <TableCell align="center">
                <Button size="small">View List</Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
      
      <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
        <Button variant="contained" color="primary">
          Generate Quality Report
        </Button>
        <Button variant="outlined">
          Export Patient Lists
        </Button>
        <Button variant="outlined">
          Configure Measures
        </Button>
      </Box>
    </Paper>
  );
};

export default PopulationHealthMode;