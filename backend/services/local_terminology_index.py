"""Local terminology index — fast catalog search backed by SQLite + FTS5.

Bypasses HAPI's `$expand` (broken without HSearch on this deploy: the
in-memory expansion path can't handle the 100K-300K-concept CodeSystems
we have loaded). The build script `scripts/active/build_terminology_index.py`
populates the SQLite database from the same JSON CodeSystems that get
uploaded to HAPI; this service queries it for catalog search.

Public interface mirrors `services.terminology_service.TerminologyService`
(`search_catalog`, `search_multi`) so `UnifiedCatalogService` doesn't have
to know which backend it's talking to.
"""

from __future__ import annotations

import asyncio
import logging
import re
import sqlite3
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


def _build_fts_query(filter_text: str) -> str:
    """Convert user input to a safe FTS5 MATCH expression with prefix matching.

    FTS5's query syntax is finicky — bare punctuation can produce parse errors,
    and unquoted user text can hit reserved tokens (AND, OR, NOT, NEAR). The
    safest pattern is to extract word tokens, double-quote each, and append
    `*` for prefix matching so a partial term like "diab" matches "diabetes".
    """
    # \w in Python regex is unicode-aware; matches across Latin-extended chars
    # too (e.g. 'naïve' in a clinical display string).
    tokens = re.findall(r"\w+", filter_text, flags=re.UNICODE)
    if not tokens:
        return ""
    # Each token becomes "tok"* — prefix match against an exact token.
    # Combining with implicit AND (the default) means all tokens must match.
    return " ".join(f'"{tok}"*' for tok in tokens)


class LocalTerminologyIndex:
    """SQLite-backed terminology lookup for catalog search.

    Same interface as `TerminologyService`: `search_catalog` and
    `search_multi` return `[{system, code, display}, ...]`.

    Connection model: a single read-only SQLite connection held for the
    lifetime of the process. SQLite reads in WAL mode are concurrent-safe;
    the build script is the only writer and runs at deploy time, not at
    request time, so there's no contention.
    """

    def __init__(self, db_path: str):
        self._db_path = db_path
        self._conn: Optional[sqlite3.Connection] = None

    def _connect(self) -> Optional[sqlite3.Connection]:
        if self._conn is not None:
            return self._conn
        path = Path(self._db_path)
        if not path.exists():
            # Caller should have checked existence already, but be defensive
            # — losing the index between startup and first query (e.g. on
            # rebuild) shouldn't crash search.
            logger.warning("Terminology index missing at %s; returning empty", self._db_path)
            return None
        # mode=ro + immutable=1 makes this read-only; the build script's
        # rebuild reopens fresh anyway.
        uri = f"file:{self._db_path}?mode=ro"
        try:
            self._conn = sqlite3.connect(uri, uri=True, check_same_thread=False)
        except sqlite3.Error as exc:
            logger.error("Failed to open terminology index at %s: %s", self._db_path, exc)
            return None
        return self._conn

    def close(self) -> None:
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    async def search_catalog(
        self,
        catalog_type: str,
        filter_text: Optional[str] = None,
        count: int = 50,
    ) -> List[Dict[str, str]]:
        """Search a single domain. Returns up to `count` matches."""
        return await asyncio.to_thread(
            self._search_sync, catalog_type, filter_text, count
        )

    async def search_multi(
        self,
        catalog_types: List[str],
        filter_text: Optional[str] = None,
        count: int = 50,
    ) -> Dict[str, List[Dict[str, str]]]:
        """Search multiple domains concurrently."""
        results = await asyncio.gather(
            *[self.search_catalog(ct, filter_text, count) for ct in catalog_types],
            return_exceptions=True,
        )
        out: Dict[str, List[Dict[str, str]]] = {}
        for ct, result in zip(catalog_types, results):
            if isinstance(result, Exception):
                logger.warning("Local terminology search failed for %s: %s", ct, result)
                out[ct] = []
            else:
                out[ct] = result
        return out

    def _search_sync(
        self,
        domain: str,
        filter_text: Optional[str],
        count: int,
    ) -> List[Dict[str, str]]:
        conn = self._connect()
        if conn is None:
            return []
        try:
            if filter_text and filter_text.strip():
                fts_query = _build_fts_query(filter_text)
                if not fts_query:
                    # All tokens were stripped — fall through to unfiltered
                    # so the caller gets some results rather than empty.
                    return self._fetch_unfiltered(conn, domain, count)
                rows = conn.execute(
                    """
                    SELECT c.system, c.code, c.display
                    FROM concepts_fts f
                    JOIN concepts c ON c.rowid = f.rowid
                    WHERE c.domain = ?
                      AND concepts_fts MATCH ?
                    LIMIT ?
                    """,
                    (domain, fts_query, count),
                ).fetchall()
            else:
                return self._fetch_unfiltered(conn, domain, count)
        except sqlite3.Error as exc:
            logger.warning("Local terminology query failed for %s: %s", domain, exc)
            return []

        return [{"system": s, "code": c, "display": d} for s, c, d in rows]

    @staticmethod
    def _fetch_unfiltered(
        conn: sqlite3.Connection,
        domain: str,
        count: int,
    ) -> List[Dict[str, str]]:
        rows = conn.execute(
            "SELECT system, code, display FROM concepts WHERE domain = ? LIMIT ?",
            (domain, count),
        ).fetchall()
        return [{"system": s, "code": c, "display": d} for s, c, d in rows]
