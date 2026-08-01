/**
 * SlotOutlet — the extension point core components publish for module UI
 * (module platform Phase 2, docs/MODULES.md).
 *
 * A core component opts in explicitly:
 *
 *   <SlotOutlet name="patient-header.chips" context={{ patient }} />
 *
 * and enabled modules contribute components by slot name through their
 * manifests. Every contribution renders inside its own error boundary
 * with a VISIBLE inline fallback — a module's broken chip degrades to a
 * small labeled error, never a blank and never a crashed host. (Invisible
 * failure is how the B17 DICOM bug lived in production for days; slots
 * are held to the visible-failure standard from birth.)
 *
 * The `context` prop is the entire API between host and contribution —
 * each slot name documents its context shape in SLOT_NAMES. Contributions
 * receive it spread as props.
 */

import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import { ErrorOutline as SlotErrorIcon } from '@mui/icons-material';

import { getSlotContributions } from '../modules';

class SlotErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error(
      `SlotOutlet: contribution '${this.props.contributionId}' from module ` +
      `'${this.props.moduleId}' crashed in slot '${this.props.slotName}':`,
      error,
    );
  }

  render() {
    if (this.state.error) {
      return (
        <Tooltip title={`Module '${this.props.moduleId}' failed here: ${this.state.error.message}`}>
          <Chip
            size="small"
            color="error"
            variant="outlined"
            icon={<SlotErrorIcon sx={{ fontSize: 14 }} />}
            label={this.props.moduleId}
          />
        </Tooltip>
      );
    }
    return this.props.children;
  }
}

const SlotOutlet = ({ name, context = {} }) => {
  const contributions = getSlotContributions(name);
  if (contributions.length === 0) return null;

  return (
    <>
      {contributions.map(({ id, moduleId, Component }) => (
        <SlotErrorBoundary
          key={`${moduleId}:${id}`}
          slotName={name}
          moduleId={moduleId}
          contributionId={id}
        >
          <Component {...context} />
        </SlotErrorBoundary>
      ))}
    </>
  );
};

export default SlotOutlet;
