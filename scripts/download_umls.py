#!/usr/bin/env python3
"""
download_umls.py — Download UMLS Metathesaurus MRCONSO file from NLM's UTS.

Authenticated with a UMLS API key (generate at https://uts.nlm.nih.gov/uts/edit-profile).
Only downloads MRCONSO (~2 GB zipped) — the concepts-and-strings table that
extract_vocabularies.py consumes. Other UMLS release artifacts (semantic network,
lexicon, relationships) are not needed for our catalog use case.

USAGE:
    # API key from environment
    export UMLS_API_KEY=<your-umls-api-key>
    python3 scripts/download_umls.py ~/umls_source/

    # Pin a specific release
    python3 scripts/download_umls.py ~/umls_source/ --release 2024AA

    # Or pass key explicitly (not recommended; prefer env or .env)
    python3 scripts/download_umls.py ~/umls_source/ --api-key ...

OUTPUT:
    <output_dir>/MRCONSO.RRF       — uncompressed concepts table (~8 GB)
    <output_dir>/MRSAB.RRF         — source metadata (small, optional, used for version)
    <output_dir>/.umls_release     — text file recording which release was downloaded

LICENSING:
    UMLS Metathesaurus License Agreement binds the operator of the API key.
    Subsequent use of the downloaded data is governed by per-source-vocabulary
    terms — see docs/TERMINOLOGY_SETUP.md for the breakdown. This script is
    just the download half; what you do with the data afterwards determines
    whether you're on solid licensing ground.

    The API key holder must be a UMLS Authorized User — re-accept the UMLS LA
    annually at https://uts.nlm.nih.gov/uts/edit-profile.

RELEASE VERSIONING:
    UMLS cuts two releases per year: spring (YYYYaa) and fall (YYYYab).
    Latest release URLs are at https://www.nlm.nih.gov/research/umls/licensedcontent/downloads.html

    If --release is not specified, we try the most recent few in order and
    use the first that responds successfully. This auto-updates for anyone
    running the script but can be pinned explicitly for reproducibility.

Requirements: Python 3.8+, httpx (pip install httpx).
"""

from __future__ import annotations

import argparse
import logging
import os
import shutil
import sys
import time
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Iterable, Optional

try:
    import httpx
except ImportError:
    print("ERROR: httpx not installed. Run: pip install httpx", file=sys.stderr)
    sys.exit(1)

logger = logging.getLogger("download_umls")

# UMLS REST auth + download services
UTS_DOWNLOAD_ENDPOINT = "https://uts-ws.nlm.nih.gov/download"
UMLS_BASE_URL = "https://download.nlm.nih.gov/umls/kss"

# Generate candidate release tags in reverse-chronological order, to try when
# --release is not specified. We go back 3 years because NLM keeps older
# releases accessible.
def _candidate_releases() -> Iterable[str]:
    now = datetime.utcnow()
    year = now.year
    # UMLS convention: 2024AA = spring 2024, 2024AB = fall 2024
    # Try current year AB, current year AA, previous year AB, etc.
    for y in range(year, year - 4, -1):
        for release in ("ab", "aa"):
            yield f"{y}{release.upper()}"


def _mrconso_url(release: str) -> str:
    """Build the canonical MRCONSO zip URL for a given release tag."""
    return f"{UMLS_BASE_URL}/{release}/umls-{release}-mrconso.zip"


def _download_once(
    client: httpx.Client,
    api_key: str,
    target_url: str,
    dest_path: Path,
) -> bool:
    """One attempt to download a UMLS file. Returns True on 200, False on 4xx/5xx."""
    # UTS download endpoint: GET /download?apiKey=KEY&url=ENCODED_TARGET
    # It responds with a 302 Redirect to a short-lived signed URL; httpx
    # follows_redirects=True (default False — we pass it) to stream the body.
    try:
        with client.stream(
            "GET",
            UTS_DOWNLOAD_ENDPOINT,
            params={"apiKey": api_key, "url": target_url},
            follow_redirects=True,
            timeout=httpx.Timeout(60.0, read=600.0),
        ) as resp:
            if resp.status_code == 401:
                logger.error("UMLS rejected the API key (HTTP 401). "
                             "Regenerate at https://uts.nlm.nih.gov/uts/edit-profile")
                return False
            if resp.status_code == 404:
                logger.info("Release not found at %s (HTTP 404)", target_url)
                return False
            if resp.status_code >= 400:
                logger.warning("UMLS download failed: HTTP %d for %s",
                               resp.status_code, target_url)
                return False

            total = int(resp.headers.get("content-length") or 0)
            downloaded = 0
            last_report = time.time()
            with open(dest_path, "wb") as out:
                for chunk in resp.iter_bytes(chunk_size=1024 * 1024):
                    out.write(chunk)
                    downloaded += len(chunk)
                    now = time.time()
                    if now - last_report >= 5:
                        pct = (100 * downloaded / total) if total else 0
                        logger.info("  %.1f%% (%.1f GB / %.1f GB)",
                                    pct,
                                    downloaded / 1e9,
                                    total / 1e9 if total else 0)
                        last_report = now

            logger.info("Download complete: %.1f GB saved to %s",
                        downloaded / 1e9, dest_path)
            return True
    except httpx.HTTPError as e:
        logger.warning("HTTP error: %s", e)
        return False


def download_mrconso(
    api_key: str,
    output_dir: Path,
    release: Optional[str] = None,
) -> str:
    """
    Download and unzip the MRCONSO subset from UMLS. Returns the release tag used.

    If `release` is None, tries recent releases in reverse-chronological order.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    zip_path = output_dir / "umls-mrconso.zip"

    # Use one client for the whole operation to keep the connection pool warm.
    with httpx.Client(
        headers={"User-Agent": "WintEHR-terminology-loader/1.0"},
    ) as client:
        if release:
            # User-specified: try only this one, fail if it doesn't exist.
            target = _mrconso_url(release)
            logger.info("Downloading %s...", target)
            if not _download_once(client, api_key, target, zip_path):
                raise SystemExit(f"Failed to download release {release}. "
                                 "Check https://www.nlm.nih.gov/research/umls/"
                                 "licensedcontent/downloads.html for valid releases.")
            used_release = release
        else:
            # Auto: try recent releases in reverse-chron order.
            used_release = None
            for candidate in _candidate_releases():
                target = _mrconso_url(candidate)
                logger.info("Trying release %s...", candidate)
                if _download_once(client, api_key, target, zip_path):
                    used_release = candidate
                    break
            if used_release is None:
                raise SystemExit("Could not download any recent UMLS release. "
                                 "Either network is blocked or API key is invalid.")
            logger.info("Using release: %s", used_release)

    # Unzip — MRCONSO.RRF is the main thing; ignore other files if present.
    logger.info("Unzipping %s...", zip_path)
    with zipfile.ZipFile(zip_path, "r") as zf:
        members = zf.namelist()
        logger.info("  Archive contains: %s", members[:10])
        # Find any MRCONSO.RRF and any MRSAB.RRF regardless of directory nesting
        rrf_candidates = [m for m in members
                          if m.endswith(("MRCONSO.RRF", "MRSAB.RRF"))]
        if not rrf_candidates:
            raise SystemExit(f"MRCONSO.RRF not found in archive. Members: {members[:20]}")
        for member in rrf_candidates:
            # Extract flat into output_dir (strip any nested paths)
            name = Path(member).name
            target = output_dir / name
            logger.info("  Extracting %s → %s", member, target)
            with zf.open(member) as src, open(target, "wb") as dst:
                shutil.copyfileobj(src, dst, length=64 * 1024 * 1024)
            size_gb = target.stat().st_size / 1e9
            logger.info("    %s: %.2f GB", name, size_gb)

    # Record which release was used (for reproducibility and debugging)
    release_marker = output_dir / ".umls_release"
    release_marker.write_text(used_release + "\n", encoding="utf-8")
    logger.info("Wrote release tag %s → %s", used_release, release_marker)

    # Reclaim disk: drop the zip now that RRF is extracted
    zip_path.unlink()
    logger.info("Removed intermediate %s to reclaim disk", zip_path)

    return used_release


def read_api_key(cli_value: Optional[str]) -> str:
    """Resolve UMLS API key from CLI, env, or .env — in that precedence order."""
    if cli_value:
        return cli_value
    env_val = os.getenv("UMLS_API_KEY")
    if env_val:
        return env_val
    # .env in CWD or project root
    for dotenv_path in (Path.cwd() / ".env", Path(__file__).resolve().parent.parent / ".env"):
        if dotenv_path.is_file():
            for line in dotenv_path.read_text().splitlines():
                line = line.strip()
                if line.startswith("UMLS_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit(
        "No UMLS API key found. Set UMLS_API_KEY in .env, as an env var, or "
        "pass --api-key. Generate at https://uts.nlm.nih.gov/uts/edit-profile."
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Download UMLS MRCONSO.RRF via the UTS authenticated download API.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("output_dir", type=Path,
                        help="Output directory (will contain MRCONSO.RRF after unzip)")
    parser.add_argument("--api-key", default=None,
                        help="UMLS API key (prefer UMLS_API_KEY env var or .env)")
    parser.add_argument("--release", default=None,
                        help="UMLS release tag (e.g. 2024AA). Default: latest available.")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(message)s",
    )

    api_key = read_api_key(args.api_key)
    # Don't log the key itself — but confirm it's present
    logger.info("UMLS API key loaded (%d chars)", len(api_key))
    logger.info("Output directory: %s", args.output_dir)

    release = download_mrconso(api_key, args.output_dir, args.release)

    print()
    print(f"✓ Downloaded UMLS {release}")
    print(f"  Files in {args.output_dir}:")
    for p in sorted(args.output_dir.iterdir()):
        size_gb = p.stat().st_size / 1e9 if p.is_file() else 0
        print(f"    {p.name}  ({size_gb:.2f} GB)" if size_gb else f"    {p.name}")
    print()
    print(f"Next step — extract to FHIR JSON:")
    print(f"  python3 scripts/extract_vocabularies.py --format umls "
          f"{args.output_dir} ~/fhir_vocabularies")

    return 0


if __name__ == "__main__":
    sys.exit(main())
