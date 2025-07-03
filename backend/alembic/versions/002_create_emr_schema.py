"""Create EMR schema and extension tables

Revision ID: 002_emr_schema
Revises: 001_fhir_schema
Create Date: 2025-01-07

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '002_emr_schema'
down_revision = '001_fhir_schema'
branch_labels = None
depends_on = None


def upgrade():
    # Create EMR schema
    op.execute('CREATE SCHEMA IF NOT EXISTS emr')
    
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('practitioner_id', sa.String(64), nullable=True),
        sa.Column('username', sa.String(100), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=True),
        sa.Column('role', sa.String(50), nullable=False, server_default='user'),
        sa.Column('preferences', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('last_login', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username', name='uq_users_username'),
        sa.UniqueConstraint('email', name='uq_users_email'),
        schema='emr'
    )
    
    # Create sessions table
    op.create_table(
        'sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('token', sa.String(500), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['user_id'], ['emr.users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token', name='uq_sessions_token'),
        schema='emr'
    )
    
    # Create workflows table
    op.create_table(
        'workflows',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('definition', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['created_by'], ['emr.users.id']),
        sa.PrimaryKeyConstraint('id'),
        schema='emr'
    )
    
    # Create task extensions table
    op.create_table(
        'task_extensions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('task_fhir_id', sa.String(64), nullable=False),
        sa.Column('workflow_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('ui_state', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('assigned_to', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('priority', sa.Integer(), nullable=True),
        sa.Column('tags', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['workflow_id'], ['emr.workflows.id']),
        sa.ForeignKeyConstraint(['assigned_to'], ['emr.users.id']),
        sa.PrimaryKeyConstraint('id'),
        schema='emr'
    )
    
    # Create audit logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('resource_type', sa.String(50), nullable=True),
        sa.Column('resource_id', sa.String(64), nullable=True),
        sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('ip_address', postgresql.INET(), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['user_id'], ['emr.users.id']),
        sa.PrimaryKeyConstraint('id'),
        schema='emr'
    )
    
    # Create UI states table
    op.create_table(
        'ui_states',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('context', sa.String(100), nullable=False),
        sa.Column('state', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['user_id'], ['emr.users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'context', name='uq_ui_states_user_context'),
        schema='emr'
    )
    
    # Create CDS rules table
    op.create_table(
        'cds_rules',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('condition', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('action', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.PrimaryKeyConstraint('id'),
        schema='emr'
    )
    
    # Create templates table
    op.create_table(
        'templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('content', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('questionnaire_id', sa.String(64), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['created_by'], ['emr.users.id']),
        sa.PrimaryKeyConstraint('id'),
        schema='emr'
    )
    
    # Create indexes for performance
    op.create_index('idx_sessions_expires', 'sessions', ['expires_at'], schema='emr')
    op.create_index('idx_audit_logs_created', 'audit_logs', ['created_at'], schema='emr')
    op.create_index('idx_audit_logs_user', 'audit_logs', ['user_id'], schema='emr')
    op.create_index('idx_audit_logs_resource', 'audit_logs', ['resource_type', 'resource_id'], schema='emr')
    op.create_index('idx_task_extensions_task', 'task_extensions', ['task_fhir_id'], schema='emr')
    op.create_index('idx_task_extensions_assigned', 'task_extensions', ['assigned_to'], schema='emr')
    op.create_index('idx_templates_type', 'templates', ['type'], schema='emr')


def downgrade():
    # Drop all tables in reverse order
    op.drop_table('templates', schema='emr')
    op.drop_table('cds_rules', schema='emr')
    op.drop_table('ui_states', schema='emr')
    op.drop_table('audit_logs', schema='emr')
    op.drop_table('task_extensions', schema='emr')
    op.drop_table('workflows', schema='emr')
    op.drop_table('sessions', schema='emr')
    op.drop_table('users', schema='emr')
    
    # Drop schema
    op.execute('DROP SCHEMA IF EXISTS emr CASCADE')