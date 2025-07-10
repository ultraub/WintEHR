#!/usr/bin/env python3
"""Test to find exact location of NameError"""

import sys
import traceback

# Simulate the exact conditions that might cause the error
def test_fstring_with_code_word():
    """Test if the word 'code' in f-strings causes issues"""
    
    # Test 1: Simple 'code' in text
    try:
        test1 = f"This contains the word code"
        print("✓ Test 1 passed: Simple 'code' word")
    except NameError as e:
        print(f"✗ Test 1 failed: {e}")
    
    # Test 2: JavaScript-like code with 'code' as property
    try:
        test2 = f"""Example:
const data = await fetch('/api/data');
const code = data.code;
console.log(code);"""
        print("✓ Test 2 passed: JavaScript with code variable")
    except NameError as e:
        print(f"✗ Test 2 failed: {e}")
    
    # Test 3: FHIR example with 'code' property
    try:
        test3 = f"""- Example for conditions:
  const conditionsResponse = await fhirService.searchResources('Condition', {{
    'code': '38341003,59621000', // SNOMED codes
    _count: 1000
  }});"""
        print("✓ Test 3 passed: FHIR query with 'code' parameter")
    except NameError as e:
        print(f"✗ Test 3 failed: {e}")
    
    # Test 4: The exact problematic string from the error log
    try:
        test4 = f"""- Example for hypertension patients:
  const conditionsResponse = await fhirService.searchResources('Condition', {{
    'code': '38341003,59621000,1201005', // Hypertension SNOMED codes
    _count: 1000
  }});"""
        print("✓ Test 4 passed: Exact hypertension example")
    except NameError as e:
        print(f"✗ Test 4 failed: {e}")
        traceback.print_exc()

    # Test 5: What if we use format() instead of f-string?
    try:
        template = """- Example for hypertension patients:
  const conditionsResponse = await fhirService.searchResources('Condition', {{
    'code': '38341003,59621000,1201005', // Hypertension SNOMED codes
    _count: 1000
  }});"""
        test5 = "{}".format(template)
        print("✓ Test 5 passed: Using format() instead of f-string")
    except Exception as e:
        print(f"✗ Test 5 failed: {e}")
    
    # Test 6: Check if it's an issue with locals()
    try:
        # This might be the issue - if the error handler uses locals()
        local_code = "test_value"
        test6 = f"Testing with local variable named code: {local_code}"
        print("✓ Test 6 passed: Local variable named 'local_code'")
    except NameError as e:
        print(f"✗ Test 6 failed: {e}")

    # Test 7: What if there's eval() or exec() somewhere?
    try:
        # Simulate what might happen if the prompt is evaluated
        prompt_str = """Generate component with 'code' property"""
        # DON'T actually eval this - just build the string
        test7 = f"Prompt: {prompt_str}"
        print("✓ Test 7 passed: Building prompt string")
    except NameError as e:
        print(f"✗ Test 7 failed: {e}")

if __name__ == "__main__":
    print("Testing various scenarios for NameError with 'code'...\n")
    test_fstring_with_code_word()
    
    # Additional test: Check if subprocess might be evaluating the prompt
    print("\n\nChecking if subprocess might evaluate strings...")
    import subprocess
    import os
    
    # Test if Claude CLI might be evaluating Python code
    test_prompt = "Test prompt with the word code in it"
    cmd = ["echo", test_prompt]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        print(f"✓ Subprocess test passed: {result.stdout.strip()}")
    except Exception as e:
        print(f"✗ Subprocess test failed: {e}")