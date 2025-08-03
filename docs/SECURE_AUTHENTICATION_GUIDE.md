# Secure Authentication Implementation Guide

**Created**: 2025-08-03  
**Status**: PARTIALLY IMPLEMENTED - Requires migration run

## Overview

WintEHR now includes a proper database-backed authentication system that replaces the hardcoded demo users in production mode. This guide covers the setup, configuration, and usage of the secure authentication system.

## ⚠️ CRITICAL SECURITY WARNING

**The current production mode still uses hardcoded passwords!** You MUST run the migration and enable secure authentication before using in production.

## Features

### Security Features
- **Bcrypt Password Hashing**: Industry-standard password hashing
- **Account Lockout**: Automatic lockout after 5 failed attempts
- **Password History**: Prevents reuse of last 5 passwords
- **Password Requirements**: 
  - Minimum 8 characters
  - Must include uppercase, lowercase, digit, and special character
- **Session Management**: JWT tokens with database tracking
- **Audit Logging**: All authentication events logged

### RBAC (Role-Based Access Control)
- **Granular Permissions**: Resource-based permission system
- **Pre-defined Roles**:
  - `admin`: Full system access
  - `physician`: Clinical operations, orders, prescriptions
  - `nurse`: Medication administration, vitals, patient care
  - `pharmacist`: Pharmacy operations, dispensing
  - `technician`: Lab/imaging results entry
  - `clerk`: Administrative tasks
  - `viewer`: Read-only access

### Controlled Substances
Special permissions for Schedule II-V medications:
- `controlled_substances:prescribe` - Required for physicians
- `controlled_substances:dispense` - Required for pharmacists
- `controlled_substances:audit` - Required for DEA compliance

## Setup Instructions

### 1. Run the Migration

```bash
# From backend directory
cd backend

# Run migration (add --docker if in container)
python scripts/setup_secure_auth.py

# Or with Docker
docker exec emr-backend python scripts/setup_secure_auth.py --docker
```

### 2. Enable Secure Authentication

Set environment variables:

```bash
# For development with secure auth
export USE_SECURE_AUTH=true

# For production (automatically enables secure auth)
export JWT_ENABLED=true
export JWT_SECRET_KEY="your-production-secret-key-here"
```

### 3. Default Users

The migration creates these default users:

| Username | Password | Role | Notes |
|----------|----------|------|-------|
| admin | Admin123!@# | admin | System administrator |
| demo | Demo123! | physician | Demo physician account |
| nurse | Nurse123! | nurse | Nursing staff |
| pharmacist | Pharm123! | pharmacist | Pharmacy staff |
| tech | Tech123! | technician | Lab/radiology tech |

**⚠️ All users must change password on first login!**

## API Usage

### Login Endpoint

```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "demo",
  "password": "Demo123!"
}
```

Response (Production Mode):
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "expires_in": 86400,
  "user": {
    "id": "uuid-here",
    "username": "demo",
    "name": "Demo Physician",
    "email": "demo@wintehr.com",
    "role": "physician",
    "permissions": ["patients:*", "medications:*", "orders:*", ...]
  }
}
```

### Change Password

```bash
POST /api/auth/change-password
Authorization: Bearer {token}
Content-Type: application/json

{
  "current_password": "Demo123!",
  "new_password": "NewSecurePass123!"
}
```

### Check Permissions

The backend provides a permission decorator:

```python
from api.auth.secure_auth_service import require_permission

@router.post("/prescribe-controlled")
@require_permission("controlled_substances:prescribe")
async def prescribe_controlled_substance(
    medication: MedicationRequest,
    current_user: User = Depends(get_current_user)
):
    # Only users with permission can access this endpoint
    pass
```

## Frontend Integration

### Using Permissions in React

```javascript
// In components
const { user } = useAuth();

const canPrescribeControlled = user?.permissions?.includes('controlled_substances:prescribe');
const isAdmin = user?.permissions?.includes('*');

// Conditional rendering
{canPrescribeControlled && (
  <Button onClick={handlePrescribeControlled}>
    Prescribe Controlled Substance
  </Button>
)}
```

### Protected Routes

```javascript
<ProtectedRoute 
  path="/pharmacy" 
  requiredPermissions={['pharmacy:queue_view']}
>
  <PharmacyDashboard />
</ProtectedRoute>
```

## Database Schema

### Users Table (`auth.users`)
- Stores user accounts with hashed passwords
- Tracks login attempts and lockout status
- Links to roles and permissions

### Sessions Table (`auth.sessions`)
- Tracks active JWT sessions
- Enables server-side token revocation
- Records IP and user agent

### Roles & Permissions
- `auth.roles`: Role definitions
- `auth.permissions`: Granular permissions
- `auth.role_permissions`: Role-permission mappings
- `auth.user_roles`: User-role assignments

## Security Best Practices

1. **Change Default Passwords**: All default users must change passwords immediately
2. **Use Strong JWT Secret**: Generate a cryptographically secure secret for production
3. **Enable HTTPS**: Always use HTTPS in production (see HTTPS enforcement guide)
4. **Regular Password Changes**: Implement password expiry policy
5. **Monitor Failed Logins**: Check audit logs for suspicious activity
6. **Principle of Least Privilege**: Assign minimum required permissions

## Troubleshooting

### Migration Fails
```bash
# Check database connection
docker exec emr-postgres psql -U emr_user -d emr_db -c "\dt auth.*"

# Run migration manually
docker exec emr-postgres psql -U emr_user -d emr_db -f /path/to/add_auth_users_table.sql
```

### Login Fails with Secure Auth
1. Verify migration was run successfully
2. Check USE_SECURE_AUTH or JWT_ENABLED is set
3. Verify password meets requirements
4. Check if account is locked (5 failed attempts)

### Permission Denied Errors
1. Check user's role and permissions
2. Verify permission exists in database
3. Check if permission name matches exactly

## Remaining Work

While the secure authentication system is implemented, the following tasks remain:

1. **Frontend Password Change UI**: Add forced password change on first login
2. **User Management UI**: Admin interface for user CRUD operations
3. **Session Management UI**: View/revoke active sessions
4. **Password Recovery**: Implement forgot password flow
5. **Two-Factor Authentication**: Add 2FA for enhanced security
6. **Integration with LDAP/AD**: For enterprise deployments

## Migration Rollback

If you need to rollback to demo users:

```bash
# Disable secure auth
unset USE_SECURE_AUTH
unset JWT_ENABLED

# Or set to false
export USE_SECURE_AUTH=false
export JWT_ENABLED=false
```

The system will fall back to using the hardcoded demo users.

## Compliance Notes

This implementation provides the foundation for:
- **HIPAA Compliance**: Audit logging, access controls, encryption
- **DEA Compliance**: Controlled substance permissions and audit trail
- **Password Policies**: Configurable to meet organizational requirements

---

**Remember**: Security is an ongoing process. Regular security audits, penetration testing, and staying updated with security patches are essential for maintaining a secure healthcare system.