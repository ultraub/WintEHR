"""
CDS Service Registry - Manages CDS service definitions and implementations
Separates service configuration from execution logic per CDS Hooks spec
"""
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime
import json
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from .models import CDSService, CDSHookRequest, CDSHookResponse, Card, Source


class ServiceDefinition(BaseModel):
    """CDS Service definition per specification"""
    id: str = Field(..., description="Unique service identifier")
    hook: str = Field(..., description="Hook type this service responds to")
    title: Optional[str] = Field(None, description="Human-readable name")
    description: str = Field(..., description="Service description")
    prefetch: Optional[Dict[str, str]] = Field(default_factory=dict, description="FHIR query templates")
    usageRequirements: Optional[str] = Field(None, description="Usage requirements")


class ServiceImplementation:
    """Base class for CDS service implementations"""
    
    def __init__(self, service_id: str):
        self.service_id = service_id
    
    async def should_execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> bool:
        """
        Determine if this service should generate cards for the given context.
        This replaces the "conditions" configuration with actual logic.
        """
        return True
    
    async def execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> List[Card]:
        """
        Execute the service logic and return cards.
        Must be implemented by subclasses.
        """
        raise NotImplementedError
    
    def create_card(
        self,
        summary: str,
        indicator: str = "info",
        detail: Optional[str] = None,
        source_label: Optional[str] = None,
        suggestions: Optional[List[Dict[str, Any]]] = None,
        links: Optional[List[Dict[str, str]]] = None
    ) -> Card:
        """Helper to create a spec-compliant card"""
        import uuid
        
        card = Card(
            uuid=str(uuid.uuid4()),
            summary=summary[:140],  # Enforce 140 char limit
            indicator=indicator,
            source=Source(label=source_label or self.service_id)
        )
        
        if detail:
            card.detail = detail
        if suggestions:
            card.suggestions = suggestions
        if links:
            card.links = links
            
        return card


class ServiceRegistry:
    """Registry for CDS services"""
    
    def __init__(self):
        self._definitions: Dict[str, ServiceDefinition] = {}
        self._implementations: Dict[str, ServiceImplementation] = {}
        self._prefetch_engine = None  # Lazy initialize when needed
    
    def register_service(
        self,
        definition: ServiceDefinition,
        implementation: ServiceImplementation
    ):
        """Register a service definition with its implementation"""
        self._definitions[definition.id] = definition
        self._implementations[definition.id] = implementation
    
    def get_service_definition(self, service_id: str) -> Optional[ServiceDefinition]:
        """Get a service definition by ID"""
        return self._definitions.get(service_id)
    
    def get_service_implementation(self, service_id: str) -> Optional[ServiceImplementation]:
        """Get a service implementation by ID"""
        return self._implementations.get(service_id)
    
    def list_services(self) -> List[CDSService]:
        """List all registered services for discovery"""
        services = []
        for definition in self._definitions.values():
            service = CDSService(
                id=definition.id,
                hook=definition.hook,
                title=definition.title,
                description=definition.description,
                prefetch=definition.prefetch,
                usageRequirements=definition.usageRequirements
            )
            services.append(service)
        return services
    
    async def invoke_service(
        self,
        service_id: str,
        request: CDSHookRequest,
        db: AsyncSession
    ) -> CDSHookResponse:
        """Invoke a service with the given request"""
        
        # Get service definition and implementation
        definition = self.get_service_definition(service_id)
        if not definition:
            raise ValueError(f"Service '{service_id}' not found")
        
        implementation = self.get_service_implementation(service_id)
        if not implementation:
            raise ValueError(f"No implementation for service '{service_id}'")
        
        # Validate hook type matches
        if definition.hook != request.hook:
            raise ValueError(
                f"Service '{service_id}' responds to '{definition.hook}' "
                f"but was invoked with '{request.hook}'"
            )
        
        # Handle prefetch if needed
        prefetch_data = request.prefetch or {}
        if definition.prefetch and not request.prefetch:
            # Lazy initialize prefetch engine with database session
            if self._prefetch_engine is None:
                from .prefetch_engine import PrefetchEngine
                self._prefetch_engine = PrefetchEngine(db)
            
            # Fetch missing data using prefetch templates
            prefetch_data = await self._prefetch_engine.fetch_data(
                definition.prefetch,
                request.context,
                request.fhirServer,
                request.fhirAuthorization,
                db
            )
        
        # Check if service should execute
        if not await implementation.should_execute(request.context, prefetch_data):
            return CDSHookResponse(cards=[])
        
        # Execute service logic
        cards = await implementation.execute(request.context, prefetch_data)
        
        # Ensure all cards have required fields
        for card in cards:
            if not card.source:
                card.source = Source(label=definition.title or definition.id)
        
        return CDSHookResponse(cards=cards)


# Example implementations

class ExampleDiabetesScreeningService(ServiceImplementation):
    """Example implementation of a diabetes screening reminder service"""
    
    async def should_execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> bool:
        """Only execute for patients over 45 without recent A1C"""
        patient = prefetch.get("patient", {})
        if not patient:
            return False
        
        # Check age
        birth_date = patient.get("birthDate")
        if not birth_date:
            return False
        
        from datetime import datetime
        age = (datetime.now() - datetime.fromisoformat(birth_date)).days // 365
        return age >= 45
    
    async def execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> List[Card]:
        """Generate diabetes screening reminder card"""
        cards = []
        
        # Check for recent A1C test
        observations = prefetch.get("recentLabs", {}).get("entry", [])
        has_recent_a1c = any(
            obs.get("resource", {}).get("code", {}).get("coding", [{}])[0].get("code") == "4548-4"
            for obs in observations
        )
        
        if not has_recent_a1c:
            card = self.create_card(
                summary="Diabetes screening recommended",
                indicator="warning",
                detail="Patient is over 45 and has no A1C test in the past year. "
                       "Consider ordering hemoglobin A1C test.",
                source_label="ADA Diabetes Guidelines",
                suggestions=[{
                    "label": "Order A1C Test",
                    "uuid": "order-a1c",
                    "actions": [{
                        "type": "create",
                        "description": "Order Hemoglobin A1C",
                        "resource": {
                            "resourceType": "ServiceRequest",
                            "code": {
                                "coding": [{
                                    "system": "http://loinc.org",
                                    "code": "4548-4",
                                    "display": "Hemoglobin A1c"
                                }]
                            }
                        }
                    }]
                }],
                links=[{
                    "label": "ADA Screening Guidelines",
                    "url": "https://www.diabetes.org/diabetes/diagnosis",
                    "type": "absolute"
                }]
            )
            cards.append(card)
        
        return cards


# Global registry instance
service_registry = ServiceRegistry()


# Register built-in services
def register_builtin_services():
    """Register all built-in CDS services"""
    
    # Diabetes screening service
    diabetes_def = ServiceDefinition(
        id="diabetes-screening",
        hook="patient-view",
        title="Diabetes Screening Reminder",
        description="Reminds providers to screen eligible patients for diabetes",
        prefetch={
            "patient": "Patient/{{context.patientId}}",
            "recentLabs": "Observation?patient={{context.patientId}}&code=http://loinc.org|4548-4&date=ge{{today-1year}}"
        },
        usageRequirements="Requires access to patient demographics and lab results"
    )
    diabetes_impl = ExampleDiabetesScreeningService("diabetes-screening")
    service_registry.register_service(diabetes_def, diabetes_impl)
    
    # Add more built-in services here...