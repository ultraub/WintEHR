-- Migration: Add authentication users table
-- Created: 2025-08-03
-- Purpose: Implement proper user authentication with hashed passwords

-- Create auth schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS auth;

-- Create users table
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    permissions JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    is_locked BOOLEAN DEFAULT false,
    failed_login_attempts INTEGER DEFAULT 0,
    last_failed_login TIMESTAMP WITH TIME ZONE,
    last_successful_login TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE,
    must_change_password BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX idx_auth_users_username ON auth.users(username);
CREATE INDEX idx_auth_users_email ON auth.users(email);
CREATE INDEX idx_auth_users_role ON auth.users(role);
CREATE INDEX idx_auth_users_is_active ON auth.users(is_active);

-- Create password history table for security compliance
CREATE TABLE IF NOT EXISTS auth.password_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_password_history_user_id ON auth.password_history(user_id);

-- Create sessions table for JWT management
CREATE TABLE IF NOT EXISTS auth.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user_id ON auth.sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON auth.sessions(token_hash);
CREATE INDEX idx_sessions_expires_at ON auth.sessions(expires_at);

-- Create roles table for RBAC
CREATE TABLE IF NOT EXISTS auth.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user_roles junction table
CREATE TABLE IF NOT EXISTS auth.user_roles (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES auth.roles(id) ON DELETE CASCADE,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID,
    PRIMARY KEY (user_id, role_id)
);

-- Create permissions table
CREATE TABLE IF NOT EXISTS auth.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(resource, action)
);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS auth.role_permissions (
    role_id UUID NOT NULL REFERENCES auth.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES auth.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Insert default roles
INSERT INTO auth.roles (name, description, permissions) VALUES
    ('admin', 'System Administrator', '["*"]'::jsonb),
    ('physician', 'Physician/Provider', '["orders:*", "medications:*", "results:view", "patients:*"]'::jsonb),
    ('nurse', 'Registered Nurse', '["medications:view", "medications:administer", "vitals:*", "patients:view"]'::jsonb),
    ('pharmacist', 'Pharmacist', '["medications:*", "pharmacy:*", "patients:view"]'::jsonb),
    ('technician', 'Lab/Radiology Technician', '["results:create", "results:update", "patients:view"]'::jsonb),
    ('clerk', 'Medical Clerk', '["patients:view", "appointments:*", "documents:view"]'::jsonb),
    ('viewer', 'Read-only Access', '["patients:view", "results:view", "medications:view"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
INSERT INTO auth.permissions (resource, action, description) VALUES
    -- Patient permissions
    ('patients', 'view', 'View patient information'),
    ('patients', 'create', 'Create new patients'),
    ('patients', 'update', 'Update patient information'),
    ('patients', 'delete', 'Delete patients'),
    
    -- Medication permissions
    ('medications', 'view', 'View medications'),
    ('medications', 'prescribe', 'Prescribe medications'),
    ('medications', 'dispense', 'Dispense medications'),
    ('medications', 'administer', 'Administer medications'),
    ('medications', 'reconcile', 'Perform medication reconciliation'),
    
    -- Controlled substances permissions
    ('controlled_substances', 'prescribe', 'Prescribe controlled substances'),
    ('controlled_substances', 'dispense', 'Dispense controlled substances'),
    ('controlled_substances', 'audit', 'Audit controlled substance logs'),
    
    -- Order permissions
    ('orders', 'view', 'View orders'),
    ('orders', 'create', 'Create orders'),
    ('orders', 'update', 'Update orders'),
    ('orders', 'cancel', 'Cancel orders'),
    
    -- Results permissions
    ('results', 'view', 'View results'),
    ('results', 'create', 'Create results'),
    ('results', 'update', 'Update results'),
    ('results', 'acknowledge', 'Acknowledge results'),
    
    -- Pharmacy permissions
    ('pharmacy', 'queue_view', 'View pharmacy queue'),
    ('pharmacy', 'queue_manage', 'Manage pharmacy queue'),
    ('pharmacy', 'inventory_view', 'View inventory'),
    ('pharmacy', 'inventory_manage', 'Manage inventory'),
    
    -- Administrative permissions
    ('users', 'view', 'View users'),
    ('users', 'create', 'Create users'),
    ('users', 'update', 'Update users'),
    ('users', 'delete', 'Delete users'),
    ('audit', 'view', 'View audit logs'),
    ('system', 'configure', 'Configure system settings')
ON CONFLICT (resource, action) DO NOTHING;

-- Create functions for updated_at trigger
CREATE OR REPLACE FUNCTION auth.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_auth_users_updated_at BEFORE UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION auth.update_updated_at_column();

CREATE TRIGGER update_auth_roles_updated_at BEFORE UPDATE ON auth.roles
    FOR EACH ROW EXECUTE FUNCTION auth.update_updated_at_column();

-- Create view for user permissions
CREATE OR REPLACE VIEW auth.user_permissions AS
SELECT 
    u.id as user_id,
    u.username,
    u.role as primary_role,
    p.resource,
    p.action,
    p.description
FROM auth.users u
LEFT JOIN auth.user_roles ur ON u.id = ur.user_id
LEFT JOIN auth.role_permissions rp ON ur.role_id = rp.role_id
LEFT JOIN auth.permissions p ON rp.permission_id = p.permission_id
WHERE u.is_active = true
UNION
-- Include permissions from primary role
SELECT 
    u.id as user_id,
    u.username,
    u.role as primary_role,
    p.resource,
    p.action,
    p.description
FROM auth.users u
JOIN auth.roles r ON u.role = r.name
JOIN auth.role_permissions rp ON r.id = rp.role_id
JOIN auth.permissions p ON rp.permission_id = p.permission_id
WHERE u.is_active = true;

-- Add comments for documentation
COMMENT ON TABLE auth.users IS 'User authentication and profile information';
COMMENT ON TABLE auth.sessions IS 'Active user sessions for JWT management';
COMMENT ON TABLE auth.roles IS 'Role definitions for RBAC';
COMMENT ON TABLE auth.permissions IS 'Granular permission definitions';
COMMENT ON COLUMN auth.users.password_hash IS 'Bcrypt hashed password';
COMMENT ON COLUMN auth.users.failed_login_attempts IS 'Counter for brute force protection';
COMMENT ON COLUMN auth.users.is_locked IS 'Account locked due to security reasons';