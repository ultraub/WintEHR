# Terminology Setup (Optional)

**Audience**: Operators deploying WintEHR to a client VPC or any environment
where the clinical catalog in the CDS visual builder should go beyond the
codes that happen to appear in the loaded Synthea patient data.

**Effort**: 1–3 hours active work (account creation, download, extraction) plus
2–6 hours unattended load time.

**Skip this if**: you're running the default educational demo — the catalog
works without terminology ingestion, it just only shows codes present in the
~100 Synthea patients.

---

## What this does

By default, the CDS visual builder's catalog (medications, conditions,
procedures, lab tests, etc.) is built from codes extracted from the
loaded patient data. That's ~88 conditions, ~50 procedures — whatever
Synthea happened to generate. Not a comprehensive ontology.

This setup loads full terminology ValueSets (RxNorm, LOINC, ICD-10-CM, CVX,
HCPCS, UCUM, ATC, optionally SNOMED) into HAPI FHIR. After loading, the
catalog backs autocomplete searches against the full vocabulary — tens to
hundreds of thousands of codes per domain.

---

## License matters before you start

| Vocabulary | Default | License | Public-web safe? |
|------------|---------|---------|------------------|
| RxNorm | ✓ on | Public domain (NLM) | Yes |
| ICD-10-CM | ✓ on | Public domain (NCHS) | Yes |
| LOINC | ✓ on | Permissive (Regenstrief) | Yes |
| CVX | ✓ on | Public domain (CDC) | Yes |
| HCPCS | ✓ on | Public domain (CMS) | Yes |
| UCUM | ✓ on | Permissive (Regenstrief) | Yes |
| ATC | ✓ on | WHO; tolerated for lookup | Usually |
| **SNOMED CT** | ✗ opt-in | **UMLS + SNOMED Affiliate** | **No** — license restricts public redistribution |
| CPT-4 | ✗ never | AMA commercial | No |
| ICD-10 (WHO) | ✗ never | WHO commercial | No |

**Bottom line**: if your deployment will be reachable from the open
internet by unauthenticated users, don't pass `--include-snomed`. For
client VPCs where the client organization holds a UMLS license (most
hospitals do for their EHR), SNOMED is fine.

**This is not legal advice**. Read the UMLS Metathesaurus License and
SNOMED International Affiliate terms before redistributing either.

---

## One-time setup

### 1. Register for UMLS

- Go to https://uts.nlm.nih.gov/uts/signup-login
- Create an account (free, NLM verifies; takes up to 1 business day)
- Agree to the UMLS Metathesaurus License Agreement

### 2. Register for Athena (OHDSI's vocabulary distribution)

- Go to https://athena.ohdsi.org/
- Create account (uses UMLS credentials)
- Navigate to **Download** → **Vocabularies**
- Select the vocabularies you want. Recommended for client VPC:
  - RxNorm
  - RxNorm Extension (merged into rxnorm.json in output)
  - SNOMED (if licensed)
  - ICD10CM
  - LOINC
  - CVX
  - HCPCS
  - UCUM
  - ATC
- Submit the request. Athena prepares a bundle — typically 5–15 minutes
- Download the zip (~1–3 GB; larger with SNOMED included)
- Unzip somewhere on your workstation:
  ```
  unzip vocabulary_download_v5_*.zip -d ~/athena_vocab/
  ls ~/athena_vocab/
  # Expected: CONCEPT.csv, VOCABULARY.csv, CONCEPT_RELATIONSHIP.csv, etc.
  ```

### 3. Extract the CSVs to FHIR JSON

```bash
# Public-safe default (no SNOMED)
python3 scripts/extract_vocabularies.py ~/athena_vocab/ ~/fhir_vocabularies/

# With SNOMED (verify license first)
python3 scripts/extract_vocabularies.py ~/athena_vocab/ ~/fhir_vocabularies/ \
    --include-snomed
```

Expected output on stdout:
```
Extracting:  atc, cvx, hcpcs, icd10cm, loinc, rxnorm, ucum
Skipping:    cpt4, icd10, snomed
  Read 500,000 rows in 2.1s (X kept across Y vocabs)
  ...
  wrote rxnorm.json: 281,234 concepts (45.2 MB)
  wrote icd10cm.json: 93,421 concepts (18.6 MB)
  ...

Summary:
  rxnorm        281,234 concepts
  icd10cm        93,421 concepts
  loinc          97,834 concepts
  cvx               324 concepts
  hcpcs          29,112 concepts
  ucum              298 concepts
  atc               891 concepts
  TOTAL         503,114 concepts
```

Runtime on a modern laptop: ~1 minute without SNOMED, ~3 minutes with
SNOMED added (~450k more concepts).

### 4. Load to HAPI FHIR

```bash
python3 scripts/load_terminology.py ~/fhir_vocabularies/ \
    --hapi-url https://your-deployment.example.com/fhir
```

This POSTs CodeSystem resources to HAPI, chunked at 10,000 concepts per
upload with a 2s gap between chunks (to let HAPI GC). Expected runtime:
**2–6 hours unattended** for the full set. Run in tmux/screen.

Monitor progress by tailing the script's output — it prints per-chunk
status. Failures surface as `FAILED` markers; usually indicates HAPI OOM
(bump its heap) or a timeout (pass `--timeout 600`).

### 5. Verify

```bash
curl "https://your-deployment.example.com/fhir/ValueSet?_summary=count"
# Expected: total ≥ 10 (one per wintehr-* ValueSet that load_terminology built)

curl "https://your-deployment.example.com/fhir/ValueSet/wintehr-medications/\$expand?filter=aspirin&count=5"
# Expected: expansion bundle with 5 RxNorm aspirin entries
```

The CDS visual builder's catalog autocomplete in the UI should now return
results from the full vocabulary, not just patient-derived codes.

---

## Server sizing when loading

The terminology data lands in HAPI's PostgreSQL terminology indices.
Budget for:

- **Disk**: +15–30 GB on the HAPI database volume (+60 GB with SNOMED)
- **HAPI heap**: 4–6 GB during bulk load (increase temporarily if needed)
- **Load duration**: 2–6 hours, longer with SNOMED

`docker-compose.yml` currently sets HAPI heap to `-Xmx3g`. For large
terminology loads, bump to `-Xmx6g` (and container memory limit to `8g`)
during the load, then optionally back down:

```yaml
x-hapi-fhir-common: &hapi-fhir-common
  environment:
    JAVA_TOOL_OPTIONS: "-Xmx6g -Xms1g"
  deploy:
    resources:
      limits:
        memory: 8g
```

After the load, `$expand` queries are cheap (indexed lookups). You can
drop back to `-Xmx3g`.

---

## Re-loading for a newer vocabulary release

Athena publishes quarterly. To refresh:

1. Download the newer bundle from Athena.
2. Re-run `extract_vocabularies.py` (writes over the old JSON files).
3. Re-run `load_terminology.py` — it uses FHIR PUT semantics, so existing
   CodeSystems are updated in place.

---

## Troubleshooting

**`Could not find CONCEPT.csv`**
Athena sometimes zips with a nested path. Unzip once, then `find ~/athena_vocab -name CONCEPT.csv` to locate the actual path and pass that directory.

**`No vocabularies selected`**
You passed `--only` with stems that are all outside the active set. For example `--only snomed` without `--include-snomed` yields nothing. Either drop `--only` or add the corresponding flag.

**Extraction OOMs**
The full vocabulary bundle is held in memory during extraction (~1–2 GB
for everything including SNOMED). If your machine has <8 GB RAM, extract
subsets with `--only rxnorm` then `--only icd10cm` etc., running once per
vocabulary.

**HAPI upload OOM / 500 errors**
HAPI's heap is too small for the load. Bump `JAVA_TOOL_OPTIONS` to
`-Xmx6g` temporarily, and increase the compose `deploy.resources.limits.memory`
to `8g`. Restart HAPI, then resume the load (re-runs are idempotent).

**Upload timeout**
Pass `--timeout 600` to `load_terminology.py` to give each chunk 10
minutes. Default 300s can be tight for very large chunks.

**Expand returns empty after load**
Wait 1–2 minutes after load completion — HAPI indexes terminology
asynchronously. If still empty after 5 minutes, check HAPI logs for
indexing errors (often heap-related).
