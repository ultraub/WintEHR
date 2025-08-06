/**
 * CDS Learn Mode - Interactive tutorials for learning CDS Hooks
 */

import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Alert
} from '@mui/material';
import {
  School as LearnIcon,
  PlayArrow as StartIcon
} from '@mui/icons-material';

const CDSLearnMode = () => {
  const tutorials = [
    {
      id: 'basics',
      title: 'CDS Hooks Basics',
      description: 'Learn the fundamentals of Clinical Decision Support',
      duration: '15 min',
      level: 'Beginner'
    },
    {
      id: 'conditions',
      title: 'Building Conditions',
      description: 'Master condition logic and triggers',
      duration: '20 min',
      level: 'Intermediate'
    },
    {
      id: 'cards',
      title: 'Designing Effective Cards',
      description: 'Create actionable decision support cards',
      duration: '25 min',
      level: 'Intermediate'
    },
    {
      id: 'advanced',
      title: 'Advanced Techniques',
      description: 'Complex hooks and optimization strategies',
      duration: '30 min',
      level: 'Advanced'
    }
  ];

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Welcome to CDS Learn Mode!
        </Typography>
        <Typography variant="body2">
          Choose a tutorial below to start learning about Clinical Decision Support Hooks.
          Each tutorial includes interactive examples and hands-on exercises.
        </Typography>
      </Alert>

      <Grid container spacing={3}>
        {tutorials.map(tutorial => (
          <Grid item xs={12} md={6} key={tutorial.id}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {tutorial.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {tutorial.description}
                </Typography>
                <Box display="flex" gap={1}>
                  <Chip label={tutorial.duration} size="small" />
                  <Chip 
                    label={tutorial.level} 
                    size="small"
                    color={
                      tutorial.level === 'Beginner' ? 'success' :
                      tutorial.level === 'Intermediate' ? 'warning' : 'error'
                    }
                  />
                </Box>
              </CardContent>
              <CardActions>
                <Button size="small" startIcon={<StartIcon />}>
                  Start Tutorial
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default CDSLearnMode;