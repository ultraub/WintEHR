# DICOM Upload Test Guide

## Quick Upload Test

### Step 1: Select a Test Patient
1. Login to the system (any provider)
2. Go to **Patient List**
3. Search for **Steven Williams** (MRN: MRN7a290b22)
   - He currently has NO imaging studies (clean slate)
4. Select him to make him the current patient

### Step 2: Navigate to Upload
1. Go to **Clinical Workspace**
2. Click **Results** tab
3. Click **Imaging** sub-tab
4. You should see "No imaging studies available" message
5. Click **Upload DICOM** button

### Step 3: Upload Sample Files
1. Browse to sample files: `/backend/data/sample_dicoms/`
2. Select one or more `.dcm` files:
   - `sample_ct_slice_001.dcm` (single CT slice)
   - Or select multiple slices: `sample_ct_slice_001.dcm` through `sample_ct_slice_005.dcm`
3. Click Upload

### Step 4: Verify Results
After successful upload, you should see:
1. **Success message**: "Successfully uploaded X DICOM file(s)"
2. **New study appears** in the imaging list with:
   - Study description (extracted from DICOM header)
   - Modality (CT, MR, XR, etc.)
   - Number of series and images
   - Upload status: "complete"
   - **View Images** button

### Step 5: Test Image Viewer
1. Click **View Images** on the new study
2. DICOM viewer should open showing the uploaded images
3. Test navigation controls (if multiple images)
4. Test window/level adjustments

## What Gets Created Automatically

When you upload DICOM files, the system automatically:

### Database Records:
- **DICOMStudy**: Study-level metadata
- **DICOMSeries**: Series-level information  
- **DICOMInstance**: Individual image records

### File Storage:
```
/backend/data/dicom_uploads/
└── {StudyInstanceUID}/
    └── {SeriesInstanceUID}/
        ├── {SOPInstanceUID}.dcm
        └── {SOPInstanceUID}.dcm
```

### Extracted Metadata:
- **Patient Info**: Name, DOB, Gender (validated against selected patient)
- **Study Info**: Date, Time, Description, Modality, Accession Number
- **Series Info**: Description, Body Part, Protocol, Slice thickness
- **Image Info**: Dimensions, Window settings, Position, Orientation

## Testing Different Scenarios

### Test 1: Single Image Upload
- Upload just `sample_ct_slice_001.dcm`
- Should create 1 study with 1 series with 1 image

### Test 2: Multi-Image Series Upload  
- Upload `sample_ct_slice_001.dcm` through `sample_ct_slice_005.dcm`
- Should create 1 study with 1 series with 5 images
- Test multi-frame navigation in viewer

### Test 3: Multiple Patients
- Upload to **Steven Williams** first
- Then upload different files to **Patricia Thompson**
- Verify each patient has separate studies

### Test 4: Additional Studies
- Upload to **John Walker** (who already has 3 studies)
- Should add a 4th study to his existing list

## Expected File Formats

### Supported:
- `.dcm` files (DICOM format)
- `.DCM` files (case variation)

### Metadata Requirements:
DICOM files should contain:
- Patient identification tags
- Study/Series/Instance UIDs
- Image pixel data
- Basic DICOM headers

## Troubleshooting

### Upload Fails:
- **Check file format**: Must be `.dcm` extension
- **Check file validity**: Must be valid DICOM files
- **Check patient selection**: Must have a patient selected
- **Check browser console**: Look for error messages

### No Studies Show After Upload:
- **Refresh the page**: Sometimes needed after upload
- **Check patient selection**: Ensure same patient is still selected
- **Check browser console**: Look for API errors

### Viewer Won't Open:
- **Check browser console**: Look for Cornerstone.js errors
- **Check file paths**: Verify DICOM files were saved correctly
- **Try different browser**: Some browsers handle DICOM better

## API Verification

Test the upload API directly:
```bash
# Test upload for Steven Williams
curl -X POST -F "patient_id=d7a0335d-319b-4345-8695-d4a4708c44d5" \
     -F "files=@/backend/data/sample_dicoms/sample_ct_slice_001.dcm" \
     http://localhost:8000/api/imaging/upload

# Check studies after upload
curl http://localhost:8000/api/imaging/studies/d7a0335d-319b-4345-8695-d4a4708c44d5
```

## Expected Results

After successful testing, **Steven Williams** should have:
- ✅ New imaging study in his record
- ✅ Viewable images in the DICOM viewer
- ✅ Complete metadata extracted from DICOM headers
- ✅ Files properly organized on filesystem