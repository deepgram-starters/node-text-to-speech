# Stateless Backend with IndexedDB Audio History Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor node-text-to-speech to make backend stateless (remove file storage) and move audio history to frontend using IndexedDB for efficient binary storage.

**Architecture:** Backend becomes pure stateless API that returns audio directly. Frontend uses hybrid storage: IndexedDB for audio blobs (efficient binary storage), localStorage for metadata (fast UI rendering). Remove base64 conversion overhead.

**Tech Stack:** Node.js, Express, IndexedDB API, localStorage API, vanilla JavaScript

---

## Task 1: Backend Cleanup (Remove File Storage)

**Files:**
- Modify: `server.js:100-107` (remove audio directory setup)
- Modify: `server.js:168-193` (remove saveAudioFile function)

**Step 1: Remove audio directory creation**

Open `server.js` and remove lines 100-107:

```javascript
// DELETE THESE LINES:
// Ensure audio directory exists
const audioDirectory = path.join(__dirname, "audio");
if (!fs.existsSync(audioDirectory)) {
  fs.mkdirSync(audioDirectory, { recursive: true });
}

// Serve audio files statically
app.use("/audio", express.static(audioDirectory));
```

**Step 2: Remove unused saveAudioFile function**

In `server.js`, remove lines 168-193 (the entire `saveAudioFile` function):

```javascript
// DELETE THIS ENTIRE FUNCTION:
/**
 * Saves audio buffer to a file and returns the URL
 * @param {Buffer} audioBuffer - The audio data to save
 * @param {string} filename - Optional filename (defaults to timestamped name)
 * @returns {Promise<string>} - The URL path to the saved audio file
 */
async function saveAudioFile(audioBuffer, filename = null) {
  // ... entire function body ...
}
```

**Step 3: Verify backend still works**

Run the server:
```bash
NODE_ENV=development VITE_PORT=8081 corepack pnpm start
```

Expected: Server starts without errors, no mention of audio directory

**Step 4: Commit backend changes**

```bash
git add server.js
git commit -m "refactor(backend): remove file storage, make backend stateless

- Remove audio directory creation and static serving
- Remove unused saveAudioFile function
- Backend now only returns audio directly to client
"
```

---

## Task 2: Create IndexedDB Audio Storage Module

**Files:**
- Create: `frontend/audioDb.js`

**Step 1: Create IndexedDB wrapper module**

Create `frontend/audioDb.js`:

```javascript
/**
 * IndexedDB wrapper for efficient audio blob storage
 *
 * This module provides a simple API for storing and retrieving
 * audio blobs in IndexedDB, which is more efficient than
 * storing base64 strings in localStorage.
 */

const AudioDB = {
  dbName: 'deepgram-tts-audio',
  storeName: 'audio-blobs',
  version: 1,

  /**
   * Initialize IndexedDB database
   * Creates the object store if it doesn't exist
   * @returns {Promise<IDBDatabase>}
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
          console.log('Created audio-blobs object store');
        }
      };
    });
  },

  /**
   * Save audio blob with requestId as key
   * @param {string} requestId - Unique identifier for this audio
   * @param {Blob} blob - Audio blob to store
   * @returns {Promise<void>}
   */
  async saveAudio(requestId, blob) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.put(blob, requestId);

      request.onsuccess = () => {
        console.log(`Saved audio to IndexedDB: ${requestId}`);
        resolve();
      };

      request.onerror = () => {
        console.error('Error saving audio:', request.error);
        reject(request.error);
      };
    });
  },

  /**
   * Retrieve audio blob by requestId
   * @param {string} requestId - Unique identifier for the audio
   * @returns {Promise<Blob|null>} Audio blob or null if not found
   */
  async getAudio(requestId) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(requestId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('Error retrieving audio:', request.error);
        reject(request.error);
      };
    });
  },

  /**
   * Delete audio blob by requestId
   * Used when pruning old history entries
   * @param {string} requestId - Unique identifier for the audio
   * @returns {Promise<void>}
   */
  async deleteAudio(requestId) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(requestId);

      request.onsuccess = () => {
        console.log(`Deleted audio from IndexedDB: ${requestId}`);
        resolve();
      };

      request.onerror = () => {
        console.error('Error deleting audio:', request.error);
        reject(request.error);
      };
    });
  }
};

// Export for use in main.js
export default AudioDB;
```

**Step 2: Verify module loads**

Check that the file was created correctly:
```bash
cat frontend/audioDb.js | head -20
```

Expected: File exists with proper ES6 module export

**Step 3: Commit AudioDB module**

```bash
git add frontend/audioDb.js
git commit -m "feat(frontend): add IndexedDB wrapper for audio storage

- Create AudioDB module for efficient blob storage
- Provides init, saveAudio, getAudio, deleteAudio methods
- More efficient than base64 in localStorage
"
```

---

## Task 3: Update Frontend to Use IndexedDB

**Files:**
- Modify: `frontend/index.html` (add module import)
- Modify: `frontend/main.js:78-108` (remove base64 functions)
- Modify: `frontend/main.js:143-180` (update saveToHistory)
- Modify: `frontend/main.js:259-266` (update renderHistory audio loading)
- Modify: `frontend/main.js:298-320` (update loadHistoryEntry)

**Step 1: Import AudioDB module in HTML**

In `frontend/index.html`, find the script tag that loads `main.js` and update it to use module type:

```html
<!-- Change from: -->
<script src="/main.js"></script>

<!-- To: -->
<script type="module" src="/main.js"></script>
```

**Step 2: Import AudioDB in main.js**

At the top of `frontend/main.js` (after the header comment, around line 21), add:

```javascript
// Import IndexedDB audio storage
import AudioDB from './audioDb.js';
```

**Step 3: Remove base64 conversion functions**

In `frontend/main.js`, delete lines 73-108 (both `blobToBase64` and `base64ToBlobUrl` functions):

```javascript
// DELETE THESE FUNCTIONS:
/**
 * Converts a Blob to base64 string for storage in localStorage
 * ...
 */
async function blobToBase64(blob) {
  // ... delete entire function
}

/**
 * Converts a base64 string back to a blob URL for playback
 * ...
 */
function base64ToBlobUrl(base64) {
  // ... delete entire function
}
```

**Step 4: Update saveToHistory function**

Replace the `saveToHistory` function (lines 143-180) with:

```javascript
/**
 * Saves a text-to-speech result to history
 * Audio stored in IndexedDB, metadata stored in localStorage
 *
 * @param {Blob} audioBlob - The audio blob to save
 * @param {string} text - The input text
 * @param {string} model - Model name used for generation
 * @returns {Promise<Object|null>} The saved history entry, or null if save failed
 */
async function saveToHistory(audioBlob, text, model) {
  try {
    const history = getHistory();

    // Generate unique ID using crypto API
    const requestId = crypto.randomUUID ? crypto.randomUUID() : `local_${Date.now()}`;

    // Save audio to IndexedDB
    await AudioDB.saveAudio(requestId, audioBlob);

    // Save metadata to localStorage (no audio data)
    const historyEntry = {
      id: requestId,
      timestamp: new Date().toISOString(),
      text,
      model,
      // No audioBase64 - audio lives in IndexedDB
    };

    // Add to beginning of array (newest first)
    history.unshift(historyEntry);

    // Keep only the most recent entries
    const trimmedHistory = history.slice(0, MAX_HISTORY_ENTRIES);

    // Delete old audio from IndexedDB when pruning
    if (history.length > MAX_HISTORY_ENTRIES) {
      const removedEntries = history.slice(MAX_HISTORY_ENTRIES);
      for (const entry of removedEntries) {
        await AudioDB.deleteAudio(entry.id);
      }
    }

    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmedHistory));

    // Update history UI
    renderHistory();

    return historyEntry;
  } catch (error) {
    console.error("Error saving to history:", error);
    return null;
  }
}
```

**Step 5: Update renderHistory to load audio from IndexedDB**

In `frontend/main.js`, find the `renderHistory` function (around line 217). Update the audio loading section (around lines 259-274):

```javascript
// Replace this section:
// Create audio element - convert base64 to blob URL if needed
let audioUrl = null;
if (entry.audioBase64) {
  audioUrl = base64ToBlobUrl(entry.audioBase64);
} else if (entry.audioUrl) {
  // Legacy support for old entries that might have audioUrl
  audioUrl = entry.audioUrl;
}

const audioElement = audioUrl
  ? `<div class="history-item__audio">
       <audio controls preload="metadata" src="${escapeHtml(audioUrl)}">
         Your browser does not support the audio element.
       </audio>
     </div>`
  : "";

// With this:
// Audio will be loaded on-demand when history item is clicked
// For now, just show a play button or indicator
const audioElement = `<div class="history-item__audio" style="font-size: 0.7rem; color: var(--dg-muted);">
  Click to play audio
</div>`;
```

**Step 6: Update loadHistoryEntry to fetch from IndexedDB**

In `frontend/main.js`, find the `loadHistoryEntry` function (around line 298). Update it to:

```javascript
/**
 * Loads and displays a history entry by its request ID
 * Fetches audio from IndexedDB and creates blob URL for playback
 *
 * @param {string} requestId - The unique ID of the history entry to load
 */
async function loadHistoryEntry(requestId) {
  const entry = getHistoryEntryById(requestId);

  if (!entry) {
    console.error("History entry not found:", requestId);
    return;
  }

  // Set as active
  activeRequestId = requestId;
  renderHistory();

  try {
    // Fetch audio from IndexedDB
    const audioBlob = await AudioDB.getAudio(requestId);

    if (!audioBlob) {
      console.error("Audio not found in IndexedDB:", requestId);
      showError("Audio data not found");
      return;
    }

    // Create blob URL for playback
    const audioUrl = URL.createObjectURL(audioBlob);

    // Display the result (use existing display logic)
    displayResult({
      text: entry.text,
      model: entry.model,
      audioUrl: audioUrl,
      requestId: entry.id,
      timestamp: entry.timestamp
    });

  } catch (error) {
    console.error("Error loading history entry:", error);
    showError("Failed to load audio from history");
  }
}
```

**Step 7: Test the changes locally**

Start both servers:
```bash
# Terminal 1 - Backend
NODE_ENV=development VITE_PORT=8081 corepack pnpm start

# Terminal 2 - Frontend
cd frontend && corepack pnpm run dev
```

Then open http://localhost:8080 and:
1. Generate a new audio sample
2. Verify it appears in history
3. Click the history item to play it
4. Close and reopen browser to verify persistence

Expected: Audio generates, saves to IndexedDB, and plays back correctly

**Step 8: Commit frontend changes**

```bash
git add frontend/index.html frontend/main.js
git commit -m "refactor(frontend): use IndexedDB for audio storage

- Import AudioDB module
- Remove base64 conversion functions (no longer needed)
- Update saveToHistory to store blobs in IndexedDB
- Update loadHistoryEntry to fetch from IndexedDB
- localStorage now only stores metadata
- More efficient storage and retrieval
"
```

---

## Task 4: Add Migration Support for Old History

**Files:**
- Modify: `frontend/main.js` (add migration logic)

**Step 1: Add migration function**

Add this function in `frontend/main.js` after the `clearHistory()` function (around line 196):

```javascript
/**
 * Migrates old history entries from base64 localStorage to IndexedDB
 * This ensures backward compatibility with existing user data
 *
 * @returns {Promise<number>} Number of entries migrated
 */
async function migrateOldHistory() {
  try {
    const history = getHistory();
    let migratedCount = 0;

    for (const entry of history) {
      // Check if this entry has old base64 audio data
      if (entry.audioBase64 && !await AudioDB.getAudio(entry.id)) {
        // Convert base64 to blob
        const mimeType = 'audio/wav';
        const byteCharacters = atob(entry.audioBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });

        // Save to IndexedDB
        await AudioDB.saveAudio(entry.id, blob);

        // Remove audioBase64 from entry
        delete entry.audioBase64;
        migratedCount++;
      }
    }

    // Save updated history (without audioBase64)
    if (migratedCount > 0) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      console.log(`Migrated ${migratedCount} history entries to IndexedDB`);
    }

    return migratedCount;
  } catch (error) {
    console.error("Error migrating history:", error);
    return 0;
  }
}
```

**Step 2: Call migration on app init**

Find the `init()` function in `frontend/main.js` (near the end of the file, around line 900). Add migration call:

```javascript
async function init() {
  // ... existing DOM element caching ...

  // Migrate old history entries to IndexedDB
  await migrateOldHistory();

  // ... rest of init function ...
}
```

**Step 3: Test migration**

To test migration:
1. Manually add old-style entry to localStorage in browser console:
```javascript
localStorage.setItem('deepgram_text_to_speech_history', JSON.stringify([{
  id: 'test-old-entry',
  timestamp: new Date().toISOString(),
  text: 'Test migration',
  model: 'aura-2-thalia-en',
  audioBase64: 'test-base64-data'
}]));
```
2. Reload page
3. Check console for migration message

Expected: Console shows "Migrated 1 history entries to IndexedDB"

**Step 4: Commit migration support**

```bash
git add frontend/main.js
git commit -m "feat(frontend): add migration for old localStorage history

- Add migrateOldHistory function to convert base64 to IndexedDB
- Call migration on app initialization
- Ensures backward compatibility with existing user data
"
```

---

## Task 5: Update Documentation

**Files:**
- Modify: `README.md` (update architecture description)
- Modify: `frontend/main.js` (update header comment)

**Step 1: Update frontend main.js header**

In `frontend/main.js`, update the header comment (lines 1-20) to reflect new architecture:

```javascript
/**
 * Text-to-Speech HTML Starter - Frontend Application
 *
 * This is a vanilla JavaScript frontend that provides a text-to-speech UI
 * for Deepgram's Text-to-Speech service. It's designed to be easily
 * modified and extended for your own projects.
 *
 * Key Features:
 * - Text input for speech generation
 * - Model selection
 * - Audio playback
 * - History management with IndexedDB and localStorage
 * - Responsive UI with Deepgram design system
 *
 * Architecture:
 * - Pure vanilla JavaScript (no frameworks required)
 * - Uses native Fetch API for HTTP requests
 * - IndexedDB for efficient audio blob storage
 * - LocalStorage for metadata (text, model, timestamp)
 * - Event-driven UI updates
 */
```

**Step 2: Update README architecture section**

In `README.md`, find the architecture section and add/update storage information:

```markdown
## Architecture

### Backend
- **Stateless API**: Returns audio directly, no file storage
- Express server with single endpoint: `/tts/synthesize`
- Proxies to Vite dev server in development mode

### Frontend
- **Hybrid Storage**:
  - IndexedDB for audio blobs (efficient binary storage)
  - localStorage for metadata (fast UI rendering)
- Pure vanilla JavaScript (no frameworks)
- Deepgram Design System for styling
```

**Step 3: Commit documentation updates**

```bash
git add README.md frontend/main.js
git commit -m "docs: update architecture documentation

- Document IndexedDB + localStorage hybrid storage
- Update frontend main.js header comment
- Clarify stateless backend architecture
"
```

---

## Task 6: Final Testing and Verification

**Step 1: Clean test - fresh IndexedDB**

Clear browser data and test from scratch:
1. Open browser DevTools → Application → Storage
2. Clear IndexedDB, localStorage, and Cache
3. Reload application
4. Generate 3 audio samples
5. Verify all appear in history
6. Reload page and verify persistence
7. Click history items to verify playback

Expected: All features work correctly with fresh storage

**Step 2: Verify IndexedDB usage**

In browser DevTools:
1. Application → Storage → IndexedDB
2. Expand "deepgram-tts-audio" database
3. Check "audio-blobs" object store
4. Verify audio blobs are stored (should see Blob objects)

Expected: Audio blobs visible in IndexedDB with correct requestIds

**Step 3: Verify localStorage is lightweight**

In browser DevTools console:
```javascript
JSON.parse(localStorage.getItem('deepgram_text_to_speech_history'))
```

Expected: Array of objects with NO `audioBase64` field, only metadata

**Step 4: Test history pruning**

Generate more than MAX_HISTORY_ENTRIES (5) audio samples and verify:
1. Only 5 most recent appear in history
2. Old entries removed from both localStorage AND IndexedDB

**Step 5: Performance comparison**

Compare storage sizes in DevTools:
- Before (base64 in localStorage): ~1.3x size of audio
- After (IndexedDB): ~1x size of audio (raw blobs)

Expected: Smaller total storage footprint

**Step 6: Create final verification commit**

If all tests pass:
```bash
git commit --allow-empty -m "test: verify IndexedDB audio storage implementation

All tests passing:
- Fresh install generates and stores audio correctly
- Audio blobs stored in IndexedDB (not base64)
- Metadata in localStorage is lightweight
- History persistence works across page reloads
- History pruning removes from both storages
- Migration handles old base64 entries
"
```

---

## Summary

**Changes:**
- Backend: Removed file storage (100+ lines deleted)
- Frontend: Added IndexedDB module (150 lines)
- Frontend: Refactored storage logic (removed base64, added IndexedDB calls)
- Added migration for backward compatibility

**Benefits:**
- Backend is fully stateless (scales horizontally)
- More efficient storage (raw blobs vs base64)
- Larger storage quota (50MB+ vs 5-10MB)
- Better separation of concerns (metadata vs binary data)

**Testing:**
Run all steps in Task 6 to verify complete implementation.
