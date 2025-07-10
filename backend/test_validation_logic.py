#!/usr/bin/env python3
"""Test the validation logic that might be causing the error"""

# Test the validation line that checks for code keywords
response = "Some response with code in it"

try:
    # This is the line from the file
    result = response and not any(keyword in response for keyword in ['import React', 'export default', 'const ', 'function '])
    print(f"Validation result: {result}")
except Exception as e:
    print(f"Error in validation: {e}")

# Test with a response that contains 'code'
response2 = "Here's the code: function MyComponent() { return <div>Hello</div>; }"

try:
    result2 = response2 and not any(keyword in response2 for keyword in ['import React', 'export default', 'const ', 'function '])
    print(f"Validation result 2: {result2}")
except Exception as e:
    print(f"Error in validation 2: {e}")

# Test if 'code' as a word causes issues
response3 = "Generate code for"

try:
    result3 = response3 and not any(keyword in response3 for keyword in ['import React', 'export default', 'const ', 'function '])
    print(f"Validation result 3: {result3}")
except Exception as e:
    print(f"Error in validation 3: {e}")

# Test the actual error case
try:
    # Try to reference undefined 'code' variable
    print(code)
except NameError as e:
    print(f"Expected NameError: {e}")