"""
Safety features for CDS Rules Engine

Provides feature flags, circuit breakers, and monitoring for safe operation.
"""

import logging
import time
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from collections import defaultdict, deque
import asyncio
from enum import Enum

logger = logging.getLogger(__name__)


class FeatureFlag(Enum):
    """Feature flags for rules engine control"""
    RULES_ENGINE_ENABLED = "rules_engine_enabled"
    HYBRID_MODE_ENABLED = "hybrid_mode_enabled"
    CUSTOM_RULES_ENABLED = "custom_rules_enabled"
    DEBUG_MODE_ENABLED = "debug_mode_enabled"
    METRICS_COLLECTION_ENABLED = "metrics_collection_enabled"
    A_B_TESTING_ENABLED = "a_b_testing_enabled"
    CACHE_ENABLED = "cache_enabled"
    PARALLEL_EVALUATION_ENABLED = "parallel_evaluation_enabled"


@dataclass
class CircuitBreakerState:
    """Circuit breaker state tracking"""
    failure_count: int = 0
    success_count: int = 0
    last_failure_time: Optional[datetime] = None
    last_success_time: Optional[datetime] = None
    state: str = "closed"  # closed, open, half-open
    opened_at: Optional[datetime] = None


@dataclass
class PerformanceMetrics:
    """Performance metrics for rules engine"""
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    total_response_time: float = 0.0
    rule_evaluation_times: Dict[str, float] = field(default_factory=dict)
    cache_hits: int = 0
    cache_misses: int = 0
    rules_evaluated: int = 0
    cards_generated: int = 0
    response_times: deque = field(default_factory=lambda: deque(maxlen=1000))


class RulesEngineSafety:
    """Safety manager for rules engine"""
    
    def __init__(self):
        self.feature_flags: Dict[str, bool] = {
            FeatureFlag.RULES_ENGINE_ENABLED.value: True,
            FeatureFlag.HYBRID_MODE_ENABLED.value: True,
            FeatureFlag.CUSTOM_RULES_ENABLED.value: True,
            FeatureFlag.DEBUG_MODE_ENABLED.value: False,
            FeatureFlag.METRICS_COLLECTION_ENABLED.value: True,
            FeatureFlag.A_B_TESTING_ENABLED.value: False,
            FeatureFlag.CACHE_ENABLED.value: True,
            FeatureFlag.PARALLEL_EVALUATION_ENABLED.value: True
        }
        
        self.circuit_breakers: Dict[str, CircuitBreakerState] = defaultdict(CircuitBreakerState)
        self.performance_metrics = PerformanceMetrics()
        
        # Configuration
        self.failure_threshold = 5
        self.success_threshold = 3
        self.timeout_duration = timedelta(minutes=5)
        self.half_open_duration = timedelta(minutes=1)
        
        # Rate limiting
        self.rate_limiter = defaultdict(lambda: deque(maxlen=100))
        self.rate_limit = 100  # requests per minute
        
        # A/B testing
        self.ab_test_allocation = 0.5  # 50% to rules engine
        self.ab_test_results = defaultdict(lambda: {"success": 0, "failure": 0, "total": 0})
    
    def is_enabled(self, feature: FeatureFlag) -> bool:
        """Check if a feature is enabled"""
        return self.feature_flags.get(feature.value, False)
    
    def set_feature_flag(self, feature: FeatureFlag, enabled: bool):
        """Set a feature flag"""
        self.feature_flags[feature.value] = enabled
        logger.info(f"Feature flag {feature.value} set to {enabled}")
    
    def check_circuit_breaker(self, service: str) -> bool:
        """Check if circuit breaker allows request"""
        breaker = self.circuit_breakers[service]
        
        if breaker.state == "closed":
            return True
        
        elif breaker.state == "open":
            # Check if timeout has passed
            if breaker.opened_at and datetime.now() - breaker.opened_at > self.timeout_duration:
                breaker.state = "half-open"
                logger.info(f"Circuit breaker for {service} moved to half-open")
                return True
            return False
        
        elif breaker.state == "half-open":
            return True
        
        return False
    
    def record_success(self, service: str, response_time: float):
        """Record successful execution"""
        breaker = self.circuit_breakers[service]
        breaker.success_count += 1
        breaker.last_success_time = datetime.now()
        
        if breaker.state == "half-open" and breaker.success_count >= self.success_threshold:
            breaker.state = "closed"
            breaker.failure_count = 0
            breaker.success_count = 0
            logger.info(f"Circuit breaker for {service} closed")
        
        # Update metrics
        if self.is_enabled(FeatureFlag.METRICS_COLLECTION_ENABLED):
            self.performance_metrics.total_requests += 1
            self.performance_metrics.successful_requests += 1
            self.performance_metrics.total_response_time += response_time
            self.performance_metrics.response_times.append(response_time)
    
    def record_failure(self, service: str, error: Exception):
        """Record failed execution"""
        breaker = self.circuit_breakers[service]
        breaker.failure_count += 1
        breaker.last_failure_time = datetime.now()
        
        if breaker.state == "closed" and breaker.failure_count >= self.failure_threshold:
            breaker.state = "open"
            breaker.opened_at = datetime.now()
            logger.warning(f"Circuit breaker for {service} opened due to failures")
        
        elif breaker.state == "half-open":
            breaker.state = "open"
            breaker.opened_at = datetime.now()
            breaker.failure_count = 0
            logger.warning(f"Circuit breaker for {service} re-opened")
        
        # Update metrics
        if self.is_enabled(FeatureFlag.METRICS_COLLECTION_ENABLED):
            self.performance_metrics.total_requests += 1
            self.performance_metrics.failed_requests += 1
        
        logger.error(f"Rules engine failure for {service}: {error}")
    
    def check_rate_limit(self, client_id: str) -> bool:
        """Check if client is within rate limit"""
        now = time.time()
        timestamps = self.rate_limiter[client_id]
        
        # Remove timestamps older than 1 minute
        while timestamps and now - timestamps[0] > 60:
            timestamps.popleft()
        
        if len(timestamps) >= self.rate_limit:
            return False
        
        timestamps.append(now)
        return True
    
    def should_use_rules_engine(self, context: Dict[str, Any]) -> bool:
        """Determine if rules engine should be used (A/B testing)"""
        if not self.is_enabled(FeatureFlag.A_B_TESTING_ENABLED):
            return self.is_enabled(FeatureFlag.RULES_ENGINE_ENABLED)
        
        # Use patient ID for consistent allocation
        patient_id = context.get("patientId", "")
        hash_value = hash(patient_id) % 100
        
        return hash_value < (self.ab_test_allocation * 100)
    
    def record_ab_test_result(self, used_rules_engine: bool, success: bool):
        """Record A/B test results"""
        if not self.is_enabled(FeatureFlag.A_B_TESTING_ENABLED):
            return
        
        group = "rules_engine" if used_rules_engine else "legacy"
        self.ab_test_results[group]["total"] += 1
        
        if success:
            self.ab_test_results[group]["success"] += 1
        else:
            self.ab_test_results[group]["failure"] += 1
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics"""
        metrics = {
            "feature_flags": self.feature_flags,
            "circuit_breakers": {},
            "performance": {},
            "ab_test_results": dict(self.ab_test_results) if self.is_enabled(FeatureFlag.A_B_TESTING_ENABLED) else {}
        }
        
        # Circuit breaker status
        for service, breaker in self.circuit_breakers.items():
            metrics["circuit_breakers"][service] = {
                "state": breaker.state,
                "failure_count": breaker.failure_count,
                "success_count": breaker.success_count,
                "last_failure": breaker.last_failure_time.isoformat() if breaker.last_failure_time else None,
                "last_success": breaker.last_success_time.isoformat() if breaker.last_success_time else None
            }
        
        # Performance metrics
        if self.is_enabled(FeatureFlag.METRICS_COLLECTION_ENABLED):
            avg_response_time = (
                self.performance_metrics.total_response_time / self.performance_metrics.successful_requests
                if self.performance_metrics.successful_requests > 0 else 0
            )
            
            # Calculate percentiles
            response_times = list(self.performance_metrics.response_times)
            response_times.sort()
            
            metrics["performance"] = {
                "total_requests": self.performance_metrics.total_requests,
                "successful_requests": self.performance_metrics.successful_requests,
                "failed_requests": self.performance_metrics.failed_requests,
                "success_rate": (
                    self.performance_metrics.successful_requests / self.performance_metrics.total_requests * 100
                    if self.performance_metrics.total_requests > 0 else 0
                ),
                "average_response_time": avg_response_time,
                "p50_response_time": response_times[len(response_times) // 2] if response_times else 0,
                "p95_response_time": response_times[int(len(response_times) * 0.95)] if response_times else 0,
                "p99_response_time": response_times[int(len(response_times) * 0.99)] if response_times else 0,
                "cache_hit_rate": (
                    self.performance_metrics.cache_hits / 
                    (self.performance_metrics.cache_hits + self.performance_metrics.cache_misses) * 100
                    if (self.performance_metrics.cache_hits + self.performance_metrics.cache_misses) > 0 else 0
                ),
                "rules_evaluated": self.performance_metrics.rules_evaluated,
                "cards_generated": self.performance_metrics.cards_generated
            }
        
        return metrics
    
    def health_check(self) -> Dict[str, Any]:
        """Perform health check"""
        health = {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "checks": {}
        }
        
        # Check feature flags
        if not self.is_enabled(FeatureFlag.RULES_ENGINE_ENABLED):
            health["status"] = "degraded"
            health["checks"]["rules_engine"] = "disabled"
        else:
            health["checks"]["rules_engine"] = "enabled"
        
        # Check circuit breakers
        open_breakers = [
            service for service, breaker in self.circuit_breakers.items()
            if breaker.state == "open"
        ]
        
        if open_breakers:
            health["status"] = "unhealthy"
            health["checks"]["circuit_breakers"] = f"open: {', '.join(open_breakers)}"
        else:
            health["checks"]["circuit_breakers"] = "all closed"
        
        # Check error rate
        if self.performance_metrics.total_requests > 100:
            error_rate = self.performance_metrics.failed_requests / self.performance_metrics.total_requests
            if error_rate > 0.1:  # 10% error rate
                health["status"] = "unhealthy"
                health["checks"]["error_rate"] = f"{error_rate * 100:.1f}%"
            else:
                health["checks"]["error_rate"] = f"{error_rate * 100:.1f}%"
        
        return health


# Global safety manager instance
safety_manager = RulesEngineSafety()