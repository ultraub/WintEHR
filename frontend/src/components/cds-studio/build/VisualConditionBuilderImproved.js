/**
 * Visual Condition Builder - Improved cleaner interface
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
  FormControlLabel,
  Menu,
  ListItemIcon,
  ListItemText
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
  ContentCopy as DuplicateIcon,
  UnfoldMore as ExpandIcon,
  UnfoldLess as CollapseIcon,
  MoreVert as MoreIcon
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { v4 as uuidv4 } from 'uuid';
import LabValueConditionBuilder from './conditions/LabValueConditionBuilder';
import VitalSignConditionBuilder from './conditions/VitalSignConditionBuilder';
import MedicalConditionBuilder from './conditions/MedicalConditionBuilder';

// Simplified condition categories
const CONDITION_CATEGORIES = [
  {
    id: 'patient',
    label: 'Patient Demographics',
    icon: <PatientIcon />,
    color: '#2196F3',
    description: 'Age, gender, and other patient attributes'
  },
  {
    id: 'vitals',
    label: 'Vital Signs',
    icon: <VitalIcon />,
    color: '#F44336',
    description: 'Blood pressure, heart rate, temperature, etc.'
  },
  {
    id: 'laboratory',
    label: 'Lab Results',
    icon: <LabIcon />,
    color: '#FF9800',
    description: 'Blood tests, glucose, cholesterol, etc.'
  },
  {
    id: 'clinical',
    label: 'Clinical Conditions',
    icon: <ClinicalIcon />,
    color: '#4CAF50',
    description: 'Diagnoses, problems, and procedures'
  },
  {
    id: 'medications',
    label: 'Medications',
    icon: <MedIcon />,
    color: '#9C27B0',
    description: 'Current medications and allergies'
  }
];

// Simplified condition item component
const ConditionItem = ({ condition, index, onChange, onDelete, onDuplicate }) => {
  const [expanded, setExpanded] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleDuplicate = () => {
    onDuplicate();
    handleMenuClose();
  };

  const handleDelete = () => {
    onDelete();
    handleMenuClose();
  };

  // Render appropriate builder based on type
  const renderBuilder = () => {
    switch (condition.type) {
      case 'vital_sign':
        return (
          <VitalSignConditionBuilder
            condition={condition}
            onChange={onChange}
            onRemove={onDelete}
          />
        );
      case 'lab_value':
        return (
          <LabValueConditionBuilder
            condition={condition}
            onChange={onChange}
            onRemove={onDelete}
          />
        );
      case 'medical_condition':
        return (
          <MedicalConditionBuilder
            condition={condition}
            onChange={onChange}
            onRemove={onDelete}
          />
        );
      default:
        return (
          <Typography color="text.secondary">
            Select a condition type to continue
          </Typography>
        );
    }
  };

  return (
    <Draggable draggableId={String(condition.id)} index={index}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          sx={{
            mb: 2,
            border: 1,
            borderColor: snapshot.isDragging ? 'primary.main' : 'divider',
            boxShadow: snapshot.isDragging ? 4 : 1,
            transition: 'all 0.2s ease'
          }}
        >
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            {/* Header */}
            <Box display="flex" alignItems="center" mb={expanded ? 2 : 0}>
              <Box {...provided.dragHandleProps} sx={{ mr: 1, cursor: 'grab' }}>
                <DragIcon color="action" />
              </Box>
              
              <Box flex={1}>
                <Typography variant="subtitle2">
                  Condition {index + 1}
                  {condition.type && ` - ${condition.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`}
                </Typography>
              </Box>

              <Stack direction="row" spacing={0.5}>
                <IconButton 
                  size="small" 
                  onClick={() => setExpanded(!expanded)}
                  sx={{ p: 0.5 }}
                >
                  {expanded ? <CollapseIcon /> : <ExpandIcon />}
                </IconButton>
                <IconButton 
                  size="small" 
                  onClick={handleMenuOpen}
                  sx={{ p: 0.5 }}
                >
                  <MoreIcon />
                </IconButton>
              </Stack>

              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
              >
                <MenuItem onClick={handleDuplicate}>
                  <ListItemIcon>
                    <DuplicateIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Duplicate</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleDelete}>
                  <ListItemIcon>
                    <DeleteIcon fontSize="small" color="error" />
                  </ListItemIcon>
                  <ListItemText>Delete</ListItemText>
                </MenuItem>
              </Menu>
            </Box>

            {/* Content */}
            <Collapse in={expanded}>
              {renderBuilder()}
            </Collapse>
          </CardContent>
        </Card>
      )}
    </Draggable>
  );
};

// Main component
const VisualConditionBuilderImproved = ({ conditions = [], onChange }) => {
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [logicalOperator, setLogicalOperator] = useState('AND');

  // Handle drag end
  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(conditions);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    onChange(items);
  };

  // Add new condition
  const addCondition = (category) => {
    let type = '';
    if (category === 'vitals') type = 'vital_sign';
    else if (category === 'laboratory') type = 'lab_value';
    else if (category === 'clinical') type = 'medical_condition';
    
    const newCondition = {
      id: uuidv4(),
      type,
      category,
      operator: category === 'clinical' ? 'has' : 'gt',
      value: ''
    };

    onChange([...conditions, newCondition]);
    setShowCategoryMenu(false);
  };

  // Update condition
  const updateCondition = (index, updates) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    onChange(newConditions);
  };

  // Delete condition
  const deleteCondition = (index) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  // Duplicate condition
  const duplicateCondition = (index) => {
    const newCondition = {
      ...conditions[index],
      id: uuidv4()
    };
    const newConditions = [...conditions];
    newConditions.splice(index + 1, 0, newCondition);
    onChange(newConditions);
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h6">
            Trigger Conditions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Define when this hook should activate
          </Typography>
        </Box>
        
        {conditions.length > 1 && (
          <FormControl size="small">
            <Select
              value={logicalOperator}
              onChange={(e) => setLogicalOperator(e.target.value)}
              sx={{ minWidth: 100 }}
            >
              <MenuItem value="AND">All (AND)</MenuItem>
              <MenuItem value="OR">Any (OR)</MenuItem>
            </Select>
          </FormControl>
        )}
      </Box>

      {/* Conditions list */}
      {conditions.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderStyle: 'dashed' }}>
          <Typography color="text.secondary" gutterBottom>
            No conditions defined yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add conditions to control when this hook triggers
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={(e) => {
              setAnchorEl(e.currentTarget);
              setShowCategoryMenu(true);
            }}
          >
            Add First Condition
          </Button>
        </Paper>
      ) : (
        <>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="conditions">
              {(provided) => (
                <Box {...provided.droppableProps} ref={provided.innerRef}>
                  {conditions.map((condition, index) => (
                    <React.Fragment key={condition.id}>
                      {index > 0 && (
                        <Box display="flex" alignItems="center" justifyContent="center" my={1}>
                          <Chip 
                            label={logicalOperator} 
                            size="small" 
                            color="primary"
                            variant="outlined"
                          />
                        </Box>
                      )}
                      <ConditionItem
                        condition={condition}
                        index={index}
                        onChange={(updates) => updateCondition(index, updates)}
                        onDelete={() => deleteCondition(index)}
                        onDuplicate={() => duplicateCondition(index)}
                      />
                    </React.Fragment>
                  ))}
                  {provided.placeholder}
                </Box>
              )}
            </Droppable>
          </DragDropContext>

          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={(e) => {
              setAnchorEl(e.currentTarget);
              setShowCategoryMenu(true);
            }}
            fullWidth
            sx={{ mt: 2 }}
          >
            Add Another Condition
          </Button>
        </>
      )}

      {/* Category selection menu */}
      <Menu
        anchorEl={anchorEl}
        open={showCategoryMenu}
        onClose={() => {
          setShowCategoryMenu(false);
          setAnchorEl(null);
        }}
        PaperProps={{
          sx: { width: 320 }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Choose condition type:
          </Typography>
        </Box>
        <Divider />
        {CONDITION_CATEGORIES.map(category => (
          <MenuItem
            key={category.id}
            onClick={() => addCondition(category.id)}
            sx={{ py: 1.5 }}
          >
            <ListItemIcon>
              <Box sx={{ color: category.color }}>
                {category.icon}
              </Box>
            </ListItemIcon>
            <ListItemText
              primary={category.label}
              secondary={category.description}
            />
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

export default VisualConditionBuilderImproved;