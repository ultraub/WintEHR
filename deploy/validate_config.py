#!/usr/bin/env python3
"""
WintEHR Configuration Validator
Standalone utility to validate deployment configuration.

Usage:
    python deploy/validate_config.py
    python deploy/validate_config.py --environment prod
    python deploy/validate_config.py --verbose
"""

import argparse
import os
import re
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from deploy.config_loader import load_config, print_config_summary, ConfigurationError


def validate_email(email: str) -> bool:
    """Validate email format."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def validate_domain(domain: str) -> bool:
    """Validate domain name format."""
    pattern = r'^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$'
    return bool(re.match(pattern, domain))


def validate_secrets():
    """Validate that required secrets are set and secure."""
    issues = []
    warnings = []

    # Check POSTGRES_PASSWORD
    postgres_password = os.getenv('POSTGRES_PASSWORD', '')
    if not postgres_password:
        issues.append("POSTGRES_PASSWORD is not set")
    elif postgres_password == 'CHANGE_ME_TO_SECURE_PASSWORD':
        issues.append("POSTGRES_PASSWORD is still set to the example value")
    elif len(postgres_password) < 16:
        warnings.append(f"POSTGRES_PASSWORD is weak (length: {len(postgres_password)}, recommended: 16+)")

    # Check SECRET_KEY
    secret_key = os.getenv('SECRET_KEY', '')
    if not secret_key:
        issues.append("SECRET_KEY is not set")
    elif secret_key == 'CHANGE_ME_TO_RANDOM_SECRET_KEY':
        issues.append("SECRET_KEY is still set to the example value")
    elif len(secret_key) < 32:
        warnings.append(f"SECRET_KEY is weak (length: {len(secret_key)}, recommended: 32+)")

    # Check JWT_SECRET
    jwt_secret = os.getenv('JWT_SECRET', '')
    if not jwt_secret:
        issues.append("JWT_SECRET is not set")
    elif jwt_secret == 'CHANGE_ME_TO_RANDOM_JWT_SECRET':
        issues.append("JWT_SECRET is still set to the example value")
    elif len(jwt_secret) < 32:
        warnings.append(f"JWT_SECRET is weak (length: {len(jwt_secret)}, recommended: 32+)")

    # Check if SECRET_KEY and JWT_SECRET are the same
    if secret_key and jwt_secret and secret_key == jwt_secret:
        warnings.append("SECRET_KEY and JWT_SECRET should be different")

    return issues, warnings


def validate_configuration(config: dict, verbose: bool = False) -> tuple:
    """
    Perform detailed validation of configuration.

    Returns:
        (errors, warnings) tuple of lists
    """
    errors = []
    warnings = []

    # Deployment validation
    deployment = config.get('deployment', {})

    # Environment
    if deployment.get('environment') not in ['dev', 'staging', 'production']:
        warnings.append(f"Unusual environment: {deployment.get('environment')}")

    # Patient count
    patient_count = deployment.get('patient_count', 0)
    if patient_count < 1:
        errors.append(f"Invalid patient_count: {patient_count} (must be >= 1)")
    elif patient_count > 1000:
        warnings.append(f"Large patient_count ({patient_count}) may take significant time to generate")

    # SSL validation
    if deployment.get('enable_ssl'):
        ssl_config = config.get('ssl', {})

        domain_name = ssl_config.get('domain_name', '')
        if not domain_name:
            errors.append("SSL enabled but domain_name not configured")
        elif not validate_domain(domain_name):
            errors.append(f"Invalid domain_name format: {domain_name}")

        ssl_email = ssl_config.get('ssl_email', '')
        if not ssl_email:
            errors.append("SSL enabled but ssl_email not configured")
        elif not validate_email(ssl_email):
            errors.append(f"Invalid ssl_email format: {ssl_email}")
        elif ssl_email == 'admin@example.com':
            warnings.append("ssl_email is still set to example value")

    # Services validation
    services = config.get('services', {})
    ports = services.get('ports', {})

    # Check for port conflicts
    port_values = [v for v in ports.values() if isinstance(v, int)]
    if len(port_values) != len(set(port_values)):
        duplicates = [p for p in port_values if port_values.count(p) > 1]
        errors.append(f"Duplicate port numbers detected: {set(duplicates)}")

    # Check standard ports
    if ports.get('nginx_http') != 80:
        warnings.append(f"nginx_http is not on standard port 80 (currently {ports.get('nginx_http')})")
    if ports.get('nginx_https') != 443:
        warnings.append(f"nginx_https is not on standard port 443 (currently {ports.get('nginx_https')})")

    # Database validation
    database = config.get('database', {})
    if database.get('host') == 'localhost' and deployment.get('environment') == 'production':
        warnings.append("Using localhost for database in production - ensure this is correct")

    # HAPI FHIR validation
    hapi = config.get('hapi_fhir', {})
    memory = hapi.get('memory', '')
    if memory:
        # Check memory format (e.g., '2g', '4g')
        if not re.match(r'^\d+[gGmMkK]$', memory):
            errors.append(f"Invalid HAPI memory format: {memory} (expected format: 2g, 4g, etc.)")

    # Azure validation (if configured)
    azure = config.get('azure', {})
    if azure:
        required_azure = ['resource_group', 'vm_name', 'nsg_name', 'location']
        for field in required_azure:
            if not azure.get(field):
                errors.append(f"Azure configuration incomplete: azure.{field} is required")

    # Synthea validation
    synthea = config.get('synthea', {})
    jar_version = synthea.get('jar_version', '')
    if jar_version:
        if not re.match(r'^\d+\.\d+\.\d+$', jar_version):
            warnings.append(f"Synthea jar_version format may be invalid: {jar_version}")

    # Security validation
    security = config.get('security', {})
    cors_origins = security.get('cors_origins', [])
    if '*' in cors_origins and deployment.get('environment') == 'production':
        warnings.append("CORS allows all origins (*) in production - this may be a security risk")

    allowed_ips = security.get('allowed_ips', [])
    if allowed_ips:
        # Validate CIDR format
        for ip in allowed_ips:
            if not re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(/\d{1,2})?$', ip):
                errors.append(f"Invalid IP/CIDR format: {ip}")

    return errors, warnings


def main():
    parser = argparse.ArgumentParser(
        description='Validate WintEHR deployment configuration',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python deploy/validate_config.py
  python deploy/validate_config.py --environment staging
  python deploy/validate_config.py --verbose
  python deploy/validate_config.py --summary
        """
    )
    parser.add_argument(
        '--environment',
        choices=['dev', 'staging', 'production'],
        help='Specify environment to validate'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Show detailed validation information'
    )
    parser.add_argument(
        '--summary',
        action='store_true',
        help='Show configuration summary'
    )

    args = parser.parse_args()

    print("=" * 70)
    print("WintEHR Configuration Validator")
    print("=" * 70)
    print()

    try:
        # Load configuration
        print("📋 Loading configuration...")
        config = load_config(environment=args.environment)
        print(f"✅ Configuration loaded: {config['deployment']['environment']} environment")
        print()

        # Show summary if requested
        if args.summary:
            print_config_summary(config)
            print()

        # Validate configuration
        print("🔍 Validating configuration...")
        config_errors, config_warnings = validate_configuration(config, args.verbose)

        # Validate secrets
        print("🔐 Validating secrets...")
        secret_errors, secret_warnings = validate_secrets()

        # Combine results
        all_errors = config_errors + secret_errors
        all_warnings = config_warnings + secret_warnings

        # Display results
        print()
        if all_errors:
            print("❌ ERRORS FOUND:")
            for i, error in enumerate(all_errors, 1):
                print(f"   {i}. {error}")
            print()

        if all_warnings:
            print("⚠️  WARNINGS:")
            for i, warning in enumerate(all_warnings, 1):
                print(f"   {i}. {warning}")
            print()

        # Summary
        print("=" * 70)
        if all_errors:
            print("❌ Validation FAILED")
            print(f"   Errors: {len(all_errors)}, Warnings: {len(all_warnings)}")
            print()
            print("Fix all errors before deploying.")
            print("Review .env.example and config.example.yaml for guidance.")
            return 1
        elif all_warnings:
            print("⚠️  Validation passed with WARNINGS")
            print(f"   Warnings: {len(all_warnings)}")
            print()
            print("Review warnings and confirm they are acceptable.")
            return 0
        else:
            print("✅ Validation PASSED")
            print("   No errors or warnings found.")
            print()
            print("Configuration is ready for deployment.")
            return 0

    except ConfigurationError as e:
        print(f"\n❌ Configuration Error:")
        print(f"   {e}")
        print()
        print("Fix configuration errors before deploying.")
        return 1
    except FileNotFoundError as e:
        print(f"\n❌ File Not Found:")
        print(f"   {e}")
        print()
        print("Ensure config.yaml exists in the project root.")
        print("Copy config.example.yaml to config.yaml to get started.")
        return 1
    except Exception as e:
        print(f"\n❌ Unexpected Error:")
        print(f"   {e}")
        if args.verbose:
            import traceback
            print()
            traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
