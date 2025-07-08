#!/usr/bin/env python3
"""
Remove console.log statements from JavaScript/JSX files
"""
import os
import re
import sys

def remove_console_logs(directory):
    """Remove console.log statements from all JS/JSX files in directory"""
    removed_count = 0
    file_count = 0
    
    # Pattern to match console.log statements (including multiline)
    console_pattern = re.compile(
        r'console\.(log|error|warn|info|debug)\s*\([^)]*\)(?:\s*;)?',
        re.MULTILINE | re.DOTALL
    )
    
    # Walk through all files
    for root, dirs, files in os.walk(directory):
        # Skip node_modules and build directories
        if 'node_modules' in root or 'build' in root:
            continue
            
        for file in files:
            if file.endswith(('.js', '.jsx')):
                filepath = os.path.join(root, file)
                
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    # Find all console statements
                    matches = list(console_pattern.finditer(content))
                    
                    if matches:
                        file_count += 1
                        # Remove console statements
                        new_content = console_pattern.sub('', content)
                        
                        # Clean up extra blank lines (replace 3+ newlines with 2)
                        new_content = re.sub(r'\n{3,}', '\n\n', new_content)
                        
                        # Write back
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        
                        removed_count += len(matches)
                        print(f"Removed {len(matches)} console statements from {filepath}")
                        
                except Exception as e:
                    print(f"Error processing {filepath}: {str(e)}")
    
    return removed_count, file_count

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python remove_console_logs.py <directory>")
        sys.exit(1)
    
    directory = sys.argv[1]
    if not os.path.exists(directory):
        print(f"Directory {directory} does not exist")
        sys.exit(1)
    
    print(f"Removing console.log statements from {directory}...")
    removed, files = remove_console_logs(directory)
    print(f"\nTotal: Removed {removed} console statements from {files} files")