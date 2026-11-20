---
name: verifying-live-endpoints
description: Verifies a WintEHR change against a running stack (backend, HAPI FHIR, UI) instead of trusting the mocked test suite. Use after changing a backend endpoint or service, a HAPI search or sort parameter, routing, proxy or compose config, or a UI flow that reads or writes FHIR data, and before reporting such a change as done, working or verified. Also use when asked to smoke test, curl the API, check a deployment, or find out why something passes tests but fails for real.
---

# Verifying live endpoints

The backend test suite fakes HAPI FHIR. A fake accepts any query, so a search
that real HAPI rejects passes every test and returns 500 to every real caller.
The repo's bug log (`docs/ARCHITECTURE_DEBT.md`, rows B12, B13, B15, B17) holds
four failures of this kind; each had a green suite and each was found only by
calling the running system. A green suite therefore tells you the logic is
right and tells you nothing about whether the endpoint works.

Two different claims follow from this, and the report must keep them apart:

- **Unit-verified**: tests pass.
- **Live-verified**: you called it on a running stack and saw the right answer.

## 1. Find a running stack

```bash
./deploy.sh status          # local Docker stack
curl -s "${WINTEHR_API_URL:-http://localhost:8000}/api/health"
```

If nothing is running, either start one (`./deploy.sh --skip-build`, which
needs Docker) or ask the user which deployment to point at and set
`WINTEHR_API_URL`. Deploying to, or writing test data into, a shared or remote
server is the user's call, so ask before doing either.

If no stack is available, stop here and report the change as unit-verified
only, naming what you could not check. That is a complete and honest outcome;
describing an unchecked change as verified is not.

## 2. Check registration, then sweep the read endpoints

`GET /api/health` lists routers that failed to import under `routers.failed`.
A failed router makes its whole feature 404, which looks like a frontend bug.

Then run the bundled sweep (run it, do not read it into context):

```bash
python3 .agents/skills/verifying-live-endpoints/scripts/sweep_get_endpoints.py \
  --only '^/api/clinical/' --param patient_id=<a real patient id>
```

It reads the backend's own OpenAPI document, calls every GET route it can
build a URL for, and lists anything answering 5xx. It only issues GETs.
`--only` narrows it to the area you changed; drop it to sweep everything.
Routes with path parameters are skipped unless you pass `--param name=value`,
so read the "Not called" list and supply values for the routes you touched.
Get a real patient id with:

```bash
curl -s "$HAPI/Patient?_count=1&_elements=id"   # HAPI=http://localhost:8888/fhir locally
```

A 5xx on a route you did not touch is still a finding: report it, and say it
predates your change if `git stash` or the main branch shows the same failure.

## 3. Exercise the thing you changed

The sweep proves "does not crash". It does not prove "returns the right
thing". For the endpoint or flow you changed:

- **Reads**: call it with a real patient and compare the answer against HAPI
  directly. If the endpoint builds a FHIR search, replay that exact search
  against HAPI. A `400` with an `OperationOutcome` names the parameter HAPI
  rejected. Search parameter names differ per resource type (for example
  `authoredon` on MedicationRequest and `authored` on ServiceRequest), so a
  query shared across types needs checking against each one.
- **Writes**: perform the write, then read the resource back from HAPI and
  check the fields the change was meant to set. Note every resource id you
  create and delete them all afterwards; leftover fixtures become someone
  else's confusing demo data.
- **UI flows**: drive the real UI in a browser when a browser tool is
  available. Check that the screen reflects the write without a reload, and
  that loading, empty and error states render something visible. A write that
  succeeds while the screen stays unchanged reads as a failure to the person
  using it.
- **Config, proxy or compose changes**: check from outside the container, at
  the URL a browser would use, and check the container's view of the value
  (`docker exec <container> env`). The backend only sees variables that
  compose forwards.

Seeing `401` on a deployment that runs several backend workers does not by
itself mean your change broke auth: see B14 in `docs/ARCHITECTURE_DEBT.md`
for whether in-process training sessions are still the cause.

## 4. Turn every live-only failure into a test

When the live check finds something the suite missed, the fix is not finished
until a test would have caught it. The pattern that works here is asserting
the **outgoing request**: build the service with a fake HAPI client and assert
the exact search parameters it was called with. Then add a row to the bug
table in `docs/ARCHITECTURE_DEBT.md` (next free `B` number) saying what broke,
why the suite could not see it, and how it was found.

## 5. Report

State, in this order:

1. Which stack you verified against (local, or the named host) and at which
   commit.
2. What was live-verified, with the call and the observed result.
3. What is unit-verified only, and why it could not be checked live.
4. Anything broken that predates the change.
5. Fixtures created and confirmation that they were removed.
