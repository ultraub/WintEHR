import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Stack,
  Divider,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Collapse,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Badge,
  LinearProgress
} from '@mui/material';
import {
  AttachMoney as MoneyIcon,
  Receipt as ClaimIcon,
  AccountBalance as InsuranceIcon,
  Description as EOBIcon,
  CreditCard as PaymentIcon,
  Warning as WarningIcon,
  CheckCircle as ApprovedIcon,
  Cancel as DeniedIcon,
  Schedule as PendingIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Print as PrintIcon,
  GetApp as DownloadIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { fhirClient } from '../../../services/fhirClient';

// Coverage/Insurance Section
const CoverageSection = ({ coverage, patientId }) => {
  const [expandedCoverage, setExpandedCoverage] = useState({});

  const toggleExpanded = (id) => {
    setExpandedCoverage(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getCoverageStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'cancelled': return 'error';
      case 'draft': return 'warning';
      default: return 'default';
    }
  };

  const activeCoverage = coverage.filter(c => c.status === 'active');

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Insurance Coverage</Typography>
          <Tooltip title="Verify Coverage">
            <IconButton size="small" color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {activeCoverage.map((cov, index) => {
          const isExpanded = expandedCoverage[cov.id];
          const payor = cov.payor?.[0];

          return (
            <React.Fragment key={cov.id}>
              <Box sx={{ mb: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar sx={{ bgcolor: 'primary.light' }}>
                      <InsuranceIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle1">
                        {payor?.display || 'Unknown Insurance'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Policy: {cov.subscriberId || 'N/A'}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip 
                      label={cov.status}
                      size="small"
                      color={getCoverageStatusColor(cov.status)}
                    />
                    <IconButton size="small" onClick={() => toggleExpanded(cov.id)}>
                      {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Stack>
                </Stack>

                <Collapse in={isExpanded}>
                  <Box sx={{ ml: 7, mt: 2 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2">Coverage Details</Typography>
                        <Typography variant="body2">
                          Type: {cov.type?.text || cov.type?.coding?.[0]?.display || 'Unknown'}
                        </Typography>
                        <Typography variant="body2">
                          Relationship: {cov.relationship?.coding?.[0]?.display || 'Self'}
                        </Typography>
                        {cov.period && (
                          <Typography variant="body2">
                            Period: {cov.period.start ? format(parseISO(cov.period.start), 'MM/dd/yyyy') : 'N/A'} - 
                            {cov.period.end ? format(parseISO(cov.period.end), 'MM/dd/yyyy') : 'Ongoing'}
                          </Typography>
                        )}
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2">Cost Sharing</Typography>
                        {cov.costToBeneficiary?.map((cost, idx) => (
                          <Typography key={idx} variant="body2">
                            {cost.type?.coding?.[0]?.display}: ${cost.valueQuantity?.value || cost.valueMoney?.value || 'N/A'}
                          </Typography>
                        ))}
                      </Grid>
                    </Grid>
                    
                    <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                      <Button size="small" startIcon={<PhoneIcon />}>
                        Contact Payor
                      </Button>
                      <Button size="small" variant="outlined">
                        View Benefits
                      </Button>
                    </Stack>
                  </Box>
                </Collapse>
              </Box>
              {index < activeCoverage.length - 1 && <Divider />}
            </React.Fragment>
          );
        })}

        {activeCoverage.length === 0 && (
          <Alert severity="warning">
            No active insurance coverage found
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

// Claims Section
const ClaimsSection = ({ claims, patientId }) => {
  const [expandedClaims, setExpandedClaims] = useState({});
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const toggleExpanded = (id) => {
    setExpandedClaims(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getClaimStatusColor = (status) => {
    switch (status) {
      case 'active': return 'info';
      case 'cancelled': return 'error';
      case 'draft': return 'warning';
      case 'entered-in-error': return 'error';
      default: return 'default';
    }
  };

  const getClaimStatusIcon = (status) => {
    switch (status) {
      case 'active': return <PendingIcon color="info" />;
      case 'cancelled': return <DeniedIcon color="error" />;
      default: return <ClaimIcon color="action" />;
    }
  };

  const filteredClaims = claims.filter(claim => {
    const matchesFilter = filter === 'all' || claim.status === filter;
    const matchesSearch = !searchTerm || 
      (claim.diagnosis?.[0]?.diagnosisCodeableConcept?.text || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const calculateClaimTotal = (claim) => {
    return claim.item?.reduce((total, item) => {
      const amount = item.net?.value || 0;
      return total + amount;
    }, 0) || 0;
  };

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Claims History</Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Submit New Claim">
              <IconButton size="small" color="primary">
                <ClaimIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Print Claims Report">
              <IconButton size="small">
                <PrintIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={2} mb={2}>
          <TextField
            size="small"
            placeholder="Search claims..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
            sx={{ flexGrow: 1 }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              label="Status"
            >
              <MenuItem value="all">All Claims</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
              <MenuItem value="draft">Draft</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Claim Date</TableCell>
                <TableCell>Service</TableCell>
                <TableCell>Provider</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredClaims.slice(0, 10).map((claim) => {
                const claimTotal = calculateClaimTotal(claim);
                const diagnosis = claim.diagnosis?.[0]?.diagnosisCodeableConcept?.text || 
                                claim.diagnosis?.[0]?.diagnosisCodeableConcept?.coding?.[0]?.display ||
                                'Unknown Service';

                return (
                  <TableRow key={claim.id}>
                    <TableCell>
                      {claim.created ? format(parseISO(claim.created), 'MM/dd/yyyy') : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {diagnosis}
                      </Typography>
                      {claim.diagnosis?.[0]?.diagnosisCodeableConcept?.coding?.[0]?.code && (
                        <Typography variant="caption" color="text.secondary">
                          Code: {claim.diagnosis[0].diagnosisCodeableConcept.coding[0].code}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {claim.provider?.display || 'Unknown Provider'}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={claim.status}
                        size="small"
                        color={getClaimStatusColor(claim.status)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        ${claimTotal.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="View Details">
                          <IconButton 
                            size="small" 
                            onClick={() => toggleExpanded(claim.id)}
                          >
                            {expandedClaims[claim.id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download">
                          <IconButton size="small">
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {filteredClaims.length === 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            No claims found for the selected criteria
          </Alert>
        )}

        {filteredClaims.length > 10 && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Button variant="outlined">
              View All {filteredClaims.length} Claims
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

// Explanation of Benefits Section
const EOBSection = ({ eobs, patientId }) => {
  const [filter, setFilter] = useState('all');

  const getOutcomeColor = (outcome) => {
    switch (outcome) {
      case 'complete': return 'success';
      case 'error': return 'error';
      case 'partial': return 'warning';
      default: return 'default';
    }
  };

  const filteredEOBs = eobs.filter(eob => {
    if (filter === 'all') return true;
    return eob.outcome === filter;
  });

  const calculatePaymentSummary = (eob) => {
    const payment = eob.payment?.[0];
    return {
      amount: payment?.amount?.value || 0,
      date: payment?.date,
      type: payment?.type?.coding?.[0]?.display || 'Unknown'
    };
  };

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Explanation of Benefits</Typography>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Outcome</InputLabel>
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              label="Outcome"
            >
              <MenuItem value="all">All EOBs</MenuItem>
              <MenuItem value="complete">Complete</MenuItem>
              <MenuItem value="partial">Partial</MenuItem>
              <MenuItem value="error">Error</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <List>
          {filteredEOBs.slice(0, 5).map((eob, index) => {
            const payment = calculatePaymentSummary(eob);
            const insurer = eob.insurer?.display || 'Unknown Insurer';

            return (
              <React.Fragment key={eob.id}>
                <ListItem>
                  <ListItemIcon>
                    <EOBIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body1">
                          EOB from {insurer}
                        </Typography>
                        <Chip 
                          label={eob.outcome}
                          size="small"
                          color={getOutcomeColor(eob.outcome)}
                        />
                      </Stack>
                    }
                    secondary={
                      <>
                        Created: {eob.created ? format(parseISO(eob.created), 'MM/dd/yyyy') : 'Unknown'}
                        {payment.amount > 0 && ` • Payment: $${payment.amount.toLocaleString()}`}
                        {payment.date && ` on ${format(parseISO(payment.date), 'MM/dd/yyyy')}`}
                      </>
                    }
                  />
                  <Stack direction="row" spacing={1}>
                    <Tooltip title="View EOB">
                      <IconButton size="small">
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </ListItem>
                {index < filteredEOBs.length - 1 && <Divider />}
              </React.Fragment>
            );
          })}
        </List>

        {filteredEOBs.length === 0 && (
          <Alert severity="info">
            No explanation of benefits found
          </Alert>
        )}

        {filteredEOBs.length > 5 && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Button variant="outlined">
              View All {filteredEOBs.length} EOBs
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

// Financial Summary Section
const FinancialSummarySection = ({ claims, eobs, coverage }) => {
  const calculateFinancialSummary = () => {
    const totalCharges = claims.reduce((total, claim) => {
      return total + (claim.item?.reduce((itemTotal, item) => {
        return itemTotal + (item.net?.value || 0);
      }, 0) || 0);
    }, 0);

    const totalPayments = eobs.reduce((total, eob) => {
      return total + (eob.payment?.[0]?.amount?.value || 0);
    }, 0);

    const balance = totalCharges - totalPayments;

    return {
      totalCharges,
      totalPayments,
      balance,
      activeClaims: claims.filter(c => c.status === 'active').length,
      activeCoverage: coverage.filter(c => c.status === 'active').length
    };
  };

  const summary = calculateFinancialSummary();

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6} md={2.4}>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <MoneyIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
          <Typography variant="h6">
            ${summary.totalCharges.toLocaleString()}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Total Charges
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} sm={6} md={2.4}>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <PaymentIcon color="success" sx={{ fontSize: 32, mb: 1 }} />
          <Typography variant="h6">
            ${summary.totalPayments.toLocaleString()}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Total Payments
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} sm={6} md={2.4}>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <WarningIcon color={summary.balance > 0 ? 'warning' : 'success'} sx={{ fontSize: 32, mb: 1 }} />
          <Typography variant="h6">
            ${Math.abs(summary.balance).toLocaleString()}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {summary.balance > 0 ? 'Outstanding Balance' : 'Credit Balance'}
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} sm={6} md={2.4}>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <ClaimIcon color="info" sx={{ fontSize: 32, mb: 1 }} />
          <Typography variant="h6">
            {summary.activeClaims}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Active Claims
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} sm={6} md={2.4}>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <InsuranceIcon color="secondary" sx={{ fontSize: 32, mb: 1 }} />
          <Typography variant="h6">
            {summary.activeCoverage}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Active Coverage
          </Typography>
        </Paper>
      </Grid>
    </Grid>
  );
};

// Main Financial Tab Component
const FinancialTab = ({ patientId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [claims, setClaims] = useState([]);
  const [eobs, setEobs] = useState([]);
  const [coverage, setCoverage] = useState([]);

  useEffect(() => {
    if (!patientId) return;
    fetchFinancialData();
  }, [patientId]);

  const fetchFinancialData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [claimsResult, eobsResult, coverageResult] = await Promise.all([
        fhirClient.search('Claim', { patient: patientId, _sort: '-created' }),
        fhirClient.search('ExplanationOfBenefit', { patient: patientId, _sort: '-created' }),
        fhirClient.getCoverage(patientId)
      ]);

      setClaims(claimsResult.resources || []);
      setEobs(eobsResult.resources || []);
      setCoverage(coverageResult.resources || []);

    } catch (err) {
      console.error('Error fetching financial data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Error loading financial data: {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Financial Summary */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Financial Overview
        </Typography>
        <FinancialSummarySection 
          claims={claims}
          eobs={eobs}
          coverage={coverage}
        />
      </Box>

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Coverage Section */}
        <Grid item xs={12} lg={6}>
          <CoverageSection 
            coverage={coverage}
            patientId={patientId}
          />
        </Grid>

        {/* EOB Section */}
        <Grid item xs={12} lg={6}>
          <EOBSection 
            eobs={eobs}
            patientId={patientId}
          />
        </Grid>

        {/* Claims Section */}
        <Grid item xs={12}>
          <ClaimsSection 
            claims={claims}
            patientId={patientId}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default FinancialTab;