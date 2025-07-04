import React from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper
} from '@mui/material';
import {
  Error as ErrorIcon,
  Home as HomeIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';

const NotFound = () => {
  const navigate = useNavigate();
  const theme = useTheme();

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 8, textAlign: 'center' }}>
        <Paper 
          elevation={3}
          sx={{ 
            p: 6,
            background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.grey[50]} 100%)`,
            borderRadius: 3
          }}
        >
          <ErrorIcon 
            sx={{ 
              fontSize: 100, 
              color: theme.palette.error.light,
              mb: 3,
              opacity: 0.8
            }} 
          />
          
          <Typography 
            variant="h1" 
            sx={{ 
              fontSize: '6rem',
              fontWeight: 700,
              color: theme.palette.error.main,
              mb: 2
            }}
          >
            404
          </Typography>
          
          <Typography 
            variant="h4" 
            gutterBottom 
            sx={{ 
              fontWeight: 600,
              color: theme.palette.text.primary,
              mb: 2
            }}
          >
            Page Not Found
          </Typography>
          
          <Typography 
            variant="h6" 
            color="textSecondary" 
            sx={{ mb: 4, maxWidth: 500, mx: 'auto' }}
          >
            The page you're looking for doesn't exist or may have been moved. 
            Please check the URL or navigate back to a known page.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(-1)}
              sx={{ borderRadius: 2 }}
            >
              Go Back
            </Button>
            <Button
              variant="contained"
              startIcon={<HomeIcon />}
              onClick={() => navigate('/dashboard')}
              sx={{ borderRadius: 2 }}
            >
              Go to Dashboard
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default NotFound;