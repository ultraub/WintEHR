/**
 * Hook Preview - Live preview of how the CDS hook will appear and function
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  Paper,
  Chip,
  Stack,
  Divider,
  Alert,
  Button,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid
} from '@mui/material';
import {
  Visibility as PreviewIcon,
  Code as CodeIcon,
  Description as DocsIcon,
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  ContentCopy as CopyIcon,
  Lightbulb as SuggestionIcon,
  Link as LinkIcon,
  Person as PersonIcon,
  LocalHospital as HospitalIcon,
  Science as LabIcon,
  Medication as MedIcon,
  FavoriteBorder as VitalIcon,
  CalendarToday as TimeIcon
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';

SyntaxHighlighter.registerLanguage('json', json);

// Condition field icons
const CONDITION_ICONS = {
  age: <PersonIcon />,
  gender: <PersonIcon />,
  pregnant: <PersonIcon />,
  has_condition: <HospitalIcon />,
  active_problem: <HospitalIcon />,
  lab_result: <LabIcon />,
  hba1c: <LabIcon />,
  active_medication: <MedIcon />,
  medication_class: <MedIcon />,
  blood_pressure_systolic: <VitalIcon />,
  heart_rate: <VitalIcon />,
  days_since: <TimeIcon />
};

// Card indicator configurations
const CARD_INDICATORS = {
  info: { icon: <InfoIcon />, color: 'info' },
  warning: { icon: <WarningIcon />, color: 'warning' },
  critical: { icon: <ErrorIcon />, color: 'error' },
  success: { icon: <SuccessIcon />, color: 'success' }
};

const HookPreview = ({ hook }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [expandedCards, setExpandedCards] = useState(new Set([0]));

  // Generate hook definition for code view
  const generateHookDefinition = () => {
    const definition = {
      id: hook.id || 'generated-hook-id',
      title: hook.title,
      description: hook.description,
      hook: hook.hook,
      prefetch: hook.prefetch || {},
      _meta: {
        version: hook._meta?.version || 1,
        created: hook._meta?.created,
        modified: hook._meta?.modified,
        author: hook._meta?.author
      }
    };

    // Transform conditions to backend format
    if (hook.conditions && hook.conditions.length > 0) {
      definition.conditions = transformConditions(hook.conditions);
    }

    // Transform cards
    if (hook.cards && hook.cards.length > 0) {
      definition.cards = hook.cards.map(card => ({
        uuid: card.id,
        summary: card.summary,
        detail: card.detail,
        indicator: card.indicator,
        source: card.source,
        suggestions: card.suggestions,
        links: card.links,
        selectionBehavior: card.selectionBehavior,
        overrideReasons: card.overrideReasons
      }));
    }

    return definition;
  };

  // Transform nested conditions to backend format
  const transformConditions = (conditions, operator = 'AND') => {
    // Handle root level conditions
    if (!conditions || conditions.length === 0) return [];

    const result = [];
    let currentGroup = [];

    conditions.forEach((condition, index) => {
      if (condition.type === 'group') {
        // Handle nested group
        if (currentGroup.length > 0) {
          result.push(currentGroup.length === 1 ? currentGroup[0] : {
            operator: operator,
            conditions: currentGroup
          });
          currentGroup = [];
        }
        result.push(transformConditions(condition.conditions, condition.operator)[0]);
      } else {
        // Regular condition
        currentGroup.push({
          field: condition.field,
          operator: condition.operator,
          value: condition.value
        });
      }
    });

    if (currentGroup.length > 0) {
      result.push(currentGroup.length === 1 ? currentGroup[0] : {
        operator: operator,
        conditions: currentGroup
      });
    }

    return result;
  };

  // Copy JSON to clipboard
  const copyToClipboard = () => {
    const definition = generateHookDefinition();
    navigator.clipboard.writeText(JSON.stringify(definition, null, 2));
  };

  // Render condition preview
  const renderCondition = (condition, level = 0) => {
    if (condition.type === 'group') {
      return (
        <Box sx={{ ml: level * 2, mb: 1 }}>
          <Chip label={condition.operator} size="small" sx={{ mb: 1 }} />
          {condition.conditions.map((cond, index) => (
            <Box key={index}>
              {renderCondition(cond, level + 1)}
            </Box>
          ))}
        </Box>
      );
    }

    const icon = CONDITION_ICONS[condition.field] || <InfoIcon />;
    
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: level * 2, mb: 1 }}>
        {icon}
        <Typography variant="body2">
          <strong>{condition.field}</strong> {condition.operator} {condition.value}
        </Typography>
      </Box>
    );
  };

  // Toggle card expansion
  const toggleCardExpansion = (index) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedCards(newExpanded);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Hook Preview
      </Typography>

      <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 2 }}>
        <Tab icon={<PreviewIcon />} label="Card Preview" />
        <Tab icon={<CodeIcon />} label="JSON Definition" />
        <Tab icon={<DocsIcon />} label="Documentation" />
      </Tabs>

      {/* Card Preview Tab */}
      {activeTab === 0 && (
        <Box>
          {/* Hook Info */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {hook.title || 'Untitled Hook'}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                {hook.description || 'No description provided'}
              </Typography>
              
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip 
                  label={hook.hook || 'Hook Type'} 
                  size="small" 
                  color="primary" 
                />
                {hook.tags?.map((tag, index) => (
                  <Chip key={index} label={tag} size="small" />
                ))}
              </Stack>
            </CardContent>
          </Card>

          {/* Trigger Conditions */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">
                Trigger Conditions ({hook.conditions?.length || 0})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              {hook.conditions && hook.conditions.length > 0 ? (
                <Box>
                  {hook.conditions.map((condition, index) => (
                    <Box key={index}>
                      {renderCondition(condition)}
                    </Box>
                  ))}
                </Box>
              ) : (
                <Alert severity="warning">
                  No conditions defined - this hook will trigger for all {hook.hook} events
                </Alert>
              )}
            </AccordionDetails>
          </Accordion>

          {/* Decision Cards */}
          <Typography variant="subtitle1" sx={{ mt: 3, mb: 2 }}>
            Decision Cards ({hook.cards?.length || 0})
          </Typography>
          
          {hook.cards && hook.cards.length > 0 ? (
            hook.cards.map((card, index) => {
              const indicator = CARD_INDICATORS[card.indicator] || CARD_INDICATORS.info;
              const isExpanded = expandedCards.has(index);
              
              return (
                <Card key={card.id} sx={{ mb: 2 }}>
                  <CardContent>
                    <Box 
                      display="flex" 
                      alignItems="center" 
                      gap={1} 
                      onClick={() => toggleCardExpansion(index)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <Box color={`${indicator.color}.main`}>
                        {indicator.icon}
                      </Box>
                      <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                        {card.summary}
                      </Typography>
                      <IconButton size="small">
                        <ExpandMoreIcon 
                          sx={{ 
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s'
                          }} 
                        />
                      </IconButton>
                    </Box>
                    
                    {card.source?.label && (
                      <Typography variant="caption" color="text.secondary">
                        Source: {card.source.label}
                      </Typography>
                    )}
                    
                    {isExpanded && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        
                        <Box sx={{ '& p': { margin: 0 } }}>
                          <ReactMarkdown>
                            {card.detail || 'No detail provided'}
                          </ReactMarkdown>
                        </Box>
                        
                        {card.suggestions && card.suggestions.length > 0 && (
                          <Box mt={2}>
                            <Typography variant="subtitle2" gutterBottom>
                              Suggestions:
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              {card.suggestions.map((suggestion, idx) => (
                                <Button
                                  key={idx}
                                  variant="outlined"
                                  size="small"
                                  startIcon={<SuggestionIcon />}
                                >
                                  {suggestion.label}
                                </Button>
                              ))}
                            </Stack>
                          </Box>
                        )}
                        
                        {card.links && card.links.length > 0 && (
                          <Box mt={2}>
                            <Typography variant="subtitle2" gutterBottom>
                              Links:
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              {card.links.map((link, idx) => (
                                <Button
                                  key={idx}
                                  size="small"
                                  startIcon={<LinkIcon />}
                                  href={link.url}
                                  target="_blank"
                                >
                                  {link.label}
                                </Button>
                              ))}
                            </Stack>
                          </Box>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Alert severity="error">
              No cards defined - at least one card is required
            </Alert>
          )}
        </Box>
      )}

      {/* JSON Definition Tab */}
      {activeTab === 1 && (
        <Box>
          <Box display="flex" justifyContent="flex-end" mb={1}>
            <Tooltip title="Copy to clipboard">
              <IconButton onClick={copyToClipboard} size="small">
                <CopyIcon />
              </IconButton>
            </Tooltip>
          </Box>
          
          <Paper variant="outlined" sx={{ overflow: 'auto' }}>
            <SyntaxHighlighter
              language="json"
              style={docco}
              customStyle={{ margin: 0, padding: 16 }}
            >
              {JSON.stringify(generateHookDefinition(), null, 2)}
            </SyntaxHighlighter>
          </Paper>
        </Box>
      )}

      {/* Documentation Tab */}
      {activeTab === 2 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Auto-Generated Documentation
          </Typography>
          
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              {hook.title || 'Untitled Hook'}
            </Typography>
            
            <Typography variant="body1" paragraph>
              {hook.description || 'No description provided'}
            </Typography>
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="h6" gutterBottom>
              Technical Details
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2">Hook Type</Typography>
                <Typography variant="body2" paragraph>
                  {hook.hook}
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2">Version</Typography>
                <Typography variant="body2" paragraph>
                  {hook._meta?.version || 1}
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle2">Trigger Conditions</Typography>
                <List dense>
                  {hook.conditions?.map((condition, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={`${condition.field} ${condition.operator} ${condition.value}`}
                      />
                    </ListItem>
                  )) || <ListItem><ListItemText primary="No conditions (always triggers)" /></ListItem>}
                </List>
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle2">Decision Cards</Typography>
                <List dense>
                  {hook.cards?.map((card, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        {CARD_INDICATORS[card.indicator]?.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={card.summary}
                        secondary={`Severity: ${card.indicator}`}
                      />
                    </ListItem>
                  )) || <ListItem><ListItemText primary="No cards defined" /></ListItem>}
                </List>
              </Grid>
            </Grid>
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="body2" color="text.secondary">
              Created: {new Date(hook._meta?.created || Date.now()).toLocaleString()}<br />
              Modified: {new Date(hook._meta?.modified || Date.now()).toLocaleString()}<br />
              Author: {hook._meta?.author || 'Unknown'}
            </Typography>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default HookPreview;