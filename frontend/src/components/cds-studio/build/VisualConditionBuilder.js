/**
 * Visual Condition Builder - Drag and drop interface for building CDS conditions
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  IconButton,
  Button,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
  Divider,
  Alert,
  Stack,
  Collapse,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  AccountCircle as PatientIcon,
  LocalHospital as ClinicalIcon,
  Science as LabIcon,
  Medication as MedIcon,
  FavoriteBorder as VitalIcon,
  CalendarToday as TimeIcon,
  Settings as CustomIcon,
  ContentCopy as DuplicateIcon,
  UnfoldMore as ExpandIcon,
  UnfoldLess as CollapseIcon
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { v4 as uuidv4 } from 'uuid';

// Condition field definitions
const CONDITION_FIELDS = {
  patient: {
    label: 'Patient',
    icon: <PatientIcon />,
    color: '#2196F3',
    fields: [
      { id: 'age', label: 'Age', type: 'number', operators: ['=', '!=', '>', '<', '>=', '<='] },
      { id: 'gender', label: 'Gender', type: 'select', options: ['male', 'female', 'other'], operators: ['=', '!='] },
      { id: 'pregnant', label: 'Is Pregnant', type: 'boolean', operators: ['='] },
      { id: 'weight', label: 'Weight (kg)', type: 'number', operators: ['=', '!=', '>', '<', '>=', '<='] },
      { id: 'height', label: 'Height (cm)', type: 'number', operators: ['=', '!=', '>', '<', '>=', '<='] },
      { id: 'bmi', label: 'BMI', type: 'number', operators: ['=', '!=', '>', '<', '>=', '<='] }
    ]
  },
  clinical: {
    label: 'Clinical',
    icon: <ClinicalIcon />,
    color: '#4CAF50',
    fields: [
      { id: 'has_condition', label: 'Has Condition', type: 'condition_search', operators: ['contains', 'not contains'] },
      { id: 'active_problem', label: 'Active Problem', type: 'condition_search', operators: ['contains', 'not contains'] },
      { id: 'allergy', label: 'Has Allergy', type: 'allergy_search', operators: ['contains', 'not contains'] },
      { id: 'procedure_history', label: 'Had Procedure', type: 'procedure_search', operators: ['contains', 'not contains'] }
    ]
  },
  laboratory: {
    label: 'Laboratory',
    icon: <LabIcon />,
    color: '#FF9800',
    fields: [
      { id: 'lab_result', label: 'Lab Result', type: 'lab_value', operators: ['=', '!=', '>', '<', '>=', '<='] },
      { id: 'hba1c', label: 'HbA1c (%)', type: 'number', operators: ['=', '!=', '>', '<', '>=', '<='] },
      { id: 'glucose', label: 'Glucose (mg/dL)', type: 'number', operators: ['=', '!=', '>', '<', '>=', '<='] },
      { id: 'cholesterol', label: 'Cholesterol (mg/dL)', type: 'number', operators: ['=', '!=', '>', '<', '>=', '<='] },
      { id: 'creatinine', label: 'Creatinine (mg/dL)', type: 'number', operators: ['=', '!=', '>', '<', '>=', '<='] }
    ]
  },
  medications: {
    label: 'Medications',
    icon: <MedIcon />,
    color: '#9C27B0',
    fields: [
      { id: 'active_medication', label: 'Taking Medication', type: 'medication_search', operators: ['contains', 'not contains'] },
      { id: 'medication_class', label: 'Medication Class', type: 'medication_class', operators: ['contains', 'not contains'] },
      { id: 'drug_interaction', label: 'Has Interaction', type: 'boolean', operators: ['='] },
      { id: 'adherence_rate', label: 'Adherence Rate (%)', type: 'number', operators: ['=', '!=', '>', '<', '>=', '<='] }
    ]
  },
  vitals: {
    label: 'Vital Signs',
    icon: <VitalIcon />,
    color: '#F44336',
    fields: [
      { id: 'blood_pressure_systolic', label: 'Systolic BP (mmHg)', type: 'number', operators: ['=', '!=', '>', '<', '>=', '<='] },
      { id: 'blood_pressure_diastolic', label: 'Diastolic BP (mmHg)', type: 'number', operators: ['=', '!=', '>', '<', '>=', '<='] },
      { id: 'heart_rate', label: 'Heart Rate (bpm)', type: 'number', operators: ['=', '!=', '>', '<', '>=', '<='] },
      { id: 'temperature', label: 'Temperature (°C)', type: 'number', operators: ['=', '!=', '>', '<', '>=', '<='] },
      { id: 'oxygen_saturation', label: 'O2 Saturation (%)', type: 'number', operators: ['=', '!=', '>', '<', '>=', '<='] }
    ]
  },
  temporal: {
    label: 'Time-based',
    icon: <TimeIcon />,
    color: '#00BCD4',
    fields: [
      { id: 'days_since', label: 'Days Since', type: 'temporal', operators: ['>', '<', '>=', '<='] },
      { id: 'time_of_day', label: 'Time of Day', type: 'time_range', operators: ['between', 'not between'] },
      { id: 'day_of_week', label: 'Day of Week', type: 'select', options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], operators: ['=', '!='] }
    ]
  }
};

// Logical operators
const LOGICAL_OPERATORS = ['AND', 'OR'];

// Condition component
const ConditionItem = ({ condition, index, onChange, onDelete, onDuplicate }) => {
  const [expanded, setExpanded] = useState(true);
  const category = Object.values(CONDITION_FIELDS).find(cat => 
    cat.fields.some(f => f.id === condition.field)
  );
  const fieldDef = category?.fields.find(f => f.id === condition.field);

  const handleFieldChange = (field) => {
    const newCategory = Object.values(CONDITION_FIELDS).find(cat => 
      cat.fields.some(f => f.id === field)
    );
    const newFieldDef = newCategory?.fields.find(f => f.id === field);
    
    onChange({
      ...condition,
      field,
      operator: newFieldDef?.operators[0] || '=',
      value: ''
    });
  };

  const renderValueInput = () => {
    if (!fieldDef) return null;

    switch (fieldDef.type) {
      case 'number':
        return (
          <TextField
            type="number"
            value={condition.value || ''}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
            size="small"
            fullWidth
            placeholder="Enter value"
          />
        );
      
      case 'boolean':
        return (
          <Select
            value={condition.value || true}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
            size="small"
            fullWidth
          >
            <MenuItem value={true}>Yes</MenuItem>
            <MenuItem value={false}>No</MenuItem>
          </Select>
        );
      
      case 'select':
        return (
          <Select
            value={condition.value || ''}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
            size="small"
            fullWidth
          >
            {fieldDef.options?.map(option => (
              <MenuItem key={option} value={option}>{option}</MenuItem>
            ))}
          </Select>
        );
      
      case 'condition_search':
      case 'medication_search':
      case 'allergy_search':
      case 'procedure_search':
        return (
          <TextField
            value={condition.value || ''}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
            size="small"
            fullWidth
            placeholder={`Search ${fieldDef.type.replace('_search', '')}...`}
            helperText="Start typing to search"
          />
        );
      
      default:
        return (
          <TextField
            value={condition.value || ''}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
            size="small"
            fullWidth
            placeholder="Enter value"
          />
        );
    }
  };

  return (
    <Draggable draggableId={condition.id} index={index}>
      {(provided, snapshot) => (
        <Paper
          ref={provided.innerRef}
          {...provided.draggableProps}
          sx={{
            p: 2,
            mb: 2,
            backgroundColor: snapshot.isDragging ? 'action.hover' : 'background.paper',
            border: '1px solid',
            borderColor: category?.color || 'divider'
          }}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <Box {...provided.dragHandleProps}>
                <DragIcon color="action" />
              </Box>
            </Grid>
            
            <Grid item xs>
              <Stack spacing={2}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box display="flex" alignItems="center" gap={1}>
                    {category && (
                      <Chip
                        icon={category.icon}
                        label={category.label}
                        size="small"
                        sx={{ backgroundColor: category.color, color: 'white' }}
                      />
                    )}
                    <Typography variant="subtitle2">
                      Condition {index + 1}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                      {expanded ? <CollapseIcon /> : <ExpandIcon />}
                    </IconButton>
                    <Tooltip title="Duplicate">
                      <IconButton size="small" onClick={onDuplicate}>
                        <DuplicateIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={onDelete} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                <Collapse in={expanded}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Field</InputLabel>
                        <Select
                          value={condition.field || ''}
                          onChange={(e) => handleFieldChange(e.target.value)}
                          label="Field"
                        >
                          {Object.entries(CONDITION_FIELDS).map(([catKey, category]) => (
                            <MenuItem key={catKey} disabled>
                              <Typography variant="overline">{category.label}</Typography>
                            </MenuItem>
                          ))}
                          {Object.entries(CONDITION_FIELDS).map(([catKey, category]) => 
                            category.fields.map(field => (
                              <MenuItem key={field.id} value={field.id} sx={{ pl: 4 }}>
                                {field.label}
                              </MenuItem>
                            ))
                          )}
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    <Grid item xs={12} md={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Operator</InputLabel>
                        <Select
                          value={condition.operator || '='}
                          onChange={(e) => onChange({ ...condition, operator: e.target.value })}
                          label="Operator"
                        >
                          {fieldDef?.operators.map(op => (
                            <MenuItem key={op} value={op}>{op}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    <Grid item xs={12} md={5}>
                      {renderValueInput()}
                    </Grid>
                  </Grid>
                </Collapse>
              </Stack>
            </Grid>
          </Grid>
        </Paper>
      )}
    </Draggable>
  );
};

// Condition Group component
const ConditionGroup = ({ group, onChange, onDelete, level = 0 }) => {
  const addCondition = () => {
    const newCondition = {
      id: uuidv4(),
      field: '',
      operator: '=',
      value: ''
    };
    onChange({
      ...group,
      conditions: [...group.conditions, newCondition]
    });
  };

  const addGroup = () => {
    const newGroup = {
      id: uuidv4(),
      type: 'group',
      operator: 'AND',
      conditions: []
    };
    onChange({
      ...group,
      conditions: [...group.conditions, newGroup]
    });
  };

  const updateCondition = (index, updates) => {
    const newConditions = [...group.conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    onChange({ ...group, conditions: newConditions });
  };

  const deleteCondition = (index) => {
    const newConditions = group.conditions.filter((_, i) => i !== index);
    onChange({ ...group, conditions: newConditions });
  };

  const duplicateCondition = (index) => {
    const conditionToDupe = group.conditions[index];
    const newCondition = {
      ...conditionToDupe,
      id: uuidv4()
    };
    const newConditions = [...group.conditions];
    newConditions.splice(index + 1, 0, newCondition);
    onChange({ ...group, conditions: newConditions });
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(group.conditions);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    onChange({ ...group, conditions: items });
  };

  return (
    <Box
      sx={{
        border: '2px dashed',
        borderColor: 'divider',
        borderRadius: 2,
        p: 2,
        ml: level * 4,
        backgroundColor: level % 2 === 0 ? 'grey.50' : 'grey.100'
      }}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="subtitle1" fontWeight="bold">
            {level === 0 ? 'Conditions' : 'Nested Group'}
          </Typography>
          
          {group.conditions.length > 1 && (
            <FormControl size="small">
              <Select
                value={group.operator}
                onChange={(e) => onChange({ ...group, operator: e.target.value })}
              >
                {LOGICAL_OPERATORS.map(op => (
                  <MenuItem key={op} value={op}>{op}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>

        <Box>
          {level > 0 && (
            <Tooltip title="Delete Group">
              <IconButton size="small" onClick={onDelete} color="error">
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId={group.id}>
          {(provided) => (
            <Box ref={provided.innerRef} {...provided.droppableProps}>
              {group.conditions.map((condition, index) => (
                <Box key={condition.id}>
                  {condition.type === 'group' ? (
                    <ConditionGroup
                      group={condition}
                      onChange={(updates) => updateCondition(index, updates)}
                      onDelete={() => deleteCondition(index)}
                      level={level + 1}
                    />
                  ) : (
                    <ConditionItem
                      condition={condition}
                      index={index}
                      onChange={(updates) => updateCondition(index, updates)}
                      onDelete={() => deleteCondition(index)}
                      onDuplicate={() => duplicateCondition(index)}
                    />
                  )}
                  
                  {index < group.conditions.length - 1 && (
                    <Box textAlign="center" my={1}>
                      <Chip label={group.operator} size="small" />
                    </Box>
                  )}
                </Box>
              ))}
              {provided.placeholder}
            </Box>
          )}
        </Droppable>
      </DragDropContext>

      <Stack direction="row" spacing={2} mt={2}>
        <Button
          startIcon={<AddIcon />}
          onClick={addCondition}
          variant="outlined"
          size="small"
        >
          Add Condition
        </Button>
        
        {level < 2 && (
          <Button
            startIcon={<AddIcon />}
            onClick={addGroup}
            variant="outlined"
            size="small"
          >
            Add Nested Group
          </Button>
        )}
      </Stack>
    </Box>
  );
};

// Main Visual Condition Builder component
const VisualConditionBuilder = ({ conditions, onChange }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Initialize with a root group if empty
  const rootGroup = conditions.length === 0 ? {
    id: 'root',
    type: 'group',
    operator: 'AND',
    conditions: []
  } : {
    id: 'root',
    type: 'group',
    operator: 'AND',
    conditions: conditions
  };

  const handleGroupChange = (updates) => {
    onChange(updates.conditions);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Trigger Conditions</Typography>
        <FormControlLabel
          control={
            <Switch
              checked={showAdvanced}
              onChange={(e) => setShowAdvanced(e.target.checked)}
            />
          }
          label="Advanced Mode"
        />
      </Box>

      {showAdvanced && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Advanced mode allows you to create nested condition groups with complex AND/OR logic.
            Drag conditions to reorder them.
          </Typography>
        </Alert>
      )}

      <ConditionGroup
        group={rootGroup}
        onChange={handleGroupChange}
        level={0}
      />

      {conditions.length === 0 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          No conditions defined. This hook will trigger for all patients.
        </Alert>
      )}
    </Box>
  );
};

export default VisualConditionBuilder;