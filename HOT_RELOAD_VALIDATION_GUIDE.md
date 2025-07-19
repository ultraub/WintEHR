# Hot Reload Validation Guide for WintEHR Frontend

## Overview
This guide provides best practices for leveraging React's hot reload capability during the frontend improvement tasks, eliminating the need for manual restarts and speeding up development.

## Hot Reload Setup

### Prerequisites
```bash
# Ensure you're running the dev server
npm start

# Keep test runner in watch mode in separate terminal
npm test -- --watch

# Optional: Run type checking in watch mode
npm run type-check:watch
```

### Browser Setup
1. **Open Developer Tools** (F12)
   - Console tab for errors
   - Network tab for API monitoring
   - React DevTools for component inspection

2. **Enable Preserve Log**
   - Maintains console history through reloads
   - Helps track intermittent issues

3. **Set up workspace**
   - Split screen: IDE + Browser
   - Keep relevant app pages open in tabs

## Validation Strategies by Task Type

### 1. Component Deletion Validation

```javascript
// Temporary validation helper (add to App.js)
useEffect(() => {
  if (process.env.NODE_ENV === 'development') {
    // List of deleted components
    const deletedComponents = [
      'ChartReviewTab_backup',
      'ChartReviewTab_v2',
      'ErrorBoundaryDemo'
    ];
    
    // Check window object for lingering references
    const found = deletedComponents.filter(name => window[name]);
    if (found.length > 0) {
      console.error('⚠️ Deleted components still referenced:', found);
    } else {
      console.log('✅ Component cleanup successful');
    }
  }
}, []);
```

**What to watch for:**
- Import errors in console
- Blank pages or error boundaries
- Missing route warnings
- Build errors in terminal

### 2. Service Integration Validation

```javascript
// Add debug logging to services during development
export class NotificationService {
  constructor() {
    if (process.env.NODE_ENV === 'development') {
      window.__notificationService = this; // Expose for debugging
      console.log('🔔 NotificationService initialized');
    }
  }
  
  async fetchNotifications() {
    console.log('📥 Fetching notifications...');
    const data = await this.api.get('/notifications');
    console.log('📬 Received:', data.length, 'notifications');
    return data;
  }
}
```

**Browser Console Commands:**
```javascript
// Test service directly from console
__notificationService.fetchNotifications();

// Trigger test notification
__notificationService.create({ 
  type: 'alert', 
  message: 'Test from console' 
});

// Check WebSocket status
__websocket.readyState; // Should be 1 (OPEN)
```

### 3. State Management Validation

```javascript
// Add Redux DevTools integration
const store = createStore(
  rootReducer,
  process.env.NODE_ENV === 'development' 
    ? window.__REDUX_DEVTOOLS_EXTENSION__?.() 
    : undefined
);

// Or for React Context debugging
export const DebugProvider = ({ children }) => {
  const value = useProviderValue();
  
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      window.__debugContext = value;
      console.log('Context updated:', value);
    }
  }, [value]);
  
  return <Provider value={value}>{children}</Provider>;
};
```

### 4. API Integration Validation

```javascript
// Add request interceptor for debugging
if (process.env.NODE_ENV === 'development') {
  axios.interceptors.request.use(request => {
    console.log('🚀 API Request:', request.method.toUpperCase(), request.url);
    return request;
  });
  
  axios.interceptors.response.use(
    response => {
      console.log('✅ API Response:', response.config.url, response.status);
      return response;
    },
    error => {
      console.error('❌ API Error:', error.config?.url, error.message);
      return Promise.reject(error);
    }
  );
}
```

## Hot Reload Scenarios

### Scenario 1: Adding New Features
```javascript
// Before: Component without feature
const ResultsTab = () => {
  const [vitals, setVitals] = useState([]);
  // ... existing code
};

// After: Add new feature
const ResultsTab = () => {
  const [vitals, setVitals] = useState([]);
  const [labs, setLabs] = useState([]);  // New state
  
  // Browser immediately shows new UI without restart
  return (
    <>
      <VitalSigns data={vitals} />
      <LabResults data={labs} />  {/* New component auto-renders */}
    </>
  );
};
```

**Validation Steps:**
1. Save file - browser auto-refreshes
2. Check console for errors
3. Verify new UI elements appear
4. Test functionality immediately
5. Check React DevTools for new state

### Scenario 2: Fixing Authentication
```javascript
// Add temporary auth debugging
useEffect(() => {
  const checkAuth = async () => {
    console.group('🔐 Auth Check');
    console.log('Token present:', !!localStorage.getItem('token'));
    console.log('User context:', user);
    console.log('Practitioner ID:', user?.practitionerId);
    console.groupEnd();
  };
  
  checkAuth();
}, [user]);
```

**Live Testing:**
1. Login with different users
2. Watch console for auth updates
3. Check network requests for proper headers
4. Verify practitioner data loads

### Scenario 3: WebSocket Validation
```javascript
// Add WebSocket status indicator during dev
const WebSocketStatus = () => {
  const { connected, reconnecting } = useWebSocket();
  
  if (process.env.NODE_ENV !== 'development') return null;
  
  return (
    <div style={{
      position: 'fixed',
      bottom: 10,
      right: 10,
      padding: '5px 10px',
      background: connected ? 'green' : reconnecting ? 'orange' : 'red',
      color: 'white',
      borderRadius: 5,
      fontSize: 12
    }}>
      WS: {connected ? 'Connected' : reconnecting ? 'Reconnecting...' : 'Disconnected'}
    </div>
  );
};
```

## Common Hot Reload Issues & Solutions

### Issue 1: State Loss
**Problem**: Component state resets on hot reload
**Solution**: Use React DevTools to preserve state or move state up

```javascript
// Use React's state preservation
const [count, setCount] = useState(() => {
  if (process.env.NODE_ENV === 'development') {
    return window.__preservedState?.count || 0;
  }
  return 0;
});

useEffect(() => {
  if (process.env.NODE_ENV === 'development') {
    window.__preservedState = { count };
  }
}, [count]);
```

### Issue 2: WebSocket Disconnection
**Problem**: WebSocket disconnects on hot reload
**Solution**: Implement auto-reconnect

```javascript
class WebSocketService {
  connect() {
    this.ws = new WebSocket(this.url);
    
    this.ws.onclose = () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('WebSocket closed, reconnecting in 1s...');
        setTimeout(() => this.connect(), 1000);
      }
    };
  }
}
```

### Issue 3: Duplicate Event Listeners
**Problem**: Event listeners accumulate on hot reload
**Solution**: Proper cleanup

```javascript
useEffect(() => {
  const handler = (e) => console.log('Event:', e);
  
  eventBus.on('test', handler);
  
  return () => {
    eventBus.off('test', handler); // Critical cleanup
  };
}, []);
```

## Validation Workflows

### Quick Validation Flow
1. **Make change** → Save file
2. **Browser updates** → Check console
3. **Test feature** → Verify behavior
4. **Check DevTools** → Inspect state/network
5. **Run specific test** → `npm test ComponentName`

### Comprehensive Validation
```bash
# Terminal 1: Dev server with hot reload
npm start

# Terminal 2: Test runner in watch mode
npm test -- --watch

# Terminal 3: Type checking
npm run type-check:watch

# Terminal 4: Linting
npm run lint:watch
```

### Browser Testing Matrix
- [ ] Chrome with React DevTools
- [ ] Firefox for console differences  
- [ ] Edge for compatibility
- [ ] Multiple tabs for concurrent user testing

## Performance Monitoring During Hot Reload

### React Profiler Setup
```javascript
import { Profiler } from 'react';

const onRenderCallback = (id, phase, actualDuration) => {
  if (actualDuration > 16) { // Longer than one frame
    console.warn(`Slow render in ${id}: ${actualDuration}ms`);
  }
};

<Profiler id="ResultsTab" onRender={onRenderCallback}>
  <ResultsTab />
</Profiler>
```

### Memory Leak Detection
```javascript
// Add to components during development
useEffect(() => {
  const startMemory = performance.memory?.usedJSHeapSize;
  
  return () => {
    const endMemory = performance.memory?.usedJSHeapSize;
    const leaked = endMemory - startMemory;
    if (leaked > 1000000) { // 1MB
      console.warn(`Potential memory leak: ${(leaked/1000000).toFixed(2)}MB`);
    }
  };
}, []);
```

## Best Practices

### 1. Development-Only Code
```javascript
// Always wrap dev code
if (process.env.NODE_ENV === 'development') {
  // Debug code here
}

// Or use a custom hook
const useDebug = (name, value) => {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${name}]`, value);
    }
  }, [name, value]);
};
```

### 2. Hot Reload Friendly Patterns
```javascript
// ❌ Bad: Anonymous functions recreated on reload
export default () => <div>Hello</div>;

// ✅ Good: Named components preserve state better
const MyComponent = () => <div>Hello</div>;
export default MyComponent;
```

### 3. Clean Console Output
```javascript
// Group related logs
console.group('Patient Data Load');
console.log('Patient ID:', patientId);
console.log('Resources fetched:', resources.length);
console.groupEnd();

// Use styled logs
console.log('%c✅ Feature enabled', 'color: green; font-weight: bold');
console.log('%c⚠️ Warning', 'color: orange; font-weight: bold');
console.log('%c❌ Error', 'color: red; font-weight: bold');
```

## Validation Checklist Templates

### Component Change Validation
- [ ] File saves without syntax errors
- [ ] Browser refreshes automatically
- [ ] No console errors (red)
- [ ] Component renders correctly
- [ ] Props pass through properly
- [ ] Event handlers work
- [ ] Styling applied correctly

### API Integration Validation  
- [ ] Network tab shows correct requests
- [ ] Request headers include auth
- [ ] Response data structure correct
- [ ] Loading states display
- [ ] Error states handle properly
- [ ] Success updates UI
- [ ] No duplicate requests

### State Management Validation
- [ ] State initializes correctly
- [ ] Updates reflect immediately
- [ ] No infinite loops
- [ ] Context consumers update
- [ ] Local storage syncs
- [ ] DevTools show correct state

## Troubleshooting

### If Hot Reload Stops Working
1. Check terminal for compilation errors
2. Hard refresh browser (Ctrl+Shift+R)
3. Clear browser cache
4. Restart dev server
5. Check for syntax errors in recent changes
6. Verify no circular dependencies

### Debug Mode Toggle
```javascript
// Add to your App.js for quick debugging toggle
window.toggleDebug = () => {
  const current = localStorage.getItem('debug') === 'true';
  localStorage.setItem('debug', !current);
  window.location.reload();
};

// In components
const debug = localStorage.getItem('debug') === 'true';
if (debug) {
  console.log('Debug info:', data);
}
```

Remember: Hot reload is a development superpower - use it to iterate quickly and validate changes in real-time!