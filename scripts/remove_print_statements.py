#!/usr/bin/env python3
"""
Remove print statements from Python files and replace with proper logging
"""
import os
import re
import sys
import ast

def setup_logging_import(content):
    """Add logging import if not present"""
    if 'import logging' not in content and 'from logging import' not in content:
        # Add after other imports
        lines = content.split('\n')
        import_index = 0
        for i, line in enumerate(lines):
            if line.startswith('import ') or line.startswith('from '):
                import_index = i + 1
        
        lines.insert(import_index, 'import logging')
        lines.insert(import_index + 1, '')
        return '\n'.join(lines)
    return content

def remove_print_statements(directory):
    """Remove print statements from all Python files in directory"""
    removed_count = 0
    file_count = 0
    
    # Pattern to match print statements
    print_pattern = re.compile(
        r'^(\s*)print\s*\((.*?)\)\s*$',
        re.MULTILINE
    )
    
    # Walk through all files
    for root, dirs, files in os.walk(directory):
        # Skip __pycache__ and venv directories
        if '__pycache__' in root or 'venv' in root or '.venv' in root:
            continue
            
        for file in files:
            if file.endswith('.py'):
                filepath = os.path.join(root, file)
                
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    # Skip files with no print statements
                    if 'print(' not in content:
                        continue
                    
                    # Find all print statements
                    matches = list(print_pattern.finditer(content))
                    
                    if matches:
                        file_count += 1
                        new_content = content
                        
                        # Replace print statements with logging
                        for match in reversed(matches):  # Reverse to maintain positions
                            indent = match.group(1)
                            message = match.group(2)
                            
                            # Determine log level based on content
                            if 'error' in message.lower() or 'exception' in message.lower():
                                log_level = 'error'
                            elif 'warn' in message.lower():
                                log_level = 'warning'
                            elif 'debug' in message.lower():
                                log_level = 'debug'
                            else:
                                log_level = 'info'
                            
                            # Replace print with logging
                            replacement = f"{indent}logging.{log_level}({message})"
                            new_content = new_content[:match.start()] + replacement + new_content[match.end():]
                        
                        # Add logging import if needed
                        new_content = setup_logging_import(new_content)
                        
                        # Write back
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        
                        removed_count += len(matches)
                        print(f"Replaced {len(matches)} print statements in {filepath}")
                        
                except Exception as e:
                    print(f"Error processing {filepath}: {str(e)}")
    
    return removed_count, file_count

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python remove_print_statements.py <directory>")
        sys.exit(1)
    
    directory = sys.argv[1]
    if not os.path.exists(directory):
        print(f"Directory {directory} does not exist")
        sys.exit(1)
    
    print(f"Replacing print statements with logging in {directory}...")
    removed, files = remove_print_statements(directory)
    print(f"\nTotal: Replaced {removed} print statements in {files} files")