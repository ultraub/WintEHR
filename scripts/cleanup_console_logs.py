#!/usr/bin/env python3
"""
Clean up console logging statements from frontend JavaScript files.
Removes debug/development logs while preserving error handling.
"""
import os
import re
import sys
from pathlib import Path

# Patterns to remove (debug/development logging)
REMOVE_PATTERNS = [
    # Simple console.log statements
    r'^\s*console\.log\([^)]*\);\s*$',
    r'^\s*console\.debug\([^)]*\);\s*$',
    
    # Console.log statements that span multiple lines
    r'^\s*console\.log\([^)]*$',
    r'^\s*console\.debug\([^)]*$',
    
    # Specific debug patterns found in the codebase
    r'console\.log\([\'"].*Loading.*[\'"]\)',
    r'console\.log\([\'"].*Debug.*[\'"]\)',
    r'console\.log\([\'"].*TODO.*[\'"]\)',
    r'console\.log\([\'"].*Test.*[\'"]\)',
    r'console\.log\([\'"].*\s+called.*[\'"]\)',
    r'console\.log\([\'"].*\s+mounted.*[\'"]\)',
    r'console\.log\([\'"].*\s+rendered.*[\'"]\)',
    r'console\.log\([\'"].*\s+state.*[\'"]\)',
    r'console\.log\([\'"].*\s+props.*[\'"]\)',
]

# Patterns to keep (error handling, warnings)
KEEP_PATTERNS = [
    r'console\.error',
    r'console\.warn.*[Ee]rror',
    r'catch.*console\.',
    r'console\.warn.*[Dd]eprecated',
    r'console\.warn.*[Ff]ailed',
    r'console\.error.*[Ff]ailed',
]

def should_remove_line(line):
    """Determine if a console statement should be removed."""
    # Check if line should be kept
    for pattern in KEEP_PATTERNS:
        if re.search(pattern, line, re.IGNORECASE):
            return False
    
    # Check if line should be removed
    for pattern in REMOVE_PATTERNS:
        if re.search(pattern, line, re.IGNORECASE):
            return True
    
    # Check for generic console.log without error context
    if 'console.log' in line and not any(keyword in line.lower() for keyword in ['error', 'fail', 'warn', 'catch']):
        return True
    
    return False

def clean_file(filepath):
    """Clean console statements from a single file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    new_lines = []
    skip_multiline = False
    removed_count = 0
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Handle multi-line console statements
        if skip_multiline:
            if ');' in line:
                skip_multiline = False
                removed_count += 1
            i += 1
            continue
        
        # Check if this starts a multi-line console.log/debug
        if re.search(r'^\s*console\.(log|debug)\([^)]*$', line):
            skip_multiline = True
            removed_count += 1
            i += 1
            continue
        
        # Check single line removals
        if should_remove_line(line):
            removed_count += 1
            # Also remove empty line after if it exists
            if i + 1 < len(lines) and lines[i + 1].strip() == '':
                i += 1
        else:
            new_lines.append(line)
        
        i += 1
    
    # Clean up multiple consecutive empty lines
    final_lines = []
    prev_empty = False
    for line in new_lines:
        if line.strip() == '':
            if not prev_empty:
                final_lines.append(line)
            prev_empty = True
        else:
            final_lines.append(line)
            prev_empty = False
    
    if removed_count > 0:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.writelines(final_lines)
        return removed_count
    
    return 0

def main():
    """Clean console logs from all JavaScript files."""
    frontend_dir = Path(__file__).parent.parent / 'frontend' / 'src'
    
    if not frontend_dir.exists():
        print(f"Error: Frontend directory not found at {frontend_dir}")
        sys.exit(1)
    
    total_removed = 0
    files_processed = 0
    
    # Process all JavaScript/JSX files
    for ext in ['js', 'jsx']:
        for filepath in frontend_dir.rglob(f'*.{ext}'):
            removed = clean_file(filepath)
            if removed > 0:
                print(f"Cleaned {removed} console statements from {filepath.relative_to(frontend_dir.parent.parent)}")
                total_removed += removed
            files_processed += 1
    
    print(f"\nSummary:")
    print(f"- Files processed: {files_processed}")
    print(f"- Console statements removed: {total_removed}")
    
    # Also clean up Python print statements in backend
    print("\nChecking backend Python files for debug print statements...")
    backend_dir = Path(__file__).parent.parent / 'backend'
    python_cleaned = 0
    
    for filepath in backend_dir.rglob('*.py'):
        # Skip test files and scripts
        if 'test' in str(filepath) or 'scripts' in str(filepath):
            continue
            
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Remove debug print statements (keep error/warning prints)
        original_content = content
        content = re.sub(r'^\s*print\([\'"]Debug:.*[\'"]\)\s*$', '', content, flags=re.MULTILINE)
        content = re.sub(r'^\s*print\([\'"]TODO:.*[\'"]\)\s*$', '', content, flags=re.MULTILINE)
        content = re.sub(r'^\s*print\(f[\'"]Debug:.*[\'"]\)\s*$', '', content, flags=re.MULTILINE)
        
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            python_cleaned += 1
            print(f"Cleaned debug prints from {filepath.relative_to(backend_dir.parent)}")
    
    print(f"\nPython files cleaned: {python_cleaned}")

if __name__ == '__main__':
    main()