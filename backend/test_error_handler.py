#!/usr/bin/env python3
"""Test the error handler logic"""

def test_error_handler():
    """Test if the error handler itself causes issues"""
    
    # Simulate the exact error handling code
    try:
        # Simulate an error
        raise RuntimeError("Test error")
    except Exception as e:
        print(f"Caught exception: {e}")
        
        # This is the problematic code from claude_cli_service.py
        local_vars = locals()
        
        # Simulate having a component with 'code' in it
        component = {
            'type': 'stat',
            'dataBinding': {
                'resourceType': 'Condition',
                'code': '38341003'  # This might be the issue
            }
        }
        
        # Add it to local_vars manually
        local_vars['component'] = component
        local_vars['generation_mode'] = 'full'
        local_vars['has_agent_data'] = True
        local_vars['data_context'] = {'totalRecords': 100}
        
        try:
            # Try the exact error message construction
            error_msg = f"""// Error generating component: {str(e)}
// Component type: {local_vars.get('component', {}).get('type', 'unknown') if 'component' in local_vars else 'unknown'}
// Generation mode: {local_vars.get('generation_mode', 'unknown')}
// Has agent data: {local_vars.get('has_agent_data', 'unknown')}
"""
            print("✓ Error message construction succeeded")
            print(f"Error message:\n{error_msg}")
        except NameError as ne:
            print(f"✗ NameError in error handler: {ne}")
            import traceback
            traceback.print_exc()

def test_locals_with_code():
    """Test if 'code' as a variable name causes issues with locals()"""
    
    # Create a local variable named 'code'
    code = "test_value"
    
    try:
        local_vars = locals()
        print(f"✓ locals() with 'code' variable: {list(local_vars.keys())}")
        
        # Try to access it
        code_value = local_vars.get('code', 'not found')
        print(f"✓ Accessing 'code' from locals: {code_value}")
    except Exception as e:
        print(f"✗ Error with locals and 'code': {e}")

if __name__ == "__main__":
    print("Testing error handler logic...\n")
    test_error_handler()
    print("\n\nTesting locals() with 'code' variable...")
    test_locals_with_code()