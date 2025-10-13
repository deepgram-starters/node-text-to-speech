const { createClient } = require("@deepgram/sdk");
const express = require("express");
const http = require("http");
const fs = require("fs");
const dotenv = require("dotenv");
const path = require("path");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

dotenv.config();

const app = express();
const server = http.createServer(app);

// Custom JSON parser with error handling
app.use(express.json());

// Catch JSON parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    const requestId = req.headers["x-request-id"];
    if (requestId) {
      res.setHeader("X-Request-Id", requestId);
    }
    return res.status(400).json({
      error: {
        type: "validation_error",
        code: "INVALID_REQUEST_BODY",
        message: "Invalid JSON in request body",
        details: { error: err.message }
      }
    });
  }
  next();
});

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// Load and compile TTS contract schemas
const ajv = new Ajv({ strict: false });
addFormats(ajv);

const requestSchema = require("../starter-contracts/interfaces/tts/schema/request.json");
const errorSchema = require("../starter-contracts/interfaces/tts/schema/error.json");

const validateRequest = ajv.compile(requestSchema);
const validateError = ajv.compile(errorSchema);

app.use(express.static("public/"));
app.use("/audio", express.static("audio"));

// Contract-compliant TTS endpoint
app.post("/tts/synthesize", async (req, res) => {
  const requestId = req.headers["x-request-id"];

  // Helper to send structured error response
  const sendError = (status, code, message, details = {}) => {
    const errorResponse = {
      error: {
        type: "validation_error",
        code,
        message,
        details
      }
    };

    if (requestId) {
      res.setHeader("X-Request-Id", requestId);
    }

    res.status(status).json(errorResponse);
  };

  try {
    // Validate Content-Type
    const contentType = req.headers["content-type"];
    if (!contentType || !contentType.includes("application/json")) {
      return sendError(
        415,
        "INVALID_REQUEST_BODY",
        `Content-Type '${contentType}' is not supported. Expected: application/json`
      );
    }

    // Validate request body against schema
    const isValid = validateRequest(req.body);
    if (!isValid) {
      const errors = validateRequest.errors || [];

      // Check for specific validation errors
      const maxLengthError = errors.find(e => e.keyword === 'maxLength');
      if (maxLengthError) {
        return sendError(
          400,
          "TEXT_TOO_LONG",
          `Text exceeds maximum length of ${maxLengthError.params.limit} characters`,
          { max_length: maxLengthError.params.limit }
        );
      }

      return sendError(
        400,
        "INVALID_REQUEST_BODY",
        "Request body validation failed",
        { validation_errors: errors }
      );
    }

    const { text } = req.body;

    // Get query parameters
    const model = req.query.model || "aura-asteria-en";
    const container = req.query.container;
    const encoding = req.query.encoding;
    const sample_rate = req.query.sample_rate;
    const bit_rate = req.query.bit_rate;

    // Build Deepgram options
    const options = { model };

    // Default to MP3 if nothing specified
    if (!container && !encoding) {
      options.encoding = "mp3";
    } else {
      if (container) options.container = container;
      if (encoding) options.encoding = encoding;
    }

    if (sample_rate) options.sample_rate = parseInt(sample_rate);
    if (bit_rate) options.bit_rate = parseInt(bit_rate);

    // Call Deepgram TTS API
    const response = await deepgram.speak.request({ text }, options);
    const stream = await response.getStream();

    if (!stream) {
      return sendError(
        500,
        "TEXT_PROCESSING_FAILED",
        "Failed to generate audio stream"
      );
    }

    // Convert stream to buffer
    const audioBuffer = await getAudioBuffer(stream);

    // Determine Content-Type based on encoding or container
    let audioContentType = 'audio/mpeg'; // default

    if (encoding) {
      // Encoding takes precedence
      const encodingTypeMap = {
        'mp3': 'audio/mpeg',
        'opus': 'audio/opus',
        'flac': 'audio/flac',
        'mulaw': 'audio/mulaw',
        'alaw': 'audio/alaw',
        'aac': 'audio/aac',
        'linear16': 'audio/wav'  // linear16 is raw PCM, typically in WAV container
      };
      audioContentType = encodingTypeMap[encoding] || 'audio/mpeg';
    } else if (container) {
      // Fall back to container
      const containerTypeMap = {
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'none': 'audio/mpeg'  // 'none' container returns raw encoded audio
      };
      audioContentType = containerTypeMap[container] || 'audio/wav';
    }

    // Set response headers
    if (requestId) {
      res.setHeader("X-Request-Id", requestId);
    }
    res.setHeader("Content-Type", audioContentType);
    res.setHeader("Content-Length", audioBuffer.length);

    // Optional: Add duration header if available
    // Note: Would need to calculate from audio buffer
    // res.setHeader("X-Audio-Duration", duration);

    // Send binary audio
    res.send(audioBuffer);

  } catch (err) {
    console.error("TTS Synthesize Error:", err.message);

    // Parse Deepgram error if it's a JSON string
    let deepgramError = null;
    try {
      deepgramError = JSON.parse(err.message);
    } catch (e) {
      // Not a JSON error, use as-is
    }

    // Handle Deepgram API errors
    if (deepgramError && deepgramError.err_code) {
      const { err_code, err_msg } = deepgramError;

      // Map Deepgram error codes to contract error codes
      if (err_code === "INVALID_MODEL" || err_msg.includes("model")) {
        return sendError(
          400,
          "UNSUPPORTED_MODEL",
          err_msg || "The requested model is not available"
        );
      }

      if (err_code === "UNSUPPORTED_AUDIO_FORMAT" || err_code === "INVALID_QUERY_PARAMETER") {
        if (err_msg.includes("container") || err_msg.includes("encoding")) {
          return sendError(
            400,
            "UNSUPPORTED_CONTAINER",
            err_msg || "The requested audio format is not supported"
          );
        }
      }
    }

    // Check plain error messages
    if (err.message && err.message.includes("model")) {
      return sendError(
        400,
        "UNSUPPORTED_MODEL",
        `The requested model is not available: ${err.message}`
      );
    }

    if (err.message && (err.message.includes("container") || err.message.includes("encoding"))) {
      return sendError(
        400,
        "UNSUPPORTED_CONTAINER",
        `The requested audio format is not supported: ${err.message}`
      );
    }

    // Generic error
    if (requestId) {
      res.setHeader("X-Request-Id", requestId);
    }
    res.status(500).json({
      error: {
        type: "server_error",
        code: "TEXT_PROCESSING_FAILED",
        message: "An error occurred while processing the text",
        details: { error_message: err.message }
      }
    });
  }
});

// Legacy /api endpoint (keep for backward compatibility)
app.post("/api", async (req, res) => {
  const { body } = req;
  const { text, model } = body;

  try {
    const filePath = await getAudio(text, model);
    res.json({ audioUrl: filePath });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

const getAudio = async (text, model) => {
  const response = await deepgram.speak.request({ text }, { model });
  const stream = await response.getStream();

  if (stream) {
    const buffer = await getAudioBuffer(stream);

    try {
      // Ensure 'audio' directory exists
      const audioDirectory = path.join(__dirname, "audio");
      if (!fs.existsSync(audioDirectory)) {
        fs.mkdirSync(audioDirectory);
      }

      // Write audio file to 'audio' directory
      await new Promise((resolve, reject) => {
        fs.writeFile(path.join(audioDirectory, "audio.wav"), buffer, (err) => {
          if (err) {
            console.error("Error writing audio to file:", err);
            reject(err);
          } else {
            console.log("Audio file written to audio.wav");
            resolve();
          }
        });
      });
    } catch (err) {
      throw err;
    }

    return "/audio/audio.wav";
  } else {
    console.error("Error generating audio:", stream);
    throw new Error("Error generating audio: Stream is empty");
  }
};

// Helper function to convert stream to audio buffer
const getAudioBuffer = async (response) => {
  const reader = response.getReader();
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
};

// Serve the index.html file on root path
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/index.html"));
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
