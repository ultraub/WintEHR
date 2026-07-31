#!/usr/bin/env python3
"""Bridge: STOW Synthea-generated DICOM into dcm4chee, normalizing the
malformed urn:oid: StudyInstanceUID to a bare OID so the viewer proxy matches."""
import glob, os, sys, uuid, warnings
from io import BytesIO
import pydicom, requests
warnings.filterwarnings("ignore")

DICOM_BASE = "/app/data/generated_dicoms"
# DICOM_QIDO_URL = http://arc:8080/dcm4chee-arc/aets/DCM4CHEE/rs/  -> STOW at {rs}/studies
QIDO = os.getenv("DICOM_QIDO_URL", "http://arc:8080/dcm4chee-arc/aets/DCM4CHEE/rs/").rstrip("/")
STOW_URL = QIDO + "/studies"

def norm_uid(v):
    v = str(v or "").strip()
    return v[len("urn:oid:"):] if v.startswith("urn:oid:") else v

def stow_study(study_dir):
    files = sorted(glob.glob(os.path.join(study_dir, "*", "*.dcm")))
    if not files:
        return None, 0, "no files"
    parts = []
    suid = None
    for f in files:
        ds = pydicom.dcmread(f, force=True)
        ds.StudyInstanceUID = norm_uid(ds.StudyInstanceUID)
        suid = ds.StudyInstanceUID
        buf = BytesIO(); ds.save_as(buf, write_like_original=False)
        parts.append(buf.getvalue())
    boundary = "DCMBOUND" + uuid.uuid4().hex
    body = b""
    for data in parts:
        body += ("--" + boundary + "\r\n").encode()
        body += b"Content-Type: application/dicom\r\n\r\n"
        body += data + b"\r\n"
    body += ("--" + boundary + "--\r\n").encode()
    headers = {
        "Content-Type": "multipart/related; type=\"application/dicom\"; boundary=" + boundary,
        "Accept": "application/dicom+json",
    }
    r = requests.post(STOW_URL, data=body, headers=headers, timeout=120)
    return suid, len(parts), "%d %s" % (r.status_code, r.text[:120].replace(chr(10)," "))

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    dirs = sorted(d for d in glob.glob(os.path.join(DICOM_BASE, "study_*")) if os.path.isdir(d))
    if limit: dirs = dirs[:limit]
    print("STOW target:", STOW_URL)
    print("studies to upload:", len(dirs))
    ok = fail = 0
    for i, d in enumerate(dirs, 1):
        try:
            suid, n, status = stow_study(d)
            good = status.startswith("200") or status.startswith("202")
            ok += good; fail += (not good)
            if (not good) or i <= 3 or i == len(dirs):
                print("[%d/%d] %s files=%d suid=%s -> %s" % (i, len(dirs), os.path.basename(d), n, suid, status))
        except Exception as e:
            fail += 1; print("[%d/%d] %s ERROR %s" % (i, len(dirs), os.path.basename(d), e))
    print("DONE ok=%d fail=%d" % (ok, fail))

if __name__ == "__main__":
    main()
