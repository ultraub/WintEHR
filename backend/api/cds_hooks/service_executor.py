"""
CDS Hooks Service Executor
Sandboxed execution environment for user-written CDS service logic
"""

import asyncio
import json
import subprocess
import tempfile
import os
import uuid
from typing import Dict, Any, Optional, List
from datetime import datetime
import logging
from pathlib import Path
import base64
import hashlib
import aiofiles

from pydantic import BaseModel, Field, validator
from fastapi import HTTPException

from .models import CDSHookResponse, Card, Suggestion, SystemAction, OverrideReason

logger = logging.getLogger(__name__)

class ServiceExecutionRequest(BaseModel):
    """Request to execute a CDS service"""
    code: str = Field(..., description="JavaScript service code")
    request: Dict[str, Any] = Field(..., description="CDS Hook request")
    timeout: int = Field(default=10, ge=1, le=30, description="Execution timeout in seconds")
    debug: bool = Field(default=False, description="Enable debug mode")

class ServiceExecutionResult(BaseModel):
    """Result of service execution"""
    success: bool
    response: Optional[CDSHookResponse] = None
    error: Optional[str] = None
    logs: List[str] = Field(default_factory=list)
    execution_time: float = Field(0, description="Execution time in seconds")

class ServiceValidator:
    """Validates CDS service code before execution"""
    
    REQUIRED_PATTERNS = [
        (r'class\s+\w+Service\s*{', "Service must be defined as a class"),
        (r'static\s+metadata\s*=', "Service must have static metadata property"),
        (r'execute\s*\(', "Service must have execute() method")
    ]
    
    FORBIDDEN_PATTERNS = [
        (r'require\s*\(', "require() is not allowed"),
        (r'import\s+', "import statements are not allowed"),
        (r'eval\s*\(', "eval() is not allowed"),
        (r'Function\s*\(', "Function constructor is not allowed"),
        (r'__proto__', "__proto__ access is not allowed"),
        (r'process\s*\.', "process access is not allowed"),
        (r'global\s*\.', "global access is not allowed"),
        (r'fs\s*\.', "File system access is not allowed"),
        (r'child_process', "Child process access is not allowed"),
        (r'fetch\s*\(', "Network requests are not allowed"),
        (r'XMLHttpRequest', "XMLHttpRequest is not allowed"),
        (r'WebSocket', "WebSocket is not allowed")
    ]
    
    @classmethod
    def validate(cls, code: str) -> List[str]:
        """Validate service code and return list of errors"""
        import re
        errors = []
        
        # Check required patterns
        for pattern, message in cls.REQUIRED_PATTERNS:
            if not re.search(pattern, code):
                errors.append(message)
        
        # Check forbidden patterns
        for pattern, message in cls.FORBIDDEN_PATTERNS:
            if re.search(pattern, code, re.IGNORECASE):
                errors.append(message)
        
        # Check code length
        if len(code) > 50000:  # 50KB limit
            errors.append("Code size exceeds maximum allowed (50KB)")
        
        return errors

class ServiceExecutor:
    """Executes CDS services in a sandboxed environment"""
    
    def __init__(self, 
                 sandbox_dir: str = "/tmp/cds-sandbox",
                 node_path: str = "node",
                 max_concurrent: int = 5):
        self.sandbox_dir = Path(sandbox_dir)
        self.node_path = node_path
        self.max_concurrent = max_concurrent
        self._semaphore = asyncio.Semaphore(max_concurrent)
        
        # Create sandbox directory
        self.sandbox_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize sandbox environment
        self._init_sandbox()
    
    def _init_sandbox(self):
        """Initialize the sandbox environment with runtime code"""
        runtime_code = '''
// CDS Service Runtime
const vm = require('vm');

// Safe globals for sandbox
const safeGlobals = {
  console: {
    log: (...args) => process.send({ type: 'log', data: args }),
    error: (...args) => process.send({ type: 'error', data: args }),
    warn: (...args) => process.send({ type: 'warn', data: args })
  },
  Date: Date,
  Math: Math,
  JSON: JSON,
  Object: Object,
  Array: Array,
  String: String,
  Number: Number,
  Boolean: Boolean,
  RegExp: RegExp,
  Map: Map,
  Set: Set,
  Promise: Promise,
  // CDS specific helpers
  generateUUID: () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};

// Message handler
process.on('message', async (message) => {
  if (message.type === 'execute') {
    try {
      const { code, request } = message;
      
      // Create sandbox context
      const sandbox = {
        ...safeGlobals,
        request: request,
        context: request.context,
        prefetch: request.prefetch || {}
      };
      
      // Create VM context
      const vmContext = vm.createContext(sandbox);
      
      // Execute service code
      const script = new vm.Script(`
        ${code}
        
        // Extract service class
        const ServiceClass = Object.values(this).find(v => 
          typeof v === 'function' && 
          v.prototype && 
          typeof v.prototype.execute === 'function'
        );
        
        if (!ServiceClass) {
          throw new Error('No service class found');
        }
        
        // Create instance and execute
        const service = new ServiceClass();
        let result = { cards: [] };
        
        // Check if should execute
        if (service.shouldExecute) {
          const shouldRun = service.shouldExecute(context, prefetch);
          if (!shouldRun) {
            result._debug = { message: 'Service shouldExecute() returned false' };
          } else {
            result = service.execute(context, prefetch);
          }
        } else {
          result = service.execute(context, prefetch);
        }
        
        result;
      `);
      
      // Run with timeout
      const result = await Promise.race([
        new Promise(resolve => resolve(script.runInContext(vmContext))),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Execution timeout')), 10000)
        )
      ]);
      
      // Send result
      process.send({ type: 'result', data: result });
      
    } catch (error) {
      process.send({ 
        type: 'error', 
        data: error.message || 'Unknown error' 
      });
    }
  }
});

// Keep process alive
process.on('disconnect', () => {
  process.exit(0);
});
'''
        
        runtime_path = self.sandbox_dir / "runtime.js"
        runtime_path.write_text(runtime_code)
    
    async def execute(self, request: ServiceExecutionRequest) -> ServiceExecutionResult:
        """Execute a CDS service in the sandbox"""
        async with self._semaphore:
            start_time = datetime.now()
            logs = []
            
            try:
                # Validate code first
                errors = ServiceValidator.validate(request.code)
                if errors:
                    return ServiceExecutionResult(
                        success=False,
                        error=f"Validation failed: {'; '.join(errors)}",
                        execution_time=(datetime.now() - start_time).total_seconds()
                    )
                
                # Create unique execution ID
                exec_id = str(uuid.uuid4())
                
                # Write service code to temporary file
                service_file = self.sandbox_dir / f"service_{exec_id}.js"
                async with aiofiles.open(service_file, 'w') as f:
                    await f.write(request.code)
                
                # Prepare Node.js subprocess
                process = await asyncio.create_subprocess_exec(
                    self.node_path,
                    str(self.sandbox_dir / "runtime.js"),
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=str(self.sandbox_dir)
                )
                
                # Send execution command
                execution_message = json.dumps({
                    'type': 'execute',
                    'code': request.code,
                    'request': request.request
                })
                
                # Execute with timeout
                try:
                    stdout, stderr = await asyncio.wait_for(
                        process.communicate(execution_message.encode()),
                        timeout=request.timeout
                    )
                    
                    if stderr:
                        logger.error(f"Sandbox stderr: {stderr.decode()}")
                        logs.append(f"Error: {stderr.decode()}")
                    
                    # Parse output
                    output_lines = stdout.decode().strip().split('\n')
                    result_data = None
                    
                    for line in output_lines:
                        if not line:
                            continue
                            
                        try:
                            message = json.loads(line)
                            if message['type'] == 'result':
                                result_data = message['data']
                            elif message['type'] == 'log':
                                logs.append(f"Log: {message['data']}")
                            elif message['type'] == 'error':
                                logs.append(f"Error: {message['data']}")
                        except json.JSONDecodeError:
                            logs.append(f"Raw output: {line}")
                    
                    if result_data:
                        # Convert to CDSHookResponse
                        response = self._parse_response(result_data)
                        return ServiceExecutionResult(
                            success=True,
                            response=response,
                            logs=logs,
                            execution_time=(datetime.now() - start_time).total_seconds()
                        )
                    else:
                        return ServiceExecutionResult(
                            success=False,
                            error="No result returned from service",
                            logs=logs,
                            execution_time=(datetime.now() - start_time).total_seconds()
                        )
                        
                except asyncio.TimeoutError:
                    process.terminate()
                    await process.wait()
                    return ServiceExecutionResult(
                        success=False,
                        error=f"Execution timeout ({request.timeout}s)",
                        logs=logs,
                        execution_time=(datetime.now() - start_time).total_seconds()
                    )
                    
            except Exception as e:
                logger.exception("Service execution error")
                return ServiceExecutionResult(
                    success=False,
                    error=str(e),
                    logs=logs,
                    execution_time=(datetime.now() - start_time).total_seconds()
                )
            finally:
                # Cleanup temporary files
                try:
                    if 'service_file' in locals():
                        service_file.unlink(missing_ok=True)
                except:
                    pass
    
    def _parse_response(self, data: Dict[str, Any]) -> CDSHookResponse:
        """Parse execution result into CDSHookResponse"""
        cards = []
        
        # Parse cards
        for card_data in data.get('cards', []):
            # Ensure UUID
            if 'uuid' not in card_data:
                card_data['uuid'] = str(uuid.uuid4())
            
            # Parse suggestions
            suggestions = []
            for sug_data in card_data.get('suggestions', []):
                if 'uuid' not in sug_data:
                    sug_data['uuid'] = str(uuid.uuid4())
                
                suggestions.append(CDSSuggestion(
                    label=sug_data.get('label', ''),
                    uuid=sug_data['uuid'],
                    actions=sug_data.get('actions', [])
                ))
            
            # Parse override reasons
            override_reasons = []
            for reason_data in card_data.get('overrideReasons', []):
                override_reasons.append(OverrideReason(
                    code=reason_data.get('code', ''),
                    display=reason_data.get('display', '')
                ))
            
            card = Card(
                uuid=card_data['uuid'],
                summary=card_data.get('summary', ''),
                indicator=card_data.get('indicator', 'info'),
                detail=card_data.get('detail'),
                source=card_data.get('source'),
                suggestions=suggestions,
                links=card_data.get('links', []),
                overrideReasons=override_reasons
            )
            cards.append(card)
        
        # Parse system actions
        system_actions = []
        for action_data in data.get('systemActions', []):
            system_actions.append(SystemAction(
                type=action_data.get('type', 'create'),
                resource=action_data.get('resource'),
                resourceId=action_data.get('resourceId')
            ))
        
        return CDSHookResponse(
            cards=cards,
            systemActions=system_actions
        )
    
    async def validate_only(self, code: str) -> Dict[str, Any]:
        """Validate service code without executing"""
        errors = ServiceValidator.validate(code)
        
        if not errors:
            # Try to parse the code for additional validation
            try:
                # Basic syntax check using subprocess
                process = await asyncio.create_subprocess_exec(
                    self.node_path,
                    '-c',
                    code,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                _, stderr = await process.communicate()
                
                if process.returncode != 0:
                    errors.append(f"Syntax error: {stderr.decode()}")
                    
            except Exception as e:
                errors.append(f"Validation error: {str(e)}")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors
        }

# Global executor instance
_executor = None

def get_service_executor() -> ServiceExecutor:
    """Get or create the global service executor"""
    global _executor
    if _executor is None:
        _executor = ServiceExecutor()
    return _executor

async def execute_user_service(
    code: str,
    request: Dict[str, Any],
    timeout: int = 10,
    debug: bool = False
) -> ServiceExecutionResult:
    """Execute a user-written CDS service"""
    executor = get_service_executor()
    
    execution_request = ServiceExecutionRequest(
        code=code,
        request=request,
        timeout=timeout,
        debug=debug
    )
    
    return await executor.execute(execution_request)

async def validate_service_code(code: str) -> Dict[str, Any]:
    """Validate CDS service code"""
    executor = get_service_executor()
    return await executor.validate_only(code)