"""Synthetic DICOM geometry: one Frame of Reference per series, z rising by slice thickness."""

import importlib.util
from io import BytesIO
from pathlib import Path

import pydicom
import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "active" / "generate_dicom_from_hapi.py"


@pytest.fixture(scope="module")
def gen_module():
    spec = importlib.util.spec_from_file_location("generate_dicom_from_hapi", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def make_study(series):
    return {
        "resourceType": "ImagingStudy",
        "id": "geo-1",
        "identifier": [{"system": "urn:dicom:uid", "value": "urn:oid:1.2.826.0.1.3680043.8.498.100"}],
        "subject": {"reference": "Patient/p1"},
        "started": "2026-01-02T03:04:05Z",
        "series": series,
    }


@pytest.fixture
def generated(gen_module, tmp_path, monkeypatch):
    generator = gen_module.HAPIFHIRDicomGenerator(hapi_url="http://unused.invalid/fhir", dicom_dir=tmp_path)
    monkeypatch.setattr(generator, "get_patient_name", lambda ref: "SYNTHETIC^PATIENT")
    study = make_study([
        {"uid": "1.2.826.0.1.3680043.8.498.101", "modality": {"code": "CT"}, "numberOfInstances": 6},
        {"uid": "1.2.826.0.1.3680043.8.498.102", "modality": {"code": "CT"}, "numberOfInstances": 4},
    ])
    assert generator.generate_dicom_for_study(study)
    by_series = {}
    for path in sorted(tmp_path.rglob("*.dcm")):
        ds = pydicom.dcmread(path)
        by_series.setdefault(ds.SeriesInstanceUID, []).append(ds)
    assert sorted(len(slices) for slices in by_series.values()) == [4, 6]
    return by_series


def test_one_frame_of_reference_per_series(generated):
    frames = {uid: {ds.FrameOfReferenceUID for ds in slices} for uid, slices in generated.items()}
    assert all(len(f) == 1 for f in frames.values())
    assert len({next(iter(f)) for f in frames.values()}) == 2
    for uid, f in frames.items():
        assert next(iter(f)) not in {uid, "1.2.826.0.1.3680043.8.498.100"}  # not the series or study UID


def test_z_rises_by_slice_thickness(generated):
    for slices in generated.values():
        slices.sort(key=lambda ds: int(ds.InstanceNumber))
        zs = [float(ds.ImagePositionPatient[2]) for ds in slices]
        thickness = float(slices[0].SliceThickness)
        assert thickness == 5.0
        assert zs[0] == 0.0
        assert all(float(ds.SliceThickness) == thickness for ds in slices)
        assert all(abs((b - a) - thickness) < 1e-6 for a, b in zip(zs, zs[1:]))
        assert [float(ds.SliceLocation) for ds in slices] == zs


def test_orientation_and_spacing_present(generated):
    for slices in generated.values():
        for ds in slices:
            assert [float(v) for v in ds.ImageOrientationPatient] == [1, 0, 0, 0, 1, 0]
            assert [float(v) for v in ds.PixelSpacing] == [0.7, 0.7]
            assert ds.Rows == 512 and ds.Columns == 512
            assert [float(v) for v in ds.ImagePositionPatient[:2]] == [-178.85, -178.85]
            assert ds.PositionReferenceIndicator == ""


def test_slice_geometry_is_centred(gen_module, tmp_path):
    generator = gen_module.HAPIFHIRDicomGenerator(hapi_url="http://unused.invalid/fhir", dicom_dir=tmp_path)
    geo = gen_module.slice_geometry(generator.modality_configs["CT"], 3)
    # Pixel centres run from -178.85 to +178.85 mm across 512 pixels of 0.7 mm.
    assert geo["ImagePositionPatient"] == [-178.85, -178.85, 15.0]
    assert geo["SliceLocation"] == 15.0


def test_slice_geometry_keeps_rows_and_columns_apart(gen_module):
    # 640 rows of 0.3 mm, 480 columns of 0.2 mm: x follows columns, y follows rows.
    # 3 slices of 0.3 mm is 0.8999999999999999 unrounded.
    config = {"size": (640, 480), "pixel_spacing": (0.3, 0.2), "slice_thickness": 0.3}
    geo = gen_module.slice_geometry(config, 3)
    assert geo["ImagePositionPatient"] == [-47.9, -95.85, 0.9]
    assert geo["SliceLocation"] == 0.9
    assert geo["PixelSpacing"] == [0.3, 0.2]
    assert geo["SliceThickness"] == 0.3


def test_frame_of_reference_is_stable_across_runs(gen_module, tmp_path, monkeypatch):
    uids = []
    for run in ("a", "b"):
        out = tmp_path / run
        generator = gen_module.HAPIFHIRDicomGenerator(hapi_url="http://unused.invalid/fhir", dicom_dir=out)
        monkeypatch.setattr(generator, "get_patient_name", lambda ref: "SYNTHETIC^PATIENT")
        assert generator.generate_dicom_for_study(make_study([
            {"uid": "1.2.826.0.1.3680043.8.498.101", "modality": {"code": "MR"}, "numberOfInstances": 2},
        ]))
        uids.append({pydicom.dcmread(p).FrameOfReferenceUID for p in out.rglob("*.dcm")})
    assert len(uids[0]) == 1 and uids[0] == uids[1]


@pytest.mark.parametrize("modality", ["CT", "MR", "XR", "CR", "DX", "US", "MG"])
def test_every_modality_writes_valid_ds_values(gen_module, tmp_path, modality):
    generator = gen_module.HAPIFHIRDicomGenerator(hapi_url="http://unused.invalid/fhir", dicom_dir=tmp_path)
    config = generator.modality_configs[modality]
    ds = pydicom.Dataset()
    for key, value in gen_module.slice_geometry(config, 29).items():
        setattr(ds, key, value)
    buffer = BytesIO()
    ds.save_as(buffer, implicit_vr=False, little_endian=True)
    back = pydicom.dcmread(BytesIO(buffer.getvalue()), force=True)
    for key in ("ImagePositionPatient", "ImageOrientationPatient", "PixelSpacing", "SliceThickness", "SliceLocation"):
        values = back[key].value
        for v in (values if isinstance(values, (list, pydicom.multival.MultiValue)) else [values]):
            assert len(str(v)) <= 16, f"{modality} {key} {v!r}"
    assert [float(v) for v in back.PixelSpacing] == list(config["pixel_spacing"])


def test_modality_not_in_the_table_gets_the_ct_geometry(gen_module, tmp_path, monkeypatch):
    generator = gen_module.HAPIFHIRDicomGenerator(hapi_url="http://unused.invalid/fhir", dicom_dir=tmp_path)
    monkeypatch.setattr(generator, "get_patient_name", lambda ref: "SYNTHETIC^PATIENT")
    assert "NM" not in generator.modality_configs
    assert generator.generate_dicom_for_study(make_study([
        {"uid": "1.2.826.0.1.3680043.8.498.103", "modality": {"code": "NM"}, "numberOfInstances": 1},
    ]))
    written = [pydicom.dcmread(p) for p in tmp_path.rglob("*.dcm")]
    assert len(written) == 1
    ds = written[0]
    assert ds.Modality == "NM"
    assert [float(v) for v in ds.PixelSpacing] == [0.7, 0.7]
    assert float(ds.SliceThickness) == 5.0
    assert [float(v) for v in ds.ImagePositionPatient] == [-178.85, -178.85, 0.0]
