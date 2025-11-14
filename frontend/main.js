/**
 * Text-to-Speech HTML Starter - Frontend Application
 *
 * This is a vanilla JavaScript frontend that provides a text-to-speech UI
 * for Deepgram's Text-to-Speech service. It's designed to be easily
 * modified and extended for your own projects.
 *
 * Key Features:
 * - Text input for speech generation
 * - Model selection
 * - Audio playback
 * - History management with localStorage
 * - Responsive UI with Deepgram design system
 *
 * Architecture:
 * - Pure vanilla JavaScript (no frameworks required)
 * - Uses native Fetch API for HTTP requests
 * - LocalStorage for history persistence
 * - Event-driven UI updates
 */

// ============================================================================
// CONFIGURATION - Customize these values for your needs
// ============================================================================

/**
 * API endpoint for text-to-speech requests
 * Change this if your backend is hosted elsewhere
 */
const API_ENDPOINT = "/api";

/**
 * LocalStorage key for history persistence
 * Change this if you want to use a different storage key for text-to-speech
 */
const HISTORY_KEY = "deepgram_text_to_speech_history";

/**
 * Maximum number of history entries to store
 * Prevents localStorage from growing too large
 */
const MAX_HISTORY_ENTRIES = 5;

// ============================================================================
// STATE MANAGEMENT - Application state variables
// ============================================================================

/**
 * DOM Elements - Cached references to frequently used elements
 * These are initialized in the init() function
 */
let textInput;
let modelSelect;
let generateBtn;
let mainContent;
let statusContainer;
let statusMessage;
let metadataContainer;
let metadataGrid;
let historyTitle;
let historySidebarContent;

/**
 * Currently active generation ID
 * Used to highlight the active history item
 */
let activeRequestId = null;

// ============================================================================
// LOCALSTORAGE HISTORY MANAGEMENT
// ============================================================================

/**
 * Retrieves text-to-speech history from localStorage
 *
 * @returns {Array} Array of history entries, or empty array if none exist
 *
 * History entry structure:
 * {
 *   id: string,              // Request ID from Deepgram or local timestamp
 *   timestamp: string,       // ISO 8601 timestamp
 *   text: string,            // Input text
 *   model: string,           // Model name used
 *   audioUrl: string,        // URL to generated audio file
 *   response: object         // Full API response
 * }
 */
function getHistory() {
  try {
    const history = localStorage.getItem(HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch (error) {
    console.error("Error reading history:", error);
    return [];
  }
}

/**
 * Saves a text-to-speech result to localStorage history
 *
 * @param {Object} responseData - The API response
 * @param {string} text - The input text
 * @param {string} model - Model name used for generation
 * @returns {Object|null} The saved history entry, or null if save failed
 */
function saveToHistory(responseData, text, model) {
  try {
    const history = getHistory();

    // Generate a fallback ID
    const requestId = `local_${Date.now()}`;

    const historyEntry = {
      id: requestId,
      timestamp: new Date().toISOString(),
      text,
      model,
      audioUrl: responseData.audioUrl,
      response: responseData,
    };

    // Add to beginning of array (newest first)
    history.unshift(historyEntry);

    // Keep only the most recent entries to prevent localStorage overflow
    const trimmedHistory = history.slice(0, MAX_HISTORY_ENTRIES);

    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmedHistory));

    // Update history UI
    renderHistory();

    return historyEntry;
  } catch (error) {
    console.error("Error saving to history:", error);
    return null;
  }
}

/**
 * Clears all history from localStorage
 *
 * @returns {boolean} True if successful, false if error occurred
 */
function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
    return true;
  } catch (error) {
    console.error("Error clearing history:", error);
    return false;
  }
}

/**
 * Retrieves a specific history entry by its request ID
 *
 * @param {string} requestId - The unique ID of the history entry
 * @returns {Object|undefined} The history entry, or undefined if not found
 */
function getHistoryEntryById(requestId) {
  const history = getHistory();
  return history.find((entry) => entry.id === requestId);
}

// ============================================================================
// HISTORY UI RENDERING
// ============================================================================

/**
 * Renders the history sidebar with all generation entries
 * Highlights the currently active entry if one is selected
 */
function renderHistory() {
  const history = getHistory();

  // Update title with count
  if (historyTitle) {
    historyTitle.textContent = `History (${history.length})`;
  }

  // Render history list
  if (historySidebarContent) {
    if (history.length === 0) {
      historySidebarContent.innerHTML = '<div class="history-empty">No audio generated yet</div>';
    } else {
      const historyList = document.createElement("div");
      historyList.className = "history-list";

      history.forEach((entry) => {
        const item = document.createElement("div");
        const isActive = activeRequestId === entry.id;
        item.className = isActive ? "history-item history-item--active" : "history-item";
        
        // Make the item clickable to load in main view
        item.onclick = (e) => {
          // Don't trigger if clicking on the audio player or its controls
          if (e.target.tagName !== "AUDIO" && !e.target.closest("audio")) {
            loadHistoryEntry(entry.id);
          }
        };

        const timestamp = new Date(entry.timestamp);
        const timeStr = timestamp.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });

        // Truncate text for display
        const textPreview = entry.text.length > 50 
          ? entry.text.substring(0, 50) + "..." 
          : entry.text;

        // Create audio element
        const audioElement = entry.audioUrl 
          ? `<div class="history-item__audio">
               <audio controls preload="metadata" src="${escapeHtml(entry.audioUrl)}">
                 Your browser does not support the audio element.
               </audio>
             </div>`
          : "";

        item.innerHTML = `
          <div class="history-item__id" title="${entry.id}">${entry.id}</div>
          <div class="history-item__time">${timeStr}</div>
          <div class="history-item__model">${entry.model || "aura-2-thalia-en"}</div>
          <div style="font-size: 0.75rem; color: var(--dg-muted, #949498); margin-top: 0.25rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(textPreview)}</div>
          ${audioElement}
        `;

        historyList.appendChild(item);
      });

      historySidebarContent.innerHTML = "";
      historySidebarContent.appendChild(historyList);
    }
  }
}

/**
 * Loads and displays a history entry by its request ID
 *
 * @param {string} requestId - The unique ID of the history entry to load
 */
function loadHistoryEntry(requestId) {
  const entry = getHistoryEntryById(requestId);

  if (!entry) {
    showError(`History entry not found: ${requestId}`);
    return;
  }

  // Set the active request ID
  activeRequestId = entry.id;

  // Display the audio and text
  displayAudio(entry.audioUrl, entry.text);
  displayMetadata(entry.response, entry.text);
  hideStatus();

  // Re-render history to update highlighting
  renderHistory();
}

/**
 * Checks URL query parameters for a request_id and loads it if present
 * This enables deep linking to specific audio generation results
 */
function checkUrlForRequestId() {
  const urlParams = new URLSearchParams(window.location.search);
  const requestId = urlParams.get("request_id");

  if (requestId) {
    loadHistoryEntry(requestId);
  } else {
    // No request_id means we should show the initial form state
    resetToInitialState();
  }
}

// ============================================================================
// FORM VALIDATION
// ============================================================================

/**
 * Checks if the form is valid and ready to submit
 *
 * Form is valid if:
 * - Text input has content (trimmed length > 0)
 *
 * @returns {boolean} True if form is valid, false otherwise
 */
function isFormValid() {
  // Check if text input has content
  const text = textInput ? textInput.value.trim() : "";
  return text.length > 0;
}

/**
 * Updates the generate button's disabled state based on form validity
 * Called whenever form inputs change
 */
function updateFormValidation() {
  const isValid = isFormValid();
  if (generateBtn) {
    generateBtn.disabled = !isValid;
  }
}

// ============================================================================
// INITIALIZATION & SETUP
// ============================================================================

/**
 * Initializes the application
 * - Caches DOM element references
 * - Sets up event listeners
 * - Loads initial state from URL parameters
 * - Renders history sidebar
 *
 * Called when DOM is ready
 */
function init() {
  // Get DOM elements
  textInput = document.getElementById("textInput");
  modelSelect = document.getElementById("model");
  generateBtn = document.getElementById("generateBtn");
  mainContent = document.getElementById("mainContent");
  statusContainer = document.getElementById("statusContainer");
  statusMessage = document.getElementById("statusMessage");
  metadataContainer = document.getElementById("metadataContainer");
  metadataGrid = document.getElementById("metadataGrid");
  historyTitle = document.getElementById("historyTitle");
  historySidebarContent = document.getElementById("historySidebarContent");

  // Check if we should enable elements (no state parameter means normal operation)
  const urlParams = new URLSearchParams(window.location.search);
  const state = urlParams.get("state");

  if (!state) {
    // Enable all form elements for normal operation
    enableFormElements();
  }

  setupEventListeners();
  // Set initial state
  updateFormValidation();
  // Render history
  renderHistory();
  // Check URL for request_id
  checkUrlForRequestId();
}

/**
 * Sets up all event listeners for the application
 * - Text input
 * - Generate button
 * - Browser navigation (back/forward)
 */
function setupEventListeners() {
  // Text input - listen for changes
  if (textInput) {
    textInput.addEventListener("input", updateFormValidation);
  }

  // Generate button
  if (generateBtn) {
    generateBtn.addEventListener("click", handleGenerate);
  }

  // Handle browser back/forward navigation
  window.addEventListener("popstate", () => {
    checkUrlForRequestId();
  });
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handles text-to-speech generation request
 * Main function that:
 * - Validates form input
 * - Makes API request to text-to-speech endpoint
 * - Saves result to history
 * - Displays audio player
 * - Handles errors
 *
 * CUSTOMIZATION TIPS:
 * - Modify API_ENDPOINT constant to change backend URL
 * - Add additional form parameters before making request
 * - Customize error handling logic
 * - Add progress tracking
 */
async function handleGenerate() {
  const text = textInput ? textInput.value.trim() : "";

  // Check if text was provided
  if (!text) {
    showError("Please enter some text to convert to speech");
    return;
  }

  const model = modelSelect ? modelSelect.value : "aura-2-thalia-en";

  // Disable form elements and show working status
  disableFormElements();
  showWorking();

  try {
    // Make API request with JSON body
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Request failed with status ${response.status}`);
    }

    const data = await response.json();

    // Validate response matches contract (required: audioUrl field)
    if (!data.audioUrl) {
      throw new Error("Invalid response: missing required 'audioUrl' field");
    }

    // Save to history and get the entry
    const historyEntry = saveToHistory(data, text, model);

    // Set the active request ID and display
    if (historyEntry) {
      activeRequestId = historyEntry.id;
      enableFormElements();
      displayAudio(data.audioUrl, text);
      displayMetadata(data, text);
      hideStatus();
      renderHistory(); // Re-render to highlight the active item
    } else {
      // Fallback: display directly if save failed
      enableFormElements();
      displayAudio(data.audioUrl, text);
      displayMetadata(data, text);
      hideStatus();
    }
  } catch (error) {
    console.error("Text-to-speech error:", error);
    // Re-enable form elements on error
    enableFormElements();
    showError(error.message);
  }
}

// ============================================================================
// UI STATE MANAGEMENT
// ============================================================================

/**
 * Shows "processing" status indicator
 * Displays spinner and hides metadata
 */
function showWorking() {
  statusContainer.style.display = "block";
  statusMessage.className = "dg-status dg-status--with-icon dg-status--primary";
  statusMessage.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin dg-status__icon"></i> Generating audio...';
  metadataContainer.style.display = "none";
}

/**
 * Shows error status indicator
 * Displays error icon and message, hides metadata
 *
 * @param {string} message - The error message to display
 */
function showError(message) {
  statusContainer.style.display = "block";
  statusMessage.className = "dg-status dg-status--with-icon dg-status--error";
  statusMessage.innerHTML = `<i class="fa-solid fa-circle-exclamation dg-status__icon"></i> ${message}`;
  metadataContainer.style.display = "none";
}

/**
 * Hides the status indicator
 */
function hideStatus() {
  statusContainer.style.display = "none";
}

// ============================================================================
// RESULTS DISPLAY
// ============================================================================

/**
 * Displays the audio player in the main content area
 *
 * @param {string} audioUrl - The URL to the generated audio file
 * @param {string} text - The input text that was converted to speech
 *
 * CUSTOMIZATION TIP:
 * - Modify this function to add additional audio controls
 * - Add download button
 * - Add waveform visualization
 */
function displayAudio(audioUrl, text) {
  mainContent.innerHTML = `
    <div style="max-width: 800px;">
      <h2 class="dg-section-heading">Generated Audio</h2>
      <div class="generated-text">
        ${escapeHtml(text)}
      </div>
      <div class="audio-player-container">
        <audio controls class="audio-player" src="${escapeHtml(audioUrl)}">
          Your browser does not support the audio element.
        </audio>
      </div>
    </div>
  `;
}

/**
 * Resets the application to its initial state
 * - Clears active request ID
 * - Shows form sections
 * - Hides metadata and status
 * - Resets main content to empty state
 * - Re-enables form elements
 */
function resetToInitialState() {
  // Clear active request ID
  activeRequestId = null;

  // Show form sections
  const controlsSections = document.querySelectorAll(".controls-section");
  controlsSections.forEach((section) => {
    section.style.display = "block";
  });

  // Hide metadata
  if (metadataContainer) {
    metadataContainer.style.display = "none";
  }

  // Hide status
  hideStatus();

  // Reset main content to empty state
  if (mainContent) {
    mainContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon dg-text-primary"><i class="fa-solid fa-volume-high"></i></div>
        <h2 class="dg-section-heading">Enter your text and options to try out text-to-speech</h2>
        <p class="dg-prose">
          Type or paste your text in the sidebar, select a voice model, and click generate to create audio.
        </p>
        <button id="generateBtn" class="dg-btn dg-btn--primary" style="margin-top: 1.5rem;" disabled>
          Generate Audio
        </button>
      </div>
    `;

    // Re-attach event listener to the new generate button
    generateBtn = document.getElementById("generateBtn");
    if (generateBtn) {
      generateBtn.addEventListener("click", handleGenerate);
    }
  }

  // Enable form elements
  enableFormElements();

  // Update form validation
  updateFormValidation();

  // Re-render history to clear highlighting
  renderHistory();
}

/**
 * Displays generation metadata in the sidebar
 * Shows model, audio URL, and any metadata from the response
 *
 * @param {Object} data - The API response data
 * @param {string} text - The input text
 *
 * CUSTOMIZATION TIP:
 * - Add or remove metadata fields
 * - Format values differently
 * - Add custom calculated metrics
 */
function displayMetadata(data, text) {
  // Hide form sections
  const controlsSections = document.querySelectorAll(".controls-section");
  controlsSections.forEach((section) => {
    section.style.display = "none";
  });

  metadataContainer.style.display = "block";

  const metadata = [];

  if (data.audioUrl) {
    metadata.push({
      label: "Audio URL",
      value: data.audioUrl,
    });
  }

  if (text) {
    const wordCount = text.trim().split(/\s+/).length;
    metadata.push({
      label: "Word Count",
      value: wordCount,
    });
  }

  // Add any additional metadata from the response
  if (data.metadata) {
    Object.entries(data.metadata).forEach(([key, value]) => {
      metadata.push({
        label: key,
        value: typeof value === "object" ? JSON.stringify(value) : String(value),
      });
    });
  }

  const metadataHTML = metadata
    .map(
      (item) => `
    <div class="metadata-item">
      <div class="metadata-label">${escapeHtml(item.label)}</div>
      <div class="metadata-value">${escapeHtml(item.value)}</div>
    </div>
  `
    )
    .join("");

  // Get base path without query parameters
  const basePath = window.location.pathname;

  metadataGrid.innerHTML = `
    ${metadataHTML}
    <a href="${basePath}" class="dg-btn dg-btn--ghost" style="margin-top: 1rem; display: inline-flex; align-items: center;">
      <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i>
      Generate Another
    </a>
  `;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Escapes HTML special characters to prevent XSS attacks
 * Uses browser's native text rendering to safely escape content
 *
 * @param {string} text - The text to escape
 * @returns {string} HTML-safe escaped text
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Disables all form elements during audio generation
 * Prevents user from making changes while request is in flight
 * Adds visual feedback with disabled styling
 */
function disableFormElements() {
  const textArea = document.getElementById("textInput");
  const select = document.getElementById("model");
  const btn = document.getElementById("generateBtn");

  // Disable text input
  if (textArea) {
    textArea.disabled = true;
  }

  // Disable model select
  if (select) {
    select.disabled = true;
  }

  // Disable generate button
  if (btn) {
    btn.disabled = true;
  }
}

/**
 * Re-enables all form elements after audio generation completes
 * Removes disabled styling and re-validates form
 */
function enableFormElements() {
  const textArea = document.getElementById("textInput");
  const select = document.getElementById("model");

  // Enable text input
  if (textArea) {
    textArea.disabled = false;
  }

  // Enable model select
  if (select) {
    select.disabled = false;
  }

  // Re-enable generate button (but respect form validation)
  updateFormValidation();
}

// ============================================================================
// STATE PREVIEW MODE - For development and testing
// ============================================================================

/**
 * Checks URL parameters for state preview mode
 * Used for testing different UI states during development
 *
 * Available states:
 * - ?state=waiting  - Shows processing/loading state
 * - ?state=results  - Shows results with mock data
 * - ?state=error    - Shows error state
 * - (no parameter)  - Shows normal initial state
 */
function checkUrlStateParameter() {
  const urlParams = new URLSearchParams(window.location.search);
  const state = urlParams.get("state");

  if (state === "waiting") {
    setWaitingState();
  } else if (state === "results") {
    setResultsState();
  } else if (state === "error") {
    setErrorState();
  }
  // Default state (initial) is already set by HTML
}

/**
 * Sets the UI to "waiting" state with mock data
 * Used for development and testing
 */
function setWaitingState() {
  // Set sample text
  if (textInput) {
    textInput.value = "Hello, this is a test of the text-to-speech system.";
  }

  // Update main content to show processing state
  const content = document.getElementById("mainContent");
  if (content) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon dg-text-primary">
          <i class="fa-solid fa-spinner fa-spin"></i>
        </div>
        <h2 class="dg-section-heading">Generating your audio...</h2>
        <p class="dg-prose">
          Your text-to-speech request is being processed. This may take a few moments.
        </p>
      </div>
    `;
  }

  // Show working status
  showWorking();

  // Elements stay disabled (they're disabled by default in HTML)
}

/**
 * Sets the UI to "results" state with mock audio data
 * Used for development and testing
 */
function setResultsState() {
  // Set sample text
  const mockText = "Hello, this is a test of the text-to-speech system. The audio has been generated successfully.";
  if (textInput) {
    textInput.value = mockText;
    updateFormValidation();
  }

  // Re-enable form elements
  enableFormElements();

  // Mock response data
  const mockData = {
    audioUrl: "/audio/audio.wav",
    metadata: {
      model: "aura-2-thalia-en",
    },
  };

  displayAudio(mockData.audioUrl, mockText);
  displayMetadata(mockData, mockText);
  hideStatus();
}

/**
 * Sets the UI to "error" state with mock error message
 * Used for development and testing
 */
function setErrorState() {
  // Set sample text
  if (textInput) {
    textInput.value = "Hello, this is a test.";
    updateFormValidation();
  }

  // Re-enable form elements
  enableFormElements();

  // Update main content to show error state
  const basePath = window.location.pathname;
  mainContent.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon" style="color: var(--dg-danger, #f04438);">
        <i class="fa-solid fa-circle-exclamation"></i>
      </div>
      <h2 class="dg-section-heading">Audio Generation Failed</h2>
      <p class="dg-prose">
        We encountered an error while generating your audio. Please check your connection and try again.
      </p>
      <a href="${basePath}" class="dg-btn dg-btn--ghost" style="margin-top: 1.5rem; display: inline-flex; align-items: center;">
        <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i>
        Generate Another
      </a>
    </div>
  `;

  // Show error status
  showError("Unable to connect to text-to-speech service. Please try again later.");
}

// ============================================================================
// APPLICATION BOOTSTRAP
// ============================================================================

/**
 * Initialize the application when DOM is ready
 * Handles both loading and already-loaded states
 */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    init();
    checkUrlStateParameter();
  });
} else {
  init();
  checkUrlStateParameter();
}