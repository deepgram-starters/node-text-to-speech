# Quick Testing Guide - Task 6

## Start Servers

**Terminal 1 (Backend):**
```bash
cd /Users/lukeoliff/Projects/deepgram-starters/node-text-to-speech/.worktrees/refactor/stateless-indexeddb-storage
NODE_ENV=development VITE_PORT=8081 corepack pnpm start
```

**Terminal 2 (Frontend):**
```bash
cd /Users/lukeoliff/Projects/deepgram-starters/node-text-to-speech/.worktrees/refactor/stateless-indexeddb-storage/frontend
corepack pnpm run dev
```

**Browser:** http://localhost:8080

---

## Quick Verification (5 minutes)

### 1. Generate Audio
- Enter text → Click "Generate Audio"
- Repeat 3 times

### 2. Check IndexedDB
DevTools → Application → IndexedDB → deepgram-tts-audio
- ✅ Should see Blob objects (NOT base64 strings)

### 3. Check LocalStorage
DevTools → Console:
```javascript
JSON.parse(localStorage.getItem('deepgram_text_to_speech_history'))
```
- ✅ Should have NO `audioBase64` field
- ✅ Should only have: id, text, model, timestamp

### 4. Test Playback
- Click history items → Audio should play

### 5. Test Pruning
- Generate 6+ items
- ✅ Only 5 most recent should remain

---

## Success Criteria

✅ Audio stored as Blobs in IndexedDB
✅ No audioBase64 in localStorage
✅ History playback works
✅ Pruning keeps only 5 items
✅ Data persists after browser restart

---

**Full details:** See TESTING_REPORT.md
