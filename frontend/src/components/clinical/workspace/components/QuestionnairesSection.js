/**
 * QuestionnairesSection Component
 *
 * Displays available clinical questionnaires (PHQ-9, GAD-7, Patient Intake)
 * and completed responses for the current patient.  Allows clinicians to
 * start a new questionnaire and view past scores.
 *
 * Integrated into the SummaryTab dashboard.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Stack,
  Skeleton,
  Alert,
  Divider,
  Tooltip
} from '@mui/material';
import {
  Quiz as QuizIcon,
  PlayArrow as StartIcon,
  CheckCircle as CompletedIcon,
  Refresh as RefreshIcon,
  Assessment as ScoreIcon,
  Add as SeedIcon
} from '@mui/icons-material';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import QuestionnaireDialog from '../dialogs/QuestionnaireDialog';

const QuestionnairesSection = ({ patientId }) => {
  const [questionnaires, setQuestionnaires] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch questionnaires from backend API
      const qResponse = await fetch('/api/questionnaires');
      if (!qResponse.ok) {
        throw new Error(`Failed to fetch questionnaires: ${qResponse.status}`);
      }
      const qData = await qResponse.json();
      setQuestionnaires(qData.questionnaires || []);

      // Fetch completed responses for this patient
      if (patientId) {
        const rResponse = await fetch(`/api/questionnaires/responses?patient=${patientId}`);
        if (rResponse.ok) {
          const rData = await rResponse.json();
          setResponses(rData.responses || []);
        }
      }
    } catch (err) {
      console.error('Error loading questionnaires:', err);
      setError(err.message || 'Failed to load questionnaires');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const response = await fetch('/api/questionnaires/seed', { method: 'POST' });
      if (!response.ok) {
        throw new Error(`Seed failed: ${response.status}`);
      }
      // Reload questionnaires after seeding
      await fetchData();
    } catch (err) {
      console.error('Error seeding questionnaires:', err);
      setError(err.message || 'Failed to seed questionnaires');
    } finally {
      setSeeding(false);
    }
  };

  const handleStartQuestionnaire = (q) => {
    setSelectedQuestionnaire(q);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedQuestionnaire(null);
  };

  const handleResponseSaved = () => {
    // Refresh responses after a new one is saved
    fetchData();
  };

  // Build a lookup from questionnaire ID to title
  const qTitleMap = {};
  questionnaires.forEach(q => {
    if (q.id) {
      qTitleMap[q.id] = q.title || q.name || 'Questionnaire';
    }
  });

  const getResponseTitle = (resp) => {
    const ref = resp.questionnaire || '';
    const id = ref.replace('Questionnaire/', '');
    return qTitleMap[id] || ref || 'Unknown Questionnaire';
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'Minimal': return 'success';
      case 'Mild': return 'info';
      case 'Moderate': return 'warning';
      case 'Moderately Severe': return 'error';
      case 'Severe': return 'error';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ mt: 3 }}>
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 0 }} />
      </Box>
    );
  }

  return (
    <>
      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Forms & Questionnaires
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 0 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Available Questionnaires */}
        <Card sx={{ flex: 1, borderRadius: 0 }}>
          <CardHeader
            title="Available Forms"
            titleTypographyProps={{ variant: 'h6' }}
            avatar={<QuizIcon color="primary" />}
            action={
              <Stack direction="row" spacing={0.5}>
                {questionnaires.length === 0 && (
                  <Tooltip title="Seed standard questionnaires (PHQ-9, GAD-7, Intake)">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<SeedIcon />}
                      onClick={handleSeed}
                      disabled={seeding}
                      sx={{ borderRadius: 0, textTransform: 'none' }}
                    >
                      {seeding ? 'Seeding...' : 'Seed Forms'}
                    </Button>
                  </Tooltip>
                )}
                <IconButton size="small" onClick={fetchData} title="Refresh">
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Stack>
            }
          />
          <CardContent sx={{ pt: 0 }}>
            {questionnaires.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  No questionnaires available
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<SeedIcon />}
                  onClick={handleSeed}
                  disabled={seeding}
                  sx={{ borderRadius: 0, mt: 1, textTransform: 'none' }}
                >
                  {seeding ? 'Seeding...' : 'Seed Standard Forms'}
                </Button>
              </Box>
            ) : (
              <List disablePadding>
                {questionnaires.map((q, idx) => (
                  <React.Fragment key={q.id || idx}>
                    {idx > 0 && <Divider />}
                    <ListItem
                      sx={{ px: 1 }}
                      secondaryAction={
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<StartIcon />}
                          onClick={() => handleStartQuestionnaire(q)}
                          disabled={!patientId}
                          sx={{ borderRadius: 0, textTransform: 'none' }}
                        >
                          Complete
                        </Button>
                      }
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <QuizIcon color="action" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={q.title}
                        secondary={`${q.itemCount || q.item?.length || 0} questions`}
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </Card>

        {/* Completed Responses */}
        <Card sx={{ flex: 1, borderRadius: 0 }}>
          <CardHeader
            title="Completed Responses"
            titleTypographyProps={{ variant: 'h6' }}
            avatar={<CompletedIcon color="success" />}
          />
          <CardContent sx={{ pt: 0 }}>
            {responses.length === 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ py: 3, textAlign: 'center' }}
              >
                No completed questionnaires for this patient
              </Typography>
            ) : (
              <List disablePadding>
                {responses.map((resp, idx) => (
                  <React.Fragment key={resp.id || idx}>
                    {idx > 0 && <Divider />}
                    <ListItem sx={{ px: 1 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        {resp.score ? (
                          <ScoreIcon color="primary" fontSize="small" />
                        ) : (
                          <CompletedIcon color="success" fontSize="small" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={getResponseTitle(resp)}
                        secondary={
                          resp.authored
                            ? formatDistanceToNow(parseISO(resp.authored), { addSuffix: true })
                            : 'Date unknown'
                        }
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                      {resp.score && (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Chip
                            label={`${resp.score.total}/${resp.score.maxScore}`}
                            size="small"
                            variant="outlined"
                            sx={{ borderRadius: 0, fontWeight: 600 }}
                          />
                          <Chip
                            label={resp.score.severity}
                            size="small"
                            color={getSeverityColor(resp.score.severity)}
                            sx={{ borderRadius: 0 }}
                          />
                        </Stack>
                      )}
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Questionnaire Dialog */}
      <QuestionnaireDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        questionnaire={selectedQuestionnaire}
        patientId={patientId}
        onSaved={handleResponseSaved}
      />
    </>
  );
};

export default QuestionnairesSection;
