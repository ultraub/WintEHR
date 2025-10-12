/**
 * Quick login utility for development
 * This helps bypass the login page for testing
 */

import { buildUrl } from '../config/apiConfig';

export async function quickLogin(username = 'demo', password = 'password') {
  try {
    const loginUrl = buildUrl('backend', '/api/auth/login');
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();
    const { session_token, user: userData } = data;
    
    // Store auth data
    localStorage.setItem('auth_token', session_token);
    localStorage.setItem('auth_user', JSON.stringify(userData));
    
    console.log('Quick login successful for:', username);
    console.log('Now refresh the page to access the clinical workspace');
    
    return userData;
  } catch (error) {
    console.error('Quick login failed:', error);
    throw error;
  }
}

// Make it available globally for console use
window.quickLogin = quickLogin;