# Contributing to WintEHR

We welcome contributions to the WintEHR project, especially ones that raise
its educational value. This guide outlines the process; the project's
architecture rules live in the `CLAUDE.md` files next to the code.

## How to Contribute

1.  **Understand the project**: read [`README.md`](README.md), then the root
    [`CLAUDE.md`](CLAUDE.md) for the five project-wide rules (HAPI is the FHIR
    store, backend is a proxy, async everywhere, no hard-coded hosts, no PHI).
    Each major directory has its own `CLAUDE.md` with that module's deltas.

2.  **Set up your environment**: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
    — `./deploy.sh` brings up the whole stack with synthetic patients.

3.  **Make the change where it belongs**: routers stay thin, logic goes in
    services, FHIR data goes through `HAPIFHIRClient`, URLs come from env
    vars. New clinical domains are modules — see
    [`docs/MODULES.md`](docs/MODULES.md) and `scripts/new-module.py`.

4.  **Test**: both suites gate CI at zero failures.
    ```bash
    cd backend  && pytest tests/ -v
    cd frontend && npm test && npm run lint
    ```
    See `backend/tests/README.md` and `frontend/src/__tests__/README.md`.

5.  **Update the docs in the same change**: if you touched documented
    behaviour, fix the doc that owns it — [`docs/CLAUDE.md`](docs/CLAUDE.md)
    says which. Security-relevant changes (auth, exposed ports, secrets,
    dependency CVEs) also get a row in `docs/SECURITY.md`'s change log.

6.  **Submit a pull request** against `master` with a description that says
    what changed and why, and references any issue. Dependabot handles
    routine dependency bumps; please don't open manual ones unless a CVE
    needs it.

## Quick Links

*   **Project-wide rules**: [`CLAUDE.md`](CLAUDE.md)
*   **Backend architecture**: [`backend/CLAUDE.md`](backend/CLAUDE.md)
*   **Frontend architecture**: [`frontend/CLAUDE.md`](frontend/CLAUDE.md)
*   **Deployment guide**: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
*   **Configuration reference**: [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md)
*   **Security posture**: [`docs/SECURITY.md`](docs/SECURITY.md)

---

Thank you for contributing to WintEHR!
