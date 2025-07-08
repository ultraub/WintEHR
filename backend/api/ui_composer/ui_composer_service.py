"""
UI Composer Service
Main service for UI composition functionality with multiple method support
"""

import logging
from typing import Dict, Any, Optional, Literal
from .claude_cli_service import claude_cli_service
from .claude_hooks_service import claude_hooks_service
from .anthropic_sdk_service_v2 import anthropic_sdk_service_v2
from .development_mode_service import development_mode_service

logger = logging.getLogger(__name__)

MethodType = Literal["hooks", "sdk", "cli", "development"]

class UIComposerService:
    """Service for UI composition with multiple method support"""
    
    def __init__(self):
        self.services = {
            "hooks": claude_hooks_service,
            "sdk": anthropic_sdk_service_v2,
            "cli": claude_cli_service,
            "development": development_mode_service
        }
        self.default_method = "cli"
    
    async def get_method_status(self, method: Optional[MethodType] = None) -> Dict[str, Any]:
        """Get status for a specific method or all methods"""
        # Convert enum to string value if needed
        if method and hasattr(method, 'value'):
            method = method.value
        if method:
            service = self.services.get(method)
            if not service:
                return {"available": False, "error": f"Unknown method: {method}"}
            
            try:
                if hasattr(service, 'test_connection'):
                    return await service.test_connection()
                elif hasattr(service, 'is_available'):
                    available = await service.is_available()
                    return {"available": available}
                else:
                    return {"available": True}
            except Exception as e:
                return {"available": False, "error": str(e)}
        
        # Get status for all methods
        status = {}
        for method_name, service in self.services.items():
            status[method_name] = await self.get_method_status(method_name)
        return status
    
    async def analyze_request(self, request: str, context: Dict[str, Any], 
                            method: Optional[MethodType] = None) -> Dict[str, Any]:
        """Analyze UI request using specified method"""
        # Convert enum to string value if needed
        if hasattr(method, 'value'):
            method = method.value
        method = method or self.default_method
        logger.info(f"Analyzing request with method: {method}")
        service = self.services.get(method)
        
        if not service:
            return {
                "success": False,
                "error": f"Unknown method: {method}"
            }
        
        try:
            # Check if service is available
            if hasattr(service, 'is_available') and not await service.is_available():
                return {
                    "success": False,
                    "error": f"{method} service is not available",
                    "method": method
                }
            
            # Call the appropriate analyze method
            if method == "development":
                analysis = await service.analyze_request(request, context)
                return {
                    "success": True,
                    "analysis": analysis,
                    "reasoning": analysis.get("intent", "Analysis completed"),
                    "method": method
                }
            else:
                # For hooks, sdk, and cli services
                response = await service.analyze_request(request, context)
                
                # Parse response to extract JSON
                analysis_data = self._parse_json_response(response)
                
                return {
                    "success": True,
                    "analysis": analysis_data,
                    "reasoning": analysis_data.get("intent", "Analysis completed"),
                    "method": method,
                    "raw_response": response
                }
                
        except Exception as e:
            logger.error(f"Error using {method} service: {e}")
            return {
                "success": False,
                "error": str(e),
                "method": method
            }
    
    def _parse_json_response(self, response: str) -> Dict[str, Any]:
        """Parse JSON from Claude response"""
        import json
        
        # Try to extract JSON from response
        try:
            # First try direct parse
            return json.loads(response)
        except json.JSONDecodeError:
            # Try to find JSON in the response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                try:
                    return json.loads(response[json_start:json_end])
                except json.JSONDecodeError:
                    pass
        
        # Return empty dict if parsing fails
        logger.warning(f"Could not parse JSON from response. Raw response: {response[:500]}...")
        return {}
    
    async def generate_components(self, specification: Dict[str, Any],
                                method: Optional[MethodType] = None) -> Dict[str, str]:
        """Generate components from specification"""
        # Convert enum to string value if needed
        if hasattr(method, 'value'):
            method = method.value
        method = method or self.default_method
        logger.info(f"Generating components with method: {method}")
        service = self.services.get(method)
        
        if not service:
            raise ValueError(f"Unknown method: {method}")
        
        components = {}
        
        try:
            if method == "development":
                # Development mode generates components individually
                for component in specification.get("components", []):
                    component_id = component.get("id", f"comp-{len(components)}")
                    code = await service.generate_component(component)
                    components[component_id] = code
            else:
                # Other services expect full specification
                code = await service.generate_component(specification)
                # For now, treat as single component
                components["main"] = code
                
        except Exception as e:
            logger.error(f"Error generating components with {method}: {e}")
            raise
        
        return components
    
    async def refine_ui(self, feedback: str, specification: Dict[str, Any],
                       feedback_type: str = "general",
                       selected_component: Optional[str] = None,
                       method: Optional[MethodType] = None) -> Dict[str, Any]:
        """Refine UI based on feedback"""
        # Convert enum to string value if needed
        if hasattr(method, 'value'):
            method = method.value
        method = method or self.default_method
        service = self.services.get(method)
        
        if not service:
            return {
                "success": False,
                "error": f"Unknown method: {method}"
            }
        
        try:
            if method == "development":
                result = await service.refine_ui(feedback, specification, feedback_type)
                return {
                    "success": True,
                    "changes": result.get("changes", []),
                    "reasoning": result.get("reasoning", ""),
                    "method": method
                }
            else:
                # For hooks, sdk, and cli services
                response = await service.refine_ui(feedback, specification, feedback_type)
                
                # Parse response to extract JSON
                refinement_data = self._parse_json_response(response)
                
                return {
                    "success": True,
                    "changes": refinement_data.get("changes", []),
                    "reasoning": refinement_data.get("reasoning", ""),
                    "method": method,
                    "raw_response": response
                }
                
        except Exception as e:
            logger.error(f"Error refining UI with {method}: {e}")
            return {
                "success": False,
                "error": str(e),
                "method": method
            }

# Singleton instance
ui_composer_service = UIComposerService()