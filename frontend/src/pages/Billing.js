import React from 'react';
import UnderConstruction from '../components/UnderConstruction';
import {
  AttachMoney as BillingIcon
} from '@mui/icons-material';

const Billing = () => {
  return (
    <UnderConstruction
      featureName="Billing & Claims"
      description="Streamline your revenue cycle with integrated billing, claims processing, and payment tracking. Ensure accurate coding and maximize reimbursements."
      estimatedDate="Q3 2025"
      customIcon={<BillingIcon sx={{ fontSize: 80, color: '#FFB74D', opacity: 0.8 }} />}
      plannedFeatures={[
        "Automated charge capture",
        "ICD-10 and CPT coding assistance",
        "Claims submission and tracking",
        "ERA/EOB processing",
        "Patient statements and invoicing",
        "Payment posting and reconciliation",
        "Insurance eligibility verification",
        "Prior authorization management",
        "Denial management and appeals",
        "Revenue cycle analytics"
      ]}
      alternativeActions={[
        { label: "View encounters", path: "/encounters" },
        { label: "Access patient records", path: "/patients" }
      ]}
    />
  );
};

export default Billing;