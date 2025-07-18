"""WebSocket connection manager for handling real-time FHIR updates."""

import asyncio
import json
import logging
from typing import Dict, List, Set, Optional, Any
from datetime import datetime
from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

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
    """Manages WebSocket connections and message routing."""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.subscriptions: Dict[str, List[Subscription]] = {}
        self.pending_messages: Dict[str, List[WebSocketMessage]] = {}
        self.heartbeat_interval = 30  # seconds
        self.heartbeat_tasks: Dict[str, asyncio.Task] = {}
        
    async def connect(self, client_id: str, websocket: WebSocket):
        """Register a new WebSocket connection (already accepted)."""
        self.active_connections[client_id] = websocket
        
        # Send any pending messages
        if client_id in self.pending_messages:
            for message in self.pending_messages[client_id]:
                await self._send_message(client_id, message)
            self.pending_messages[client_id] = []
        
        # Start heartbeat for this connection
        self.heartbeat_tasks[client_id] = asyncio.create_task(
            self._heartbeat_loop(client_id)
        )
        
        logger.info(f"Client {client_id} connected")
        
    def disconnect(self, client_id: str):
        """Handle WebSocket disconnection."""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            
        # Cancel heartbeat task
        if client_id in self.heartbeat_tasks:
            self.heartbeat_tasks[client_id].cancel()
            del self.heartbeat_tasks[client_id]
            
        # Keep subscriptions for reconnection
        logger.info(f"Client {client_id} disconnected")
        
    async def _heartbeat_loop(self, client_id: str):
        """Send periodic heartbeat messages to keep connection alive."""
        try:
            while client_id in self.active_connections:
                await asyncio.sleep(self.heartbeat_interval)
                await self._send_message(
                    client_id,
                    WebSocketMessage(type="ping")
                )
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Heartbeat error for client {client_id}: {e}")
            
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
        message = WebSocketMessage(
            type="update",
            data={
                "action": action,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "patient_id": patient_id,
                "resource": resource_data
            }
        )
        
        # Find all clients with matching subscriptions
        for client_id, client_subscriptions in self.subscriptions.items():
            for subscription in client_subscriptions:
                if subscription.matches(resource_type, patient_id):
                    await self._send_message(client_id, message)
                    break
                    
    async def _send_message(self, client_id: str, message: WebSocketMessage):
        """Send a message to a specific client."""
        if client_id in self.active_connections:
            try:
                websocket = self.active_connections[client_id]
                # Use json() method to properly serialize datetime objects
                await websocket.send_text(message.json())
            except Exception as e:
                logger.error(f"Error sending message to client {client_id}: {e}")
                # Queue message for retry
                if client_id not in self.pending_messages:
                    self.pending_messages[client_id] = []
                self.pending_messages[client_id].append(message)
                # Disconnect the client
                self.disconnect(client_id)
        else:
            # Queue message for when client reconnects
            if client_id not in self.pending_messages:
                self.pending_messages[client_id] = []
            self.pending_messages[client_id].append(message)
            
            # Limit queue size to prevent memory issues
            if len(self.pending_messages[client_id]) > 100:
                self.pending_messages[client_id] = self.pending_messages[client_id][-100:]
                
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