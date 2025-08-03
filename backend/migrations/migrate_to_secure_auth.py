#!/usr/bin/env python3
"""
Migration: Implement Secure Authentication System
Created: 2025-08-03

This migration:
1. Creates auth schema and user tables
2. Migrates demo users to proper database with hashed passwords
3. Sets up RBAC permissions
4. Implements password policies

IMPORTANT: Run this migration before using production mode!
"""

import asyncio
import asyncpg
import bcrypt
import sys
import os
from pathlib import Path
from datetime import datetime
import logging

# Add backend to path
sys.path.append(str(Path(__file__).parent.parent))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SecureAuthMigration:
    def __init__(self):
        # Detect if running in Docker
        is_docker = os.path.exists('/.dockerenv') or os.environ.get('DOCKER_CONTAINER', False)
        
        self.db_config = {
            'host': 'postgres' if is_docker else 'localhost',
            'port': 5432,
            'user': 'emr_user',
            'password': 'emr_password',
            'database': 'emr_db'
        }
        
    async def run_migration(self):
        """Run the complete migration."""
        conn = None
        try:
            # Connect to database
            logger.info("Connecting to database...")
            conn = await asyncpg.connect(**self.db_config)
            
            # Run SQL migration
            logger.info("Creating auth schema and tables...")
            sql_file = Path(__file__).parent / 'add_auth_users_table.sql'
            with open(sql_file, 'r') as f:
                await conn.execute(f.read())
            
            # Create default users with proper hashed passwords
            logger.info("Creating default users...")
            await self.create_default_users(conn)
            
            # Assign role permissions
            logger.info("Setting up role permissions...")
            await self.setup_role_permissions(conn)
            
            logger.info("✅ Migration completed successfully!")
            
        except Exception as e:
            logger.error(f"❌ Migration failed: {e}")
            raise
        finally:
            if conn:
                await conn.close()
    
    async def create_default_users(self, conn):
        """Create default users with hashed passwords."""
        
        # Define default users
        default_users = [
            {
                'username': 'admin',
                'email': 'admin@wintehr.com',
                'full_name': 'System Administrator',
                'role': 'admin',
                'password': 'Admin123!@#',  # CHANGE IN PRODUCTION!
                'must_change_password': True
            },
            {
                'username': 'demo',
                'email': 'demo@wintehr.com', 
                'full_name': 'Demo Physician',
                'role': 'physician',
                'password': 'Demo123!',
                'must_change_password': True
            },
            {
                'username': 'nurse',
                'email': 'nurse@wintehr.com',
                'full_name': 'Nancy Nurse',
                'role': 'nurse',
                'password': 'Nurse123!',
                'must_change_password': True
            },
            {
                'username': 'pharmacist',
                'email': 'pharmacist@wintehr.com',
                'full_name': 'Phil Pharmacist',
                'role': 'pharmacist',
                'password': 'Pharm123!',
                'must_change_password': True
            },
            {
                'username': 'tech',
                'email': 'tech@wintehr.com',
                'full_name': 'Terry Technician',
                'role': 'technician',
                'password': 'Tech123!',
                'must_change_password': True
            }
        ]
        
        for user in default_users:
            # Hash password with bcrypt
            password_hash = bcrypt.hashpw(
                user['password'].encode('utf-8'), 
                bcrypt.gensalt()
            ).decode('utf-8')
            
            # Insert user
            await conn.execute("""
                INSERT INTO auth.users (
                    username, email, password_hash, full_name, 
                    role, must_change_password, permissions
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (username) DO UPDATE SET
                    password_hash = EXCLUDED.password_hash,
                    updated_at = CURRENT_TIMESTAMP
            """, 
                user['username'],
                user['email'],
                password_hash,
                user['full_name'],
                user['role'],
                user['must_change_password'],
                '[]'  # Additional permissions beyond role
            )
            
            logger.info(f"  ✓ Created user: {user['username']} ({user['role']})")
    
    async def setup_role_permissions(self, conn):
        """Set up role-permission mappings."""
        
        role_permissions = {
            'admin': ['*'],  # All permissions
            'physician': [
                'patients:*',
                'medications:*',
                'orders:*',
                'results:view',
                'results:acknowledge',
                'controlled_substances:prescribe'
            ],
            'nurse': [
                'patients:view',
                'patients:update',
                'medications:view',
                'medications:administer',
                'orders:view',
                'results:view'
            ],
            'pharmacist': [
                'patients:view',
                'medications:*',
                'pharmacy:*',
                'controlled_substances:dispense',
                'orders:view'
            ],
            'technician': [
                'patients:view',
                'results:create',
                'results:update',
                'orders:view'
            ]
        }
        
        for role_name, perms in role_permissions.items():
            # Get role ID
            role = await conn.fetchrow(
                "SELECT id FROM auth.roles WHERE name = $1",
                role_name
            )
            
            if not role:
                continue
                
            role_id = role['id']
            
            # Clear existing permissions
            await conn.execute(
                "DELETE FROM auth.role_permissions WHERE role_id = $1",
                role_id
            )
            
            # Add new permissions
            if perms == ['*']:
                # Admin gets all permissions
                await conn.execute("""
                    INSERT INTO auth.role_permissions (role_id, permission_id)
                    SELECT $1, id FROM auth.permissions
                """, role_id)
            else:
                # Add specific permissions
                for perm in perms:
                    if ':*' in perm:
                        # Wildcard - add all actions for resource
                        resource = perm.split(':')[0]
                        await conn.execute("""
                            INSERT INTO auth.role_permissions (role_id, permission_id)
                            SELECT $1, id FROM auth.permissions
                            WHERE resource = $2
                        """, role_id, resource)
                    else:
                        # Specific permission
                        resource, action = perm.split(':')
                        await conn.execute("""
                            INSERT INTO auth.role_permissions (role_id, permission_id)
                            SELECT $1, id FROM auth.permissions
                            WHERE resource = $2 AND action = $3
                        """, role_id, resource, action)
            
            logger.info(f"  ✓ Set up permissions for role: {role_name}")


async def main():
    """Run the migration."""
    migration = SecureAuthMigration()
    await migration.run_migration()


if __name__ == "__main__":
    asyncio.run(main())