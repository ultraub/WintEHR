import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  IconButton,
  Stack,
  FormControl,
  FormControlLabel,
  FormLabel,
  RadioGroup,
  Radio,
  Switch,
  CircularProgress,
  Alert,
  Divider,
  Chip,
  LinearProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  Quiz as QuizIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';

/**
 * QuestionnaireDialog — renders a FHIR Questionnaire dynamically and
 * saves a QuestionnaireResponse on completion.
 *
 * Supported item types: string, text, integer, decimal, boolean, choice.
 */
const QuestionnaireDialog = ({ open, onClose, questionnaire, patientId, encounterId, onSaved }) => {
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const items = questionnaire?.item || [];

  // Reset state when the dialog opens with a new questionnaire
  useEffect(() => {
    if (open && questionnaire) {
      setAnswers({});
      setError(null);
      setSubmitted(false);
    }
  }, [open, questionnaire?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(() => {
    setAnswers({});
    setError(null);
    setSubmitted(false);
    onClose();
  }, [onClose]);

  const handleAnswerChange = useCallback((linkId, value) => {
    setAnswers(prev => ({ ...prev, [linkId]: value }));
  }, []);

  // Build a FHIR QuestionnaireResponse from the collected answers
  const buildResponse = useCallback(() => {
    const responseItems = items.map(item => {
      const value = answers[item.linkId];
      if (value === undefined || value === null || value === '') {
        return { linkId: item.linkId, text: item.text };
      }

      let answer;
      switch (item.type) {
        case 'boolean':
          answer = [{ valueBoolean: !!value }];
          break;
        case 'integer':
          answer = [{ valueInteger: parseInt(value, 10) }];
          break;
        case 'decimal':
          answer = [{ valueDecimal: parseFloat(value) }];
          break;
        case 'choice': {
          // value is the selected coding object
          if (typeof value === 'object') {
            answer = [{ valueCoding: value }];
          } else {
            answer = [{ valueString: String(value) }];
          }
          break;
        }
        case 'text':
        case 'string':
        default:
          answer = [{ valueString: String(value) }];
          break;
      }

      return {
        linkId: item.linkId,
        text: item.text,
        answer,
      };
    });

    const resource = {
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      questionnaire: `Questionnaire/${questionnaire.id}`,
      subject: { reference: `Patient/${patientId}` },
      authored: new Date().toISOString(),
      item: responseItems,
    };

    if (encounterId) {
      resource.encounter = { reference: `Encounter/${encounterId}` };
    }

    return resource;
  }, [answers, items, questionnaire, patientId, encounterId]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const resource = buildResponse();
      await fhirClient.create('QuestionnaireResponse', resource);
      setSubmitted(true);
      if (onSaved) {
        onSaved();
      }
    } catch (err) {
      console.error('Error saving questionnaire response:', err);
      setError(err.message || 'Failed to save questionnaire response');
    } finally {
      setSaving(false);
    }
  };

  // Compute a live score for PHQ-9 / GAD-7 as user fills answers
  const liveScore = (() => {
    const isPHQ9 = items.some(i => (i.linkId || '').startsWith('phq9-'));
    const isGAD7 = items.some(i => (i.linkId || '').startsWith('gad7-'));
    if (!isPHQ9 && !isGAD7) return null;

    let total = 0;
    let answered = 0;
    items.forEach(item => {
      const val = answers[item.linkId];
      if (val && typeof val === 'object' && val.code !== undefined) {
        const n = parseInt(val.code, 10);
        if (!isNaN(n)) {
          total += n;
          answered += 1;
        }
      }
    });

    const maxScore = isPHQ9 ? 27 : 21;
    const instrument = isPHQ9 ? 'PHQ-9' : 'GAD-7';
    return { total, maxScore, answered, totalItems: items.length, instrument };
  })();

  if (!open || !questionnaire) return null;

  const title = questionnaire.title || questionnaire.name || 'Questionnaire';
  const answeredCount = Object.keys(answers).filter(k => answers[k] !== undefined && answers[k] !== '' && answers[k] !== null).length;
  const progress = items.length > 0 ? (answeredCount / items.length) * 100 : 0;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 0
        }
      }}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <QuizIcon />
            <Typography variant="h6">{title}</Typography>
          </Stack>
          <IconButton size="small" onClick={handleClose} aria-label="Close">
            <CloseIcon />
          </IconButton>
        </Stack>
        {questionnaire.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {questionnaire.description}
          </Typography>
        )}
        <Box sx={{ mt: 1 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 4, borderRadius: 0 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {answeredCount} of {items.length} questions answered
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {submitted ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 64, mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Response Saved
            </Typography>
            {liveScore && (
              <Box sx={{ mt: 2 }}>
                <Chip
                  label={`${liveScore.instrument} Score: ${liveScore.total} / ${liveScore.maxScore}`}
                  color="primary"
                  variant="outlined"
                  sx={{ borderRadius: 0 }}
                />
              </Box>
            )}
          </Box>
        ) : (
          <Stack spacing={3} sx={{ pt: 1 }}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {items.map((item, index) => (
              <Box key={item.linkId}>
                {index > 0 && <Divider sx={{ mb: 2 }} />}
                <QuestionnaireItem
                  item={item}
                  index={index}
                  value={answers[item.linkId]}
                  onChange={handleAnswerChange}
                />
              </Box>
            ))}

            {liveScore && (
              <Box
                sx={{
                  p: 2,
                  backgroundColor: 'grey.50',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 0,
                }}
              >
                <Typography variant="subtitle2" gutterBottom>
                  Running Score
                </Typography>
                <Typography variant="h4" color="primary.main">
                  {liveScore.total}
                  <Typography component="span" variant="body2" color="text.secondary">
                    {' '}/ {liveScore.maxScore}
                  </Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {liveScore.answered} of {liveScore.totalItems} items scored
                </Typography>
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        {submitted ? (
          <Button onClick={handleClose} variant="contained" sx={{ borderRadius: 0 }}>
            Done
          </Button>
        ) : (
          <>
            <Button onClick={handleClose} disabled={saving} sx={{ borderRadius: 0 }}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              variant="contained"
              disabled={saving || answeredCount === 0}
              startIcon={saving ? <CircularProgress size={16} /> : null}
              sx={{ borderRadius: 0 }}
            >
              {saving ? 'Saving...' : 'Submit Response'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};


/**
 * Renders a single questionnaire item with the appropriate MUI input
 * based on the FHIR item.type.
 */
const QuestionnaireItem = ({ item, index, value, onChange }) => {
  const { linkId, text, type, answerOption } = item;

  const label = (
    <Typography variant="subtitle2" gutterBottom>
      {index + 1}. {text}
    </Typography>
  );

  switch (type) {
    case 'string':
      return (
        <Box>
          {label}
          <TextField
            fullWidth
            size="small"
            value={value || ''}
            onChange={e => onChange(linkId, e.target.value)}
            placeholder="Enter your answer"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
          />
        </Box>
      );

    case 'text':
      return (
        <Box>
          {label}
          <TextField
            fullWidth
            size="small"
            multiline
            minRows={3}
            value={value || ''}
            onChange={e => onChange(linkId, e.target.value)}
            placeholder="Enter your answer"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
          />
        </Box>
      );

    case 'integer':
      return (
        <Box>
          {label}
          <TextField
            fullWidth
            size="small"
            type="number"
            inputProps={{ step: 1 }}
            value={value ?? ''}
            onChange={e => onChange(linkId, e.target.value)}
            placeholder="Enter a number"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
          />
        </Box>
      );

    case 'decimal':
      return (
        <Box>
          {label}
          <TextField
            fullWidth
            size="small"
            type="number"
            inputProps={{ step: 0.01 }}
            value={value ?? ''}
            onChange={e => onChange(linkId, e.target.value)}
            placeholder="Enter a number"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
          />
        </Box>
      );

    case 'boolean':
      return (
        <Box>
          {label}
          <FormControlLabel
            control={
              <Switch
                checked={!!value}
                onChange={e => onChange(linkId, e.target.checked)}
              />
            }
            label={value ? 'Yes' : 'No'}
          />
        </Box>
      );

    case 'choice': {
      const options = answerOption || [];
      return (
        <Box>
          <FormControl component="fieldset">
            <FormLabel component="legend" sx={{ mb: 0.5 }}>
              {index + 1}. {text}
            </FormLabel>
            <RadioGroup
              value={value ? JSON.stringify(value) : ''}
              onChange={e => {
                try {
                  onChange(linkId, JSON.parse(e.target.value));
                } catch {
                  onChange(linkId, e.target.value);
                }
              }}
            >
              {options.map((opt, oi) => {
                const coding = opt.valueCoding || {};
                const display = coding.display || coding.code || `Option ${oi + 1}`;
                return (
                  <FormControlLabel
                    key={oi}
                    value={JSON.stringify(coding)}
                    control={<Radio size="small" />}
                    label={display}
                    sx={{ ml: 0 }}
                  />
                );
              })}
            </RadioGroup>
          </FormControl>
        </Box>
      );
    }

    default:
      return (
        <Box>
          {label}
          <TextField
            fullWidth
            size="small"
            value={value || ''}
            onChange={e => onChange(linkId, e.target.value)}
            placeholder="Enter your answer"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
          />
        </Box>
      );
  }
};

export default QuestionnaireDialog;
