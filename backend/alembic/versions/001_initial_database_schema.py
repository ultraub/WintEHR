"""Initial database schema for WintEHR FHIR storage

Revision ID: 001
Revises: 
Create Date: 2025-01-11 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    """Create initial database schema for WintEHR"""
    
    # Create schemas
    op.execute("CREATE SCHEMA IF NOT EXISTS fhir")
    op.execute("CREATE SCHEMA IF NOT EXISTS cds_hooks")
    
    # Create resources table (main FHIR resource storage)
    op.create_table(
        'resources',
        sa.Column('id', sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column('resource_type', sa.String(50), nullable=False),
        sa.Column('fhir_id', sa.String(64), nullable=False),
        sa.Column('version_id', sa.Integer, nullable=False, default=1),
        sa.Column('last_updated', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('deleted', sa.Boolean, default=False),
        sa.Column('resource', postgresql.JSONB, nullable=False),
        sa.UniqueConstraint('resource_type', 'fhir_id', name='unique_resource_type_fhir_id'),
        schema='fhir'
    )
    
    # Create search_params table for FHIR search parameters
    op.create_table(
        'search_params',
        sa.Column('id', sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column('resource_id', sa.BigInteger, nullable=False),
        sa.Column('resource_type', sa.String(50), nullable=False),
        sa.Column('param_name', sa.String(100), nullable=False),
        sa.Column('param_type', sa.String(20), nullable=False),
        
        # Value columns for different data types
        sa.Column('value_string', sa.Text),
        sa.Column('value_number', sa.Numeric),
        sa.Column('value_date', sa.DateTime(timezone=True)),
        sa.Column('value_token', sa.String(500)),
        sa.Column('value_token_system', sa.String(500)),
        sa.Column('value_token_code', sa.String(500)),
        sa.Column('value_reference', sa.String(500)),
        sa.Column('value_quantity_value', sa.Numeric),
        sa.Column('value_quantity_unit', sa.String(100)),
        
        # Metadata
        sa.Column('created_at', sa.DateTime(timezone=True), default=sa.text('CURRENT_TIMESTAMP')),
        
        # Foreign key to resources
        sa.ForeignKeyConstraint(['resource_id'], ['fhir.resources.id'], ondelete='CASCADE'),
        schema='fhir'
    )
    
    # Create resource_history table for versioning
    op.create_table(
        'resource_history',
        sa.Column('id', sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column('resource_id', sa.BigInteger, nullable=False),
        sa.Column('version_id', sa.Integer, nullable=False),
        sa.Column('operation', sa.String(20), nullable=False),  # 'create', 'update', 'delete'
        sa.Column('resource', postgresql.JSONB, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('timestamp', sa.DateTime(timezone=True), default=sa.text('CURRENT_TIMESTAMP')),
        
        # Foreign key and uniqueness
        sa.ForeignKeyConstraint(['resource_id'], ['fhir.resources.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('resource_id', 'version_id', name='unique_resource_version'),
        schema='fhir'
    )
    
    # Create references table for FHIR reference tracking
    op.create_table(
        'references',
        sa.Column('id', sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column('source_id', sa.BigInteger, nullable=False),
        sa.Column('source_type', sa.String(50), nullable=False),
        sa.Column('target_type', sa.String(50)),
        sa.Column('target_id', sa.String(64)),
        sa.Column('reference_path', sa.String(255), nullable=False),
        sa.Column('reference_value', sa.Text, nullable=False),
        
        # Foreign key
        sa.ForeignKeyConstraint(['source_id'], ['fhir.resources.id'], ondelete='CASCADE'),
        schema='fhir'
    )
    
    # Create CDS Hooks configuration table
    op.create_table(
        'hook_configurations',
        sa.Column('id', sa.String(255), primary_key=True),
        sa.Column('hook_type', sa.String(100), nullable=False),
        sa.Column('title', sa.String(255)),
        sa.Column('description', sa.Text),
        sa.Column('enabled', sa.Boolean, default=True),
        sa.Column('conditions', postgresql.JSONB, default=sa.text("'[]'::jsonb")),
        sa.Column('actions', postgresql.JSONB, default=sa.text("'[]'::jsonb")),
        sa.Column('prefetch', postgresql.JSONB, default=sa.text("'{}'::jsonb")),
        sa.Column('usage_requirements', sa.Text),
        sa.Column('created_at', sa.DateTime, default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime, default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
        sa.Column('version', sa.Integer, default=1),
        sa.Column('tags', postgresql.JSONB, default=sa.text("'[]'::jsonb")),
        schema='cds_hooks'
    )
    
    # Create indexes for performance
    
    # Resources table indexes
    op.create_index('idx_resources_type', 'resources', ['resource_type'], schema='fhir')
    op.create_index('idx_resources_type_id', 'resources', ['resource_type', 'fhir_id'], schema='fhir')
    op.create_index('idx_resources_updated', 'resources', ['last_updated'], schema='fhir')
    op.create_index('idx_resources_deleted', 'resources', ['deleted'], schema='fhir', postgresql_where=sa.text('deleted = false'))
    
    # Search params indexes
    op.create_index('idx_search_params_resource', 'search_params', ['resource_id', 'resource_type'], schema='fhir')
    op.create_index('idx_search_params_param_name', 'search_params', ['param_name'], schema='fhir')
    op.create_index('idx_search_params_param_type', 'search_params', ['param_type'], schema='fhir')
    op.create_index('idx_search_params_string', 'search_params', ['param_name', 'value_string'], schema='fhir', postgresql_where=sa.text('value_string IS NOT NULL'))
    op.create_index('idx_search_params_number', 'search_params', ['param_name', 'value_number'], schema='fhir', postgresql_where=sa.text('value_number IS NOT NULL'))
    op.create_index('idx_search_params_date', 'search_params', ['param_name', 'value_date'], schema='fhir', postgresql_where=sa.text('value_date IS NOT NULL'))
    op.create_index('idx_search_params_token', 'search_params', ['param_name', 'value_token'], schema='fhir', postgresql_where=sa.text('value_token IS NOT NULL'))
    op.create_index('idx_search_params_token_code', 'search_params', ['param_name', 'value_token_code'], schema='fhir', postgresql_where=sa.text('value_token_code IS NOT NULL'))
    op.create_index('idx_search_params_reference', 'search_params', ['param_name', 'value_reference'], schema='fhir', postgresql_where=sa.text('value_reference IS NOT NULL'))
    
    # Resource history indexes
    op.create_index('idx_resource_history_resource_id', 'resource_history', ['resource_id'], schema='fhir')
    op.create_index('idx_resource_history_created_at', 'resource_history', ['created_at'], schema='fhir')
    op.create_index('idx_resource_history_operation', 'resource_history', ['operation'], schema='fhir')
    
    # References indexes
    op.create_index('idx_references_source', 'references', ['source_id', 'source_type'], schema='fhir')
    op.create_index('idx_references_target', 'references', ['target_type', 'target_id'], schema='fhir')
    op.create_index('idx_references_path', 'references', ['reference_path'], schema='fhir')
    
    # CDS Hooks indexes
    op.create_index('idx_hook_type', 'hook_configurations', ['hook_type'], schema='cds_hooks')
    op.create_index('idx_enabled', 'hook_configurations', ['enabled'], schema='cds_hooks')
    op.create_index('idx_tags', 'hook_configurations', ['tags'], schema='cds_hooks', postgresql_using='gin')
    
    # Grant permissions
    op.execute("GRANT ALL PRIVILEGES ON SCHEMA fhir TO emr_user")
    op.execute("GRANT ALL PRIVILEGES ON SCHEMA cds_hooks TO emr_user")
    op.execute("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA fhir TO emr_user")
    op.execute("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cds_hooks TO emr_user")
    op.execute("GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA fhir TO emr_user")
    op.execute("GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA cds_hooks TO emr_user")
    
    # Set schema ownership
    op.execute("ALTER SCHEMA fhir OWNER TO emr_user")
    op.execute("ALTER SCHEMA cds_hooks OWNER TO emr_user")
    
    # Add comments for documentation
    op.execute("COMMENT ON SCHEMA fhir IS 'FHIR resource storage and search indexes'")
    op.execute("COMMENT ON SCHEMA cds_hooks IS 'CDS Hooks configuration and storage'")
    op.execute("COMMENT ON TABLE fhir.resources IS 'Main FHIR resource storage table'")
    op.execute("COMMENT ON TABLE fhir.search_params IS 'Search parameter index for FHIR resources'")
    op.execute("COMMENT ON TABLE fhir.resource_history IS 'Version history for FHIR resources'")
    op.execute("COMMENT ON TABLE cds_hooks.hook_configurations IS 'CDS Hooks configuration storage'")


def downgrade():
    """Drop all database objects"""
    # Drop tables in reverse order of creation
    op.drop_table('hook_configurations', schema='cds_hooks')
    op.drop_table('references', schema='fhir')
    op.drop_table('resource_history', schema='fhir')
    op.drop_table('search_params', schema='fhir')
    op.drop_table('resources', schema='fhir')
    
    # Drop schemas
    op.execute("DROP SCHEMA IF EXISTS cds_hooks CASCADE")
    op.execute("DROP SCHEMA IF EXISTS fhir CASCADE")