const PLAY_STATES = {
  NO_AUDIO: "no_audio",
  LOADING: "loading",
  PLAYING: "playing",
};

let playState = PLAY_STATES.NO_AUDIO;
let audioPlayer;
const textArea = document.getElementById("text-input");
const errorMessage = document.querySelector("#error-message");
let currentAudioBlob = null;

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

function stopAudio() {
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
  }
  playState = PLAY_STATES.NO_AUDIO;
  updatePlayButton();
  document.getElementById('download-button').style.display = 'none';
}

function playButtonClick() {
  switch (playState) {
    case PLAY_STATES.NO_AUDIO:
      sendData();
      break;
    case PLAY_STATES.PLAYING:
      stopAudio();
      break;
    default:
      break;
  }
}

textArea.addEventListener("input", () => {
  errorMessage.innerHTML = "";
});

function createDownloadLink(blob) {
  const downloadButton = document.getElementById('download-button');
  const url = URL.createObjectURL(blob);
  downloadButton.href = url;
  downloadButton.download = 'audio.wav';
  downloadButton.style.display = 'inline-block';
}

function sendData() {
  const modelSelect = document.getElementById("models");
  const selectedModel = modelSelect.options[modelSelect.selectedIndex].value;
  const textInput = document.getElementById("text-input").value;
  if (!textInput) {
    errorMessage.innerHTML = "ERROR: Please add text!";
  } else {
    playState = PLAY_STATES.LOADING;
    updatePlayButton();

    const data = {
      model: selectedModel,
      text: textInput,
    };
    fetch("http://localhost:3000/api", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.blob();
      })
      .then((blob) => {
        currentAudioBlob = blob;
        const audioUrl = URL.createObjectURL(blob);
        audioPlayer = document.getElementById("audio-player");
        audioPlayer.src = audioUrl;
        
        playState = PLAY_STATES.PLAYING;
        updatePlayButton();

        audioPlayer.play();

        audioPlayer.addEventListener("ended", () => {
          stopAudio();
        });

        createDownloadLink(blob);
      })
      .catch((error) => {
        console.error("Error fetching audio:", error);
        errorMessage.innerHTML = "Error fetching audio. Please try again.";
        stopAudio();
      });
  }
}

document
  .getElementById("play-button")
  .addEventListener("click", playButtonClick);