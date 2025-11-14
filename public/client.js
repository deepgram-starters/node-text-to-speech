const PLAY_STATES = {
  NO_AUDIO: "no_audio",
  LOADING: "loading",
  PLAYING: "playing",
};

let playState = PLAY_STATES.NO_AUDIO;
let audio;
const textArea = document.getElementById("text-input");
const errorMessage = document.querySelector("#error-message");

// Function to update the play button based on the current state
function updatePlayButton() {
  const playButton = document.getElementById("play-button");
  const icon = playButton.querySelector(".button-icon");

  switch (playState) {
    case PLAY_STATES.NO_AUDIO:
      icon.className = "button-icon fa-solid fa-play";
      break;
    case PLAY_STATES.LOADING:
      icon.className = "button-icon fa-solid fa-circle-notch ";
      break;
    case PLAY_STATES.PLAYING:
      icon.className = "button-icon fa-solid fa-stop";
      break;
    default:
      break;
  }
}

// Function to play audio
function playAudio(audioUrl) {
  if (audio) {
    stopAudio();
  }
  currentAudioUrl = audioUrl + "?t=" + new Date().getTime(); // Add cache-busting query parameter
  audio = new Audio(currentAudioUrl);

  audio.play();

  audio.addEventListener("ended", () => {
    console.log("Audio finished playing");
    stopAudio();
  });
}

// Function to stop audio
function stopAudio() {
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
    playState = PLAY_STATES.NO_AUDIO;
    updatePlayButton();
  }
}

// Function to handle the click event on the play button
function playButtonClick() {
  switch (playState) {
    case PLAY_STATES.NO_AUDIO:
      sendData();
      break;
    case PLAY_STATES.PLAYING:
      stopAudio();
      playState = PLAY_STATES.NO_AUDIO;
      updatePlayButton();
      break;
    default:
      break;
  }
}

textArea.addEventListener("input", () => {
  errorMessage.innerHTML = "";
});

// Function to send data to backend
function sendData() {
  const modelSelect = document.getElementById("models");
  const selectedModel = modelSelect.options[modelSelect.selectedIndex].value;
  const textInput = document.getElementById("text-input").value;
  if (!textInput) {
    errorMessage.innerHTML = "ERROR: Please add text!";
  } else {
    playState = PLAY_STATES.LOADING;
    updatePlayButton();

    // Build URL with model as query parameter (contract-compliant)
    const url = new URL("/tts/synthesize", window.location.origin);
    if (selectedModel) {
      url.searchParams.set("model", selectedModel);
    }

    fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: textInput,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          return response.json().then((errorData) => {
            throw new Error(errorData.error?.message || "Network response was not ok");
          });
        }
        return response.blob();
      })
      .then((audioBlob) => {
        // Create blob URL for the audio
        const audioUrl = URL.createObjectURL(audioBlob);
        console.log("Response received from server:", { audioUrl });
        playAudio(audioUrl);
        playState = PLAY_STATES.PLAYING;
        updatePlayButton();
      })
      .catch((error) => {
        console.error("There was a problem with your fetch operation:", error);
        playState = PLAY_STATES.NO_AUDIO;
        updatePlayButton();
      });
  }
}

// Event listener for the click event on the play button
document
  .getElementById("play-button")
  .addEventListener("click", playButtonClick);
