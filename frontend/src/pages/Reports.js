import React from 'react';
import UnderConstruction from '../components/UnderConstruction';
import {
  Assessment as ReportsIcon
} from '@mui/icons-material';

const Reports = () => {
  return (
    <UnderConstruction
      featureName="Reports & Analytics"
      description="Generate comprehensive clinical reports, quality metrics, and performance analytics. Export data for regulatory compliance and practice management."
      estimatedDate="Q2 2025"
      customIcon={<ReportsIcon sx={{ fontSize: 80, color: '#81C784', opacity: 0.8 }} />}
      plannedFeatures={[
        "Clinical summary reports",
        "Quality measure reports",
        "Financial reports and billing analytics",
        "Patient population reports",
        "Provider productivity metrics",
        "Compliance and audit reports",
        "Custom report builder",
        "Scheduled report generation",
        "Export to PDF, Excel, and CSV",
        "MIPS and regulatory reporting"
      ]}
      alternativeActions={[
        { label: "View population analytics", path: "/analytics" },
        { label: "Check quality measures", path: "/quality" },
        { label: "Access audit trail", path: "/audit-trail" }
      ]}
    />
  );
};

export default Reports;