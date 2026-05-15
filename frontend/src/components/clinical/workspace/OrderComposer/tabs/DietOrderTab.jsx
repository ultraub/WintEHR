/**
 * DietOrderTab — composes diet orders as FHIR `NutritionOrder` resources
 * (#116, Phase 4.3).
 *
 * Diet orders are the one place in the composer where the "right" FHIR
 * resource isn't ServiceRequest: HL7 modelled diets with a dedicated
 * `NutritionOrder` because the schema needs to carry oral diet type,
 * texture modifications, fluid consistency, AND enteral/parenteral
 * formulae. Composing a diet order via ServiceRequest would lose all
 * of that downstream — kitchens and dietitians look at NutritionOrder.
 *
 * Scope for the educational MVP: oral diets only (the 90% case).
 * Enteral/parenteral feeding orders are deferred — they live in ICU
 * workflows and need additional caloric/protein-target fields.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

import { useDraftOrderBundle } from '../DraftOrderBundleProvider';
import DiagnosisPicker, { toReasonReference } from '../DiagnosisPicker';

// SNOMED-coded oral diet types. HL7 publishes a sample ValueSet for
// "diet-type" (http://hl7.org/fhir/diet-type) but it's terse;
// real-world hospital systems use SNOMED. Mapping kept short and
// classroom-relevant.
const DIET_TYPES = [
  { value: 'regular', label: 'Regular diet', code: '435801000124108' },
  { value: 'npo', label: 'NPO (nothing by mouth)', code: '34807005' },
  { value: 'clear_liquid', label: 'Clear liquids', code: '226211001' },
  { value: 'full_liquid', label: 'Full liquids', code: '435801000124108' },
  { value: 'mechanical_soft', label: 'Mechanical soft diet', code: '435801000124108' },
  { value: 'pureed', label: 'Pureed diet', code: '435801000124108' },
  { value: 'cardiac', label: 'Cardiac diet (low sodium / low fat)', code: '386280005' },
  { value: 'diabetic', label: 'Diabetic / carbohydrate-controlled', code: '386270004' },
  { value: 'low_sodium', label: 'Low sodium (2g Na)', code: '386280005' },
  { value: 'renal', label: 'Renal diet (low K, low PO4)', code: '386298006' },
  { value: 'low_residue', label: 'Low residue / low fiber', code: '443961001' },
  { value: 'gluten_free', label: 'Gluten-free', code: '160689003' },
  { value: 'lactose_free', label: 'Lactose-free', code: '160690007' },
];

const TEXTURES = [
  { value: '', label: 'No modification' },
  { value: 'pureed', label: 'Pureed' },
  { value: 'ground', label: 'Ground' },
  { value: 'chopped', label: 'Chopped' },
  { value: 'minced', label: 'Minced & moist' },
];

const FLUID_CONSISTENCIES = [
  { value: '', label: 'Thin (default)' },
  { value: 'nectar', label: 'Nectar-thick' },
  { value: 'honey', label: 'Honey-thick' },
  { value: 'pudding', label: 'Pudding-thick (spoon-thick)' },
];

const PRIORITIES = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'asap', label: 'ASAP' },
  { value: 'stat', label: 'STAT' },
];

const DietOrderTab = () => {
  const { patientId, addDraft } = useDraftOrderBundle();

  const [dietType, setDietType] = useState('regular');
  const [texture, setTexture] = useState('');
  const [fluidConsistency, setFluidConsistency] = useState('');
  const [excludes, setExcludes] = useState('');
  const [instructions, setInstructions] = useState('');
  const [priority, setPriority] = useState('routine');
  const [diagnoses, setDiagnoses] = useState([]);
  const [error, setError] = useState(null);

  const dietRow = DIET_TYPES.find((d) => d.value === dietType);
  const canAdd = useMemo(() => Boolean(dietRow), [dietRow]);

  const handleAdd = useCallback(() => {
    if (!canAdd) {
      setError('Pick a diet type.');
      return;
    }
    setError(null);

    const oralDiet = {
      type: [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: dietRow.code,
          display: dietRow.label,
        }],
        text: dietRow.label,
      }],
    };

    // Texture and fluid consistency are R4 NutritionOrder sub-fields.
    // Include them only when set — empty arrays trip FHIR validators on
    // some receivers.
    if (texture) {
      oralDiet.texture = [{
        modifier: {
          coding: [{ system: 'http://snomed.info/sct', code: 'texture-modified', display: texture }],
          text: TEXTURES.find((t) => t.value === texture)?.label || texture,
        },
      }];
    }
    if (fluidConsistency) {
      oralDiet.fluidConsistencyType = [{
        coding: [{ system: 'http://snomed.info/sct', code: 'thickened-liquid', display: fluidConsistency }],
        text: FLUID_CONSISTENCIES.find((f) => f.value === fluidConsistency)?.label || fluidConsistency,
      }];
    }
    if (instructions.trim()) {
      oralDiet.instruction = instructions.trim();
    }

    // NutritionOrder R4 doesn't model priority or reasonReference as
    // first-class slots, so both ride on extensions. Build the array
    // once to avoid the overwrite-trap that arises from spreading
    // multiple conditional `extension` keys.
    const extensions = [];
    if (priority && priority !== 'routine') {
      extensions.push({
        url: 'http://wintehr.local/fhir/StructureDefinition/order-priority',
        valueCode: priority,
      });
    }
    const reasonRefs = toReasonReference(diagnoses);
    if (reasonRefs) {
      extensions.push({
        url: 'http://wintehr.local/fhir/StructureDefinition/order-reason-reference',
        extension: reasonRefs.map((r) => ({ url: 'reason', valueReference: r })),
      });
    }

    const draft = {
      resourceType: 'NutritionOrder',
      status: 'draft',
      intent: 'order',
      // NutritionOrder uses `patient` not `subject` — one of the R4
      // resources that didn't get harmonized with the SubjectReference
      // pattern.
      patient: { reference: `Patient/${patientId}` },
      dateTime: new Date().toISOString(),
      oralDiet,
      ...(extensions.length ? { extension: extensions } : {}),
      ...(excludes.trim() ? { excludeFoodModifier: [{ text: excludes.trim() }] } : {}),
    };

    addDraft(draft);

    setExcludes('');
    setInstructions('');
    // Keep dietType/texture/consistency — composer commonly stacks
    // diet orders for the same patient (e.g. NPO after midnight + diet
    // on POD1) in the same session.
  }, [canAdd, patientId, dietRow, texture, fluidConsistency, excludes, instructions, priority, diagnoses, addDraft]);

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      {error && <Alert severity="error">{error}</Alert>}

      <FormControl size="small" fullWidth>
        <InputLabel>Diet type</InputLabel>
        <Select value={dietType} onChange={(e) => setDietType(e.target.value)} label="Diet type">
          {DIET_TYPES.map((d) => (
            <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <Grid container spacing={2}>
        <Grid item xs={6}>
          <FormControl size="small" fullWidth>
            <InputLabel>Texture</InputLabel>
            <Select value={texture} onChange={(e) => setTexture(e.target.value)} label="Texture">
              {TEXTURES.map((t) => (
                <MenuItem key={t.value || 'none'} value={t.value}>{t.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6}>
          <FormControl size="small" fullWidth>
            <InputLabel>Fluid consistency</InputLabel>
            <Select value={fluidConsistency} onChange={(e) => setFluidConsistency(e.target.value)} label="Fluid consistency">
              {FLUID_CONSISTENCIES.map((f) => (
                <MenuItem key={f.value || 'none'} value={f.value}>{f.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <TextField
        label="Foods to exclude"
        value={excludes}
        onChange={(e) => setExcludes(e.target.value)}
        placeholder="e.g., shellfish, peanuts, dairy"
        size="small"
      />

      <TextField
        label="Special instructions"
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        placeholder="e.g., Small frequent meals, no fluids with meals"
        multiline
        rows={2}
        size="small"
      />

      <Typography variant="overline" color="text.secondary">Clinical context</Typography>

      <DiagnosisPicker value={diagnoses} onChange={setDiagnoses} />

      <FormControl size="small" sx={{ maxWidth: 200 }}>
        <InputLabel>Priority</InputLabel>
        <Select value={priority} onChange={(e) => setPriority(e.target.value)} label="Priority">
          {PRIORITIES.map((p) => (
            <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          disabled={!canAdd}
        >
          Add to draft list
        </Button>
      </Box>
    </Stack>
  );
};

export default DietOrderTab;
