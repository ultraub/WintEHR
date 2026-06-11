#!/usr/bin/env python3
"""
STOW generated DICOM files into the dcm4chee VNA.

The imaging viewer (backend/api/dicom/dicom_service.py) is a read-only proxy to
a DICOMweb server (QIDO/WADO). `generate_dicom_from_hapi.py` only writes .dcm
files to /app/data/generated_dicoms/ — it does not load them into the PACS, so
without this step the Imaging tab lists studies but renders no images.

This script uploads every generated study into dcm4chee via STOW-RS, normalizing
the StudyInstanceUID to a bare OID (FHIR ImagingStudy identifiers carry it as
urn:oid:<oid>, which is not a valid DICOM UI value). STOW is idempotent — dcm4chee
de-duplicates by SOPInstanceUID — so re-running is safe.

Usage:
    # Inside the backend container (deploy.sh style)
    python scripts/active/stow_dicom_to_dcm4chee.py

    # Limit how many studies to upload (smoke test)
    python scripts/active/stow_dicom_to_dcm4chee.py --max-studies 1
"""

import argparse
import glob
import logging
import os
import sys
import uuid
import warnings
from io import BytesIO

import requests

warnings.filterwarnings("ignore")

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

try:
    import pydicom
    DICOM_AVAILABLE = True
except ImportError:
    DICOM_AVAILABLE = False


def normalize_uid(value):
    """Strip a urn:oid: prefix so the value is a bare DICOM OID."""
    value = str(value or "").strip()
    return value[len("urn:oid:"):] if value.startswith("urn:oid:") else value


def stow_url_from_qido(qido_url):
    """Derive the STOW-RS studies endpoint from the configured QIDO base."""
    return qido_url.rstrip("/") + "/studies"


def stow_study(study_dir, stow_url, timeout=120):
    """STOW every instance in a study directory as one multipart/related POST."""
    files = sorted(glob.glob(os.path.join(study_dir, "*", "*.dcm")))
    if not files:
        return None, 0, "no .dcm files"

    parts, study_uid = [], None
    for path in files:
        ds = pydicom.dcmread(path, force=True)
        ds.StudyInstanceUID = normalize_uid(ds.StudyInstanceUID)
        study_uid = ds.StudyInstanceUID
        buf = BytesIO()
        ds.save_as(buf, write_like_original=False)
        parts.append(buf.getvalue())

    boundary = "DCMBOUND" + uuid.uuid4().hex
    body = b""
    for data in parts:
        body += ("--" + boundary + "\r\n").encode()
        body += b"Content-Type: application/dicom\r\n\r\n"
        body += data + b"\r\n"
    body += ("--" + boundary + "--\r\n").encode()

    headers = {
        "Content-Type": 'multipart/related; type="application/dicom"; boundary=' + boundary,
        "Accept": "application/dicom+json",
    }
    resp = requests.post(stow_url, data=body, headers=headers, timeout=timeout)
    return study_uid, len(parts), "%d" % resp.status_code


def main():
    parser = argparse.ArgumentParser(
        description="STOW generated DICOM files into the dcm4chee VNA")
    parser.add_argument("--dicom-dir", default="/app/data/generated_dicoms",
                        help="Directory of generated study_* dirs")
    parser.add_argument("--qido-url",
                        default=os.getenv("DICOM_QIDO_URL",
                                          "http://arc:8080/dcm4chee-arc/aets/DCM4CHEE/rs/"),
                        help="QIDO-RS base URL (STOW is {base}/studies)")
    parser.add_argument("--max-studies", type=int,
                        help="Upload at most N studies")
    args = parser.parse_args()

    if not DICOM_AVAILABLE:
        logger.error("❌ pydicom is not installed - cannot STOW DICOM")
        return 1

    stow_url = stow_url_from_qido(args.qido_url)
    dirs = sorted(d for d in glob.glob(os.path.join(args.dicom_dir, "study_*"))
                  if os.path.isdir(d))
    if args.max_studies:
        dirs = dirs[:args.max_studies]

    logger.info("STOW target: %s", stow_url)
    logger.info("Studies to upload: %d", len(dirs))

    ok = fail = 0
    for i, d in enumerate(dirs, 1):
        try:
            study_uid, n, status = stow_study(d, stow_url)
            good = status.startswith(("200", "202"))
            ok += good
            fail += not good
            if not good:
                logger.warning("[%d/%d] %s -> HTTP %s", i, len(dirs),
                               os.path.basename(d), status)
            elif i == 1 or i == len(dirs):
                logger.info("[%d/%d] %s files=%d suid=%s -> %s", i, len(dirs),
                            os.path.basename(d), n, study_uid, status)
        except Exception as e:  # noqa: BLE001 - keep going, report at end
            fail += 1
            logger.warning("[%d/%d] %s ERROR %s", i, len(dirs),
                           os.path.basename(d), e)

    logger.info("✅ STOW complete: ok=%d fail=%d", ok, fail)
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
