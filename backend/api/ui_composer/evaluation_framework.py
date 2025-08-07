"""
Evaluation Framework for Multi-LLM Provider Comparison
Provides systematic evaluation of provider performance and quality
"""

import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import statistics
from collections import defaultdict

from .llm_service import unified_llm_service
from .llm_providers.base_provider import LLMProvider

logger = logging.getLogger(__name__)

class ProviderEvaluationFramework:
    """Framework for systematic evaluation of LLM providers"""
    
    def __init__(self, output_dir: str = "evaluation_results"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.metrics = defaultdict(lambda: defaultdict(list))
        
    # Clinical Test Scenarios
    CLINICAL_SCENARIOS = [
        {
            "id": "vital_signs_basic",
            "name": "Basic Vital Signs Display",
            "request": "Show current vital signs for this patient",
            "complexity": "low",
            "expected_resources": ["Observation"],
            "expected_ui_type": "display"
        },
        {
            "id": "hypertension_management",
            "name": "Hypertension Management Dashboard",
            "request": "Display blood pressure trends with medication timeline for hypertension management",
            "complexity": "medium",
            "expected_resources": ["Observation", "MedicationRequest"],
            "expected_ui_type": "dashboard"
        },
        {
            "id": "diabetes_monitoring",
            "name": "Diabetes Monitoring with Labs",
            "request": "Show HbA1c trends, glucose readings, and related medications for diabetic patients",
            "complexity": "medium",
            "expected_resources": ["Observation", "MedicationRequest", "Condition"],
            "expected_ui_type": "dashboard"
        },
        {
            "id": "sepsis_risk",
            "name": "Sepsis Risk Assessment",
            "request": "Identify patients at risk for sepsis based on recent lab values and vital signs",
            "complexity": "high",
            "expected_resources": ["Observation", "DiagnosticReport", "Condition"],
            "expected_ui_type": "alert"
        },
        {
            "id": "population_health",
            "name": "Population Health Analytics",
            "request": "Show population-level statistics for chronic disease management across all patients",
            "complexity": "high",
            "expected_resources": ["Patient", "Condition", "Observation"],
            "expected_ui_type": "analytics"
        }
    ]
    
    # Quality Criteria
    QUALITY_CRITERIA = {
        "intent_accuracy": {
            "weight": 0.25,
            "description": "How well the provider understood the clinical intent"
        },
        "resource_selection": {
            "weight": 0.20,
            "description": "Appropriate FHIR resource selection"
        },
        "query_efficiency": {
            "weight": 0.15,
            "description": "Efficiency of generated FHIR queries"
        },
        "ui_appropriateness": {
            "weight": 0.20,
            "description": "Appropriateness of UI component selection"
        },
        "code_quality": {
            "weight": 0.20,
            "description": "Quality of generated React code"
        }
    }
    
    async def run_comprehensive_evaluation(self, 
                                         providers: Optional[List[LLMProvider]] = None,
                                         scenarios: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """Run comprehensive evaluation across all scenarios and providers"""
        
        if providers is None:
            status = await unified_llm_service.get_available_providers()
            providers = [p for p, info in status.items() if info.get("available")]
            
        if scenarios is None:
            scenarios = self.CLINICAL_SCENARIOS
            
        logger.info(f"Starting evaluation with {len(providers)} providers and {len(scenarios)} scenarios")
        
        results = {
            "evaluation_id": datetime.now().isoformat(),
            "providers": providers,
            "scenarios": scenarios,
            "provider_scores": {},
            "scenario_results": {},
            "performance_metrics": {},
            "recommendations": []
        }
        
        # Run each scenario with each provider
        for scenario in scenarios:
            scenario_id = scenario["id"]
            results["scenario_results"][scenario_id] = {}
            
            for provider in providers:
                logger.info(f"Evaluating {provider} on scenario: {scenario_id}")
                
                try:
                    eval_result = await self._evaluate_scenario(provider, scenario)
                    results["scenario_results"][scenario_id][provider] = eval_result
                    
                    # Collect metrics
                    self._collect_metrics(provider, scenario_id, eval_result)
                    
                except Exception as e:
                    logger.error(f"Error evaluating {provider} on {scenario_id}: {e}")
                    results["scenario_results"][scenario_id][provider] = {
                        "error": str(e),
                        "success": False
                    }
        
        # Calculate overall scores
        results["provider_scores"] = self._calculate_provider_scores()
        results["performance_metrics"] = self._calculate_performance_metrics()
        results["recommendations"] = self._generate_recommendations(results)
        
        # Save results
        await self._save_evaluation_results(results)
        
        return results
    
    async def _evaluate_scenario(self, provider: LLMProvider, scenario: Dict) -> Dict[str, Any]:
        """Evaluate a single scenario with a provider"""
        
        context = {
            "user_role": "physician",
            "evaluation_mode": True
        }
        
        start_time = datetime.now()
        
        # Phase 1: Clinical Request Analysis
        analysis_result = await self._evaluate_analysis(provider, scenario, context)
        
        # Phase 2: FHIR Query Generation
        query_result = await self._evaluate_queries(provider, scenario, analysis_result)
        
        # Phase 3: UI Component Generation (simplified)
        ui_result = await self._evaluate_ui_generation(provider, scenario, analysis_result)
        
        elapsed_time = (datetime.now() - start_time).total_seconds()
        
        # Calculate quality scores
        quality_scores = self._calculate_quality_scores(
            scenario, analysis_result, query_result, ui_result
        )
        
        return {
            "success": True,
            "phases": {
                "analysis": analysis_result,
                "queries": query_result,
                "ui_generation": ui_result
            },
            "quality_scores": quality_scores,
            "overall_score": sum(score * self.QUALITY_CRITERIA[criterion]["weight"] 
                               for criterion, score in quality_scores.items()),
            "execution_time": elapsed_time
        }
    
    async def _evaluate_analysis(self, provider: LLMProvider, scenario: Dict, context: Dict) -> Dict:
        """Evaluate clinical request analysis"""
        
        try:
            # Use unified service with specific provider
            service_provider = unified_llm_service.providers.get(provider)
            if not service_provider:
                return {"error": f"Provider {provider} not available"}
                
            result = await service_provider.analyze_clinical_request(
                scenario["request"], 
                context
            )
            
            return {
                "success": True,
                "analysis": result,
                "intent_match": self._check_intent_match(result, scenario),
                "resource_match": self._check_resource_match(result, scenario)
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _evaluate_queries(self, provider: LLMProvider, scenario: Dict, analysis_result: Dict) -> Dict:
        """Evaluate FHIR query generation"""
        
        if not analysis_result.get("success"):
            return {"skipped": True, "reason": "Analysis failed"}
            
        try:
            service_provider = unified_llm_service.providers.get(provider)
            available_resources = ["Patient", "Observation", "Condition", 
                                 "MedicationRequest", "DiagnosticReport", 
                                 "AllergyIntolerance", "Procedure"]
            
            result = await service_provider.generate_fhir_queries(
                scenario["request"],
                available_resources
            )
            
            # Evaluate query quality
            query_metrics = self._evaluate_query_quality(result, scenario)
            
            return {
                "success": True,
                "queries": result,
                "metrics": query_metrics
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _evaluate_ui_generation(self, provider: LLMProvider, scenario: Dict, analysis_result: Dict) -> Dict:
        """Evaluate UI component generation"""
        
        if not analysis_result.get("success"):
            return {"skipped": True, "reason": "Analysis failed"}
            
        try:
            # Create a simplified specification for testing
            specification = {
                "metadata": {
                    "intent": scenario["request"],
                    "complexity": scenario["complexity"]
                },
                "components": [{
                    "type": analysis_result.get("analysis", {}).get("ui_type", "display"),
                    "dataBinding": {
                        "resourceTypes": scenario["expected_resources"]
                    }
                }]
            }
            
            # Mock FHIR data
            fhir_data = {
                resource: [] for resource in scenario["expected_resources"]
            }
            
            service_provider = unified_llm_service.providers.get(provider)
            component_code = await service_provider.generate_ui_component(
                specification,
                fhir_data
            )
            
            # Evaluate code quality
            code_metrics = self._evaluate_code_quality(component_code)
            
            return {
                "success": True,
                "component_length": len(component_code),
                "metrics": code_metrics
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _check_intent_match(self, analysis: Dict, scenario: Dict) -> float:
        """Check if provider understood the clinical intent"""
        # Simplified scoring - in production, use NLP similarity
        intent = analysis.get("intent", "").lower()
        expected_keywords = scenario["name"].lower().split()
        
        matches = sum(1 for keyword in expected_keywords if keyword in intent)
        return matches / len(expected_keywords) if expected_keywords else 0
    
    def _check_resource_match(self, analysis: Dict, scenario: Dict) -> float:
        """Check if provider identified correct resources"""
        identified = set(analysis.get("data_needs", []))
        expected = set(scenario["expected_resources"])
        
        if not expected:
            return 1.0
            
        intersection = identified & expected
        union = identified | expected
        
        return len(intersection) / len(union) if union else 0
    
    def _evaluate_query_quality(self, queries: Dict, scenario: Dict) -> Dict:
        """Evaluate the quality of generated FHIR queries"""
        metrics = {
            "has_queries": bool(queries.get("queries")),
            "query_count": len(queries.get("queries", [])),
            "uses_appropriate_filters": False,
            "efficiency_score": 0.5
        }
        
        # Check for appropriate filtering
        if isinstance(queries.get("queries"), list):
            for query in queries["queries"]:
                if any(key in str(query) for key in ["patient", "date", "code"]):
                    metrics["uses_appropriate_filters"] = True
                    metrics["efficiency_score"] = 0.8
                    break
                    
        return metrics
    
    def _evaluate_code_quality(self, code: str) -> Dict:
        """Evaluate the quality of generated React code"""
        metrics = {
            "has_react_component": "React" in code or "function" in code,
            "uses_hooks": "useState" in code or "useEffect" in code,
            "has_error_handling": "error" in code.lower() or "catch" in code,
            "has_loading_state": "loading" in code.lower(),
            "uses_mui": "@mui" in code or "Material" in code,
            "follows_patterns": "useFHIRResource" in code or "fhirService" in code
        }
        
        metrics["quality_score"] = sum(1 for v in metrics.values() if v) / len(metrics)
        
        return metrics
    
    def _calculate_quality_scores(self, scenario: Dict, analysis: Dict, 
                                queries: Dict, ui: Dict) -> Dict[str, float]:
        """Calculate quality scores for each criterion"""
        
        scores = {}
        
        # Intent accuracy
        scores["intent_accuracy"] = analysis.get("intent_match", 0)
        
        # Resource selection
        scores["resource_selection"] = analysis.get("resource_match", 0)
        
        # Query efficiency
        if queries.get("success"):
            metrics = queries.get("metrics", {})
            scores["query_efficiency"] = metrics.get("efficiency_score", 0.5)
        else:
            scores["query_efficiency"] = 0
        
        # UI appropriateness
        if analysis.get("success"):
            ui_type = analysis.get("analysis", {}).get("ui_type", "")
            expected_ui = scenario.get("expected_ui_type", "")
            scores["ui_appropriateness"] = 1.0 if ui_type == expected_ui else 0.5
        else:
            scores["ui_appropriateness"] = 0
        
        # Code quality
        if ui.get("success"):
            scores["code_quality"] = ui.get("metrics", {}).get("quality_score", 0)
        else:
            scores["code_quality"] = 0
            
        return scores
    
    def _collect_metrics(self, provider: str, scenario_id: str, result: Dict):
        """Collect metrics for analysis"""
        if result.get("success"):
            self.metrics[provider]["execution_times"].append(result.get("execution_time", 0))
            self.metrics[provider]["quality_scores"].append(result.get("overall_score", 0))
            self.metrics[provider]["scenarios_completed"].append(scenario_id)
        else:
            self.metrics[provider]["failures"].append(scenario_id)
    
    def _calculate_provider_scores(self) -> Dict[str, Dict]:
        """Calculate overall scores for each provider"""
        
        scores = {}
        
        for provider, metrics in self.metrics.items():
            quality_scores = metrics.get("quality_scores", [])
            execution_times = metrics.get("execution_times", [])
            
            scores[provider] = {
                "average_quality": statistics.mean(quality_scores) if quality_scores else 0,
                "quality_std_dev": statistics.stdev(quality_scores) if len(quality_scores) > 1 else 0,
                "average_execution_time": statistics.mean(execution_times) if execution_times else 0,
                "success_rate": len(metrics.get("scenarios_completed", [])) / 
                              (len(metrics.get("scenarios_completed", [])) + 
                               len(metrics.get("failures", []))) if metrics else 0,
                "completed_scenarios": len(metrics.get("scenarios_completed", [])),
                "failed_scenarios": len(metrics.get("failures", []))
            }
            
        return scores
    
    def _calculate_performance_metrics(self) -> Dict[str, Any]:
        """Calculate performance comparison metrics"""
        
        all_times = []
        all_scores = []
        
        for metrics in self.metrics.values():
            all_times.extend(metrics.get("execution_times", []))
            all_scores.extend(metrics.get("quality_scores", []))
            
        return {
            "fastest_average_time": min((statistics.mean(m.get("execution_times", [999])) 
                                       for m in self.metrics.values() if m.get("execution_times"))),
            "best_average_quality": max((statistics.mean(m.get("quality_scores", [0])) 
                                       for m in self.metrics.values() if m.get("quality_scores"))),
            "most_consistent": min((p for p, m in self.metrics.items() if m.get("quality_scores")),
                                 key=lambda p: statistics.stdev(self.metrics[p]["quality_scores"]) 
                                 if len(self.metrics[p]["quality_scores"]) > 1 else 999),
            "overall_average_time": statistics.mean(all_times) if all_times else 0,
            "overall_average_quality": statistics.mean(all_scores) if all_scores else 0
        }
    
    def _generate_recommendations(self, results: Dict) -> List[str]:
        """Generate recommendations based on evaluation results"""
        
        recommendations = []
        scores = results.get("provider_scores", {})
        
        if not scores:
            return ["No providers successfully evaluated"]
        
        # Find best provider for quality
        best_quality_provider = max(scores.keys(), 
                                  key=lambda p: scores[p]["average_quality"])
        recommendations.append(
            f"Best quality: {best_quality_provider} "
            f"(score: {scores[best_quality_provider]['average_quality']:.2f})"
        )
        
        # Find fastest provider
        fastest_provider = min(scores.keys(), 
                             key=lambda p: scores[p]["average_execution_time"])
        recommendations.append(
            f"Fastest: {fastest_provider} "
            f"(avg: {scores[fastest_provider]['average_execution_time']:.2f}s)"
        )
        
        # Find most reliable
        most_reliable = max(scores.keys(), 
                          key=lambda p: scores[p]["success_rate"])
        recommendations.append(
            f"Most reliable: {most_reliable} "
            f"(success rate: {scores[most_reliable]['success_rate']:.1%})"
        )
        
        # Scenario-specific recommendations
        scenario_results = results.get("scenario_results", {})
        for scenario_id, providers in scenario_results.items():
            best_for_scenario = max(
                (p for p, r in providers.items() if r.get("success")),
                key=lambda p: providers[p].get("overall_score", 0),
                default=None
            )
            if best_for_scenario:
                scenario_name = next((s["name"] for s in self.CLINICAL_SCENARIOS 
                                    if s["id"] == scenario_id), scenario_id)
                recommendations.append(
                    f"Best for {scenario_name}: {best_for_scenario}"
                )
                
        return recommendations
    
    async def _save_evaluation_results(self, results: Dict):
        """Save evaluation results to files"""
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save JSON results
        json_file = self.output_dir / f"evaluation_{timestamp}.json"
        with open(json_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
            
        # Generate markdown report
        report_file = self.output_dir / f"evaluation_report_{timestamp}.md"
        report = self._generate_markdown_report(results)
        with open(report_file, 'w') as f:
            f.write(report)
            
        logger.info(f"Evaluation results saved to {json_file} and {report_file}")
    
    def _generate_markdown_report(self, results: Dict) -> str:
        """Generate a markdown report from evaluation results"""
        
        lines = []
        lines.append("# LLM Provider Evaluation Report")
        lines.append(f"\nGenerated: {results['evaluation_id']}")
        lines.append(f"\nProviders evaluated: {', '.join(results['providers'])}")
        lines.append(f"Scenarios tested: {len(results['scenarios'])}")
        
        # Provider scores
        lines.append("\n## Provider Performance Summary")
        lines.append("\n| Provider | Avg Quality | Success Rate | Avg Time |")
        lines.append("|----------|-------------|--------------|----------|")
        
        for provider, scores in results['provider_scores'].items():
            lines.append(
                f"| {provider} | "
                f"{scores['average_quality']:.2f} | "
                f"{scores['success_rate']:.1%} | "
                f"{scores['average_execution_time']:.2f}s |"
            )
        
        # Recommendations
        lines.append("\n## Recommendations")
        for rec in results['recommendations']:
            lines.append(f"- {rec}")
        
        # Detailed scenario results
        lines.append("\n## Scenario Results")
        for scenario_id, providers in results['scenario_results'].items():
            scenario = next((s for s in self.CLINICAL_SCENARIOS if s["id"] == scenario_id), {})
            lines.append(f"\n### {scenario.get('name', scenario_id)}")
            lines.append(f"Request: *{scenario.get('request', 'N/A')}*")
            
            for provider, result in providers.items():
                if result.get("success"):
                    lines.append(f"\n**{provider}**:")
                    lines.append(f"- Overall Score: {result.get('overall_score', 0):.2f}")
                    lines.append(f"- Execution Time: {result.get('execution_time', 0):.2f}s")
                    
                    # Quality scores
                    if result.get("quality_scores"):
                        lines.append("- Quality Scores:")
                        for criterion, score in result["quality_scores"].items():
                            lines.append(f"  - {criterion}: {score:.2f}")
                else:
                    lines.append(f"\n**{provider}**: Failed - {result.get('error', 'Unknown error')}")
        
        return "\n".join(lines)
    
    async def run_quick_test(self, providers: Optional[List[LLMProvider]] = None) -> Dict:
        """Run a quick test with just one scenario"""
        
        # Use just the first scenario for quick testing
        quick_scenarios = [self.CLINICAL_SCENARIOS[0]]
        
        return await self.run_comprehensive_evaluation(providers, quick_scenarios)


# Convenience function for running evaluations
async def run_provider_evaluation(quick_test: bool = False):
    """Run provider evaluation"""
    
    framework = ProviderEvaluationFramework()
    
    if quick_test:
        logger.info("Running quick test evaluation...")
        results = await framework.run_quick_test()
    else:
        logger.info("Running comprehensive evaluation...")
        results = await framework.run_comprehensive_evaluation()
    
    print(f"\nEvaluation complete!")
    print(f"Results saved to: {framework.output_dir}")
    
    # Print summary
    print("\n=== Provider Performance Summary ===")
    for provider, scores in results['provider_scores'].items():
        print(f"\n{provider}:")
        print(f"  Quality Score: {scores['average_quality']:.2f}")
        print(f"  Success Rate: {scores['success_rate']:.1%}")
        print(f"  Avg Time: {scores['average_execution_time']:.2f}s")
    
    print("\n=== Recommendations ===")
    for rec in results['recommendations']:
        print(f"- {rec}")
    
    return results


if __name__ == "__main__":
    # Run evaluation when executed directly
    import sys
    
    quick = "--quick" in sys.argv
    asyncio.run(run_provider_evaluation(quick_test=quick))