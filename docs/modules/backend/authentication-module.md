# Authentication Module

## Overview
The Authentication Module provides flexible authentication and authorization for WintEHR, supporting both simple training mode and production-ready JWT authentication. This module demonstrates healthcare-specific security patterns and role-based access control.

## Architecture
```
Authentication Module
├── Core Authentication/
│   ├── auth_router.py
│   ├── auth_service.py
│   └── auth_models.py
├── JWT Implementation/
│   ├── jwt_handler.py
│   ├── token_service.py
│   └── refresh_tokens.py
├── Authorization/
│   ├── rbac_service.py
│   ├── permissions.py
│   └── resource_policies.py
└── Audit/
    ├── audit_logger.py
    ├── access_tracker.py
    └── compliance_reports.py
```

## Core Components

### Authentication Router (auth_router.py)
**Purpose**: RESTful endpoints for authentication operations

**Endpoints**:
```python
# Authentication
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/auth/me
GET    /api/auth/config

# User management
GET    /api/auth/users
POST   /api/auth/users
PUT    /api/auth/users/{user_id}
DELETE /api/auth/users/{user_id}

# Role management
GET    /api/auth/roles
POST   /api/auth/roles
PUT    /api/auth/roles/{role_id}
```

**Dual-Mode Implementation**:
```python
@router.post("/login")
async def login(
    credentials: LoginCredentials,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    # Check authentication mode
    if not settings.JWT_ENABLED:
        # Simple training mode
        return {
            "access_token": "training_token",
            "token_type": "bearer",
            "user": {
                "id": credentials.username,
                "name": f"Dr. {credentials.username.title()}",
                "role": "physician",
                "permissions": ["read", "write", "prescribe"]
            }
        }
    
    # JWT production mode
    user = await authenticate_user(db, credentials.username, credentials.password)
    if not user:
        raise HTTPException(401, "Invalid credentials")
    
    # Generate tokens
    access_token = create_access_token(user)
    refresh_token = create_refresh_token(user)
    
    # Store refresh token
    await store_refresh_token(db, user.id, refresh_token)
    
    # Audit login
    await audit_login(user.id, request.client.host)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user.to_dict()
    }
```

### JWT Handler (jwt_handler.py)
**Purpose**: JWT token creation and validation

**Token Structure**:
```python
def create_access_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role.name,
        "permissions": [p.name for p in user.role.permissions],
        "exp": datetime.utcnow() + timedelta(minutes=30),
        "iat": datetime.utcnow(),
        "type": "access"
    }
    
    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )
```

**Token Validation**:
```python
async def validate_token(token: str) -> TokenPayload:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        # Check token type
        if payload.get("type") != "access":
            raise ValueError("Invalid token type")
        
        # Check if token is blacklisted
        if await is_token_blacklisted(payload["jti"]):
            raise ValueError("Token has been revoked")
        
        return TokenPayload(**payload)
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token has expired")
    except jwt.JWTError:
        raise HTTPException(401, "Invalid token")
```

### Authorization Service (rbac_service.py)
**Purpose**: Role-based access control implementation

**Permission Model**:
```python
class Permission(Base):
    __tablename__ = "permissions"
    
    id = Column(UUID, primary_key=True)
    name = Column(String, unique=True)
    resource = Column(String)  # e.g., "Patient", "MedicationRequest"
    action = Column(String)    # e.g., "read", "write", "delete"
    conditions = Column(JSONB) # Additional constraints

class Role(Base):
    __tablename__ = "roles"
    
    id = Column(UUID, primary_key=True)
    name = Column(String, unique=True)
    description = Column(String)
    permissions = relationship("Permission", secondary="role_permissions")
```

**Permission Checking**:
```python
class AuthorizationService:
    async def check_permission(
        self,
        user: User,
        resource: str,
        action: str,
        resource_instance: dict = None
    ) -> bool:
        # Get user permissions
        permissions = await self.get_user_permissions(user)
        
        # Check for matching permission
        for permission in permissions:
            if self.permission_matches(permission, resource, action):
                # Check conditions if any
                if permission.conditions and resource_instance:
                    if not self.evaluate_conditions(
                        permission.conditions,
                        resource_instance,
                        user
                    ):
                        continue
                return True
        
        return False
    
    def evaluate_conditions(
        self,
        conditions: dict,
        resource: dict,
        user: User
    ) -> bool:
        # Example: User can only access their assigned patients
        if "assigned_patients" in conditions:
            patient_ref = resource.get("subject", {}).get("reference", "")
            return patient_ref in user.assigned_patients
        
        # Example: Time-based access
        if "time_restriction" in conditions:
            current_hour = datetime.now().hour
            allowed_hours = conditions["time_restriction"]
            return current_hour in allowed_hours
        
        return True
```

### Resource Policies
**Purpose**: Fine-grained resource access control

**Policy Definition**:
```python
RESOURCE_POLICIES = {
    "Patient": {
        "read": {
            "roles": ["physician", "nurse", "admin"],
            "conditions": {
                "physician": {"assigned_patients": True},
                "nurse": {"assigned_units": True},
                "admin": {}  # No restrictions
            }
        },
        "write": {
            "roles": ["physician", "admin"],
            "fields": {
                "physician": ["name", "telecom", "address"],
                "admin": "*"  # All fields
            }
        }
    },
    "MedicationRequest": {
        "create": {
            "roles": ["physician"],
            "validation": "validate_prescribing_authority"
        },
        "read": {
            "roles": ["physician", "nurse", "pharmacist"]
        },
        "approve": {
            "roles": ["pharmacist"],
            "conditions": {"license_valid": True}
        }
    }
}
```

**Policy Enforcement**:
```python
def enforce_resource_policy(
    resource_type: str,
    action: str,
    user: User,
    resource_data: dict = None
):
    policy = RESOURCE_POLICIES.get(resource_type, {}).get(action, {})
    
    # Check role
    if user.role.name not in policy.get("roles", []):
        raise PermissionDenied(f"Role {user.role.name} cannot {action} {resource_type}")
    
    # Check conditions
    conditions = policy.get("conditions", {}).get(user.role.name, {})
    if not evaluate_policy_conditions(conditions, user, resource_data):
        raise PermissionDenied("Policy conditions not met")
    
    # Check field restrictions
    if action == "write" and "fields" in policy:
        allowed_fields = policy["fields"].get(user.role.name, [])
        if allowed_fields != "*":
            filter_fields(resource_data, allowed_fields)
    
    # Run custom validation
    if "validation" in policy:
        validator = getattr(validators, policy["validation"])
        validator(user, resource_data)
```

## Audit and Compliance

### Audit Logger
**Purpose**: Comprehensive security audit trail

**Audit Events**:
```python
class AuditLogger:
    async def log_access(
        self,
        user_id: str,
        action: str,
        resource_type: str,
        resource_id: str,
        outcome: str,
        details: dict = None
    ):
        audit_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "action": action,
            "resource": f"{resource_type}/{resource_id}",
            "outcome": outcome,
            "ip_address": self.get_client_ip(),
            "user_agent": self.get_user_agent(),
            "details": details or {}
        }
        
        # Store in database
        await self.db.execute(
            """
            INSERT INTO audit_logs 
            (id, timestamp, user_id, action, resource, outcome, details)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            uuid.uuid4(),
            audit_entry["timestamp"],
            audit_entry["user_id"],
            audit_entry["action"],
            audit_entry["resource"],
            audit_entry["outcome"],
            json.dumps(audit_entry["details"])
        )
        
        # Check for suspicious activity
        if await self.is_suspicious(audit_entry):
            await self.alert_security_team(audit_entry)
```

### Access Tracking
```python
class AccessTracker:
    async def track_patient_access(
        self,
        user_id: str,
        patient_id: str,
        reason: str
    ):
        # Record access
        await self.db.execute(
            """
            INSERT INTO patient_access_log
            (user_id, patient_id, accessed_at, reason)
            VALUES ($1, $2, $3, $4)
            """,
            user_id, patient_id, datetime.utcnow(), reason
        )
        
        # Check for break-the-glass
        if not await self.has_regular_access(user_id, patient_id):
            await self.record_break_glass(user_id, patient_id, reason)
```

## Security Features

### Session Management
```python
class SessionManager:
    async def create_session(self, user_id: str, device_info: dict) -> str:
        session_id = str(uuid.uuid4())
        
        await self.redis.setex(
            f"session:{session_id}",
            settings.SESSION_TIMEOUT,
            json.dumps({
                "user_id": user_id,
                "created_at": datetime.utcnow().isoformat(),
                "device_info": device_info,
                "last_activity": datetime.utcnow().isoformat()
            })
        )
        
        return session_id
    
    async def validate_session(self, session_id: str) -> dict:
        session_data = await self.redis.get(f"session:{session_id}")
        if not session_data:
            raise SessionExpired()
        
        session = json.loads(session_data)
        
        # Check for concurrent sessions
        if await self.has_concurrent_sessions(session["user_id"]):
            await self.handle_concurrent_sessions(session["user_id"])
        
        # Update last activity
        session["last_activity"] = datetime.utcnow().isoformat()
        await self.redis.setex(
            f"session:{session_id}",
            settings.SESSION_TIMEOUT,
            json.dumps(session)
        )
        
        return session
```

### Password Policy
```python
class PasswordPolicy:
    MIN_LENGTH = 12
    REQUIRE_UPPERCASE = True
    REQUIRE_LOWERCASE = True
    REQUIRE_NUMBERS = True
    REQUIRE_SPECIAL = True
    HISTORY_COUNT = 5
    MAX_AGE_DAYS = 90
    
    @classmethod
    def validate_password(cls, password: str, user: User) -> List[str]:
        errors = []
        
        if len(password) < cls.MIN_LENGTH:
            errors.append(f"Password must be at least {cls.MIN_LENGTH} characters")
        
        if cls.REQUIRE_UPPERCASE and not any(c.isupper() for c in password):
            errors.append("Password must contain uppercase letters")
        
        # Check password history
        if cls.is_password_reused(password, user):
            errors.append("Password has been used recently")
        
        # Check common passwords
        if cls.is_common_password(password):
            errors.append("Password is too common")
        
        return errors
```

## Integration Points

### FHIR API Integration
- Protect FHIR endpoints
- Resource-level permissions
- Audit FHIR operations
- Patient consent checking

### External Identity Providers
- SAML 2.0 support
- OAuth2/OIDC integration
- Active Directory sync
- Multi-factor authentication

### Clinical Systems
- Single sign-on (SSO)
- Context sharing (SMART)
- Break-the-glass access
- Emergency access

## Key Features

### Healthcare-Specific
- Break-the-glass access
- Patient consent management
- Prescribing authority
- License verification
- Shift-based access

### Security Standards
- HIPAA compliance
- Audit trail requirements
- Encryption at rest
- Secure communication
- Access reviews

### Developer Experience
- Simple training mode
- Easy role switching
- Clear error messages
- Comprehensive logging
- Testing utilities

## Educational Value

### Security Patterns
- Authentication flows
- JWT implementation
- RBAC design
- Policy engines
- Audit strategies

### Healthcare Security
- HIPAA requirements
- Patient privacy
- Clinical workflows
- Emergency access
- Compliance needs

### Best Practices
- Password handling
- Token management
- Session security
- Audit logging
- Error handling

## Missing Features & Improvements

### Planned Enhancements
- Multi-factor authentication
- Biometric support
- Smart card integration
- Delegated access
- Consent management

### Technical Improvements
- Redis session store
- Rate limiting
- Brute force protection
- Token rotation
- Key management

### Compliance Features
- HIPAA audit reports
- Access reviews
- Policy attestation
- Training tracking
- Incident response

## Best Practices

### Security Design
- Defense in depth
- Least privilege
- Fail secure
- Regular reviews
- Incident planning

### Implementation
- Secure defaults
- Input validation
- Output encoding
- Error handling
- Logging strategy

### Operations
- Regular updates
- Security scanning
- Penetration testing
- Access reviews
- Training programs

## Module Dependencies
```
Authentication Module
├── Database Module
├── Cache Module (Redis)
├── Crypto Libraries
└── External Services
    ├── Identity Provider
    ├── MFA Service
    ├── Certificate Authority
    └── Audit Repository
```

## Testing Strategy
- Unit tests for auth logic
- Integration tests with IdP
- Security testing (OWASP)
- Performance testing
- Compliance validation