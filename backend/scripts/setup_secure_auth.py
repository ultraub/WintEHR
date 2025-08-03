#!/usr/bin/env python3
"""
Setup Secure Authentication System

This script runs the auth migration to create proper user tables
and migrate from hardcoded demo users to database-backed authentication.

Usage:
    python scripts/setup_secure_auth.py [--docker]
"""

import asyncio
import sys
import os
import argparse
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).parent.parent))

from migrations.migrate_to_secure_auth import SecureAuthMigration


async def main():
    parser = argparse.ArgumentParser(description='Setup secure authentication system')
    parser.add_argument('--docker', action='store_true', help='Running in Docker environment')
    args = parser.parse_args()
    
    # Set environment variable if Docker
    if args.docker:
        os.environ['DOCKER_CONTAINER'] = 'true'
    
    print("🔐 Setting up secure authentication system...")
    print("=" * 60)
    
    migration = SecureAuthMigration()
    
    try:
        await migration.run_migration()
        
        print("\n✅ Secure authentication setup complete!")
        print("\n📝 Default users created:")
        print("  - admin/Admin123!@# (System Administrator)")
        print("  - demo/Demo123! (Physician)")
        print("  - nurse/Nurse123! (Nurse)")
        print("  - pharmacist/Pharm123! (Pharmacist)")
        print("  - tech/Tech123! (Technician)")
        print("\n⚠️  IMPORTANT: All users must change password on first login!")
        print("\n🔧 To enable secure auth, set environment variable:")
        print("  export USE_SECURE_AUTH=true")
        print("  # or for production:")
        print("  export JWT_ENABLED=true")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())