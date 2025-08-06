"""WebSocket connection manager for handling real-time FHIR updates."""

import asyncio
import json
import logging
from typing import Dict, List, Set, Optional, Any
from datetime import datetime
from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from .connection_pool import connection_pool, ConnectionState

logger = logging.getLogger(__name__)


class Subscription(BaseModel):
    """Model for a WebSocket subscription."""
    id: str
    client_id: str
    resource_types: List[str] = []
    patient_ids: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
    
    def matches(self, resource_type: str, patient_id: Optional[str] = None) -> bool:
        """Check if this subscription matches the given criteria."""
        # Check resource type match
        if self.resource_types and resource_type not in self.resource_types:
            return False
        
        # Check patient ID match if specified
        if patient_id and self.patient_ids and patient_id not in self.patient_ids:
            return False
            
        return True


class WebSocketMessage(BaseModel):
    """Standard WebSocket message format."""
    type: str  # "subscription", "update", "ping", "pong", "error"
    data: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    message_id: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ConnectionManager:
    """Manages WebSocket connections and message routing using connection pool."""
    
    def __init__(self):
        self.subscriptions: Dict[str, List[Subscription]] = {}
        self.pool = connection_pool  # Use the global connection pool
        
        # Legacy compatibility - redirect to pool
        self._active_connections_redirect = True
        
    @property
    def active_connections(self):
        """Legacy property for backward compatibility."""
        return self.pool.connections
        
    async def connect(self, client_id: str, websocket: WebSocket):
        """Register a new WebSocket connection (already accepted)."""
        # Add connection to the pool
        metadata = {"subscriptions": []}
        success = await self.pool.add_connection(client_id, websocket, metadata=metadata)
        
        if not success:
            await websocket.close(code=1008, reason="Connection pool full")
            raise Exception("Connection pool full")
        
        logger.info(f"Client {client_id} connected via connection pool")
        
    def disconnect(self, client_id: str):
        """Handle WebSocket disconnection."""
        # Use async task to handle disconnection
        asyncio.create_task(self.pool.remove_connection(client_id))
        
        # Keep subscriptions for reconnection
        logger.info(f"Client {client_id} disconnected")
            
    async def subscribe(
        self,
        client_id: str,
        subscription_id: str,
        resource_types: List[str] = None,
        patient_ids: List[str] = None
    ):
        """Create a new subscription for a client."""
        subscription = Subscription(
            id=subscription_id,
            client_id=client_id,
            resource_types=resource_types or [],
            patient_ids=patient_ids or []
        )
        
        if client_id not in self.subscriptions:
            self.subscriptions[client_id] = []
            
        # Remove existing subscription with same ID
        self.subscriptions[client_id] = [
            s for s in self.subscriptions[client_id]
            if s.id != subscription_id
        ]
        
        self.subscriptions[client_id].append(subscription)
        
        # Join appropriate rooms in the connection pool
        if resource_types:
            for resource_type in resource_types:
                await self.pool.join_room(client_id, f"resource:{resource_type}")
                
        if patient_ids:
            for patient_id in patient_ids:
                await self.pool.join_room(client_id, f"patient:{patient_id}")
                # Also join patient-resource specific rooms
                if resource_types:
                    for resource_type in resource_types:
                        await self.pool.join_room(client_id, f"patient:{patient_id}:resource:{resource_type}")
        
        # Send confirmation
        await self._send_message(
            client_id,
            WebSocketMessage(
                type="subscription",
                data={
                    "action": "created",
                    "subscription_id": subscription_id,
                    "resource_types": resource_types,
                    "patient_ids": patient_ids
                }
            )
        )
        
        logger.info(f"Created subscription {subscription_id} for client {client_id}")
        
    async def unsubscribe(self, client_id: str, subscription_id: str):
        """Remove a subscription."""
        if client_id in self.subscriptions:
            self.subscriptions[client_id] = [
                s for s in self.subscriptions[client_id]
                if s.id != subscription_id
            ]
            
        # Send confirmation
        await self._send_message(
            client_id,
            WebSocketMessage(
                type="subscription",
                data={
                    "action": "removed",
                    "subscription_id": subscription_id
                }
            )
        )
        
        logger.info(f"Removed subscription {subscription_id} for client {client_id}")
        
    async def broadcast_resource_update(
        self,
        resource_type: str,
        resource_id: str,
        action: str,  # "created", "updated", "deleted"
        resource_data: Optional[Dict[str, Any]] = None,
        patient_id: Optional[str] = None
    ):
        """Broadcast a FHIR resource update to all matching subscriptions."""
        message_data = {
            "type": "update",
            "data": {
                "action": action,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "patient_id": patient_id,
                "resource": resource_data
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Create room keys for efficient broadcasting
        rooms_to_broadcast = set()
        
        # Add resource type room
        rooms_to_broadcast.add(f"resource:{resource_type}")
        
        # Add patient-specific room if applicable
        if patient_id:
            rooms_to_broadcast.add(f"patient:{patient_id}")
            rooms_to_broadcast.add(f"patient:{patient_id}:resource:{resource_type}")
        
        # Broadcast to each room
        for room in rooms_to_broadcast:
            await self.pool.broadcast_to_room(room, message_data)
        
        # Also handle legacy subscriptions
        for client_id, client_subscriptions in self.subscriptions.items():
            for subscription in client_subscriptions:
                if subscription.matches(resource_type, patient_id):
                    await self.pool.send_to_client(client_id, message_data)
                    break
                    
    async def _send_message(self, client_id: str, message: WebSocketMessage):
        """Send a message to a specific client using the connection pool."""
        message_dict = json.loads(message.json())  # Convert to dict with datetime serialization
        success = await self.pool.send_to_client(client_id, message_dict)
        
        if not success:
            logger.warning(f"Failed to send message to client {client_id}")
                
    async def handle_message(self, client_id: str, message: dict):
        """Handle incoming WebSocket messages."""
        msg_type = message.get("type")
        
        if msg_type == "pong":
            # Client responded to ping, connection is healthy
            logger.debug(f"Received pong from client {client_id}")
            
        elif msg_type == "subscribe":
            data = message.get("data", {})
            await self.subscribe(
                client_id,
                data.get("subscription_id"),
                data.get("resource_types"),
                data.get("patient_ids")
            )
            
        elif msg_type == "unsubscribe":
            data = message.get("data", {})
            await self.unsubscribe(
                client_id,
                data.get("subscription_id")
            )
            
        elif msg_type == "authenticate":
            # Authentication is handled in the WebSocket endpoint, ignore here
            logger.debug(f"Ignoring authenticate message from client {client_id} (handled by endpoint)")
            
        else:
            logger.warning(f"Unknown message type from client {client_id}: {msg_type}")
            

# Global connection manager instance
manager = ConnectionManager()