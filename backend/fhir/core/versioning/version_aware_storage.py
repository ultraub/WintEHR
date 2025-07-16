"""
FHIR Version-Aware Storage Engine
Handles FHIR R4/R5/R6 version detection, storage, and retrieval with automatic transformation
"""

import json
import logging
from typing import Dict, List, Optional, Tuple, Any, Union
from enum import Enum
from datetime import datetime, timezone
from dataclasses import dataclass, asdict
from sqlalchemy import Column, String, DateTime, Boolean, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, and_, or_

from fhir.core.versioning.negotiator import FHIRVersion, FHIRVersionNegotiator, VersionDetectionResult, NegotiationResult
from fhir.core.version_transformer import fhir_transformer
from fhir.core.abstract_converter import AbstractFHIRConverter

logger = logging.getLogger(__name__)

class StorageStrategy(Enum):
    """Strategies for storing different FHIR versions"""
    NATIVE = "native"           # Store in detected version format
    CANONICAL = "canonical"     # Convert all to canonical version (R4)
    MULTI_VERSION = "multi"     # Store multiple versions simultaneously
    HYBRID = "hybrid"          # Canonical + extension storage

@dataclass
class VersionMetadata:
    """Metadata about FHIR version for a resource"""
    detected_version: FHIRVersion
    stored_version: FHIRVersion
    original_version: Optional[FHIRVersion]
    transformation_applied: bool
    compatibility_level: str
    detection_confidence: float
    version_indicators: List[str]
    created_at: datetime
    storage_strategy: StorageStrategy

@dataclass
class ResourceVersionInfo:
    """Complete version information for a resource"""
    resource_id: str
    resource_type: str
    current_version: VersionMetadata
    version_history: List[VersionMetadata]
    profiles: List[str]
    extensions: Dict[str, Any]
    transformation_log: List[Dict[str, Any]]

class VersionAwareStorageEngine:
    """
    Version-Aware FHIR Storage Engine
    
    Features:
    - Automatic FHIR version detection
    - Multi-version storage strategies
    - Transparent version conversion
    - Profile and extension preservation
    - Version migration support
    - Backward compatibility
    """
    
    def __init__(
        self, 
        session: AsyncSession,
        strategy: StorageStrategy = StorageStrategy.HYBRID,
        canonical_version: FHIRVersion = FHIRVersion.R4,
        enable_version_history: bool = True
    ):
        self.session = session
        self.strategy = strategy
        self.canonical_version = canonical_version
        self.enable_version_history = enable_version_history
        
        self.version_negotiator = FHIRVersionNegotiator(canonical_version)
        self.converters: Dict[str, AbstractFHIRConverter] = {}
        
        # Initialize version-specific converters
        self._initialize_converters()
    
    def _initialize_converters(self):
        """Initialize FHIR version converters"""
        # Initialize specific converters for each resource type
        try:
            from fhir.core.converters.allergy_intolerance_converter import AllergyIntoleranceConverter
            self.converters['AllergyIntolerance'] = AllergyIntoleranceConverter(self.canonical_version)
        except ImportError:
            logger.warning("AllergyIntolerance converter not available")
        
        # TODO: Add other resource converters as they are implemented
        # self.converters['Condition'] = ConditionConverter(self.canonical_version)
        # self.converters['MedicationRequest'] = MedicationRequestConverter(self.canonical_version)
    
    async def store_resource(
        self, 
        resource_data: Dict[str, Any],
        resource_type: str,
        fhir_id: str,
        force_version: Optional[FHIRVersion] = None,
        preserve_extensions: bool = True
    ) -> ResourceVersionInfo:
        """
        Store a FHIR resource with version awareness
        
        Args:
            resource_data: The FHIR resource data
            resource_type: Type of FHIR resource
            fhir_id: FHIR resource ID
            force_version: Force specific FHIR version
            preserve_extensions: Whether to preserve extensions
            
        Returns:
            Complete version information for the stored resource
        """
        
        # Step 1: Detect FHIR version
        if force_version:
            detection = VersionDetectionResult(
                detected_version=force_version,
                confidence=1.0,
                indicators=['force_override']
            )
        else:
            detection = self.version_negotiator.detect_version(resource_data)
        
        logger.info(f"Detected FHIR version {detection.detected_version.value} "
                   f"for {resource_type}/{fhir_id} with confidence {detection.confidence}")
        
        # Step 2: Determine storage strategy
        storage_data = await self._prepare_storage_data(
            resource_data, resource_type, detection, preserve_extensions
        )
        
        # Step 3: Create version metadata
        version_metadata = VersionMetadata(
            detected_version=detection.detected_version,
            stored_version=storage_data['stored_version'],
            original_version=detection.detected_version,
            transformation_applied=storage_data['transformation_applied'],
            compatibility_level=storage_data['compatibility_level'],
            detection_confidence=detection.confidence,
            version_indicators=detection.indicators,
            created_at=datetime.now(timezone.utc),
            storage_strategy=self.strategy
        )
        
        # Step 4: Store in database
        await self._persist_resource(
            resource_data=storage_data['resource'],
            version_metadata=version_metadata,
            resource_type=resource_type,
            fhir_id=fhir_id,
            extensions=storage_data.get('extensions', {}),
            profiles=storage_data.get('profiles', [])
        )
        
        # Step 5: Return version info
        return ResourceVersionInfo(
            resource_id=fhir_id,
            resource_type=resource_type,
            current_version=version_metadata,
            version_history=[version_metadata],
            profiles=storage_data.get('profiles', []),
            extensions=storage_data.get('extensions', {}),
            transformation_log=storage_data.get('transformation_log', [])
        )
    
    async def retrieve_resource(
        self,
        resource_type: str,
        fhir_id: str,
        target_version: Optional[FHIRVersion] = None,
        include_version_info: bool = False
    ) -> Union[Dict[str, Any], Tuple[Dict[str, Any], ResourceVersionInfo]]:
        """
        Retrieve a FHIR resource with optional version conversion
        
        Args:
            resource_type: Type of FHIR resource
            fhir_id: FHIR resource ID
            target_version: Desired FHIR version for output
            include_version_info: Whether to include version metadata
            
        Returns:
            Resource data, optionally with version information
        """
        
        # Step 1: Retrieve from database
        stored_data = await self._fetch_resource(resource_type, fhir_id)
        if not stored_data:
            return None
        
        resource_data = stored_data['resource']
        version_metadata = stored_data['version_metadata']
        
        # Step 2: Transform if different version requested
        if target_version and target_version != version_metadata.stored_version:
            negotiation = NegotiationResult(
                target_version=target_version,
                source_version=version_metadata.stored_version,
                transformation_needed=True,
                compatibility_level='full'  # TODO: Determine actual compatibility
            )
            
            if resource_type in self.converters:
                converter = self.converters[resource_type]
                resource_data = await converter.convert(
                    resource_data, 
                    version_metadata.stored_version, 
                    target_version
                )
            else:
                # Use generic transformer
                resource_data = fhir_transformer.transform_resource(
                    resource_data, 
                    version_metadata.stored_version, 
                    target_version
                )
        
        # Step 3: Restore extensions and profiles if needed
        if stored_data.get('extensions'):
            resource_data = self._restore_extensions(
                resource_data, stored_data['extensions']
            )
        
        if include_version_info:
            version_info = ResourceVersionInfo(
                resource_id=fhir_id,
                resource_type=resource_type,
                current_version=version_metadata,
                version_history=stored_data.get('version_history', [version_metadata]),
                profiles=stored_data.get('profiles', []),
                extensions=stored_data.get('extensions', {}),
                transformation_log=stored_data.get('transformation_log', [])
            )
            return resource_data, version_info
        
        return resource_data
    
    async def _prepare_storage_data(
        self, 
        resource_data: Dict[str, Any], 
        resource_type: str,
        detection: VersionDetectionResult,
        preserve_extensions: bool
    ) -> Dict[str, Any]:
        """Prepare resource data for storage based on strategy"""
        
        result = {
            'resource': resource_data.copy(),
            'stored_version': detection.detected_version,
            'transformation_applied': False,
            'compatibility_level': 'full',
            'extensions': {},
            'profiles': [],
            'transformation_log': []
        }
        
        # Extract profiles and extensions
        if preserve_extensions:
            result['extensions'] = self._extract_extensions(resource_data)
            result['profiles'] = self._extract_profiles(resource_data)
        
        # Apply storage strategy
        if self.strategy == StorageStrategy.CANONICAL:
            if detection.detected_version != self.canonical_version:
                # Transform to canonical version
                if resource_type in self.converters:
                    converter = self.converters[resource_type]
                    result['resource'] = await converter.convert(
                        resource_data, 
                        detection.detected_version, 
                        self.canonical_version
                    )
                else:
                    result['resource'] = fhir_transformer.transform_resource(
                        resource_data, 
                        detection.detected_version, 
                        self.canonical_version
                    )
                
                result['stored_version'] = self.canonical_version
                result['transformation_applied'] = True
                result['transformation_log'].append({
                    'from_version': detection.detected_version.value,
                    'to_version': self.canonical_version.value,
                    'timestamp': datetime.now(timezone.utc).isoformat(),
                    'reason': 'canonical_storage_strategy'
                })
        
        elif self.strategy == StorageStrategy.MULTI_VERSION:
            # Store multiple versions
            # TODO: Implement multi-version storage
            pass
        
        elif self.strategy == StorageStrategy.HYBRID:
            # Store in canonical + preserve original extensions
            if detection.detected_version != self.canonical_version:
                # Keep original in extensions
                result['extensions']['_original_resource'] = resource_data
                result['extensions']['_original_version'] = detection.detected_version.value
                
                # Transform main resource to canonical
                if resource_type in self.converters:
                    converter = self.converters[resource_type]
                    result['resource'] = await converter.convert(
                        resource_data, 
                        detection.detected_version, 
                        self.canonical_version
                    )
                else:
                    result['resource'] = fhir_transformer.transform_resource(
                        resource_data, 
                        detection.detected_version, 
                        self.canonical_version
                    )
                
                result['stored_version'] = self.canonical_version
                result['transformation_applied'] = True
                result['transformation_log'].append({
                    'from_version': detection.detected_version.value,
                    'to_version': self.canonical_version.value,
                    'timestamp': datetime.now(timezone.utc).isoformat(),
                    'reason': 'hybrid_storage_strategy',
                    'original_preserved': True
                })
        
        return result
    
    async def _persist_resource(
        self,
        resource_data: Dict[str, Any],
        version_metadata: VersionMetadata,
        resource_type: str,
        fhir_id: str,
        extensions: Dict[str, Any],
        profiles: List[str]
    ):
        """Persist resource with version metadata to database"""
        
        # Store in main resources table
        query = text("""
            INSERT INTO fhir.resources (
                resource_type, fhir_id, version_id, last_updated, resource
            ) VALUES (
                :resource_type, :fhir_id, :version_id, :last_updated, :resource
            ) ON CONFLICT (fhir_id) 
            DO UPDATE SET 
                version_id = :version_id,
                last_updated = :last_updated,
                resource = :resource
        """)
        
        await self.session.execute(query, {
            'resource_type': resource_type,
            'fhir_id': fhir_id,
            'version_id': 1,  # TODO: Implement proper versioning
            'last_updated': datetime.now(timezone.utc),
            'resource': resource_data
        })
        
        # Store version metadata
        if self.enable_version_history:
            await self._store_version_metadata(fhir_id, version_metadata, extensions, profiles)
    
    async def _store_version_metadata(
        self,
        fhir_id: str,
        metadata: VersionMetadata,
        extensions: Dict[str, Any],
        profiles: List[str]
    ):
        """Store version metadata in separate table"""
        
        query = text("""
            INSERT INTO fhir.resource_versions (
                fhir_id, 
                detected_version, 
                stored_version, 
                original_version,
                transformation_applied,
                compatibility_level,
                detection_confidence,
                version_indicators,
                storage_strategy,
                extensions,
                profiles,
                created_at
            ) VALUES (
                :fhir_id, :detected_version, :stored_version, :original_version,
                :transformation_applied, :compatibility_level, :detection_confidence,
                :version_indicators, :storage_strategy, :extensions, :profiles, :created_at
            ) ON CONFLICT (fhir_id) 
            DO UPDATE SET 
                detected_version = :detected_version,
                stored_version = :stored_version,
                transformation_applied = :transformation_applied,
                compatibility_level = :compatibility_level,
                detection_confidence = :detection_confidence,
                version_indicators = :version_indicators,
                extensions = :extensions,
                profiles = :profiles,
                created_at = :created_at
        """)
        
        await self.session.execute(query, {
            'fhir_id': fhir_id,
            'detected_version': metadata.detected_version.value,
            'stored_version': metadata.stored_version.value,
            'original_version': metadata.original_version.value if metadata.original_version else None,
            'transformation_applied': metadata.transformation_applied,
            'compatibility_level': metadata.compatibility_level,
            'detection_confidence': metadata.detection_confidence,
            'version_indicators': json.dumps(metadata.version_indicators),
            'storage_strategy': metadata.storage_strategy.value,
            'extensions': json.dumps(extensions),
            'profiles': json.dumps(profiles),
            'created_at': metadata.created_at
        })
    
    async def _fetch_resource(self, resource_type: str, fhir_id: str) -> Optional[Dict[str, Any]]:
        """Fetch resource with version metadata from database"""
        
        query = text("""
            SELECT 
                r.resource,
                rv.detected_version,
                rv.stored_version,
                rv.original_version,
                rv.transformation_applied,
                rv.compatibility_level,
                rv.detection_confidence,
                rv.version_indicators,
                rv.storage_strategy,
                rv.extensions,
                rv.profiles,
                rv.created_at
            FROM fhir.resources r
            LEFT JOIN fhir.resource_versions rv ON r.fhir_id = rv.fhir_id
            WHERE r.fhir_id = :fhir_id AND r.resource_type = :resource_type
        """)
        
        result = await self.session.execute(query, {
            'fhir_id': fhir_id,
            'resource_type': resource_type
        })
        
        row = result.fetchone()
        if not row:
            return None
        
        # Parse version metadata
        version_metadata = VersionMetadata(
            detected_version=FHIRVersion(row.detected_version) if row.detected_version else FHIRVersion.R4,
            stored_version=FHIRVersion(row.stored_version) if row.stored_version else FHIRVersion.R4,
            original_version=FHIRVersion(row.original_version) if row.original_version else None,
            transformation_applied=row.transformation_applied or False,
            compatibility_level=row.compatibility_level or 'full',
            detection_confidence=row.detection_confidence or 1.0,
            version_indicators=json.loads(row.version_indicators) if row.version_indicators else [],
            created_at=row.created_at or datetime.now(timezone.utc),
            storage_strategy=StorageStrategy(row.storage_strategy) if row.storage_strategy else StorageStrategy.NATIVE
        )
        
        return {
            'resource': row.resource,
            'version_metadata': version_metadata,
            'extensions': json.loads(row.extensions) if row.extensions else {},
            'profiles': json.loads(row.profiles) if row.profiles else []
        }
    
    def _extract_extensions(self, resource_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract extensions from FHIR resource"""
        extensions = {}
        
        # Extract root-level extensions
        if 'extension' in resource_data:
            extensions['root'] = resource_data['extension']
        
        # Extract modifierExtensions
        if 'modifierExtension' in resource_data:
            extensions['modifier'] = resource_data['modifierExtension']
        
        # TODO: Extract nested extensions from complex fields
        
        return extensions
    
    def _extract_profiles(self, resource_data: Dict[str, Any]) -> List[str]:
        """Extract profiles from FHIR resource"""
        profiles = []
        
        meta = resource_data.get('meta', {})
        if 'profile' in meta:
            profiles.extend(meta['profile'])
        
        return profiles
    
    def _restore_extensions(
        self, 
        resource_data: Dict[str, Any], 
        extensions: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Restore extensions to FHIR resource"""
        
        if 'root' in extensions:
            resource_data['extension'] = extensions['root']
        
        if 'modifier' in extensions:
            resource_data['modifierExtension'] = extensions['modifier']
        
        return resource_data
    
    async def migrate_resource_version(
        self,
        resource_type: str,
        fhir_id: str,
        target_version: FHIRVersion,
        preserve_original: bool = True
    ) -> ResourceVersionInfo:
        """Migrate a resource to a different FHIR version"""
        
        # Retrieve current resource
        current_data = await self._fetch_resource(resource_type, fhir_id)
        if not current_data:
            raise ValueError(f"Resource {resource_type}/{fhir_id} not found")
        
        # Perform version migration
        if preserve_original:
            # Store original in extensions before migration
            extensions = current_data['extensions'].copy()
            extensions['_pre_migration_resource'] = current_data['resource']
            extensions['_pre_migration_version'] = current_data['version_metadata'].stored_version.value
        
        # Transform to target version
        if resource_type in self.converters:
            converter = self.converters[resource_type]
            transformed_resource = await converter.convert(
                current_data['resource'],
                current_data['version_metadata'].stored_version,
                target_version
            )
        else:
            transformed_resource = fhir_transformer.transform_resource(
                current_data['resource'],
                current_data['version_metadata'].stored_version,
                target_version
            )
        
        # Create new version metadata
        new_metadata = VersionMetadata(
            detected_version=target_version,
            stored_version=target_version,
            original_version=current_data['version_metadata'].original_version,
            transformation_applied=True,
            compatibility_level='migrated',
            detection_confidence=1.0,
            version_indicators=['manual_migration'],
            created_at=datetime.now(timezone.utc),
            storage_strategy=self.strategy
        )
        
        # Store migrated resource
        await self._persist_resource(
            resource_data=transformed_resource,
            version_metadata=new_metadata,
            resource_type=resource_type,
            fhir_id=fhir_id,
            extensions=extensions if preserve_original else {},
            profiles=current_data.get('profiles', [])
        )
        
        return ResourceVersionInfo(
            resource_id=fhir_id,
            resource_type=resource_type,
            current_version=new_metadata,
            version_history=[current_data['version_metadata'], new_metadata],
            profiles=current_data.get('profiles', []),
            extensions=extensions if preserve_original else {},
            transformation_log=[{
                'from_version': current_data['version_metadata'].stored_version.value,
                'to_version': target_version.value,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'reason': 'manual_migration',
                'preserve_original': preserve_original
            }]
        )

# Create global instance for dependency injection
version_aware_storage = None

def get_version_aware_storage() -> VersionAwareStorageEngine:
    """Dependency injection function for version-aware storage"""
    global version_aware_storage
    if version_aware_storage is None:
        raise RuntimeError("Version-aware storage not initialized")
    return version_aware_storage

def initialize_version_aware_storage(
    session: AsyncSession,
    strategy: StorageStrategy = StorageStrategy.HYBRID,
    canonical_version: FHIRVersion = FHIRVersion.R4
):
    """Initialize the global version-aware storage instance"""
    global version_aware_storage
    version_aware_storage = VersionAwareStorageEngine(
        session=session,
        strategy=strategy,
        canonical_version=canonical_version
    )