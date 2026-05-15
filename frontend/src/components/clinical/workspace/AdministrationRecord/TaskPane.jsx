/**
 * TaskPane — non-medication recording tasks for the MAR (#116 Phase 5.2).
 *
 * Right-side pane on the Administration tab. Where the MAR grid charts
 * medication doses, this pane charts the other things a nurse records
 * during a shift: immunizations, specimen collections, procedures.
 *
 * Data comes from `GET /api/clinical/administration/tasks` via
 * `useAdministrationTasks` — each pending order is a tappable card that
 * opens the matching recording dialog; fulfilled orders show muted with a
 * check. The three dialogs each POST to a `/record/{type}` endpoint.
 */

import React, { useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  Vaccines as ImmunizationIcon,
  Biotech as SpecimenIcon,
  MedicalServices as ProcedureIcon,
  CheckCircle as DoneIcon,
} from '@mui/icons-material';

import { useAdministrationTasks } from './useAdministrationTasks';
import ImmunizationAdminDialog from './dialogs/ImmunizationAdminDialog';
import SpecimenCollectionDialog from './dialogs/SpecimenCollectionDialog';
import ProcedurePerformanceDialog from './dialogs/ProcedurePerformanceDialog';

const SECTIONS = [
  { type: 'immunization', key: 'immunizations', label: 'Immunizations', Icon: ImmunizationIcon },
  { type: 'specimen', key: 'specimens', label: 'Specimen collection', Icon: SpecimenIcon },
  { type: 'procedure', key: 'procedures', label: 'Procedures', Icon: ProcedureIcon },
];

const formatOrdered = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const TaskCard = ({ task, onClick }) => {
  const ordered = formatOrdered(task.ordered_datetime);
  return (
    <Paper
      variant="outlined"
      onClick={task.fulfilled ? undefined : onClick}
      role={task.fulfilled ? undefined : 'button'}
      tabIndex={task.fulfilled ? undefined : 0}
      onKeyDown={(e) => {
        if (!task.fulfilled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      sx={{
        p: 1,
        cursor: task.fulfilled ? 'default' : 'pointer',
        opacity: task.fulfilled ? 0.6 : 1,
        transition: 'background-color 0.15s, border-color 0.15s',
        '&:hover': task.fulfilled ? {} : { borderColor: 'primary.main', bgcolor: 'action.hover' },
      }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {task.code_display}
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} alignItems="center">
            {ordered && (
              <Typography variant="caption" color="text.secondary">
                Ordered {ordered}
              </Typography>
            )}
            {task.priority && task.priority !== 'routine' && (
              <Chip label={task.priority} size="small" color="warning" sx={{ height: 18 }} />
            )}
          </Stack>
        </Box>
        {task.fulfilled && <DoneIcon fontSize="small" color="success" />}
      </Stack>
    </Paper>
  );
};

/**
 * @param {object} props
 * @param {string} props.patientId — bare FHIR id
 */
const TaskPane = ({ patientId }) => {
  const { data, loading, error, refetch } = useAdministrationTasks({ patientId });
  const [active, setActive] = useState({ type: null, task: null });

  const closeDialog = () => setActive({ type: null, task: null });

  const totalPending = SECTIONS.reduce(
    (sum, s) => sum + ((data?.[s.key] || []).filter((t) => !t.fulfilled).length),
    0,
  );

  return (
    <Box sx={{ p: 1.5 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="overline" color="text.secondary">Tasks</Typography>
        {totalPending > 0 && (
          <Chip label={`${totalPending} pending`} size="small" color="primary" />
        )}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 1 }}>
          Failed to load tasks: {error.message}
        </Alert>
      )}

      {loading && !data && (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 2 }}>
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">Loading tasks…</Typography>
        </Stack>
      )}

      {data && (
        <Stack spacing={1.5}>
          {SECTIONS.map(({ type, key, label, Icon }) => {
            const tasks = data[key] || [];
            return (
              <Box key={type}>
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                  <Icon fontSize="small" color="action" />
                  <Typography variant="subtitle2">{label}</Typography>
                  <Typography variant="caption" color="text.secondary">({tasks.length})</Typography>
                </Stack>
                {tasks.length === 0 ? (
                  <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
                    No orders.
                  </Typography>
                ) : (
                  <Stack spacing={0.75}>
                    {tasks.map((task) => (
                      <TaskCard
                        key={task.service_request_id}
                        task={task}
                        onClick={() => setActive({ type, task })}
                      />
                    ))}
                  </Stack>
                )}
              </Box>
            );
          })}
        </Stack>
      )}

      <ImmunizationAdminDialog
        open={active.type === 'immunization'}
        task={active.task}
        patientId={patientId}
        onClose={closeDialog}
        onRecorded={refetch}
      />
      <SpecimenCollectionDialog
        open={active.type === 'specimen'}
        task={active.task}
        patientId={patientId}
        onClose={closeDialog}
        onRecorded={refetch}
      />
      <ProcedurePerformanceDialog
        open={active.type === 'procedure'}
        task={active.task}
        patientId={patientId}
        onClose={closeDialog}
        onRecorded={refetch}
      />
    </Box>
  );
};

export default TaskPane;
