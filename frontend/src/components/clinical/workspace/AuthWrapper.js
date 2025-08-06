/**
 * Auth Wrapper for Demo Mode
 * This wrapper handles the auth context import issue for demo mode
 */
import React from 'react';

// Try to import from the real auth context, but provide a fallback
let useAuth;
try {
  // In normal mode, this will work
  const authModule = require('../../../contexts/AuthContext');
  useAuth = authModule.useAuth;
} catch (e) {
  // In demo mode or if there's an issue, use the mock
  const mockAuthModule = require('../MockAuthProvider');
  useAuth = mockAuthModule.useAuth;
}

export { useAuth };