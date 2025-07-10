import React, { useState, useEffect, useMemo } from 'react';
import { Box, Card, CardContent, Typography, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Alert, CircularProgress, IconButton, Tooltip, Tab, Tabs, Divider } from '@mui/material';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, parseISO, differenceInYears } from 'date-fns';
import { TrendingUp, TrendingDown, Warning, CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import Timeline from '@mui/lab/Timeline';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineDot from '@mui/lab/TimelineDot';


// Helper functions
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return format(parseISO(dateString), 'MMM d, yyyy');
  } catch {
    return dateString;
  }
};

const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return format(parseISO(dateString), 'MMM d, yyyy HH:mm');
  } catch {
    return dateString;
  }
};

const getValueWithUnit = (valueQuantity) => {
  if (!valueQuantity) return 'N/A';
  const value = valueQuantity.value || '';
  const unit = valueQuantity.unit || valueQuantity.code || '';
  return `${value} ${unit}`.trim();
};

const getCodingDisplay = (coding) => {
  if (!coding || !Array.isArray(coding)) return 'Unknown';
  const primaryCoding = coding.find(c => c.display) || coding[0];
  return primaryCoding?.display || primaryCoding?.code || 'Unknown';
};

const getResourceReference = (reference) => {
  if (!reference || !reference.reference) return null;
  const parts = reference.reference.split('/');
  return parts.length === 2 ? { type: parts[0], id: parts[1] } : null;
};

const getStatusColor = (status) => {
  const statusColors = {
    active: 'success',
    completed: 'default',
    error: 'error',
    stopped: 'warning',
    'entered-in-error': 'error',
    draft: 'info',
    unknown: 'default'
  };
  return statusColors[status?.toLowerCase()] || 'default';
};

const getRiskLevel = (value, thresholds) => {
  if (!value || !thresholds) return { level: 'normal', color: 'inherit' };
  
  if (value >= thresholds.critical) {
    return { level: 'critical', color: 'error' };
  } else if (value >= thresholds.high) {
    return { level: 'high', color: 'warning' };
  } else if (value <= thresholds.low) {
    return { level: 'low', color: 'info' };
  }
  return { level: 'normal', color: 'success' };
};


const DynamicChronicConditionsView = ({ patientId }) => {
  const [stage1Data, setStage1Data] = useState(null);
  const [stage2Data, setStage2Data] = useState(null);
  const [stage3Data, setStage3Data] = useState(null);
  const [stage4Data, setStage4Data] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState(0);

  useEffect(() => {
    // In production, fetch from FHIR API
    const loadData = async () => {
      try {
        setStage4Data([{"id": "6953ca9a-3500-559d-8a0e-143c4e609ac2", "meta": {"profile": ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-careplan"], "versionId": "1", "lastUpdated": "2025-07-09T00:22:51.235878+00:00"}, "text": {"div": "<div xmlns=\"http://www.w3.org/1999/xhtml\">Care Plan for Wound care (regime/therapy).<br/>Care plan is meant to treat Laceration of hand (disorder).<br/>Activities: <ul><li>Wound care (regime/therapy)</li><li>Wound care (regime/therapy)</li></ul></div>", "status": "generated"}, "intent": "order", "period": {"end": "2021-10-17T08:59:33-04:00", "start": "2021-09-22T08:34:57-04:00"}, "status": "completed", "subject": {"reference": "Patient/e5b40b82-031b-610f-787e-2a4242efcfea"}, "activity": [{"plannedActivityReference": {"display": "Dressing change management (procedure)", "reference": "ServiceRequest/385949008"}}, {"plannedActivityReference": {"display": "Behavior to prevent infection (observable entity)", "reference": "ServiceRequest/439830001"}}], "careTeam": [{"reference": "urn:uuid:b43c504a-0a8e-069d-875a-a1425d4b0d03"}], "category": [{"coding": [{"code": "assess-plan", "system": "http://hl7.org/fhir/us/core/CodeSystem/careplan-category"}]}, {"text": "Wound care (regime/therapy)", "coding": [{"code": "225358003", "system": "http://snomed.info/sct", "display": "Wound care (regime/therapy)"}]}], "addresses": [{"reference": {"reference": "urn:uuid:e94518f1-fe85-9603-8a59-3055aeb64b95"}}], "encounter": {"reference": "Encounter/9b0b0e5a-f4c9-1878-72f5-58f95afc7664"}, "resourceType": "CarePlan"}, {"id": "e127ba5d-9233-b615-7ecb-bee078831410", "meta": {"profile": ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-careplan"], "versionId": "1", "lastUpdated": "2025-07-09T00:22:50.067672+00:00"}, "text": {"div": "<div xmlns=\"http://www.w3.org/1999/xhtml\">Care Plan for Physiotherapy care plan (record artifact).<br/>Care plan is meant to treat Sprain of ankle (disorder).<br/>Activities: <ul><li>Physiotherapy care plan (record artifact)</li><li>Physiotherapy care plan (record artifact)</li></ul></div>", "status": "generated"}, "intent": "order", "period": {"end": "2025-04-07T15:40:53-04:00", "start": "2025-03-10T15:40:53-04:00"}, "status": "completed", "subject": {"reference": "Patient/2add8cb0-9ec4-15de-4e5b-e812509a5068"}, "activity": [{"plannedActivityReference": {"display": "Rest, ice, compression and elevation treatment program (regime/therapy)", "reference": "ServiceRequest/229586001"}}, {"plannedActivityReference": {"display": "Stretching exercises (regime/therapy)", "reference": "ServiceRequest/229070002"}}], "careTeam": [{"reference": "urn:uuid:57247f2f-5bae-d75e-e172-43011c3c405b"}], "category": [{"coding": [{"code": "assess-plan", "system": "http://hl7.org/fhir/us/core/CodeSystem/careplan-category"}]}, {"text": "Physiotherapy care plan (record artifact)", "coding": [{"code": "773513001", "system": "http://snomed.info/sct", "display": "Physiotherapy care plan (record artifact)"}]}], "addresses": [{"reference": {"reference": "urn:uuid:c6e8fbb9-bf88-8721-8785-b91abe4fcf70"}}], "encounter": {"reference": "Encounter/1986048c-b360-8272-1ba7-87c09d46f8f3"}, "resourceType": "CarePlan"}, {"id": "d173c6ab-ca8d-415c-b4fb-86071543234e", "meta": {"profile": ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-careplan"], "versionId": "1", "lastUpdated": "2025-07-09T00:22:49.395515+00:00"}, "text": {"div": "<div xmlns=\"http://www.w3.org/1999/xhtml\">Care Plan for Infectious disease care plan (record artifact).<br/>Activities: <ul><li>Infectious disease care plan (record artifact)</li><li>Infectious disease care plan (record artifact)</li></ul></div>", "status": "generated"}, "intent": "order", "period": {"end": "2021-03-20T14:53:40-04:00", "start": "2021-02-17T14:53:40-05:00"}, "status": "completed", "subject": {"reference": "Patient/2add8cb0-9ec4-15de-4e5b-e812509a5068"}, "activity": [{"plannedActivityReference": {"display": "Airborne precautions (procedure)", "reference": "ServiceRequest/409524006"}}, {"plannedActivityReference": {"display": "Isolation of infected patient (procedure)", "reference": "ServiceRequest/361235007"}}], "careTeam": [{"reference": "urn:uuid:abaa61a9-7842-e6b9-5658-1f7330bd0fe3"}], "category": [{"coding": [{"code": "assess-plan", "system": "http://hl7.org/fhir/us/core/CodeSystem/careplan-category"}]}, {"text": "Infectious disease care plan (record artifact)", "coding": [{"code": "736376001", "system": "http://snomed.info/sct", "display": "Infectious disease care plan (record artifact)"}]}], "encounter": {"reference": "Encounter/488acc43-3262-fa03-af85-b402651f2de1"}, "resourceType": "CarePlan"}, {"id": "b58fd54a-db45-0aaa-b61e-ea60aa52cc84", "meta": {"profile": ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-careplan"], "versionId": "1", "lastUpdated": "2025-07-09T00:22:49.391328+00:00"}, "text": {"div": "<div xmlns=\"http://www.w3.org/1999/xhtml\">Care Plan for Infectious disease care plan (record artifact).<br/>Activities: <ul><li>Infectious disease care plan (record artifact)</li><li>Infectious disease care plan (record artifact)</li></ul></div>", "status": "generated"}, "intent": "order", "period": {"end": "2021-02-17T14:53:40-05:00", "start": "2021-02-17T13:30:44-05:00"}, "status": "completed", "subject": {"reference": "Patient/2add8cb0-9ec4-15de-4e5b-e812509a5068"}, "activity": [{"plannedActivityReference": {"display": "Airborne precautions (procedure)", "reference": "ServiceRequest/409524006"}}, {"plannedActivityReference": {"display": "Personal protective equipment (physical object)", "reference": "ServiceRequest/409526008"}}], "careTeam": [{"reference": "urn:uuid:eead0f99-d622-d1e5-78f7-70c795954004"}], "category": [{"coding": [{"code": "assess-plan", "system": "http://hl7.org/fhir/us/core/CodeSystem/careplan-category"}]}, {"text": "Infectious disease care plan (record artifact)", "coding": [{"code": "736376001", "system": "http://snomed.info/sct", "display": "Infectious disease care plan (record artifact)"}]}], "encounter": {"reference": "Encounter/488acc43-3262-fa03-af85-b402651f2de1"}, "resourceType": "CarePlan"}, {"id": "6663f70a-bc9a-85f3-e7af-c50bc8fc6a8f", "meta": {"profile": ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-careplan"], "versionId": "1", "lastUpdated": "2025-07-09T00:22:49.013806+00:00"}, "text": {"div": "<div xmlns=\"http://www.w3.org/1999/xhtml\">Care Plan for Respiratory therapy (procedure).<br/>Activities: <ul><li>Respiratory therapy (procedure)</li><li>Respiratory therapy (procedure)</li></ul></div>", "status": "generated"}, "intent": "order", "period": {"end": "2021-03-24T14:16:37-04:00", "start": "2020-03-11T14:16:37-04:00"}, "status": "completed", "subject": {"reference": "Patient/2add8cb0-9ec4-15de-4e5b-e812509a5068"}, "activity": [{"plannedActivityReference": {"display": "Recommendation to avoid exercise (procedure)", "reference": "ServiceRequest/304510005"}}, {"plannedActivityReference": {"display": "Deep breathing and coughing exercises (regime/therapy)", "reference": "ServiceRequest/371605008"}}], "careTeam": [{"reference": "urn:uuid:c22351b9-acac-0789-6e95-bfd836199a71"}], "category": [{"coding": [{"code": "assess-plan", "system": "http://hl7.org/fhir/us/core/CodeSystem/careplan-category"}]}, {"text": "Respiratory therapy (procedure)", "coding": [{"code": "53950000", "system": "http://snomed.info/sct", "display": "Respiratory therapy (procedure)"}]}], "encounter": {"reference": "Encounter/4ece3dd8-c954-f0d6-e1bf-d2ab0a7fcd2f"}, "resourceType": "CarePlan"}]);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };
    loadData();
  }, [patientId]);

  // Process aggregated data
  const aggregatedMetrics = useMemo(() => {
    const metrics = {};
    metrics['stage1'] = {"count_by_code.coding.display": {}};
    metrics['stage3'] = {"latest_per_patient": true};
    return metrics;
  }, []);

  // Process temporal data for charts
  const timeSeriesData = useMemo(() => {
    const series = {};
    // Process CarePlan time series
    series['CarePlan'] = [];
    return series;
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Records
              </Typography>
              <Typography variant="h4">
                458
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Resource Types
              </Typography>
              <Typography variant="h4">
                1
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Clinical Timeline
          </Typography>
          <Timeline position="alternate">
            {{/* Timeline items would be generated from temporal data */}}
          </Timeline>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DynamicChronicConditionsView;