# Data Management Module

## Overview
The Data Management Module handles data generation, import, validation, and maintenance for MedGenEMR. This module provides tools for managing Synthea synthetic data, DICOM image generation, and database operations, demonstrating best practices for healthcare data management.

## Architecture
```
Data Management Module
├── Data Generation/
│   ├── synthea_master.py
│   ├── synthea_config.py
│   └── patient_generator.py
├── Data Import/
│   ├── fhir_importer.py
│   ├── bundle_processor.py
│   └── resource_validator.py
├── Data Enhancement/
│   ├── enhance_imaging_import.py
│   ├── dicom_generator.py
│   └── reference_data.py
├── Data Validation/
│   ├── synthea_validator.py
│   ├── fhir_validator.py
│   └── integrity_checker.py
└── Database Operations/
    ├── migration_manager.py
    ├── backup_service.py
    └── maintenance_tasks.py
```

## Core Components

### Synthea Master Script (synthea_master.py)
**Purpose**: Orchestrate complete data lifecycle management

**Commands**:
```python
# Full workflow
python synthea_master.py full --count 50 --state California

# Individual operations
python synthea_master.py setup                    # Install/configure Synthea
python synthea_master.py generate --count 20      # Generate patients
python synthea_master.py import --mode light      # Import to database
python synthea_master.py validate                 # Validate data integrity
python synthea_master.py wipe                     # Clear all data
python synthea_master.py enhance                  # Add imaging data
```

**Full Workflow Implementation**:
```python
class SyntheaMaster:
    async def run_full_workflow(self, count: int = 10):
        """Complete data generation and import workflow"""
        logger.info(f"Starting full workflow for {count} patients")
        
        # Phase 1: Setup
        await self.setup_synthea()
        
        # Phase 2: Generate
        patients = await self.generate_patients(count)
        logger.info(f"Generated {len(patients)} patients")
        
        # Phase 3: Import with validation
        import_stats = await self.import_patients(
            patients,
            validation_mode="strict"
        )
        
        # Phase 4: Enhance with imaging
        if self.include_dicom:
            await self.enhance_imaging_data(patients)
        
        # Phase 5: Final validation
        validation_results = await self.validate_all_data()
        
        # Phase 6: Generate report
        await self.generate_import_report({
            "patients": len(patients),
            "resources": import_stats["total_resources"],
            "validation": validation_results
        })
        
        logger.info("Full workflow completed successfully")
```

### Patient Generation
**Purpose**: Configure and execute Synthea for realistic patient data

**Configuration Management**:
```python
class SyntheaConfig:
    def __init__(self, profile: str = "default"):
        self.profile = profile
        self.config = self.load_profile(profile)
    
    def get_generation_params(self, count: int) -> dict:
        return {
            "population": count,
            "seed": self.config.get("seed", 12345),
            "gender": self.config.get("gender_ratio", "50,50"),
            "age": self.config.get("age_range", "0-100"),
            "module_filters": self.get_module_filters(),
            "exporter.fhir.export": True,
            "exporter.ccda.export": False,
            "exporter.csv.export": False
        }
    
    def get_module_filters(self) -> list:
        """Get disease modules to include"""
        if self.profile == "chronic_disease":
            return ["diabetes", "hypertension", "heart_disease"]
        elif self.profile == "pediatric":
            return ["wellness_encounters", "immunizations", "asthma"]
        elif self.profile == "emergency":
            return ["injuries", "emergency_room"]
        return []  # All modules
```

**Patient Generation Process**:
```python
async def generate_patients(self, count: int, state: str = "Massachusetts"):
    # Configure Synthea
    config = SyntheaConfig(self.profile)
    params = config.get_generation_params(count)
    
    # Build command
    cmd = [
        "java", "-jar", "synthea.jar",
        "--population", str(count),
        "--state", state
    ]
    
    for key, value in params.items():
        if key != "population":
            cmd.extend([f"--{key}", str(value)])
    
    # Execute generation
    logger.info(f"Generating {count} patients in {state}")
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=self.synthea_path
    )
    
    stdout, stderr = await process.communicate()
    
    if process.returncode != 0:
        raise RuntimeError(f"Synthea generation failed: {stderr.decode()}")
    
    # Collect generated files
    output_dir = Path(self.synthea_path) / "output" / "fhir"
    patient_files = list(output_dir.glob("*.json"))
    
    logger.info(f"Generated {len(patient_files)} patient bundles")
    return patient_files
```

### FHIR Import Pipeline
**Purpose**: Process and import FHIR bundles with validation

**Bundle Processing**:
```python
class BundleProcessor:
    def __init__(self, storage: FHIRStorage, validator: FHIRValidator):
        self.storage = storage
        self.validator = validator
        self.import_stats = defaultdict(int)
    
    async def process_bundle(self, bundle_path: Path) -> ImportResult:
        """Process a single patient bundle"""
        logger.info(f"Processing bundle: {bundle_path.name}")
        
        # Load bundle
        with open(bundle_path) as f:
            bundle = json.load(f)
        
        if bundle["resourceType"] != "Bundle":
            raise ValueError("Not a valid FHIR Bundle")
        
        # Process entries in dependency order
        ordered_entries = self.order_by_dependencies(bundle["entry"])
        
        results = []
        for entry in ordered_entries:
            resource = entry["resource"]
            
            try:
                # Validate resource
                validation_result = await self.validator.validate(
                    resource["resourceType"],
                    resource
                )
                
                if validation_result.is_valid:
                    # Import resource
                    imported = await self.storage.create(
                        resource["resourceType"],
                        resource
                    )
                    
                    # Update references
                    self.update_references(
                        old_ref=entry["fullUrl"],
                        new_ref=f"{resource['resourceType']}/{imported['id']}"
                    )
                    
                    results.append(ImportSuccess(resource=imported))
                    self.import_stats[resource["resourceType"]] += 1
                else:
                    results.append(ImportError(
                        resource=resource,
                        errors=validation_result.errors
                    ))
                    self.import_stats["errors"] += 1
                    
            except Exception as e:
                logger.error(f"Failed to import {resource['resourceType']}: {e}")
                results.append(ImportError(resource=resource, errors=[str(e)]))
                self.import_stats["errors"] += 1
        
        return ImportResult(
            bundle_id=bundle_path.stem,
            total_resources=len(ordered_entries),
            successful=len([r for r in results if isinstance(r, ImportSuccess)]),
            failed=len([r for r in results if isinstance(r, ImportError)]),
            details=results
        )
    
    def order_by_dependencies(self, entries: list) -> list:
        """Order resources by dependencies (e.g., Patient before Encounter)"""
        priority_order = [
            "Organization",
            "Practitioner",
            "Patient",
            "Encounter",
            "Condition",
            "Procedure",
            "MedicationRequest",
            "Observation",
            "DiagnosticReport",
            "ImagingStudy"
        ]
        
        def get_priority(entry):
            resource_type = entry["resource"]["resourceType"]
            try:
                return priority_order.index(resource_type)
            except ValueError:
                return len(priority_order)
        
        return sorted(entries, key=get_priority)
```

### Data Enhancement
**Purpose**: Enhance imported data with additional clinical content

**Imaging Data Enhancement**:
```python
class ImagingEnhancer:
    def __init__(self, dicom_generator: DICOMGenerator):
        self.dicom_generator = dicom_generator
        self.study_templates = self.load_study_templates()
    
    async def enhance_patient_imaging(self, patient_id: str):
        """Add imaging studies based on patient conditions"""
        
        # Get patient conditions
        conditions = await self.get_patient_conditions(patient_id)
        
        # Determine appropriate imaging
        imaging_recommendations = self.get_imaging_recommendations(conditions)
        
        for recommendation in imaging_recommendations:
            # Create ImagingStudy resource
            imaging_study = await self.create_imaging_study(
                patient_id=patient_id,
                study_type=recommendation["type"],
                body_part=recommendation["body_part"],
                modality=recommendation["modality"]
            )
            
            # Generate DICOM files
            dicom_files = await self.dicom_generator.generate_study(
                study_uid=imaging_study["identifier"][0]["value"],
                patient_id=patient_id,
                study_type=recommendation["type"],
                num_series=recommendation["num_series"],
                images_per_series=recommendation["images_per_series"]
            )
            
            # Store DICOM files
            await self.store_dicom_files(dicom_files)
            
            logger.info(f"Created {recommendation['type']} study for patient {patient_id}")
    
    def get_imaging_recommendations(self, conditions: list) -> list:
        """Recommend imaging based on conditions"""
        recommendations = []
        
        for condition in conditions:
            condition_code = condition["code"]["coding"][0]["code"]
            
            # Chest conditions -> Chest X-ray
            if condition_code in ["233604007", "195967001"]:  # Pneumonia, Asthma
                recommendations.append({
                    "type": "chest_xray",
                    "modality": "DX",
                    "body_part": "CHEST",
                    "num_series": 2,
                    "images_per_series": 2
                })
            
            # Fractures -> X-ray of affected area
            elif "fracture" in condition["code"]["text"].lower():
                recommendations.append({
                    "type": "bone_xray",
                    "modality": "DX",
                    "body_part": self.extract_body_part(condition),
                    "num_series": 3,
                    "images_per_series": 2
                })
            
            # Neurological -> Brain MRI
            elif condition_code in ["230690007", "193093009"]:  # Stroke, Migraine
                recommendations.append({
                    "type": "brain_mri",
                    "modality": "MR",
                    "body_part": "HEAD",
                    "num_series": 5,
                    "images_per_series": 20
                })
        
        return recommendations
```

### Data Validation
**Purpose**: Ensure data integrity and FHIR compliance

**Validation Pipeline**:
```python
class DataValidator:
    def __init__(self):
        self.validators = {
            "structure": StructureValidator(),
            "cardinality": CardinalityValidator(),
            "terminology": TerminologyValidator(),
            "business": BusinessRuleValidator(),
            "reference": ReferenceValidator()
        }
    
    async def validate_all_resources(self) -> ValidationReport:
        """Comprehensive validation of all imported resources"""
        report = ValidationReport()
        
        # Get all resource types
        resource_types = await self.get_all_resource_types()
        
        for resource_type in resource_types:
            logger.info(f"Validating {resource_type} resources")
            
            # Get all resources of this type
            resources = await self.get_resources_by_type(resource_type)
            
            for resource in resources:
                # Run all validators
                for validator_name, validator in self.validators.items():
                    result = await validator.validate(resource)
                    
                    if not result.is_valid:
                        report.add_issue(
                            resource_type=resource_type,
                            resource_id=resource["id"],
                            validator=validator_name,
                            issues=result.issues
                        )
                
                # Check inter-resource consistency
                consistency_issues = await self.check_consistency(resource)
                if consistency_issues:
                    report.add_issue(
                        resource_type=resource_type,
                        resource_id=resource["id"],
                        validator="consistency",
                        issues=consistency_issues
                    )
            
            report.add_summary(resource_type, len(resources))
        
        return report
```

**Reference Validation**:
```python
class ReferenceValidator:
    async def validate(self, resource: dict) -> ValidationResult:
        """Validate all references in a resource"""
        issues = []
        
        # Find all reference fields
        references = self.extract_references(resource)
        
        for ref_path, reference in references:
            # Check reference format
            if not self.is_valid_reference_format(reference):
                issues.append({
                    "severity": "error",
                    "path": ref_path,
                    "message": f"Invalid reference format: {reference}"
                })
                continue
            
            # Check target exists
            target_exists = await self.check_reference_target(reference)
            if not target_exists:
                issues.append({
                    "severity": "error",
                    "path": ref_path,
                    "message": f"Reference target not found: {reference}"
                })
            
            # Check circular references
            if await self.has_circular_reference(resource, reference):
                issues.append({
                    "severity": "warning",
                    "path": ref_path,
                    "message": f"Circular reference detected: {reference}"
                })
        
        return ValidationResult(
            is_valid=len([i for i in issues if i["severity"] == "error"]) == 0,
            issues=issues
        )
```

### Database Operations

**Migration Management**:
```python
class MigrationManager:
    async def apply_migrations(self):
        """Apply database migrations in order"""
        applied = await self.get_applied_migrations()
        pending = self.get_pending_migrations(applied)
        
        for migration in pending:
            logger.info(f"Applying migration: {migration.name}")
            
            async with self.db.transaction():
                try:
                    await migration.up()
                    await self.record_migration(migration.name)
                    logger.info(f"Migration {migration.name} completed")
                except Exception as e:
                    logger.error(f"Migration {migration.name} failed: {e}")
                    raise
```

**Backup Service**:
```python
class BackupService:
    async def create_backup(self, backup_type: str = "full") -> str:
        """Create database backup"""
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        backup_name = f"medgenemr_{backup_type}_{timestamp}"
        
        if backup_type == "full":
            # Full database dump
            await self.dump_database(backup_name)
        elif backup_type == "incremental":
            # Only changes since last backup
            last_backup = await self.get_last_backup_timestamp()
            await self.dump_incremental(backup_name, since=last_backup)
        elif backup_type == "fhir":
            # FHIR resources only
            await self.export_fhir_bundle(backup_name)
        
        # Compress backup
        backup_file = await self.compress_backup(backup_name)
        
        # Upload to cloud storage
        if self.cloud_storage_enabled:
            await self.upload_to_cloud(backup_file)
        
        return backup_file
```

## Utility Functions

### Data Statistics
```python
class DataStatistics:
    async def generate_import_report(self) -> dict:
        """Generate comprehensive data statistics"""
        stats = {
            "timestamp": datetime.utcnow().isoformat(),
            "summary": {},
            "details": {},
            "quality_metrics": {}
        }
        
        # Resource counts
        for resource_type in SUPPORTED_RESOURCES:
            count = await self.count_resources(resource_type)
            stats["summary"][resource_type] = count
        
        # Patient demographics
        stats["details"]["demographics"] = await self.analyze_demographics()
        
        # Data quality metrics
        stats["quality_metrics"] = {
            "completeness": await self.calculate_completeness(),
            "reference_integrity": await self.check_reference_integrity(),
            "coding_accuracy": await self.validate_coding_systems()
        }
        
        return stats
```

### Data Cleanup
```python
class DataCleanup:
    async def cleanup_orphaned_resources(self):
        """Remove resources with broken references"""
        orphaned = await self.find_orphaned_resources()
        
        for resource in orphaned:
            logger.warning(
                f"Removing orphaned {resource['resourceType']}/{resource['id']}"
            )
            await self.soft_delete_resource(resource)
        
        return len(orphaned)
    
    async def deduplicate_resources(self):
        """Find and merge duplicate resources"""
        duplicates = await self.find_duplicates()
        
        for dup_group in duplicates:
            primary = self.select_primary_resource(dup_group)
            
            for duplicate in dup_group:
                if duplicate["id"] != primary["id"]:
                    await self.merge_resources(duplicate, primary)
```

## Integration Points

### FHIR API Integration
- Direct database access for bulk operations
- Validation using FHIR schemas
- Reference resolution
- Resource indexing

### External Tools
- Synthea for data generation
- DICOM tools for imaging
- Terminology services
- Cloud storage APIs

### System Integration
- Database connection pooling
- Async job processing
- Progress monitoring
- Error recovery

## Key Features

### Data Quality
- Comprehensive validation
- Reference integrity checking
- Terminology validation
- Business rule enforcement
- Data completeness metrics

### Performance
- Bulk import optimization
- Parallel processing
- Transaction batching
- Index management
- Memory-efficient streaming

### Flexibility
- Multiple import modes
- Configurable validation
- Custom data profiles
- Extensible pipelines
- Plugin architecture

## Educational Value

### Data Management
- ETL pipeline design
- Data validation strategies
- Bulk processing patterns
- Error handling
- Progress monitoring

### Healthcare Data
- FHIR bundle processing
- Synthea configuration
- Clinical data patterns
- Terminology management
- Privacy considerations

### System Design
- Async processing
- Transaction management
- Error recovery
- Monitoring/logging
- Performance optimization

## Missing Features & Improvements

### Planned Enhancements
- Real-time data streaming
- Change data capture
- Data lineage tracking
- Advanced deduplication
- Smart data generation

### Technical Improvements
- Distributed processing
- Cloud-native architecture
- Kubernetes jobs
- Event-driven pipelines
- ML-based validation

### Data Features
- Custom patient profiles
- Scenario-based generation
- Data subsetting
- Anonymization tools
- Test data generation

## Best Practices

### Data Import
- Validate before import
- Use transactions
- Handle errors gracefully
- Monitor progress
- Generate reports

### Data Quality
- Define quality metrics
- Automate validation
- Regular audits
- Fix issues promptly
- Document standards

### Performance
- Batch operations
- Use indexes wisely
- Monitor resources
- Optimize queries
- Plan capacity

## Module Dependencies
```
Data Management Module
├── FHIR API Module
├── Database Module
├── Validation Module
└── External Tools
    ├── Synthea
    ├── DICOM Toolkit
    ├── Terminology Services
    └── Cloud Storage
```

## Testing Strategy
- Unit tests for processors
- Integration tests with database
- Performance benchmarks
- Data quality tests
- End-to-end workflows