"""
Clinical Canvas Service

AI-powered dynamic UI generation for clinical interfaces.
Uses FHIR APIs as the data layer and Claude for intelligent UI generation.
"""

import os
import json
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import httpx
from anthropic import AsyncAnthropic

from ..core.fhir.storage import FHIRStorageEngine
from sqlalchemy.ext.asyncio import AsyncSession


class ClinicalCanvasService:
    """
    Generates dynamic clinical UIs using natural language input.
    
    Architecture:
    - Uses FHIR APIs for all clinical data operations
    - Claude for understanding intent and generating UI specifications
    - Returns UI component specifications that the frontend can render
    """
    
    def __init__(self, fhir_base_url: str = None):
        """
        Initialize Clinical Canvas service.
        
        Args:
            fhir_base_url: Base URL for FHIR API (defaults to local)
        """
        self.fhir_base_url = fhir_base_url or os.getenv("FHIR_BASE_URL", "http://localhost:8000/fhir/R4")
        self.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
        
        if self.anthropic_api_key:
            self.claude = AsyncAnthropic(api_key=self.anthropic_api_key)
        else:
            self.claude = None
    
    async def generate_ui_from_prompt(
        self,
        prompt: str,
        context: Dict[str, Any],
        session: Optional[AsyncSession] = None
    ) -> Dict[str, Any]:
        """
        Generate UI specification from natural language prompt.
        
        Args:
            prompt: Natural language description of desired UI
            context: Clinical context (patient ID, encounter ID, etc.)
            session: Optional database session for local operations
            
        Returns:
            UI specification with components and data bindings
        """
        # Extract intent and requirements from prompt
        intent_analysis = await self._analyze_prompt(prompt, context)
        
        # Determine required FHIR resources
        required_resources = await self._identify_required_resources(
            intent_analysis, context
        )
        
        # Fetch data from FHIR API
        fhir_data = await self._fetch_fhir_data(required_resources, context)
        
        # Generate UI components
        ui_spec = await self._generate_ui_components(
            intent_analysis, fhir_data, context
        )
        
        # Add data bindings
        ui_spec = await self._add_data_bindings(ui_spec, fhir_data)
        
        return {
            "prompt": prompt,
            "intent": intent_analysis,
            "components": ui_spec["components"],
            "layout": ui_spec["layout"],
            "dataBindings": ui_spec["dataBindings"],
            "actions": ui_spec["actions"],
            "metadata": {
                "generatedAt": datetime.utcnow().isoformat(),
                "fhirResources": list(required_resources.keys()),
                "canvasVersion": "1.0"
            }
        }
    
    async def _analyze_prompt(
        self,
        prompt: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyze prompt to understand intent and requirements."""
        if self.claude:
            # Use Claude to analyze the prompt
            system_prompt = """You are analyzing clinical UI generation requests.
            Extract the intent, required data types, and UI components needed.
            
            Respond with JSON containing:
            - intent: The main purpose (view, edit, analyze, etc.)
            - dataTypes: List of clinical data types needed
            - components: Suggested UI components
            - workflow: Any workflow requirements
            """
            
            response = await self.claude.messages.create(
                model="claude-3-opus-20240229",
                system=system_prompt,
                messages=[{
                    "role": "user",
                    "content": f"Analyze this clinical UI request:\n{prompt}\n\nContext: {json.dumps(context)}"
                }],
                max_tokens=1000
            )
            
            # Parse Claude's response
            try:
                return json.loads(response.content[0].text)
            except:
                # Fallback to rule-based analysis
                pass
        
        # Rule-based analysis fallback
        intent = "view"  # default
        data_types = []
        components = []
        
        prompt_lower = prompt.lower()
        
        # Detect intent
        if any(word in prompt_lower for word in ["edit", "update", "modify", "change"]):
            intent = "edit"
        elif any(word in prompt_lower for word in ["analyze", "trend", "graph", "chart"]):
            intent = "analyze"
        elif any(word in prompt_lower for word in ["create", "new", "add"]):
            intent = "create"
        
        # Detect data types
        if "vitals" in prompt_lower or "vital signs" in prompt_lower:
            data_types.append("Observation")
            components.append("VitalSignsPanel")
        
        if "medication" in prompt_lower or "meds" in prompt_lower:
            data_types.append("MedicationRequest")
            components.append("MedicationList")
        
        if "lab" in prompt_lower or "laboratory" in prompt_lower:
            data_types.append("Observation")
            components.append("LabResultsTable")
        
        if "condition" in prompt_lower or "diagnosis" in prompt_lower:
            data_types.append("Condition")
            components.append("ProblemList")
        
        if "allergy" in prompt_lower:
            data_types.append("AllergyIntolerance")
            components.append("AllergyList")
        
        return {
            "intent": intent,
            "dataTypes": data_types,
            "components": components,
            "workflow": None
        }
    
    async def _identify_required_resources(
        self,
        intent_analysis: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Dict[str, Any]]:
        """Identify which FHIR resources need to be fetched."""
        resources = {}
        patient_id = context.get("patientId")
        
        if not patient_id:
            return resources
        
        # Always include patient
        resources["Patient"] = {
            "url": f"Patient/{patient_id}",
            "params": {}
        }
        
        # Add resources based on data types
        for data_type in intent_analysis.get("dataTypes", []):
            if data_type == "Observation":
                # Determine observation category
                if "vitals" in str(intent_analysis):
                    resources["VitalSigns"] = {
                        "url": "Observation",
                        "params": {
                            "patient": patient_id,
                            "category": "vital-signs",
                            "_sort": "-date",
                            "_count": "20"
                        }
                    }
                elif "lab" in str(intent_analysis):
                    resources["LabResults"] = {
                        "url": "Observation",
                        "params": {
                            "patient": patient_id,
                            "category": "laboratory",
                            "_sort": "-date",
                            "_count": "50"
                        }
                    }
                else:
                    resources["Observations"] = {
                        "url": "Observation",
                        "params": {
                            "patient": patient_id,
                            "_sort": "-date",
                            "_count": "100"
                        }
                    }
            
            elif data_type == "MedicationRequest":
                resources["Medications"] = {
                    "url": "MedicationRequest",
                    "params": {
                        "patient": patient_id,
                        "status": "active",
                        "_sort": "-authoredon"
                    }
                }
            
            elif data_type == "Condition":
                resources["Conditions"] = {
                    "url": "Condition",
                    "params": {
                        "patient": patient_id,
                        "clinical-status": "active",
                        "_sort": "-recorded-date"
                    }
                }
            
            elif data_type == "AllergyIntolerance":
                resources["Allergies"] = {
                    "url": "AllergyIntolerance",
                    "params": {
                        "patient": patient_id
                    }
                }
        
        return resources
    
    async def _fetch_fhir_data(
        self,
        required_resources: Dict[str, Dict[str, Any]],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Fetch data from FHIR API."""
        fhir_data = {}
        
        async with httpx.AsyncClient() as client:
            # Add authentication if available
            headers = {}
            if context.get("authToken"):
                headers["Authorization"] = f"Bearer {context['authToken']}"
            
            for resource_name, resource_spec in required_resources.items():
                try:
                    if "/" in resource_spec["url"]:
                        # Direct resource read
                        response = await client.get(
                            f"{self.fhir_base_url}/{resource_spec['url']}",
                            headers=headers
                        )
                    else:
                        # Search operation
                        response = await client.get(
                            f"{self.fhir_base_url}/{resource_spec['url']}",
                            params=resource_spec["params"],
                            headers=headers
                        )
                    
                    if response.status_code == 200:
                        data = response.json()
                        
                        # Handle bundles vs single resources
                        if data.get("resourceType") == "Bundle":
                            fhir_data[resource_name] = [
                                entry["resource"] for entry in data.get("entry", [])
                            ]
                        else:
                            fhir_data[resource_name] = data
                    else:
                        fhir_data[resource_name] = None
                        
                except Exception as e:
                    print(f"Error fetching {resource_name}: {e}")
                    fhir_data[resource_name] = None
        
        return fhir_data
    
    async def _generate_ui_components(
        self,
        intent_analysis: Dict[str, Any],
        fhir_data: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate UI component specifications."""
        components = []
        layout = {
            "type": "responsive-grid",
            "columns": 12,
            "gap": 16,
            "padding": 16
        }
        data_bindings = {}
        actions = []
        
        # Generate components based on intent and available data
        component_id = 0
        
        # Patient header
        if "Patient" in fhir_data and fhir_data["Patient"]:
            patient = fhir_data["Patient"]
            component_id += 1
            components.append({
                "id": f"component-{component_id}",
                "type": "PatientHeader",
                "props": {
                    "patientId": patient.get("id"),
                    "showDemographics": True,
                    "showAlerts": True
                },
                "layout": {
                    "column": "1 / -1",
                    "row": "auto"
                }
            })
            data_bindings[f"component-{component_id}"] = {
                "source": "fhir.Patient",
                "fields": ["name", "birthDate", "gender", "identifier"]
            }
        
        # Vital signs panel
        if "VitalSigns" in fhir_data and fhir_data["VitalSigns"]:
            component_id += 1
            components.append({
                "id": f"component-{component_id}",
                "type": "VitalSignsPanel",
                "props": {
                    "displayMode": "card" if intent_analysis["intent"] == "view" else "form",
                    "showTrends": intent_analysis["intent"] == "analyze",
                    "editable": intent_analysis["intent"] == "edit"
                },
                "layout": {
                    "column": "1 / 7",
                    "row": "auto"
                }
            })
            data_bindings[f"component-{component_id}"] = {
                "source": "fhir.VitalSigns",
                "transform": "groupByCode",
                "fields": ["code", "value", "effectiveDateTime", "status"]
            }
        
        # Lab results
        if "LabResults" in fhir_data and fhir_data["LabResults"]:
            component_id += 1
            display_type = "table"
            if intent_analysis["intent"] == "analyze":
                display_type = "chart"
            
            components.append({
                "id": f"component-{component_id}",
                "type": "LabResultsDisplay",
                "props": {
                    "displayType": display_type,
                    "groupByPanel": True,
                    "showReferenceRanges": True,
                    "highlightAbnormal": True
                },
                "layout": {
                    "column": "7 / -1" if "VitalSigns" in fhir_data else "1 / -1",
                    "row": "auto"
                }
            })
            data_bindings[f"component-{component_id}"] = {
                "source": "fhir.LabResults",
                "transform": "sortByDate",
                "fields": ["code", "value", "referenceRange", "effectiveDateTime", "status"]
            }
        
        # Medications
        if "Medications" in fhir_data and fhir_data["Medications"]:
            component_id += 1
            components.append({
                "id": f"component-{component_id}",
                "type": "MedicationList",
                "props": {
                    "view": "active",
                    "showDosage": True,
                    "showRefills": True,
                    "allowDiscontinue": intent_analysis["intent"] == "edit",
                    "allowRenew": intent_analysis["intent"] == "edit"
                },
                "layout": {
                    "column": "1 / 7",
                    "row": "auto"
                }
            })
            data_bindings[f"component-{component_id}"] = {
                "source": "fhir.Medications",
                "fields": ["medicationCodeableConcept", "dosageInstruction", "status", "authoredOn"]
            }
            
            if intent_analysis["intent"] == "edit":
                actions.append({
                    "id": "discontinue-medication",
                    "type": "fhir-update",
                    "resource": "MedicationRequest",
                    "confirmation": "Discontinue this medication?"
                })
        
        # Problem list
        if "Conditions" in fhir_data and fhir_data["Conditions"]:
            component_id += 1
            components.append({
                "id": f"component-{component_id}",
                "type": "ProblemList",
                "props": {
                    "groupByCategory": True,
                    "showOnsetDate": True,
                    "allowEdit": intent_analysis["intent"] == "edit"
                },
                "layout": {
                    "column": "7 / -1" if "Medications" in fhir_data else "1 / -1",
                    "row": "auto"
                }
            })
            data_bindings[f"component-{component_id}"] = {
                "source": "fhir.Conditions",
                "fields": ["code", "clinicalStatus", "verificationStatus", "onsetDateTime", "category"]
            }
        
        # Allergies
        if "Allergies" in fhir_data and fhir_data["Allergies"]:
            component_id += 1
            components.append({
                "id": f"component-{component_id}",
                "type": "AllergyAlert",
                "props": {
                    "displayMode": "banner",
                    "showReactions": True,
                    "severity": "highlight"
                },
                "layout": {
                    "column": "1 / -1",
                    "row": "auto"
                }
            })
            data_bindings[f"component-{component_id}"] = {
                "source": "fhir.Allergies",
                "fields": ["code", "clinicalStatus", "type", "category", "reaction"]
            }
        
        # Add action buttons if in edit mode
        if intent_analysis["intent"] in ["edit", "create"]:
            component_id += 1
            components.append({
                "id": f"component-{component_id}",
                "type": "ActionBar",
                "props": {
                    "actions": [
                        {"label": "Save", "action": "save-all", "primary": True},
                        {"label": "Cancel", "action": "cancel"},
                        {"label": "Reset", "action": "reset"}
                    ]
                },
                "layout": {
                    "column": "1 / -1",
                    "row": "auto",
                    "sticky": "bottom"
                }
            })
            
            actions.extend([
                {
                    "id": "save-all",
                    "type": "batch-fhir-update",
                    "confirmation": "Save all changes?"
                },
                {
                    "id": "cancel",
                    "type": "navigate-back"
                },
                {
                    "id": "reset",
                    "type": "reset-form"
                }
            ])
        
        return {
            "components": components,
            "layout": layout,
            "dataBindings": data_bindings,
            "actions": actions
        }
    
    async def _add_data_bindings(
        self,
        ui_spec: Dict[str, Any],
        fhir_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Add reactive data bindings to UI specification."""
        # Add data transformation functions
        ui_spec["transforms"] = {
            "groupByCode": """
                function(observations) {
                    const grouped = {};
                    observations.forEach(obs => {
                        const code = obs.code?.coding?.[0]?.code || 'unknown';
                        if (!grouped[code]) grouped[code] = [];
                        grouped[code].push(obs);
                    });
                    return grouped;
                }
            """,
            "sortByDate": """
                function(resources) {
                    return resources.sort((a, b) => {
                        const dateA = a.effectiveDateTime || a.authoredOn || a.recordedDate;
                        const dateB = b.effectiveDateTime || b.authoredOn || b.recordedDate;
                        return new Date(dateB) - new Date(dateA);
                    });
                }
            """
        }
        
        # Add real-time update subscriptions
        ui_spec["subscriptions"] = []
        for resource_type in set(db.split(".")[1] for db in ui_spec["dataBindings"].values() if "source" in db):
            if resource_type in ["Patient", "Observation", "MedicationRequest", "Condition"]:
                ui_spec["subscriptions"].append({
                    "resource": resource_type,
                    "criteria": f"patient={fhir_data.get('Patient', {}).get('id')}",
                    "channel": "websocket"
                })
        
        return ui_spec
    
    async def enhance_existing_ui(
        self,
        current_ui: Dict[str, Any],
        enhancement_prompt: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Enhance an existing UI based on natural language feedback."""
        # Analyze enhancement request
        enhancement_analysis = await self._analyze_prompt(enhancement_prompt, context)
        
        # Modify existing UI spec
        enhanced_ui = current_ui.copy()
        
        # Add new components if needed
        if enhancement_analysis.get("components"):
            # Find insertion point
            insert_index = len(enhanced_ui["components"])
            
            # Generate new components
            new_components = await self._generate_ui_components(
                enhancement_analysis,
                {},  # Will fetch data as needed
                context
            )
            
            # Merge components
            enhanced_ui["components"].extend(new_components["components"])
            enhanced_ui["dataBindings"].update(new_components["dataBindings"])
            enhanced_ui["actions"].extend(new_components["actions"])
        
        # Modify existing components if requested
        for component in enhanced_ui["components"]:
            # Apply modifications based on enhancement request
            if "larger" in enhancement_prompt.lower() and component["type"] == "VitalSignsPanel":
                component["layout"]["column"] = "1 / -1"
            
            if "editable" in enhancement_prompt.lower():
                component["props"]["editable"] = True
            
            if "hide" in enhancement_prompt.lower():
                # Mark components for hiding based on prompt
                pass
        
        return enhanced_ui
    
    async def validate_ui_spec(self, ui_spec: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Validate a UI specification for completeness and correctness."""
        errors = []
        
        # Check required fields
        if "components" not in ui_spec:
            errors.append("Missing required field: components")
        
        if "layout" not in ui_spec:
            errors.append("Missing required field: layout")
        
        # Validate components
        for i, component in enumerate(ui_spec.get("components", [])):
            if "id" not in component:
                errors.append(f"Component {i} missing id")
            
            if "type" not in component:
                errors.append(f"Component {i} missing type")
            
            # Check data bindings exist
            if component.get("id") in ui_spec.get("dataBindings", {}):
                binding = ui_spec["dataBindings"][component["id"]]
                if "source" not in binding:
                    errors.append(f"Component {component['id']} data binding missing source")
        
        # Validate actions
        for action in ui_spec.get("actions", []):
            if "id" not in action:
                errors.append("Action missing id")
            
            if "type" not in action:
                errors.append("Action missing type")
        
        return len(errors) == 0, errors