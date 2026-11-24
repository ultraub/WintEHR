"""Which DICOM instances are images the built-in viewer can draw.

Structured reports (SR), segmentations (SEG), key object selections,
presentation states, encapsulated documents and raw data share a study with
the images they describe. The viewer renders every instance it is given as a
slice, so these would show up as broken frames. Dependency-free: used by the
DICOM router.
"""

# SOP Class UID prefixes for non-image storage classes (DICOM PS3.4 B.5).
NON_IMAGE_SOP_CLASS_PREFIXES = (
    "1.2.840.10008.5.1.4.1.1.88.",     # Structured Reporting (incl. Key Object Selection, TID 1500 SR)
    "1.2.840.10008.5.1.4.1.1.66.",     # Spatial Registration, Segmentation (.66.4), Surface Seg
    "1.2.840.10008.5.1.4.1.1.11.",     # Presentation States
    "1.2.840.10008.5.1.4.1.1.104.",    # Encapsulated PDF, CDA, STL, ...
    "1.2.840.10008.5.1.4.1.1.481.",    # Radiotherapy objects, RT Dose included (RT Image is an exception below)
    "1.2.840.10008.5.1.4.1.1.9.",      # Waveforms
)
# Exact non-image classes that have no shared prefix.
NON_IMAGE_SOP_CLASSES = {"1.2.840.10008.5.1.4.1.1.66"}  # Raw Data Storage
# Classes inside a non-image prefix that are images the viewer can draw.
IMAGE_SOP_CLASS_EXCEPTIONS = {"1.2.840.10008.5.1.4.1.1.481.1"}  # RT Image Storage
# A best-effort guard, used only when an instance has no SOP Class UID.
NON_IMAGE_MODALITIES = {
    "SR", "SEG", "KO", "PR", "DOC", "REG",
    "RTSTRUCT", "RTPLAN", "RTDOSE", "RTRECORD",
    "ECG", "HD", "EPS", "AU",  # waveforms
}


def is_image_instance(sop_class_uid: str, modality: str = "") -> bool:
    """False for a known non-image class. Unknown classes count as images.

    The class lists are not exhaustive: they cover what a teaching archive
    usually holds next to its images.

    The modality is a fallback for an instance with no SOP Class UID: a
    scanned document stored as Secondary Capture with Modality DOC is still
    an image.
    """
    sop_class_uid = (sop_class_uid or "").strip()
    if not sop_class_uid:
        return (modality or "").strip().upper() not in NON_IMAGE_MODALITIES
    if sop_class_uid in IMAGE_SOP_CLASS_EXCEPTIONS:
        return True
    if sop_class_uid in NON_IMAGE_SOP_CLASSES:
        return False
    return not any(sop_class_uid.startswith(prefix) for prefix in NON_IMAGE_SOP_CLASS_PREFIXES)
