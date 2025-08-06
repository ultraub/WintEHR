# CLAUDE-AGENTS.md - MedGenEMR Agent System Guide

This document provides comprehensive instructions for using the MedGenEMR agent system within Claude Code. Agents are automated tools that help with development, quality assurance, and workflow orchestration.

## 🚀 Quick Agent Reference

| Agent | Purpose | Usage |
|-------|---------|-------|
| `feature-workflow.py` | Complete feature development | `python .claude/agents/feature-workflow.py "Add lab trending"` |
| `qa-agent.py` | Code quality checks | `python .claude/agents/qa-agent.py --report` |
| `fhir-integration-checker.py` | FHIR compliance | `python .claude/agents/fhir-integration-checker.py` |
| `feature-analyzer.py` | Feature breakdown | `python .claude/agents/feature-analyzer.py "New feature request"` |
| `feature-scaffold.py` | Code generation | `python .claude/agents/feature-scaffold.py "Component name"` |
| `integration-validator.py` | Cross-module checks | `python .claude/agents/integration-validator.py` |

## 📋 Agent Workflows

### Master Feature Development Workflow

The `feature-workflow.py` orchestrates the complete development cycle:

```bash
# Full feature development with all checks
python .claude/agents/feature-workflow.py "Add medication interaction checking"

# Quick analysis only (no code generation)
python .claude/agents/feature-workflow.py "New lab viewer" --check-only

# Skip quality checks for rapid prototyping
python .claude/agents/feature-workflow.py "Dashboard widget" --skip-qa
```

**Workflow Steps**:
1. Analyzes feature request
2. Generates comprehensive todo list
3. Validates existing FHIR compliance
4. Checks integration patterns
5. Runs quality checks
6. Generates scaffolding code

### Quality Assurance Agent

The `qa-agent.py` ensures code quality:

```bash
# Full quality report
python .claude/agents/qa-agent.py --report

# Check specific severity level
python .claude/agents/qa-agent.py --severity error

# Auto-fix common issues
python .claude/agents/qa-agent.py --fix

# Check specific directory
python .claude/agents/qa-agent.py --path frontend/src/components
```

**Quality Checks**:
- ❌ Console.log statements (auto-removed with --fix)
- ❌ TODO/FIXME comments
- ❌ Missing error handling
- ❌ Hardcoded values
- ✅ FHIR reference patterns
- ✅ Event handling patterns
- ✅ Loading state implementation

### FHIR Integration Checker

The `fhir-integration-checker.py` validates FHIR compliance:

```bash
# Check all FHIR implementations
python .claude/agents/fhir-integration-checker.py

# Quiet mode (errors only)
python .claude/agents/fhir-integration-checker.py --quiet

# Check specific resource type
python .claude/agents/fhir-integration-checker.py --resource Patient

# Validate against R5 (default is R4)
python .claude/agents/fhir-integration-checker.py --version R5
```

### Feature Analyzer

The `feature-analyzer.py` breaks down feature requests:

```bash
# Analyze and create todo list
python .claude/agents/feature-analyzer.py "Add patient appointment scheduling"

# Output as markdown
python .claude/agents/feature-analyzer.py "New feature" --output markdown

# Include time estimates
python .claude/agents/feature-analyzer.py "Complex feature" --estimate
```

### Feature Scaffolding

The `feature-scaffold.py` generates boilerplate code:

```bash
# Generate React component
python .claude/agents/feature-scaffold.py "PatientVitalsChart"

# Generate with specific type
python .claude/agents/feature-scaffold.py "VitalSignsService" --type service

# Generate full module structure
python .claude/agents/feature-scaffold.py "Appointments" --type module
```

## 🔧 Hook System

### Pre-Tool-Use Hooks

Executed before any tool operation:

```python
# .claude/hooks/medgenemr-pre-task.py
- Validates file paths
- Checks permissions
- Warms up Context7 cache
- Validates environment
```

### Post-Tool-Use Hooks

Executed after tool operations:

```python
# .claude/hooks/documentation-tracker.py
- Identifies documentation needing updates
- Creates documentation tasks
- Updates knowledge base
```

### Quality Gate Hooks

```python
# .claude/hooks/enforce-context7.py
- Ensures Context7 patterns are followed
- Validates against knowledge base
- Updates pattern library
```

## 💡 Context7 Integration

All agents integrate with Context7 MCP for real-time knowledge:

### Knowledge Areas

1. **React Patterns** (`react_context.md`)
   - Latest hooks and patterns
   - Performance optimizations
   - Component architecture

2. **FHIR Standards** (`fhir_context.md`)
   - R4/R5 resource definitions
   - Reference handling
   - Bundle operations

3. **FastAPI Patterns** (`fastapi_context.md`)
   - Async patterns
   - Dependency injection
   - Error handling

4. **WintEHR Specifics** (`wintehr_context_patterns.md`)
   - Clinical workflows
   - Event patterns
   - Integration points

### Using Context7 in Agents

```python
from .utils.context7_integration import Context7Client

# Initialize client
client = Context7Client()

# Get context for React patterns
react_patterns = client.get_knowledge("react")

# Update knowledge after learning
client.update_knowledge("new_pattern", {
    "category": "clinical_workflow",
    "pattern": "order_to_result",
    "implementation": code_snippet
})
```

## 🎯 Best Practices

### 1. Always Use Feature Workflow

For any new feature, start with:
```bash
python .claude/agents/feature-workflow.py "Your feature description"
```

This ensures:
- Proper analysis and planning
- Compliance checks
- Quality gates
- Documentation updates

### 2. Run QA Before Commits

```bash
# Before every commit
python .claude/agents/qa-agent.py --fix
```

### 3. Validate FHIR Changes

```bash
# After modifying FHIR-related code
python .claude/agents/fhir-integration-checker.py
```

### 4. Update Documentation

```bash
# Check what needs updating
python .claude/hooks/documentation-tracker.py
```

## 🔄 Chaining Agents

Agents can be chained for complex workflows:

```bash
# Analysis → Scaffolding → QA
python .claude/agents/feature-analyzer.py "New feature" && \
python .claude/agents/feature-scaffold.py "NewComponent" && \
python .claude/agents/qa-agent.py --fix
```

## 🛠️ Custom Agent Development

### Agent Template

```python
#!/usr/bin/env python3
"""
Custom Agent for MedGenEMR
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from utils.context7_integration import Context7Client

class CustomAgent:
    def __init__(self):
        self.context7 = Context7Client()
        
    def run(self, task):
        # Get relevant context
        context = self.context7.get_knowledge("domain")
        
        # Perform task
        result = self.process(task, context)
        
        # Update knowledge
        self.context7.update_knowledge("learnings", result)
        
        return result

if __name__ == "__main__":
    agent = CustomAgent()
    agent.run(sys.argv[1])
```

### Agent Guidelines

1. **Single Purpose**: Each agent should have one clear purpose
2. **Context7 Integration**: Always use Context7 for patterns
3. **Error Handling**: Graceful failures with clear messages
4. **Documentation**: Update docs after agent actions
5. **Idempotency**: Agents should be safe to run multiple times

## 📊 Agent Metrics

Track agent usage and effectiveness:

```bash
# View agent usage stats
python .claude/utils/agent-metrics.py

# Generate performance report
python .claude/utils/agent-metrics.py --report
```

## 🚨 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Import errors | Ensure you're in project root |
| Context7 timeout | Check network, increase cache duration |
| Agent fails silently | Run with `--verbose` flag |
| Permission denied | Check file permissions |
| Outdated patterns | Run Context7 update |

### Debug Mode

```bash
# Enable debug logging
export CLAUDE_DEBUG=true

# Run agent with verbose output
python .claude/agents/[agent].py --verbose
```

## 🔗 Related Documentation

- **Agent Implementation**: [.claude/agents/README.md](.claude/agents/README.md)
- **Hook Configuration**: [.claude/settings.json](.claude/settings.json)
- **Main Guide**: [CLAUDE.md](./CLAUDE.md)
- **Detailed Reference**: [CLAUDE-REFERENCE.md](./CLAUDE-REFERENCE.md)

---

**Remember**: Agents are tools to enhance productivity and quality. They supplement, not replace, careful development practices.