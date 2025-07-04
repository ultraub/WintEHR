import React from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Paper,
  Box,
  Typography,
  Breadcrumbs,
  Link
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import AuditTrail from '../components/AuditTrail';

const AuditTrailPage = () => {
  const { patientId, resourceType, resourceId } = useParams();

  const getBreadcrumbs = () => {
    const crumbs = [
      <Link
        key="home"
        component={RouterLink}
        to="/"
        color="inherit"
        underline="hover"
      >
        Home
      </Link>
    ];

    if (patientId) {
      crumbs.push(
        <Link
          key="patient"
          component={RouterLink}
          to={`/patient/${patientId}`}
          color="inherit"
          underline="hover"
        >
          Patient
        </Link>
      );
    }

    crumbs.push(
      <Typography key="audit" color="text.primary">
        Audit Trail
      </Typography>
    );

    return crumbs;
  };

  const getTitle = () => {
    if (patientId) {
      return 'Patient Audit Trail';
    }
    if (resourceType && resourceId) {
      return `${resourceType} Audit Trail`;
    }
    return 'System Audit Trail';
  };

  const getDescription = () => {
    if (patientId) {
      return 'View all activities related to this patient record';
    }
    if (resourceType && resourceId) {
      return `View all activities related to this ${resourceType}`;
    }
    return 'View all system activities and access logs';
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 3 }}>
      <Box mb={3}>
        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" />}
          aria-label="breadcrumb"
        >
          {getBreadcrumbs()}
        </Breadcrumbs>
      </Box>

      <Paper sx={{ p: 3 }}>
        <Box mb={3}>
          <Typography variant="h4" gutterBottom>
            {getTitle()}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {getDescription()}
          </Typography>
        </Box>

        <AuditTrail
          patientId={patientId}
          resourceType={resourceType}
          resourceId={resourceId}
        />
      </Paper>
    </Container>
  );
};

export default AuditTrailPage;