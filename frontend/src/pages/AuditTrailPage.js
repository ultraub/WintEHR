import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  MenuItem
} from '@mui/material';
import { Security as AuditIcon, GetApp as ExportIcon, FilterList as FilterIcon } from '@mui/icons-material';

const AuditTrailPage = () => {
  const mockAuditEvents = [
    {
      timestamp: '2024-01-05 14:23:45',
      user: 'Dr. Smith',
      action: 'Patient Record Access',
      resource: 'Patient/12345',
      ipAddress: '192.168.1.100',
      outcome: 'Success'
    },
    {
      timestamp: '2024-01-05 14:20:12',
      user: 'Nurse Johnson',
      action: 'Medication Update',
      resource: 'MedicationRequest/67890',
      ipAddress: '192.168.1.105',
      outcome: 'Success'
    },
    {
      timestamp: '2024-01-05 14:15:33',
      user: 'Admin User',
      action: 'Failed Login Attempt',
      resource: 'Authentication',
      ipAddress: '10.0.0.50',
      outcome: 'Failed'
    },
    {
      timestamp: '2024-01-05 14:10:22',
      user: 'Dr. Wilson',
      action: 'Lab Result View',
      resource: 'Observation/54321',
      ipAddress: '192.168.1.102',
      outcome: 'Success'
    },
  ];

  const getOutcomeColor = (outcome) => {
    switch (outcome) {
      case 'Success': return 'success';
      case 'Failed': return 'error';
      case 'Warning': return 'warning';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <AuditIcon color="primary" />
        <Typography variant="h4" component="h1">
          Audit Trail
        </Typography>
        <Button variant="contained" startIcon={<ExportIcon />}>
          Export Logs
        </Button>
        <Button variant="outlined" startIcon={<FilterIcon />}>
          Advanced Filters
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

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              select
              label="Action Type"
              defaultValue="all"
              size="small"
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="all">All Actions</MenuItem>
              <MenuItem value="access">Data Access</MenuItem>
              <MenuItem value="modification">Data Modification</MenuItem>
              <MenuItem value="authentication">Authentication</MenuItem>
              <MenuItem value="export">Data Export</MenuItem>
            </TextField>
            
            <TextField
              select
              label="User Role"
              defaultValue="all"
              size="small"
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="all">All Roles</MenuItem>
              <MenuItem value="physician">Physician</MenuItem>
              <MenuItem value="nurse">Nurse</MenuItem>
              <MenuItem value="admin">Administrator</MenuItem>
              <MenuItem value="staff">Support Staff</MenuItem>
            </TextField>
            
            <TextField
              type="date"
              label="From Date"
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            
            <TextField
              type="date"
              label="To Date"
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Audit Events
          </Typography>
          
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Resource</TableCell>
                  <TableCell>IP Address</TableCell>
                  <TableCell>Outcome</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mockAuditEvents.map((event, index) => (
                  <TableRow key={index}>
                    <TableCell>{event.timestamp}</TableCell>
                    <TableCell>{event.user}</TableCell>
                    <TableCell>{event.action}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      {event.resource}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>
                      {event.ipAddress}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={event.outcome} 
                        color={getOutcomeColor(event.outcome)}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Compliance & Security Features
          </Typography>
          <Typography variant="body2" component="div">
            • HIPAA compliance monitoring<br/>
            • Real-time security alerts<br/>
            • User activity tracking<br/>
            • Data access logging<br/>
            • Failed login monitoring<br/>
            • Automated compliance reporting<br/>
            • Role-based access control<br/>
            • Data breach detection
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AuditTrailPage;