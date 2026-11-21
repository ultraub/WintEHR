"""Backend client for the control-plane sidecar (slice 10).

The sidecar (`control-plane/app.py`) is the only container with the Docker
socket. This client talks to it over the compose network with the shared
`CONTROL_PLANE_TOKEN`; the router exposes the result under
`/api/command-center/control/...` behind the usual admin / system gates.
Unset `CONTROL_PLANE_URL` or token → `configured=False` and the Control
tab explains how to enable it; an unreachable sidecar → 503, never a 500.
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional

import httpx
from fastapi import HTTPException


class ControlPlaneClient:
    def __init__(self, base_url: Optional[str] = None, token: Optional[str] = None, timeout: float = 30.0,
                 transport: Optional[httpx.AsyncBaseTransport] = None):
        self.base_url = (base_url if base_url is not None else os.getenv("CONTROL_PLANE_URL", "")).rstrip("/")
        self.token = token if token is not None else os.getenv("CONTROL_PLANE_TOKEN", "")
        self.timeout = timeout
        self._transport = transport

    @property
    def configured(self) -> bool:
        return bool(self.base_url and self.token)

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout, transport=self._transport,
                                 headers={"Authorization": f"Bearer {self.token}"})

    async def request(self, method: str, path: str, params: Optional[Dict[str, Any]] = None,
                      json: Optional[Dict[str, Any]] = None, timeout: Optional[float] = None) -> Any:
        if not self.configured:
            raise HTTPException(status_code=503, detail="Control plane is not configured: set CONTROL_PLANE_URL and CONTROL_PLANE_TOKEN and start the control-plane service")
        try:
            async with self._client() as client:
                resp = await client.request(method, path, params=params, json=json, timeout=timeout if timeout is not None else self.timeout)
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=503, detail=f"Control plane sidecar unreachable: {exc.__class__.__name__}") from exc
        if resp.status_code >= 400:
            try:
                detail = resp.json().get("detail", resp.text)
            except ValueError:
                detail = resp.text
            raise HTTPException(status_code=resp.status_code, detail=f"Control plane: {detail}")
        return resp.json() if resp.content else None

    async def get(self, path: str, params: Optional[Dict[str, Any]] = None, timeout: Optional[float] = None) -> Any:
        return await self.request("GET", path, params, timeout=timeout)

    async def post(self, path: str, json: Optional[Dict[str, Any]] = None) -> Any:
        return await self.request("POST", path, json=json)


_default_client: Optional[ControlPlaneClient] = None


def default_control_plane() -> ControlPlaneClient:
    global _default_client
    if _default_client is None:
        _default_client = ControlPlaneClient()
    return _default_client


def use_control_plane(client: Optional[ControlPlaneClient]) -> None:
    global _default_client
    _default_client = client
