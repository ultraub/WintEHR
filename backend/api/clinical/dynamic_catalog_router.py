"""
Dynamic Catalog Router - Compatibility Layer

This router provides backward compatibility for the old dynamic-catalog endpoints
by redirecting them to the new unified catalog endpoints at /api/catalogs/*
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import RedirectResponse
from typing import Optional

router = APIRouter(prefix="/api/clinical/dynamic-catalog", tags=["Dynamic Catalog (Legacy)"])


@router.get("/medications")
async def redirect_medications(
    search: Optional[str] = Query(None),
    limit: int = Query(50)
):
    """
    Redirect to new medications catalog endpoint.
    Legacy endpoint for backward compatibility.
    """
    # Build query string
    params = []
    if search:
        params.append(f"search={search}")
    params.append(f"limit={limit}")
    query_string = "&".join(params)
    
    # Return redirect to new endpoint
    return RedirectResponse(
        url=f"/api/catalogs/medications?{query_string}",
        status_code=307  # Temporary redirect
    )


@router.get("/lab-tests")
async def redirect_lab_tests(
    search: Optional[str] = Query(None),
    limit: int = Query(50)
):
    """
    Redirect to new lab tests catalog endpoint.
    Legacy endpoint for backward compatibility.
    """
    params = []
    if search:
        params.append(f"search={search}")
    params.append(f"limit={limit}")
    query_string = "&".join(params)
    
    return RedirectResponse(
        url=f"/api/catalogs/lab-tests?{query_string}",
        status_code=307
    )


@router.get("/conditions")
async def redirect_conditions(
    search: Optional[str] = Query(None),
    limit: int = Query(50)
):
    """
    Redirect to new conditions catalog endpoint.
    Legacy endpoint for backward compatibility.
    """
    params = []
    if search:
        params.append(f"search={search}")
    params.append(f"limit={limit}")
    query_string = "&".join(params)
    
    return RedirectResponse(
        url=f"/api/catalogs/conditions?{query_string}",
        status_code=307
    )


@router.get("/procedures")
async def redirect_procedures(
    search: Optional[str] = Query(None),
    limit: int = Query(50)
):
    """
    Redirect to new procedures catalog endpoint.
    Legacy endpoint for backward compatibility.
    """
    # Since procedures might not be implemented in the new catalog yet,
    # return a proper error message
    raise HTTPException(
        status_code=501,
        detail="Procedures catalog not yet implemented. Please use /api/catalogs/procedures when available."
    )


@router.get("/search")
async def redirect_search(
    q: str = Query(...),
    limit_per_type: int = Query(10)
):
    """
    Redirect to new unified search endpoint.
    Legacy endpoint for backward compatibility.
    """
    return RedirectResponse(
        url=f"/api/catalogs/search?q={q}&limit_per_type={limit_per_type}",
        status_code=307
    )