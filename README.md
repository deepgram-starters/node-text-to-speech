# Node Text-to-Speech Starter

Text-to-speech demo using Deepgram's API with Node.js backend and web frontend.

## Prerequisites

- [Deepgram API Key](https://console.deepgram.com/signup?jump=keys) (sign up for free)
- Node.js 24+ and pnpm 10+

**Note:** This project uses strict supply chain security measures. npm and yarn will NOT work - pnpm 10.0.0+ is required. See [SECURITY.md](SECURITY.md) for details.

## Quick Start

1. **Install dependencies**

```bash
# Option 1: Use the helper script (recommended)
pnpm run install:all

# Option 2: Manual two-step install
pnpm install
cd frontend && pnpm install && cd ..
```

**Note:** Due to security settings (`ignore-scripts=true`), frontend dependencies must be installed separately. The `install:all` script handles both steps. See [SECURITY.md](SECURITY.md) for details.

2. **Set your API key**

Create a `.env` file:

```bash
DEEPGRAM_API_KEY=your_api_key_here
```

3. **Run the app**

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
[http://localhost:3000](http://localhost:3000)

## Features

- Enter text to convert to audio
- Multiple model options
- View text-to-speech history

## How It Works

- **Backend** (`server.js`): Node.js/Express server implementing the `/tts/synthesize` endpoint
- **Frontend** (`frontend/`): Vite-powered web UI for audio upload and transcription display
- **API**: Integrates with [Deepgram's Speech-Text-to-Speech API](https://developers.deepgram.com/)

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
