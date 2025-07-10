import React, { useState, useEffect, useMemo } from 'react';
import { Box, Card, CardContent, Typography, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Alert, CircularProgress, IconButton, Tooltip, Tab, Tabs, Divider } from '@mui/material';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, parseISO, differenceInYears } from 'date-fns';
import { TrendingUp, TrendingDown, Warning, CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';


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


const ObservationsDashboard = ({ patientId }) => {
  const [observationsData, setObservationsData] = useState(null);
  const [patientsData, setPatientsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState(0);

  useEffect(() => {
    // In production, fetch from FHIR API
    const loadData = async () => {
      try {
        setObservationsData([{"id": "3a793425-9c60-1941-a893-4eb0b06b96df", "code": {"text": "Tobacco smoking status", "coding": [{"code": "72166-2", "system": "http://loinc.org", "display": "Tobacco smoking status"}]}, "meta": {"profile": ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-smokingstatus", "http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-social-history"], "versionId": "1", "lastUpdated": "2025-07-09T00:22:52.195233+00:00"}, "issued": "2025-06-19T15:53:52.602-04:00", "status": "final", "subject": {"reference": "Patient/801f9570-e398-cfde-9c80-2381c03ab30e"}, "category": [{"coding": [{"code": "social-history", "system": "http://terminology.hl7.org/CodeSystem/observation-category", "display": "Social history"}]}], "encounter": {"reference": "Encounter/669a3035-962d-c340-cc4d-da605c5cb222"}, "resourceType": "Observation", "effectiveDateTime": "2025-06-19T15:53:52-04:00", "valueCodeableConcept": {"text": "Never smoked tobacco (finding)", "coding": [{"code": "266919005", "system": "http://snomed.info/sct", "display": "Never smoked tobacco (finding)"}]}}, {"id": "959a5863-a73b-2ed0-1438-032264f5627e", "code": {"text": "Respiratory rate", "coding": [{"code": "9279-1", "system": "http://loinc.org", "display": "Respiratory rate"}]}, "meta": {"profile": ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-respiratory-rate"], "versionId": "1", "lastUpdated": "2025-07-09T00:22:52.193531+00:00"}, "issued": "2025-06-19T15:53:52.602-04:00", "status": "final", "subject": {"reference": "Patient/801f9570-e398-cfde-9c80-2381c03ab30e"}, "category": [{"coding": [{"code": "vital-signs", "system": "http://terminology.hl7.org/CodeSystem/observation-category", "display": "Vital signs"}]}], "encounter": {"reference": "Encounter/669a3035-962d-c340-cc4d-da605c5cb222"}, "resourceType": "Observation", "valueQuantity": {"code": "/min", "unit": "/min", "value": 15, "system": "http://unitsofmeasure.org"}, "effectiveDateTime": "2025-06-19T15:53:52-04:00"}, {"id": "0f66b133-e2dd-ae5e-8c62-ead82a86d40a", "code": {"text": "Heart rate", "coding": [{"code": "8867-4", "system": "http://loinc.org", "display": "Heart rate"}]}, "meta": {"profile": ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-heart-rate"], "versionId": "1", "lastUpdated": "2025-07-09T00:22:52.191352+00:00"}, "issued": "2025-06-19T15:53:52.602-04:00", "status": "final", "subject": {"reference": "Patient/801f9570-e398-cfde-9c80-2381c03ab30e"}, "category": [{"coding": [{"code": "vital-signs", "system": "http://terminology.hl7.org/CodeSystem/observation-category", "display": "Vital signs"}]}], "encounter": {"reference": "Encounter/669a3035-962d-c340-cc4d-da605c5cb222"}, "resourceType": "Observation", "valueQuantity": {"code": "/min", "unit": "/min", "value": 85, "system": "http://unitsofmeasure.org"}, "effectiveDateTime": "2025-06-19T15:53:52-04:00"}, {"id": "dbf45fff-71ed-64a4-0180-7e5e0619947a", "code": {"text": "Blood pressure panel with all children optional", "coding": [{"code": "85354-9", "system": "http://loinc.org", "display": "Blood pressure panel with all children optional"}]}, "meta": {"profile": ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-blood-pressure"], "versionId": "1", "lastUpdated": "2025-07-09T00:22:52.189408+00:00"}, "issued": "2025-06-19T15:53:52.602-04:00", "status": "final", "subject": {"reference": "Patient/801f9570-e398-cfde-9c80-2381c03ab30e"}, "category": [{"coding": [{"code": "vital-signs", "system": "http://terminology.hl7.org/CodeSystem/observation-category", "display": "Vital signs"}]}], "component": [{"code": {"text": "Diastolic Blood Pressure", "coding": [{"code": "8462-4", "system": "http://loinc.org", "display": "Diastolic Blood Pressure"}]}, "valueQuantity": {"code": "mm[Hg]", "unit": "mm[Hg]", "value": 76.0, "system": "http://unitsofmeasure.org"}}, {"code": {"text": "Systolic Blood Pressure", "coding": [{"code": "8480-6", "system": "http://loinc.org", "display": "Systolic Blood Pressure"}]}, "valueQuantity": {"code": "mm[Hg]", "unit": "mm[Hg]", "value": 103.0, "system": "http://unitsofmeasure.org"}}], "encounter": {"reference": "Encounter/669a3035-962d-c340-cc4d-da605c5cb222"}, "resourceType": "Observation", "effectiveDateTime": "2025-06-19T15:53:52-04:00"}, {"id": "d0e2bcce-796b-9d3a-01a0-8a2745133d1d", "code": {"text": "Body mass index (BMI) [Percentile] Per age and sex", "coding": [{"code": "59576-9", "system": "http://loinc.org", "display": "Body mass index (BMI) [Percentile] Per age and sex"}]}, "meta": {"profile": ["http://hl7.org/fhir/us/core/StructureDefinition/pediatric-bmi-for-age"], "versionId": "1", "lastUpdated": "2025-07-09T00:22:52.187557+00:00"}, "issued": "2025-06-19T15:53:52.602-04:00", "status": "final", "subject": {"reference": "Patient/801f9570-e398-cfde-9c80-2381c03ab30e"}, "category": [{"coding": [{"code": "vital-signs", "system": "http://terminology.hl7.org/CodeSystem/observation-category", "display": "Vital signs"}]}], "encounter": {"reference": "Encounter/669a3035-962d-c340-cc4d-da605c5cb222"}, "resourceType": "Observation", "valueQuantity": {"code": "%", "unit": "%", "value": 99.425, "system": "http://unitsofmeasure.org"}, "effectiveDateTime": "2025-06-19T15:53:52-04:00"}]);
        setPatientsData([{"id": "801f9570-e398-cfde-9c80-2381c03ab30e", "meta": {"profile": ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"], "versionId": "1", "lastUpdated": "2025-07-09T00:22:51.556429+00:00"}, "name": [{"use": "official", "given": ["Ernest565", "Rhett759"], "family": "Gorczany269"}], "text": {"div": "<div xmlns=\"http://www.w3.org/1999/xhtml\">Generated by <a href=\"https://github.com/synthetichealth/synthea\">Synthea</a>.Version identifier: master-branch-latest\n .   Person seed: 34763064450124911  Population seed: 12345</div>", "status": "generated"}, "gender": "male", "address": [{"city": "Somerville", "line": ["632 Batz Common Unit 53"], "state": "MA", "country": "US", "extension": [{"url": "http://hl7.org/fhir/StructureDefinition/geolocation", "extension": [{"url": "latitude", "valueDecimal": 42.33500392613571}, {"url": "longitude", "valueDecimal": -71.07561030334666}]}], "postalCode": "02140"}], "telecom": [{"use": "home", "value": "555-172-1072", "system": "phone"}], "birthDate": "2022-07-14", "extension": [{"url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race", "extension": [{"url": "ombCategory", "valueCoding": {"code": "2106-3", "system": "urn:oid:2.16.840.1.113883.6.238", "display": "White"}}, {"url": "text", "valueString": "White"}]}, {"url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity", "extension": [{"url": "ombCategory", "valueCoding": {"code": "2186-5", "system": "urn:oid:2.16.840.1.113883.6.238", "display": "Not Hispanic or Latino"}}, {"url": "text", "valueString": "Not Hispanic or Latino"}]}, {"url": "http://hl7.org/fhir/StructureDefinition/patient-mothersMaidenName", "valueString": "Debbi640 Jaskolski867"}, {"url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex", "valueCode": "M"}, {"url": "http://hl7.org/fhir/StructureDefinition/patient-birthPlace", "valueAddress": {"city": "Framingham", "state": "Massachusetts", "country": "US"}}, {"url": "http://synthetichealth.github.io/synthea/disability-adjusted-life-years", "valueDecimal": 0.0}, {"url": "http://synthetichealth.github.io/synthea/quality-adjusted-life-years", "valueDecimal": 2.0}], "identifier": [{"value": "801f9570-e398-cfde-9c80-2381c03ab30e", "system": "https://github.com/synthetichealth/synthea"}, {"type": {"text": "Medical Record Number", "coding": [{"code": "MR", "system": "http://terminology.hl7.org/CodeSystem/v2-0203", "display": "Medical Record Number"}]}, "value": "801f9570-e398-cfde-9c80-2381c03ab30e", "system": "http://hospital.smarthealthit.org"}, {"type": {"text": "Social Security Number", "coding": [{"code": "SS", "system": "http://terminology.hl7.org/CodeSystem/v2-0203", "display": "Social Security Number"}]}, "value": "999-39-5076", "system": "http://hl7.org/fhir/sid/us-ssn"}], "resourceType": "Patient", "communication": [{"language": {"text": "English (United States)", "coding": [{"code": "en-US", "system": "urn:ietf:bcp:47", "display": "English (United States)"}]}}], "maritalStatus": {"text": "Never Married", "coding": [{"code": "S", "system": "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus", "display": "Never Married"}]}, "multipleBirthBoolean": false}, {"id": "e5b40b82-031b-610f-787e-2a4242efcfea", "meta": {"profile": ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"], "versionId": "1", "lastUpdated": "2025-07-09T00:22:50.222817+00:00"}, "name": [{"use": "official", "given": ["Romaine793"], "family": "Brakus656"}], "text": {"div": "<div xmlns=\"http://www.w3.org/1999/xhtml\">Generated by <a href=\"https://github.com/synthetichealth/synthea\">Synthea</a>.Version identifier: master-branch-latest\n .   Person seed: 8850753136911882592  Population seed: 12345</div>", "status": "generated"}, "gender": "female", "address": [{"city": "Edgartown", "line": ["203 Ortiz Wall Suite 23"], "state": "MA", "country": "US", "extension": [{"url": "http://hl7.org/fhir/StructureDefinition/geolocation", "extension": [{"url": "latitude", "valueDecimal": 41.4148753512207}, {"url": "longitude", "valueDecimal": -70.48824942645982}]}], "postalCode": "00000"}], "telecom": [{"use": "home", "value": "555-599-8981", "system": "phone"}], "birthDate": "2015-10-01", "extension": [{"url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race", "extension": [{"url": "ombCategory", "valueCoding": {"code": "2106-3", "system": "urn:oid:2.16.840.1.113883.6.238", "display": "White"}}, {"url": "text", "valueString": "White"}]}, {"url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity", "extension": [{"url": "ombCategory", "valueCoding": {"code": "2186-5", "system": "urn:oid:2.16.840.1.113883.6.238", "display": "Not Hispanic or Latino"}}, {"url": "text", "valueString": "Not Hispanic or Latino"}]}, {"url": "http://hl7.org/fhir/StructureDefinition/patient-mothersMaidenName", "valueString": "Hollis7 Keeling57"}, {"url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex", "valueCode": "F"}, {"url": "http://hl7.org/fhir/StructureDefinition/patient-birthPlace", "valueAddress": {"city": "Pittsfield", "state": "Massachusetts", "country": "US"}}, {"url": "http://synthetichealth.github.io/synthea/disability-adjusted-life-years", "valueDecimal": 0.013792719009729806}, {"url": "http://synthetichealth.github.io/synthea/quality-adjusted-life-years", "valueDecimal": 8.98620728099027}], "identifier": [{"value": "e5b40b82-031b-610f-787e-2a4242efcfea", "system": "https://github.com/synthetichealth/synthea"}, {"type": {"text": "Medical Record Number", "coding": [{"code": "MR", "system": "http://terminology.hl7.org/CodeSystem/v2-0203", "display": "Medical Record Number"}]}, "value": "e5b40b82-031b-610f-787e-2a4242efcfea", "system": "http://hospital.smarthealthit.org"}, {"type": {"text": "Social Security Number", "coding": [{"code": "SS", "system": "http://terminology.hl7.org/CodeSystem/v2-0203", "display": "Social Security Number"}]}, "value": "999-80-5043", "system": "http://hl7.org/fhir/sid/us-ssn"}], "resourceType": "Patient", "communication": [{"language": {"text": "English (United States)", "coding": [{"code": "en-US", "system": "urn:ietf:bcp:47", "display": "English (United States)"}]}}], "maritalStatus": {"text": "Never Married", "coding": [{"code": "S", "system": "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus", "display": "Never Married"}]}, "multipleBirthBoolean": false}, {"id": "2add8cb0-9ec4-15de-4e5b-e812509a5068", "meta": {"profile": ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"], "versionId": "1", "lastUpdated": "2025-07-09T00:22:47.434826+00:00"}, "name": [{"use": "official", "given": ["Barbara209", "Leonor133"], "family": "Ochoa950", "prefix": ["Mrs."]}, {"use": "maiden", "given": ["Barbara209", "Leonor133"], "family": "Ba\u00f1uelos542", "prefix": ["Mrs."]}], "text": {"div": "<div xmlns=\"http://www.w3.org/1999/xhtml\">Generated by <a href=\"https://github.com/synthetichealth/synthea\">Synthea</a>.Version identifier: master-branch-latest\n .   Person seed: 7822485531911573084  Population seed: 12345</div>", "status": "generated"}, "gender": "female", "address": [{"city": "Gardner", "line": ["434 Wisozk Road"], "state": "MA", "country": "US", "extension": [{"url": "http://hl7.org/fhir/StructureDefinition/geolocation", "extension": [{"url": "latitude", "valueDecimal": 42.5852726874584}, {"url": "longitude", "valueDecimal": -71.95785758966451}]}], "postalCode": "01440"}], "telecom": [{"use": "home", "value": "555-403-6377", "system": "phone"}], "birthDate": "1970-09-09", "extension": [{"url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race", "extension": [{"url": "ombCategory", "valueCoding": {"code": "2106-3", "system": "urn:oid:2.16.840.1.113883.6.238", "display": "White"}}, {"url": "text", "valueString": "White"}]}, {"url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity", "extension": [{"url": "ombCategory", "valueCoding": {"code": "2135-2", "system": "urn:oid:2.16.840.1.113883.6.238", "display": "Hispanic or Latino"}}, {"url": "text", "valueString": "Hispanic or Latino"}]}, {"url": "http://hl7.org/fhir/StructureDefinition/patient-mothersMaidenName", "valueString": "Micaela928 G\u00f3mez206"}, {"url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex", "valueCode": "F"}, {"url": "http://hl7.org/fhir/StructureDefinition/patient-birthPlace", "valueAddress": {"city": "Mexico City", "state": "Mexico City", "country": "MX"}}, {"url": "http://synthetichealth.github.io/synthea/disability-adjusted-life-years", "valueDecimal": 0.3858809895019603}, {"url": "http://synthetichealth.github.io/synthea/quality-adjusted-life-years", "valueDecimal": 53.61411901049804}], "identifier": [{"value": "2add8cb0-9ec4-15de-4e5b-e812509a5068", "system": "https://github.com/synthetichealth/synthea"}, {"type": {"text": "Medical Record Number", "coding": [{"code": "MR", "system": "http://terminology.hl7.org/CodeSystem/v2-0203", "display": "Medical Record Number"}]}, "value": "2add8cb0-9ec4-15de-4e5b-e812509a5068", "system": "http://hospital.smarthealthit.org"}, {"type": {"text": "Social Security Number", "coding": [{"code": "SS", "system": "http://terminology.hl7.org/CodeSystem/v2-0203", "display": "Social Security Number"}]}, "value": "999-59-2264", "system": "http://hl7.org/fhir/sid/us-ssn"}, {"type": {"text": "Driver's license number", "coding": [{"code": "DL", "system": "http://terminology.hl7.org/CodeSystem/v2-0203", "display": "Driver's license number"}]}, "value": "S99910921", "system": "urn:oid:2.16.840.1.113883.4.3.25"}, {"type": {"text": "Passport Number", "coding": [{"code": "PPN", "system": "http://terminology.hl7.org/CodeSystem/v2-0203", "display": "Passport Number"}]}, "value": "X7655068X", "system": "http://hl7.org/fhir/sid/passport-USA"}], "resourceType": "Patient", "communication": [{"language": {"text": "Spanish", "coding": [{"code": "es", "system": "urn:ietf:bcp:47", "display": "Spanish"}]}}], "maritalStatus": {"text": "Married", "coding": [{"code": "M", "system": "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus", "display": "Married"}]}, "multipleBirthBoolean": false}, {"id": "2a76c0e3-1e73-2109-3d5e-8a8871fe35d7", "meta": {"profile": ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"], "versionId": "1", "lastUpdated": "2025-07-09T00:22:43.652483+00:00"}, "name": [{"use": "official", "given": ["Aaron697", "Leandro563"], "family": "Grimes165", "prefix": ["Mr."]}], "text": {"div": "<div xmlns=\"http://www.w3.org/1999/xhtml\">Generated by <a href=\"https://github.com/synthetichealth/synthea\">Synthea</a>.Version identifier: master-branch-latest\n .   Person seed: -8750040877746075818  Population seed: 12345</div>", "status": "generated"}, "gender": "male", "address": [{"city": "Randolph", "line": ["1070 Stroman Annex"], "state": "MA", "country": "US", "extension": [{"url": "http://hl7.org/fhir/StructureDefinition/geolocation", "extension": [{"url": "latitude", "valueDecimal": 42.165040142990975}, {"url": "longitude", "valueDecimal": -71.04403215056}]}], "postalCode": "02368"}], "telecom": [{"use": "home", "value": "555-798-1797", "system": "phone"}], "birthDate": "1957-06-15", "extension": [{"url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race", "extension": [{"url": "ombCategory", "valueCoding": {"code": "2106-3", "system": "urn:oid:2.16.840.1.113883.6.238", "display": "White"}}, {"url": "text", "valueString": "White"}]}, {"url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity", "extension": [{"url": "ombCategory", "valueCoding": {"code": "2186-5", "system": "urn:oid:2.16.840.1.113883.6.238", "display": "Not Hispanic or Latino"}}, {"url": "text", "valueString": "Not Hispanic or Latino"}]}, {"url": "http://hl7.org/fhir/StructureDefinition/patient-mothersMaidenName", "valueString": "Hang682 Dickens475"}, {"url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex", "valueCode": "M"}, {"url": "http://hl7.org/fhir/StructureDefinition/patient-birthPlace", "valueAddress": {"city": "Stoughton", "state": "Massachusetts", "country": "US"}}, {"url": "http://synthetichealth.github.io/synthea/disability-adjusted-life-years", "valueDecimal": 0.219094539803443}, {"url": "http://synthetichealth.github.io/synthea/quality-adjusted-life-years", "valueDecimal": 66.78090546019655}], "identifier": [{"value": "2a76c0e3-1e73-2109-3d5e-8a8871fe35d7", "system": "https://github.com/synthetichealth/synthea"}, {"type": {"text": "Medical Record Number", "coding": [{"code": "MR", "system": "http://terminology.hl7.org/CodeSystem/v2-0203", "display": "Medical Record Number"}]}, "value": "2a76c0e3-1e73-2109-3d5e-8a8871fe35d7", "system": "http://hospital.smarthealthit.org"}, {"type": {"text": "Social Security Number", "coding": [{"code": "SS", "system": "http://terminology.hl7.org/CodeSystem/v2-0203", "display": "Social Security Number"}]}, "value": "999-20-5991", "system": "http://hl7.org/fhir/sid/us-ssn"}, {"type": {"text": "Driver's license number", "coding": [{"code": "DL", "system": "http://terminology.hl7.org/CodeSystem/v2-0203", "display": "Driver's license number"}]}, "value": "S99953592", "system": "urn:oid:2.16.840.1.113883.4.3.25"}, {"type": {"text": "Passport Number", "coding": [{"code": "PPN", "system": "http://terminology.hl7.org/CodeSystem/v2-0203", "display": "Passport Number"}]}, "value": "X43344747X", "system": "http://hl7.org/fhir/sid/passport-USA"}], "resourceType": "Patient", "communication": [{"language": {"text": "English (United States)", "coding": [{"code": "en-US", "system": "urn:ietf:bcp:47", "display": "English (United States)"}]}}], "maritalStatus": {"text": "Never Married", "coding": [{"code": "S", "system": "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus", "display": "Never Married"}]}, "multipleBirthBoolean": false}, {"id": "47a09a92-ead2-b13a-c858-5adb5b8613ad", "meta": {"profile": ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"], "versionId": "1", "lastUpdated": "2025-07-09T00:22:42.324006+00:00"}, "name": [{"use": "official", "given": ["Randell912"], "family": "Murphy561", "prefix": ["Mr."]}], "text": {"div": "<div xmlns=\"http://www.w3.org/1999/xhtml\">Generated by <a href=\"https://github.com/synthetichealth/synthea\">Synthea</a>.Version identifier: master-branch-latest\n .   Person seed: 7128737013364301064  Population seed: 12345</div>", "status": "generated"}, "gender": "male", "address": [{"city": "Weston", "line": ["371 Considine Haven Suite 65"], "state": "MA", "country": "US", "extension": [{"url": "http://hl7.org/fhir/StructureDefinition/geolocation", "extension": [{"url": "latitude", "valueDecimal": 42.357561464193104}, {"url": "longitude", "valueDecimal": -71.27768320415106}]}], "postalCode": "00000"}], "telecom": [{"use": "home", "value": "555-178-3416", "system": "phone"}], "birthDate": "2005-08-18", "extension": [{"url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race", "extension": [{"url": "ombCategory", "valueCoding": {"code": "2106-3", "system": "urn:oid:2.16.840.1.113883.6.238", "display": "White"}}, {"url": "text", "valueString": "White"}]}, {"url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity", "extension": [{"url": "ombCategory", "valueCoding": {"code": "2186-5", "system": "urn:oid:2.16.840.1.113883.6.238", "display": "Not Hispanic or Latino"}}, {"url": "text", "valueString": "Not Hispanic or Latino"}]}, {"url": "http://hl7.org/fhir/StructureDefinition/patient-mothersMaidenName", "valueString": "Lucille738 Cronin387"}, {"url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex", "valueCode": "M"}, {"url": "http://hl7.org/fhir/StructureDefinition/patient-birthPlace", "valueAddress": {"city": "Ashburnham", "state": "Massachusetts", "country": "US"}}, {"url": "http://synthetichealth.github.io/synthea/disability-adjusted-life-years", "valueDecimal": 0.0}, {"url": "http://synthetichealth.github.io/synthea/quality-adjusted-life-years", "valueDecimal": 19.0}], "identifier": [{"value": "47a09a92-ead2-b13a-c858-5adb5b8613ad", "system": "https://github.com/synthetichealth/synthea"}, {"type": {"text": "Medical Record Number", "coding": [{"code": "MR", "system": "http://terminology.hl7.org/CodeSystem/v2-0203", "display": "Medical Record Number"}]}, "value": "47a09a92-ead2-b13a-c858-5adb5b8613ad", "system": "http://hospital.smarthealthit.org"}, {"type": {"text": "Social Security Number", "coding": [{"code": "SS", "system": "http://terminology.hl7.org/CodeSystem/v2-0203", "display": "Social Security Number"}]}, "value": "999-21-5081", "system": "http://hl7.org/fhir/sid/us-ssn"}, {"type": {"text": "Driver's license number", "coding": [{"code": "DL", "system": "http://terminology.hl7.org/CodeSystem/v2-0203", "display": "Driver's license number"}]}, "value": "S99979582", "system": "urn:oid:2.16.840.1.113883.4.3.25"}], "resourceType": "Patient", "communication": [{"language": {"text": "English (United States)", "coding": [{"code": "en-US", "system": "urn:ietf:bcp:47", "display": "English (United States)"}]}}], "maritalStatus": {"text": "Never Married", "coding": [{"code": "S", "system": "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus", "display": "Never Married"}]}, "multipleBirthBoolean": false}]);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };
    loadData();
  }, [patientId]);

  // Process temporal data for charts
  const timeSeriesData = useMemo(() => {
    const series = {};
    // Process Observation time series
    series['Observation'] = [];
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
                150
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
                2
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Id</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={1} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : (
              <>
                {{/* Rows would be generated from data */}}
              </>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ObservationsDashboard;