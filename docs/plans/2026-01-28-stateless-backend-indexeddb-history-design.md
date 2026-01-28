# Stateless Backend with IndexedDB Audio History

**Date**: 2026-01-28
**Status**: Approved
**Goal**: Make backend stateless by removing file storage, move audio history to frontend using IndexedDB

## Problem

Current implementation stores audio files on the server filesystem (`/audio` directory), which:
- Creates server-side state (files accumulate)
- Doesn't scale horizontally (files tied to specific server instance)
- Mixes concerns (backend handles both generation and persistence)

## Solution

Make backend purely stateless: it generates and returns audio, then forgets. Frontend manages all history using browser storage.

## Architecture Changes

### Backend (Stateless)

**Remove:**
- Audio directory creation and management
- Static file serving for `/audio` route
- `saveAudioFile()` function (unused)

**Keep:**
- `/tts/synthesize` endpoint (already returns binary audio data)
- Audio generation logic (already stateless)

**Result:** Backend becomes a pure API that generates and returns audio on demand.

### Frontend (Storage Layer)

**Add IndexedDB wrapper** for binary audio storage:

```javascript
const AudioDB = {
  dbName: 'deepgram-tts-audio',
  storeName: 'audio-blobs',

  async saveAudio(requestId, blob)    // Store audio blob
  async getAudio(requestId)           // Retrieve audio blob
  async deleteAudio(requestId)        // Clean up old audio
}
```

**Keep localStorage** for metadata only:

```javascript
{
  requestId: "uuid",
  text: "User's input text",
  model: "aura-2-thalia-en",
  timestamp: 1234567890
  // No audio data or URLs
}
```

**Remove:**
- `blobToBase64()` - no longer needed
- `base64ToBlobUrl()` - no longer needed
- Base64 storage in localStorage

## Data Flow

### Generation Flow

1. User enters text and clicks "Generate Speech"
2. Frontend POSTs to `/tts/synthesize`
3. Backend generates audio and returns binary data
4. Frontend receives audio as Blob
5. Generate unique `requestId` (crypto.randomUUID())
6. **Save to IndexedDB**: `AudioDB.saveAudio(requestId, blob)`
7. **Save to localStorage**: metadata only (text, model, timestamp, requestId)
8. Create blob URL for playback: `URL.createObjectURL(blob)`
9. Display audio player

### History Playback Flow

1. Load history array from localStorage (metadata only)
2. Render history list in sidebar
3. User clicks history item
4. **Fetch from IndexedDB**: `blob = await AudioDB.getAudio(requestId)`
5. Create blob URL: `URL.createObjectURL(blob)`
6. Update audio player

### History Pruning Flow

1. When history exceeds MAX_HISTORY_ENTRIES
2. Get requestId of items being removed
3. **Delete from IndexedDB**: `AudioDB.deleteAudio(requestId)`
4. Remove from localStorage metadata array

## Benefits

**Backend:**
- Fully stateless - no file cleanup needed
- Scales horizontally without shared storage
- Simpler code (remove file management)

**Frontend:**
- More efficient storage (Blobs vs base64 strings)
- Larger storage quota (IndexedDB ~50MB+ vs localStorage ~5-10MB)
- Better separation of concerns (metadata vs binary data)
- Works offline once audio is cached

## Implementation Notes

- Backend changes are minimal (mostly deletions)
- Frontend changes are additive (new IndexedDB layer)
- Existing localStorage metadata structure preserved
- Migration: old history items with base64 will continue to work, new items use IndexedDB
