from sqlalchemy import Column, Integer, String, DateTime, Float, Text, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
import uuid


class DICOMStudy(Base):
    """DICOM Study metadata"""
    __tablename__ = "dicom_studies"

    id = Column(Integer, primary_key=True, index=True)
    study_instance_uid = Column(String(64), unique=True, index=True)
    patient_id = Column(String, ForeignKey('patients.id'))
    imaging_study_id = Column(String, ForeignKey('imaging_studies.id'), nullable=True)
    
    # Study metadata
    study_date = Column(DateTime)
    study_time = Column(String(16))
    accession_number = Column(String(16), index=True)
    study_description = Column(String(64))
    modality = Column(String(16))  # CT, MR, US, XR, etc.
    referring_physician = Column(String(64))
    patient_name = Column(String(64))  # From DICOM (for verification)
    patient_birth_date = Column(DateTime)
    patient_sex = Column(String(1))
    
    # Study statistics
    number_of_series = Column(Integer, default=0)
    number_of_instances = Column(Integer, default=0)
    study_size_mb = Column(Float, default=0.0)
    
    # Storage information
    storage_path = Column(String(255))  # Base path for study files
    thumbnail_path = Column(String(255))  # Preview image
    
    # Status
    upload_status = Column(String(20), default='pending')  # pending, processing, complete, error
    processing_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    patient = relationship("Patient")
    imaging_study = relationship("ImagingStudy", back_populates="dicom_study", uselist=False)
    series = relationship("DICOMSeries", back_populates="study", cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            'id': self.id,
            'study_instance_uid': self.study_instance_uid,
            'patient_id': self.patient_id,
            'study_date': self.study_date.isoformat() if self.study_date else None,
            'study_description': self.study_description,
            'modality': self.modality,
            'accession_number': self.accession_number,
            'number_of_series': self.number_of_series,
            'number_of_instances': self.number_of_instances,
            'study_size_mb': self.study_size_mb,
            'upload_status': self.upload_status,
            'has_thumbnail': bool(self.thumbnail_path),
            'series': [s.to_dict() for s in self.series]
        }


class DICOMSeries(Base):
    """DICOM Series metadata"""
    __tablename__ = "dicom_series"

    id = Column(Integer, primary_key=True, index=True)
    series_instance_uid = Column(String(64), unique=True, index=True)
    study_id = Column(Integer, ForeignKey('dicom_studies.id'))
    
    # Series metadata
    series_number = Column(Integer)
    series_date = Column(DateTime)
    series_time = Column(String(16))
    series_description = Column(String(64))
    modality = Column(String(16))
    body_part_examined = Column(String(16))
    protocol_name = Column(String(64))
    
    # Technical parameters
    slice_thickness = Column(Float)
    spacing_between_slices = Column(Float)
    pixel_spacing = Column(String(32))  # "0.5\0.5"
    rows = Column(Integer)
    columns = Column(Integer)
    
    # Series statistics
    number_of_instances = Column(Integer, default=0)
    series_size_mb = Column(Float, default=0.0)
    
    # Storage
    storage_path = Column(String(255))
    thumbnail_path = Column(String(255))
    
    # Relationships
    study = relationship("DICOMStudy", back_populates="series")
    instances = relationship("DICOMInstance", back_populates="series", cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            'id': self.id,
            'series_instance_uid': self.series_instance_uid,
            'series_number': self.series_number,
            'series_description': self.series_description,
            'modality': self.modality,
            'body_part_examined': self.body_part_examined,
            'number_of_instances': self.number_of_instances,
            'instances': [i.to_dict() for i in self.instances]
        }


class DICOMInstance(Base):
    """Individual DICOM file/instance"""
    __tablename__ = "dicom_instances"

    id = Column(Integer, primary_key=True, index=True)
    sop_instance_uid = Column(String(64), unique=True, index=True)
    series_id = Column(Integer, ForeignKey('dicom_series.id'))
    
    # Instance metadata
    instance_number = Column(Integer)
    sop_class_uid = Column(String(64))
    
    # Image parameters
    rows = Column(Integer)
    columns = Column(Integer)
    bits_allocated = Column(Integer)
    bits_stored = Column(Integer)
    photometric_interpretation = Column(String(16))
    
    # Position/Orientation (for 3D reconstruction)
    image_position_patient = Column(String(64))  # "x\y\z"
    image_orientation_patient = Column(String(128))  # "rowX\rowY\rowZ\colX\colY\colZ"
    slice_location = Column(Float)
    
    # Window/Level defaults
    window_center = Column(String(16))
    window_width = Column(String(16))
    
    # File information
    file_path = Column(String(255))
    file_size_kb = Column(Float)
    transfer_syntax_uid = Column(String(64))
    
    # Processing
    is_compressed = Column(Boolean, default=False)
    has_pixel_data = Column(Boolean, default=True)
    
    # Relationships
    series = relationship("DICOMSeries", back_populates="instances")
    
    def to_dict(self):
        return {
            'id': self.id,
            'sop_instance_uid': self.sop_instance_uid,
            'instance_number': self.instance_number,
            'rows': self.rows,
            'columns': self.columns,
            'slice_location': self.slice_location,
            'window_center': self.window_center,
            'window_width': self.window_width,
            'file_path': self.file_path
        }


class ImagingResult(Base):
    """Links ImagingStudy orders to actual DICOM data and reports"""
    __tablename__ = "imaging_results"

    id = Column(Integer, primary_key=True, index=True)
    imaging_study_id = Column(String, ForeignKey('imaging_studies.id'))
    dicom_study_id = Column(Integer, ForeignKey('dicom_studies.id'), nullable=True)
    diagnostic_report_id = Column(String, ForeignKey('diagnostic_reports.id'), nullable=True)
    
    # Report content
    findings = Column(Text)
    impression = Column(Text)
    recommendations = Column(Text)
    
    # Status
    status = Column(String(20), default='preliminary')  # preliminary, final, amended
    reported_by = Column(String(64))
    reported_at = Column(DateTime)
    
    # Key images
    key_images = Column(JSON)  # List of instance UIDs marked as key images
    measurements = Column(JSON)  # Structured measurements from the study
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    imaging_study = relationship("ImagingStudy")
    dicom_study = relationship("DICOMStudy")
    diagnostic_report = relationship("DiagnosticReport")
    
    def to_dict(self):
        return {
            'id': self.id,
            'imaging_study_id': self.imaging_study_id,
            'dicom_study_id': self.dicom_study_id,
            'findings': self.findings,
            'impression': self.impression,
            'status': self.status,
            'reported_by': self.reported_by,
            'reported_at': self.reported_at.isoformat() if self.reported_at else None,
            'has_images': bool(self.dicom_study_id),
            'has_report': bool(self.findings or self.impression)
        }


# Update relationships in existing models
# Add to Patient model:
# dicom_studies = relationship("DICOMStudy", back_populates="patient")

# Add to ImagingStudy model:
# result = relationship("ImagingResult", back_populates="imaging_study", uselist=False)
# dicom_study = relationship("DICOMStudy", back_populates="imaging_study", uselist=False)