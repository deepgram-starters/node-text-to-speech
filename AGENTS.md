# node-text-to-speech

Node.js demo app for Deepgram Text-to-Speech.

## Architecture

- **Backend:** Node.js (JavaScript) on port 8081
- **Frontend:** Vite + vanilla JS on port 8080 (git submodule: `text-to-speech-html`)
- **API type:** REST — `POST /api/text-to-speech`
- **Deepgram API:** Text-to-Speech (`/v1/speak`)
- **Auth:** JWT session tokens via `/api/session` (WebSocket auth uses `access_token.<jwt>` subprotocol)

## Key Files

| File | Purpose |
|------|---------|
| `server.js` | Main backend — API endpoints and request handlers |
| `deepgram.toml` | Metadata, lifecycle commands, tags |
| `Makefile` | Standardized build/run targets |
| `sample.env` | Environment variable template |
| `frontend/main.js` | Frontend logic — UI controls, API calls, result rendering |
| `frontend/index.html` | HTML structure and UI layout |
| `deploy/Dockerfile` | Production container (Caddy + backend) |
| `deploy/Caddyfile` | Reverse proxy, rate limiting, static serving |

## Quick Start

```bash
# Initialize (clone submodules + install deps)
make init

# Set up environment
test -f .env || cp sample.env .env  # then set DEEPGRAM_API_KEY

# Start both servers
make start
# Backend: http://localhost:8081
# Frontend: http://localhost:8080
```

## Start / Stop

**Start (recommended):**
```bash
make start
```

**Start separately:**
```bash
# Terminal 1 — Backend
node server.js

# Terminal 2 — Frontend
cd frontend && corepack pnpm run dev -- --port 8080 --no-open
```

**Stop all:**
```bash
lsof -ti:8080,8081 | xargs kill -9 2>/dev/null
```

**Clean rebuild:**
```bash
rm -rf node_modules frontend/node_modules frontend/.vite
make init
```

## Dependencies

- **Backend:** `package.json` — Uses `corepack pnpm` — Node's built-in package manager version pinning.
- **Frontend:** `frontend/package.json` — Vite dev server
- **Submodules:** `frontend/` (text-to-speech-html), `contracts/` (starter-contracts)

Install: `corepack pnpm install`
Frontend: `cd frontend && corepack pnpm install`

## API Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/session` | GET | None | Issue JWT session token |
| `/api/metadata` | GET | None | Return app metadata (useCase, framework, language) |
| `/api/text-to-speech` | POST | JWT | Converts text to speech audio using Deepgram's TTS API. |

## Customization Guide

### Changing the Default Voice
Find the `DEFAULT_MODEL` or `model` variable in the backend. Deepgram offers many voice options:

**Aura 2 voices** (latest, highest quality):
- `aura-2-thalia-en` (default)
- `aura-2-andromeda-en`
- `aura-2-arcas-en`
- `aura-2-atlas-en`
- `aura-2-luna-en`
- `aura-2-orion-en`
- `aura-2-stella-en`
- `aura-2-zeus-en`

**Legacy Aura voices:** `aura-asteria-en`, `aura-luna-en`, `aura-stella-en`, etc.

### Adding Audio Format Options
The TTS API supports different output formats via query parameters:

| Parameter | Default | Options | Effect |
|-----------|---------|---------|--------|
| `model` | `aura-2-thalia-en` | See voice list | Voice selection |
| `encoding` | (varies) | `linear16`, `mp3`, `opus`, `flac`, `alaw`, `mulaw` | Audio encoding |
| `container` | (varies) | `wav`, `mp3`, `ogg`, `none` | Container format |
| `sample_rate` | `24000` | `8000`-`48000` | Output sample rate |
| `bit_rate` | (varies) | `32000`-`320000` | For lossy codecs |

**Backend:** Add these as query params to the Deepgram API call or SDK options.
**Frontend:** Add dropdowns for encoding/format in `frontend/main.js`.

### Customizing the Input
- The frontend sends `{ text }` in the request body
- You could add SSML support by passing SSML-formatted text
- Add a character/word limit by validating in the backend

## Frontend Changes

The frontend is a git submodule from `deepgram-starters/text-to-speech-html`. To modify:

1. **Edit files in `frontend/`** — this is the working copy
2. **Test locally** — changes reflect immediately via Vite HMR
3. **Commit in the submodule:** `cd frontend && git add . && git commit -m "feat: description"`
4. **Push the frontend repo:** `cd frontend && git push origin main`
5. **Update the submodule ref:** `cd .. && git add frontend && git commit -m "chore(deps): update frontend submodule"`

**IMPORTANT:** Always edit `frontend/` inside THIS starter directory. The standalone `text-to-speech-html/` directory at the monorepo root is a separate checkout.

### Adding a UI Control for a New Feature
1. Add the HTML element in `frontend/index.html` (input, checkbox, dropdown, etc.)
2. Read the value in `frontend/main.js` when making the API call or opening the WebSocket
3. Pass it as a query parameter or request body field
4. Handle it in the backend `server.js` — read the param and pass it to the Deepgram API

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DEEPGRAM_API_KEY` | Yes | — | Deepgram API key |
| `PORT` | No | `8081` | Backend server port |
| `HOST` | No | `0.0.0.0` | Backend bind address |
| `SESSION_SECRET` | No | — | JWT signing secret (production) |

## Conventional Commits

All commits must follow conventional commits format. Never include `Co-Authored-By` lines for Claude.

```
feat(node-text-to-speech): add diarization support
fix(node-text-to-speech): resolve WebSocket close handling
refactor(node-text-to-speech): simplify session endpoint
chore(deps): update frontend submodule
```

## Testing

```bash
# Run conformance tests (requires app to be running)
make test

# Manual endpoint check
curl -sf http://localhost:8081/api/metadata | python3 -m json.tool
curl -sf http://localhost:8081/api/session | python3 -m json.tool
```
