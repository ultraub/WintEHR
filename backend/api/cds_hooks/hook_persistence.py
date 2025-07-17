"""
CDS Hooks Database Persistence
Handles storing and retrieving CDS hook configurations from the database
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, insert, update, delete
from sqlalchemy.dialects.postgresql import JSONB
from typing import List, Dict, Any, Optional
import json
import logging
from datetime import datetime

from .models import HookConfiguration

logger = logging.getLogger(__name__)

class HookPersistenceManager:
    """Manages CDS hook configurations in the database"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_table_if_not_exists(self):
        """Create the CDS hooks table if it doesn't exist"""
        # Create table SQL without schema creation
        # Table already exists with different schema - don't recreate
        # Actual schema has: id (serial), hook_id, title, description, hook_type,
        # prefetch, configuration, is_active, created_at, updated_at, display_behavior
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS cds_hooks.hook_configurations (
            id SERIAL PRIMARY KEY,
            hook_id VARCHAR(255) UNIQUE NOT NULL,
            title VARCHAR(500),
            description TEXT,
            hook_type VARCHAR(100) NOT NULL,
            prefetch JSONB DEFAULT '{}'::jsonb,
            configuration JSONB NOT NULL,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            display_behavior JSONB DEFAULT NULL
        )
        """
        
        try:
            # Create schema first
            await self.db.execute(text("CREATE SCHEMA IF NOT EXISTS cds_hooks"))
            await self.db.commit()
            
            # Then create table
            await self.db.execute(text(create_table_sql))
            await self.db.commit()
            
            # Add display_behavior column if it doesn't exist (for existing tables)
            try:
                await self.db.execute(text("ALTER TABLE cds_hooks.hook_configurations ADD COLUMN IF NOT EXISTS display_behavior JSONB DEFAULT NULL"))
                await self.db.commit()
            except Exception as e:
                logger.debug(f"Column display_behavior may already exist: {e}")
                await self.db.rollback()
            
            # Then create indexes - one at a time to avoid multi-statement error
            await self.db.execute(text("CREATE INDEX IF NOT EXISTS idx_cds_hooks_config_type ON cds_hooks.hook_configurations(hook_type)"))
            await self.db.execute(text("CREATE INDEX IF NOT EXISTS idx_cds_hooks_config_active ON cds_hooks.hook_configurations(is_active)"))
            await self.db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS hook_configurations_hook_id_key ON cds_hooks.hook_configurations(hook_id)"))
            await self.db.commit()
            
            logger.debug("CDS hooks table created or verified")
        except Exception as e:
            logger.error(f"Error creating CDS hooks table: {e}")
            await self.db.rollback()
            raise
    
    async def save_hook(self, hook_config: HookConfiguration, user_id: str = "system") -> HookConfiguration:
        """Save a hook configuration to the database"""
        try:
            # Check if hook exists
            existing = await self.get_hook(hook_config.id)
            
            if existing:
                # Update existing hook
                update_sql = text("""
                    UPDATE cds_hooks.hook_configurations 
                    SET hook_type = :hook_type,
                        title = :title,
                        description = :description,
                        is_active = :enabled,
                        configuration = :configuration,
                        prefetch = :prefetch,
                        display_behavior = :display_behavior,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE hook_id = :hook_id
                    RETURNING *
                """)
                
                # Combine conditions and actions into configuration
                configuration = {
                    'conditions': [c.dict() for c in hook_config.conditions],
                    'actions': [a.dict() for a in hook_config.actions],
                    'usageRequirements': hook_config.usageRequirements
                }
                
                result = await self.db.execute(update_sql, {
                    'hook_id': hook_config.id,
                    'hook_type': hook_config.hook.value,
                    'title': hook_config.title,
                    'description': hook_config.description,
                    'enabled': hook_config.enabled,
                    'configuration': json.dumps(configuration),
                    'prefetch': json.dumps(hook_config.prefetch or {}),
                    'display_behavior': json.dumps(hook_config.displayBehavior) if hook_config.displayBehavior else None
                })
            else:
                # Insert new hook
                insert_sql = text("""
                    INSERT INTO cds_hooks.hook_configurations 
                    (hook_id, hook_type, title, description, is_active, configuration, 
                     prefetch, display_behavior)
                    VALUES (:hook_id, :hook_type, :title, :description, :enabled, :configuration, 
                            :prefetch, :display_behavior)
                    RETURNING *
                """)
                
                # Combine conditions and actions into configuration
                configuration = {
                    'conditions': [c.dict() for c in hook_config.conditions],
                    'actions': [a.dict() for a in hook_config.actions],
                    'usageRequirements': hook_config.usageRequirements
                }
                
                result = await self.db.execute(insert_sql, {
                    'hook_id': hook_config.id,
                    'hook_type': hook_config.hook.value,
                    'title': hook_config.title,
                    'description': hook_config.description,
                    'enabled': hook_config.enabled,
                    'configuration': json.dumps(configuration),
                    'prefetch': json.dumps(hook_config.prefetch or {}),
                    'display_behavior': json.dumps(hook_config.displayBehavior) if hook_config.displayBehavior else None
                })
            
            await self.db.commit()
            logger.debug(f"Saved hook configuration: {hook_config.id}")
            
            # Update the hook config with database timestamps
            row = result.first()
            if row:
                hook_config.created_at = row.created_at
                hook_config.updated_at = row.updated_at
            
            return hook_config
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error saving hook {hook_config.id}: {e}")
            raise
    
    async def get_hook(self, hook_id: str) -> Optional[HookConfiguration]:
        """Retrieve a hook configuration by ID"""
        try:
            query = text("""
                SELECT * FROM cds_hooks.hook_configurations 
                WHERE hook_id = :hook_id
            """)
            
            result = await self.db.execute(query, {'hook_id': hook_id})
            row = result.first()
            
            if row:
                return self._row_to_hook_config(row)
            return None
            
        except Exception as e:
            logger.error(f"Error retrieving hook {hook_id}: {e}")
            return None
    
    async def list_hooks(self, 
                        hook_type: Optional[str] = None,
                        enabled_only: bool = True,
                        tags: Optional[List[str]] = None) -> List[HookConfiguration]:
        """List hook configurations with optional filtering"""
        try:
            where_clauses = []
            params = {}
            
            if enabled_only:
                where_clauses.append("is_active = true")
            
            if hook_type:
                where_clauses.append("hook_type = :hook_type")
                params['hook_type'] = hook_type
            
            if tags:
                where_clauses.append("tags ?| array[:tags]")
                params['tags'] = tags
            
            where_clause = " WHERE " + " AND ".join(where_clauses) if where_clauses else ""
            
            query = text(f"""
                SELECT * FROM cds_hooks.hook_configurations 
                {where_clause}
                ORDER BY created_at DESC
            """)
            
            result = await self.db.execute(query, params)
            rows = result.fetchall()
            
            return [self._row_to_hook_config(row) for row in rows]
            
        except Exception as e:
            logger.error(f"Error listing hooks: {e}")
            return []
    
    async def delete_hook(self, hook_id: str) -> bool:
        """Delete a hook configuration"""
        try:
            delete_sql = text("""
                DELETE FROM cds_hooks.hook_configurations 
                WHERE hook_id = :hook_id
            """)
            
            result = await self.db.execute(delete_sql, {'hook_id': hook_id})
            await self.db.commit()
            
            return result.rowcount > 0
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting hook {hook_id}: {e}")
            return False
    
    async def toggle_hook(self, hook_id: str, enabled: bool) -> bool:
        """Enable or disable a hook"""
        try:
            update_sql = text("""
                UPDATE cds_hooks.hook_configurations 
                SET is_active = :enabled, updated_at = CURRENT_TIMESTAMP
                WHERE hook_id = :hook_id
            """)
            
            result = await self.db.execute(update_sql, {
                'hook_id': hook_id,
                'enabled': enabled
            })
            await self.db.commit()
            
            return result.rowcount > 0
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error toggling hook {hook_id}: {e}")
            return False
    
    async def get_hooks_by_type(self, hook_type: str) -> List[HookConfiguration]:
        """Get all enabled hooks for a specific hook type"""
        return await self.list_hooks(hook_type=hook_type, enabled_only=True)
    
    async def backup_hooks(self) -> Dict[str, Any]:
        """Create a backup of all hook configurations"""
        try:
            hooks = await self.list_hooks(enabled_only=False)
            return {
                'timestamp': datetime.now().isoformat(),
                'hooks': [hook.dict() for hook in hooks],
                'count': len(hooks)
            }
        except Exception as e:
            logger.error(f"Error creating hooks backup: {e}")
            return {'error': str(e)}
    
    async def restore_hooks(self, backup_data: Dict[str, Any], user_id: str = "system") -> int:
        """Restore hooks from backup data"""
        try:
            restored_count = 0
            
            for hook_data in backup_data.get('hooks', []):
                try:
                    hook_config = HookConfiguration(**hook_data)
                    await self.save_hook(hook_config, user_id)
                    restored_count += 1
                except Exception as e:
                    logger.warning(f"Failed to restore hook {hook_data.get('id')}: {e}")
            
            return restored_count
            
        except Exception as e:
            logger.error(f"Error restoring hooks: {e}")
            return 0
    
    def _row_to_hook_config(self, row) -> HookConfiguration:
        """Convert database row to HookConfiguration object"""
        from .models import HookType, HookCondition, HookAction
        
        # Parse JSON fields from configuration
        config_data = row.configuration if isinstance(row.configuration, dict) else json.loads(row.configuration or '{}')
        conditions_data = config_data.get('conditions', [])
        actions_data = config_data.get('actions', [])
        usage_requirements = config_data.get('usageRequirements')
        
        prefetch_data = row.prefetch if isinstance(row.prefetch, dict) else json.loads(row.prefetch or '{}')
        display_behavior_data = None
        if hasattr(row, 'display_behavior') and row.display_behavior:
            display_behavior_data = row.display_behavior if isinstance(row.display_behavior, dict) else json.loads(row.display_behavior)
        
        return HookConfiguration(
            id=row.hook_id,
            hook=HookType(row.hook_type),
            title=row.title,
            description=row.description or "",
            enabled=row.is_active,
            conditions=[HookCondition(**cond) for cond in conditions_data],
            actions=[HookAction(**action) for action in actions_data],
            prefetch=prefetch_data if prefetch_data else None,
            usageRequirements=usage_requirements,
            displayBehavior=display_behavior_data,
            created_at=row.created_at,
            updated_at=row.updated_at
        )

# Utility functions for integration with existing router
async def get_persistence_manager(db: AsyncSession) -> HookPersistenceManager:
    """Get a persistence manager instance and ensure table exists"""
    manager = HookPersistenceManager(db)
    await manager.create_table_if_not_exists()
    return manager

async def load_hooks_from_database(db: AsyncSession) -> Dict[str, HookConfiguration]:
    """Load all enabled hooks from database"""
    try:
        manager = await get_persistence_manager(db)
        hooks = await manager.list_hooks(enabled_only=True)
        return {hook.id: hook for hook in hooks}
    except Exception as e:
        logger.error(f"Error loading hooks from database: {e}")
        return {}

async def save_sample_hooks_to_database(db: AsyncSession, sample_hooks: Dict[str, HookConfiguration]):
    """Save sample hooks to database for initial setup"""
    try:
        manager = await get_persistence_manager(db)
        saved_count = 0
        
        for hook_id, hook_config in sample_hooks.items():
            try:
                await manager.save_hook(hook_config, "system")
                saved_count += 1
            except Exception as e:
                logger.warning(f"Failed to save sample hook {hook_id}: {e}")
        
        logger.debug(f"Saved {saved_count} sample hooks to database")
        return saved_count
        
    except Exception as e:
        logger.error(f"Error saving sample hooks: {e}")
        return 0