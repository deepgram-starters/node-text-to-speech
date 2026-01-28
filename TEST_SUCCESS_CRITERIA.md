# Test Success Criteria - Visual Guide

## What You Should See When Tests Pass

### 1. IndexedDB Inspector
**Path:** DevTools → Application → IndexedDB → deepgram-tts-audio → audio-samples

**✅ SUCCESS:**
```
Key: "abc123def456"
Value: {
  id: "abc123def456",
  audioBlob: Blob {size: 45678, type: "audio/mp3"},
  timestamp: 1738099200000
}
```

**❌ FAILURE (if you see this):**
```
Key: "abc123def456"
Value: {
  id: "abc123def456",
  audioBase64: "data:audio/mp3;base64,//uQxAAA...",  // ❌ WRONG - base64 instead of Blob
  timestamp: 1738099200000
}
```

---

### 2. LocalStorage Console Check
**Command:** `JSON.parse(localStorage.getItem('deepgram_text_to_speech_history'))`

**✅ SUCCESS:**
```json
[
  {
    "id": "abc123def456",
    "text": "Hello, this is a test",
    "model": "aura-asteria-en",
    "timestamp": 1738099200000
  },
  {
    "id": "ghi789jkl012",
    "text": "Another test message",
    "model": "aura-asteria-en",
    "timestamp": 1738099260000
  }
]
```
- ✅ Only metadata: id, text, model, timestamp
- ✅ NO audioBase64 field
- ✅ NO audio field

**❌ FAILURE (if you see this):**
```json
[
  {
    "id": "abc123def456",
    "text": "Hello, this is a test",
    "audioBase64": "data:audio/mp3;base64,//uQxAAA...",  // ❌ WRONG
    "timestamp": 1738099200000
  }
]
```

---

### 3. Network Tab During Playback
**Path:** DevTools → Network → Filter: Fetch/XHR

**When clicking history item to play audio:**

**✅ SUCCESS:**
- No new network requests
- Audio plays from IndexedDB cache

**❌ FAILURE:**
- GET request to `/api/audio/abc123def456` (means still using old backend storage)

---

### 4. History Pruning Test
**After generating 6 items:**

**✅ SUCCESS:**
```javascript
// In Console:
JSON.parse(localStorage.getItem('deepgram_text_to_speech_history')).length
// Returns: 5 (not 6)
```

**In IndexedDB:**
- Only 5 audio blobs present
- Oldest blob automatically deleted

**❌ FAILURE:**
- More than 5 items in localStorage
- More than 5 blobs in IndexedDB
- Mismatch between localStorage count and IndexedDB count

---

### 5. Console Errors Check

**✅ SUCCESS:**
- No errors in console during:
  - Audio generation
  - History item playback
  - Page reload

**❌ FAILURE:**
```
Error: Failed to open IndexedDB  // Database access issue
Error: Blob not found in storage  // Storage mismatch
Error: Cannot read property 'play' of null  // Player issue
```

---

### 6. Browser Persistence Test

**Steps:**
1. Generate 3 audio samples
2. Close browser tab
3. Reopen http://localhost:8080

**✅ SUCCESS:**
- History shows all 3 items
- Clicking items plays correct audio
- No errors or missing data

**❌ FAILURE:**
- History is empty
- Audio won't play
- Console errors about missing data

---

## Quick Visual Checklist

Before marking Task 6 complete, verify you see:

- [ ] **IndexedDB:** Blob objects (not strings)
- [ ] **localStorage:** No `audioBase64` field
- [ ] **Network:** No GET requests during playback
- [ ] **History:** Maximum 5 items after pruning
- [ ] **Console:** No errors during normal operation
- [ ] **Persistence:** Data survives browser restart

---

## If Tests Fail

### Debugging Steps

1. **Clear old data:**
```javascript
// In Console
localStorage.clear()
indexedDB.deleteDatabase('deepgram-tts-audio')
location.reload()
```

2. **Check browser compatibility:**
- IndexedDB must be enabled
- Not in private/incognito mode (some browsers restrict storage)

3. **Verify file changes:**
```bash
cd /Users/lukeoliff/Projects/deepgram-starters/node-text-to-speech/.worktrees/refactor/stateless-indexeddb-storage
git log --oneline -5
```

Should show commits for:
- Backend stateless refactor
- Frontend IndexedDB integration
- Documentation updates

4. **Check module loading:**
Open DevTools → Sources → Look for:
- `/frontend/js/audio-storage.js` (should exist)
- `/frontend/js/audio-player.js` (should be modified)

---

## Performance Expectations

**Generation Time:** 2-5 seconds (network dependent)
**Playback Time:** Instant (IndexedDB is local)
**Storage Size:** ~50KB per 10-second audio sample (Blob format)
**localStorage Size:** <1KB for 5 history items (metadata only)

---

## Ready to Test?

1. Run commands from QUICK_TEST.md
2. Follow checklist above
3. Report any failures with specific error messages
4. If all pass → Mark Task 6 complete → Proceed to Task 7

**Good luck!**
