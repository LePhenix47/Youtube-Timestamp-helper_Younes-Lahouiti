import "./sass/main.scss";
import FileDropManager from "./utils/classes/file-drop-manager.class";
import Signal from "./utils/classes/signal.class";
import { fixInputRangeBackground } from "@utils/helpers/fix.utils";
import VideoPlayerManager from "./utils/classes/video-player.class";
import { bindVideoControls } from "./binds";
import { formatVideoTimeStamp } from "@utils/helpers/format.utils";

fixInputRangeBackground();

console.log("Hello world!");

const videoDropZone = document.querySelector<HTMLLabelElement>(
  "[data-element=upload-video-container]"
);

const videoDropZoneInput = document.querySelector<HTMLInputElement>(
  "[data-element=upload-video-input]"
);

const videoPlayer = document.querySelector<HTMLVideoElement>(
  "[data-element=video-player]"
);

const videoProgress = document.querySelector<HTMLDivElement>(
  "[data-element=video-progress]"
);

const videoIndicators = document.querySelector<HTMLDivElement>(
  "[data-element=video-indicators]"
);

const videoControls = document.querySelector<HTMLMenuElement>(
  "[data-element=video-controls]"
);

const videoBuffer = document.querySelector<HTMLParagraphElement>(
  "[data-element=video-buffer]"
);

const timestampsSideBar = document.querySelector<HTMLElement>(
  "[data-element=video-timestamps]"
);

const timeStampStart = document.querySelector<HTMLSpanElement>(
  "[data-element=timestamp-start]"
);
const timeStampEnd = document.querySelector<HTMLSpanElement>(
  "[data-element=timestamp-end]"
);

const signal = new Signal();

const playButton = videoControls.querySelector<HTMLLabelElement>(
  "[data-element=video-play-button]"
);

const volumeSlider = videoControls.querySelector<HTMLInputElement>(
  "[data-element=video-volume-slider]"
);

const muteButton = videoControls.querySelector<HTMLButtonElement>(
  "[data-element=video-mute-button]"
);

bindVideoControls(signal, {
  playButton,
  volumeSlider,
  muteButton,
});

const fileDropManager = new FileDropManager(videoDropZone, videoDropZoneInput);

fileDropManager.setFileValidation((file: File) => {
  if (!file.type.startsWith("video/")) {
    return "Invalid file type. Please upload a video file.";
  }
});

fileDropManager
  .onFileUploadError((file: File, errorMessage: string, eventType: string) => {
    signal.emit("video-upload-error", { file, errorMessage, eventType });
  })
  .onFileUpload((file: File, eventType: string) => {
    signal.emit("video-upload", { file, eventType });
  });

fileDropManager
  .onDragEnter(() => {
    signal.emit("dropzone-drag", { isHovering: true });
  })
  .onDragLeave(() => {
    signal.emit("dropzone-drag", { isHovering: false });
  });

const videoManager = new VideoPlayerManager(videoPlayer);

videoManager.onMetadata((duration, width, height) => {
  console.log("Video metadata:", { duration, width, height });
  videoProgress.style.setProperty("--_video-duration-secs", `${duration}`);

  const formattedDuration: string = formatVideoTimeStamp(duration);
  timeStampEnd.textContent = formattedDuration;
});

videoManager
  .onBufferUpdate((bufferedEnd, duration) => {
    console.log("Buffer update:", { bufferedEnd, duration });
    videoProgress.style.setProperty("--_buffer-end-secs", `${bufferedEnd}`);
  })
  .onTimeUpdate((currentTime, duration) => {
    console.log("Time update:", { currentTime, duration });
    videoProgress.style.setProperty(
      "--_current-video-progress-secs",
      `${currentTime}`
    );

    const formattedCurrentTime: string = formatVideoTimeStamp(currentTime);
    timeStampStart.textContent = formattedCurrentTime;
  })
  .onWaiting(() => {
    videoBuffer.classList.remove("hide");
  })
  .onCanPlay(() => {
    videoBuffer.classList.add("hide");
  });

signal.on("show-video", () => {
  videoDropZone.classList.remove("drag-hover");
  videoDropZone.classList.add("hide");

  const uploadedVideoElements = [
    videoPlayer,
    videoIndicators,
    videoControls,
    timestampsSideBar,
  ] as const;

  for (const element of uploadedVideoElements) {
    element.classList.remove("hide");
  }
});

signal.on("show-dropzone", () => {
  videoDropZone.classList.remove("drag-hover");
  videoDropZone.classList.remove("hide");

  const uploadedVideoElements = [
    videoPlayer,
    videoIndicators,
    videoControls,
    timestampsSideBar,
  ] as const;

  for (const element of uploadedVideoElements) {
    element.classList.add("hide");
  }
});

signal.on<{ isHovering: boolean }>("dropzone-drag", (detail) => {
  console.log("Dropzone drag detail:", detail);

  const { isHovering } = detail;

  videoDropZone.classList.toggle("drag-hover", isHovering);
});

signal.on<{ file: File; eventType: string }>("video-upload", (detail) => {
  console.log("Video upload detail:", detail);
  const { file, eventType } = detail;

  signal.emit("show-video");

  videoManager.loadSource(file);
});

signal.on<{ file: File; errorMessage: string; eventType: string }>(
  "video-upload-error",
  (detail) => {
    videoDropZone.classList.remove("drag-hover");
  }
);

signal.on<{ element: HTMLElement }>("video-play-toggle", async (detail) => {
  const { element: playButton } = detail;

  const inputForPlayButton =
    playButton.querySelector<HTMLInputElement>("input");

  if (inputForPlayButton.checked) {
    await videoManager.play();
  } else {
    videoManager.pause();
  }
});

signal.on<{ element: HTMLElement; value: number }>(
  "video-volume-change",
  (detail) => {
    const { element: volumeRange, value } = detail;
    console.log("Volume change:", { volumeRange, value });

    videoManager.setVolume(value / 100);

    const icon = muteButton.querySelector<HTMLLIElement>("i");
    icon.classList.remove(
      "fa-volume-xmark",
      "fa-volume-off",
      "fa-volume-low",
      "fa-volume-high"
    );

    if (value >= 50) {
      icon.classList.add("fa-volume-high");
    } else if (value > 0) {
      icon.classList.add("fa-volume-low");
    } else {
      icon.classList.add("fa-volume-off");
    }
  }
);

signal.on<{ element: HTMLElement; value: number }>(
  "video-mute-toggle",
  (detail) => {
    const { element: volumeRange, value } = detail;
    console.log("Volume change:", { volumeRange, value });

    // videoManager.

    videoManager.setVolume(value / 100);

    const icon = muteButton.querySelector<HTMLLIElement>("i");
    icon.classList.remove(
      "fa-volume-xmark",
      "fa-volume-off",
      "fa-volume-low",
      "fa-volume-high"
    );

    if (value >= 50) {
      icon.classList.add("fa-volume-high");
    } else if (value > 0) {
      icon.classList.add("fa-volume-low");
    } else {
      icon.classList.add("fa-volume-off");
    }
  }
);
