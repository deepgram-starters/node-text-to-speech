/**
 * Node Text-to-Speech Starter - Backend Server
 *
 * This is a simple Express server that provides a text-to-speech API endpoint
 * powered by Deepgram's Text-to-Speech service. It's designed to be easily
 * modified and extended for your own projects.
 *
 * Key Features:
 * - Contract-compliant API endpoint: POST /api/text-to-speech
 * - Accepts text in body and model as query parameter
 * - Returns binary audio data (application/octet-stream)
 * - CORS enabled for frontend communication
 * - JWT session auth with rate limiting (production only)
 * - Pure API server (frontend served separately)
 */

require("dotenv").config();

const { createClient } = require("@deepgram/sdk");
const cors = require("cors");
const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const jwt = require("jsonwebtoken");
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
  port: process.env.PORT || 8081,
  host: process.env.HOST || "0.0.0.0",
};

// ============================================================================
// SESSION AUTH - JWT tokens for production security
// ============================================================================

/**
 * Session secret for signing JWTs.
 */
const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

/** JWT expiry time (1 hour) */
const JWT_EXPIRY = "1h";

/**
 * Express middleware that validates JWT from Authorization header.
 * Returns 401 with JSON error if token is missing or invalid.
 */
function requireSession(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: {
        type: "AuthenticationError",
        code: "MISSING_TOKEN",
        message: "Authorization header with Bearer token is required",
      },
    });
  }

  try {
    const token = authHeader.slice(7);
    jwt.verify(token, SESSION_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({
      error: {
        type: "AuthenticationError",
        code: "INVALID_TOKEN",
        message:
          err.name === "TokenExpiredError"
            ? "Session expired, please refresh the page"
            : "Invalid session token",
      },
    });
  }
}

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

// Enable CORS (wildcard is safe -- same-origin via Vite proxy / Caddy in production)
app.use(cors());

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
// SESSION ROUTES - Auth endpoints (unprotected)
// ============================================================================

/**
 * GET /api/session — Issues a signed JWT for session authentication.
 */
app.get("/api/session", (req, res) => {
  const token = jwt.sign(
    { iat: Math.floor(Date.now() / 1000) },
    SESSION_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
  res.json({ token });
});

// ============================================================================
// API ROUTES - Define your API endpoints here
// ============================================================================

/**
 * POST /api/text-to-speech
 *
 * Contract-compliant text-to-speech endpoint per starter-contracts specification.
 * Accepts:
 * - Query parameter: model (optional)
 * - Body: JSON with text field (required)
 *
 * Returns:
 * - Success (200): Binary audio data (application/octet-stream)
 * - Error (4XX): JSON error response matching contract format
 *
 * This endpoint implements the TTS contract specification.
 *
 * Protected by JWT session auth (requireSession middleware).
 */
app.post("/api/text-to-speech", requireSession, async (req, res) => {
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

    // Return binary audio data with proper audio mime type
    res.setHeader("Content-Type", "audio/mpeg");
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
 * GET /api/metadata
 *
 * Returns metadata about this starter application from deepgram.toml
 * Required for standardization compliance
 */
app.get("/api/metadata", (req, res) => {
  try {
    const toml = require("toml");
    const tomlPath = path.join(__dirname, "deepgram.toml");
    const tomlContent = fs.readFileSync(tomlPath, "utf-8");
    const config = toml.parse(tomlContent);

    if (!config.meta) {
      return res.status(500).json({
        error: "INTERNAL_SERVER_ERROR",
        message: "Missing [meta] section in deepgram.toml",
      });
    }

    res.json(config.meta);
  } catch (error) {
    console.error("Error reading metadata:", error);
    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Failed to read metadata from deepgram.toml",
    });
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
// SERVER START
// ============================================================================

app.listen(CONFIG.port, CONFIG.host, () => {
  console.log("\n" + "=".repeat(70));
  console.log(`🚀 Backend API running at http://localhost:${CONFIG.port}`);
  console.log(`📡 GET  /api/session`);
  console.log(`📡 POST /api/text-to-speech (auth required)`);
  console.log(`📡 GET  /api/metadata`);
  console.log("=".repeat(70) + "\n");
});
