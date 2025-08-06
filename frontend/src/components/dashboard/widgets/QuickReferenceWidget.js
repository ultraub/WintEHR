/**
 * Quick Reference Widget
 * Clinical references, guidelines, and drug information
 */

import React, { useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Collapse,
  Chip,
  IconButton,
  Divider,
  Alert,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  alpha,
  Link
} from '@mui/material';
import {
  Search as SearchIcon,
  ExpandMore,
  ExpandLess,
  Science as LabIcon,
  Medication as MedicationIcon,
  MenuBook as GuidelineIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';

// Mock reference data
const labReferences = [
  {
    name: 'Complete Blood Count (CBC)',
    tests: [
      { name: 'WBC', range: '4.5-11.0', unit: 'K/μL', critical: '<2.0 or >30.0' },
      { name: 'RBC', range: 'M: 4.5-5.9, F: 4.0-5.2', unit: 'M/μL' },
      { name: 'Hemoglobin', range: 'M: 13.5-17.5, F: 12.0-15.5', unit: 'g/dL', critical: '<7.0' },
      { name: 'Hematocrit', range: 'M: 38.8-50.0, F: 34.9-44.5', unit: '%' },
      { name: 'Platelets', range: '150-400', unit: 'K/μL', critical: '<50 or >1000' }
    ]
  },
  {
    name: 'Basic Metabolic Panel',
    tests: [
      { name: 'Glucose', range: '70-100', unit: 'mg/dL', critical: '<40 or >500' },
      { name: 'BUN', range: '7-20', unit: 'mg/dL' },
      { name: 'Creatinine', range: 'M: 0.74-1.35, F: 0.59-1.04', unit: 'mg/dL' },
      { name: 'Sodium', range: '136-145', unit: 'mEq/L', critical: '<120 or >160' },
      { name: 'Potassium', range: '3.5-5.0', unit: 'mEq/L', critical: '<2.5 or >6.5' },
      { name: 'Chloride', range: '98-107', unit: 'mEq/L' },
      { name: 'CO2', range: '22-29', unit: 'mEq/L' }
    ]
  },
  {
    name: 'Liver Function Tests',
    tests: [
      { name: 'ALT', range: '7-56', unit: 'U/L' },
      { name: 'AST', range: '10-40', unit: 'U/L' },
      { name: 'Alkaline Phosphatase', range: '44-147', unit: 'U/L' },
      { name: 'Total Bilirubin', range: '0.1-1.2', unit: 'mg/dL', critical: '>10.0' },
      { name: 'Direct Bilirubin', range: '0.0-0.3', unit: 'mg/dL' },
      { name: 'Albumin', range: '3.5-5.0', unit: 'g/dL' }
    ]
  },
  {
    name: 'Cardiac Markers',
    tests: [
      { name: 'Troponin I', range: '<0.04', unit: 'ng/mL', critical: '>0.04' },
      { name: 'BNP', range: '<100', unit: 'pg/mL', critical: '>400' },
      { name: 'CK-MB', range: '0-6.3', unit: 'ng/mL' }
    ]
  }
];

const drugReferences = [
  {
    category: 'Anticoagulants',
    drugs: [
      {
        name: 'Warfarin',
        dosing: 'Initial: 5-10mg daily, adjust based on INR',
        monitoring: 'INR goal usually 2-3, check q2-4 weeks when stable',
        interactions: 'Many! Including antibiotics, NSAIDs, amiodarone',
        reversal: 'Vitamin K 1-10mg PO/IV, FFP for urgent reversal'
      },
      {
        name: 'Apixaban (Eliquis)',
        dosing: 'A-fib: 5mg BID (2.5mg BID if ≥2: age≥80, weight≤60kg, Cr≥1.5)',
        monitoring: 'No routine monitoring required',
        interactions: 'Strong CYP3A4 inhibitors/inducers',
        reversal: 'Andexxa (andexanet alfa) for major bleeding'
      }
    ]
  },
  {
    category: 'Antibiotics',
    drugs: [
      {
        name: 'Vancomycin',
        dosing: '15-20mg/kg q8-12h (adjust for renal function)',
        monitoring: 'Trough goal: 10-20 mcg/mL for serious infections',
        interactions: 'Nephrotoxic drugs (aminoglycosides, loop diuretics)',
        notes: 'Red man syndrome with rapid infusion'
      },
      {
        name: 'Gentamicin',
        dosing: 'Traditional: 1-2.5mg/kg q8h, Extended interval: 5-7mg/kg q24h',
        monitoring: 'Peak: 5-10, Trough: <2 mcg/mL',
        interactions: 'Other nephrotoxic/ototoxic drugs',
        notes: 'Adjust for renal function, monitor for nephrotoxicity'
      }
    ]
  }
];

const guidelines = [
  {
    title: 'Hypertension Management (JNC 8)',
    category: 'Cardiovascular',
    keyPoints: [
      'Goal BP <140/90 for most adults',
      'Goal BP <150/90 for adults ≥60 years without DM/CKD',
      'First-line: Thiazide, CCB, ACEI/ARB',
      'In black patients: Thiazide or CCB preferred'
    ]
  },
  {
    title: 'Diabetes Management (ADA 2024)',
    category: 'Endocrine',
    keyPoints: [
      'A1C goal <7% for most adults',
      'Metformin first-line unless contraindicated',
      'Consider GLP-1 or SGLT-2 for CV/renal benefit',
      'Screen for complications annually'
    ]
  },
  {
    title: 'Sepsis Management',
    category: 'Critical Care',
    keyPoints: [
      'Recognition: qSOFA score ≥2',
      'Hour-1 Bundle: Lactate, cultures, antibiotics, fluids',
      'Fluid resuscitation: 30mL/kg crystalloid',
      'Vasopressor: Norepinephrine first-line for MAP ≥65'
    ]
  }
];

function QuickReferenceWidget() {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLabs, setExpandedLabs] = useState({});
  const [expandedDrugs, setExpandedDrugs] = useState({});

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const toggleLabExpansion = (labName) => {
    setExpandedLabs(prev => ({
      ...prev,
      [labName]: !prev[labName]
    }));
  };

  const toggleDrugExpansion = (category) => {
    setExpandedDrugs(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const filterContent = (items, query) => {
    if (!query) return items;
    const lowerQuery = query.toLowerCase();
    return items.filter(item => 
      JSON.stringify(item).toLowerCase().includes(lowerQuery)
    );
  };

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          Quick Reference
        </Typography>
        <TextField
          size="small"
          fullWidth
          placeholder="Search references..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
        />
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab icon={<LabIcon />} label="Lab Values" />
          <Tab icon={<MedicationIcon />} label="Drug Reference" />
          <Tab icon={<GuidelineIcon />} label="Guidelines" />
        </Tabs>
      </Box>

      {/* Content */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        {/* Lab Values Tab */}
        {activeTab === 0 && (
          <List>
            {filterContent(labReferences, searchQuery).map((lab) => (
              <React.Fragment key={lab.name}>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => toggleLabExpansion(lab.name)}>
                    <ListItemIcon>
                      <LabIcon />
                    </ListItemIcon>
                    <ListItemText primary={lab.name} />
                    {expandedLabs[lab.name] ? <ExpandLess /> : <ExpandMore />}
                  </ListItemButton>
                </ListItem>
                <Collapse in={expandedLabs[lab.name]} timeout="auto" unmountOnExit>
                  <TableContainer sx={{ mb: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Test</TableCell>
                          <TableCell>Reference Range</TableCell>
                          <TableCell>Unit</TableCell>
                          <TableCell>Critical</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {lab.tests.map((test, index) => (
                          <TableRow key={index}>
                            <TableCell>{test.name}</TableCell>
                            <TableCell>{test.range}</TableCell>
                            <TableCell>{test.unit}</TableCell>
                            <TableCell>
                              {test.critical && (
                                <Chip
                                  label={test.critical}
                                  size="small"
                                  color="error"
                                  icon={<WarningIcon />}
                                />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Collapse>
                <Divider />
              </React.Fragment>
            ))}
          </List>
        )}

        {/* Drug Reference Tab */}
        {activeTab === 1 && (
          <List>
            {filterContent(drugReferences, searchQuery).map((category) => (
              <React.Fragment key={category.category}>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => toggleDrugExpansion(category.category)}>
                    <ListItemIcon>
                      <MedicationIcon />
                    </ListItemIcon>
                    <ListItemText primary={category.category} />
                    {expandedDrugs[category.category] ? <ExpandLess /> : <ExpandMore />}
                  </ListItemButton>
                </ListItem>
                <Collapse in={expandedDrugs[category.category]} timeout="auto" unmountOnExit>
                  <Box sx={{ pl: 2, pr: 2, pb: 2 }}>
                    {category.drugs.map((drug, index) => (
                      <Paper
                        key={index}
                        sx={{
                          p: 2,
                          mb: 2,
                          bgcolor: alpha(theme.palette.primary.main, 0.05),
                          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
                        }}
                      >
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                          {drug.name}
                        </Typography>
                        <Box sx={{ display: 'grid', gap: 1 }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Dosing:
                            </Typography>
                            <Typography variant="body2">{drug.dosing}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Monitoring:
                            </Typography>
                            <Typography variant="body2">{drug.monitoring}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Interactions:
                            </Typography>
                            <Typography variant="body2">{drug.interactions}</Typography>
                          </Box>
                          {drug.reversal && (
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                Reversal:
                              </Typography>
                              <Typography variant="body2">{drug.reversal}</Typography>
                            </Box>
                          )}
                          {drug.notes && (
                            <Alert severity="info" sx={{ mt: 1 }}>
                              <Typography variant="body2">{drug.notes}</Typography>
                            </Alert>
                          )}
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                </Collapse>
                <Divider />
              </React.Fragment>
            ))}
          </List>
        )}

        {/* Guidelines Tab */}
        {activeTab === 2 && (
          <List>
            {filterContent(guidelines, searchQuery).map((guideline, index) => (
              <ListItem key={index} alignItems="flex-start" sx={{ flexDirection: 'column' }}>
                <Box sx={{ width: '100%', mb: 1 }}>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <GuidelineIcon color="primary" />
                    <Typography variant="subtitle2" fontWeight="bold">
                      {guideline.title}
                    </Typography>
                    <Chip label={guideline.category} size="small" />
                  </Box>
                  <List dense>
                    {guideline.keyPoints.map((point, pointIndex) => (
                      <ListItem key={pointIndex}>
                        <ListItemText
                          primary={point}
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
                {index < guidelines.length - 1 && <Divider sx={{ width: '100%' }} />}
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: alpha(theme.palette.background.default, 0.5) }}>
        <Alert severity="info" sx={{ py: 0.5 }}>
          <Typography variant="caption">
            Reference values may vary by laboratory and patient population. 
            Always use your institution's reference ranges and clinical judgment.
          </Typography>
        </Alert>
      </Box>
    </Paper>
  );
}

export default QuickReferenceWidget;