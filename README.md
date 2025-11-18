# Node Text-to-Speech Starter

Text-to-speech demo using Deepgram's API with Node.js backend and web frontend.

## Prerequisites

- [Deepgram API Key](https://console.deepgram.com/signup?jump=keys) (sign up for free)
- Node.js 18+ and pnpm

## Quick Start

1. **Install dependencies**

```bash
pnpm install
```

This automatically installs both backend and frontend dependencies.

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

Open [http://localhost:3000](http://localhost:3000)

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

## License

MIT - See [LICENSE](./LICENSE)
