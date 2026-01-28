/**
 * Node Text-to-Speech Starter - Backend Server
 *
 * This is a simple Express server that provides a text-to-speech API endpoint
 * powered by Deepgram's Text-to-Speech service. It's designed to be easily
 * modified and extended for your own projects.
 *
 * Key Features:
 * - Contract-compliant API endpoint: POST /tts/synthesize
 * - Accepts text in body and model as query parameter
 * - Returns binary audio data (application/octet-stream)
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
  port: process.env.PORT || 8080,
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
 * Formats error responses in a consistent structure matching the contract
 * @param {Error} error - The error that occurred
 * @param {number} statusCode - HTTP status code to return
 * @param {string} errorCode - Contract error code (EMPTY_TEXT, INVALID_TEXT, TEXT_TOO_LONG, MODEL_NOT_FOUND)
 * @returns {Object} - Formatted error response
 */
function formatErrorResponse(error, statusCode = 500, errorCode = null) {
  // Map status codes and error messages to contract error codes
  let contractCode = errorCode;
  if (!contractCode) {
    if (statusCode === 400) {
      if (error.message && error.message.toLowerCase().includes("empty")) {
        contractCode = "EMPTY_TEXT";
      } else if (error.message && error.message.toLowerCase().includes("model")) {
        contractCode = "MODEL_NOT_FOUND";
      } else if (error.message && error.message.toLowerCase().includes("long")) {
        contractCode = "TEXT_TOO_LONG";
      } else {
        contractCode = "INVALID_TEXT";
      }
    } else {
      contractCode = "INVALID_TEXT"; // Default for other errors
    }
  }

  return {
    statusCode,
    body: {
      error: {
        type: statusCode === 400 ? "ValidationError" : "GenerationError",
        code: contractCode,
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
 * POST /tts/synthesize
 *
 * Contract-compliant text-to-speech endpoint per starter-contracts specification.
 * Accepts:
 * - Query parameter: model (optional)
 * - Header: X-Request-Id (optional, echoed back)
 * - Body: JSON with text field (required)
 *
 * Returns:
 * - Success (200): Binary audio data (application/octet-stream)
 * - Error (4XX): JSON error response matching contract format
 *
 * This endpoint implements the TTS contract specification.
 */
app.post("/tts/synthesize", async (req, res) => {
  // Echo X-Request-Id header if provided
  const requestId = req.headers["x-request-id"];
  if (requestId) {
    res.setHeader("X-Request-Id", requestId);
  }

  try {
    // Get model from query parameter (contract specifies query param, not body)
    const model = req.query.model || DEFAULT_MODEL;
    const { text } = req.body;

    // Validate input - text is required
    if (!text) {
      const errorResponse = formatErrorResponse(
        new Error("Text parameter is required"),
        400,
        "EMPTY_TEXT"
      );
      return res.status(errorResponse.statusCode).json(errorResponse.body);
    }

    if (!validateTextInput(text)) {
      const errorResponse = formatErrorResponse(
        new Error("Text must be a non-empty string"),
        400,
        "EMPTY_TEXT"
      );
      return res.status(errorResponse.statusCode).json(errorResponse.body);
    }

    // Generate audio from text
    const audioBuffer = await generateAudio(text, model);

    // Return binary audio data (contract requires application/octet-stream)
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(audioBuffer);
  } catch (err) {
    console.error("Text-to-speech error:", err);

    // Determine error type and status code based on error message
    let statusCode = 500;
    let errorCode = null;
    const errorMsg = err.message ? err.message.toLowerCase() : "";

    // Check for model-related errors
    if (errorMsg.includes("model") || errorMsg.includes("not found")) {
      statusCode = 400;
      errorCode = "MODEL_NOT_FOUND";
    }
    // Check for text length errors (common patterns from Deepgram API)
    else if (errorMsg.includes("too long") || errorMsg.includes("length") || errorMsg.includes("limit") || errorMsg.includes("exceed")) {
      statusCode = 400;
      errorCode = "TEXT_TOO_LONG";
    }
    // Check for invalid text errors
    else if (errorMsg.includes("invalid") || errorMsg.includes("malformed")) {
      statusCode = 400;
      errorCode = "INVALID_TEXT";
    }
    // For validation errors, use 400
    else if (err.statusCode === 400 || err.status === 400) {
      statusCode = 400;
      errorCode = "INVALID_TEXT";
    }

    // Return formatted error response matching contract
    const errorResponse = formatErrorResponse(err, statusCode, errorCode);
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
  console.log(`Development mode: Proxying to Vite dev server on port ${CONFIG.vitePort}`);

  // Proxy all requests (including WebSocket for Vite HMR) to Vite dev server
  // Note: This app has no backend WebSocket connections, so we can proxy all WebSockets to Vite
  app.use(
    "/",
    createProxyMiddleware({
      target: `http://localhost:${CONFIG.vitePort}`,
      changeOrigin: true,
      ws: true, // All WebSockets go to Vite (no backend WebSocket endpoints)
    })
  );
} else {
  console.log('Production mode: Serving static files');

  const distPath = path.join(__dirname, "frontend", "dist");
  app.use(express.static(distPath));
}

// ============================================================================
// SERVER START
// ============================================================================

app.listen(CONFIG.port, CONFIG.host, () => {
  console.log("\n" + "=".repeat(70));
  console.log(
    `🚀 TTS Backend Server running at http://localhost:${CONFIG.port}`
  );
  if (CONFIG.isDevelopment) {
    console.log(
      `📡 Proxying frontend from Vite dev server on port ${CONFIG.vitePort}`
    );
    console.log(`\n⚠️  Open your browser to http://localhost:${CONFIG.port}`)
  } else {
    console.log(`📦 Serving built frontend from frontend/dist`);
  }
  console.log("=".repeat(70) + "\n");
});
