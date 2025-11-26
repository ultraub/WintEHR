"""
Integration layer for CDS Rules Engine with existing CDS Hooks services

Bridges the new rules engine with the existing CDS services implementation.
"""

import logging
import time
from typing import Dict, Any, List, Optional
from datetime import datetime, date

from .core import RulesEngine, RuleCategory, RulePriority, rules_engine
from .clinical_rules import ClinicalRulesLibrary
from .data_adapters import FHIRDataAdapter
from .safety import safety_manager, FeatureFlag

# NOTE: Legacy CDS services removed during v3.0 migration
# The rules engine is now the primary CDS evaluation system.
# Legacy fallback services are no longer maintained - the rules engine
# handles all CDS logic with proper fallback to empty cards.
# See services/builtin/ for the new v3.0 service architecture.

logger = logging.getLogger(__name__)


class CDSRulesIntegration:
    """
    Integrates the rules engine with CDS Hooks infrastructure.

    v3.0 Migration Notes:
    - Legacy service fallbacks removed in favor of rules engine
    - Rules engine is now the primary CDS evaluation system
    - Empty legacy_services dict maintained for API compatibility
    - Fallback logic gracefully returns empty cards when needed
    """

    def __init__(self):
        self.rules_engine = rules_engine
        self.fhir_adapter = FHIRDataAdapter()
        # Legacy services removed in v3.0 - rules engine handles all CDS logic
        # Empty dict ensures fallback code paths return empty cards gracefully
        self.legacy_services: Dict[str, Any] = {}
        self._initialize_rules()
    
    def _initialize_rules(self):
        """Load all clinical rules into the engine"""
        rule_sets = ClinicalRulesLibrary.load_all_rules()
        for name, rule_set in rule_sets.items():
            self.rules_engine.add_rule_set(rule_set)
        logger.info(f"Initialized {len(rule_sets)} rule sets in CDS rules engine")
    
    async def execute_hook(
        self,
        hook: str,
        context: Dict[str, Any],
        prefetch: Optional[Dict[str, Any]] = None,
        use_legacy: bool = False
    ) -> Dict[str, Any]:
        """
        Execute a CDS Hook with the rules engine
        
        Args:
            hook: CDS Hook name (e.g., "medication-prescribe")
            context: CDS Hook context
            prefetch: Prefetched FHIR resources
            use_legacy: Whether to include legacy service results
            
        Returns:
            CDS Hook response with cards
        """
        service_name = f"rules_engine_{hook}"
        start_time = time.time()
        
        try:
            # Check feature flags
            if not safety_manager.is_enabled(FeatureFlag.RULES_ENGINE_ENABLED):
                logger.info("Rules engine disabled by feature flag")
                if use_legacy and hook in self.legacy_services:
                    return self.legacy_services[hook].execute(context, prefetch or {})
                return {"cards": []}
            
            # Check circuit breaker
            if not safety_manager.check_circuit_breaker(service_name):
                logger.warning(f"Circuit breaker open for {service_name}")
                if use_legacy and hook in self.legacy_services:
                    return self.legacy_services[hook].execute(context, prefetch or {})
                return {"cards": []}
            
            # Check rate limit
            client_id = context.get("userId", "anonymous")
            if not safety_manager.check_rate_limit(client_id):
                logger.warning(f"Rate limit exceeded for {client_id}")
                return {"cards": [], "error": "Rate limit exceeded"}
            
            # Adapt FHIR data to rules engine format
            adapted_context = await self.fhir_adapter.adapt_cds_context(context, prefetch)
            
            # Determine which rule categories to evaluate based on hook
            categories = self._get_categories_for_hook(hook)
            
            # Execute rules engine
            engine_response = await self.rules_engine.evaluate(
                context=adapted_context,
                categories=categories
            )
            
            # Optionally merge with legacy service results
            if use_legacy and safety_manager.is_enabled(FeatureFlag.HYBRID_MODE_ENABLED):
                if hook in self.legacy_services:
                    legacy_response = self.legacy_services[hook].execute(context, prefetch or {})
                    engine_response = self._merge_responses(engine_response, legacy_response)
            
            # Update metrics
            response_time = (time.time() - start_time) * 1000  # Convert to milliseconds
            safety_manager.record_success(service_name, response_time)
            
            if safety_manager.is_enabled(FeatureFlag.METRICS_COLLECTION_ENABLED):
                safety_manager.performance_metrics.rules_evaluated += len(
                    adapted_context.get("conditions", [])
                )
                safety_manager.performance_metrics.cards_generated += len(
                    engine_response.get("cards", [])
                )
            
            # Add metadata
            engine_response["_metadata"] = {
                "engine": "rules_engine_v2",
                "timestamp": datetime.utcnow().isoformat(),
                "rule_sets_evaluated": len(categories) if categories else "all",
                "response_time_ms": response_time,
                "circuit_breaker_state": safety_manager.circuit_breakers[service_name].state
            }
            
            # Record A/B test result if enabled
            if safety_manager.is_enabled(FeatureFlag.A_B_TESTING_ENABLED):
                safety_manager.record_ab_test_result(True, True)
            
            return engine_response
            
        except Exception as e:
            logger.error(f"Error executing rules engine for {hook}: {e}")
            safety_manager.record_failure(service_name, e)
            
            # Record A/B test failure
            if safety_manager.is_enabled(FeatureFlag.A_B_TESTING_ENABLED):
                safety_manager.record_ab_test_result(True, False)
            
            # Fallback to legacy if available
            if use_legacy and hook in self.legacy_services:
                try:
                    return self.legacy_services[hook].execute(context, prefetch or {})
                except Exception as legacy_error:
                    logger.error(f"Legacy service also failed: {legacy_error}")
            
            return {"cards": [], "error": str(e)}
    
    def _get_categories_for_hook(self, hook: str) -> Optional[List[RuleCategory]]:
        """Map CDS Hook to relevant rule categories"""
        hook_mapping = {
            "medication-prescribe": [
                RuleCategory.MEDICATION_SAFETY,
                RuleCategory.DRUG_INTERACTIONS,
                RuleCategory.ALLERGIES
            ],
            "order-select": [
                RuleCategory.LAB_MONITORING,
                RuleCategory.CLINICAL_GUIDELINES
            ],
            "patient-view": [
                RuleCategory.CHRONIC_DISEASE,
                RuleCategory.PREVENTIVE_CARE,
                RuleCategory.QUALITY_MEASURES,
                RuleCategory.ALERTS
            ],
            "encounter-start": [
                RuleCategory.VITAL_SIGNS,
                RuleCategory.CLINICAL_GUIDELINES,
                RuleCategory.PREVENTIVE_CARE
            ],
            "encounter-discharge": [
                RuleCategory.MEDICATION_SAFETY,
                RuleCategory.QUALITY_MEASURES
            ]
        }
        
        return hook_mapping.get(hook)
    
    def _merge_responses(
        self,
        engine_response: Dict[str, Any],
        legacy_response: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Merge rules engine and legacy service responses"""
        merged = engine_response.copy()
        
        # Merge cards
        engine_cards = engine_response.get("cards", [])
        legacy_cards = legacy_response.get("cards", [])
        
        # Add source info to legacy cards
        for card in legacy_cards:
            if "source" not in card:
                card["source"] = {"label": "Legacy CDS Service"}
        
        merged["cards"] = engine_cards + legacy_cards
        
        # Merge suggestions
        if "suggestions" in legacy_response:
            merged.setdefault("suggestions", []).extend(legacy_response["suggestions"])
        
        return merged
    
    async def get_rule_statistics(self) -> Dict[str, Any]:
        """Get statistics about rules and their usage"""
        stats = {
            "total_rule_sets": len(self.rules_engine.rule_sets),
            "total_rules": sum(
                len(rule_set.rules) 
                for rule_set in self.rules_engine.rule_sets.values()
            ),
            "rules_by_category": {},
            "rules_by_priority": {},
            "enabled_rules": 0
        }
        
        # Count rules by category and priority
        for rule_set in self.rules_engine.rule_sets.values():
            for rule in rule_set.rules:
                # Category count
                category = rule.category.value
                stats["rules_by_category"][category] = stats["rules_by_category"].get(category, 0) + 1
                
                # Priority count
                priority = rule.priority.value
                stats["rules_by_priority"][priority] = stats["rules_by_priority"].get(priority, 0) + 1
                
                # Enabled count
                if rule.enabled:
                    stats["enabled_rules"] += 1
        
        return stats
    
    def add_custom_rule(self, rule_set_name: str, rule: Any):
        """Add a custom rule to a rule set"""
        rule_set = self.rules_engine.get_rule_set(rule_set_name)
        if rule_set:
            rule_set.add_rule(rule)
            logger.info(f"Added custom rule {rule.id} to rule set {rule_set_name}")
        else:
            logger.error(f"Rule set {rule_set_name} not found")
    
    def toggle_rule(self, rule_set_name: str, rule_id: str, enabled: bool):
        """Enable or disable a specific rule"""
        rule_set = self.rules_engine.get_rule_set(rule_set_name)
        if rule_set:
            rule = rule_set.get_rule(rule_id)
            if rule:
                rule.enabled = enabled
                logger.info(f"Rule {rule_id} {'enabled' if enabled else 'disabled'}")
            else:
                logger.error(f"Rule {rule_id} not found in rule set {rule_set_name}")
        else:
            logger.error(f"Rule set {rule_set_name} not found")


# Global integration instance
cds_integration = CDSRulesIntegration()