import React from 'react';
import UnderConstruction from '../components/UnderConstruction';
import {
  Message as MessagingIcon
} from '@mui/icons-material';

const Messaging = () => {
  return (
    <UnderConstruction
      featureName="Secure Messaging"
      description="HIPAA-compliant messaging for healthcare teams. Communicate securely with colleagues, staff, and patients while maintaining complete audit trails."
      estimatedDate="Q2 2025"
      customIcon={<MessagingIcon sx={{ fontSize: 80, color: '#64B5F6', opacity: 0.8 }} />}
      plannedFeatures={[
        "Provider-to-provider messaging",
        "Staff communication channels",
        "Patient portal messaging",
        "Message encryption and security",
        "Read receipts and delivery status",
        "File and image attachments",
        "Message threading and organization",
        "Quick response templates",
        "Priority and urgent messaging",
        "Integration with clinical workflows"
      ]}
      alternativeActions={[
        { label: "View inbox in clinical workspace", path: "/clinical-workspace/placeholder" },
        { label: "Check notifications", path: "/dashboard" }
      ]}
    />
  );
};

export default Messaging;