"""
Session Manager for UI Composer
Manages conversation sessions and state
"""

import json
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any
import logging

from .models import SessionInfo, UISpecification

logger = logging.getLogger(__name__)

# Session ids are generated as UUID4s; accept only that shape when one is
# supplied by a caller. Session ids arrive from request bodies and are used to
# build filesystem paths, so an unvalidated id like "../../etc/passwd" would
# escape the sessions directory (arbitrary file read in get_session, arbitrary
# file DELETE in delete_session).
_SAFE_SESSION_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _is_safe_session_id(session_id: str) -> bool:
    return bool(session_id) and bool(_SAFE_SESSION_ID.match(session_id))


class SessionManager:
    def __init__(self, base_dir: str = ".claude/sessions/ui-composer"):
        self.base_dir = Path(base_dir)
        self.sessions_dir = self.base_dir / "sessions"
        self.sessions_dir.mkdir(parents=True, exist_ok=True)

        # In-memory cache
        self._sessions: Dict[str, SessionInfo] = {}

    def _session_file(self, session_id: str) -> Optional[Path]:
        """Resolve a session id to its file, or None if the id is unsafe."""
        if not _is_safe_session_id(session_id):
            logger.warning(f"Rejected unsafe session id: {session_id!r}")
            return None
        return self.sessions_dir / f"{session_id}.json"

    async def get_session(self, session_id: str) -> Optional[SessionInfo]:
        """Get session by ID"""
        # Check cache first
        if session_id in self._sessions:
            return self._sessions[session_id]

        # Try to load from file
        session_file = self._session_file(session_id)
        if session_file and session_file.exists():
            try:
                data = json.loads(session_file.read_text())
                session = SessionInfo(
                    session_id=data["session_id"],
                    created_at=datetime.fromisoformat(data["created_at"]),
                    updated_at=datetime.fromisoformat(data["updated_at"]),
                    request_count=data.get("request_count", 0),
                    current_specification=UISpecification(**data["current_specification"]) if data.get("current_specification") else None,
                    conversation_history=data.get("conversation_history", [])
                )
                self._sessions[session_id] = session
                return session
            except Exception as e:
                logger.error(f"Error loading session {session_id}: {e}")
        
        return None
    
    async def create_session(self, session_id: Optional[str] = None) -> SessionInfo:
        """Create new session"""
        if not session_id:
            session_id = str(uuid.uuid4())
        
        session = SessionInfo(
            session_id=session_id,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            request_count=0,
            conversation_history=[]
        )
        
        self._sessions[session_id] = session
        await self.save_session(session)
        
        return session
    
    async def get_or_create_session(self, session_id: Optional[str] = None) -> SessionInfo:
        """Get existing session or create new one"""
        if session_id:
            session = await self.get_session(session_id)
            if session:
                return session
        
        return await self.create_session(session_id)
    
    async def save_session(self, session: SessionInfo) -> None:
        """Save session to file"""
        session.updated_at = datetime.now()
        session.request_count += 1
        
        # Convert to dict for JSON serialization
        session_data = {
            "session_id": session.session_id,
            "created_at": session.created_at.isoformat(),
            "updated_at": session.updated_at.isoformat(),
            "request_count": session.request_count,
            "current_specification": session.current_specification.dict() if session.current_specification else None,
            "conversation_history": session.conversation_history
        }
        
        # Save to file
        session_file = self._session_file(session.session_id)
        if not session_file:
            return
        try:
            session_file.write_text(json.dumps(session_data, indent=2))
            logger.debug(f"Saved session {session.session_id}")
        except Exception as e:
            logger.error(f"Error saving session {session.session_id}: {e}")
    
    async def delete_session(self, session_id: str) -> bool:
        """Delete session"""
        # Remove from cache
        if session_id in self._sessions:
            del self._sessions[session_id]
        
        # Delete file
        session_file = self._session_file(session_id)
        if session_file and session_file.exists():
            try:
                session_file.unlink()
                return True
            except Exception as e:
                logger.error(f"Error deleting session {session_id}: {e}")
        
        return False
    
    async def list_sessions(self) -> list[str]:
        """List all session IDs"""
        session_ids = []
        
        # Get from files
        for session_file in self.sessions_dir.glob("*.json"):
            session_ids.append(session_file.stem)
        
        return sorted(set(session_ids))
    
    async def cleanup_old_sessions(self, days: int = 7) -> int:
        """Clean up sessions older than specified days"""
        from datetime import timedelta
        
        cutoff_date = datetime.now() - timedelta(days=days)
        deleted_count = 0
        
        for session_file in self.sessions_dir.glob("*.json"):
            try:
                data = json.loads(session_file.read_text())
                updated_at = datetime.fromisoformat(data["updated_at"])
                
                if updated_at < cutoff_date:
                    session_file.unlink()
                    deleted_count += 1
                    
                    # Remove from cache if present
                    session_id = session_file.stem
                    if session_id in self._sessions:
                        del self._sessions[session_id]
                        
            except Exception as e:
                logger.error(f"Error cleaning up session {session_file}: {e}")
        
        logger.info(f"Cleaned up {deleted_count} old sessions")
        return deleted_count