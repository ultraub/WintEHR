#!/usr/bin/env python3
"""
DICOM Service API
HTTP endpoints for DICOM file access and metadata. Business logic, the
shared async HTTP client, and the multipart/related parser live in
api/dicom/service.py.
"""

import io
import logging
import zipfile
from email.message import Message
from typing import Optional
from urllib.parse import urljoin

import httpx
import pydicom
from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import StreamingResponse

from api.dicom.service import (
    DICOMService,
    _get_wado_url,
    _is_dicom_server_configured,
    get_dicom_http_client,
    parse_multipart_related,
    validate_uid,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dicom", tags=["dicom"])


def _content_disposition_params(value: str) -> dict:
    """Parse Content-Disposition parameters into a lowercase-keyed dict.

    Drop-in replacement for the params half of ``cgi.parse_header`` (the cgi
    module was removed from the stdlib in Python 3.13).
    """
    msg = Message()
    msg["Content-Disposition"] = value
    return {key.lower(): val for key, val in msg.get_params(header="content-disposition")[1:]}


@router.get("/studies")
async def list_dicom_studies(
    patient_id: Optional[str] = Query(None, description="Filter by PatientID"),
    study_uid: Optional[str] = Query(None, description="Filter by StudyInstanceUID"),
    modality: Optional[str] = Query(None, description="Filter by Modality"),
    limit: int = Query(100, description="Maximum number of results")
):
    """
    List available DICOM studies from DICOM server via QIDO-RS.

    Requires DICOM_QIDO_URL and DICOM_WADO_URL to be configured.

    Query Parameters:
        patient_id: Filter by PatientID
        study_uid: Filter by StudyInstanceUID
        modality: Filter by Modality
        limit: Maximum number of results
    """
    try:
        if not _is_dicom_server_configured():
            raise HTTPException(
                status_code=503,
                detail="DICOM server not configured. Set DICOM_QIDO_URL and DICOM_WADO_URL environment variables."
            )

        logger.info(f"Querying QIDO-RS for studies (patient_id={patient_id}, modality={modality})")
        qido_studies = await DICOMService.query_qido_studies(
            patient_id=patient_id,
            study_instance_uid=study_uid,
            modality=modality,
            limit=limit
        )

        studies = []
        # Parse QIDO-RS response (DICOM JSON format)
        for study in qido_studies:
            # DICOM JSON format uses tag hex keys, extract values carefully
            study_info = {
                "studyInstanceUID": DICOMService._get_dicom_json_value(study, "00200010", "StudyInstanceUID", ""),
                "studyDescription": DICOMService._get_dicom_json_value(study, "00081030", "StudyDescription", ""),
                "modality": DICOMService._get_dicom_json_value(study, "00080061", "Modality", ""),
                "patientName": DICOMService._get_dicom_json_value(study, "00100010", "PatientName", ""),
                "patientID": DICOMService._get_dicom_json_value(study, "00100020", "PatientID", ""),
                "studyDate": DICOMService._get_dicom_json_value(study, "00080020", "StudyDate", ""),
                "source": "dicom-server"
            }
            studies.append(study_info)

        logger.info(f"Found {len(studies)} studies from QIDO-RS")
        return {"studies": studies, "source": "dicom-server"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list DICOM studies: {e}")
        raise HTTPException(status_code=503, detail=f"Failed to query DICOM server: {e}")


@router.get("/studies/{study_uid}/metadata")
async def get_study_metadata(
    study_uid: str,
    series_uid: Optional[str] = Query(None, description="Filter by SeriesInstanceUID")
):
    """
    Get metadata for instances in a study via WADO-RS.
    Optionally filter by series.
    """
    try:
        study_uid = validate_uid(study_uid, "study")

        if not _is_dicom_server_configured():
            raise HTTPException(
                status_code=503,
                detail="DICOM server not configured"
            )

        logger.info(f"Fetching metadata for study {study_uid}")

        # Query WADO for studies to list series
        wado_studies_url = urljoin(_get_wado_url(), f"studies/{study_uid}/instances")

        client = get_dicom_http_client()
        response = await client.get(
            wado_studies_url,
            headers={"Accept": "application/dicom+json"},
            timeout=30
        )
        response.raise_for_status()
        study_data = response.json() if response.content else {}

        instances = []

        for instance in study_data:
            series_uid_value = DICOMService._get_dicom_json_value(instance, "0020000E", "SeriesInstanceUID", "")

            # Skip if filtering by series UID and this isn't it
            if series_uid and series_uid_value != series_uid:
                continue
            try:
                number_of_frames = int(
                    DICOMService._get_dicom_json_value(instance, "00280008", "NumberOfFrames", 1) or 1
                )
            except (TypeError, ValueError):
                number_of_frames = 1
            metadata = {
                "studyInstanceUID": study_uid,
                "seriesInstanceUID": series_uid_value,
                "sopInstanceUID": DICOMService._get_dicom_json_value(instance, "00080018", "SOPInstanceUID", ""),
                "instanceNumber": DICOMService._get_dicom_json_value(instance, "00200013", "InstanceNumber", "1"),
                "modality": DICOMService._get_dicom_json_value(instance, "00080060", "Modality", ""),
                # Number of frames in this instance (e.g. ultrasound/echo cine
                # loops have many); 1 for single-frame. Drives frame playback.
                "numberOfFrames": number_of_frames,
            }
            instances.append(metadata)

        logger.info(f"Found {len(instances)} instances for study {study_uid}")
        return {"instances": instances, "studyInstanceUID": study_uid}

    except HTTPException:
        raise
    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch metadata from DICOM server: {e}")
        raise HTTPException(status_code=503, detail=f"Failed to fetch metadata from DICOM server: {e}")
    except Exception as e:
        logger.error(f"Failed to get study metadata: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get study metadata: {e}")


##
@router.get("/studies/{study_uid}/series/{series_uid}/instances/{sop_instance_uid}/image")
async def get_instance_image(
    study_uid: str,
    series_uid: str,
    sop_instance_uid: str,
    window_center: int = Query(128, description="Window center for display"),
    window_width: int = Query(256, description="Window width for display"),
    frame: int = Query(1, ge=1, description="1-based frame number for multi-frame instances")
):
    """
    Get image data for a specific DICOM instance via WADO.
    Returns PNG image with applied windowing (grayscale single-frame), or a
    PACS-rendered JPEG of the requested frame (color / multi-frame, e.g. echo).
    """
    try:
        study_uid = validate_uid(study_uid, "study")
        series_uid = validate_uid(series_uid, "series")
        sop_instance_uid = validate_uid(sop_instance_uid, "instance")

        if not _is_dicom_server_configured():
            raise HTTPException(
                status_code=503,
                detail="DICOM server not configured"
            )

        logger.info(f"Fetching instance {sop_instance_uid} via WADO")

        # Fetch DICOM instance from WADO
        dicom_data = await DICOMService.fetch_wado_instance(
            study_uid, series_uid, sop_instance_uid
        )

        # Parse DICOM data
        ds = pydicom.dcmread(io.BytesIO(dicom_data), force=True)

        samples = int(getattr(ds, "SamplesPerPixel", 1) or 1)
        frames = int(getattr(ds, "NumberOfFrames", 1) or 1)

        # Grayscale single-frame (e.g. CT): window/level locally so the viewer's
        # window_center/width controls stay interactive. Color or multi-frame
        # instances (e.g. ultrasound/echo cine loops) can't be windowed as
        # grayscale — defer to the PACS renderer below, which decodes JPEG/color
        # and returns an animated GIF for cine.
        if samples == 1 and frames == 1 and hasattr(ds, "pixel_array"):
            try:
                pixel_array = ds.pixel_array
                if hasattr(ds, 'RescaleSlope') and hasattr(ds, 'RescaleIntercept'):
                    pixel_array = pixel_array * float(ds.RescaleSlope) + float(ds.RescaleIntercept)
                image_data = DICOMService.convert_to_png(pixel_array, window_center, window_width)
                logger.info(f"Successfully retrieved image for instance {sop_instance_uid}")
                return Response(content=image_data, media_type="image/png")
            except Exception as conv_err:
                logger.info(
                    f"Local windowing unavailable for {sop_instance_uid} ({conv_err}); "
                    f"falling back to WADO-RS rendered"
                )

        rendered = await DICOMService.fetch_wado_rendered(study_uid, series_uid, sop_instance_uid, frame=frame)
        logger.info(f"Returned PACS-rendered image for instance {sop_instance_uid} frame {frame}")
        return Response(content=rendered["content"], media_type=rendered["content_type"])

    except HTTPException:
        raise
    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch instance from DICOM server: {e}")
        raise HTTPException(status_code=503, detail=f"Failed to fetch instance from DICOM server: {e}")
    except Exception as e:
        logger.error(f"Failed to get instance image: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get instance image: {e}")


@router.get("/studies/{study_uid}/series/{series_uid}/download")
async def download_series(study_uid: str, series_uid: str):
    """
    Download DICOM series via WADO.
    Note: Returns series instances; full bulk ZIP download may require
    multiple requests depending on DICOMweb server capabilities.
    """
    try:
        study_uid = validate_uid(study_uid, "study")
        series_uid = validate_uid(series_uid, "series")

        if not _is_dicom_server_configured():
            raise HTTPException(
                status_code=503,
                detail="DICOM server not configured"
            )

        logger.info(f"Preparing series {series_uid} for download from study {study_uid}")

        # Build WADO URL for series
        wado_series_url = urljoin(
            _get_wado_url(),
            f"studies/{study_uid}/series/{series_uid}"
        )

        client = get_dicom_http_client()
        response = await client.get(
            wado_series_url,
            headers={"Accept": "application/dicom"},
            timeout=60
        )
        response.raise_for_status()

        logger.info(f"Successfully retrieved series {series_uid}")
        return StreamingResponse(
            iter([response.content]),
            media_type="application/dicom",
            headers={"Content-Disposition": f"attachment; filename=series_{series_uid}.dcm"}
        )

    except HTTPException:
        raise
    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch series from DICOM server: {e}")
        raise HTTPException(status_code=503, detail=f"Failed to fetch series from DICOM server: {e}")
    except Exception as e:
        logger.error(f"Failed to download series: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to download series: {e}")


@router.get("/studies/{study_uid}/download")
async def download_study(study_uid: str):
    """
    Download DICOM study via WADO.
    Note: Returns study instances; full bulk ZIP download may require
    multiple requests depending on DICOMweb server capabilities.
    """
    try:
        study_uid = validate_uid(study_uid, "study")

        if not _is_dicom_server_configured():
            raise HTTPException(
                status_code=503,
                detail="DICOM server not configured"
            )

        logger.info(f"Preparing for download of study {study_uid}")

        # Build WADO URL for study
        wado_study_url = urljoin(
            _get_wado_url(),
            f"studies/{study_uid}"
        )

        client = get_dicom_http_client()
        response = await client.get(
            wado_study_url,
            timeout=60
        )
        response.raise_for_status()

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
            multipart_parts = parse_multipart_related(
                response.content, response.headers.get("content-type", "")
            )
            part_index = 1

            # Need to check for files as well as parts
            if multipart_parts:
                for part in multipart_parts:
                    filename = None
                    content_disposition = part.headers.get(b"Content-Disposition", b"").decode("utf-8", errors="ignore")
                    if content_disposition:
                        params = _content_disposition_params(content_disposition)
                        filename = params.get("filename") or params.get("name")

                    if not filename:
                        filename = f"{part_index}.dcm"

                    archive.writestr(filename, part.content)
                    part_index += 1
            else:
                archive.writestr(f"study_{study_uid}.dcm", response.content)

        zip_buffer.seek(0)
        response_content = zip_buffer.getvalue()

        logger.info(f"Successfully retrieved study {study_uid}")
        return StreamingResponse(
            iter([response_content]),
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=study_{study_uid}.zip"}
        )

    except HTTPException:
        raise
    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch study from DICOM server: {e}")
        raise HTTPException(status_code=503, detail=f"Failed to fetch study from DICOM server: {e}")
    except Exception as e:
        logger.error(f"Failed to download study: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to download study: {e}")


@router.get("/studies/{study_uid}/viewer-config")
async def get_viewer_config(
    study_uid: str,
    series_uid: Optional[str] = Query(None, description="Filter by SeriesInstanceUID")
):
    """
    Get configuration for DICOM viewer (Cornerstone 3D compatible).
    Fetches instance list via WADO and generates viewer URLs.
    """
    try:
        study_uid = validate_uid(study_uid, "study")

        if not _is_dicom_server_configured():
            raise HTTPException(
                status_code=503,
                detail="DICOM server not configured"
            )

        logger.info(f"Generating viewer config for study {study_uid}")

        # Get metadata which includes instance UIDs
        metadata_response = await get_study_metadata(study_uid, series_uid)
        instances = metadata_response.get("instances", [])

        if not instances:
            raise HTTPException(
                status_code=404,
                detail="No instances found for this study"
            )

        # Generate Cornerstone viewer configuration
        viewer_instances = []
        for instance in instances:
            instance_url = f"/api/dicom/studies/{study_uid}/series/{instance['seriesInstanceUID']}/instances/{instance['sopInstanceUID']}/image"
            viewer_instances.append({
                "studyInstanceUID": study_uid,
                "seriesInstanceUID": instance['seriesInstanceUID'],
                "sopInstanceUID": instance['sopInstanceUID'],
                "imageUrl": instance_url,
                "instanceNumber": instance.get('instanceNumber', '1')
            })

        config = {
            "studyInstanceUID": study_uid,
            "modality": instances[0].get("modality", ""),
            "instances": viewer_instances,
            "viewerSettings": {
                "enableStackScrolling": True,
                "enableWindowLevel": True,
                "enableZoom": True,
                "enablePan": True,
                "enableRotation": True
            }
        }

        return config

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get viewer config: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get viewer config: {e}")


# FHIR ImagingStudy Mapping Endpoints

@router.get("/studies/{study_uid}/fhir-imaging-study")
async def get_study_as_fhir_imaging_study(
    study_uid: str,
    patient_id: str = Query(..., description="FHIR Patient ID"),
    imaging_study_id: Optional[str] = Query(None, description="Optional FHIR ImagingStudy ID")
):
    """
    Convert DICOM study to FHIR ImagingStudy resource via WADO metadata.

    Args:
        study_uid: DICOM StudyInstanceUID
        patient_id: FHIR Patient ID
        imaging_study_id: Optional FHIR ImagingStudy ID

    Returns:
        FHIR ImagingStudy resource
    """
    try:
        study_uid = validate_uid(study_uid, "study")

        if not _is_dicom_server_configured():
            raise HTTPException(
                status_code=503,
                detail="DICOM server not configured"
            )

        logger.info(f"Converting study {study_uid} to FHIR ImagingStudy for patient {patient_id}")

        # Fetch metadata for the study
        metadata_response = await get_study_metadata(study_uid)
        instances = metadata_response.get("instances", [])

        if not instances:
            raise HTTPException(
                status_code=404,
                detail="No instances found in study"
            )

        # Build basic FHIR ImagingStudy from metadata
        imaging_study = {
            "resourceType": "ImagingStudy",
            "id": imaging_study_id or study_uid.replace(".", "-"),
            "status": "available",
            "subject": {
                "reference": f"Patient/{patient_id}"
            },
            "studyInstanceUID": study_uid,
            "series": []
        }

        # Group instances by series
        series_map = {}
        for instance in instances:
            series_uid = instance.get("seriesInstanceUID", "")
            if series_uid not in series_map:
                series_map[series_uid] = {
                    "uid": series_uid,
                    "modality": instance.get("modality", ""),
                    "instances": []
                }
            series_map[series_uid]["instances"].append(instance)

        # Convert series to FHIR format
        for series_uid, series_data in series_map.items():
            series_fhir = {
                "uid": series_uid,
                "modality": {"system": "http://dicom.nema.org/resources/ontology/DCM", "code": series_data["modality"]},
                "instance": [
                    {
                        "uid": inst.get("sopInstanceUID", ""),
                        "number": inst.get("instanceNumber", 1)
                    }
                    for inst in series_data["instances"]
                ]
            }
            imaging_study["series"].append(series_fhir)

        logger.info(f"Successfully converted study to FHIR ImagingStudy with {len(imaging_study['series'])} series")
        return imaging_study

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to convert to FHIR ImagingStudy: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to convert to FHIR ImagingStudy: {e}")


@router.get("/studies/{study_uid}/validate-fhir")
async def validate_study_for_fhir(study_uid: str):
    """
    Validate that DICOM study can be mapped to FHIR ImagingStudy resources via WADO.

    Args:
        study_uid: DICOM StudyInstanceUID

    Returns:
        Validation results indicating FHIR compatibility
    """
    try:
        study_uid = validate_uid(study_uid, "study")

        if not _is_dicom_server_configured():
            raise HTTPException(
                status_code=503,
                detail="DICOM server not configured"
            )

        logger.info(f"Validating study {study_uid} for FHIR compatibility")

        # Fetch metadata for all instances
        metadata_response = await get_study_metadata(study_uid)
        instances = metadata_response.get("instances", [])

        if not instances:
            raise HTTPException(
                status_code=404,
                detail="No instances found in study"
            )

        # Check for required FHIR fields
        required_fields = ["studyInstanceUID", "seriesInstanceUID", "sopInstanceUID", "modality"]
        validation_results = []

        for instance in instances:
            missing_fields = [f for f in required_fields if not instance.get(f)]
            result = {
                "sopInstanceUID": instance.get("sopInstanceUID", ""),
                "valid": len(missing_fields) == 0,
                "missingFields": missing_fields
            }
            validation_results.append(result)

        # Summary
        valid_count = sum(1 for r in validation_results if r.get("valid"))
        total_count = len(validation_results)

        return {
            "valid": valid_count == total_count,
            "summary": {
                "totalInstances": total_count,
                "validInstances": valid_count,
                "invalidInstances": total_count - valid_count
            },
            "results": validation_results
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to validate DICOM for FHIR: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to validate DICOM for FHIR: {e}")
