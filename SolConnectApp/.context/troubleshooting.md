# Troubleshooting Guide

## Common Issues and Solutions

### 🔴 WebSocket Connection Failed

**Symptoms**:
- "Failed to connect to relay server" error
- Messages not sending/receiving
- Connection status shows "disconnected"

**Solutions**:
1. **Check relay server is running**:
   ```bash
   # Terminal 2
   npm run relay
   ```

2. **Verify port 8080 is available**:
   ```bash
   lsof -i :8080
   # Kill any process using the port
   kill -9 <PID>
   ```

3. **Check WebSocket URL**:
   - Should be `ws://localhost:8080` for development
   - Check `SolConnectSDK` initialization

4. **Browser console errors**:
   - Open DevTools Network tab
   - Look for WebSocket connection
   - Check for CORS or security errors

---

### 🔴 TypeScript Errors

**Symptoms**:
- Red squiggles in VS Code
- Build failures
- `npm run tsc` shows errors

**Solutions**:
1. **Missing types**:
   ```bash
   npm install
   npm install --save-dev @types/node @types/react
   ```

2. **Import errors**:
   - Check file paths (case-sensitive on Linux/Mac)
   - Ensure `.ts`/`.tsx` extensions are correct
   - Try restart TS server: Cmd+Shift+P → "Restart TS Server"

3. **Type mismatches**:
   - Check `Result<T>` usage
   - Ensure error handling follows patterns
   - Review `code-patterns.md` for examples

---

### 🔴 Messages Not Persisting

**Symptoms**:
- Messages disappear on refresh
- Storage errors in console
- Settings screen shows 0 messages

**Solutions**:
1. **Check browser storage**:
   - Open DevTools → Application → Local Storage
   - Look for `solconnect_` prefixed keys
   - Clear if corrupted

2. **Storage quota**:
   ```javascript
   // Check available storage
   navigator.storage.estimate().then(estimate => {
     console.log(`Used: ${estimate.usage}, Available: ${estimate.quota}`);
   });
   ```

3. **Initialize MessageBus with persistence**:
   ```typescript
   await initializeMessageBus({
     relayEndpoint: 'ws://localhost:8080',
     enablePersistence: true  // Must be true
   });
   ```

---

### 🔴 Security Vulnerabilities

**Symptoms**:
- `npm audit` shows vulnerabilities
- CI/CD pipeline fails
- Security warnings in GitHub

**Solutions**:
1. **Auto-fix vulnerabilities**:
   ```bash
   npm audit fix
   npm audit fix --force  # Use carefully
   ```

2. **Manual updates**:
   ```bash
   npm update <package-name>
   npm install <package-name>@latest
   ```

3. **Check for breaking changes**:
   - Read package changelogs
   - Test thoroughly after updates
   - Consider using `npm-check-updates`

---

### 🔴 Build Failures

**Symptoms**:
- `npm run build` fails
- Production deployment errors
- Module not found errors

**Solutions**:
1. **Clean build**:
   ```bash
   rm -rf .next node_modules
   npm install
   npm run build
   ```

2. **Check imports**:
   - No circular dependencies
   - All files exist
   - Correct import paths

3. **Environment variables**:
   - Create `.env.local` if missing
   - Set required variables
   - Check `.env.example`

---

### 🔴 State Management Issues

**Symptoms**:
- UI not updating
- Stale data displayed
- React warnings about keys

**Solutions**:
1. **Check subscriptions**:
   ```typescript
   // Ensure cleanup in useEffect
   useEffect(() => {
     const sub = sdk.subscribeToMessages(sessionId, handler);
     return () => sub.unsubscribe();
   }, [sessionId]);
   ```

2. **Verify state updates**:
   - Use React DevTools
   - Check Zustand store updates
   - Ensure immutable updates

3. **Key prop warnings**:
   ```typescript
   // Use unique, stable keys
   messages.map((msg, index) => (
     <div key={msg.id || `${msg.timestamp}-${index}`}>
   ))
   ```

---

### 🔴 Mobile/Web Compatibility

**Symptoms**:
- Works on web but not mobile
- AsyncStorage errors
- Platform-specific crashes

**Solutions**:
1. **Check platform detection**:
   ```typescript
   if (typeof window !== 'undefined' && window.localStorage) {
     // Web code
   } else {
     // Mobile code
   }
   ```

2. **Dynamic imports**:
   ```typescript
   const AsyncStorage = require('@react-native-async-storage/async-storage').default;
   ```

3. **Test both platforms**:
   ```bash
   # Web
   npm run dev
   
   # Mobile
   npm run mobile
   ```

---

## 🛠️ Debugging Tools

### Browser DevTools
1. **Console**: Check for errors and logs
2. **Network**: Monitor WebSocket frames
3. **Application**: Inspect localStorage
4. **React DevTools**: Component state and props

### VS Code Extensions
- **ESLint**: Catch code issues
- **Prettier**: Format consistently
- **TypeScript Error Lens**: Inline errors
- **GitLens**: Track code changes

### Command Line Tools
```bash
# Check types
npm run tsc

# Lint code
npm run lint

# Security audit
npm audit

# Bundle analysis
npm run build && npm run analyze
```

---

## 🚨 Emergency Fixes

### Reset Everything
```bash
# Nuclear option - use carefully!
rm -rf node_modules .next
npm cache clean --force
npm install
npm run dev
```

### Clear All Storage
```javascript
// Run in browser console
localStorage.clear();
sessionStorage.clear();
indexedDB.deleteDatabase('solconnect');
```

### Force Reconnect
```javascript
// Run in browser console
window.location.reload(true);
```

---

## 📞 Getting Help

1. **Check logs first**:
   - Browser console
   - Terminal output
   - Network tab

2. **Search codebase**:
   ```bash
   grep -r "error message" src/
   ```

3. **Review documentation**:
   - `SPEC.md` - Technical details
   - `CONTEXT.md` - Development guide
   - `code-patterns.md` - Examples

4. **Debug systematically**:
   - Isolate the problem
   - Check recent changes
   - Test in different environments
   - Use git bisect if needed 