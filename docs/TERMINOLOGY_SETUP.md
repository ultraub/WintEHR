# Terminology Setup

**Audience**: Operators deploying WintEHR to any environment where the clinical
catalog (medications, conditions, lab tests, procedures, vaccines, units) should
include codes beyond what happens to appear in the loaded Synthea patient data.

**Effort**: ~30 minutes of setup + 1–4 hours of unattended download/load time.

**Skip this if**: you're running the default educational demo and are fine with the
catalog showing only codes present in the ~100 Synthea patients (~88 conditions,
~50 medications, etc.).

---

## What this does

By default, the CDS visual builder's catalog is derived from codes the Synthea
synthetic patients happen to carry. That's useful for a demo but nothing like
a real terminology system.

This setup pulls full clinical terminology from **UMLS** (the NLM-curated
unified medical language system) and puts it in two places:

1. **HAPI FHIR** — CodeSystem + ValueSet resources (`scripts/load_terminology.py`).
2. **A local SQLite search index** at `./data/terminology.db`
   (`backend/scripts/active/build_terminology_index.py`), built from the same
   extracted JSON.

Catalog autocomplete (`/api/catalogs/*`, used by the clinical workspace dialogs
and the CDS visual builder) searches the **local index**, not HAPI. HAPI's
`$expand` fails on CodeSystems this large (HAPI-0831 "produced too many codes"),
so loading HAPI alone does not change what the UI shows — without the index the
catalogs stay limited to patient-derived codes. Both steps are required.

Imaging studies are not part of this: that catalog comes from the patients'
ImagingStudy data plus a small built-in list.

---

## License overview

WintEHR's setup downloads the permissively-licensed UMLS source vocabularies
by default. SNOMED CT is **opt-in** because its Affiliate License restricts
public redistribution.

| Vocabulary | Default | License | Public-web safe? |
|------------|---------|---------|------------------|
| RxNorm | ✓ on | Public domain (NLM) | Yes |
| ICD-10-CM | ✓ on | Public domain (NCHS) | Yes |
| LOINC | ✓ on | Permissive (Regenstrief) | Yes |
| CVX | ✓ on | Public domain (CDC) | Yes |
| HCPCS | ✓ on | Public domain (CMS) | Yes |
| ATC | ✓ on | WHO; tolerated for code lookup | Usually |
| UCUM | ✓ bundled static | Permissive (Regenstrief) | Yes |
| **SNOMED CT** | ✗ opt-in | **UMLS + SNOMED Affiliate License** | **No** — public redistribution forbidden |

**Bottom line**: if your deployment will be reachable from the open internet
by unauthenticated users, do NOT pass `--include-snomed`. For client VPC
deployments where the client organization holds a UMLS license (most hospitals
do for their EHR), SNOMED is appropriate.

*This is not legal advice.* Read the UMLS Metathesaurus License Agreement
(https://www.nlm.nih.gov/databases/umls.html) and the SNOMED Affiliate terms
before redistributing either in any form.

---

## One-time setup (per deployment)

### 1. Register for UMLS

- Go to https://uts.nlm.nih.gov/uts/signup-login
- Create an account (free; NLM verifies in up to 1 business day)
- Agree to the UMLS Metathesaurus License Agreement

### 2. Generate an API key

After sign-up:
- Sign in at https://uts.nlm.nih.gov/uts/
- Click your profile → **Edit Profile** → **Generate API Key**
- Copy the key. Treat it as a secret — it authorizes downloads under your
  UMLS license.

### 3. Put the API key in the server's `.env`

SSH to the server and add (or edit) the `UMLS_API_KEY` line in the
`WintEHR/.env` file:

```bash
ssh azureuser@wintehr.eastus2.cloudapp.azure.com
cd WintEHR
# Edit .env and add the line (don't commit it)
grep -v '^UMLS_API_KEY=' .env > .env.tmp && \
    echo "UMLS_API_KEY=<your-key-here>" >> .env.tmp && \
    mv .env.tmp .env
chmod 600 .env
```

`.env` is gitignored, so it never leaves the server.

### 4. Trigger the load — two paths

**Path A — On next `./deploy.sh` run (automatic):**

Add the API key to `.env`, then run a fresh deploy. After HAPI is healthy,
`deploy.sh` detects:
- HAPI has no CodeSystems loaded (empty state), AND
- `UMLS_API_KEY` is set

…and launches the full pipeline (download → extract → build search index →
load) in the background. `deploy.sh` returns to you within a couple minutes;
the background job keeps going. Tail `./terminology_load.log` for progress:

```bash
tail -f terminology_load.log
```

The background job restarts `emr-backend` (and `emr-nginx`, if present) once,
right after the extract, so the backend picks up the new search index. Expect
a few seconds of API downtime at that point. Catalog search is complete from
then on; the HAPI load carries on behind it.

If pre-extracted JSON already exists at `~/fhir_vocabularies/terminology/*.json`,
`deploy.sh` skips the download: it builds the index and restarts the backend
in the foreground, then starts the HAPI load in the background (no API key
needed); that log is at `./data/terminology_load.log`.

Path A needs no step 5 — the index is built for you.

**Path B — Manually, right now, without touching deploy:**

HAPI's port is not published on the host in the prod profile, so the load runs
inside the backend container, where `hapi-fhir:8080` resolves. (The loader's
default `--hapi-url` is the project's Azure deployment — always pass it.)

```bash
cd ~/WintEHR

# Download UMLS MRCONSO (~2 GB zipped, ~8 GB extracted)
python3 scripts/download_umls.py ~/umls_source

# Extract to FHIR-compatible JSON (~100 MB)
python3 scripts/extract_vocabularies.py ~/umls_source ~/fhir_vocabularies

# Copy the loader + JSON into the backend container
docker cp scripts/load_terminology.py emr-backend:/tmp/load_terminology.py
docker cp scripts/ucum.json emr-backend:/tmp/ucum.json
docker exec emr-backend mkdir -p /tmp/fhir_vocabularies
docker cp ~/fhir_vocabularies/terminology emr-backend:/tmp/fhir_vocabularies/

# Load into HAPI (run in tmux so SSH can drop)
tmux new-session -s tload
docker exec emr-backend python3 /tmp/load_terminology.py /tmp/fhir_vocabularies \
    --hapi-url http://hapi-fhir:8080/fhir \
    --timeout 600 \
    2>&1 | tee terminology_load.log
# Ctrl-B, d to detach; tmux attach -t tload to reattach
```

Then continue with step 5 — the HAPI load alone does not change the UI.

**About `[Phase 3]` (ConceptMaps):** the extractor does not produce a
`mappings/` directory, so Phase 3 prints `No mappings/ directory — nothing to
load (expected)` (or `Skipping ConceptMaps` if you passed `--skip-conceptmaps`;
older checkouts print `ERROR: mappings/ directory not found`). All are
harmless — nothing in WintEHR reads ConceptMaps.

**With SNOMED (for licensed client VPC deployments):** pass `--include-snomed`
to the extractor. Everything else is identical:

```bash
python3 scripts/extract_vocabularies.py ~/umls_source ~/fhir_vocabularies \
    --include-snomed
```

### 5. Build the catalog search index

Required after a Path B load (Path A does this for you). It does not depend on
the HAPI load, so it can run before, during, or after it — but restart the
backend **before** starting a load inside `emr-backend`, not while one is
running there, or the restart kills the load. It is safe to re-run (it drops
and rebuilds the index).

```bash
cd ~/WintEHR
docker exec emr-backend mkdir -p /app/data /tmp/fhir_vocabularies
docker cp ~/fhir_vocabularies/terminology emr-backend:/tmp/fhir_vocabularies/
docker cp scripts/ucum.json emr-backend:/tmp/ucum.json
docker exec emr-backend python3 /app/scripts/active/build_terminology_index.py \
    --json-dir /tmp/fhir_vocabularies/terminology \
    --ucum-json /tmp/ucum.json \
    --output /app/data/terminology.db

# The backend chooses its terminology source once, at startup
docker restart emr-backend
# Prod profile only: nginx holds the old backend IP until restarted
docker restart emr-nginx
```

### 6. Verify

```bash
# 1. Index file exists
docker exec emr-backend ls -lh /app/data/terminology.db

# 2. Backend is using it. Want: "Using LocalTerminologyIndex".
#    "Terminology index missing ... falling back to HAPI $expand" means
#    step 5 was skipped or the backend was not restarted. The line is logged
#    on the first catalog request after a restart.
docker exec emr-backend curl -s 'http://localhost:8000/api/catalogs/lab-tests?search=glucose&limit=5'
docker logs emr-backend 2>&1 | grep -i "terminology"

# 3. Searches return more than the patient-derived handful
docker exec emr-backend curl -s 'http://localhost:8000/api/catalogs/procedures?search=biopsy&limit=5'
docker exec emr-backend curl -s 'http://localhost:8000/api/catalogs/conditions?search=diabetes&limit=5'
```

Do **not** verify with `ValueSet/wintehr-*/$expand` against HAPI — it errors or
returns nothing on the large vocabularies even after a fully successful load.

In the UI: open an Add Condition / order dialog or the CDS visual builder and
**start typing**. The catalogs only search the full terminology once there is a
search term; an empty search box shows just the codes present in the loaded
Synthea patients.

---

## Expected vocabulary sizes (UMLS 2024AA release, default flags)

| Vocabulary | Concept count |
|------------|---------------|
| RxNorm (medications) | ~280k |
| ICD-10-CM (conditions) | ~90k |
| LOINC (lab tests) | ~100k |
| CVX (vaccines) | ~325 |
| HCPCS (procedures) | ~30k |
| ATC (drug classes) | ~1k |
| UCUM (units, bundled static) | ~60 |
| **Total** | **~500k concepts** |

With `--include-snomed`: +450k SNOMED CT concepts.

---

## Server resources during load

The terminology data lands in HAPI's PostgreSQL terminology indices. Budget for:

- **Disk**: +15–30 GB on the HAPI database volume (+40–60 GB with SNOMED)
- **HAPI heap**: 4–6 GB during bulk load (we run 3 GB by default; consider bumping
  temporarily if you hit OOM during load)
- **Load duration**: 1–4 hours, longer with SNOMED

The `docker-compose.yml` anchor `x-hapi-fhir-common` sets heap to `-Xmx3g` and
container memory limit to `4g`. For very large loads (SNOMED included), bump
to 6g/8g:

```yaml
JAVA_TOOL_OPTIONS: "-Xmx6g -Xms1g"
deploy:
  resources:
    limits:
      memory: 8g
```

Restart HAPI to pick up the change, then re-run the load. After load completes,
you can drop back to 3g/4g — catalog search runs against the local index, not
HAPI.

---

## Alternative: OMOP Athena input

If you have an OMOP CDM vocabulary dump from [Athena](https://athena.ohdsi.org/)
(e.g., a hospital using OHDSI tooling already), `extract_vocabularies.py`
auto-detects OMOP CSV format and processes the same way. Benefits:
OMOP-curated semantic properties (`domain_id`, `concept_class_id`,
`standardConcept`) give finer-grained ValueSet filtering. See the Athena path
in the script's docstring.

---

## Troubleshooting

**`UMLS rejected the API key (HTTP 401)`**
Regenerate at https://uts.nlm.nih.gov/uts/edit-profile. Old keys expire if the
UMLS license lapses (annual re-acceptance required).

**Download hangs at 0%**
Azure NSG or corporate firewall is blocking `uts-ws.nlm.nih.gov` /
`download.nlm.nih.gov`. Allow outbound HTTPS to both.

**`Release not found at https://...2024AA...`**
The default release tag is stale. Check https://www.nlm.nih.gov/research/umls/
licensedcontent/downloads.html for current release (e.g., 2024AB), pass
`--release 2024AB` explicitly.

**HAPI OOM during load (500 errors in log)**
Bump `JAVA_TOOL_OPTIONS` heap (see above), restart HAPI, re-run load —
`load_terminology.py` uses PUT semantics and is idempotent.

**Load finished OK but the UI catalogs are still sparse / labs and procedures missing**
The search index was not built, or the backend was not restarted after building
it. Run step 5, then the step 6 checks. If the index is in use and results are
still missing, make sure you are typing a search term (see step 6).

**`$expand` returns empty or HAPI-0831 after load completes**
Expected on the large vocabularies — HSearch is disabled, so HAPI cannot expand
them. The UI does not depend on it; see step 5.

**`[Phase 3]` says `No mappings/ directory`, `ERROR: mappings/ directory not found`, or `Skipping ConceptMaps`**
Harmless. The extractor produces no ConceptMaps and WintEHR does not use them.

**Load interrupted, want to resume**
Re-run the same command — the loader uses PUT, so reloading a vocabulary
overwrites it cleanly. To avoid repeating the ones that finished, pass only the
remaining ones, e.g. `--only snomed rxnorm` (names are the JSON file stems).
