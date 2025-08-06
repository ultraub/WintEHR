"""
WebSocket Monitoring and Statistics API

Provides endpoints for monitoring WebSocket connection health and performance.
"""

from fastapi import APIRouter, Depends
from typing import Dict, Any

from .connection_manager import manager
from api.auth import get_current_user

router = APIRouter(prefix="/api/websocket", tags=["WebSocket Monitoring"])


@router.get("/stats")
async def get_websocket_stats(
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get WebSocket connection pool statistics.
    
    Returns:
        - Total active connections
        - Connection pool utilization
        - Room statistics
        - Message throughput
        - Error counts
    """
    pool_stats = manager.pool.get_pool_stats()
    
    # Add subscription statistics
    total_subscriptions = sum(
        len(subs) for subs in manager.subscriptions.values()
    )
    
    subscription_stats = {
        "total_subscriptions": total_subscriptions,
        "clients_with_subscriptions": len(manager.subscriptions),
        "average_subscriptions_per_client": (
            total_subscriptions / len(manager.subscriptions)
            if manager.subscriptions else 0
        )
    }
    
    return {
        "pool": pool_stats,
        "subscriptions": subscription_stats,
        "health": {
            "status": "healthy" if pool_stats["total_connections"] > 0 else "idle",
            "pool_utilization_percent": pool_stats["utilization"] * 100
        }
    }


@router.get("/connections")
async def get_active_connections(
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get details about active WebSocket connections.
    
    Returns list of active connections with their metadata.
    """
    connections = []
    
    for client_id in manager.pool.connections:
        metrics = manager.pool.connection_metrics.get(client_id)
        state = manager.pool.connection_states.get(client_id)
        
        connection_info = {
            "client_id": client_id,
            "state": state.value if state else "unknown",
            "subscriptions": len(manager.subscriptions.get(client_id, [])),
            "rooms": list(manager.pool.client_rooms.get(client_id, set()))
        }
        
        if metrics:
            connection_info.update({
                "connected_since": metrics.connected_at.isoformat(),
                "last_activity": metrics.last_activity.isoformat(),
                "messages_sent": metrics.messages_sent,
                "messages_received": metrics.messages_received,
                "bytes_sent": metrics.bytes_sent,
                "bytes_received": metrics.bytes_received,
                "errors": metrics.errors
            })
        
        connections.append(connection_info)
    
    return {
        "total": len(connections),
        "connections": connections
    }


@router.get("/rooms")
async def get_room_stats(
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get statistics about WebSocket rooms.
    
    Returns information about active rooms and their members.
    """
    rooms = []
    
    for room_name, members in manager.pool.rooms.items():
        rooms.append({
            "room": room_name,
            "members": len(members),
            "type": room_name.split(":")[0] if ":" in room_name else "custom"
        })
    
    # Sort by member count
    rooms.sort(key=lambda x: x["members"], reverse=True)
    
    return {
        "total_rooms": len(rooms),
        "rooms": rooms[:50]  # Limit to top 50 rooms
    }


@router.post("/broadcast-test")
async def test_broadcast(
    message: str = "Test broadcast message",
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Send a test broadcast message to all connected clients.
    
    Useful for testing WebSocket connectivity and performance.
    """
    test_message = {
        "type": "broadcast",
        "data": {
            "message": message,
            "sender": current_user.get("username", "system")
        }
    }
    
    # Broadcast to all connections
    success_count = 0
    for client_id in list(manager.pool.connections.keys()):
        if await manager.pool.send_to_client(client_id, test_message):
            success_count += 1
    
    return {
        "message": "Broadcast sent",
        "recipients": len(manager.pool.connections),
        "successful": success_count
    }