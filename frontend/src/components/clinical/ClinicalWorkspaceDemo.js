/**
 * ClinicalWorkspaceDemo Component
 * Temporary component for testing the enhanced clinical workspace without authentication
 */
import React from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import EnhancedClinicalLayout from './layouts/EnhancedClinicalLayout';
import ClinicalWorkspaceEnhanced from './ClinicalWorkspaceEnhanced';
import { AuthContext } from '../../contexts/AuthContext';

// Mock user for testing
const mockUser = {
  id: 'demo-user',
  name: 'Demo User',
  email: 'demo@example.com',
  role: 'Physician',
  username: 'demo'
};

// Mock auth context provider
const MockAuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = React.useState(false);
  
  // Create a mock auth context value that matches the real AuthContext interface
  const mockAuthValue = {
    currentUser: mockUser,
    user: mockUser,
    isAuthenticated: true,
    isDarkMode,
    toggleTheme: () => setIsDarkMode(!isDarkMode),
    login: () => Promise.resolve(),
    logout: () => navigate('/login'),
    loading: false,
    error: null,
    refreshToken: () => Promise.resolve(),
    checkSession: () => Promise.resolve()
  };

  return (
    <AuthContext.Provider value={mockAuthValue}>
      {children}
    </AuthContext.Provider>
  );
};

const ClinicalWorkspaceDemo = () => {
  return (
    <MockAuthProvider>
      <Box sx={{ height: '100vh', overflow: 'hidden' }}>
        <Alert severity="warning" sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
          <Typography variant="body2">
            Demo Mode: This is a temporary view for testing the enhanced clinical workspace UI. 
            Authentication is bypassed.
          </Typography>
        </Alert>
        
        <Box sx={{ mt: 6, height: 'calc(100vh - 48px)' }}>
          <EnhancedClinicalLayout>
            <ClinicalWorkspaceEnhanced />
          </EnhancedClinicalLayout>
        </Box>
      </Box>
    </MockAuthProvider>
  );
};

export default ClinicalWorkspaceDemo;