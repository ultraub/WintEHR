/**
 * Population Analytics
 * One page, three questions about the living patient population: who they
 * are, what they have, and what they take. Everything is drawn from a single
 * snapshot (`GET /api/analytics/population`), so every figure counts
 * patients and is a share of the same total.
 *
 * Picking a condition opens its cohort: how common it is in each age group,
 * what it is seen with, and what those patients are prescribed.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Grid,
  Paper,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import api from '../services/api';
import BarList from '../components/common/BarList';
import ColumnBars from '../components/common/ColumnBars';
import PageHeader from '../components/common/PageHeader';
import PopulationPyramid from '../components/common/PopulationPyramid';
import StatTile from '../components/common/StatTile';
import ClinicalEmptyState from '../components/clinical/shared/ClinicalEmptyState';
import {
  describeAgeStructure,
  describeCohort,
  describeCohortBySex,
  describeConditions,
  describeMedicationBurden,
} from '../utils/populationSummaries';

const percent = (value) => `${Math.round(value)}%`;
const countAndShare = (count, total) => (total > 0 ? `${count} (${Math.round((count / total) * 100)}%)` : String(count));

/** A titled block: heading, one sentence saying what the data shows, content. */
const Section = ({ id, title, summary, children }) => (
  <Box component="section" aria-labelledby={`${id}-heading`} sx={{ mb: 4 }}>
    <Typography id={`${id}-heading`} component="h2" variant="h6" sx={{ fontWeight: 600 }}>
      {title}
    </Typography>
    {summary && (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, mb: 2, maxWidth: 760 }}>
        {summary}
      </Typography>
    )}
    {children}
  </Box>
);

const Panel = ({ title, note, children, sx }) => (
  <Paper variant="outlined" sx={{ p: 2, height: '100%', ...sx }}>
    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{title}</Typography>
    {note && <Typography variant="caption" color="text.secondary" component="div">{note}</Typography>}
    <Box sx={{ mt: 1.5 }}>{children}</Box>
  </Paper>
);

function Analytics() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [conditionKind, setConditionKind] = useState('diagnosis');
  const [selectedCode, setSelectedCode] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/analytics/population');
      setSnapshot(response.data);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'The population data could not be loaded');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const patients = snapshot?.patients;
  const conditions = snapshot?.conditions;
  const medications = snapshot?.medications;
  const total = patients?.total || 0;

  const listedConditions = useMemo(
    () => (conditions?.items || []).filter((item) => item.kind === conditionKind),
    [conditions, conditionKind],
  );
  const selected = listedConditions.find((item) => item.code === selectedCode) || listedConditions[0] || null;
  const topDiagnosis = (conditions?.items || []).find((item) => item.kind === 'diagnosis');
  const bandTotals = useMemo(
    () => Object.fromEntries((medications?.polypharmacy_by_band || []).map((row) => [row.band, row.of])),
    [medications],
  );

  if (loading) {
    return (
      <Box>
        <PageHeader title="Population Analytics" />
        <Grid container spacing={2}>
          {[0, 1, 2, 3].map((i) => (
            <Grid item xs={6} md={3} key={i}><Skeleton variant="rounded" height={96} /></Grid>
          ))}
          <Grid item xs={12} md={7}><Skeleton variant="rounded" height={320} /></Grid>
          <Grid item xs={12} md={5}><Skeleton variant="rounded" height={320} /></Grid>
        </Grid>
      </Box>
    );
  }

  if (error || !snapshot) {
    return (
      <Box>
        <PageHeader title="Population Analytics" />
        <ClinicalEmptyState
          title="Unable to load population analytics"
          message={error || 'No data was returned.'}
          severity="error"
          actions={[{ label: 'Retry', icon: <RefreshIcon />, onClick: load }]}
        />
      </Box>
    );
  }

  if (total === 0) {
    return (
      <Box>
        <PageHeader title="Population Analytics" />
        <ClinicalEmptyState
          title="No patients to analyse"
          message="Load patient data into the FHIR server, then refresh."
          actions={[{ label: 'Refresh', icon: <RefreshIcon />, onClick: load }]}
        />
      </Box>
    );
  }

  const excluded = patients.deceased_excluded;

  return (
    <Box>
      <PageHeader
        title="Population Analytics"
        subtitle={`${total} living patients${excluded ? ` · ${excluded} deceased not counted` : ''} · synthetic data`}
        actions={<Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={load}>Refresh</Button>}
      />

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6} md={3}>
          <StatTile label="Patients" value={total} caption={patients.by_gender.map((row) => `${row.patients} ${row.gender}`).join(' · ')} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatTile
            label="Median age"
            value={patients.median_age}
            unit="years"
            caption={patients.oldest !== null ? `Oldest ${patients.oldest}` : undefined}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatTile
            label="Most common diagnosis"
            value={topDiagnosis ? percent(topDiagnosis.share) : null}
            caption={topDiagnosis ? `${topDiagnosis.name} · ${topDiagnosis.patients} patients` : 'No active diagnoses'}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatTile
            label={`On ${medications.threshold} or more medications`}
            value={percent(medications.polypharmacy.share)}
            caption={`${medications.polypharmacy.patients} patients`}
            tone={medications.polypharmacy.patients > 0 ? 'attention' : 'neutral'}
          />
        </Grid>
      </Grid>

      <Section id="patients" title="Who they are" summary={describeAgeStructure(patients)}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={7}>
            <Panel title="Age and sex" note="Patients in each ten-year age band">
              <PopulationPyramid
                rows={patients.pyramid.map((row) => ({ band: row.band, left: row.female, right: row.male }))}
              />
            </Panel>
          </Grid>
          <Grid item xs={12} md={5}>
            <Stack spacing={2} sx={{ height: '100%' }}>
              <Panel title="Race" sx={{ height: 'auto', flexGrow: 1 }}>
                <BarList
                  items={patients.race.map((row) => ({ label: row.label, value: row.patients }))}
                  max={total}
                  formatValue={(value) => countAndShare(value, total)}
                  labelWidth="46%"
                />
              </Panel>
              <Panel title="Ethnicity" sx={{ height: 'auto' }}>
                <BarList
                  items={patients.ethnicity.map((row) => ({ label: row.label, value: row.patients }))}
                  max={total}
                  formatValue={(value) => countAndShare(value, total)}
                  labelWidth="46%"
                />
              </Panel>
            </Stack>
          </Grid>
        </Grid>
      </Section>

      <Section id="conditions" title="What they have" summary={describeConditions(conditions, total)}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <Panel
              title="Active conditions"
              note="Share of all patients. Select one to see who has it."
            >
              <ToggleButtonGroup
                exclusive
                size="small"
                value={conditionKind}
                onChange={(event, value) => { if (value) { setConditionKind(value); setSelectedCode(null); } }}
                aria-label="Kind of condition"
                sx={{ mb: 1.5 }}
              >
                <ToggleButton value="diagnosis">Diagnoses</ToggleButton>
                <ToggleButton value="context">Social and other findings</ToggleButton>
              </ToggleButtonGroup>
              <Box sx={{ maxHeight: 520, overflowY: 'auto', pr: 1 }}>
                <BarList
                  items={listedConditions.map((item) => ({
                    label: item.name,
                    value: item.patients,
                    code: item.code,
                    hint: `${item.name}: ${item.patients} of ${total} patients`,
                  }))}
                  max={total}
                  formatValue={(value) => countAndShare(value, total)}
                  labelWidth="50%"
                  selected={selected?.name}
                  onSelect={(row) => setSelectedCode(row.code)}
                  emptyText="None recorded."
                />
              </Box>
            </Panel>
          </Grid>

          <Grid item xs={12} md={7}>
            {selected ? (
              <Paper variant="outlined" sx={{ p: 2, height: '100%' }} aria-live="polite">
                <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  Patients with
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.3 }}>{selected.name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {describeCohort(selected)}
                </Typography>

                <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 2.5 }}>How common it is at each age</Typography>
                <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
                  Share of the patients in each age band who have it
                  {describeCohortBySex(selected) ? ` · ${describeCohortBySex(selected)}` : ''}
                </Typography>
                <ColumnBars
                  items={selected.by_band.map((row) => ({
                    label: row.band,
                    value: row.share_of_band,
                    caption: `${row.patients} of ${bandTotals[row.band] ?? 0}`,
                    hint: `Age ${row.band}: ${row.patients} of ${bandTotals[row.band] ?? 0} patients`,
                  }))}
                  max={100}
                  formatValue={percent}
                  height={110}
                />

                <Grid container spacing={3} sx={{ mt: 0.5 }}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Often seen with</Typography>
                    <BarList
                      items={selected.seen_with.map((row) => ({
                        label: row.label,
                        value: row.share,
                        hint: `${row.label}: ${row.patients} of these ${selected.patients} patients`,
                      }))}
                      max={100}
                      formatValue={percent}
                      labelWidth="56%"
                      emptyText="No other active diagnoses in this group."
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Most prescribed in this group</Typography>
                    <BarList
                      items={selected.medications.map((row) => ({
                        label: row.label,
                        value: row.share,
                        hint: `${row.label}: ${row.patients} of these ${selected.patients} patients`,
                      }))}
                      max={100}
                      formatValue={percent}
                      labelWidth="56%"
                      emptyText="No active medications in this group."
                    />
                  </Grid>
                </Grid>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  {selected.on_polypharmacy} of these {selected.patients} patients take {medications.threshold} or more medications.
                </Typography>
              </Paper>
            ) : (
              <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                <Typography variant="body2" color="text.secondary">No conditions of this kind are recorded.</Typography>
              </Paper>
            )}
          </Grid>
        </Grid>
      </Section>

      <Section id="medications" title="What they take" summary={describeMedicationBurden(medications)}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <Panel title="Active medications per patient" note={`Number of patients. ${medications.threshold} or more is polypharmacy.`}>
              <ColumnBars
                items={medications.burden.map((row) => ({
                  label: row.bucket,
                  value: row.patients,
                  caption: percent(row.share),
                  tone: parseInt(row.bucket, 10) >= medications.threshold ? 'attention' : undefined,
                  hint: `${row.patients} patients take ${row.bucket} medications`,
                }))}
                height={150}
              />
            </Panel>
          </Grid>
          <Grid item xs={12} md={7}>
            <Panel title={`On ${medications.threshold} or more medications, by age`} note="Share of the patients in each age band">
              <ColumnBars
                items={medications.polypharmacy_by_band.map((row) => ({
                  label: row.band,
                  value: row.share,
                  caption: `${row.patients} of ${row.of}`,
                  tone: 'attention',
                  hint: `Age ${row.band}: ${row.patients} of ${row.of} patients`,
                }))}
                max={100}
                formatValue={percent}
                height={150}
              />
            </Panel>
          </Grid>
          <Grid item xs={12}>
            <Panel title="Most prescribed" note={`Patients with an active order · ${medications.active_orders} active orders in all`}>
              <BarList
                items={medications.top.map((row) => ({ label: row.label, value: row.patients }))}
                max={total}
                formatValue={(value) => countAndShare(value, total)}
                labelWidth="42%"
                emptyText="No active medication orders."
              />
            </Panel>
          </Grid>
        </Grid>
      </Section>
    </Box>
  );
}

export default Analytics;
