/**
 * BloodOrderTab.
 *
 * Blood-bank orders: transfuse, crossmatch (prepare) and type and screen.
 * Produces a ServiceRequest with status='draft' (pended). Every structured
 * choice is also written to the `order-details` extension as JSON whose keys
 * are the study's order-details vocabulary:
 * units, component, attributes, rate, indication, timing.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, FormControl, FormControlLabel, FormGroup, Grid, InputLabel,
  MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useDraftOrderBundle } from '../DraftOrderBundleProvider';

const EXT_BASE = 'http://wintehr.local/fhir/StructureDefinition';
const BB_SYSTEM = 'http://wintehr.local/fhir/CodeSystem/blood-bank';
const HCPCS = 'https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets';

const ORDER_TYPES = [
  { value: 'transfuse', label: 'Transfuse' },
  { value: 'crossmatch', label: 'Crossmatch (prepare)' },
  { value: 'ts', label: 'Type and screen' },
];

// label = how the product reads in the order name; vocab = the `component` value of the study vocabulary
const COMPONENTS = [
  { value: 'rbc', label: 'red blood cells', vocab: 'red cells', hcpcs: { plain: 'P9021', lr: 'P9016', irr: 'P9038', lrirr: 'P9040' } },
  { value: 'plt', label: 'platelets', vocab: 'platelets', hcpcs: { plain: 'P9019' } },
  { value: 'ffp', label: 'plasma', vocab: 'plasma', hcpcs: { plain: 'P9017' } },
  { value: 'cryo', label: 'cryoprecipitate', vocab: 'cryoprecipitate', hcpcs: { plain: 'P9012' } },
];

const PRIORITIES = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'asap', label: 'ASAP' },
  { value: 'stat', label: 'STAT' },
];

const BloodOrderTab = () => {
  const { patientId, addDraft } = useDraftOrderBundle();
  const [orderType, setOrderType] = useState('transfuse');
  const [component, setComponent] = useState('rbc');
  const [units, setUnits] = useState('1');
  const [leukoreduced, setLeukoreduced] = useState(false);
  const [irradiated, setIrradiated] = useState(false);
  const [cmvSafe, setCmvSafe] = useState(false);
  const [washed, setWashed] = useState(false);
  const [antigens, setAntigens] = useState('');
  const [hours, setHours] = useState('');
  const [timing, setTiming] = useState('');
  const [indication, setIndication] = useState('');
  const [priority, setPriority] = useState('routine');
  const [error, setError] = useState(null);

  const isTS = orderType === 'ts';
  const unitsN = parseInt(units, 10);
  const canAdd = useMemo(
    () => indication.trim().length >= 5 && (isTS || (Number.isInteger(unitsN) && unitsN >= 1 && unitsN <= 20)),
    [indication, isTS, unitsN],
  );

  const handleAdd = useCallback(() => {
    if (!canAdd) {
      setError('Give a clinical indication (5+ chars)' + (isTS ? '.' : ' and a unit count from 1 to 20.'));
      return;
    }
    setError(null);
    const comp = COMPONENTS.find((c) => c.value === component);
    const attrs = [];
    if (!isTS) {
      if (leukoreduced) attrs.push('leukoreduced');
      if (irradiated) attrs.push('irradiated');
      if (cmvSafe) attrs.push('CMV-safe');
      if (washed) attrs.push('washed');
      antigens.split(/[,;]+/).map((a) => a.trim()).filter(Boolean)
        .forEach((a) => attrs.push(`${a}-antigen negative`));
    }
    const rate = !isTS && orderType === 'transfuse' && hours.trim() ? `over ${hours.trim()} h` : '';
    const details = {};
    if (!isTS) {
      details.units = unitsN;
      details.component = comp.vocab;
      if (attrs.length) details.attributes = attrs;
      if (rate) details.rate = rate;
    }
    if (isTS && timing.trim()) details.timing = timing.trim();
    details.indication = indication.trim();

    let name; let category; let code;
    if (isTS) {
      name = 'Type and screen';
      category = { system: 'http://snomed.info/sct', code: '108252007', display: 'Laboratory procedure' };
      code = { system: BB_SYSTEM, code: 'type-and-screen', display: name };
    } else if (orderType === 'crossmatch') {
      name = `Crossmatch ${comp.label}, ${unitsN} unit(s)`;
      category = { system: 'http://snomed.info/sct', code: '387713003', display: 'Surgical procedure' };
      code = { system: BB_SYSTEM, code: `crossmatch-${comp.value}`, display: name };
    } else {
      name = `Transfuse ${comp.label}, ${unitsN} unit(s)`;
      category = { system: 'http://snomed.info/sct', code: '387713003', display: 'Surgical procedure' };
      const key = comp.value === 'rbc' ? (leukoreduced && irradiated ? 'lrirr' : irradiated ? 'irr' : leukoreduced ? 'lr' : 'plain') : 'plain';
      code = { system: HCPCS, code: comp.hcpcs[key], display: name };
    }
    const sentence = [
      isTS ? null : `${unitsN} unit(s) of ${comp.vocab}`,
      attrs.length ? attrs.join(', ') : null,
      rate || null,
      isTS && timing.trim() ? timing.trim() : null,
      `indication: ${indication.trim()}`,
    ].filter(Boolean).join('; ');

    addDraft({
      resourceType: 'ServiceRequest',
      status: 'draft',
      intent: 'order',
      priority,
      subject: { reference: `Patient/${patientId}` },
      authoredOn: new Date().toISOString(),
      category: [{ coding: [category] }],
      code: { coding: [code], text: name },
      reasonCode: [{ text: indication.trim() }],
      ...(isTS ? {} : { quantityQuantity: { value: unitsN, unit: 'unit' } }),
      note: [{ text: sentence }],
      extension: [{ url: `${EXT_BASE}/order-details`, valueString: JSON.stringify(details) }],
    });

    setUnits('1'); setLeukoreduced(false); setIrradiated(false); setCmvSafe(false); setWashed(false);
    setAntigens(''); setHours(''); setTiming(''); setIndication('');
  }, [canAdd, isTS, component, orderType, unitsN, leukoreduced, irradiated, cmvSafe, washed, antigens, hours, timing,
    indication, priority, patientId, addDraft]);

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <Typography variant="overline" color="text.secondary">Blood bank order</Typography>

      <Grid container spacing={1.5}>
        <Grid item xs={isTS ? 12 : 6}>
          <FormControl fullWidth size="small">
            <InputLabel id="blood-order-type-label">Order type</InputLabel>
            <Select labelId="blood-order-type-label" label="Order type" value={orderType}
              onChange={(e) => setOrderType(e.target.value)} inputProps={{ 'aria-label': 'Order type' }}>
              {ORDER_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        {!isTS && (
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel id="blood-component-label">Component</InputLabel>
              <Select labelId="blood-component-label" label="Component" value={component}
                onChange={(e) => setComponent(e.target.value)} inputProps={{ 'aria-label': 'Component' }}>
                {COMPONENTS.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
        )}
      </Grid>

      {!isTS && (
        <>
          <Grid container spacing={1.5}>
            <Grid item xs={6}>
              <TextField label="Units" type="number" size="small" fullWidth value={units} onChange={(e) => setUnits(e.target.value)}
                inputProps={{ min: 1, max: 20 }} />
            </Grid>
            {orderType === 'transfuse' && (
              <Grid item xs={6}>
                <TextField label="Infuse over (hours)" type="number" size="small" fullWidth value={hours}
                  onChange={(e) => setHours(e.target.value)} inputProps={{ min: 0.5, step: 0.5 }} />
              </Grid>
            )}
          </Grid>
          <Box>
            <Typography variant="caption" color="text.secondary">Product attributes</Typography>
            <FormGroup row>
              <FormControlLabel control={<Checkbox checked={leukoreduced} onChange={(e) => setLeukoreduced(e.target.checked)} />} label="Leukoreduced" />
              <FormControlLabel control={<Checkbox checked={irradiated} onChange={(e) => setIrradiated(e.target.checked)} />} label="Irradiated" />
              <FormControlLabel control={<Checkbox checked={cmvSafe} onChange={(e) => setCmvSafe(e.target.checked)} />} label="CMV-safe" />
              <FormControlLabel control={<Checkbox checked={washed} onChange={(e) => setWashed(e.target.checked)} />} label="Washed" />
            </FormGroup>
          </Box>
          <TextField label="Antigen-negative (antigens, comma separated)" size="small" value={antigens}
            onChange={(e) => setAntigens(e.target.value)} placeholder="e.g., K, E" />
        </>
      )}
      {isTS && (
        <TextField label="Specimen timing" size="small" value={timing} onChange={(e) => setTiming(e.target.value)}
          placeholder="e.g., draw now, valid 72 h" />
      )}

      <Typography variant="overline" color="text.secondary">Clinical context</Typography>
      <TextField label="Clinical indication" value={indication} onChange={(e) => setIndication(e.target.value)}
        placeholder="Why is this blood order needed?" multiline minRows={2} helperText="At least 5 characters." />
      <FormControl size="small" sx={{ maxWidth: 200 }}>
        <InputLabel id="blood-priority-label">Priority</InputLabel>
        <Select labelId="blood-priority-label" label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}
          inputProps={{ 'aria-label': 'Priority' }}>
          {PRIORITIES.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
        </Select>
      </FormControl>
      <Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd} disabled={!canAdd} aria-label="Add to draft list">
          Add to draft list
        </Button>
      </Box>
    </Stack>
  );
};

export default BloodOrderTab;
