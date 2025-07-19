/**
 * Mock Auth Provider for Demo Mode
 * Provides a mock authentication context for testing without real authentication
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';

// Create a mock AuthContext that matches the real one
export const AuthContext = React.createContext();

// Mock user for testing
const mockUser = {
  id: 'demo-user',
  name: 'Demo User',
  email: 'demo@example.com',
  role: 'Physician',
  username: 'demo'
};

// Export the useAuth hook that components expect
export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Mock auth context provider
export const MockAuthProvider = ({ children }) => {
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

export default MockAuthProvider;