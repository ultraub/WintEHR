/**
 * WorkflowContextPicker — the small "Context" select at the end of the chart
 * tab strip (Command Center slice 18). Lists the workflow contexts the tab
 * policy defines (inpatient, surgical, …); the choice is remembered per
 * browser (tabPolicyStore.setWorkflowContext) and narrows the tabs and
 * sections on top of the user's role. Renders nothing when the policy has
 * no contexts, so the strip is unchanged for deployments that never use them.
 */

import React from 'react';
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { useEffectiveTabs } from './useEffectiveTabs';
import { setWorkflowContext } from './tabPolicyStore';

const WorkflowContextPicker = ({ dense = false }) => {
  const { contexts, context } = useEffectiveTabs();
  if (!contexts || contexts.length === 0) return null;
  return (
    <FormControl size="small" sx={{ minWidth: 130, mx: 1, my: dense ? 0.5 : 0.75 }} data-testid="workflow-context">
      <InputLabel id="workflow-context-label">Context</InputLabel>
      <Select labelId="workflow-context-label" label="Context" value={context || ''} onChange={(e) => setWorkflowContext(e.target.value || null)}
        inputProps={{ 'aria-label': 'Workflow context' }} sx={{ fontSize: dense ? '0.75rem' : '0.8125rem' }}>
        <MenuItem value="">None</MenuItem>
        {contexts.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
      </Select>
    </FormControl>
  );
};

export default WorkflowContextPicker;
