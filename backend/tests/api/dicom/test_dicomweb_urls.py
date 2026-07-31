"""
DICOMweb base-URL normalization (found live on the eastus2 prod deploy).

urljoin(base, "studies") only APPENDS when the base ends with "/" —
otherwise it REPLACES the last path segment. With the old compose default
("....../rs", no slash), every study/series/metadata query went to
".../aets/DCM4CHEE/studies" (no /rs), dcm4chee answered 404, the proxy
mapped it to 503, and the viewer silently showed nothing. wintehrdev never
hit it because its .env happened to spell the URL with a trailing slash.
"""

from urllib.parse import urljoin

from api.dicom.service import DICOM_QIDO_URL, DICOM_WADO_URL, _as_base_url


def test_as_base_url_makes_urljoin_append_not_replace():
    for spelled in ("http://arc:8080/dcm4chee-arc/aets/DCM4CHEE/rs",
                    "http://arc:8080/dcm4chee-arc/aets/DCM4CHEE/rs/"):
        base = _as_base_url(spelled)
        assert urljoin(base, "studies") == (
            "http://arc:8080/dcm4chee-arc/aets/DCM4CHEE/rs/studies"
        )


def test_module_urls_are_normalized_bases():
    assert DICOM_QIDO_URL.endswith("/")
    assert DICOM_WADO_URL.endswith("/")


def test_default_wado_is_the_rs_root_not_legacy_wado_uri():
    """The service builds WADO-RS paths (studies/{uid}/series/...), which
    live under /rs. The legacy /wado endpoint is WADO-URI (query-string
    style) and 404s RS-shaped paths — the old default pointed there."""
    assert "/wado" not in DICOM_WADO_URL


def test_empty_url_stays_empty_meaning_unconfigured():
    assert _as_base_url("") == ""
