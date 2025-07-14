# React Performance & State Management Guidelines

## 🚨 CRITICAL: Preventing Infinite Re-render Loops

This document establishes architectural standards to prevent infinite refresh loops and ensure optimal React performance across the MedGenEMR application.

## ⚠️ Common Anti-patterns That MUST Be Avoided

### 1. Function Dependencies in useEffect

❌ **NEVER DO THIS:**
```javascript
const fetchData = useCallback(() => { /* ... */ }, [dependency]);

useEffect(() => {
  fetchData();
}, [fetchData]); // ← This causes infinite loops!
```

✅ **DO THIS INSTEAD:**
```javascript
import { useStableCallback } from '../hooks/useStableReferences';

const fetchData = useStableCallback(() => { /* ... */ });

useEffect(() => {
  fetchData();
}, []); // ← Minimal dependencies
```

### 2. Object Recreation in Dependencies

❌ **NEVER DO THIS:**
```javascript
useEffect(() => {
  // Effect logic
}, [state.user, state.settings]); // ← Objects change reference every render
```

✅ **DO THIS INSTEAD:**
```javascript
useEffect(() => {
  // Effect logic
}, [state.user?.id, state.settings?.theme]); // ← Use primitive values
```

### 3. Function Recreation Without Memoization

❌ **NEVER DO THIS:**
```javascript
const handleClick = () => { /* ... */ }; // ← Recreated every render

return <Button onClick={handleClick} />;
```

✅ **DO THIS INSTEAD:**
```javascript
import { useStableCallback } from '../hooks/useStableReferences';

const handleClick = useStableCallback(() => { /* ... */ });

return <Button onClick={handleClick} />;
```

## 🛠️ Required Patterns and Utilities

### 1. Stable Reference Hooks

Always use these hooks from `/hooks/useStableReferences.js`:

#### `useStableCallback`
For callbacks that need stable references:
```javascript
import { useStableCallback } from '../hooks/useStableReferences';

const handleSubmit = useStableCallback(async (data) => {
  // Function body that accesses latest state/props
});
```

#### `useInitializationGuard`
For preventing duplicate initialization:
```javascript
import { useInitializationGuard } from '../hooks/useStableReferences';

const { isInitialized, isInitializing, markInitialized, markInitializing } = useInitializationGuard();

useEffect(() => {
  if (!isInitialized && !isInitializing) {
    markInitializing();
    // Initialization logic
    markInitialized();
  }
}, [dependency]);
```

#### `useGuardedEffect`
For protected useEffect with debouncing:
```javascript
import { useGuardedEffect } from '../hooks/useStableReferences';

useGuardedEffect(() => {
  // Effect logic
}, [dependency], { 
  skipInitialRender: true,
  debounceMs: 300 
});
```

### 2. Context Pattern Requirements

#### Context Providers MUST:
1. Use `useStableCallback` for all exposed functions
2. Remove function dependencies from useEffect arrays
3. Use initialization guards for one-time setup

```javascript
export const MyContextProvider = ({ children }) => {
  const { isInitialized, markInitialized } = useInitializationGuard();
  
  // ✅ Stable callback - no dependency array needed
  const fetchData = useStableCallback(async () => {
    // Latest state always accessible
  });
  
  // ✅ No function dependencies
  useEffect(() => {
    if (!isInitialized) {
      fetchData();
      markInitialized();
    }
  }, []); // Minimal dependencies
  
  return (
    <MyContext.Provider value={{ fetchData }}>
      {children}
    </MyContext.Provider>
  );
};
```

### 3. Component State Management

#### Loading States
```javascript
import { useLoadingGuard } from '../hooks/useStableReferences';

const [loading, setLoading] = useLoadingGuard(false);

// setLoading automatically prevents redundant updates
```

#### Resource Dependencies
```javascript
// ✅ Use primitive values, not functions
const resources = useMemo(() => 
  getPatientResources(patientId, 'Condition'), 
  [patientId] // Don't include getPatientResources
);
```

## 📋 useEffect Dependency Guidelines

### Rule 1: Minimal Dependencies
Only include primitive values that actually trigger the effect:
```javascript
useEffect(() => {
  // Effect logic
}, [patientId, status]); // Only primitives
```

### Rule 2: No Function Dependencies
Functions should be stable and not included in dependency arrays:
```javascript
const stableFunction = useStableCallback(() => { /* ... */ });

useEffect(() => {
  stableFunction();
}, []); // No function in dependencies
```

### Rule 3: Use State Guards
Prevent unnecessary effect execution:
```javascript
const [isInitialized, setIsInitialized] = useState(false);

useEffect(() => {
  if (!isInitialized && someCondition) {
    // Effect logic
    setIsInitialized(true);
  }
}, [someCondition]); // Guard prevents loops
```

## 🎯 Component-Specific Patterns

### Form Components
```javascript
import { useStableCallback, useInitializationGuard } from '../hooks/useStableReferences';

const FormComponent = ({ initialData, onSubmit }) => {
  const [formData, setFormData] = useState(initialData);
  const { isInitialized, markInitialized } = useInitializationGuard();
  
  // ✅ Stable form handlers
  const handleFieldChange = useStableCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  });
  
  const handleSubmit = useStableCallback(async () => {
    await onSubmit(formData);
  });
  
  // ✅ Reset only when initialData changes
  useEffect(() => {
    if (!isInitialized || JSON.stringify(initialData) !== JSON.stringify(formData)) {
      setFormData(initialData);
      markInitialized();
    }
  }, [initialData?.id]); // Use ID, not entire object
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
};
```

### Data Fetching Components
```javascript
import { useStableCallback, useInitializationGuard } from '../hooks/useStableReferences';

const DataComponent = ({ entityId }) => {
  const [data, setData] = useState(null);
  const { isInitialized, isInitializing, markInitialized, markInitializing } = useInitializationGuard();
  
  const fetchData = useStableCallback(async (id) => {
    if (isInitializing) return;
    
    markInitializing();
    try {
      const result = await api.fetch(id);
      setData(result);
    } finally {
      markInitialized();
    }
  });
  
  useEffect(() => {
    if (entityId && (!isInitialized || currentId !== entityId)) {
      fetchData(entityId);
    }
  }, [entityId]); // Minimal dependencies
  
  return <div>{/* Render data */}</div>;
};
```

## 🔍 Code Review Checklist

Before submitting any React component, verify:

### ✅ useEffect Dependencies
- [ ] No functions in dependency arrays
- [ ] Only primitive values as dependencies
- [ ] State guards to prevent unnecessary executions
- [ ] Initialization guards for one-time setup

### ✅ Function Declarations
- [ ] Use `useStableCallback` for event handlers
- [ ] Use `useStableCallback` for async operations
- [ ] No unnecessary `useCallback` with changing dependencies

### ✅ State Management
- [ ] No object recreation in render
- [ ] Proper memoization with `useMemo`
- [ ] Loading states with guards

### ✅ Context Usage
- [ ] Stable function references in context value
- [ ] No function dependencies in context useEffects
- [ ] Proper initialization patterns

## 🚫 ESLint Rules to Implement

Add these rules to `.eslintrc.js`:

```javascript
module.exports = {
  rules: {
    // Prevent function dependencies in useEffect
    'react-hooks/exhaustive-deps': ['error', {
      'additionalHooks': '(useGuardedEffect)'
    }],
    
    // Custom rule to detect useCallback in useEffect deps
    'no-callback-in-effect-deps': 'error',
    
    // Encourage stable patterns
    'prefer-stable-callback': 'warn'
  }
};
```

## 🧪 Testing Patterns

### Performance Testing
```javascript
import { renderHook } from '@testing-library/react-hooks';
import { useStableCallback } from '../hooks/useStableReferences';

test('callback remains stable across renders', () => {
  const { result, rerender } = renderHook(() => 
    useStableCallback(() => console.log('test'))
  );
  
  const firstRender = result.current;
  rerender();
  const secondRender = result.current;
  
  expect(firstRender).toBe(secondRender);
});
```

### Integration Testing
```javascript
test('component does not cause infinite renders', async () => {
  const renderCount = jest.fn();
  
  const TestComponent = () => {
    renderCount();
    return <MyComponent />;
  };
  
  render(<TestComponent />);
  
  await waitFor(() => {
    // Should not render more than expected times
    expect(renderCount).toHaveBeenCalledTimes(1);
  });
});
```

## 📚 Additional Resources

- [React Performance Patterns](https://react.dev/learn/render-and-commit)
- [useCallback and useMemo](https://react.dev/reference/react/useCallback)
- [Effect Dependencies](https://react.dev/learn/removing-effect-dependencies)

## 🔄 Migration Guide

When updating existing components:

1. **Identify Issues**: Look for function dependencies in useEffect
2. **Apply Stable Patterns**: Use `useStableCallback` and guards
3. **Test Thoroughly**: Verify no infinite rendering
4. **Update Dependencies**: Remove function dependencies
5. **Add Guards**: Implement initialization guards

---

**Remember**: These patterns are MANDATORY for all React components in the MedGenEMR application. Violations will cause production issues and must be addressed immediately.