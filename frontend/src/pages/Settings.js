import React from 'react';
import UnderConstruction from '../components/UnderConstruction';
import {
  Settings as SettingsIcon
} from '@mui/icons-material';

const Settings = () => {
  return (
    <UnderConstruction
      featureName="Settings & Profile"
      description="Manage your account settings, preferences, and profile information. Configure system preferences, notification settings, and security options."
      estimatedDate="Q1 2025"
      customIcon={<SettingsIcon sx={{ fontSize: 80, color: '#5B9FBC', opacity: 0.8 }} />}
      plannedFeatures={[
        "Personal profile management",
        "Account security settings",
        "Notification preferences",
        "Display and theme customization",
        "Language and regional settings",
        "API key management",
        "Two-factor authentication",
        "Session management",
        "Privacy settings",
        "Export personal data"
      ]}
      alternativeActions={[
        { label: "View current user info in Dashboard", path: "/dashboard" },
        { label: "Manage audit trail", path: "/audit-trail" }
      ]}
    />
  );
};

export default Settings;