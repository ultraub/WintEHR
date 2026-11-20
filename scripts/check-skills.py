#!/usr/bin/env python3
"""Check the agent skills in .agents/skills/ (run in CI; standard library only).

    python3 scripts/check-skills.py

A skill is instructions an agent follows without re-deriving them, so a
stale path in one is worse than a stale path in a doc: the agent acts on
it. This check fails when a skill

  * breaks the Agent Skills frontmatter rules (name matches its directory,
    description present and <= 1024 chars, no non-spec fields — non-spec
    fields make some harnesses reject the skill outright),
  * has no working `.claude/skills/<name>` symlink (Claude Code reads only
    that directory; every other harness reads `.agents/skills/`),
  * grows past 500 lines (move detail into a file under the skill), or
  * names a repo path that does not exist.

Path detection is deliberately narrow: an inline-code span that contains a
`/`, has no spaces or placeholder characters, and is not a URL or an API
route. Write repo paths in skills from the repo root so they are checked.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SKILLS = REPO / ".agents" / "skills"
LINKS = REPO / ".claude" / "skills"

SPEC_FIELDS = {"name", "description", "license", "compatibility", "metadata",
               "allowed-tools"}
NAME_RE = re.compile(r"[a-z0-9]+(-[a-z0-9]+)*")
MAX_LINES = 500


def frontmatter(text: str) -> tuple[dict[str, str], str] | None:
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---", 4)
    if end == -1:
        return None
    fields: dict[str, str] = {}
    for line in text[4:end].splitlines():
        m = re.match(r"([A-Za-z][\w-]*):\s*(.*)", line)
        if m:  # top-level keys only; nested metadata lines are indented
            fields[m.group(1)] = m.group(2).strip()
    return fields, text[end + 4:]


def repo_paths(body: str) -> set[str]:
    body = re.sub(r"```.*?```", "", body, flags=re.S)  # commands, not claims
    found = set()
    for span in re.findall(r"`([^`\n]+)`", body):
        if "/" not in span or re.search(r"[\s<>{}$*=|'\"]", span):
            continue
        if span.startswith(("/", ".", "http", "~")):
            continue
        found.add(span.rstrip(".,:;"))
    return found


def check(skill: Path) -> list[str]:
    errors = []
    md = skill / "SKILL.md"
    if not md.is_file():
        return ["no SKILL.md"]
    text = md.read_text()
    parsed = frontmatter(text)
    if parsed is None:
        return ["SKILL.md has no `---` frontmatter block"]
    fields, body = parsed

    name = fields.get("name", "")
    if name != skill.name:
        errors.append(f"name {name!r} must equal the directory name")
    if not NAME_RE.fullmatch(name) or len(name) > 64:
        errors.append("name must be lowercase letters, digits and single "
                      "hyphens, at most 64 chars")
    desc = fields.get("description", "")
    if not desc:
        errors.append("description is missing")
    elif len(desc) > 1024:
        errors.append(f"description is {len(desc)} chars (limit 1024)")
    extra = set(fields) - SPEC_FIELDS
    if extra:
        errors.append(f"non-spec frontmatter fields {sorted(extra)} — some "
                      "harnesses reject the skill; keep to the spec")

    lines = text.count("\n") + 1
    if lines > MAX_LINES:
        errors.append(f"SKILL.md is {lines} lines (limit {MAX_LINES}); move "
                      "detail into a file beside it")

    link = LINKS / skill.name
    if not link.is_symlink():
        errors.append(f"missing symlink .claude/skills/{skill.name} -> "
                      f"../../.agents/skills/{skill.name}")
    elif link.resolve() != skill.resolve():
        errors.append(f".claude/skills/{skill.name} points somewhere else")

    for path in sorted(repo_paths(body)):
        if not (REPO / path).exists() and not (skill / path).exists():
            errors.append(f"names a path that does not exist: {path}")
    return errors


def main() -> int:
    if not SKILLS.is_dir():
        print("no .agents/skills directory")
        return 1
    failed = False
    skills = sorted(p for p in SKILLS.iterdir() if p.is_dir())
    for skill in skills:
        errors = check(skill)
        print(f"{'FAIL' if errors else 'ok  '} {skill.name}")
        for e in errors:
            print(f"       - {e}")
        failed = failed or bool(errors)
    known = {s.name for s in skills}
    if LINKS.is_dir():
        for link in sorted(LINKS.iterdir()):
            if link.name not in known:
                print(f"FAIL .claude/skills/{link.name} has no skill in "
                      ".agents/skills/")
                failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
