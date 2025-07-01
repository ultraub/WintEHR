# Imaging Workflow Test Guide

## Test the Existing Imaging System

### Step 1: Access the System
1. Ensure frontend is running: `cd frontend && npm start`
2. Ensure backend is running: `cd backend && python main.py`
3. Open browser to http://localhost:3000

### Step 2: Login and Select Patient
1. Click any provider from the dropdown to login
2. Go to **Patient List** 
3. Search for and select **John Walker** (MRN: MRN8f3525c7)
   - He has 3 imaging studies ready to view
4. Alternatively, select **Emily Martin** (MRN: MRN4cf1fef5)
   - She has 1 CT study ready to view

### Step 3: View Existing Images
1. Navigate to **Clinical Workspace**
2. Click the **Results** tab
3. Click the **Imaging** sub-tab
4. You should see:
   - List of imaging studies for the selected patient
   - Upload DICOM button
   - "View Images" buttons for each study

### Step 4: Test Image Viewer
1. Click "View Images" on any study
2. DICOM viewer should open with:
   - Image display area
   - Navigation controls (if multi-frame)
   - Window/Level controls
   - Zoom controls

### Step 5: Test Upload Functionality
1. In the Imaging tab, click "Upload DICOM"
2. Select sample files from: `/backend/data/sample_dicoms/`
3. Upload should create new study records
4. New studies should appear in the list

## Expected Results

### For John Walker:
- ✅ CT Head without contrast (5 images)
- ✅ Chest X-Ray PA and Lateral (1 image)  
- ✅ MRI Brain with contrast (3 images)

### For Emily Martin:
- ✅ Sample CT Head Series (5 images)

## Troubleshooting

### If No Studies Show:
1. Check patient selection - ensure John Walker or Emily Martin is selected
2. Check browser console for API errors
3. Verify patient ID matches in both database and frontend

### If Upload Fails:
1. Check file format (.dcm extension)
2. Check backend logs for errors
3. Verify patient is selected before upload

### If Viewer Doesn't Work:
1. Check browser console for Cornerstone.js errors
2. Verify DICOM file paths are accessible
3. Check WADO-URI endpoint responses

## API Testing Commands

```bash
# Test imaging studies endpoint
curl http://localhost:8000/api/imaging/studies/91691801-042a-463c-ad6d-648cd4264ca8

# Test upload endpoint
curl -X POST -F "patient_id=91691801-042a-463c-ad6d-648cd4264ca8" \
     -F "files=@/path/to/sample.dcm" \
     http://localhost:8000/api/imaging/upload
```

## Database Verification

```python
# Check studies in database
python -c "
from database.database import get_db
from models.dicom_models import DICOMStudy
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine

engine = create_engine('sqlite:///./data/emr.db')
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

studies = db.query(DICOMStudy).all()
for study in studies:
    print(f'{study.patient_id}: {study.study_description} ({study.modality})')
"
```