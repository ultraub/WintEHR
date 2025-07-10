#!/usr/bin/env python3
"""Minimal test to reproduce the error"""

# This should work
generation_specific_instructions = ""
data_context_section = ""

try:
    prompt = f"""Test prompt
{generation_specific_instructions}
{data_context_section}
"""
    print("Test 1 passed")
except NameError as e:
    print(f"Test 1 failed: {e}")

# Test the actual error case
try:
    # Simulate the error on line 534
    test_str = f"""Generate a React component for a clinical UI based on the following specification:

Component Type: stat
{generation_specific_instructions}
{data_context_section}
"""
    print("Test 2 passed")
except NameError as e:
    print(f"Test 2 failed: {e}")
    
# Now test with undefined variable
try:
    test_str = f"""Test with {code}"""
except NameError as e:
    print(f"Test 3 failed as expected: {e}")