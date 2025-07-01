# Generic DICOM Test Images

This directory contains generic DICOM medical images that can be uploaded for any patient in the system.

## Files Included

- `generic_ct_head_001.dcm` through `generic_ct_head_003.dcm` - Head CT scan series
- `generic_ct_chest_001.dcm` - Chest CT scan
- `generic_xr_chest_001.dcm` - Chest X-ray

## Purpose

These generic images are designed to:
- Allow testing DICOM functionality with any patient
- Demonstrate different imaging modalities (CT, X-ray)
- Test the system's ability to handle various DICOM formats
- Enable quick demos without patient-specific data

## Usage

These images can be uploaded to any patient record through:
1. Navigate to any patient's Clinical Workspace
2. Go to the Results tab → Imaging section
3. Click "Upload DICOM"
4. Select any of these generic files

The system will automatically:
- Create a new imaging study for the patient
- Extract and display DICOM metadata
- Enable viewing with the integrated DICOM viewer

## Technical Details

- Modalities: CT (Computed Tomography), CR (Computed Radiography/X-ray)
- All images are anonymized and contain no real patient data
- Compatible with DICOM 3.0 standard