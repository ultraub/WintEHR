#!/usr/bin/env python3
"""
WintEHR Configuration Loader
Loads and validates deployment configuration from YAML files and environment variables.

Usage:
    from deploy.config_loader import load_config

    config = load_config()
    print(config['deployment']['patient_count'])

Priority (highest to lowest):
    1. Environment variables (WINTEHR_SECTION_KEY format)
    2. config.{environment}.yaml (environment-specific)
    3. config.yaml (base configuration)
    4. Default values
"""

import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional
import yaml
from dotenv import load_dotenv


class ConfigurationError(Exception):
    """Raised when configuration is invalid or missing required values."""
    pass


class ConfigLoader:
    """Loads and validates WintEHR deployment configuration."""

    def __init__(self, config_dir: Optional[Path] = None):
        """
        Initialize configuration loader.

        Args:
            config_dir: Directory containing config files (default: project root)
        """
        if config_dir is None:
            # Default to project root (parent of deploy/)
            self.config_dir = Path(__file__).parent.parent
        else:
            self.config_dir = Path(config_dir)

        # Load .env file for secrets
        env_file = self.config_dir / '.env'
        if env_file.exists():
            load_dotenv(env_file)

    def load(self, environment: Optional[str] = None) -> Dict[str, Any]:
        """
        Load configuration with environment-specific overrides.

        Args:
            environment: Environment name (dev, staging, production)
                        If None, reads from config.yaml or WINTEHR_DEPLOYMENT_ENVIRONMENT

        Returns:
            Complete merged configuration dictionary

        Raises:
            ConfigurationError: If configuration is invalid
        """
        # Load base configuration
        base_config = self._load_yaml_file('config.yaml')

        # Determine environment
        if environment is None:
            environment = os.getenv('WINTEHR_DEPLOYMENT_ENVIRONMENT')
        if environment is None:
            environment = base_config.get('deployment', {}).get('environment', 'production')

        # Load environment-specific overrides
        env_config_file = f'config.{environment}.yaml'
        if (self.config_dir / env_config_file).exists():
            env_config = self._load_yaml_file(env_config_file)
            base_config = self._deep_merge(base_config, env_config)

        # Apply environment variable overrides
        config = self._apply_env_overrides(base_config)

        # Store the determined environment
        if 'deployment' not in config:
            config['deployment'] = {}
        config['deployment']['environment'] = environment

        return config

    def _load_yaml_file(self, filename: str) -> Dict[str, Any]:
        """Load a YAML configuration file."""
        filepath = self.config_dir / filename
        if not filepath.exists():
            if filename == 'config.yaml':
                raise ConfigurationError(f"Required configuration file not found: {filepath}")
            return {}

        try:
            with open(filepath, 'r') as f:
                return yaml.safe_load(f) or {}
        except yaml.YAMLError as e:
            raise ConfigurationError(f"Error parsing {filename}: {e}")

    def _deep_merge(self, base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
        """
        Deep merge two dictionaries.
        Override values take precedence over base values.
        """
        result = base.copy()

        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value

        return result

    def _apply_env_overrides(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply environment variable overrides.
        Format: WINTEHR_SECTION_KEY=value
        Example: WINTEHR_DEPLOYMENT_PATIENT_COUNT=100
        """
        result = config.copy()

        # Check for environment variables with WINTEHR_ prefix
        for env_key, env_value in os.environ.items():
            if not env_key.startswith('WINTEHR_'):
                continue

            # Parse the key: WINTEHR_SECTION_SUBSECTION_KEY
            parts = env_key[8:].lower().split('_', 2)  # Remove WINTEHR_ prefix

            if len(parts) < 2:
                continue

            # Navigate to the correct section
            current = result
            for part in parts[:-1]:
                if part not in current:
                    current[part] = {}
                current = current[part]

            # Set the value with type conversion
            key = parts[-1]
            current[key] = self._convert_env_value(env_value)

        return result

    def _convert_env_value(self, value: str) -> Any:
        """Convert environment variable string to appropriate Python type."""
        # Boolean
        if value.lower() in ('true', 'yes', '1', 'on'):
            return True
        if value.lower() in ('false', 'no', '0', 'off'):
            return False

        # Integer
        try:
            return int(value)
        except ValueError:
            pass

        # Float
        try:
            return float(value)
        except ValueError:
            pass

        # List (comma-separated)
        if ',' in value:
            return [v.strip() for v in value.split(',')]

        # String
        return value

    def validate(self, config: Dict[str, Any]) -> None:
        """
        Validate configuration and raise errors for missing required fields.

        Args:
            config: Configuration dictionary to validate

        Raises:
            ConfigurationError: If validation fails
        """
        errors = []

        # Required fields
        required_fields = [
            ('deployment', 'environment'),
            ('deployment', 'patient_count'),
            ('services', 'ports'),
            ('database', 'host'),
            ('database', 'name'),
        ]

        for *sections, key in required_fields:
            current = config
            try:
                for section in sections:
                    current = current[section]
                if key not in current or current[key] is None:
                    errors.append(f"Missing required field: {'.'.join(sections + [key])}")
            except (KeyError, TypeError):
                errors.append(f"Missing required section: {'.'.join(sections)}")

        # SSL-specific validation
        if config.get('deployment', {}).get('enable_ssl'):
            if not config.get('ssl', {}).get('domain_name'):
                errors.append("SSL enabled but ssl.domain_name not configured")
            if not config.get('ssl', {}).get('ssl_email'):
                errors.append("SSL enabled but ssl.ssl_email not configured")

        # Azure-specific validation
        if 'azure' in config:
            azure_fields = ['resource_group', 'vm_name', 'nsg_name', 'location']
            for field in azure_fields:
                if not config['azure'].get(field):
                    errors.append(f"Azure deployment requires azure.{field}")

        # Port validation
        if 'services' in config and 'ports' in config['services']:
            ports = config['services']['ports']
            for port_name, port_value in ports.items():
                if not isinstance(port_value, int) or port_value < 1 or port_value > 65535:
                    errors.append(f"Invalid port value for {port_name}: {port_value} (must be 1-65535)")

        # Check for environment variables that should be set
        env_warnings = []

        # Database password
        if not os.getenv('POSTGRES_PASSWORD'):
            env_warnings.append("POSTGRES_PASSWORD not set in environment")

        # Application secrets
        if not os.getenv('SECRET_KEY'):
            env_warnings.append("SECRET_KEY not set in environment")

        if not os.getenv('JWT_SECRET'):
            env_warnings.append("JWT_SECRET not set in environment")

        # Report errors
        if errors:
            raise ConfigurationError(
                "Configuration validation failed:\n" +
                "\n".join(f"  - {error}" for error in errors)
            )

        # Report warnings
        if env_warnings:
            print("⚠️  Configuration warnings:", file=sys.stderr)
            for warning in env_warnings:
                print(f"  - {warning}", file=sys.stderr)
            print("", file=sys.stderr)


def load_config(environment: Optional[str] = None, config_dir: Optional[Path] = None) -> Dict[str, Any]:
    """
    Load and validate WintEHR configuration.

    Args:
        environment: Environment name (dev, staging, production)
        config_dir: Directory containing config files

    Returns:
        Complete validated configuration dictionary

    Raises:
        ConfigurationError: If configuration is invalid
    """
    loader = ConfigLoader(config_dir)
    config = loader.load(environment)
    loader.validate(config)
    return config


def print_config_summary(config: Dict[str, Any]) -> None:
    """Print a summary of the loaded configuration."""
    print("=" * 70)
    print("WintEHR Configuration Summary")
    print("=" * 70)
    print(f"Environment:      {config['deployment']['environment']}")
    print(f"Patient Count:    {config['deployment']['patient_count']}")
    print(f"SSL Enabled:      {config['deployment'].get('enable_ssl', False)}")

    if config['deployment'].get('enable_ssl'):
        print(f"Domain:           {config.get('ssl', {}).get('domain_name', 'N/A')}")

    print(f"\nServices:")
    ports = config.get('services', {}).get('ports', {})
    for service, port in ports.items():
        print(f"  {service:20s} → {port}")

    print(f"\nDatabase:")
    print(f"  Host:            {config['database']['host']}")
    print(f"  Port:            {config['database']['port']}")
    print(f"  Name:            {config['database']['name']}")

    if 'azure' in config:
        print(f"\nAzure:")
        print(f"  Resource Group:  {config['azure']['resource_group']}")
        print(f"  VM Name:         {config['azure']['vm_name']}")
        print(f"  Location:        {config['azure']['location']}")

    print("=" * 70)


if __name__ == '__main__':
    """Command-line interface for testing configuration loading."""
    try:
        config = load_config()
        print_config_summary(config)
        print("\n✅ Configuration loaded and validated successfully!")
    except ConfigurationError as e:
        print(f"\n❌ Configuration error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}", file=sys.stderr)
        sys.exit(1)
