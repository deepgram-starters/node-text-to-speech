/**
 * Node Text-to-Speech Starter - Backend Server
 *
 * This is a simple Express server that provides a text-to-speech API endpoint
 * powered by Deepgram's Text-to-Speech service. It's designed to be easily
 * modified and extended for your own projects.
 *
 * Key Features:
 * - Single API endpoint: POST /api
 * - Accepts text and model parameters
 * - Generates audio files and returns URLs
 * - Proxies to Vite dev server in development
 * - Serves static frontend in production
 */

require("dotenv").config();

const { createClient } = require("@deepgram/sdk");
const { createProxyMiddleware } = require("http-proxy-middleware");
const express = require("express");
const fs = require("fs");
const path = require("path");

// ============================================================================
// CONFIGURATION - Customize these values for your needs
// ============================================================================

/**
 * Default text-to-speech model to use when none is specified
 * Options: "aura-2-thalia-en", "aura-2-theia-en", "aura-2-andromeda-en", etc.
 * See: https://developers.deepgram.com/docs/text-to-speech-models
 */
const DEFAULT_MODEL = "aura-2-thalia-en";

/**
 * Server configuration - These can be overridden via environment variables
 */
const CONFIG = {
  port: process.env.PORT || 3000,
  host: process.env.HOST || "0.0.0.0",
  vitePort: process.env.VITE_PORT || 5173,
  isDevelopment: process.env.NODE_ENV === "development",
};

// ============================================================================
// API KEY LOADING - Load Deepgram API key from .env or config.json
// ============================================================================

/**
 * Loads the Deepgram API key from environment variables or config.json
 * Priority: DEEPGRAM_API_KEY env var > config.json > error
 */
function loadApiKey() {
  // Try environment variable first (recommended)
  let apiKey = process.env.DEEPGRAM_API_KEY;

  // Fall back to config.json if it exists
  if (!apiKey) {
    try {
      const config = require("./config.json");
      apiKey = config.dgKey;
    } catch (err) {
      // config.json doesn't exist or is invalid - that's ok
    }
  }

  // Exit with helpful error if no API key found
  if (!apiKey) {
    console.error("\n❌ ERROR: Deepgram API key not found!\n");
    console.error("Please set your API key using one of these methods:\n");
    console.error("1. Create a .env file (recommended):");
    console.error("   DEEPGRAM_API_KEY=your_api_key_here\n");
    console.error("2. Environment variable:");
    console.error("   export DEEPGRAM_API_KEY=your_api_key_here\n");
    console.error("3. Create a config.json file:");
    console.error("   cp config.json.example config.json");
    console.error("   # Then edit config.json with your API key\n");
    console.error("Get your API key at: https://console.deepgram.com\n");
    process.exit(1);
  }

  return apiKey;
}

const apiKey = loadApiKey();

// ============================================================================
// SETUP - Initialize Express, Deepgram, and middleware
// ============================================================================

// Initialize Deepgram client
const deepgram = createClient(apiKey);

// Initialize Express app
const app = express();

// Middleware for parsing JSON request bodies
app.use(express.json());

// Ensure audio directory exists
const audioDirectory = path.join(__dirname, "audio");
if (!fs.existsSync(audioDirectory)) {
  fs.mkdirSync(audioDirectory, { recursive: true });
}

// Serve audio files statically
app.use("/audio", express.static(audioDirectory));

// ============================================================================
// HELPER FUNCTIONS - Modular logic for easier understanding and testing
// ============================================================================

/**
 * Validates that text was provided in the request
 * @param {string} text - Text string from request body
 * @returns {boolean} - True if text is valid, false otherwise
 */
function validateTextInput(text) {
  return text && typeof text === "string" && text.trim().length > 0;
}

/**
 * Converts a stream to a buffer
 * @param {ReadableStream} stream - The stream to convert
 * @returns {Promise<Buffer>} - The buffer containing all stream data
 */
async function streamToBuffer(stream) {
  const reader = stream.getReader();
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const dataArray = chunks.reduce(
    (acc, chunk) => Uint8Array.from([...acc, ...chunk]),
    new Uint8Array(0)
  );

  return Buffer.from(dataArray.buffer);
}

/**
 * Generates audio from text using Deepgram's text-to-speech API
 * @param {string} text - The text to convert to speech
 * @param {string} model - Model name to use (e.g., "aura-2-thalia-en")
 * @returns {Promise<Buffer>} - The audio buffer
 */
async function generateAudio(text, model = DEFAULT_MODEL) {
  try {
    const response = await deepgram.speak.request({ text }, { model });
    const stream = await response.getStream();

    if (!stream) {
      throw new Error("No audio stream returned from Deepgram");
    }

    const buffer = await streamToBuffer(stream);
    return buffer;
  } catch (error) {
    console.error("Error generating audio:", error);
    throw new Error(`Failed to generate audio: ${error.message}`);
  }
}

/**
 * Saves audio buffer to a file and returns the URL
 * @param {Buffer} audioBuffer - The audio data to save
 * @param {string} filename - Optional filename (defaults to timestamped name)
 * @returns {Promise<string>} - The URL path to the saved audio file
 */
async function saveAudioFile(audioBuffer, filename = null) {
  try {
    // Generate filename if not provided
    if (!filename) {
      const timestamp = Date.now();
      filename = `audio-${timestamp}.wav`;
    }

    const filePath = path.join(audioDirectory, filename);

    // Write file
    await fs.promises.writeFile(filePath, audioBuffer);

    // Return URL path
    return `/audio/${filename}`;
  } catch (error) {
    console.error("Error saving audio file:", error);
    throw new Error(`Failed to save audio file: ${error.message}`);
  }
}

/**
 * Formats error responses in a consistent structure
 * @param {Error} error - The error that occurred
 * @param {number} statusCode - HTTP status code to return
 * @returns {Object} - Formatted error response
 */
function formatErrorResponse(error, statusCode = 500) {
  return {
    statusCode,
    body: {
      error: {
        type: statusCode === 400 ? "ValidationError" : "GenerationError",
        code: statusCode === 400 ? "MISSING_INPUT" : "GENERATION_FAILED",
        message: error.message || "An error occurred during audio generation",
        details: {
          originalError: error.toString(),
        },
      },
    },
  };
}

// ============================================================================
// API ROUTES - Define your API endpoints here
// ============================================================================

/**
 * POST /api
 *
 * Main text-to-speech endpoint. Accepts:
 * - text: The text to convert to speech (required)
 * - model: Deepgram model to use (optional, default: "aura-2-thalia-en")
 *
 * Returns:
 * - audioUrl: URL path to the generated audio file
 *
 * CUSTOMIZATION TIPS:
 * - Add more Deepgram TTS features like SSML, encoding options, etc. in the
 *   generateAudio() function by adding options to the API call
 * - Modify saveAudioFile() to use different file formats or storage backends
 * - Add authentication middleware here if you want to protect this endpoint
 * - Add rate limiting to prevent abuse
 */
app.post("/api", async (req, res) => {
  try {
    const { text, model } = req.body;

    // Validate input - text is required
    if (!validateTextInput(text)) {
      const errorResponse = formatErrorResponse(
        new Error("Text parameter is required and must be a non-empty string"),
        400
      );
      return res.status(errorResponse.statusCode).json(errorResponse.body);
    }

    // Generate audio from text
    const audioBuffer = await generateAudio(text, model || DEFAULT_MODEL);

    // Save audio to file
    const audioUrl = await saveAudioFile(audioBuffer);

    // Return response with audio URL
    res.json({
      audioUrl,
    });
  } catch (err) {
    console.error("Text-to-speech error:", err);

    // Return formatted error response
    const errorResponse = formatErrorResponse(err);
    res.status(errorResponse.statusCode).json(errorResponse.body);
  }
});

/**
 * ADD YOUR CUSTOM ROUTES HERE
 *
 * Examples:
 * - POST /api/stream (streaming audio generation)
 * - POST /api/batch (batch text-to-speech)
 * - GET /health (health check endpoint)
 * - GET /api/models (list available models)
 */

// ============================================================================
// FRONTEND SERVING - Development proxy or production static files
// ============================================================================

/**
 * In development: Proxy all requests to Vite dev server for hot reload
 * In production: Serve pre-built static files from frontend/dist
 *
 * IMPORTANT: This MUST come AFTER your API routes to avoid conflicts
 */
if (CONFIG.isDevelopment) {
  // Development: Proxy to Vite dev server
  app.use(
    "/",
    createProxyMiddleware({
      target: `http://localhost:${CONFIG.vitePort}`,
      changeOrigin: true,
      ws: true, // Enable WebSocket proxying for Vite HMR (Hot Module Reload)
    })
  );
} else {
  // Production: Serve static files from frontend/dist
  const distPath = path.join(__dirname, "frontend", "dist");
  app.use(express.static(distPath));
}

// ============================================================================
// SERVER START
// ============================================================================

app.listen(CONFIG.port, CONFIG.host, () => {
  console.log(
    `\n🚀 TTS Backend Server running at http://${CONFIG.host}:${CONFIG.port}`
  );
  if (CONFIG.isDevelopment) {
    console.log(
      `📡 Proxying frontend from Vite dev server on port ${CONFIG.vitePort}\n`
    );
  } else {
    console.log(`📦 Serving built frontend from frontend/dist\n`);
  }
});
