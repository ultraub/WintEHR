"""Create appointment tables

Revision ID: 003
Revises: 002
Create Date: 2025-01-07 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '003_create_appointment_tables'
down_revision = '002_create_emr_schema'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create appointment status enum with raw SQL
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE appointmentstatus AS ENUM (
                'proposed', 'pending', 'booked', 'arrived', 'fulfilled', 
                'cancelled', 'noshow', 'entered-in-error', 'checked-in', 'waitlist'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # Create participant status enum with raw SQL
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE participantstatus AS ENUM (
                'accepted', 'declined', 'tentative', 'needs-action'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # Create participant required enum with raw SQL
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE participantrequired AS ENUM (
                'required', 'optional', 'information-only'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # Reference the enums for use in table creation
    appointment_status_enum = postgresql.ENUM(
        'proposed', 'pending', 'booked', 'arrived', 'fulfilled', 
        'cancelled', 'noshow', 'entered-in-error', 'checked-in', 'waitlist',
        name='appointmentstatus',
        create_type=False
    )
    
    participant_status_enum = postgresql.ENUM(
        'accepted', 'declined', 'tentative', 'needs-action',
        name='participantstatus',
        create_type=False
    )
    
    participant_required_enum = postgresql.ENUM(
        'required', 'optional', 'information-only',
        name='participantrequired',
        create_type=False
    )

    # Create appointments table
    op.create_table(
        'appointments',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('identifier', sa.JSON(), nullable=True),
        sa.Column('status', appointment_status_enum, nullable=False),
        sa.Column('cancellation_reason', sa.JSON(), nullable=True),
        sa.Column('service_category', sa.JSON(), nullable=True),
        sa.Column('service_type', sa.JSON(), nullable=True),
        sa.Column('specialty', sa.JSON(), nullable=True),
        sa.Column('appointment_type', sa.JSON(), nullable=True),
        sa.Column('reason_code', sa.JSON(), nullable=True),
        sa.Column('reason_reference', sa.JSON(), nullable=True),
        sa.Column('priority', sa.Integer(), default=5),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('supporting_information', sa.JSON(), nullable=True),
        sa.Column('start', sa.DateTime(), nullable=False),
        sa.Column('end', sa.DateTime(), nullable=False),
        sa.Column('minutes_duration', sa.Integer(), nullable=True),
        sa.Column('slot', sa.JSON(), nullable=True),
        sa.Column('created', sa.DateTime(), nullable=True),
        sa.Column('last_updated', sa.DateTime(), nullable=True),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('patient_instruction', sa.Text(), nullable=True),
        sa.Column('based_on', sa.JSON(), nullable=True),
        sa.Column('requested_period', sa.JSON(), nullable=True),
        sa.Column('meta', sa.JSON(), nullable=True),
        sa.Column('text', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create appointment_participants table
    op.create_table(
        'appointment_participants',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('appointment_id', sa.String(), nullable=False),
        sa.Column('type', sa.JSON(), nullable=True),
        sa.Column('actor_type', sa.String(), nullable=True),
        sa.Column('actor_id', sa.String(), nullable=True),
        sa.Column('required', participant_required_enum, default='required'),
        sa.Column('status', participant_status_enum, nullable=False),
        sa.Column('period', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['appointment_id'], ['appointments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for better performance
    op.create_index('idx_appointments_status', 'appointments', ['status'])
    op.create_index('idx_appointments_start', 'appointments', ['start'])
    op.create_index('idx_appointments_end', 'appointments', ['end'])
    op.create_index('idx_appointment_participants_appointment_id', 'appointment_participants', ['appointment_id'])
    op.create_index('idx_appointment_participants_actor', 'appointment_participants', ['actor_type', 'actor_id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_appointment_participants_actor', 'appointment_participants')
    op.drop_index('idx_appointment_participants_appointment_id', 'appointment_participants')
    op.drop_index('idx_appointments_end', 'appointments')
    op.drop_index('idx_appointments_start', 'appointments')
    op.drop_index('idx_appointments_status', 'appointments')
    
    # Drop tables
    op.drop_table('appointment_participants')
    op.drop_table('appointments')
    
    # Drop enums
    op.execute('DROP TYPE IF EXISTS participantrequired')
    op.execute('DROP TYPE IF EXISTS participantstatus')
    op.execute('DROP TYPE IF EXISTS appointmentstatus')