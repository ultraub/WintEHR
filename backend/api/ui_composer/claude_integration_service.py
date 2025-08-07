"""
Consolidated Claude Integration Service
Unified service that combines all Claude integration methods with intelligent fallback
"""

import os
import json
import asyncio
import logging
from typing import Dict, Any, Optional, List, Literal
from datetime import datetime, timedelta
from pathlib import Path
import subprocess
import hashlib

logger = logging.getLogger(__name__)

MethodType = Literal["sdk", "cli", "hooks", "development"]

class ClaudeIntegrationService:
    """Unified Claude integration service with multiple methods and intelligent fallback"""
    
    def __init__(self):
        self.methods_priority = ["sdk", "cli", "hooks", "development"]
        self.cache = {}  # Simple in-memory cache
        self.cache_ttl = timedelta(minutes=30)
        self.api_key = os.environ.get('ANTHROPIC_API_KEY')
        
        # Initialize method availability
        self._method_status = {}
        self._last_check = None
        self._check_interval = timedelta(minutes=5)
        
        # Default configuration
        self.default_model = "claude-3-5-sonnet-20241022"
        self.default_max_tokens = 4096
        self.default_temperature = 0
        
    async def _check_methods_availability(self) -> Dict[str, bool]:
        """Check which methods are currently available"""
        if (self._last_check and 
            datetime.now() - self._last_check < self._check_interval):
            return self._method_status
            
        status = {}
        
        # Check SDK availability
        try:
            result = await self._run_command(['npm', 'list', '@anthropic-ai/sdk'], timeout=5)
            status['sdk'] = '@anthropic-ai/sdk' in result.get('stdout', '')
        except:
            status['sdk'] = False
            
        # Check CLI availability
        cli_paths = [
            Path.home() / '.nvm/versions/node/v22.17.0/bin/claude',
            Path.home() / '.claude/local/claude',
            Path('/usr/local/bin/claude')
        ]
        status['cli'] = any(path.exists() for path in cli_paths)
        
        # Check hooks availability (window.claude)
        status['hooks'] = False  # Can't check from backend
        
        # Development mode always available
        status['development'] = True
        
        self._method_status = status
        self._last_check = datetime.now()
        logger.info(f"Method availability: {status}")
        
        return status
        
    async def _run_command(self, cmd: List[str], timeout: int = 30) -> Dict[str, Any]:
        """Run a command with timeout"""
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), 
                timeout=timeout
            )
            
            return {
                'success': proc.returncode == 0,
                'stdout': stdout.decode() if stdout else '',
                'stderr': stderr.decode() if stderr else '',
                'returncode': proc.returncode
            }
        except asyncio.TimeoutError:
            if proc:
                proc.terminate()
            return {'success': False, 'error': 'Command timed out'}
        except Exception as e:
            return {'success': False, 'error': str(e)}
            
    def _get_cache_key(self, prompt: str, options: Dict[str, Any]) -> str:
        """Generate cache key for prompt and options"""
        key_data = json.dumps({'prompt': prompt, 'options': options}, sort_keys=True)
        return hashlib.md5(key_data.encode()).hexdigest()
        
    def _get_from_cache(self, key: str) -> Optional[str]:
        """Get value from cache if not expired"""
        if key in self.cache:
            entry = self.cache[key]
            if datetime.now() - entry['timestamp'] < self.cache_ttl:
                logger.info(f"Cache hit for key: {key}")
                return entry['value']
            else:
                del self.cache[key]
        return None
        
    def _set_cache(self, key: str, value: str):
        """Set value in cache"""
        self.cache[key] = {
            'value': value,
            'timestamp': datetime.now()
        }
        
    async def complete(self, 
                      prompt: str, 
                      options: Optional[Dict[str, Any]] = None,
                      method: Optional[MethodType] = None) -> str:
        """
        Complete a prompt using available methods with fallback
        
        Args:
            prompt: The prompt to complete
            options: Model options (model, max_tokens, temperature)
            method: Specific method to use, or None for auto-selection
            
        Returns:
            The completion response
        """
        options = options or {}
        
        # Check cache first
        cache_key = self._get_cache_key(prompt, options)
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached
            
        # Check method availability
        availability = await self._check_methods_availability()
        
        # Determine methods to try
        if method:
            methods_to_try = [method] if availability.get(method) else []
        else:
            methods_to_try = [m for m in self.methods_priority if availability.get(m)]
            
        if not methods_to_try:
            raise RuntimeError("No Claude integration methods available")
            
        # Try each method with fallback
        last_error = None
        for method_name in methods_to_try:
            try:
                logger.info(f"Attempting completion with method: {method_name}")
                
                if method_name == "sdk":
                    result = await self._complete_via_sdk(prompt, options)
                elif method_name == "cli":
                    result = await self._complete_via_cli(prompt, options)
                elif method_name == "hooks":
                    result = await self._complete_via_hooks(prompt, options)
                elif method_name == "development":
                    result = await self._complete_via_development(prompt, options)
                else:
                    continue
                    
                # Cache successful result
                self._set_cache(cache_key, result)
                return result
                
            except Exception as e:
                logger.warning(f"Method {method_name} failed: {e}")
                last_error = e
                continue
                
        # All methods failed
        raise RuntimeError(f"All methods failed. Last error: {last_error}")
        
    async def _complete_via_sdk(self, prompt: str, options: Dict[str, Any]) -> str:
        """Complete using Anthropic SDK via Node.js runner"""
        if not self.api_key:
            raise RuntimeError("ANTHROPIC_API_KEY not set")
            
        # Use the existing sdk_runner.js
        runner_path = Path(__file__).parent / "sdk_runner.js"
        if not runner_path.exists():
            raise RuntimeError("SDK runner not found")
            
        request_data = {
            "action": "complete",
            "prompt": prompt,
            "options": {
                "model": options.get("model", self.default_model),
                "max_tokens": options.get("max_tokens", self.default_max_tokens),
                "temperature": options.get("temperature", self.default_temperature)
            }
        }
        
        cmd = ['node', str(runner_path), json.dumps(request_data)]
        result = await self._run_command(cmd, timeout=60)
        
        if not result['success']:
            raise RuntimeError(f"SDK completion failed: {result.get('error', 'Unknown error')}")
            
        try:
            response = json.loads(result['stdout'])
            if response.get('success'):
                return response.get('response', '')
            else:
                raise RuntimeError(response.get('error', 'SDK error'))
        except json.JSONDecodeError:
            raise RuntimeError(f"Invalid SDK response: {result['stdout']}")
            
    async def _complete_via_cli(self, prompt: str, options: Dict[str, Any]) -> str:
        """Complete using Claude CLI"""
        # Find Claude CLI
        cli_path = None
        for path in [
            Path.home() / '.nvm/versions/node/v22.17.0/bin/claude',
            Path.home() / '.claude/local/claude',
            Path('/usr/local/bin/claude')
        ]:
            if path.exists():
                cli_path = path
                break
                
        if not cli_path:
            raise RuntimeError("Claude CLI not found")
            
        # Get auth token from lock file
        auth_token = await self._get_cli_auth_token()
        if not auth_token:
            raise RuntimeError("Claude CLI not authenticated")
            
        # Build command
        cmd = [
            str(cli_path),
            'api',
            'complete',
            '--model', options.get('model', self.default_model),
            '--max-tokens', str(options.get('max_tokens', self.default_max_tokens)),
            '--temperature', str(options.get('temperature', self.default_temperature)),
            '--auth-token', auth_token,
            prompt
        ]
        
        result = await self._run_command(cmd, timeout=60)
        
        if not result['success']:
            raise RuntimeError(f"CLI completion failed: {result.get('stderr', 'Unknown error')}")
            
        return result['stdout'].strip()
        
    async def _get_cli_auth_token(self) -> Optional[str]:
        """Get CLI auth token from lock file"""
        lock_dir = Path.home() / '.claude/ide'
        if not lock_dir.exists():
            return None
            
        for lock_file in lock_dir.glob('*.lock'):
            try:
                with open(lock_file, 'r') as f:
                    data = json.load(f)
                    if 'authToken' in data:
                        return data['authToken']
            except:
                continue
                
        return None
        
    async def _complete_via_hooks(self, prompt: str, options: Dict[str, Any]) -> str:
        """Complete using hooks (not available from backend)"""
        raise RuntimeError("Hooks method not available from backend")
        
    async def _complete_via_development(self, prompt: str, options: Dict[str, Any]) -> str:
        """Complete using development mode (simple responses)"""
        # Simple development mode responses
        if "hypertension" in prompt.lower() or "blood pressure" in prompt.lower():
            return self._generate_bp_component()
        elif "diabetes" in prompt.lower():
            return self._generate_diabetes_component()
        elif "component" in prompt.lower():
            return self._generate_generic_component()
        else:
            return f"// Development mode: Generated component for prompt: {prompt[:50]}..."
            
    def _generate_bp_component(self) -> str:
        """Generate a simple blood pressure component"""
        return '''import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { usePatientResources } from '../hooks/useFHIRResources';

const BloodPressureCard = ({ patientId }) => {
  const { resources, loading, error } = usePatientResources(
    patientId, 
    'Observation',
    { params: { code: '85354-9' } }
  );
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;
  
  return (
    <Card>
      <CardContent>
        <Typography variant="h6">Blood Pressure</Typography>
        <Box>
          {resources?.length || 0} readings found
        </Box>
      </CardContent>
    </Card>
  );
};

export default BloodPressureCard;'''

    def _generate_diabetes_component(self) -> str:
        """Generate a simple diabetes component"""
        return '''import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { usePatientResources } from '../hooks/useFHIRResources';

const DiabetesMonitor = ({ patientId }) => {
  const { resources, loading, error } = usePatientResources(
    patientId,
    'Observation', 
    { params: { code: '4548-4' } } // HbA1c
  );
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;
  
  return (
    <Card>
      <CardContent>
        <Typography variant="h6">Diabetes Monitoring</Typography>
        <Box>
          {resources?.length || 0} HbA1c results
        </Box>
      </CardContent>
    </Card>
  );
};

export default DiabetesMonitor;'''

    def _generate_generic_component(self) -> str:
        """Generate a generic clinical component"""
        return '''import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import { usePatientContext } from '../contexts/PatientContext';

const ClinicalComponent = () => {
  const { patient } = usePatientContext();
  
  return (
    <Card>
      <CardContent>
        <Typography variant="h6">Clinical Data</Typography>
        <Typography>
          Patient: {patient?.name?.[0]?.text || 'Unknown'}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default ClinicalComponent;'''

    async def get_status(self) -> Dict[str, Any]:
        """Get status of all methods"""
        availability = await self._check_methods_availability()
        
        return {
            "methods": availability,
            "cache_size": len(self.cache),
            "api_key_set": bool(self.api_key),
            "default_method": self.methods_priority[0] if self.methods_priority else None,
            "available_methods": [m for m, avail in availability.items() if avail]
        }

# Singleton instance
claude_integration_service = ClaudeIntegrationService()