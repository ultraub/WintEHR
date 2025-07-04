import React from 'react';
import UnderConstruction from '../components/UnderConstruction';
import {
  Assignment as TasksIcon
} from '@mui/icons-material';

const Tasks = () => {
  return (
    <UnderConstruction
      featureName="Tasks Management"
      description="Efficiently manage clinical and administrative tasks. Track assignments, deadlines, and priorities to ensure nothing falls through the cracks."
      estimatedDate="Available Now in Clinical Workspace"
      customIcon={<TasksIcon sx={{ fontSize: 80, color: '#f57c00', opacity: 0.8 }} />}
      plannedFeatures={[
        "Task creation and assignment",
        "Priority levels and due dates",
        "Task categories and labels",
        "Team collaboration features",
        "Task templates for common workflows",
        "Automated task generation from orders",
        "Task dependencies and workflows",
        "Performance metrics and reporting",
        "Mobile task management",
        "Integration with clinical workflows"
      ]}
      alternativeActions={[
        { label: "Access Tasks in Clinical Workspace", path: "/clinical-workspace/placeholder" },
        { label: "View Dashboard", path: "/dashboard" },
        { label: "Check pending alerts", path: "/alerts" }
      ]}
    />
  );
};

export default Tasks;