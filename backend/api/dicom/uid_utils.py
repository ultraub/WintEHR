"""
UID representation helpers for the FHIR <-> DICOM boundary.

A DICOM Study/Series/SOP Instance UID is a bare OID (e.g. "1.2.840.99999...").
The HL7 DICOM-to-FHIR mapping expresses the *same* UID as a URN,
``urn:oid:<uid>``, in ``ImagingStudy.identifier``. These are two encodings of
the identical identifier — converting between them never alters the UID.

Inside DICOM files and DICOMweb (QIDO/WADO/STOW) requests only the bare form
is legal: the UI VR (DICOM PS3.5) permits digits and periods only, so a
``urn:oid:``-prefixed value is non-conformant and is rejected by a strict PACS.

Use this helper at every FHIR -> DICOM handoff instead of stripping the prefix
ad hoc, so the conversion happens in exactly one place.

This module is intentionally dependency-free: it is imported both by the
FastAPI DICOM proxy and by the standalone generation/STOW scripts.
"""


FHIR_OID_URN_PREFIX = "urn:oid:"


def dicom_uid_from_fhir_identifier(value) -> str:
    """Return the bare DICOM UID for a FHIR identifier value.

    Strips FHIR's ``urn:oid:`` URN encoding when present; the underlying UID
    is returned unchanged. Values already in bare form pass through untouched.
    """
    value = str(value or "").strip()
    if value.startswith(FHIR_OID_URN_PREFIX):
        return value[len(FHIR_OID_URN_PREFIX):]
    return value
