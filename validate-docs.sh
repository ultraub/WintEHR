#!/bin/bash
echo "🔍 Validating MedGenEMR Documentation Structure..."
echo "================================================"

echo -e "\n📄 Checking main documentation files..."
files=(
    "CLAUDE.md"
    "CLAUDE-REFERENCE.md"
    "CLAUDE-AGENTS.md"
    "QUICK-REFERENCE.md"
    ".claude/agents/README.md"
    "docs/modules/README.md"
)

missing_files=0
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file is missing!"
        missing_files=$((missing_files + 1))
    fi
done

echo -e "\n📏 Checking file sizes..."
main_lines=$(wc -l < CLAUDE.md 2>/dev/null || echo 0)
ref_lines=$(wc -l < CLAUDE-REFERENCE.md 2>/dev/null || echo 0)

echo "CLAUDE.md: $main_lines lines"
echo "CLAUDE-REFERENCE.md: $ref_lines lines"

if [ $main_lines -gt 300 ]; then
    echo "⚠️  Warning: CLAUDE.md has $main_lines lines (recommended: <300)"
fi

echo -e "\n🤖 Checking agent files..."
agent_count=$(find .claude/agents -name "*.py" -type f | wc -l)
echo "Found $agent_count agent files"

echo -e "\n📊 Summary"
echo "=========="
if [ $missing_files -eq 0 ]; then
    echo "✅ All main documentation files present"
else
    echo "❌ $missing_files documentation files missing"
fi

echo -e "\n✨ Documentation validation complete!"