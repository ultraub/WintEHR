"""
Reference-field parity pins (bug B5, docs/ARCHITECTURE_DEBT.md).

Two same-named REFERENCE_FIELDS maps used to drift: the schema endpoint
advertised 25 resource types while the traversal cache followed only 13 —
12 types' relationships were advertised but unclickable. Both now derive
from api/fhir/reference_fields.py; these tests pin that they can never
diverge again.
"""

from api.fhir.reference_fields import REFERENCE_FIELDS as CANONICAL
from api.fhir.routers.relationships import REFERENCE_FIELDS as SCHEMA_SHAPE
from api.services.fhir.relationship_cache import REFERENCE_FIELDS as CACHE_SHAPE


def _field_set(m):
    return {(rt, f) for rt, fields in m.items() for f in fields}


def test_both_consumers_cover_the_full_canonical_map():
    assert _field_set(SCHEMA_SHAPE) == _field_set(CANONICAL)
    assert _field_set(CACHE_SHAPE) == _field_set(CANONICAL)


def test_traversal_now_follows_every_advertised_type():
    """The original bug: 12 types advertised by /schema but untraversable."""
    assert set(CACHE_SHAPE) == set(SCHEMA_SHAPE)
    for rt in ("Claim", "Practitioner", "Organization", "Medication", "Provenance"):
        assert rt in CACHE_SHAPE, f"{rt} advertised but not traversable"


def test_targets_agree_everywhere():
    for rt, fields in CANONICAL.items():
        for f, m in fields.items():
            assert SCHEMA_SHAPE[rt][f]["target"] == m["targets"]
            assert CACHE_SHAPE[rt][f]["targets"] == m["targets"]


def test_canonical_shape_is_complete():
    assert len(CANONICAL) == 25
    assert sum(len(v) for v in CANONICAL.values()) == 152
    for rt, fields in CANONICAL.items():
        for f, m in fields.items():
            assert m["targets"], f"{rt}.{f} has no targets"
            assert m["cardinality"] in {"0..1", "0..*", "1..1"}, f"{rt}.{f}"
            assert m["type"].count("-to-") == 1, f"{rt}.{f}"
