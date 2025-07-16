"""
Synthea FHIR Bundle Importer

Imports Synthea-generated FHIR bundles directly into the FHIR storage.
Processes bundles as transactions to maintain referential integrity.
"""

import os
import json
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from core.fhir.storage import FHIRStorageEngine
from core.fhir.validator import FHIRValidator
from core.fhir.profile_transformer import ProfileAwareFHIRTransformer
from api.services.fhir.search_indexer import SearchParameterIndexer
from database import DATABASE_URL
from core.fhir.resources_r4b import Bundle, construct_fhir_element
import logging



class SyntheaFHIRImporter:
    """
    Imports Synthea-generated FHIR bundles into the database.
    
    Handles:
    - Bundle validation
    - Resource extraction and storage
    - Reference resolution
    - Search parameter indexing
    - Error handling and logging
    """
    
    def __init__(self, db_url: Optional[str] = None):
        """Initialize importer with database connection."""
        self.db_url = db_url or DATABASE_URL
        self.engine = create_async_engine(self.db_url, echo=False)
        self.async_session = async_sessionmaker(self.engine, class_=AsyncSession)
        
        # Initialize transformer
        self.transformer = ProfileAwareFHIRTransformer(strict_mode=False)
        
        # Statistics
        self.stats = {
            "bundles_processed": 0,
            "resources_imported": 0,
            "transformation_errors": 0,
            "validation_errors": 0,
            "errors": [],
            "resource_counts": {}
        }
    
    async def import_directory(self, directory_path: str) -> Dict[str, Any]:
        """
        Import all FHIR bundles from a directory.
        
        Args:
            directory_path: Path to directory containing FHIR bundle JSON files
            
        Returns:
            Import statistics
        """
        path = Path(directory_path)
        if not path.exists():
            raise ValueError(f"Directory not found: {directory_path}")
        
        # Find all JSON files
        bundle_files = list(path.glob("*.json"))
        logging.info(f"Found {len(bundle_files)} JSON files to process")
        # Process each bundle
        for bundle_file in bundle_files:
            try:
                await self.import_bundle_file(str(bundle_file))
            except Exception as e:
                self.stats["errors"].append({
                    "file": str(bundle_file),
                    "error": str(e)
                })
                logging.error(f"Error processing {bundle_file}: {e}")
        return self.stats
    
    async def import_bundle_file(self, file_path: str) -> None:
        """
        Import a single FHIR bundle file.
        
        Args:
            file_path: Path to FHIR bundle JSON file
        """
        logging.info(f"Processing bundle: {file_path}")
        # Read and parse bundle
        with open(file_path, 'r') as f:
            bundle_data = json.load(f)
        
        # Validate it's a bundle
        if bundle_data.get('resourceType') != 'Bundle':
            raise ValueError(f"File does not contain a FHIR Bundle: {file_path}")
        
        # Transform bundle using profile-aware transformer
        try:
            logging.info("Transforming bundle for profile compatibility...")
            transformed_bundle = self.transformer.transform_bundle(bundle_data)
            
            # Try parsing the transformed bundle
            bundle = Bundle.parse_obj(transformed_bundle)
            logging.info("Bundle validated successfully after transformation")
        except Exception as e:
            # If transformation fails, try direct parsing
            error_msg = str(e).split('\n')[0][:200]
            logging.error(f"Bundle transformation failed: {error_msg}...")
            try:
                bundle = Bundle.parse_obj(bundle_data)
                logging.info("Original bundle validated successfully")
            except Exception as e2:
                logging.error(f"Bundle validation failed, using raw data. Error: {str(e2)[:200]}...")
                bundle = bundle_data  # Use raw dict as fallback
                self.stats["transformation_errors"] += 1
        
        # Process the bundle
        async with self.async_session() as session:
            storage = FHIRStorageEngine(session)
            validator = FHIRValidator()
            indexer = SearchParameterIndexer(session)
            
            # Check bundle type
            bundle_type = bundle.type if hasattr(bundle, 'type') else bundle.get('type')
            
            if bundle_type in ["transaction", "batch"]:
                # Process as transaction/batch
                await self._process_transaction_bundle(
                    bundle, storage, validator, indexer, session
                )
            elif bundle_type == "collection":
                # Process as collection
                await self._process_collection_bundle(
                    bundle, storage, validator, indexer, session
                )
            else:
                raise ValueError(f"Unsupported bundle type: {bundle_type}")
        
        self.stats["bundles_processed"] += 1
    
    async def _process_transaction_bundle(
        self,
        bundle,  # Can be Bundle or dict
        storage: FHIRStorageEngine,
        validator: FHIRValidator,
        indexer: SearchParameterIndexer,
        session: AsyncSession
    ) -> None:
        """Process a transaction bundle."""
        # If bundle is a dict, process it as a collection instead
        if isinstance(bundle, dict):
            logging.info("Transaction bundle is raw dict, processing as collection")
            await self._process_collection_bundle(
                bundle, storage, validator, indexer, session
            )
            return
            
        # Use storage engine's bundle processor for proper Bundle objects
        try:
            response_bundle = await storage.process_bundle(bundle)
            
            # Count resources by type
            for entry in bundle.entry or []:
                if entry.resource:
                    resource_type = entry.resource.resource_type
                    self.stats["resource_counts"][resource_type] = \
                        self.stats["resource_counts"].get(resource_type, 0) + 1
                    self.stats["resources_imported"] += 1
            
            logging.info(f"Successfully imported bundle with {len(bundle.entry or [])} entries")
        except Exception as e:
            await session.rollback()
            raise Exception(f"Failed to process bundle: {e}")
    
    async def _process_collection_bundle(
        self,
        bundle,  # Can be Bundle or dict
        storage: FHIRStorageEngine,
        validator: FHIRValidator,
        indexer: SearchParameterIndexer,
        session: AsyncSession
    ) -> None:
        """Process a collection bundle (import each resource individually)."""
        # Handle both Bundle objects and raw dicts
        entries = bundle.entry if hasattr(bundle, 'entry') else bundle.get('entry', [])
        if not entries:
            return
        
        # First pass: collect all resources and generate IDs
        resource_map = {}  # old_id -> new_id mapping
        resources_to_import = []
        
        for entry in entries:
            # Handle both Entry objects and raw dicts
            if hasattr(entry, 'resource'):
                resource = entry.resource
                if resource:
                    resource_data = resource.dict(exclude_none=True)
                    resource_type = resource.resource_type
                else:
                    continue
            elif isinstance(entry, dict) and 'resource' in entry:
                resource_data = entry['resource']
                resource_type = resource_data.get('resourceType')
                if not resource_type:
                    continue
            else:
                continue
            
            # Generate new ID if needed
            old_id = resource_data.get('id')
            if old_id:
                # Keep the same ID for Synthea data
                new_id = old_id
                resource_map[f"{resource_type}/{old_id}"] = \
                    f"{resource_type}/{new_id}"
            
            resources_to_import.append((resource_type, resource_data))
        
        # Second pass: update references and import
        for resource_type, resource_data in resources_to_import:
            try:
                # Update internal references
                self._update_references(resource_data, resource_map)
                
                # Transform resource for strict validation
                try:
                    logging.info(f"About to transform {resource_type} with ID {resource_data.get('id', 'unknown')}")
                    # Debug: check if transformer detects the resource properly
                    handler = self.transformer.detect_profile(resource_data)
                    logging.info(f"  Detected handler: {type(handler).__name__ if handler else 'None'}")
                    transformed_resource = self.transformer.transform_resource(resource_data)
                    logging.info(f"  ✅ Transformed {resource_type}")
                    # Debug: check if key transformations happened
                    if resource_type == 'Encounter':
                        original_class = resource_data.get('class')
                        new_class = transformed_resource.get('class')
                        new_actual_period = transformed_resource.get('actualPeriod')
                        new_reason = transformed_resource.get('reason')
                        
                        logging.info(f"    Original class: {original_class}")
                        logging.info(f"    Transformed class: {new_class}")
                        logging.info(f"    Transformed actualPeriod: {bool(new_actual_period)}")
                        logging.info(f"    Transformed reason: {bool(new_reason)}")
                        original_participant = resource_data.get('participant', [{}])[0].get('individual') if resource_data.get('participant') else None
                        new_participant = transformed_resource.get('participant', [{}])[0].get('actor') if transformed_resource.get('participant') else None  
                        logging.info(f"    participant: individual={bool(original_participant)} -> actor={bool(new_participant)}")
                        # Check if transformations are actually happening
                        if original_class == new_class:
                            logging.warning(f"    ⚠️  WARNING: class field was NOT transformed!")
                        if 'period' in transformed_resource:
                            logging.warning(f"    ⚠️  WARNING: period field still exists (should be actualPeriod)!")
                        if 'reasonCode' in transformed_resource:
                            logging.warning(f"    ⚠️  WARNING: reasonCode field still exists (should be reason)!")
                except Exception as transform_error:
                    logging.error(f"  ❌ Transformation error for {resource_type}: {transform_error}")
                    import traceback
                    traceback.print_exc()
                    transformed_resource = resource_data
                    self.stats["transformation_errors"] += 1
                
                # Validate transformed resource
                try:
                    validation_result = validator.validate_resource(
                        resource_type, transformed_resource
                    )
                    
                    # Check for errors
                    has_error = any(
                        issue.severity in ["error", "fatal"]
                        for issue in validation_result.issue
                    )
                    
                    if has_error:
                        logging.error(f"Validation error for {resource_type}: {[i.diagnostics for i in validation_result.issue if i.severity in ['error', 'fatal']]}")
                        self.stats["validation_errors"] += 1
                        # Continue with transformed resource - DON'T fall back to original
                        logging.error(f"  ⚠️  Continuing with transformed resource despite validation errors")
                except Exception as validation_error:
                    logging.error(f"Validation exception for {resource_type}: {validation_error}")
                    self.stats["validation_errors"] += 1
                    # Use transformed resource even if validation fails
                    logging.error(f"  ⚠️  Continuing with transformed resource despite validation exception")
                # Create resource (use transformed version)
                fhir_id, version_id, last_updated = await storage.create_resource(
                    resource_type,
                    transformed_resource
                )
                
                # Update stats
                self.stats["resource_counts"][resource_type] = \
                    self.stats["resource_counts"].get(resource_type, 0) + 1
                self.stats["resources_imported"] += 1
                
            except Exception as e:
                self.stats["errors"].append({
                    "resource": f"{resource_type}/{resource_data.get('id')}",
                    "error": str(e)
                })
                logging.error(f"Error importing {resource_type}: {e}")
        # Commit all resources
        await session.commit()
        logging.info(f"Imported {len(resources_to_import)} resources from collection bundle")
    def _update_references(
        self,
        resource_data: Dict[str, Any],
        resource_map: Dict[str, str]
    ) -> None:
        """Update references in a resource to use new IDs."""
        if isinstance(resource_data, dict):
            for key, value in resource_data.items():
                if key == "reference" and isinstance(value, str):
                    # Check if this reference needs updating
                    if value in resource_map:
                        resource_data[key] = resource_map[value]
                    elif value.startswith("urn:uuid:"):
                        # Handle UUID references
                        for old_ref, new_ref in resource_map.items():
                            if value.endswith(old_ref.split("/")[1]):
                                resource_data[key] = new_ref
                                break
                elif isinstance(value, (dict, list)):
                    self._update_references(value, resource_map)
        elif isinstance(resource_data, list):
            for item in resource_data:
                if isinstance(item, (dict, list)):
                    self._update_references(item, resource_map)
    
    async def import_single_patient(
        self,
        patient_bundle_path: str
    ) -> Dict[str, Any]:
        """
        Import a single patient bundle.
        
        Useful for testing or selective imports.
        """
        await self.import_bundle_file(patient_bundle_path)
        return self.stats
    
    async def validate_import(self) -> Dict[str, Any]:
        """
        Validate the imported data by checking resource counts and references.
        """
        validation_results = {
            "resource_counts": {},
            "broken_references": [],
            "search_index_coverage": {}
        }
        
        async with self.async_session() as session:
            # Count resources by type
            count_query = """
                SELECT resource_type, COUNT(*) as count
                FROM fhir.resources
                WHERE deleted = false
                GROUP BY resource_type
                ORDER BY resource_type
            """
            
            from sqlalchemy import text
            result = await session.execute(text(count_query))
            
            for row in result:
                validation_results["resource_counts"][row.resource_type] = row.count
            
            # Check for broken references
            ref_check_query = """
                SELECT 
                    r1.resource_type as source_type,
                    r1.fhir_id as source_id,
                    ref.target_type,
                    ref.target_id
                FROM fhir.references ref
                JOIN fhir.resources r1 ON ref.source_id = r1.id
                LEFT JOIN fhir.resources r2 
                    ON ref.target_type = r2.resource_type 
                    AND ref.target_id = r2.fhir_id
                WHERE r2.id IS NULL
                LIMIT 100
            """
            
            result = await session.execute(text(ref_check_query))
            
            for row in result:
                validation_results["broken_references"].append({
                    "source": f"{row.source_type}/{row.source_id}",
                    "target": f"{row.target_type}/{row.target_id}"
                })
            
            # Check search index coverage
            index_query = """
                SELECT 
                    r.resource_type,
                    COUNT(DISTINCT r.id) as resource_count,
                    COUNT(DISTINCT sp.resource_id) as indexed_count
                FROM fhir.resources r
                LEFT JOIN fhir.search_params sp ON r.id = sp.resource_id
                WHERE r.deleted = false
                GROUP BY r.resource_type
            """
            
            result = await session.execute(text(index_query))
            
            for row in result:
                validation_results["search_index_coverage"][row.resource_type] = {
                    "total": row.resource_count,
                    "indexed": row.indexed_count,
                    "coverage": f"{(row.indexed_count / row.resource_count * 100):.1f}%"
                        if row.resource_count > 0 else "0%"
                }
        
        return validation_results


async def main():
    """Example usage of the importer."""
    import sys
    
    importer = SyntheaFHIRImporter()
    
    # Example: Import all bundles from a directory
    synthea_output_dir = sys.argv[1] if len(sys.argv) > 1 else "./synthea_output/fhir"
    
    if os.path.exists(synthea_output_dir):
        logging.info(f"Importing FHIR bundles from {synthea_output_dir}")
        stats = await importer.import_directory(synthea_output_dir)
        
        logging.info("\nImport Statistics:")
        logging.info(f"Bundles processed: {stats['bundles_processed']}")
        logging.info(f"Resources imported: {stats['resources_imported']}")
        logging.info("\nResource counts by type:")
        for resource_type, count in sorted(stats['resource_counts'].items()):
            logging.info(f"  {resource_type}: {count}")
        if stats['errors']:
            logging.error(f"\nErrors encountered: {len(stats['errors'])}")
            for error in stats['errors'][:5]:  # Show first 5 errors
                logging.error(f"  - {error}")
        # Validate import
        logging.info("\nValidating import...")
        validation = await importer.validate_import()
        
        logging.info("\nValidation Results:")
        logging.info("Resource counts in database:")
        for resource_type, count in sorted(validation['resource_counts'].items()):
            logging.info(f"  {resource_type}: {count}")
        if validation['broken_references']:
            logging.info(f"\nBroken references found: {len(validation['broken_references'])}")
        else:
            logging.info("\nNo broken references found!")
        logging.info("\nSearch index coverage:")
        for resource_type, coverage in sorted(validation['search_index_coverage'].items()):
            logging.info(f"  {resource_type}: {coverage['indexed']}/{coverage['total']} ({coverage['coverage']})")
    else:
        logging.info(f"Directory not found: {synthea_output_dir}")
        logging.info("Please run Synthea to generate test data first:")
        logging.info("  cd synthea")
        logging.info("  ./run_synthea -p 10")
if __name__ == "__main__":
    asyncio.run(main())