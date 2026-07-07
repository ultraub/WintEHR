#!/usr/bin/env python3
"""
DICOM Service
Business logic for DICOM file access and metadata: QIDO-RS/WADO-RS client
helpers, the shared async HTTP client, the multipart/related parser, and
FHIR ImagingStudy mapping. HTTP endpoints live in api/dicom/router.py.
"""

import io
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import unquote, urljoin

import httpx
import numpy as np
import pydicom
from fastapi import HTTPException
from PIL import Image

from api.dicom.uid_utils import dicom_uid_from_fhir_identifier
from services.dicom_mapping_service import (
    DICOMImagingStudyService,
    DICOMToImagingStudyMapper,
)

logger = logging.getLogger(__name__)

# DICOM data directory
DICOM_BASE_DIR = Path(__file__).parent.parent.parent / "data" / "generated_dicoms"

# QIDO-RS and WADO configuration
# Default values for localhost development
_DEFAULT_QIDO_URL = "http://arc:8080/dcm4chee-arc/aets/DCM4CHEE/rs"
_DEFAULT_WADO_URL = "http://arc:8080/dcm4chee-arc/aets/DCM4CHEE/wado"

DICOM_QIDO_URL = os.getenv("DICOM_QIDO_URL", _DEFAULT_QIDO_URL)
DICOM_WADO_URL = os.getenv("DICOM_WADO_URL", _DEFAULT_WADO_URL)

# TLS certificate verification for DICOMweb requests. Defaults to disabled
# because the bundled dcm4chee dev deployment speaks plain HTTP or uses
# self-signed certificates. TODO: set DICOM_TLS_VERIFY=true (proper SSL
# verification) in any deployment whose DICOM server presents a valid
# certificate.
DICOM_TLS_VERIFY = os.getenv("DICOM_TLS_VERIFY", "false").lower() == "true"

# Module-global httpx.AsyncClient created lazily, reused across requests.
_dicom_http_client: Optional[httpx.AsyncClient] = None


def get_dicom_http_client() -> httpx.AsyncClient:
    """Return the shared async HTTP client for DICOMweb requests.

    Created lazily on first use and recreated if it has been closed. Call
    sites pass their own per-request ``timeout=`` values; the client default
    is a conservative 30 s.
    """
    global _dicom_http_client
    if _dicom_http_client is None or _dicom_http_client.is_closed:
        _dicom_http_client = httpx.AsyncClient(
            verify=DICOM_TLS_VERIFY,
            timeout=httpx.Timeout(30.0),
            follow_redirects=True,
        )
    return _dicom_http_client


def _is_dicom_server_configured() -> bool:
    """
    Determine if DICOM server endpoints are available.
    Returns True when both QIDO and WADO URLs are non-empty.
    """
    return bool(DICOM_QIDO_URL and DICOM_WADO_URL)


def _get_qido_url() -> str:
    """
    Get QIDO-RS URL. Uses configured URL or localhost default.
    """
    return DICOM_QIDO_URL


def _get_wado_url() -> str:
    """
    Get WADO URL. Uses configured URL or localhost default.
    """
    return DICOM_WADO_URL


class _PartHeaders:
    """Case-insensitive, bytes-keyed header mapping for one multipart part.

    Mirrors how ``requests_toolbelt`` exposed part headers (bytes keys and
    bytes values) so existing consumers such as
    ``part.headers.get(b"Content-Disposition", b"")`` keep working unchanged.
    """

    def __init__(self, items):
        self._store = {key.lower(): (key, value) for key, value in items}

    def get(self, key, default=None):
        entry = self._store.get(key.lower())
        return entry[1] if entry is not None else default

    def __getitem__(self, key):
        return self._store[key.lower()][1]

    def __contains__(self, key):
        return key.lower() in self._store

    def items(self):
        return [(key, value) for key, value in self._store.values()]


class MultipartPart:
    """One part of a multipart/related payload: raw bytes + headers."""

    __slots__ = ("content", "headers")

    def __init__(self, content: bytes, headers: _PartHeaders):
        self.content = content
        self.headers = headers


def parse_multipart_related(body: bytes, content_type: str) -> List[MultipartPart]:
    """Parse an RFC 2387 multipart/related payload into its parts.

    WADO-RS delivers DICOM instances as ``multipart/related`` bodies with
    ``application/dicom`` parts. This replaces the former dependency on
    ``requests_toolbelt``'s ``MultipartDecoder`` and matches its behavior:
    the boundary is read from the Content-Type header, the body is split on
    ``--boundary`` delimiters, and each part's payload bytes are exposed
    unmodified via ``.content`` — DICOM instance bytes must not be altered.

    Raises ValueError for a non-multipart content type, a missing boundary,
    or a part without the RFC 2046 header/body separator.
    """
    segments = [segment.strip() for segment in content_type.split(";")]
    if not segments or segments[0].split("/")[0].lower() != "multipart":
        raise ValueError(f"Unexpected non-multipart content type: {content_type!r}")

    boundary = None
    for segment in segments[1:]:
        attr, sep, value = segment.partition("=")
        if sep and attr.strip().lower() == "boundary":
            boundary = value.strip().strip('"')
            break
    if not boundary:
        raise ValueError(f"No boundary parameter in content type: {content_type!r}")

    delimiter = b"--" + boundary.encode("utf-8")
    parts: List[MultipartPart] = []
    for fragment in body.split(b"\r\n" + delimiter):
        # Skip the preamble/epilogue fragments around the real parts. Tested
        # on the raw fragment, before stripping the opening delimiter, to
        # match requests_toolbelt's decoder exactly.
        if fragment in (b"", b"\r\n", b"--") or fragment.startswith(b"--\r\n"):
            continue
        # The first fragment still carries the opening delimiter (no leading
        # CRLF before the first boundary line).
        if fragment.startswith(delimiter):
            fragment = fragment[len(delimiter):]
        header_block, sep, content = fragment.partition(b"\r\n\r\n")
        if not sep:
            raise ValueError("Malformed multipart part: missing header/body separator")
        header_items = []
        for line in header_block.lstrip().split(b"\r\n"):
            name, colon, value = line.partition(b":")
            if colon:
                header_items.append((name.strip(), value.strip()))
        parts.append(MultipartPart(content, _PartHeaders(header_items)))
    return parts


def validate_uid(uid: str, uid_type: str = "study") -> str:
    """
    Validate DICOM UID format.

    Args:
        uid: DICOM UID to validate
        uid_type: Type of UID (study, series, instance)

    Returns:
        Validated UID
    """

    if not uid or len(uid.strip()) == 0:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {uid_type} UID: empty or missing"
        )

    uid = unquote(uid).strip()

    # Callers that read the UID from a FHIR ImagingStudy identifier may pass
    # FHIR's URN encoding (urn:oid:<uid>). Recover the bare UID — the only
    # form the DICOM UI VR permits in DICOMweb requests. The UID itself is
    # never altered; see api/dicom/uid_utils.py for the full rationale.
    uid = dicom_uid_from_fhir_identifier(uid)

    # Basic UID format validation (should be numeric with dots)
    if not all(c.isdigit() or c == '.' or c == ":" or c.isalpha() for c in uid):
        raise HTTPException(
            status_code=400,
            detail=f"{uid} -- Invalid {uid_type} UID format: contains non-numeric characters"
        )

    return uid


class DICOMService:
    """Service for DICOM file operations with local filesystem and DICOM server (QIDO/WADO) support."""

    # QIDO and WADO support for remote DICOM servers
    @staticmethod
    async def query_qido_studies(
        qido_url: Optional[str] = None,
        patient_id: Optional[str] = None,
        study_instance_uid: Optional[str] = None,
        modality: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Query DICOM studies using QIDO-RS (Query Information Destructive Object Retrieve).

        Args:
            qido_url: QIDO-RS base URL (defaults to DICOM_QIDO_URL)
            patient_id: Filter by PatientID
            study_instance_uid: Filter by StudyInstanceUID
            modality: Filter by Modality
            limit: Maximum number of results

        Returns:
            List of study information from QIDO-RS
        """
        if qido_url is None:
            qido_url = _get_qido_url()

        try:
            # Build QIDO-RS query URL
            qido_studies_url = urljoin(qido_url, "studies")

            # Build query parameters
            params = {"limit": limit}
            if patient_id:
                params["PatientID"] = patient_id
            if study_instance_uid:
                params["StudyInstanceUID"] = study_instance_uid
            if modality:
                params["Modality"] = modality

            logger.info(f"Querying QIDO-RS: {qido_studies_url} with params: {params}")

            # Make request to QIDO-RS
            client = get_dicom_http_client()
            response = await client.get(
                qido_studies_url,
                params=params,
                headers={"Accept": "application/dicom+json"},
                timeout=30
            )
            response.raise_for_status()

            # Parse response
            studies = response.json() if response.content else []
            logger.info(f"Found {len(studies)} studies from QIDO-RS")
            return studies

        except httpx.HTTPError as e:
            logger.error(f"QIDO-RS query failed: {e}")
            raise HTTPException(status_code=503, detail=f"DICOM server unavailable: {e}")
        except Exception as e:
            logger.error(f"Error querying QIDO-RS: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to query DICOM server: {e}")

    @staticmethod
    async def query_qido_series(
        study_instance_uid: str,
        qido_url: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Query DICOM series using QIDO-RS for a specific study.

        Args:
            study_instance_uid: StudyInstanceUID to query
            qido_url: QIDO-RS base URL (defaults to configured or localhost default)

        Returns:
            List of series information
        """
        if qido_url is None:
            qido_url = _get_qido_url()

        try:
            qido_series_url = urljoin(qido_url, f"studies/{study_instance_uid}/series")

            logger.info(f"Querying QIDO-RS for series: {qido_series_url}")

            client = get_dicom_http_client()
            response = await client.get(
                qido_series_url,
                headers={"Accept": "application/dicom+json"},
                timeout=30
            )
            response.raise_for_status()

            series_list = response.json() if response.content else []
            logger.info(f"Found {len(series_list)} series")
            return series_list

        except httpx.HTTPError as e:
            logger.error(f"QIDO-RS series query failed: {e}")
            raise HTTPException(status_code=503, detail=f"DICOM server unavailable: {e}")
        except Exception as e:
            logger.error(f"Error querying series from QIDO-RS: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to query series: {e}")

    @staticmethod
    async def fetch_wado_instance(
        study_instance_uid: str,
        series_instance_uid: str,
        sop_instance_uid: str,
        wado_url: Optional[str] = None
    ) -> bytes:
        """
        Fetch DICOM instance using WADO (Web Access to DICOM Objects).

        Args:
            study_instance_uid: StudyInstanceUID
            series_instance_uid: SeriesInstanceUID
            sop_instance_uid: SOPInstanceUID
            wado_url: WADO base URL (defaults to DICOM_WADO_URL)

        Returns:
            DICOM file bytes
        """
        if wado_url is None:
            wado_url = _get_wado_url()

        try:
            # Build WADO URL according to standard
            wado_instance_url = urljoin(
                wado_url,
                f"studies/{study_instance_uid}/series/{series_instance_uid}/instances/{sop_instance_uid}"
            )

            logger.info(f"Fetching DICOM instance via WADO: {wado_instance_url[:80]}...")

            client = get_dicom_http_client()
            response = await client.get(
                wado_instance_url,
                timeout=60
            )
            response.raise_for_status()

            response_content = []
            multipart_parts = parse_multipart_related(
                response.content, response.headers.get("content-type", "")
            )

            for part in multipart_parts:
                response_content.append(part.content)
            response_content = b"".join(response_content)

            logger.info(f"Successfully fetched {len(response_content)} bytes via WADO")
            return response_content

        except httpx.HTTPError as e:
            logger.error(f"WADO fetch failed: {e}")
            raise HTTPException(status_code=503, detail=f"Failed to fetch from DICOM server: {e}")
        except Exception as e:
            logger.error(f"Error fetching DICOM instance: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch instance: {e}")

    @staticmethod
    async def fetch_wado_metadata(
        study_instance_uid: str,
        series_instance_uid: str,
        sop_instance_uid: str,
        wado_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Fetch DICOM metadata using WADO-RS.

        Args:
            study_instance_uid: StudyInstanceUID
            series_instance_uid: SeriesInstanceUID
            sop_instance_uid: SOPInstanceUID
            wado_url: WADO-RS base URL (defaults to DICOM_WADO_URL)

        Returns:
            DICOM metadata as dictionary
        """
        if wado_url is None:
            wado_url = _get_wado_url()

        try:
            # Build WADO-RS URL for metadata
            wado_metadata_url = urljoin(
                wado_url,
                f"studies/{study_instance_uid}/series/{series_instance_uid}/instances/{sop_instance_uid}/metadata"
            )

            logger.info(f"Fetching DICOM metadata via WADO-RS: {wado_metadata_url[:80]}...")

            client = get_dicom_http_client()
            response = await client.get(
                wado_metadata_url,
                headers={"Accept": "application/dicom+json"},
                timeout=30
            )
            response.raise_for_status()

            metadata = response.json() if response.content else {}
            logger.info(f"Successfully fetched metadata")
            return metadata

        except httpx.HTTPError as e:
            logger.error(f"WADO-RS metadata fetch failed: {e}")
            raise HTTPException(status_code=503, detail=f"Failed to fetch metadata from DICOM server: {e}")
        except Exception as e:
            logger.error(f"Error fetching metadata: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch metadata: {e}")

    @staticmethod
    def _get_dicom_json_value(
        dicom_json_obj: Dict[str, Any],
        hex_tag: str,
        fallback_key: str = "",
        default: str = ""
    ) -> str:
        """
        Extract value from DICOM JSON object by tag hex code or fallback key.

        DICOM JSON format stores values like:
        {"00200010": {"Value": ["1.2.3.4"]}} or {"StudyInstanceUID": "1.2.3.4"}

        Args:
            dicom_json_obj: DICOM JSON object
            hex_tag: DICOM tag hex code (e.g., "00200010")
            fallback_key: Fallback keyword to check
            default: Default value if not found

        Returns:
            Extracted value as string
        """
        try:
            # Try hex tag format first
            if hex_tag in dicom_json_obj:
                value_obj = dicom_json_obj[hex_tag]
                if isinstance(value_obj, dict) and "Value" in value_obj:
                    values = value_obj.get("Value", [])
                    if values:
                        # Handle different value types
                        if isinstance(values[0], dict):
                            # Complex value (e.g., PersonName)
                            return values[0].get("Alphabetic", "")
                        return str(values[0])

            # Try fallback keyword format
            if fallback_key and fallback_key in dicom_json_obj:
                return str(dicom_json_obj[fallback_key])

            return default
        except Exception as e:
            logger.warning(f"Error extracting DICOM JSON value for {hex_tag}: {e}")
            return default

    @staticmethod
    def find_dicom_files(study_dir: Path) -> List[Path]:
        """Find all DICOM files in a study directory."""
        dicom_files = []
        if study_dir.exists():
            for file_path in study_dir.rglob("*.dcm"):
                dicom_files.append(file_path)
        return sorted(dicom_files)

    @staticmethod
    def read_dicom_metadata(file_path: Path) -> Dict[str, Any]:
        """Read DICOM metadata without pixel data."""
        try:
            ds = pydicom.dcmread(str(file_path), stop_before_pixels=True, force=True)

            metadata = {
                "studyInstanceUID": str(ds.get("StudyInstanceUID", "")),
                "seriesInstanceUID": str(ds.get("SeriesInstanceUID", "")),
                "sopInstanceUID": str(ds.get("SOPInstanceUID", "")),
                "instanceNumber": int(ds.get("InstanceNumber", 0)),
                "seriesNumber": int(ds.get("SeriesNumber", 0)),
                "modality": str(ds.get("Modality", "")),
                "studyDate": str(ds.get("StudyDate", "")),
                "studyTime": str(ds.get("StudyTime", "")),
                "studyDescription": str(ds.get("StudyDescription", "")),
                "seriesDescription": str(ds.get("SeriesDescription", "")),
                "patientName": str(ds.get("PatientName", "")),
                "patientID": str(ds.get("PatientID", "")),
                "rows": int(ds.get("Rows", 0)),
                "columns": int(ds.get("Columns", 0)),
                "pixelSpacing": list(ds.get("PixelSpacing", [1.0, 1.0])) if hasattr(ds.get("PixelSpacing", [1.0, 1.0]), '__iter__') else [1.0, 1.0],
                "sliceThickness": float(ds.get("SliceThickness", 1.0)),
                "windowCenter": float(ds.get("WindowCenter", 128)) if ds.get("WindowCenter") is not None else 128,
                "windowWidth": float(ds.get("WindowWidth", 256)) if ds.get("WindowWidth") is not None else 256,
                "rescaleIntercept": float(ds.get("RescaleIntercept", 0)),
                "rescaleSlope": float(ds.get("RescaleSlope", 1)),
                "photometricInterpretation": str(ds.get("PhotometricInterpretation", "")),
                "bitsAllocated": int(ds.get("BitsAllocated", 16)),
                "bitsStored": int(ds.get("BitsStored", 12)),
                "filePath": str(file_path),
                "fileSize": file_path.stat().st_size
            }

            return metadata

        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to read DICOM metadata: {e}")

    @staticmethod
    def extract_pixel_data(file_path: Path) -> np.ndarray:
        """Extract pixel data from DICOM file."""
        try:
            ds = pydicom.dcmread(str(file_path), force=True)

            if not hasattr(ds, 'pixel_array'):
                raise ValueError("DICOM file has no pixel data")

            pixel_array = ds.pixel_array

            # Apply rescaling if needed
            if hasattr(ds, 'RescaleSlope') and hasattr(ds, 'RescaleIntercept'):
                pixel_array = pixel_array * float(ds.RescaleSlope) + float(ds.RescaleIntercept)

            return pixel_array

        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to extract pixel data: {e}")

    @staticmethod
    async def fetch_wado_rendered(
        study_instance_uid: str,
        series_instance_uid: str,
        sop_instance_uid: str,
        frame: int = 1,
        qido_url: Optional[str] = None,
    ) -> dict:
        """Fetch a PACS-rendered frame for an instance via WADO-RS `rendered`.

        dcm4chee decodes the pixel data server-side — including JPEG, color
        (YBR/RGB), and multi-frame — and returns a browser-displayable still.
        Used as a fallback when local grayscale windowing can't handle the
        instance (e.g. color/multi-frame ultrasound). We render a single frame
        (default frame 1) rather than the whole multi-frame object: the
        instance-level `rendered` returns the full cine as one large animated
        GIF (seconds, multi-MB), whereas a single frame is a fast ~50 KB JPEG.
        Returns {"content": bytes, "content_type": str}.
        """
        if qido_url is None:
            qido_url = _get_qido_url()
        rendered_url = urljoin(
            qido_url.rstrip("/") + "/",
            f"studies/{study_instance_uid}/series/{series_instance_uid}"
            f"/instances/{sop_instance_uid}/frames/{frame}/rendered",
        )
        client = get_dicom_http_client()
        resp = await client.get(
            rendered_url,
            headers={"Accept": "image/*"},
            timeout=120,
        )
        resp.raise_for_status()
        return {
            "content": resp.content,
            "content_type": resp.headers.get("Content-Type", "image/jpeg"),
        }

    @staticmethod
    def convert_to_png(pixel_array: np.ndarray, window_center: int = 128, window_width: int = 256) -> bytes:
        """Convert DICOM pixel array to PNG image."""
        try:
            # Apply windowing
            lower = window_center - window_width // 2
            upper = window_center + window_width // 2

            windowed = np.clip(pixel_array, lower, upper)

            # Normalize to 0-255
            normalized = ((windowed - lower) / (upper - lower) * 255).astype(np.uint8)

            # Convert to PIL Image
            image = Image.fromarray(normalized, mode='L')

            # Convert to PNG bytes
            png_buffer = io.BytesIO()
            image.save(png_buffer, format='PNG')
            png_buffer.seek(0)

            return png_buffer.getvalue()

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to convert to PNG: {e}")

    @staticmethod
    def dicom_file_to_imaging_study(
        file_path: Path,
        patient_id: str,
        imaging_study_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Convert a DICOM file to a FHIR ImagingStudy resource.

        Args:
            file_path: Path to DICOM file
            patient_id: FHIR Patient ID
            imaging_study_id: Optional FHIR ImagingStudy ID

        Returns:
            FHIR ImagingStudy resource as dictionary
        """
        return DICOMToImagingStudyMapper.map_dicom_file_to_imaging_study(
            str(file_path), patient_id, imaging_study_id
        )

    @staticmethod
    def dicom_metadata_to_imaging_study(
        metadata: Dict[str, Any],
        patient_id: str,
        imaging_study_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Convert DICOM metadata to a FHIR ImagingStudy resource.

        Args:
            metadata: DICOM metadata dictionary
            patient_id: FHIR Patient ID
            imaging_study_id: Optional FHIR ImagingStudy ID

        Returns:
            FHIR ImagingStudy resource as dictionary
        """
        return DICOMToImagingStudyMapper.map_dicom_metadata_to_imaging_study(
            metadata, patient_id, imaging_study_id
        )

    @staticmethod
    def extract_dicom_metadata_extended(file_path: Path) -> Dict[str, Any]:
        """
        Extract comprehensive DICOM metadata including FHIR-relevant fields.

        Args:
            file_path: Path to DICOM file

        Returns:
            Comprehensive metadata dictionary
        """
        return DICOMToImagingStudyMapper.extract_dicom_metadata(str(file_path))

    @staticmethod
    def get_dicom_series_info(file_path: Path) -> Dict[str, Any]:
        """
        Extract FHIR series-level information from DICOM file.

        Args:
            file_path: Path to DICOM file

        Returns:
            Series information dictionary
        """
        metadata = DICOMToImagingStudyMapper.extract_dicom_metadata(str(file_path))
        return DICOMToImagingStudyMapper.extract_series_from_dicom_metadata(metadata)

    @staticmethod
    def get_dicom_instance_info(file_path: Path) -> Dict[str, Any]:
        """
        Extract FHIR instance-level information from DICOM file.

        Args:
            file_path: Path to DICOM file

        Returns:
            Instance information dictionary
        """
        metadata = DICOMToImagingStudyMapper.extract_dicom_metadata(str(file_path))
        return DICOMToImagingStudyMapper.extract_instance_from_dicom_metadata(metadata)

    @staticmethod
    def validate_dicom_for_fhir(file_path: Path) -> Dict[str, Any]:
        """
        Validate that DICOM file can be mapped to FHIR ImagingStudy.

        Args:
            file_path: Path to DICOM file

        Returns:
            Validation result with status, errors, warnings, and metadata
        """
        service = DICOMImagingStudyService()
        return service.validate_dicom_to_imaging_study_mapping(str(file_path))
