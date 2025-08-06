#!/usr/bin/env python3
"""
FHIR MedicationRequest Compliance Validation Script
Validates MedicationRequest resources against FHIR R4 standards
"""

import json
import asyncio
import asyncpg
import logging
from datetime import datetime
from typing import Dict, List, Any, Tuple
import sys
import os
from rich.console import Console
from rich.table import Table
from rich import print as rprint
from rich.panel import Panel

console = Console()
logger = logging.getLogger(__name__)

class MedicationRequestValidator:
    def __init__(self):
        self.errors = []
        self.warnings = []
        self.info = []
        self.valid_statuses = ['active', 'on-hold', 'cancelled', 'completed', 'entered-in-error', 'stopped', 'draft', 'unknown']
        self.valid_intents = ['proposal', 'plan', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option']
        self.valid_priorities = ['routine', 'urgent', 'asap', 'stat']
        
    def validate_medication_request(self, resource: Dict[str, Any]) -> Tuple[bool, List[str], List[str]]:
        """Validate a single MedicationRequest resource"""
        self.errors = []
        self.warnings = []
        self.info = []
        
        # Check resource type
        if resource.get('resourceType') != 'MedicationRequest':
            self.errors.append(f"Invalid resourceType: {resource.get('resourceType')}")
            return False, self.errors, self.warnings
        
        # Required fields
        if not resource.get('status'):
            self.errors.append("Missing required field: status")
        elif resource['status'] not in self.valid_statuses:
            self.errors.append(f"Invalid status: {resource['status']}")
        
        if not resource.get('intent'):
            self.errors.append("Missing required field: intent")
        elif resource['intent'] not in self.valid_intents:
            self.errors.append(f"Invalid intent: {resource['intent']}")
        
        if not resource.get('subject'):
            self.errors.append("Missing required field: subject (patient reference)")
        elif not resource['subject'].get('reference'):
            self.errors.append("Subject must have a reference")
        
        # Medication must be specified
        if not resource.get('medicationCodeableConcept') and not resource.get('medicationReference'):
            self.errors.append("Either medicationCodeableConcept or medicationReference must be specified")
        
        # Validate medication coding
        if resource.get('medicationCodeableConcept'):
            self._validate_medication_codeable_concept(resource['medicationCodeableConcept'])
        
        # Validate dosage instructions
        if resource.get('dosageInstruction'):
            for idx, dosage in enumerate(resource['dosageInstruction']):
                self._validate_dosage_instruction(dosage, idx)
        else:
            self.warnings.append("No dosageInstruction provided")
        
        # Validate dispense request
        if resource.get('dispenseRequest'):
            self._validate_dispense_request(resource['dispenseRequest'])
        
        # Validate dates
        if resource.get('authoredOn'):
            self._validate_datetime(resource['authoredOn'], 'authoredOn')
        
        # Validate requester
        if resource.get('requester'):
            if not resource['requester'].get('reference'):
                self.warnings.append("Requester should have a reference")
        else:
            self.warnings.append("No requester specified")
        
        # Check for CDS integration fields
        if resource.get('extension'):
            self._validate_extensions(resource['extension'])
        
        # Priority validation
        if resource.get('priority') and resource['priority'] not in self.valid_priorities:
            self.warnings.append(f"Non-standard priority value: {resource['priority']}")
        
        return len(self.errors) == 0, self.errors, self.warnings
    
    def _validate_medication_codeable_concept(self, concept: Dict[str, Any]):
        """Validate medicationCodeableConcept"""
        if not concept.get('text') and not concept.get('coding'):
            self.warnings.append("MedicationCodeableConcept should have either text or coding")
        
        if concept.get('coding'):
            for coding in concept['coding']:
                if not coding.get('code'):
                    self.warnings.append("Coding should have a code")
                if not coding.get('system'):
                    self.warnings.append("Coding should have a system (e.g., RxNorm)")
    
    def _validate_dosage_instruction(self, dosage: Dict[str, Any], idx: int):
        """Validate dosageInstruction"""
        if not dosage.get('text'):
            self.warnings.append(f"DosageInstruction[{idx}] should have text description")
        
        if dosage.get('timing'):
            timing = dosage['timing']
            if timing.get('repeat'):
                repeat = timing['repeat']
                if repeat.get('frequency') and not repeat.get('period'):
                    self.warnings.append(f"DosageInstruction[{idx}].timing.repeat has frequency but no period")
        
        if dosage.get('route'):
            if not dosage['route'].get('coding') and not dosage['route'].get('text'):
                self.warnings.append(f"DosageInstruction[{idx}].route should have coding or text")
    
    def _validate_dispense_request(self, dispense: Dict[str, Any]):
        """Validate dispenseRequest"""
        if dispense.get('quantity'):
            quantity = dispense['quantity']
            if not quantity.get('value'):
                self.warnings.append("DispenseRequest.quantity should have a value")
            if not quantity.get('unit'):
                self.warnings.append("DispenseRequest.quantity should have a unit")
        
        if dispense.get('numberOfRepeatsAllowed') is not None:
            if not isinstance(dispense['numberOfRepeatsAllowed'], int) or dispense['numberOfRepeatsAllowed'] < 0:
                self.errors.append("DispenseRequest.numberOfRepeatsAllowed must be a non-negative integer")
    
    def _validate_datetime(self, dt_string: str, field_name: str):
        """Validate datetime format"""
        try:
            # FHIR datetime format
            datetime.fromisoformat(dt_string.replace('Z', '+00:00'))
        except:
            self.errors.append(f"{field_name} has invalid datetime format: {dt_string}")
    
    def _validate_extensions(self, extensions: List[Dict[str, Any]]):
        """Validate custom extensions"""
        for ext in extensions:
            if not ext.get('url'):
                self.errors.append("Extension must have a url")
            
            # Check for prescription status extension
            if ext.get('url') == 'http://example.org/fhir/prescription-status':
                if not ext.get('valueCode'):
                    self.warnings.append("Prescription status extension should have valueCode")
                self.info.append("Found prescription status tracking extension")

async def validate_all_medication_requests(conn):
    """Validate all MedicationRequest resources in the database"""
    validator = MedicationRequestValidator()
    
    # Get all MedicationRequest resources
    query = """
        SELECT id, resource
        FROM fhir.resources
        WHERE resource_type = 'MedicationRequest'
        AND deleted = FALSE
    """
    resources = await conn.fetch(query)
    
    console.print(Panel(f"[bold]Validating {len(resources)} MedicationRequest resources[/bold]"))
    
    # Statistics
    total = len(resources)
    valid = 0
    invalid = 0
    warnings_count = 0
    
    # Create results table
    table = Table(title="Validation Results")
    table.add_column("Resource ID", style="cyan")
    table.add_column("Status", style="green")
    table.add_column("Errors", style="red")
    table.add_column("Warnings", style="yellow")
    
    validation_details = []
    
    for resource in resources:
        # Parse JSON if it's a string
        resource_data = resource['resource']
        if isinstance(resource_data, str):
            resource_data = json.loads(resource_data)
        is_valid, errors, warnings = validator.validate_medication_request(resource_data)
        
        if is_valid:
            valid += 1
            status = " Valid"
            status_style = "green"
        else:
            invalid += 1
            status = " Invalid"
            status_style = "red"
        
        if warnings:
            warnings_count += 1
        
        # Add to table if there are issues
        if errors or warnings:
            table.add_row(
                str(resource['id']),
                f"[{status_style}]{status}[/{status_style}]",
                "\n".join(errors) if errors else "None",
                "\n".join(warnings) if warnings else "None"
            )
        
        validation_details.append({
            'id': str(resource['id']),
            'is_valid': is_valid,
            'errors': errors,
            'warnings': warnings,
            'info': validator.info
        })
    
    # Display results
    console.print(table)
    
    # Summary statistics
    summary = Table(title="Validation Summary")
    summary.add_column("Metric", style="bold")
    summary.add_column("Value", justify="right")
    
    summary.add_row("Total Resources", str(total))
    summary.add_row("Valid", f"[green]{valid}[/green]")
    summary.add_row("Invalid", f"[red]{invalid}[/red]")
    summary.add_row("With Warnings", f"[yellow]{warnings_count}[/yellow]")
    summary.add_row("Compliance Rate", f"{(valid/total*100):.1f}%" if total > 0 else "N/A")
    
    console.print(summary)
    
    # Check CDS integration
    cds_integrated = sum(1 for detail in validation_details if any('prescription status tracking' in info for info in detail['info']))
    console.print(f"\n[bold]CDS Integration:[/bold] {cds_integrated} resources have prescription status tracking")
    
    return validation_details

async def validate_cds_integration():
    """Validate CDS hooks integration for medication prescribing"""
    console.print(Panel("[bold]Validating CDS Hooks Integration[/bold]"))
    
    # Check if CDS hooks are properly configured
    cds_checks = {
        "Drug Interaction Check": False,
        "Allergy Check": False,
        "Age-Based Dosing": False,
        "Duplicate Therapy": False,
        "Renal Dosing": False
    }
    
    # This would normally check the actual CDS hooks configuration
    # For now, we'll simulate the check
    import aiohttp
    
    try:
        async with aiohttp.ClientSession() as session:
            # Check CDS hooks discovery endpoint
            async with session.get('http://localhost:8000/cds-services') as response:
                if response.status == 200:
                    hooks_data = await response.json()
                    services = hooks_data.get('services', [])
                    
                    for service in services:
                        if 'drug-interaction' in service.get('id', ''):
                            cds_checks['Drug Interaction Check'] = True
                        if 'allergy-check' in service.get('id', ''):
                            cds_checks['Allergy Check'] = True
                        if 'age-dosing' in service.get('id', ''):
                            cds_checks['Age-Based Dosing'] = True
    except Exception as e:
        console.print(f"[red]Error checking CDS hooks: {e}[/red]")
    
    # Display CDS integration status
    table = Table(title="CDS Hooks Status")
    table.add_column("Hook", style="cyan")
    table.add_column("Status", justify="center")
    
    for hook, status in cds_checks.items():
        table.add_row(
            hook,
            "[green] Active[/green]" if status else "[red] Inactive[/red]"
        )
    
    console.print(table)

async def generate_compliance_report(validation_details: List[Dict[str, Any]]):
    """Generate a detailed compliance report"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = f"medication_request_compliance_report_{timestamp}.json"
    
    report = {
        "timestamp": datetime.now().isoformat(),
        "summary": {
            "total_resources": len(validation_details),
            "valid": sum(1 for d in validation_details if d['is_valid']),
            "invalid": sum(1 for d in validation_details if not d['is_valid']),
            "with_warnings": sum(1 for d in validation_details if d['warnings'])
        },
        "details": validation_details,
        "common_issues": {}
    }
    
    # Analyze common issues
    all_errors = []
    all_warnings = []
    for detail in validation_details:
        all_errors.extend(detail['errors'])
        all_warnings.extend(detail['warnings'])
    
    # Count occurrences
    from collections import Counter
    error_counts = Counter(all_errors)
    warning_counts = Counter(all_warnings)
    
    report['common_issues']['errors'] = dict(error_counts.most_common(10))
    report['common_issues']['warnings'] = dict(warning_counts.most_common(10))
    
    # Save report
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    console.print(f"\n[green]Compliance report saved to: {report_path}[/green]")

async def main():
    """Main function"""
    console.print(Panel("[bold cyan]FHIR MedicationRequest Compliance Validator[/bold cyan]"))
    
    # Database connection
    DATABASE_URL = 'postgresql://emr_user:emr_password@postgres:5432/emr_db'
    
    # Create connection
    conn = await asyncpg.connect(DATABASE_URL)
    
    try:
        # Validate all MedicationRequest resources
        validation_details = await validate_all_medication_requests(conn)
        
        # Validate CDS integration
        await validate_cds_integration()
        
        # Generate compliance report
        if validation_details:
            await generate_compliance_report(validation_details)
        
        console.print("\n[bold green]Validation complete![/bold green]")
    
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())