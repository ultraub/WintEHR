#!/usr/bin/env python3
"""Sweep a RUNNING WintEHR backend for endpoints that fail only when live.

Reads the backend's own OpenAPI document, calls every GET route it can
build a URL for, and reports anything that answers 5xx. It also prints
routers that failed to register (GET /api/health).

Why this exists: the unit suite fakes HAPI, so a query HAPI rejects (a
wrong sort or search parameter name, for example) passes every test and
500s for every real caller. A sweep against a live stack is the cheapest
way to see that class of failure.

Standard library only, so it runs anywhere python3 does. Read-only: it
issues GET requests and nothing else.

    python3 sweep_get_endpoints.py                       # http://localhost:8000
    python3 sweep_get_endpoints.py --base-url https://host
    python3 sweep_get_endpoints.py --only '^/api/clinical/' --param patient_id=<id>

Exit status: 0 when nothing answered 5xx and no router failed to
register, 1 otherwise, 2 when the backend could not be reached at all.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

# Routes that are not useful to call blindly: interactive OAuth redirects,
# the docs UI, and streaming/socket endpoints that never return.
DEFAULT_SKIP = r"^/(docs|redoc|openapi\.json)|/oauth/|/authorize|/ws(/|$)|/stream"


def fetch(url: str, token: str | None, timeout: float,
          method: str = "GET", body: dict | None = None,
          limit: int | None = 4000):
    """Return (status, text). Network failures come back as (None, reason).

    Bodies are cut to `limit` bytes (enough for an error message); pass
    limit=None for a document that must be read whole.
    """
    headers = {"Accept": "application/json"}
    data = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read(limit).decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read(limit).decode("utf-8", "replace")
    except Exception as exc:  # timeout, refused connection, DNS, TLS
        return None, f"{type(exc).__name__}: {exc}"


def login(base: str, user: str, password: str, timeout: float) -> str | None:
    status, text = fetch(f"{base}/api/auth/login", None, timeout, "POST",
                         {"username": user, "password": password})
    if status != 200:
        print(f"  login as {user!r} failed ({status}); continuing unauthenticated")
        return None
    try:
        payload = json.loads(text)
    except ValueError:
        return None
    for key in ("access_token", "session_token", "token"):
        if payload.get(key):
            return payload[key]
    return None


def build_url(base: str, path: str, operation: dict, shared_params: list,
              values: dict[str, str]) -> tuple[str | None, str]:
    """Fill path and required query parameters. (None, why) when we cannot."""
    params = list(shared_params) + list(operation.get("parameters", []))
    query = {}
    for name in re.findall(r"{([^}]+)}", path):
        if name not in values:
            return None, f"needs --param {name}=..."
        path = path.replace("{" + name + "}", urllib.parse.quote(values[name], safe=""))
    for p in params:
        if p.get("in") != "query":
            continue
        name = p.get("name")
        if name in values:
            query[name] = values[name]
        elif p.get("required"):
            return None, f"needs --param {name}=..."
    url = base + path
    if query:
        url += "?" + urllib.parse.urlencode(query)
    return url, ""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base-url",
                    default=os.getenv("WINTEHR_API_URL", "http://localhost:8000"),
                    help="backend base URL (env WINTEHR_API_URL; default %(default)s)")
    ap.add_argument("--user", default="demo", help="training login (default demo)")
    ap.add_argument("--password", default="password")
    ap.add_argument("--no-login", action="store_true", help="sweep unauthenticated")
    ap.add_argument("--only", default=None, metavar="REGEX",
                    help="sweep only paths matching this regex")
    ap.add_argument("--skip", default=DEFAULT_SKIP, metavar="REGEX",
                    help="paths to leave out (default: %(default)s)")
    ap.add_argument("--param", action="append", default=[], metavar="NAME=VALUE",
                    help="value for a path or query parameter; repeatable")
    ap.add_argument("--timeout", type=float, default=20.0)
    args = ap.parse_args()

    base = args.base_url.rstrip("/")
    values = dict(p.split("=", 1) for p in args.param if "=" in p)

    print(f"Sweeping {base}")
    status, text = fetch(f"{base}/api/health", None, args.timeout)
    if status is None:
        print(f"  cannot reach the backend: {text}")
        print("  No live stack means NOTHING was verified — say so; do not "
              "report the change as verified.")
        return 2
    failed_routers = []
    try:
        routers = json.loads(text).get("routers", {})
        failed_routers = routers.get("failed") or []
        print(f"  /api/health: {status}, routers registered="
              f"{routers.get('registered')}, failed={failed_routers}, "
              f"disabled_modules={routers.get('disabled_modules')}")
    except ValueError:
        print(f"  /api/health: {status}, body was not JSON")

    token = None if args.no_login else login(base, args.user, args.password, args.timeout)

    status, text = fetch(f"{base}/openapi.json", token, args.timeout, limit=None)
    if status != 200:
        print(f"  cannot read /openapi.json ({status}) — nothing to sweep")
        return 2
    spec = json.loads(text)

    only = re.compile(args.only) if args.only else None
    skip = re.compile(args.skip) if args.skip else None
    broken, client_errors, skipped, ok = [], [], [], 0

    for path, item in sorted(spec.get("paths", {}).items()):
        op = item.get("get")
        if op is None:
            continue
        if only and not only.search(path):
            continue
        if skip and skip.search(path):
            skipped.append((path, "matched --skip"))
            continue
        url, why = build_url(base, path, op, item.get("parameters", []), values)
        if url is None:
            skipped.append((path, why))
            continue
        status, body = fetch(url, token, args.timeout)
        if status is None or status >= 500:
            broken.append((path, status, " ".join(body.split())[:300]))
        elif status >= 400:
            client_errors.append((path, status))
        else:
            ok += 1

    print(f"\n{ok} ok, {len(client_errors)} answered 4xx, "
          f"{len(broken)} BROKEN (5xx or no answer), {len(skipped)} skipped")
    if broken:
        print("\nBROKEN — each of these fails for a real caller:")
        for path, status, body in broken:
            print(f"  {status or 'no answer'}  GET {path}\n        {body}")
    if client_errors:
        print("\n4xx (not failures by themselves — check any you expected to work):")
        for path, status in client_errors:
            print(f"  {status}  GET {path}")
    if skipped:
        print("\nNot called (supply --param to include them):")
        for path, why in skipped:
            print(f"  GET {path}  — {why}")
    if failed_routers:
        print(f"\nRouters that failed to register: {failed_routers}")
    return 1 if (broken or failed_routers) else 0


if __name__ == "__main__":
    sys.exit(main())
