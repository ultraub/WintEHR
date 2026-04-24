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
unified medical language system) and loads it into HAPI FHIR as CodeSystem +
ValueSet resources. Autocomplete in the visual builder then searches the full
vocabulary instead of just patient-derived codes — hundreds of thousands of
clinical concepts instead of hundreds.

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

…and launches the full pipeline (download → extract → load) in the background.
`deploy.sh` returns to you within a couple minutes; the background job keeps
going. Tail `./terminology_load.log` for progress:

```bash
tail -f terminology_load.log
```

**Path B — Manually, right now, without touching deploy:**

```bash
cd ~/WintEHR

# Download UMLS MRCONSO (~2 GB zipped, ~8 GB extracted)
python3 scripts/download_umls.py ~/umls_source

# Extract to FHIR-compatible JSON (~100 MB)
python3 scripts/extract_vocabularies.py ~/umls_source ~/fhir_vocabularies

# Load into HAPI (2-4 hours, run in tmux so SSH can drop)
tmux new-session -s tload
python3 scripts/load_terminology.py ~/fhir_vocabularies \
    --hapi-url http://localhost:8080/fhir \
    --timeout 600 \
    2>&1 | tee terminology_load.log
# Ctrl-B, d to detach; tmux attach -t tload to reattach
```

### 5. With SNOMED (for licensed client VPC deployments)

Pass `--include-snomed` to the extractor. Everything else identical:

```bash
python3 scripts/extract_vocabularies.py ~/umls_source ~/fhir_vocabularies \
    --include-snomed
python3 scripts/load_terminology.py ~/fhir_vocabularies \
    --hapi-url http://localhost:8080/fhir --timeout 600
```

### 6. Verify

Once the log shows it finished loading (or after 2-4 hours):

```bash
# Should show non-zero total
curl -sf "https://wintehr.eastus2.cloudapp.azure.com/fhir/ValueSet/wintehr-medications/\$expand?filter=aspirin&count=5" \
    | python3 -c "import json,sys; b=json.load(sys.stdin); print(len(b.get('expansion',{}).get('contains',[])), 'hits for aspirin')"
```

And in the UI: open the CDS visual builder, pick any condition/medication
dropdown, start typing — the autocomplete should show results from the full
terminology, not just the Synthea subset.

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
you can drop back to 3g/4g — `$expand` queries are cheap once indexed.

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

**`$expand` returns empty after load completes**
Wait 1–5 minutes — HAPI indexes terminology asynchronously. If still empty
after 5 minutes, check HAPI logs for indexing errors.

**Load interrupted, want to resume**
`load_terminology.py --skip-existing` skips CodeSystems already in HAPI. Safe
to re-run after partial failure.
