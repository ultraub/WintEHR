import React from 'react';
import UnderConstruction from '../components/UnderConstruction';
import {
  CalendarMonth as ScheduleIcon
} from '@mui/icons-material';

const Schedule = () => {
  return (
    <UnderConstruction
      featureName="Provider Schedule"
      description="Manage appointments, view provider schedules, and coordinate patient visits. Streamline scheduling with intelligent booking and resource management."
      estimatedDate="Q2 2025"
      customIcon={<ScheduleIcon sx={{ fontSize: 80, color: '#2196f3', opacity: 0.8 }} />}
      plannedFeatures={[
        "Provider calendar views",
        "Appointment booking and management",
        "Resource and room scheduling",
        "Recurring appointment support",
        "Appointment type configuration",
        "Patient reminder system",
        "Waitlist management",
        "Schedule optimization",
        "Multi-provider coordination",
        "Integration with patient portal"
      ]}
      alternativeActions={[
        { label: "View today's encounters", path: "/encounters" },
        { label: "Schedule new encounter", path: "/encounters/schedule" },
        { label: "Return to dashboard", path: "/dashboard" }
      ]}
    />
  );
};

export default Schedule;