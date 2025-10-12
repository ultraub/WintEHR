"""
FHIR Client Configuration for HAPI FHIR Integration

This module provides a configured fhirclient instance for accessing
the HAPI FHIR server. All Python services should use this client
instead of direct database access.
"""

import os
from typing import Optional
from fhirclient import client
from fhirclient.server import FHIRServer
import logging

logger = logging.getLogger(__name__)

# HAPI FHIR server configuration
HAPI_FHIR_BASE_URL = os.getenv('HAPI_FHIR_URL', 'http://hapi-fhir:8080/fhir')

# Global client instance (singleton pattern)
_fhir_client: Optional[client.FHIRClient] = None
_fhir_server: Optional[FHIRServer] = None


def get_fhir_client() -> client.FHIRClient:
    """
    Get configured FHIR client instance (singleton).

    Returns:
        FHIRClient: Configured client for HAPI FHIR server
    """
    global _fhir_client

    if _fhir_client is None:
        settings = {
            'app_id': 'wintehr_clinical_services',
            'api_base': HAPI_FHIR_BASE_URL
        }

        _fhir_client = client.FHIRClient(settings=settings)
        logger.info(f"FHIR client initialized for: {HAPI_FHIR_BASE_URL}")

    return _fhir_client


def get_fhir_server() -> FHIRServer:
    """
    Get FHIR server instance directly (for lower-level operations).

    Returns:
        FHIRServer: Server instance for direct API calls
    """
    global _fhir_server

    if _fhir_server is None:
        smart = get_fhir_client()
        _fhir_server = smart.server
        logger.info(f"FHIR server instance created for: {HAPI_FHIR_BASE_URL}")

    return _fhir_server


def search_resources(resource_type: str, params: dict) -> list:
    """
    Search for FHIR resources using the client.

    Args:
        resource_type: FHIR resource type (e.g., 'Patient', 'Observation')
        params: Search parameters as dict

    Returns:
        List of FHIR resource objects
    """
    server = get_fhir_server()

    # Import the appropriate model class dynamically
    module_name = resource_type.lower()
    try:
        mod = __import__(f'fhirclient.models.{module_name}', fromlist=[resource_type])
        resource_class = getattr(mod, resource_type)

        # Perform search
        search = resource_class.where(struct=params)
        results = search.perform_resources(server)

        return results if results else []

    except Exception as e:
        logger.error(f"Error searching {resource_type}: {e}")
        return []


def get_resource(resource_type: str, resource_id: str):
    """
    Get a specific FHIR resource by ID.

    Args:
        resource_type: FHIR resource type
        resource_id: Resource identifier

    Returns:
        FHIR resource object or None
    """
    server = get_fhir_server()

    # Import the appropriate model class dynamically
    module_name = resource_type.lower()
    try:
        mod = __import__(f'fhirclient.models.{module_name}', fromlist=[resource_type])
        resource_class = getattr(mod, resource_type)

        # Read resource
        resource = resource_class.read(resource_id, server)
        return resource

    except Exception as e:
        logger.error(f"Error reading {resource_type}/{resource_id}: {e}")
        return None


def create_resource(resource):
    """
    Create a new FHIR resource.

    Args:
        resource: FHIR resource object to create

    Returns:
        Created resource with server-assigned ID
    """
    server = get_fhir_server()

    try:
        result = resource.create(server)
        logger.info(f"Created {resource.resource_type}/{resource.id}")
        return result

    except Exception as e:
        logger.error(f"Error creating {resource.resource_type}: {e}")
        return None


def update_resource(resource):
    """
    Update an existing FHIR resource.

    Args:
        resource: FHIR resource object to update

    Returns:
        Updated resource
    """
    server = get_fhir_server()

    try:
        result = resource.update(server)
        logger.info(f"Updated {resource.resource_type}/{resource.id}")
        return result

    except Exception as e:
        logger.error(f"Error updating {resource.resource_type}/{resource.id}: {e}")
        return None


def delete_resource(resource_type: str, resource_id: str):
    """
    Delete a FHIR resource.

    Args:
        resource_type: FHIR resource type
        resource_id: Resource identifier

    Returns:
        True if deleted successfully, False otherwise
    """
    server = get_fhir_server()

    try:
        # Import the appropriate model class dynamically
        module_name = resource_type.lower()
        mod = __import__(f'fhirclient.models.{module_name}', fromlist=[resource_type])
        resource_class = getattr(mod, resource_type)

        # Delete resource
        resource_class.delete(resource_id, server)
        logger.info(f"Deleted {resource_type}/{resource_id}")
        return True

    except Exception as e:
        logger.error(f"Error deleting {resource_type}/{resource_id}: {e}")
        return False


# Convenience functions for common operations

def get_patient(patient_id: str):
    """Get patient by ID"""
    from fhirclient.models.patient import Patient
    server = get_fhir_server()
    return Patient.read(patient_id, server)


def search_patients(params: dict):
    """Search for patients"""
    return search_resources('Patient', params)


def search_conditions(patient_id: str, status: str = None):
    """Search conditions for a patient"""
    params = {'patient': f'Patient/{patient_id}'}
    if status:
        params['clinical-status'] = status
    return search_resources('Condition', params)


def search_medications(patient_id: str, status: str = None):
    """Search medication requests for a patient"""
    params = {'patient': f'Patient/{patient_id}'}
    if status:
        params['status'] = status
    return search_resources('MedicationRequest', params)


def search_observations(patient_id: str, category: str = None, code: str = None):
    """Search observations for a patient"""
    params = {'patient': f'Patient/{patient_id}'}
    if category:
        params['category'] = category
    if code:
        params['code'] = code
    return search_resources('Observation', params)


def search_allergies(patient_id: str):
    """Search allergies for a patient"""
    params = {'patient': f'Patient/{patient_id}'}
    return search_resources('AllergyIntolerance', params)


def patient_everything(patient_id: str):
    """
    Get all resources for a patient using $everything operation.

    Args:
        patient_id: Patient identifier

    Returns:
        Bundle of all patient resources
    """
    server = get_fhir_server()

    try:
        # Call $everything operation
        url = f"Patient/{patient_id}/$everything"
        bundle = server.request_json(url)
        return bundle

    except Exception as e:
        logger.error(f"Error in Patient/$everything for {patient_id}: {e}")
        return None
