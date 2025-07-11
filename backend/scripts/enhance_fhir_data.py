#!/usr/bin/env python3
"""
Enhanced FHIR Data Generation
Creates Organizations, Providers, and cleans patient names
"""

import asyncio
import json
import random
import re
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

class FHIRDataEnhancer:
    def __init__(self, org_count: int = 5, provider_count: int = 10):
        self.org_count = org_count
        self.provider_count = provider_count
        
        # Realistic data for generation
        self.org_prefixes = ["City", "County", "Regional", "St.", "University", "Community"]
        self.org_suffixes = ["Hospital", "Medical Center", "Health System", "Clinic", "Healthcare"]
        
        self.first_names = {
            'male': ["James", "John", "Robert", "Michael", "William", "David", "Richard", 
                    "Joseph", "Thomas", "Charles", "Christopher", "Daniel", "Matthew"],
            'female': ["Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", 
                      "Susan", "Jessica", "Sarah", "Karen", "Nancy", "Lisa", "Margaret"]
        }
        
        self.last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", 
                          "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez",
                          "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore"]
        
        self.specialties = [
            ("General Practice", "208D00000X", "394814009"),
            ("Internal Medicine", "207R00000X", "419192003"),
            ("Pediatrics", "208000000X", "394537008"),
            ("Cardiology", "207RC0000X", "394579002"),
            ("Emergency Medicine", "207P00000X", "773568002"),
            ("Family Medicine", "207Q00000X", "419772000"),
            ("Psychiatry", "2084P0800X", "394587001"),
            ("Surgery", "208600000X", "394609007")
        ]
        
        self.cities = {
            "MA": ["Boston", "Cambridge", "Worcester", "Springfield", "Lowell"],
            "NY": ["New York", "Buffalo", "Rochester", "Albany", "Syracuse"],
            "CA": ["Los Angeles", "San Francisco", "San Diego", "Sacramento", "San Jose"],
            "TX": ["Houston", "Dallas", "Austin", "San Antonio", "Fort Worth"],
            "IL": ["Chicago", "Aurora", "Rockford", "Joliet", "Naperville"]
        }
    
    def clean_name(self, name: str) -> str:
        """Clean synthetic names by removing numbers and test patterns"""
        if not name:
            return ""
        
        # Remove numeric suffixes
        name = re.sub(r'\d+$', '', name)
        # Remove test patterns
        name = re.sub(r'(test|synthetic|demo)', '', name, flags=re.IGNORECASE)
        # Clean up extra spaces and underscores
        name = re.sub(r'[_\-]+', ' ', name)
        name = re.sub(r'\s+', ' ', name)
        name = name.strip()
        
        # If name is empty or single character after cleaning, generate new one
        if len(name) < 2:
            return None
        
        # Proper case
        return ' '.join(word.capitalize() for word in name.split())
    
    def generate_organizations(self) -> List[Dict[str, Any]]:
        """Generate realistic Organization resources"""
        organizations = []
        states = list(self.cities.keys())
        
        for i in range(self.org_count):
            state = random.choice(states)
            city = random.choice(self.cities[state])
            
            org_name = f"{random.choice(self.org_prefixes)} {city} {random.choice(self.org_suffixes)}"
            
            org = {
                "resourceType": "Organization",
                "id": str(uuid.uuid4()),
                "meta": {
                    "lastUpdated": datetime.utcnow().isoformat() + "Z"
                },
                "identifier": [{
                    "system": "http://hl7.org/fhir/sid/us-npi",
                    "value": f"1{random.randint(100000000, 999999999)}"
                }],
                "active": True,
                "type": [{
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/organization-type",
                        "code": "prov",
                        "display": "Healthcare Provider"
                    }]
                }],
                "name": org_name,
                "telecom": [
                    {
                        "system": "phone",
                        "value": f"({random.randint(200, 999)}) {random.randint(200, 999)}-{random.randint(1000, 9999)}",
                        "use": "work"
                    },
                    {
                        "system": "fax",
                        "value": f"({random.randint(200, 999)}) {random.randint(200, 999)}-{random.randint(1000, 9999)}",
                        "use": "work"
                    }
                ],
                "address": [{
                    "use": "work",
                    "type": "physical",
                    "line": [f"{random.randint(1, 9999)} {random.choice(['Main', 'Oak', 'Elm', 'Park', 'Washington'])} Street"],
                    "city": city,
                    "state": state,
                    "postalCode": f"{random.randint(10000, 99999)}",
                    "country": "USA"
                }]
            }
            
            organizations.append(org)
            logger.info(f"Generated Organization: {org_name}")
        
        return organizations
    
    def generate_providers(self, org_ids: List[str]) -> List[Dict[str, Any]]:
        """Generate realistic Practitioner resources"""
        practitioners = []
        
        for i in range(self.provider_count):
            gender = random.choice(['male', 'female'])
            first_name = random.choice(self.first_names[gender])
            last_name = random.choice(self.last_names)
            
            practitioner = {
                "resourceType": "Practitioner",
                "id": str(uuid.uuid4()),
                "meta": {
                    "lastUpdated": datetime.utcnow().isoformat() + "Z"
                },
                "identifier": [
                    {
                        "system": "http://hl7.org/fhir/sid/us-npi",
                        "value": f"2{random.randint(100000000, 999999999)}"
                    },
                    {
                        "system": "http://example.org/license",
                        "value": f"MD-{state}-{random.randint(10000, 99999)}"
                    }
                ],
                "active": True,
                "name": [{
                    "use": "official",
                    "family": last_name,
                    "given": [first_name],
                    "prefix": ["Dr."]
                }],
                "telecom": [{
                    "system": "phone",
                    "value": f"({random.randint(200, 999)}) {random.randint(200, 999)}-{random.randint(1000, 9999)}",
                    "use": "work"
                }],
                "gender": gender,
                "birthDate": (datetime.now() - timedelta(days=random.randint(10950, 21900))).strftime("%Y-%m-%d"),
                "qualification": [{
                    "identifier": [{
                        "system": "http://example.org/UniversityID",
                        "value": f"MD-{random.randint(1970, 2015)}"
                    }],
                    "code": {
                        "coding": [{
                            "system": "http://terminology.hl7.org/CodeSystem/v2-0360",
                            "code": "MD",
                            "display": "Doctor of Medicine"
                        }]
                    },
                    "issuer": {
                        "display": f"{random.choice(['Harvard', 'Johns Hopkins', 'Stanford', 'Yale', 'Columbia'])} Medical School"
                    }
                }]
            }
            
            practitioners.append(practitioner)
            logger.info(f"Generated Practitioner: Dr. {first_name} {last_name}")
        
        return practitioners
    
    def generate_practitioner_roles(self, practitioner_ids: List[str], org_ids: List[str]) -> List[Dict[str, Any]]:
        """Generate PractitionerRole resources linking practitioners to organizations"""
        roles = []
        
        for practitioner_id in practitioner_ids:
            org_id = random.choice(org_ids)
            specialty = random.choice(self.specialties)
            
            role = {
                "resourceType": "PractitionerRole",
                "id": str(uuid.uuid4()),
                "meta": {
                    "lastUpdated": datetime.utcnow().isoformat() + "Z"
                },
                "active": True,
                "period": {
                    "start": (datetime.now() - timedelta(days=random.randint(365, 3650))).strftime("%Y-%m-%d")
                },
                "practitioner": {
                    "reference": f"Practitioner/{practitioner_id}"
                },
                "organization": {
                    "reference": f"Organization/{org_id}"
                },
                "code": [{
                    "coding": [{
                        "system": "http://nucc.org/provider-taxonomy",
                        "code": specialty[1],
                        "display": specialty[0]
                    }]
                }],
                "specialty": [{
                    "coding": [{
                        "system": "http://snomed.info/sct",
                        "code": specialty[2],
                        "display": specialty[0]
                    }]
                }],
                "availableTime": [{
                    "daysOfWeek": ["mon", "tue", "wed", "thu", "fri"],
                    "availableStartTime": "09:00:00",
                    "availableEndTime": "17:00:00"
                }]
            }
            
            roles.append(role)
        
        return roles
    
    async def process_existing_patients(self) -> Dict[str, Any]:
        """Clean names of existing patients and assign providers"""
        import aiohttp
        
        cleaned_count = 0
        assigned_count = 0
        
        async with aiohttp.ClientSession() as session:
            # Get all patients
            async with session.get("http://localhost:8000/fhir/R4/Patient?_count=1000") as response:
                if response.status != 200:
                    logger.error(f"Failed to fetch patients: {response.status}")
                    return {"cleaned": 0, "assigned": 0}
                
                bundle = await response.json()
                patients = [entry["resource"] for entry in bundle.get("entry", [])]
                
                # Get available practitioners
                async with session.get("http://localhost:8000/fhir/R4/Practitioner?_count=1000") as prac_response:
                    if prac_response.status == 200:
                        prac_bundle = await prac_response.json()
                        practitioners = [entry["resource"]["id"] for entry in prac_bundle.get("entry", [])]
                    else:
                        practitioners = []
                
                # Process each patient
                for patient in patients:
                    patient_id = patient.get("id")
                    modified = False
                    
                    # Clean names
                    if "name" in patient:
                        for name in patient["name"]:
                            # Clean family name
                            if "family" in name:
                                cleaned_family = self.clean_name(name["family"])
                                if cleaned_family and cleaned_family != name["family"]:
                                    name["family"] = cleaned_family
                                    modified = True
                                elif not cleaned_family:
                                    name["family"] = random.choice(self.last_names)
                                    modified = True
                            
                            # Clean given names
                            if "given" in name:
                                cleaned_given = []
                                for given_name in name["given"]:
                                    cleaned = self.clean_name(given_name)
                                    if cleaned:
                                        cleaned_given.append(cleaned)
                                    else:
                                        # Generate new first name based on gender
                                        gender = patient.get("gender", "male")
                                        cleaned_given.append(random.choice(self.first_names.get(gender, self.first_names["male"])))
                                
                                if cleaned_given != name["given"]:
                                    name["given"] = cleaned_given
                                    modified = True
                    
                    # Assign general practitioner if not present
                    if practitioners and not patient.get("generalPractitioner"):
                        patient["generalPractitioner"] = [{
                            "reference": f"Practitioner/{random.choice(practitioners)}"
                        }]
                        modified = True
                        assigned_count += 1
                    
                    # Update patient if modified
                    if modified:
                        async with session.put(
                            f"http://localhost:8000/fhir/R4/Patient/{patient_id}",
                            json=patient,
                            headers={"Content-Type": "application/fhir+json"}
                        ) as update_response:
                            if update_response.status == 200:
                                cleaned_count += 1
                                logger.info(f"Updated patient {patient_id}")
                            else:
                                logger.error(f"Failed to update patient {patient_id}: {update_response.status}")
        
        return {"cleaned": cleaned_count, "assigned": assigned_count}
    
    async def generate_all(self) -> Dict[str, Any]:
        """Generate all enhanced data and return as transaction bundle"""
        logger.info("Starting enhanced FHIR data generation...")
        
        # Generate organizations
        organizations = self.generate_organizations()
        org_ids = [org["id"] for org in organizations]
        
        # Generate practitioners
        practitioners = self.generate_providers(org_ids)
        practitioner_ids = [prac["id"] for prac in practitioners]
        
        # Generate practitioner roles
        roles = self.generate_practitioner_roles(practitioner_ids, org_ids)
        
        # Create transaction bundle
        bundle = {
            "resourceType": "Bundle",
            "type": "transaction",
            "entry": []
        }
        
        # Add organizations
        for org in organizations:
            bundle["entry"].append({
                "resource": org,
                "request": {
                    "method": "POST",
                    "url": "Organization"
                }
            })
        
        # Add practitioners
        for prac in practitioners:
            bundle["entry"].append({
                "resource": prac,
                "request": {
                    "method": "POST",
                    "url": "Practitioner"
                }
            })
        
        # Add practitioner roles
        for role in roles:
            bundle["entry"].append({
                "resource": role,
                "request": {
                    "method": "POST",
                    "url": "PractitionerRole"
                }
            })
        
        logger.info(f"Generated bundle with {len(bundle['entry'])} resources")
        
        # Save bundle for reference
        with open("/app/scripts/data/enhanced_resources.json", "w") as f:
            json.dump(bundle, f, indent=2)
        
        return bundle

async def main():
    import sys
    
    org_count = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    provider_count = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    
    enhancer = FHIRDataEnhancer(org_count, provider_count)
    
    # Generate new resources
    bundle = await enhancer.generate_all()
    
    # Submit bundle to FHIR server
    import aiohttp
    async with aiohttp.ClientSession() as session:
        async with session.post(
            "http://localhost:8000/fhir/R4/",
            json=bundle,
            headers={"Content-Type": "application/fhir+json"}
        ) as response:
            if response.status == 200:
                result = await response.json()
                logger.info("✅ Successfully loaded enhanced resources")
            else:
                error = await response.text()
                logger.error(f"❌ Failed to load resources: {error}")
                return
    
    # Process existing patients
    logger.info("Processing existing patients...")
    stats = await enhancer.process_existing_patients()
    logger.info(f"✅ Cleaned {stats['cleaned']} patient names")
    logger.info(f"✅ Assigned {stats['assigned']} patients to practitioners")

if __name__ == "__main__":
    asyncio.run(main())
