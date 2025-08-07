"""
Cost Tracking for UI Composer
Track API usage and costs for different models
"""

from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

# Pricing per 1M tokens (as of January 2025)
PRICING = {
    "claude-sonnet-4-20250514": {
        "input": 3.00,   # $3 per 1M input tokens (estimated)
        "output": 15.00  # $15 per 1M output tokens (estimated)
    },
    "claude-opus-4-20250514": {
        "input": 15.00,  # $15 per 1M input tokens (estimated)
        "output": 75.00  # $75 per 1M output tokens (estimated)
    },
    "claude-3-5-sonnet-20241022": {
        "input": 3.00,   # $3 per 1M input tokens
        "output": 15.00  # $15 per 1M output tokens
    },
    "claude-3-opus-20240229": {
        "input": 15.00,  # $15 per 1M input tokens
        "output": 75.00  # $75 per 1M output tokens
    },
    "claude-3-sonnet-20240229": {
        "input": 3.00,   # $3 per 1M input tokens
        "output": 15.00  # $15 per 1M output tokens
    }
}

class CostTracker:
    """Track costs for API usage"""
    
    def __init__(self):
        self.session_costs = {}
        self.total_costs = {
            "input_tokens": 0,
            "output_tokens": 0,
            "total_cost": 0.0
        }
    
    def calculate_cost(self, input_tokens: int, output_tokens: int, model: str) -> Dict[str, Any]:
        """Calculate cost for token usage"""
        if model not in PRICING:
            logger.warning(f"Unknown model for pricing: {model}")
            return {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "input_cost": 0.0,
                "output_cost": 0.0,
                "total_cost": 0.0,
                "model": model,
                "unknown_model": True
            }
        
        pricing = PRICING[model]
        
        # Calculate costs (convert to dollars from millions)
        input_cost = (input_tokens / 1_000_000) * pricing["input"]
        output_cost = (output_tokens / 1_000_000) * pricing["output"]
        total_cost = input_cost + output_cost
        
        return {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "input_cost": round(input_cost, 4),
            "output_cost": round(output_cost, 4),
            "total_cost": round(total_cost, 4),
            "model": model
        }
    
    def track_usage(self, session_id: str, input_tokens: int, output_tokens: int, 
                   model: str, operation: str) -> Dict[str, Any]:
        """Track usage for a session"""
        cost_data = self.calculate_cost(input_tokens, output_tokens, model)
        cost_data["operation"] = operation
        
        # Update session costs
        if session_id not in self.session_costs:
            self.session_costs[session_id] = {
                "operations": [],
                "total_input_tokens": 0,
                "total_output_tokens": 0,
                "total_cost": 0.0
            }
        
        session = self.session_costs[session_id]
        session["operations"].append(cost_data)
        session["total_input_tokens"] += input_tokens
        session["total_output_tokens"] += output_tokens
        session["total_cost"] += cost_data["total_cost"]
        
        # Update total costs
        self.total_costs["input_tokens"] += input_tokens
        self.total_costs["output_tokens"] += output_tokens
        self.total_costs["total_cost"] += cost_data["total_cost"]
        
        return cost_data
    
    def get_session_cost(self, session_id: str) -> Dict[str, Any]:
        """Get cost summary for a session"""
        if session_id not in self.session_costs:
            return {
                "session_id": session_id,
                "total_input_tokens": 0,
                "total_output_tokens": 0,
                "total_cost": 0.0,
                "operations": []
            }
        
        return {
            "session_id": session_id,
            **self.session_costs[session_id]
        }
    
    def estimate_cost(self, prompt_length: int, expected_output: int, model: str) -> Dict[str, Any]:
        """Estimate cost before making a request"""
        # Rough estimation: 1 token ≈ 4 characters
        estimated_input_tokens = prompt_length // 4
        estimated_output_tokens = expected_output // 4
        
        return self.calculate_cost(estimated_input_tokens, estimated_output_tokens, model)
    
    def format_cost_display(self, cost_data: Dict[str, Any]) -> str:
        """Format cost data for display"""
        if cost_data.get("unknown_model"):
            return "Cost tracking not available for this model"
        
        return (
            f"Tokens: {cost_data['input_tokens']:,} in / {cost_data['output_tokens']:,} out\n"
            f"Cost: ${cost_data['total_cost']:.4f} "
            f"(${cost_data['input_cost']:.4f} + ${cost_data['output_cost']:.4f})"
        )

# Singleton instance
cost_tracker = CostTracker()