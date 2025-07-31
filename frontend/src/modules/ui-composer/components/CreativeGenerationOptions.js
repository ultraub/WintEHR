/**
 * Creative Generation Options Component
 * Allows users to choose between fully generated or mixed components
 */

import React from 'react';
import {
  Box,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Typography,
  Chip,
  Alert,
  Tooltip,
  Stack
} from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  Merge as MergeIcon,
  Extension as ExtensionIcon,
  Speed as SpeedIcon
} from '@mui/icons-material';

const CreativeGenerationOptions = ({ value, onChange, disabled }) => {
  const options = [
    {
      value: 'full',
      label: 'Full Generation',
      description: 'Generate all components from scratch using AI',
      icon: <AutoAwesomeIcon />,
      benefits: ['Maximum creativity', 'Unique designs', 'Tailored to request'],
      drawbacks: ['Slower generation', 'Higher API cost'],
      recommended: 'For new features or unique interfaces'
    },
    {
      value: 'mixed',
      label: 'Smart Mix',
      description: 'Combine existing WintEHR components with AI-generated parts',
      icon: <MergeIcon />,
      benefits: ['Faster generation', 'Consistent with app', 'Lower cost'],
      drawbacks: ['Less creative freedom'],
      recommended: 'For standard clinical workflows'
    },
    {
      value: 'template',
      label: 'Template-Based',
      description: 'Use existing templates with AI customization',
      icon: <ExtensionIcon />,
      benefits: ['Fastest option', 'Minimal cost', 'Proven patterns'],
      drawbacks: ['Limited customization'],
      recommended: 'For common UI patterns'
    }
  ];

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <Box>
      <FormControl component="fieldset" fullWidth>
        <FormLabel component="legend" sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            Generation Mode
          </Typography>
        </FormLabel>
        
        <RadioGroup
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          <Stack spacing={2}>
            {options.map((option) => (
              <Box
                key={option.value}
                sx={{
                  border: 1,
                  borderColor: value === option.value ? 'primary.main' : 'divider',
                  borderRadius: 2,
                  p: 2,
                  bgcolor: value === option.value ? 'action.selected' : 'background.paper',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: 'primary.light',
                    bgcolor: 'action.hover'
                  }
                }}
              >
                <FormControlLabel
                  value={option.value}
                  control={<Radio />}
                  label={
                    <Box sx={{ ml: 1 }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        {option.icon}
                        <Typography variant="subtitle2" fontWeight="bold">
                          {option.label}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {option.description}
                      </Typography>
                      
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        {option.benefits.map((benefit, idx) => (
                          <Tooltip key={idx} title={benefit}>
                            <Chip
                              size="small"
                              label={benefit}
                              color="success"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem' }}
                            />
                          </Tooltip>
                        ))}
                      </Stack>
                      
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        <strong>Best for:</strong> {option.recommended}
                      </Typography>
                    </Box>
                  }
                  sx={{ width: '100%', m: 0 }}
                />
              </Box>
            ))}
          </Stack>
        </RadioGroup>
      </FormControl>

      {selectedOption && (
        <Alert 
          severity="info" 
          icon={<SpeedIcon />}
          sx={{ mt: 2 }}
        >
          <Typography variant="body2">
            <strong>{selectedOption.label} mode:</strong> {selectedOption.description}
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

export default CreativeGenerationOptions;