"""deploy/nginx-prod.conf.template — upstreams must stay dynamically resolved.

nginx resolves the hostname in an `upstream {}` block (or a literal
`proxy_pass http://name`) once, at startup. `docker compose up -d` recreates
app containers on new IPs, so a pinned nginx 502s until reloaded. The
template avoids that with `resolver 127.0.0.11` and variables in every
proxy_pass; this test keeps a future edit from quietly reintroducing the
pinning.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
TEMPLATE = REPO / "deploy" / "nginx-prod.conf.template"


def _directives(text: str) -> str:
    """Template with comment lines dropped, so prose does not match."""
    return "\n".join(line for line in text.splitlines() if not line.lstrip().startswith("#"))


def test_template_uses_docker_resolver():
    body = _directives(TEMPLATE.read_text())
    assert re.search(r"^\s*resolver\s+127\.0\.0\.11\b.*valid=", body, re.M), (
        "prod nginx must re-resolve service names via Docker DNS"
    )


def test_template_has_no_pinned_upstreams():
    body = _directives(TEMPLATE.read_text())
    assert not re.search(r"^\s*upstream\s+\w+\s*\{", body, re.M), (
        "upstream {} blocks resolve once at startup; use set $var + proxy_pass $var"
    )
    literal = re.findall(r"^\s*proxy_pass\s+https?://[^$][^;]*;", body, re.M)
    assert literal == [], f"literal proxy_pass targets pin IPs at startup: {literal}"


def test_every_proxy_pass_variable_is_set():
    body = _directives(TEMPLATE.read_text())
    used = set(re.findall(r"^\s*proxy_pass\s+\$(\w+);", body, re.M))
    defined = set(re.findall(r"^\s*set\s+\$(\w+)\s+https?://[\w.-]+:\d+;", body, re.M))
    assert used, "expected variable proxy_pass targets"
    assert used <= defined, f"proxy_pass variables without a set: {used - defined}"
    assert {"backend", "frontend"} <= defined
