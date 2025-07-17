"""
Custom Hypothesis Strategies for FHIR Testing

Provides strategies for generating valid FHIR resources and search parameters
for property-based testing.
"""

from hypothesis import strategies as st
from hypothesis.strategies import SearchStrategy, composite
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional, Tuple
import string
import re


# FHIR Primitive Type Strategies

def fhir_id() -> SearchStrategy[str]:
    """Generate valid FHIR ID (alphanumeric, dash, dot, max 64 chars)"""
    return st.text(
        alphabet=string.ascii_letters + string.digits + '-.',
        min_size=1,
        max_size=64
    ).filter(lambda x: re.match(r'^[A-Za-z0-9\-\.]+$', x))


def fhir_string() -> SearchStrategy[str]:
    """Generate valid FHIR string"""
    return st.text(min_size=0, max_size=1000).filter(
        lambda x: not any(c in x for c in ['\x00', '\x01', '\x02'])  # No control chars
    )


def fhir_uri() -> SearchStrategy[str]:
    """Generate valid FHIR URI"""
    schemes = ['http', 'https', 'urn', 'oid']
    scheme = st.sampled_from(schemes)
    
    @composite
    def uri_strategy(draw):
        s = draw(scheme)
        if s in ['http', 'https']:
            domain = draw(st.text(alphabet=string.ascii_lowercase + '.', min_size=5, max_size=30))
            path = draw(st.text(alphabet=string.ascii_letters + string.digits + '/-', min_size=0, max_size=50))
            return f"{s}://{domain}{path}"
        elif s == 'urn':
            namespace = draw(st.sampled_from(['uuid', 'oid', 'isbn']))
            value = draw(st.text(alphabet=string.ascii_letters + string.digits + '-', min_size=5, max_size=30))
            return f"urn:{namespace}:{value}"
        else:  # oid
            numbers = draw(st.lists(st.integers(0, 999), min_size=3, max_size=10))
            return f"oid:{'.'.join(str(n) for n in numbers)}"
    
    return uri_strategy()


def fhir_date() -> SearchStrategy[str]:
    """Generate valid FHIR date (YYYY-MM-DD)"""
    return st.dates(
        min_value=date(1900, 1, 1),
        max_value=date(2100, 12, 31)
    ).map(lambda d: d.isoformat())


def fhir_datetime() -> SearchStrategy[str]:
    """Generate valid FHIR datetime"""
    return st.datetimes(
        min_value=datetime(1900, 1, 1),
        max_value=datetime(2100, 12, 31),
        timezones=st.none()
    ).map(lambda dt: dt.isoformat() + 'Z')


def fhir_instant() -> SearchStrategy[str]:
    """Generate valid FHIR instant (precise datetime)"""
    return st.datetimes(
        min_value=datetime(1900, 1, 1),
        max_value=datetime(2100, 12, 31),
        timezones=st.none()
    ).map(lambda dt: dt.isoformat(timespec='milliseconds') + 'Z')


def fhir_decimal() -> SearchStrategy[float]:
    """Generate valid FHIR decimal"""
    return st.floats(
        min_value=-999999999.999999,
        max_value=999999999.999999,
        allow_nan=False,
        allow_infinity=False
    )


def fhir_integer() -> SearchStrategy[int]:
    """Generate valid FHIR integer"""
    return st.integers(min_value=-2147483648, max_value=2147483647)


def fhir_positive_int() -> SearchStrategy[int]:
    """Generate valid FHIR positiveInt"""
    return st.integers(min_value=1, max_value=2147483647)


# FHIR Complex Type Strategies

def fhir_human_name() -> SearchStrategy[Dict[str, Any]]:
    """Generate valid HumanName"""
    uses = ['usual', 'official', 'temp', 'nickname', 'anonymous', 'old', 'maiden']
    
    return st.fixed_dictionaries({
        'use': st.one_of(st.none(), st.sampled_from(uses)),
        'family': st.one_of(st.none(), fhir_string()),
        'given': st.one_of(
            st.none(),
            st.lists(fhir_string(), min_size=1, max_size=3)
        ),
        'prefix': st.one_of(
            st.none(),
            st.lists(st.sampled_from(['Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Prof.']), max_size=2)
        ),
        'suffix': st.one_of(
            st.none(),
            st.lists(st.sampled_from(['Jr.', 'Sr.', 'III', 'PhD', 'MD']), max_size=2)
        )
    }).filter(lambda x: any(v for v in x.values() if v))  # At least one field


def fhir_identifier() -> SearchStrategy[Dict[str, Any]]:
    """Generate valid Identifier"""
    uses = ['usual', 'official', 'temp', 'secondary', 'old']
    systems = [
        'http://hl7.org/fhir/sid/us-ssn',
        'http://hl7.org/fhir/sid/us-npi',
        'http://example.org/mrn',
        'http://example.org/insurance'
    ]
    
    return st.fixed_dictionaries({
        'use': st.one_of(st.none(), st.sampled_from(uses)),
        'system': st.one_of(st.none(), st.sampled_from(systems)),
        'value': fhir_string()
    }, optional={'use': 0.5, 'system': 0.8})


def fhir_coding() -> SearchStrategy[Dict[str, Any]]:
    """Generate valid Coding"""
    systems = [
        'http://loinc.org',
        'http://snomed.info/sct',
        'http://www.nlm.nih.gov/research/umls/rxnorm',
        'http://terminology.hl7.org/CodeSystem/v3-ActCode'
    ]
    
    return st.fixed_dictionaries({
        'system': st.one_of(st.none(), st.sampled_from(systems)),
        'code': fhir_string(),
        'display': st.one_of(st.none(), fhir_string())
    }, optional={'system': 0.9, 'display': 0.7})


def fhir_codeable_concept() -> SearchStrategy[Dict[str, Any]]:
    """Generate valid CodeableConcept"""
    return st.fixed_dictionaries({
        'coding': st.one_of(
            st.none(),
            st.lists(fhir_coding(), min_size=1, max_size=3)
        ),
        'text': st.one_of(st.none(), fhir_string())
    }).filter(lambda x: x.get('coding') or x.get('text'))


def fhir_reference(target_types: Optional[List[str]] = None) -> SearchStrategy[Dict[str, Any]]:
    """Generate valid Reference"""
    if not target_types:
        target_types = ['Patient', 'Practitioner', 'Organization', 'Observation', 'Condition']
    
    @composite
    def reference_strategy(draw):
        target_type = draw(st.sampled_from(target_types))
        resource_id = draw(fhir_id())
        format_type = draw(st.sampled_from(['standard', 'urn_uuid', 'url']))
        
        if format_type == 'urn_uuid':
            reference = f"urn:uuid:{resource_id}"
        elif format_type == 'url':
            reference = f"http://example.org/{target_type}/{resource_id}"
        else:
            reference = f"{target_type}/{resource_id}"
        
        return {
            'reference': reference,
            'display': draw(st.one_of(st.none(), fhir_string()))
        }
    
    return reference_strategy()


def fhir_period(min_date: Optional[date] = None, max_date: Optional[date] = None) -> SearchStrategy[Dict[str, Any]]:
    """Generate valid Period"""
    if not min_date:
        min_date = date(1900, 1, 1)
    if not max_date:
        max_date = date(2100, 12, 31)
    
    @composite
    def period_strategy(draw):
        start_date = draw(st.dates(min_value=min_date, max_value=max_date))
        end_date = draw(st.one_of(
            st.none(),
            st.dates(min_value=start_date, max_value=max_date)
        ))
        
        period = {}
        if draw(st.booleans()):
            period['start'] = start_date.isoformat()
        if end_date and draw(st.booleans()):
            period['end'] = end_date.isoformat()
        
        return period if period else {'start': start_date.isoformat()}
    
    return period_strategy()


def fhir_quantity() -> SearchStrategy[Dict[str, Any]]:
    """Generate valid Quantity"""
    units = ['mg', 'g', 'kg', 'mL', 'L', 'mmHg', 'beats/minute', 'mg/dL', '%']
    comparators = ['<', '<=', '>=', '>']
    
    return st.fixed_dictionaries({
        'value': fhir_decimal(),
        'comparator': st.one_of(st.none(), st.sampled_from(comparators)),
        'unit': st.one_of(st.none(), st.sampled_from(units)),
        'system': st.one_of(st.none(), st.just('http://unitsofmeasure.org')),
        'code': st.one_of(st.none(), st.sampled_from(units))
    }, optional={'comparator': 0.1, 'unit': 0.9, 'system': 0.8, 'code': 0.7})


# Search Parameter Strategies

def search_string_value() -> SearchStrategy[str]:
    """Generate string search parameter values"""
    return st.one_of(
        fhir_string(),
        # Special cases for string search
        st.just(""),  # Empty string
        st.text(alphabet=string.ascii_letters + " '-", min_size=1, max_size=50),  # Names
        st.text(alphabet=string.printable, min_size=1, max_size=200),  # Any printable
    )


def search_token_value() -> SearchStrategy[str]:
    """Generate token search parameter values"""
    @composite
    def token_strategy(draw):
        format_type = draw(st.sampled_from(['simple', 'system_code', 'code_only', 'system_only']))
        
        if format_type == 'simple':
            return draw(st.text(alphabet=string.ascii_letters + string.digits + '-', min_size=1, max_size=50))
        elif format_type == 'system_code':
            system = draw(fhir_uri())
            code = draw(st.text(alphabet=string.ascii_letters + string.digits + '-', min_size=1, max_size=50))
            return f"{system}|{code}"
        elif format_type == 'code_only':
            code = draw(st.text(alphabet=string.ascii_letters + string.digits + '-', min_size=1, max_size=50))
            return f"|{code}"
        else:  # system_only
            system = draw(fhir_uri())
            return f"{system}|"
    
    return token_strategy()


def search_date_value() -> SearchStrategy[str]:
    """Generate date search parameter values with prefixes"""
    prefixes = ['', 'eq', 'ne', 'lt', 'le', 'gt', 'ge', 'sa', 'eb', 'ap']
    
    @composite
    def date_strategy(draw):
        prefix = draw(st.sampled_from(prefixes))
        date_val = draw(fhir_date())
        return f"{prefix}{date_val}" if prefix else date_val
    
    return date_strategy()


def search_number_value() -> SearchStrategy[str]:
    """Generate number search parameter values with prefixes"""
    prefixes = ['', 'eq', 'ne', 'lt', 'le', 'gt', 'ge', 'sa', 'eb', 'ap']
    
    @composite
    def number_strategy(draw):
        prefix = draw(st.sampled_from(prefixes))
        number = draw(st.floats(min_value=-1000000, max_value=1000000, allow_nan=False))
        return f"{prefix}{number}" if prefix else str(number)
    
    return number_strategy()


def search_reference_value(target_types: Optional[List[str]] = None) -> SearchStrategy[str]:
    """Generate reference search parameter values"""
    if not target_types:
        target_types = ['Patient', 'Practitioner', 'Organization', 'Observation']
    
    @composite
    def reference_strategy(draw):
        format_type = draw(st.sampled_from(['id_only', 'type_id', 'url']))
        resource_id = draw(fhir_id())
        
        if format_type == 'id_only':
            return resource_id
        elif format_type == 'type_id':
            resource_type = draw(st.sampled_from(target_types))
            return f"{resource_type}/{resource_id}"
        else:  # url
            resource_type = draw(st.sampled_from(target_types))
            return f"http://example.org/{resource_type}/{resource_id}"
    
    return reference_strategy()


def search_parameter_modifier(param_type: str) -> SearchStrategy[str]:
    """Generate valid search parameter modifiers based on type"""
    modifiers_by_type = {
        'string': ['', ':exact', ':contains'],
        'token': ['', ':text', ':not', ':above', ':below'],
        'reference': ['', ':missing', ':type'],
        'date': ['', ':missing'],
        'number': ['', ':missing'],
        'quantity': ['', ':missing']
    }
    
    return st.sampled_from(modifiers_by_type.get(param_type, ['']))


# Resource Strategies

@composite
def patient_resource(draw) -> Dict[str, Any]:
    """Generate a valid Patient resource"""
    gender = draw(st.sampled_from(['male', 'female', 'other', 'unknown']))
    
    patient = {
        'resourceType': 'Patient',
        'id': draw(fhir_id()),
        'active': draw(st.booleans()),
        'gender': gender
    }
    
    # Optional fields
    if draw(st.booleans()):
        patient['identifier'] = draw(st.lists(fhir_identifier(), min_size=1, max_size=3))
    
    if draw(st.booleans()):
        patient['name'] = draw(st.lists(fhir_human_name(), min_size=1, max_size=2))
    
    if draw(st.booleans()):
        patient['birthDate'] = draw(fhir_date())
    
    if draw(st.booleans()):
        patient['generalPractitioner'] = draw(st.lists(
            fhir_reference(['Practitioner', 'Organization']),
            min_size=1,
            max_size=2
        ))
    
    if draw(st.booleans()):
        patient['managingOrganization'] = draw(fhir_reference(['Organization']))
    
    return patient


@composite
def observation_resource(draw) -> Dict[str, Any]:
    """Generate a valid Observation resource"""
    status_values = ['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error']
    
    observation = {
        'resourceType': 'Observation',
        'id': draw(fhir_id()),
        'status': draw(st.sampled_from(status_values)),
        'code': draw(fhir_codeable_concept())
    }
    
    # Must have either subject or no subject (but commonly has subject)
    if draw(st.booleans(p=0.95)):
        observation['subject'] = draw(fhir_reference(['Patient', 'Group', 'Device', 'Location']))
    
    # Value[x] - different types of values
    value_type = draw(st.sampled_from(['Quantity', 'CodeableConcept', 'String', 'Boolean', 'Integer', 'Range']))
    if value_type == 'Quantity':
        observation['valueQuantity'] = draw(fhir_quantity())
    elif value_type == 'CodeableConcept':
        observation['valueCodeableConcept'] = draw(fhir_codeable_concept())
    elif value_type == 'String':
        observation['valueString'] = draw(fhir_string())
    elif value_type == 'Boolean':
        observation['valueBoolean'] = draw(st.booleans())
    elif value_type == 'Integer':
        observation['valueInteger'] = draw(fhir_integer())
    
    # Optional fields
    if draw(st.booleans()):
        observation['effectiveDateTime'] = draw(fhir_datetime())
    
    if draw(st.booleans()):
        observation['performer'] = draw(st.lists(
            fhir_reference(['Practitioner', 'Organization']),
            min_size=1,
            max_size=3
        ))
    
    if draw(st.booleans()):
        categories = [
            {'coding': [{'system': 'http://terminology.hl7.org/CodeSystem/observation-category', 'code': 'vital-signs'}]},
            {'coding': [{'system': 'http://terminology.hl7.org/CodeSystem/observation-category', 'code': 'laboratory'}]},
            {'coding': [{'system': 'http://terminology.hl7.org/CodeSystem/observation-category', 'code': 'imaging'}]},
        ]
        observation['category'] = draw(st.lists(st.sampled_from(categories), min_size=1, max_size=2))
    
    return observation


@composite
def practitioner_resource(draw) -> Dict[str, Any]:
    """Generate a valid Practitioner resource"""
    practitioner = {
        'resourceType': 'Practitioner',
        'id': draw(fhir_id()),
        'active': draw(st.booleans())
    }
    
    # Optional fields
    if draw(st.booleans()):
        practitioner['identifier'] = draw(st.lists(fhir_identifier(), min_size=1, max_size=2))
    
    if draw(st.booleans()):
        practitioner['name'] = draw(st.lists(fhir_human_name(), min_size=1, max_size=2))
    
    if draw(st.booleans()):
        practitioner['gender'] = draw(st.sampled_from(['male', 'female', 'other', 'unknown']))
    
    return practitioner


@composite
def organization_resource(draw) -> Dict[str, Any]:
    """Generate a valid Organization resource"""
    org_types = [
        {'coding': [{'system': 'http://terminology.hl7.org/CodeSystem/organization-type', 'code': 'prov'}]},
        {'coding': [{'system': 'http://terminology.hl7.org/CodeSystem/organization-type', 'code': 'dept'}]},
        {'coding': [{'system': 'http://terminology.hl7.org/CodeSystem/organization-type', 'code': 'team'}]},
    ]
    
    organization = {
        'resourceType': 'Organization',
        'id': draw(fhir_id()),
        'active': draw(st.booleans())
    }
    
    # Must have name or identifier
    has_name = draw(st.booleans())
    has_identifier = draw(st.booleans())
    
    if has_name or not has_identifier:
        organization['name'] = draw(fhir_string())
    
    if has_identifier or not has_name:
        organization['identifier'] = draw(st.lists(fhir_identifier(), min_size=1, max_size=2))
    
    # Optional fields
    if draw(st.booleans()):
        organization['type'] = draw(st.lists(st.sampled_from(org_types), min_size=1, max_size=2))
    
    if draw(st.booleans()):
        organization['partOf'] = draw(fhir_reference(['Organization']))
    
    return organization


# Search Query Strategies

@composite
def search_parameters(draw, resource_type: str) -> Dict[str, str]:
    """Generate valid search parameters for a resource type"""
    # Define common search parameters by resource type
    param_definitions = {
        'Patient': {
            '_id': 'token',
            'identifier': 'token',
            'name': 'string',
            'family': 'string',
            'given': 'string',
            'birthdate': 'date',
            'gender': 'token',
            'general-practitioner': 'reference',
            'organization': 'reference'
        },
        'Observation': {
            '_id': 'token',
            'code': 'token',
            'category': 'token',
            'status': 'token',
            'subject': 'reference',
            'patient': 'reference',
            'performer': 'reference',
            'value-quantity': 'quantity',
            'date': 'date'
        },
        'Practitioner': {
            '_id': 'token',
            'identifier': 'token',
            'name': 'string',
            'family': 'string',
            'given': 'string',
            'gender': 'token',
            'active': 'token'
        },
        'Organization': {
            '_id': 'token',
            'identifier': 'token',
            'name': 'string',
            'type': 'token',
            'active': 'token',
            'partof': 'reference'
        }
    }
    
    available_params = param_definitions.get(resource_type, {})
    if not available_params:
        return {}
    
    # Choose subset of parameters
    num_params = draw(st.integers(min_value=0, max_value=min(3, len(available_params))))
    selected_params = draw(st.lists(
        st.sampled_from(list(available_params.keys())),
        min_size=num_params,
        max_size=num_params,
        unique=True
    ))
    
    params = {}
    for param_name in selected_params:
        param_type = available_params[param_name]
        
        # Generate value based on type
        if param_type == 'string':
            value = draw(search_string_value())
            modifier = draw(search_parameter_modifier('string'))
        elif param_type == 'token':
            value = draw(search_token_value())
            modifier = draw(search_parameter_modifier('token'))
        elif param_type == 'date':
            value = draw(search_date_value())
            modifier = draw(search_parameter_modifier('date'))
        elif param_type == 'reference':
            value = draw(search_reference_value())
            modifier = draw(search_parameter_modifier('reference'))
        elif param_type == 'quantity':
            value = draw(search_number_value())
            modifier = draw(search_parameter_modifier('quantity'))
        else:
            value = draw(fhir_string())
            modifier = ''
        
        param_key = f"{param_name}{modifier}" if modifier else param_name
        params[param_key] = value
    
    return params


@composite
def chained_search_parameter(draw) -> Tuple[str, str]:
    """Generate a valid chained search parameter"""
    chains = [
        ('Patient', 'general-practitioner.name'),
        ('Patient', 'general-practitioner.identifier'),
        ('Patient', 'organization.name'),
        ('Patient', 'organization.partof.name'),
        ('Observation', 'patient.name'),
        ('Observation', 'patient.birthdate'),
        ('Observation', 'subject:Patient.name'),
        ('Observation', 'performer.name'),
        ('MedicationRequest', 'patient.general-practitioner.name'),
        ('Encounter', 'patient.organization.name')
    ]
    
    resource_type, chain = draw(st.sampled_from(chains))
    value = draw(search_string_value())
    
    return (f"{resource_type}?{chain}={value}", resource_type)


@composite
def include_parameter(draw) -> Tuple[str, List[str]]:
    """Generate valid _include parameters"""
    includes_by_resource = {
        'Patient': [
            'Patient:general-practitioner',
            'Patient:organization',
            'Patient:link'
        ],
        'Observation': [
            'Observation:subject',
            'Observation:patient',
            'Observation:performer',
            'Observation:encounter'
        ],
        'MedicationRequest': [
            'MedicationRequest:patient',
            'MedicationRequest:medication',
            'MedicationRequest:requester',
            'MedicationRequest:encounter'
        ],
        'Encounter': [
            'Encounter:patient',
            'Encounter:participant',
            'Encounter:service-provider',
            'Encounter:location'
        ]
    }
    
    resource_type = draw(st.sampled_from(list(includes_by_resource.keys())))
    available_includes = includes_by_resource[resource_type]
    
    num_includes = draw(st.integers(min_value=1, max_value=min(3, len(available_includes))))
    selected_includes = draw(st.lists(
        st.sampled_from(available_includes),
        min_size=num_includes,
        max_size=num_includes,
        unique=True
    ))
    
    return (resource_type, selected_includes)


@composite
def revinclude_parameter(draw) -> Tuple[str, List[str]]:
    """Generate valid _revinclude parameters"""
    revincludes_by_resource = {
        'Patient': [
            'Observation:patient',
            'Condition:patient',
            'MedicationRequest:patient',
            'Encounter:patient',
            'Procedure:patient'
        ],
        'Practitioner': [
            'Patient:general-practitioner',
            'Observation:performer',
            'Encounter:participant',
            'MedicationRequest:requester'
        ],
        'Organization': [
            'Patient:organization',
            'Patient:general-practitioner',
            'Organization:partof',
            'Encounter:service-provider'
        ],
        'Medication': [
            'MedicationRequest:medication',
            'MedicationAdministration:medication',
            'MedicationDispense:medication'
        ]
    }
    
    resource_type = draw(st.sampled_from(list(revincludes_by_resource.keys())))
    available_revincludes = revincludes_by_resource[resource_type]
    
    num_revincludes = draw(st.integers(min_value=1, max_value=min(3, len(available_revincludes))))
    selected_revincludes = draw(st.lists(
        st.sampled_from(available_revincludes),
        min_size=num_revincludes,
        max_size=num_revincludes,
        unique=True
    ))
    
    return (resource_type, selected_revincludes)


# Export commonly used strategies
__all__ = [
    # Primitive types
    'fhir_id', 'fhir_string', 'fhir_uri', 'fhir_date', 'fhir_datetime',
    'fhir_instant', 'fhir_decimal', 'fhir_integer', 'fhir_positive_int',
    
    # Complex types
    'fhir_human_name', 'fhir_identifier', 'fhir_coding', 'fhir_codeable_concept',
    'fhir_reference', 'fhir_period', 'fhir_quantity',
    
    # Search parameters
    'search_string_value', 'search_token_value', 'search_date_value',
    'search_number_value', 'search_reference_value', 'search_parameter_modifier',
    
    # Resources
    'patient_resource', 'observation_resource', 'practitioner_resource',
    'organization_resource',
    
    # Search queries
    'search_parameters', 'chained_search_parameter', 'include_parameter',
    'revinclude_parameter'
]