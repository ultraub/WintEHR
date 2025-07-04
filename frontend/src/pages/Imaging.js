import React from 'react';
import UnderConstruction from '../components/UnderConstruction';
import {
  Image as ImagingIcon
} from '@mui/icons-material';

const Imaging = () => {
  return (
    <UnderConstruction
      featureName="Imaging & Radiology"
      description="View and manage medical imaging studies, radiology reports, and diagnostic images. Integrate with PACS systems for comprehensive imaging workflows."
      estimatedDate="Q3 2025"
      customIcon={<ImagingIcon sx={{ fontSize: 80, color: '#9c27b0', opacity: 0.8 }} />}
      plannedFeatures={[
        "DICOM image viewer",
        "Radiology report viewing",
        "Image ordering workflows",
        "PACS integration",
        "Image comparison tools",
        "Annotation and measurement",
        "Report status tracking",
        "Critical findings alerts",
        "Image sharing capabilities",
        "Mobile image viewing"
      ]}
      alternativeActions={[
        { label: "View lab results", path: "/lab-results" },
        { label: "Access patient records", path: "/patients" }
      ]}
    />
  );
};

export default Imaging;