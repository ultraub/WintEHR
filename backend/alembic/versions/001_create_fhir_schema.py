"""Create FHIR schema and core tables

Revision ID: 001_fhir_schema
Revises: 
Create Date: 2025-01-07

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '001_create_fhir_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Create FHIR schema
    op.execute('CREATE SCHEMA IF NOT EXISTS fhir')
    
    # Create resources table - stores all FHIR resources
    op.create_table(
        'resources',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('resource_type', sa.String(50), nullable=False),
        sa.Column('fhir_id', sa.String(64), nullable=False),
        sa.Column('version_id', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('last_updated', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('resource', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('resource_type', 'fhir_id', name='uq_resource_type_fhir_id'),
        schema='fhir'
    )
    
    # Create indexes for common queries
    op.create_index('idx_resources_type', 'resources', ['resource_type'], schema='fhir')
    op.create_index('idx_resources_updated', 'resources', ['last_updated'], schema='fhir')
    op.create_index('idx_resources_deleted', 'resources', ['deleted'], schema='fhir')
    
    # Create resource history table
    op.create_table(
        'resource_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('resource_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('version_id', sa.Integer(), nullable=False),
        sa.Column('operation', sa.String(20), nullable=False),
        sa.Column('resource', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('modified_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['resource_id'], ['fhir.resources.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        schema='fhir'
    )
    
    # Create indexes for history queries
    op.create_index('idx_history_resource', 'resource_history', ['resource_id'], schema='fhir')
    op.create_index('idx_history_modified', 'resource_history', ['modified_at'], schema='fhir')
    
    # Create search parameters table
    op.create_table(
        'search_params',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('resource_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('param_name', sa.String(100), nullable=False),
        sa.Column('param_type', sa.String(20), nullable=False),
        sa.Column('value_string', sa.Text(), nullable=True),
        sa.Column('value_number', sa.Numeric(), nullable=True),
        sa.Column('value_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('value_token_system', sa.String(200), nullable=True),
        sa.Column('value_token_code', sa.String(200), nullable=True),
        sa.ForeignKeyConstraint(['resource_id'], ['fhir.resources.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        schema='fhir'
    )
    
    # Create comprehensive indexes for search
    op.create_index('idx_search_string', 'search_params', ['param_name', 'value_string'], schema='fhir')
    op.create_index('idx_search_number', 'search_params', ['param_name', 'value_number'], schema='fhir')
    op.create_index('idx_search_date', 'search_params', ['param_name', 'value_date'], schema='fhir')
    op.create_index('idx_search_token', 'search_params', ['param_name', 'value_token_system', 'value_token_code'], schema='fhir')
    op.create_index('idx_search_resource', 'search_params', ['resource_id'], schema='fhir')
    
    # Create references table for tracking resource relationships
    op.create_table(
        'references',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('source_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('target_type', sa.String(50), nullable=False),
        sa.Column('target_id', sa.String(64), nullable=False),
        sa.Column('reference_path', sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(['source_id'], ['fhir.resources.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        schema='fhir'
    )
    
    # Create indexes for reference queries
    op.create_index('idx_references_source', 'references', ['source_id'], schema='fhir')
    op.create_index('idx_references_target', 'references', ['target_type', 'target_id'], schema='fhir')


def downgrade():
    # Drop all tables in reverse order
    op.drop_table('references', schema='fhir')
    op.drop_table('search_params', schema='fhir')
    op.drop_table('resource_history', schema='fhir')
    op.drop_table('resources', schema='fhir')
    
    # Drop schema
    op.execute('DROP SCHEMA IF EXISTS fhir CASCADE')