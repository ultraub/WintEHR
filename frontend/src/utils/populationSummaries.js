/**
 * One-sentence readings of the population snapshot
 * (`GET /api/analytics/population`). Each returns plain text built only
 * from figures in the snapshot, or null when there is nothing to say.
 */

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

const GENDER_NOUN = { female: ['woman', 'women'], male: ['man', 'men'] };

/** "Half are under 38. The largest group is men aged 50-59 (11 patients)." */
export const describeAgeStructure = (patients) => {
  if (!patients || !patients.total) return null;
  const parts = [];
  if (patients.median_age !== null && patients.median_age !== undefined) {
    parts.push(`Half of the patients are ${patients.median_age} or younger.`);
  }
  let largest = null;
  (patients.pyramid || []).forEach((row) => {
    ['female', 'male'].forEach((gender) => {
      if (!largest || row[gender] > largest.count) largest = { band: row.band, gender, count: row[gender] };
    });
  });
  if (largest && largest.count > 0) {
    parts.push(`The largest group is ${GENDER_NOUN[largest.gender][1]} aged ${largest.band} (${largest.count}).`);
  }
  return parts.join(' ') || null;
};

/** "83 of 112 patients have at least one active diagnosis; the typical patient has 2." */
export const describeConditions = (conditions, total) => {
  if (!conditions || !total) return null;
  const typical = conditions.median_diagnoses_per_patient;
  return `${conditions.patients_with_diagnosis} of ${plural(total, 'patient')} have at least one active diagnosis; `
    + `the typical patient has ${Number.isInteger(typical) ? typical : typical.toFixed(1)}.`;
};

/** Splits the age bands at 60 and compares the share on five or more medications. */
export const describeMedicationBurden = (medications) => {
  if (!medications) return null;
  const none = (medications.burden || []).find((row) => row.bucket === '0')?.patients ?? 0;
  const parts = [
    `${plural(none, 'patient')} ${none === 1 ? 'takes' : 'take'} no medication; `
    + `${medications.polypharmacy.patients} take ${medications.threshold} or more.`,
  ];
  const split = { older: { on: 0, of: 0 }, younger: { on: 0, of: 0 } };
  (medications.polypharmacy_by_band || []).forEach((row) => {
    const group = parseInt(row.band, 10) >= 60 ? split.older : split.younger;
    group.on += row.patients;
    group.of += row.of;
  });
  if (split.older.of > 0 && split.younger.of > 0) {
    const pct = (group) => Math.round((group.on / group.of) * 100);
    parts.push(`That is ${pct(split.older)}% of patients aged 60 and over, against ${pct(split.younger)}% of those under 60.`);
  }
  return parts.join(' ');
};

/** "41 patients · 37% of the population · median age 59" */
export const describeCohort = (condition) => {
  if (!condition) return null;
  const parts = [plural(condition.patients, 'patient'), `${Math.round(condition.share)}% of the population`];
  if (condition.median_age !== null && condition.median_age !== undefined) parts.push(`median age ${condition.median_age}`);
  return parts.join(' · ');
};

/** "30% of women and 42% of men" */
export const describeCohortBySex = (condition) => {
  const rows = (condition?.by_gender || []).filter((row) => GENDER_NOUN[row.gender]);
  if (rows.length < 2) return null;
  return rows.map((row) => `${Math.round(row.share)}% of ${GENDER_NOUN[row.gender][1]}`).join(' and ');
};
