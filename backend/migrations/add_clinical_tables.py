"""
Add clinical workflow tables migration
"""
from sqlalchemy import create_engine
from database.database import DATABASE_URL, Base
from models.clinical.notes import ClinicalNote, NoteTemplate
from models.clinical.orders import Order, MedicationOrder, LaboratoryOrder, ImagingOrder, OrderSet
from models.clinical.tasks import InboxItem, ClinicalTask, CareTeam, PatientList
import logging


def upgrade():
    """Create clinical workflow tables"""
    engine = create_engine(DATABASE_URL)
    
    # Import all models to ensure they are registered with Base
    from models import models  # Ensure base models are loaded
    
    # Create only the new tables
    Base.metadata.create_all(bind=engine, tables=[
        ClinicalNote.__table__,
        NoteTemplate.__table__,
        Order.__table__,
        MedicationOrder.__table__,
        LaboratoryOrder.__table__,
        ImagingOrder.__table__,
        OrderSet.__table__,
        InboxItem.__table__,
        ClinicalTask.__table__,
        CareTeam.__table__,
        PatientList.__table__
    ])
    
    logging.info("Clinical workflow tables created successfully")
def downgrade():
    """Drop clinical workflow tables"""
    engine = create_engine(DATABASE_URL)
    
    # Drop tables in reverse order to handle foreign key constraints
    tables_to_drop = [
        PatientList.__table__,
        CareTeam.__table__,
        ClinicalTask.__table__,
        InboxItem.__table__,
        OrderSet.__table__,
        ImagingOrder.__table__,
        LaboratoryOrder.__table__,
        MedicationOrder.__table__,
        Order.__table__,
        NoteTemplate.__table__,
        ClinicalNote.__table__
    ]
    
    for table in tables_to_drop:
        table.drop(engine, checkfirst=True)
    
    logging.info("Clinical workflow tables dropped successfully")
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()