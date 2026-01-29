# Node Text-to-Speech Starter

Text-to-speech demo using Deepgram's API with Node.js backend and web frontend.

## Prerequisites

- [Deepgram API Key](https://console.deepgram.com/signup?jump=keys) (sign up for free)
- Node.js 24+ and pnpm 10+

**Note:** This project uses strict supply chain security measures. npm and yarn will NOT work - pnpm 10.0.0+ is required. See [SECURITY.md](SECURITY.md) for details.

## Quick Start

1. **Clone the repository**

Clone the repository with submodules (the frontend is a shared submodule):

```bash
git clone --recurse-submodules https://github.com/deepgram-starters/node-text-to-speech.git
cd node-text-to-speech
```

2. **Install dependencies**

```bash
# Option 1: Use the helper script (recommended)
pnpm run install:all

# Option 2: Manual two-step install
pnpm install
cd frontend && pnpm install && cd ..
```

**Note:** Due to security settings (`ignore-scripts=true`), frontend dependencies must be installed separately. The `install:all` script handles both steps. See [SECURITY.md](SECURITY.md) for details.

3. **Set your API key**

Create a `.env` file:

```bash
DEEPGRAM_API_KEY=your_api_key_here
```

4. **Run the app**

**Development mode** (with hot reload):

```bash
pnpm dev
```

**Production mode** (build and serve):

```bash
pnpm build
pnpm start
```

### 🌐 Open the App
[http://localhost:8080](http://localhost:8080)

## Features

- Enter text to convert to audio
- Multiple model options
- View text-to-speech history

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

## How It Works

- **Backend** (`server.js`): Node.js/Express server implementing the `/tts/synthesize` endpoint
- **Frontend** (`frontend/`): Vite-powered web UI for audio upload and transcription display
- **API**: Integrates with [Deepgram's Speech-Text-to-Speech API](https://developers.deepgram.com/)

## Makefile Commands

This project includes a Makefile for framework-agnostic operations:

```bash
make help              # Show all available commands
make init              # Initialize submodules and install dependencies
make dev               # Start development servers
make build             # Build frontend for production
make start             # Start production server
make update            # Update submodules to latest
make clean             # Remove node_modules and build artifacts
make status            # Show git and submodule status
```

Use `make` commands for a consistent experience regardless of package manager.

## Getting Help

- [Open an issue](https://github.com/deepgram-starters/live-node-starter/issues/new)
- [Join our Discord](https://discord.gg/xWRaCDBtW4)
- [Deepgram Documentation](https://developers.deepgram.com/)

## Security

This project implements comprehensive supply chain security measures including:
- Dependency pinning to exact versions
- Automated vulnerability scanning with Snyk
- Disabled lifecycle scripts
- Strict package manager enforcement (pnpm only)

See [SECURITY.md](SECURITY.md) for complete security documentation and reporting procedures.

## Contributing

Contributions are welcome! Please review:
- [Contributing Guidelines](CONTRIBUTING.md) - includes pnpm setup requirements
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md) - required for dependency updates

## License

MIT - See [LICENSE](./LICENSE)
