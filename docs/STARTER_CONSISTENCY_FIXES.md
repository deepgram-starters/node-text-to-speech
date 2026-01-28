# Deepgram Node Starter Consistency Fixes

**Date:** 2026-01-28
**Status:** node-text-to-speech FIXED, others pending

## Summary

This document outlines consistency issues found across Deepgram node-* starter repositories and the fixes needed to bring them all to the same standard.

## Standard Configuration (Reference: node-voice-agent)

### Port Configuration
- **Backend Server:** `process.env.PORT || 8080`
- **Vite Dev Server:** `parseInt(process.env.VITE_PORT || '5173')`
- **Vite Preview:** `4173`
- **Vite Config:** Should use `strictPort: true` for better error handling

### Project Structure
- **Frontend:** Git submodule at `frontend/`
- **Backend:** Root level `server.js`
- **No `public/` folder:** Old frontend artifacts should be removed
- **Makefile:** Required at root level with consistent targets

---

## Fixes Completed

### ✅ node-text-to-speech (2026-01-28)

**Commit:** `7ab71a1` - refactor: remove old public/ folder and standardize ports

**Changes:**
1. Removed `public/` folder with legacy frontend (index.html, client.js, style.css, assets)
2. Updated `frontend/vite.config.js`:
   - Changed port from `8081` → `parseInt(process.env.VITE_PORT || '5173')`
   - Added `strictPort: true`
   - Changed preview port from `8081` → `4173`

---

## Fixes Needed

### 🔴 node-live-text-to-speech

**Priority:** HIGH

**Issue 1: Old public/ folder**
```bash
cd /Users/lukeoliff/Projects/deepgram-starters/node-live-text-to-speech
git rm -r public/
```

Files to remove:
- `public/index.html`
- `public/client.js`
- `public/style.css`
- `public/assets/preview-starter.png`
- `public/assets/logo-6ad0fabf.png`
- `public/assets/dg_favicon.ico`

**Issue 2: Hardcoded Vite port**

File: `/Users/lukeoliff/Projects/deepgram-starters/node-live-text-to-speech/frontend/vite.config.js`

Change:
```javascript
// Before (line 6)
server: {
  port: 5173,
  open: false,
  host: true
},

// After
server: {
  port: parseInt(process.env.VITE_PORT || '5173'),
  strictPort: true,
  open: false,
  host: true
},
```

Also update preview port (line 11):
```javascript
// Before
preview: {
  port: 5173,
  open: true,
  host: true
},

// After
preview: {
  port: 4173,
  open: true,
  host: true
},
```

---

### 🔴 node-live-transcription

**Priority:** HIGH

**Issue 1: Old public/ folder**
```bash
cd /Users/lukeoliff/Projects/deepgram-starters/node-live-transcription
git rm -r public/
```

Files to remove:
- `public/.gitkeep`
- `public/click.png`
- `public/test/test.js`
- `public/test/preamble.wav`

**Issue 2: Hardcoded Vite port**

File: `/Users/lukeoliff/Projects/deepgram-starters/node-live-transcription/frontend/vite.config.js`

Same changes as node-live-text-to-speech above (port 5173 → env-aware, preview 5173 → 4173)

---

### 🔴 node-transcription

**Priority:** MEDIUM

**Issue: Hardcoded Vite port (8081 instead of 5173)**

File: `/Users/lukeoliff/Projects/deepgram-starters/node-transcription/frontend/vite.config.js`

Change:
```javascript
// Before (lines 6, 11)
server: {
  port: 8081,
  open: false,
  host: true
},
preview: {
  port: 8081,
  open: true,
  host: true
},

// After
server: {
  port: parseInt(process.env.VITE_PORT || '5173'),
  strictPort: true,
  open: false,
  host: true
},
preview: {
  port: 4173,
  open: true,
  host: true
},
```

---

### 🟢 node-text-intelligence

**Status:** CLEAN ✅

No issues found. Configuration matches standard.

---

### 🟢 node-voice-agent

**Status:** REFERENCE STANDARD ✅

This repository serves as the reference implementation for correct configuration.

---

## Verification Checklist

After applying fixes to each repository, verify:

- [ ] No `public/` folder exists (only `frontend/` submodule)
- [ ] `frontend/vite.config.js` uses `parseInt(process.env.VITE_PORT || '5173')`
- [ ] `frontend/vite.config.js` has `strictPort: true`
- [ ] Preview port is `4173`
- [ ] `Makefile` exists with standard targets
- [ ] Backend `server.js` references `process.env.VITE_PORT || 5173`
- [ ] Can start with `make dev` and access at http://localhost:8080

---

## Standard Makefile Targets

All node-* starters should have these Makefile targets:

```makefile
help               # Display available commands
init               # Initialize submodules and install dependencies
install            # Install backend dependencies only
install-frontend   # Install frontend dependencies
build              # Build frontend for production
dev                # Start development servers
start              # Start production server
update             # Update submodules to latest commits
clean              # Remove node_modules and build artifacts
status             # Show git and submodule status
```

---

## Benefits of Standardization

1. **Consistent developer experience** across all starters
2. **Automation-friendly** - tools can reliably interact with repos
3. **Port collision avoidance** - all use same port scheme
4. **Environment-aware** - ports can be overridden via VITE_PORT env var
5. **Clean architecture** - no legacy frontend artifacts

---

## Implementation Order

### Phase 1: High Priority (Public Folder Removal)
1. node-live-text-to-speech
2. node-live-transcription

### Phase 2: Port Standardization
3. node-transcription
4. node-live-text-to-speech (if not done in Phase 1)
5. node-live-transcription (if not done in Phase 1)

---

## Contact

For questions about these changes, see:
- Reference implementation: `/Users/lukeoliff/Projects/deepgram-starters/node-voice-agent`
- This fix PR: node-text-to-speech branch `refactor/stateless-indexeddb-storage`
