# Quick Authentication Guide for Enhanced Clinical Workspace

## Problem
The enhanced clinical workspace at `/patients/:id/clinical` requires authentication, but you're being redirected to the login page.

## Quick Solution

### Option 1: Use Browser Console (Fastest)
1. Open browser developer console (F12)
2. Run this command:
   ```javascript
   quickLogin('demo', 'password')
   ```
3. Refresh the page
4. Navigate to: http://localhost:3000/patients/8c2d5e9b-0717-9616-beb9-21296a5b547d/clinical

### Option 2: Use the Login Page
1. Go to http://localhost:3000/login
2. Enter username: `demo`
3. Enter password: `password`
4. Click login
5. Navigate to the clinical workspace

### Available Users
- **demo** - Demo User (Physician)
- **nurse** - Nurse Demo
- **pharmacist** - Pharmacist Demo
- **admin** - Admin User

All users have password: `password`

## After Login
Once authenticated, you can access:
- **Enhanced Clinical Workspace**: `/patients/:id/clinical`
- **Legacy Clinical Workspace**: `/patients/:id/clinical-v3` (for comparison)
- **Demo Mode** (no auth needed): `/clinical-demo/:id`

## Troubleshooting
If login doesn't work:
1. Check if backend is running: `docker-compose ps`
2. Check auth endpoint: `curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"username": "demo", "password": "password"}'`
3. Clear localStorage: `localStorage.clear()` in browser console
4. Try again

## Development Tip
To stay logged in during development, the auth token is stored in localStorage and persists across page refreshes.