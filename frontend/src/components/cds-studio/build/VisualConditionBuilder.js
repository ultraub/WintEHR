/**
 * Visual Condition Builder
 * 
 * Drag-and-drop interface for building CDS conditions visually
 * 
 * @since 2025-01-27
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  Alert,
  Tooltip,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  alpha
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  Edit as EditIcon,
  Medication as MedicationIcon,
  Science as LabIcon,
  MonitorHeart as VitalIcon,
  LocalHospital as ConditionIcon,
  Person as PatientIcon,
  Event as AgeIcon,
  Wc as GenderIcon,
  Warning as AllergyIcon,
  Psychology as AIIcon,
  Category as GroupIcon,
  Code as LogicIcon
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

// Condition templates
const CONDITION_TEMPLATES = [
  {
    category: 'Patient Demographics',
    icon: <PatientIcon />,
    color: 'primary',
    conditions: [
      {
        id: 'age-over-65',
        name: 'Age Over 65',
        icon: <AgeIcon />,
        template: { type: 'age', operator: 'gte', value: 65 }
      },
      {
        id: 'age-under-18',
        name: 'Age Under 18',
        icon: <AgeIcon />,
        template: { type: 'age', operator: 'lt', value: 18 }
      },
      {
        id: 'gender-male',
        name: 'Male Patient',
        icon: <GenderIcon />,
        template: { type: 'gender', operator: 'equals', value: 'male' }
      },
      {
        id: 'gender-female',
        name: 'Female Patient',
        icon: <GenderIcon />,
        template: { type: 'gender', operator: 'equals', value: 'female' }
      }
    ]
  },
  {
    category: 'Medical Conditions',
    icon: <ConditionIcon />,
    color: 'error',
    conditions: [
      {
        id: 'has-diabetes',
        name: 'Has Diabetes',
        icon: <ConditionIcon />,
        template: { type: 'condition', operator: 'exists', conditionCode: 'E11.9' }
      },
      {
        id: 'has-hypertension',
        name: 'Has Hypertension',
        icon: <ConditionIcon />,
        template: { type: 'condition', operator: 'exists', conditionCode: 'I10' }
      },
      {
        id: 'chronic-condition',
        name: 'Any Chronic Condition',
        icon: <ConditionIcon />,
        template: { type: 'condition', operator: 'exists', chronic: true }
      }
    ]
  },
  {
    category: 'Medications',
    icon: <MedicationIcon />,
    color: 'secondary',
    conditions: [
      {
        id: 'on-medication',
        name: 'Taking Any Medication',
        icon: <MedicationIcon />,
        template: { type: 'medication', operator: 'taking_any' }
      },
      {
        id: 'on-anticoagulants',
        name: 'On Anticoagulants',
        icon: <MedicationIcon />,
        template: { type: 'medication', operator: 'taking_class', drugClass: 'anticoagulants' }
      },
      {
        id: 'polypharmacy',
        name: 'Polypharmacy (5+ meds)',
        icon: <MedicationIcon />,
        template: { type: 'medication', operator: 'count_gte', value: 5 }
      }
    ]
  },
  {
    category: 'Lab Values',
    icon: <LabIcon />,
    color: 'warning',
    conditions: [
      {
        id: 'high-glucose',
        name: 'High Blood Glucose',
        icon: <LabIcon />,
        template: { type: 'lab-value', operator: 'gt', labTest: '2339-0', value: 200 }
      },
      {
        id: 'low-hemoglobin',
        name: 'Low Hemoglobin',
        icon: <LabIcon />,
        template: { type: 'lab-value', operator: 'lt', labTest: '718-7', value: 12 }
      },
      {
        id: 'abnormal-lab',
        name: 'Any Abnormal Lab',
        icon: <LabIcon />,
        template: { type: 'lab-value', operator: 'abnormal' }
      }
    ]
  },
  {
    category: 'Vital Signs',
    icon: <VitalIcon />,
    color: 'info',
    conditions: [
      {
        id: 'high-bp',
        name: 'High Blood Pressure',
        icon: <VitalIcon />,
        template: { type: 'vital-sign', operator: 'gt', vitalType: 'bp-systolic', value: 140 }
      },
      {
        id: 'tachycardia',
        name: 'Tachycardia',
        icon: <VitalIcon />,
        template: { type: 'vital-sign', operator: 'gt', vitalType: 'heart-rate', value: 100 }
      },
      {
        id: 'fever',
        name: 'Fever',
        icon: <VitalIcon />,
        template: { type: 'vital-sign', operator: 'gt', vitalType: 'temperature', value: 38.3 }
      }
    ]
  },
  {
    category: 'Allergies',
    icon: <AllergyIcon />,
    color: 'error',
    conditions: [
      {
        id: 'drug-allergy',
        name: 'Has Drug Allergies',
        icon: <AllergyIcon />,
        template: { type: 'allergy', operator: 'exists', allergyType: 'medication' }
      },
      {
        id: 'food-allergy',
        name: 'Has Food Allergies',
        icon: <AllergyIcon />,
        template: { type: 'allergy', operator: 'exists', allergyType: 'food' }
      }
    ]
  }
];

// Logical operators
const LOGICAL_OPERATORS = [
  { id: 'and', name: 'AND', description: 'All conditions must be true' },
  { id: 'or', name: 'OR', description: 'Any condition must be true' },
  { id: 'and-not', name: 'AND NOT', description: 'Condition must be false' }
];

const VisualConditionBuilder = ({ conditions = [], onChange }) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [editingCondition, setEditingCondition] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  
  // Handle drag end
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const items = Array.from(conditions);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    onChange(items);
  };
  
  // Add condition from template
  const addConditionFromTemplate = (template) => {
    const newCondition = {
      ...template.template,
      id: `condition-${Date.now()}`,
      name: template.name,
      enabled: true
    };
    
    onChange([...conditions, newCondition]);
    setAnchorEl(null);
    setSelectedCategory(null);
  };
  
  // Add logical group
  const addLogicalGroup = (operator) => {
    const newGroup = {
      id: `group-${Date.now()}`,
      type: 'group',
      operator: operator,
      conditions: [],
      enabled: true
    };
    
    onChange([...conditions, newGroup]);
  };
  
  // Remove condition
  const removeCondition = (index) => {
    onChange(conditions.filter((_, i) => i !== index));
  };
  
  // Edit condition
  const editCondition = (index) => {
    setEditingCondition({ index, condition: conditions[index] });
  };
  
  // Update condition
  const updateCondition = (index, updatedCondition) => {
    const newConditions = [...conditions];
    newConditions[index] = updatedCondition;
    onChange(newConditions);
  };
  
  // Get condition display info
  const getConditionDisplay = (condition) => {
    if (condition.type === 'group') {
      return {
        icon: <GroupIcon />,
        title: `${condition.operator.toUpperCase()} Group`,
        description: `${condition.conditions?.length || 0} conditions`,
        color: 'default'
      };
    }
    
    // Find matching template
    for (const category of CONDITION_TEMPLATES) {
      const template = category.conditions.find(t => 
        t.template.type === condition.type &&
        t.template.operator === condition.operator
      );
      if (template) {
        return {
          icon: template.icon,
          title: condition.name || template.name,
          description: getConditionDescription(condition),
          color: category.color
        };
      }
    }
    
    // Default display
    return {
      icon: <LogicIcon />,
      title: condition.type || 'Custom Condition',
      description: getConditionDescription(condition),
      color: 'default'
    };
  };
  
  // Get condition description
  const getConditionDescription = (condition) => {
    const parts = [];
    
    if (condition.type) parts.push(condition.type);
    if (condition.operator) parts.push(condition.operator);
    if (condition.value !== undefined) parts.push(`value: ${condition.value}`);
    if (condition.labTest) parts.push(`lab: ${condition.labTest}`);
    if (condition.medication) parts.push(`med: ${condition.medication}`);
    
    return parts.join(' | ');
  };
  
  // Render condition card
  const renderConditionCard = (condition, index) => {
    const display = getConditionDisplay(condition);
    
    return (
      <Draggable key={condition.id} draggableId={condition.id} index={index}>
        {(provided, snapshot) => (
          <Card
            ref={provided.innerRef}
            {...provided.draggableProps}
            sx={{
              mb: 1,
              opacity: condition.enabled ? 1 : 0.5,
              transform: snapshot.isDragging ? 'rotate(2deg)' : 'none',
              boxShadow: snapshot.isDragging ? 6 : 1,
              bgcolor: snapshot.isDragging ? alpha(theme.palette.primary.main, 0.05) : 'background.paper'
            }}
          >
            <CardContent sx={{ py: 1.5 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box {...provided.dragHandleProps} sx={{ cursor: 'grab' }}>
                  <DragIcon color="action" />
                </Box>
                
                <Box color={`${display.color}.main`}>
                  {display.icon}
                </Box>
                
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="subtitle2">
                    {display.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {display.description}
                  </Typography>
                </Box>
                
                <IconButton size="small" onClick={() => editCondition(index)}>
                  <EditIcon fontSize="small" />
                </IconButton>
                
                <IconButton size="small" onClick={() => removeCondition(index)} color="error">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
              
              {condition.type === 'group' && condition.conditions?.length > 0 && (
                <Box sx={{ ml: 5, mt: 1 }}>
                  {condition.conditions.map((subCondition, subIndex) => (
                    <Chip
                      key={subIndex}
                      label={subCondition.name || subCondition.type}
                      size="small"
                      sx={{ mr: 0.5, mb: 0.5 }}
                    />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        )}
      </Draggable>
    );
  };
  
  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          Visual Condition Builder
        </Typography>
        
        <Stack direction="row" spacing={1}>
          <Tooltip title="AI-powered suggestions">
            <Button
              size="small"
              startIcon={<AIIcon />}
              variant="outlined"
              disabled
            >
              AI Suggest
            </Button>
          </Tooltip>
          
          <Button
            size="small"
            startIcon={<AddIcon />}
            variant="contained"
            onClick={(e) => setAnchorEl(e.currentTarget)}
          >
            Add Condition
          </Button>
        </Stack>
      </Stack>
      
      {/* Help text */}
      {conditions.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Click "Add Condition" to start building your rules. Drag conditions to reorder them.
          </Typography>
        </Alert>
      )}
      
      {/* Conditions list */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="conditions">
          {(provided, snapshot) => (
            <Box
              {...provided.droppableProps}
              ref={provided.innerRef}
              sx={{
                minHeight: 100,
                p: snapshot.isDraggingOver ? 1 : 0,
                bgcolor: snapshot.isDraggingOver ? alpha(theme.palette.primary.main, 0.05) : 'transparent',
                borderRadius: 1,
                transition: 'all 0.2s'
              }}
            >
              {conditions.map((condition, index) => renderConditionCard(condition, index))}
              {provided.placeholder}
            </Box>
          )}
        </Droppable>
      </DragDropContext>
      
      {/* Logical operators */}
      {conditions.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Logical Operators
          </Typography>
          <Stack direction="row" spacing={1}>
            {LOGICAL_OPERATORS.map((op) => (
              <Tooltip key={op.id} title={op.description}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => addLogicalGroup(op.id)}
                >
                  {op.name}
                </Button>
              </Tooltip>
            ))}
          </Stack>
        </Box>
      )}
      
      {/* Add condition menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl) && !selectedCategory}
        onClose={() => setAnchorEl(null)}
      >
        {CONDITION_TEMPLATES.map((category) => (
          <MenuItem
            key={category.category}
            onClick={() => setSelectedCategory(category)}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Box color={`${category.color}.main`}>
                {category.icon}
              </Box>
              <Typography>{category.category}</Typography>
            </Stack>
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={() => {
          setAnchorEl(null);
          setEditingCondition({ index: -1, condition: {} });
        }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <LogicIcon />
            <Typography>Custom Condition</Typography>
          </Stack>
        </MenuItem>
      </Menu>
      
      {/* Category submenu */}
      {selectedCategory && (
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl) && Boolean(selectedCategory)}
          onClose={() => {
            setAnchorEl(null);
            setSelectedCategory(null);
          }}
        >
          <MenuItem disabled>
            <Typography variant="subtitle2">{selectedCategory.category}</Typography>
          </MenuItem>
          <Divider />
          {selectedCategory.conditions.map((condition) => (
            <MenuItem
              key={condition.id}
              onClick={() => addConditionFromTemplate(condition)}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                {condition.icon}
                <Typography>{condition.name}</Typography>
              </Stack>
            </MenuItem>
          ))}
        </Menu>
      )}
      
      {/* Edit condition dialog */}
      <Dialog
        open={Boolean(editingCondition)}
        onClose={() => setEditingCondition(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingCondition?.index === -1 ? 'Add Custom Condition' : 'Edit Condition'}
        </DialogTitle>
        <DialogContent>
          {editingCondition && (
            <Box sx={{ pt: 2 }}>
              <Stack spacing={3}>
                <FormControl fullWidth>
                  <InputLabel>Condition Type</InputLabel>
                  <Select
                    value={editingCondition.condition.type || ''}
                    onChange={(e) => setEditingCondition({
                      ...editingCondition,
                      condition: { ...editingCondition.condition, type: e.target.value }
                    })}
                    label="Condition Type"
                  >
                    <MenuItem value="age">Age</MenuItem>
                    <MenuItem value="gender">Gender</MenuItem>
                    <MenuItem value="condition">Medical Condition</MenuItem>
                    <MenuItem value="medication">Medication</MenuItem>
                    <MenuItem value="lab-value">Lab Value</MenuItem>
                    <MenuItem value="vital-sign">Vital Sign</MenuItem>
                    <MenuItem value="allergy">Allergy</MenuItem>
                  </Select>
                </FormControl>
                
                <FormControl fullWidth>
                  <InputLabel>Operator</InputLabel>
                  <Select
                    value={editingCondition.condition.operator || ''}
                    onChange={(e) => setEditingCondition({
                      ...editingCondition,
                      condition: { ...editingCondition.condition, operator: e.target.value }
                    })}
                    label="Operator"
                  >
                    <MenuItem value="equals">Equals</MenuItem>
                    <MenuItem value="not_equals">Not Equals</MenuItem>
                    <MenuItem value="gt">Greater Than</MenuItem>
                    <MenuItem value="gte">Greater Than or Equal</MenuItem>
                    <MenuItem value="lt">Less Than</MenuItem>
                    <MenuItem value="lte">Less Than or Equal</MenuItem>
                    <MenuItem value="exists">Exists</MenuItem>
                    <MenuItem value="not_exists">Does Not Exist</MenuItem>
                  </Select>
                </FormControl>
                
                <TextField
                  fullWidth
                  label="Value"
                  value={editingCondition.condition.value || ''}
                  onChange={(e) => setEditingCondition({
                    ...editingCondition,
                    condition: { ...editingCondition.condition, value: e.target.value }
                  })}
                  disabled={
                    editingCondition.condition.operator === 'exists' || 
                    editingCondition.condition.operator === 'not_exists'
                  }
                />
                
                <Button
                  variant="contained"
                  onClick={() => {
                    if (editingCondition.index === -1) {
                      // Adding new condition
                      onChange([...conditions, {
                        ...editingCondition.condition,
                        id: `condition-${Date.now()}`,
                        enabled: true
                      }]);
                    } else {
                      // Updating existing condition
                      updateCondition(editingCondition.index, editingCondition.condition);
                    }
                    setEditingCondition(null);
                  }}
                >
                  {editingCondition.index === -1 ? 'Add' : 'Update'} Condition
                </Button>
              </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingCondition(null)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VisualConditionBuilder;