const { createClient } = require("@deepgram/sdk");
const express = require("express");
const http = require("http");
const fs = require("fs");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(express.json());

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

app.use(express.static("public/"));
app.use("/audio", express.static("audio"));

// TTS Interface Compliant Endpoint (implements minimal starter-contracts specification)
// Minimal text-based approach: accepts JSON with text
app.post("/tts/synthesize", async (req, res) => {
  try {
    // Echo X-Request-Id header if provided
    const requestId = req.headers['x-request-id'];
    if (requestId) {
      res.setHeader('X-Request-Id', requestId);
    }

    // Validate request body exists and has text
    if (!req.body || !req.body.text) {
      return res.status(400).json({
        error: {
          type: "validation_error",
          code: "INVALID_TEXT",
          message: "Request body must contain 'text' field",
          details: {}
        }
      });
    }

    const { text } = req.body;

    // Check for empty text
    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        error: {
          type: "validation_error",
          code: "EMPTY_TEXT",
          message: "Text field cannot be empty",
          details: {}
        }
      });
    }

    // Extract only the model query parameter (minimal contract supports only this)
    const { model } = req.query;

    // Call Deepgram TTS API
    const response = await deepgram.speak.request(
      { text },
      {
        model: model || "aura-asteria-en",
        encoding: "mp3"  // Default to MP3
      }
    );

    const stream = await response.getStream();

    if (!stream) {
      return res.status(500).json({
        error: {
          type: "processing_error",
          code: "INVALID_TEXT",
          message: "Failed to generate audio stream",
          details: {}
        }
      });
    }

    // Convert stream to buffer
    const audioBuffer = await getAudioBuffer(stream);

    // Set response headers
    if (requestId) {
      res.setHeader("X-Request-Id", requestId);
    }
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audioBuffer.length);

    // Send binary audio
    res.send(audioBuffer);

  } catch (err) {
    console.error('TTS Synthesize Error:', err);

    // Echo X-Request-Id even in errors
    const requestId = req.headers['x-request-id'];
    if (requestId) {
      res.setHeader('X-Request-Id', requestId);
    }

    // Determine appropriate error code
    let errorCode = "INVALID_TEXT";
    let statusCode = 500;

    if (err.message && err.message.includes('model')) {
      errorCode = "MODEL_NOT_FOUND";
      statusCode = 400;
    } else if (err.message && err.message.includes('text')) {
      errorCode = "INVALID_TEXT";
      statusCode = 400;
    } else if (err.message && err.message.includes('too long')) {
      errorCode = "TEXT_TOO_LONG";
      statusCode = 400;
    }

    res.status(statusCode).json({
      error: {
        type: "processing_error",
        code: errorCode,
        message: err.message || "Text processing failed",
        details: {}
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
