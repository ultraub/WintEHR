# Notebooks

Operational notebooks for loading external datasets into a WintEHR deployment.
They are runnable documentation: config up top, numbered sections, validation
before ingest, verification after, and a guarded cleanup at the end.

| Notebook | Purpose |
|---|---|
| `01_import_mimic_on_fhir.ipynb` | Import the [MIMIC-IV-on-FHIR demo (v2.1.0)](https://physionet.org/content/mimic-iv-fhir-demo/2.1.0/) (100 patients, FHIR R4 NDJSON) into a WintEHR HAPI server as idempotent transaction Bundles. Handles dependency ordering, patient subsetting, provenance tagging, and the microbiology `hasMember`/`derivedFrom` reference cycle. |

Download datasets from PhysioNet yourself (credentialed access where required)
and point `DATA_DIR` at the extracted folder. Committed notebooks keep the
outputs of a verified run against a live WintEHR so readers can see expected
behavior.
