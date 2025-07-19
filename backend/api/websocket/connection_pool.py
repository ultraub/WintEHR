"""
WebSocket Connection Pool Manager

Implements connection pooling, rate limiting, and optimization for WebSocket connections.
Handles connection lifecycle, message broadcasting, and resource management.
"""

import asyncio
import time
import logging
from typing import Dict, Set, List, Optional, Any
from datetime import datetime, timedelta
from collections import defaultdict, deque
from dataclasses import dataclass, field
import weakref
from enum import Enum

from fastapi import WebSocket, WebSocketDisconnect
import json

logger = logging.getLogger(__name__)


class ConnectionState(Enum):
    """WebSocket connection states"""
    CONNECTING = "connecting"
    CONNECTED = "connected"
    AUTHENTICATED = "authenticated"
    CLOSING = "closing"
    CLOSED = "closed"


@dataclass
class ConnectionMetrics:
    """Metrics for a WebSocket connection"""
    connected_at: datetime = field(default_factory=datetime.now)
    last_activity: datetime = field(default_factory=datetime.now)
    messages_sent: int = 0
    messages_received: int = 0
    bytes_sent: int = 0
    bytes_received: int = 0
    errors: int = 0
    
    def update_activity(self):
        """Update last activity timestamp"""
        self.last_activity = datetime.now()
    
    def is_idle(self, idle_timeout: int = 300) -> bool:
        """Check if connection has been idle for too long"""
        return (datetime.now() - self.last_activity).seconds > idle_timeout


@dataclass
class RateLimiter:
    """Rate limiter for WebSocket messages"""
    max_messages_per_minute: int = 60
    max_bytes_per_minute: int = 1024 * 1024  # 1MB
    window_size: int = 60  # seconds
    
    def __init__(self):
        self.message_counts: Dict[str, deque] = defaultdict(lambda: deque())
        self.byte_counts: Dict[str, deque] = defaultdict(lambda: deque())
    
    def check_rate_limit(self, client_id: str, message_size: int) -> bool:
        """Check if client has exceeded rate limits"""
        now = time.time()
        
        # Clean old entries
        self._clean_old_entries(client_id, now)
        
        # Check message count
        if len(self.message_counts[client_id]) >= self.max_messages_per_minute:
            return False
        
        # Check byte count
        total_bytes = sum(size for _, size in self.byte_counts[client_id])
        if total_bytes + message_size > self.max_bytes_per_minute:
            return False
        
        # Record the message
        self.message_counts[client_id].append(now)
        self.byte_counts[client_id].append((now, message_size))
        
        return True
    
    def _clean_old_entries(self, client_id: str, now: float):
        """Remove entries older than the window size"""
        cutoff = now - self.window_size
        
        # Clean message counts
        while self.message_counts[client_id] and self.message_counts[client_id][0] < cutoff:
            self.message_counts[client_id].popleft()
        
        # Clean byte counts
        while self.byte_counts[client_id] and self.byte_counts[client_id][0][0] < cutoff:
            self.byte_counts[client_id].popleft()


class ConnectionPool:
    """Manages WebSocket connections with pooling and optimization"""
    
    def __init__(
        self,
        max_connections: int = 1000,
        idle_timeout: int = 300,
        ping_interval: int = 30,
        max_message_size: int = 1024 * 1024,  # 1MB
        enable_compression: bool = True
    ):
        self.max_connections = max_connections
        self.idle_timeout = idle_timeout
        self.ping_interval = ping_interval
        self.max_message_size = max_message_size
        self.enable_compression = enable_compression
        
        # Connection tracking
        self.connections: Dict[str, WebSocket] = {}
        self.connection_states: Dict[str, ConnectionState] = {}
        self.connection_metrics: Dict[str, ConnectionMetrics] = {}
        
        # Room/channel management
        self.rooms: Dict[str, Set[str]] = defaultdict(set)
        self.client_rooms: Dict[str, Set[str]] = defaultdict(set)
        
        # Rate limiting
        self.rate_limiter = RateLimiter()
        
        # Message queue for broadcast optimization
        self.broadcast_queue: asyncio.Queue = asyncio.Queue()
        self.broadcast_task: Optional[asyncio.Task] = None
        
        # Weak references for garbage collection
        self._weak_connections: weakref.WeakValueDictionary = weakref.WeakValueDictionary()
        
        # Start background tasks
        self._start_background_tasks()
    
    def _start_background_tasks(self):
        """Start background maintenance tasks"""
        asyncio.create_task(self._ping_clients())
        asyncio.create_task(self._cleanup_idle_connections())
        asyncio.create_task(self._process_broadcast_queue())
    
    async def add_connection(
        self,
        client_id: str,
        websocket: WebSocket,
        user_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Add a new connection to the pool"""
        if len(self.connections) >= self.max_connections:
            logger.warning(f"Connection pool full, rejecting connection from {client_id}")
            return False
        
        if client_id in self.connections:
            # Close existing connection
            await self.remove_connection(client_id)
        
        self.connections[client_id] = websocket
        self.connection_states[client_id] = ConnectionState.CONNECTED
        self.connection_metrics[client_id] = ConnectionMetrics()
        self._weak_connections[client_id] = websocket
        
        # Store metadata
        if metadata:
            setattr(websocket, '_metadata', metadata)
        if user_id:
            setattr(websocket, '_user_id', user_id)
        
        logger.info(f"Added connection {client_id} to pool (total: {len(self.connections)})")
        return True
    
    async def remove_connection(self, client_id: str):
        """Remove a connection from the pool"""
        if client_id not in self.connections:
            return
        
        # Leave all rooms
        for room in list(self.client_rooms.get(client_id, [])):
            await self.leave_room(client_id, room)
        
        # Clean up tracking
        self.connections.pop(client_id, None)
        self.connection_states.pop(client_id, None)
        self.connection_metrics.pop(client_id, None)
        self.client_rooms.pop(client_id, None)
        self._weak_connections.pop(client_id, None)
        
        logger.info(f"Removed connection {client_id} from pool (remaining: {len(self.connections)})")
    
    async def send_to_client(
        self,
        client_id: str,
        message: Dict[str, Any],
        compress: Optional[bool] = None
    ) -> bool:
        """Send a message to a specific client"""
        if client_id not in self.connections:
            return False
        
        websocket = self.connections[client_id]
        message_str = json.dumps(message)
        message_size = len(message_str.encode())
        
        # Check rate limits
        if not self.rate_limiter.check_rate_limit(client_id, message_size):
            logger.warning(f"Rate limit exceeded for client {client_id}")
            return False
        
        # Check message size
        if message_size > self.max_message_size:
            logger.warning(f"Message size {message_size} exceeds limit for client {client_id}")
            return False
        
        try:
            # Send with optional compression
            if compress is None:
                compress = self.enable_compression
            
            await websocket.send_text(message_str)
            
            # Update metrics
            metrics = self.connection_metrics[client_id]
            metrics.messages_sent += 1
            metrics.bytes_sent += message_size
            metrics.update_activity()
            
            return True
            
        except Exception as e:
            logger.error(f"Error sending to client {client_id}: {e}")
            metrics.errors += 1
            await self.remove_connection(client_id)
            return False
    
    async def broadcast_to_room(
        self,
        room: str,
        message: Dict[str, Any],
        exclude_clients: Optional[Set[str]] = None,
        priority: int = 0
    ):
        """Broadcast a message to all clients in a room"""
        # Queue the broadcast for optimized processing
        await self.broadcast_queue.put({
            'room': room,
            'message': message,
            'exclude_clients': exclude_clients or set(),
            'priority': priority,
            'timestamp': time.time()
        })
    
    async def _process_broadcast_queue(self):
        """Process broadcast messages from the queue"""
        batch_size = 50
        batch_interval = 0.1  # 100ms
        
        while True:
            try:
                # Collect messages for batching
                broadcasts = []
                deadline = time.time() + batch_interval
                
                while time.time() < deadline and len(broadcasts) < batch_size:
                    try:
                        timeout = max(0, deadline - time.time())
                        broadcast = await asyncio.wait_for(
                            self.broadcast_queue.get(),
                            timeout=timeout
                        )
                        broadcasts.append(broadcast)
                    except asyncio.TimeoutError:
                        break
                
                if not broadcasts:
                    await asyncio.sleep(0.1)
                    continue
                
                # Group broadcasts by room and message
                room_messages = defaultdict(list)
                for broadcast in broadcasts:
                    key = (broadcast['room'], json.dumps(broadcast['message']))
                    room_messages[key].append(broadcast)
                
                # Send deduplicated messages
                for (room, message_str), broadcast_list in room_messages.items():
                    message = json.loads(message_str)
                    exclude_clients = set()
                    for b in broadcast_list:
                        exclude_clients.update(b['exclude_clients'])
                    
                    await self._send_to_room_clients(room, message, exclude_clients)
                
            except Exception as e:
                logger.error(f"Error processing broadcast queue: {e}")
                await asyncio.sleep(1)
    
    async def _send_to_room_clients(
        self,
        room: str,
        message: Dict[str, Any],
        exclude_clients: Set[str]
    ):
        """Send a message to all clients in a room"""
        clients = self.rooms.get(room, set()) - exclude_clients
        
        if not clients:
            return
        
        # Send concurrently with limited parallelism
        semaphore = asyncio.Semaphore(50)  # Limit concurrent sends
        
        async def send_with_semaphore(client_id):
            async with semaphore:
                await self.send_to_client(client_id, message)
        
        tasks = [send_with_semaphore(client_id) for client_id in clients]
        await asyncio.gather(*tasks, return_exceptions=True)
    
    async def join_room(self, client_id: str, room: str):
        """Add a client to a room"""
        if client_id not in self.connections:
            return False
        
        self.rooms[room].add(client_id)
        self.client_rooms[client_id].add(room)
        
        logger.debug(f"Client {client_id} joined room {room}")
        return True
    
    async def leave_room(self, client_id: str, room: str):
        """Remove a client from a room"""
        self.rooms[room].discard(client_id)
        self.client_rooms[client_id].discard(room)
        
        # Clean up empty rooms
        if not self.rooms[room]:
            del self.rooms[room]
        
        logger.debug(f"Client {client_id} left room {room}")
    
    async def _ping_clients(self):
        """Periodically ping clients to keep connections alive"""
        while True:
            try:
                await asyncio.sleep(self.ping_interval)
                
                # Ping all connected clients
                ping_message = {"type": "ping", "timestamp": time.time()}
                dead_clients = []
                
                for client_id in list(self.connections.keys()):
                    try:
                        success = await self.send_to_client(client_id, ping_message)
                        if not success:
                            dead_clients.append(client_id)
                    except Exception:
                        dead_clients.append(client_id)
                
                # Remove dead connections
                for client_id in dead_clients:
                    await self.remove_connection(client_id)
                
                if dead_clients:
                    logger.info(f"Removed {len(dead_clients)} dead connections during ping")
                
            except Exception as e:
                logger.error(f"Error in ping task: {e}")
    
    async def _cleanup_idle_connections(self):
        """Clean up idle connections periodically"""
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute
                
                idle_clients = []
                for client_id, metrics in self.connection_metrics.items():
                    if metrics.is_idle(self.idle_timeout):
                        idle_clients.append(client_id)
                
                for client_id in idle_clients:
                    logger.info(f"Closing idle connection: {client_id}")
                    await self.remove_connection(client_id)
                
                if idle_clients:
                    logger.info(f"Cleaned up {len(idle_clients)} idle connections")
                
            except Exception as e:
                logger.error(f"Error in cleanup task: {e}")
    
    def get_pool_stats(self) -> Dict[str, Any]:
        """Get statistics about the connection pool"""
        total_messages_sent = sum(m.messages_sent for m in self.connection_metrics.values())
        total_bytes_sent = sum(m.bytes_sent for m in self.connection_metrics.values())
        total_errors = sum(m.errors for m in self.connection_metrics.values())
        
        return {
            "total_connections": len(self.connections),
            "max_connections": self.max_connections,
            "utilization": len(self.connections) / self.max_connections,
            "total_rooms": len(self.rooms),
            "total_messages_sent": total_messages_sent,
            "total_bytes_sent": total_bytes_sent,
            "total_errors": total_errors,
            "connections_by_state": dict(defaultdict(int, {
                state.value: sum(1 for s in self.connection_states.values() if s == state)
                for state in ConnectionState
            }))
        }


# Global connection pool instance
connection_pool = ConnectionPool()