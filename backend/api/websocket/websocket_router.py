"""WebSocket router for real-time FHIR updates."""

import uuid
import logging
import os
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .connection_manager import manager
from api.auth.service import AuthService, get_auth_service
from api.auth.jwt_handler import verify_token

logger = logging.getLogger(__name__)
router = APIRouter()

# Check if JWT is enabled
JWT_ENABLED = os.getenv("JWT_ENABLED", "false").lower() == "true"

# Optional security for WebSocket connections
security = HTTPBearer(auto_error=False)


async def get_current_user_ws(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
) -> Optional[dict]:
    """Get current user from WebSocket connection."""
    if not token:
        return None
        
    try:
        payload = verify_token(token)
        return payload
    except Exception:
        return None


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None)  # Keep for backward compatibility
):
    """Main WebSocket endpoint for real-time FHIR updates."""
    # Generate a unique client ID
    client_id = str(uuid.uuid4())
    
    # Accept connection first
    await websocket.accept()
    
    # Handle authentication based on JWT_ENABLED setting
    user = None
    if not JWT_ENABLED:
        # Simple mode: allow connections without authentication
        user = {"username": "demo", "role": "user"}  # Default user for simple mode
        logger.info("WebSocket connected in simple mode (JWT disabled)")
    elif token:
        # JWT mode with token in query
        user = await get_current_user_ws(websocket, token)
        if not user:
            await websocket.close(code=4001, reason="Unauthorized")
            return
    else:
        # JWT mode: wait for authentication message
        try:
            auth_msg = await websocket.receive_json()
            if auth_msg.get('type') == 'authenticate' and auth_msg.get('token'):
                payload = verify_token(auth_msg['token'])
                user = payload
                # Send auth success message
                await websocket.send_json({
                    'type': 'auth_success',
                    'message': 'Authentication successful'
                })
            else:
                await websocket.close(code=4001, reason="Authentication required")
                return
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            await websocket.close(code=4001, reason="Authentication failed")
            return
        
    try:
        await manager.connect(client_id, websocket)
        
        # Send welcome message with client ID
        await websocket.send_json({
            "type": "welcome",
            "data": {
                "client_id": client_id,
                "user": user
            }
        })
        
        # Listen for messages
        while True:
            data = await websocket.receive_json()
            await manager.handle_message(client_id, data)
            
    except WebSocketDisconnect:
        manager.disconnect(client_id)
        logger.info(f"Client {client_id} disconnected normally")
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        manager.disconnect(client_id)
        

@router.websocket("/ws/{client_id}")
async def websocket_reconnect(
    websocket: WebSocket,
    client_id: str,
    token: Optional[str] = Query(None)
):
    """Reconnection endpoint for existing clients."""
    # Optional: Verify authentication
    user = await get_current_user_ws(websocket, token)
    if token and not user:
        await websocket.close(code=4001, reason="Unauthorized")
        return
        
    try:
        # Accept connection with existing client ID
        await manager.connect(client_id, websocket)
        
        # Send welcome message
        await websocket.send_json({
            "type": "welcome",
            "data": {
                "client_id": client_id,
                "user": user,
                "reconnected": True
            }
        })
        
        # Listen for messages
        while True:
            data = await websocket.receive_json()
            await manager.handle_message(client_id, data)
            
    except WebSocketDisconnect:
        manager.disconnect(client_id)
        logger.info(f"Client {client_id} disconnected normally")
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        manager.disconnect(client_id)