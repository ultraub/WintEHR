"""
Claude Hooks Service
Communicates with Claude Code via file-based hook system
"""

import os
import json
import asyncio
import uuid
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class ClaudeHooksService:
    """Service for communicating with Claude Code via hooks"""
    
    def __init__(self):
        self.request_dir = Path('/tmp/claude-ui-composer/requests')
        self.response_dir = Path('/tmp/claude-ui-composer/responses')
        self.processed_dir = Path('/tmp/claude-ui-composer/processed')
        
        # Ensure directories exist
        self.request_dir.mkdir(parents=True, exist_ok=True)
        self.response_dir.mkdir(parents=True, exist_ok=True)
        self.processed_dir.mkdir(parents=True, exist_ok=True)
        
        # Check if hook is running
        self.hook_process = None
        self._start_hook_if_needed()
    
    def _start_hook_if_needed(self):
        """Start the hook process if it's not running"""
        # Check if hook process is already running
        hook_pid_file = Path('/tmp/claude-ui-composer/hook.pid')
        if hook_pid_file.exists():
            try:
                pid = int(hook_pid_file.read_text().strip())
                # Check if process is still running
                os.kill(pid, 0)
                logger.info(f"Hook process already running with PID {pid}")
                return
            except (OSError, ValueError):
                # Process not running, remove stale PID file
                hook_pid_file.unlink(missing_ok=True)
        
        # Start hook process in background
        hook_script = Path(__file__).parent.parent.parent.parent / '.claude/hooks/ui-composer-bridge.py'
        if hook_script.exists():
            import subprocess
            try:
                self.hook_process = subprocess.Popen(
                    ['python3', str(hook_script)],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    start_new_session=True
                )
                # Save PID
                hook_pid_file.write_text(str(self.hook_process.pid))
                logger.info(f"Started hook process with PID {self.hook_process.pid}")
            except Exception as e:
                logger.error(f"Failed to start hook process: {e}")
    
    async def is_available(self) -> bool:
        """Check if hooks system is available"""
        # Check if directories exist and are writable
        try:
            test_file = self.request_dir / f"test-{uuid.uuid4()}.tmp"
            test_file.write_text("test")
            test_file.unlink()
            return True
        except Exception:
            return False
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test hooks connection"""
        if not await self.is_available():
            return {
                "available": False,
                "error": "Hook directories not accessible",
                "path": str(self.request_dir)
            }
        
        # Check if hook process is running
        hook_running = False
        hook_pid_file = Path('/tmp/claude-ui-composer/hook.pid')
        if hook_pid_file.exists():
            try:
                pid = int(hook_pid_file.read_text().strip())
                os.kill(pid, 0)
                hook_running = True
            except (OSError, ValueError):
                pass
        
        return {
            "available": True,
            "hook_running": hook_running,
            "request_dir": str(self.request_dir),
            "response_dir": str(self.response_dir),
            "message": "Hooks system ready" if hook_running else "Hook process not running - will start on first request"
        }
    
    async def send_request(self, request_type: str, data: Dict[str, Any], timeout: int = 30) -> Dict[str, Any]:
        """Send a request through the hooks system"""
        request_id = str(uuid.uuid4())
        
        # Prepare request
        request_data = {
            "id": request_id,
            "type": request_type,
            "timestamp": datetime.now().isoformat(),
            **data
        }
        
        # Write request file
        request_file = self.request_dir / f"{request_id}.json"
        try:
            request_file.write_text(json.dumps(request_data, indent=2))
            logger.info(f"Wrote request {request_id} to {request_file}")
        except Exception as e:
            logger.error(f"Failed to write request file: {e}")
            raise RuntimeError(f"Failed to write request: {e}")
        
        # Wait for response
        response_file = self.response_dir / f"{request_id}.json"
        start_time = asyncio.get_event_loop().time()
        
        while (asyncio.get_event_loop().time() - start_time) < timeout:
            if response_file.exists():
                try:
                    # Read response
                    response_data = json.loads(response_file.read_text())
                    
                    # Clean up response file
                    response_file.unlink(missing_ok=True)
                    
                    logger.info(f"Received response for {request_id}")
                    return response_data
                    
                except Exception as e:
                    logger.error(f"Failed to read response: {e}")
                    raise RuntimeError(f"Failed to read response: {e}")
            
            # Small delay before checking again
            await asyncio.sleep(0.1)
        
        # Timeout - clean up request file
        request_file.unlink(missing_ok=True)
        raise TimeoutError(f"No response received within {timeout} seconds")
    
    async def analyze_request(self, prompt: str, context: Dict[str, Any]) -> str:
        """Analyze a UI request"""
        response = await self.send_request('analyze', {
            'prompt': prompt,
            'context': context
        })
        
        if not response.get('success'):
            raise RuntimeError(response.get('error', 'Analysis failed'))
        
        return response.get('response', '')
    
    async def generate_component(self, specification: Dict[str, Any]) -> str:
        """Generate a component from specification"""
        response = await self.send_request('generate', {
            'specification': specification
        })
        
        if not response.get('success'):
            raise RuntimeError(response.get('error', 'Generation failed'))
        
        return response.get('response', '')
    
    async def refine_ui(self, feedback: str, specification: Dict[str, Any], 
                       feedback_type: str = 'general') -> str:
        """Refine UI based on feedback"""
        response = await self.send_request('refine', {
            'feedback': feedback,
            'specification': specification,
            'feedback_type': feedback_type
        })
        
        if not response.get('success'):
            raise RuntimeError(response.get('error', 'Refinement failed'))
        
        return response.get('response', '')
    
    def cleanup(self):
        """Clean up resources"""
        # Stop hook process if we started it
        if self.hook_process:
            try:
                self.hook_process.terminate()
                self.hook_process.wait(timeout=5)
            except Exception as e:
                logger.error(f"Error stopping hook process: {e}")
        
        # Remove PID file
        hook_pid_file = Path('/tmp/claude-ui-composer/hook.pid')
        hook_pid_file.unlink(missing_ok=True)

# Singleton instance
claude_hooks_service = ClaudeHooksService()