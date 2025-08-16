import "./sass/main.scss";
import FileDropManager from "./utils/classes/file-drop-manager.class";
import Signal from "./utils/classes/signal.class";
import { fixInputRangeBackground } from "@utils/helpers/fix.utils";
import VideoPlayerManager from "./utils/classes/video-player.class";
import { bindVideoControls } from "./binds";

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

const signal = new Signal();

bindVideoControls(signal, {
  playButton: videoControls.querySelector("[data-element=video-play-button]"),
  volumeSlider: videoControls.querySelector(
    "[data-element=video-volume-slider]"
  ),
  // muteButton: videoControls.querySelector("[data-element=video-mute-button]"),
  // fullscreenButton: videoControls.querySelector(
  //   "[data-element=video-fullscreen-button]"
  // ),
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
});

videoManager
  .onBufferUpdate((bufferedEnd, duration) => {
    console.log("Buffer update:", { bufferedEnd, duration });
  })
  .onTimeUpdate((currentTime, duration) => {
    console.log("Time update:", { currentTime, duration });
  })
  .onWaiting(() => {
    videoBuffer.classList.remove("hide");
  })
  .onCanPlay(() => {
    videoBuffer.classList.add("hide");
  })
  .onVolumeChange((volume: number, muted: boolean) => {});

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

signal.on<{ element: HTMLElement }>("video-play-toggle", (detail) => {
  const { element: playButton } = detail;

  const inputForPlayButton =
    playButton.querySelector<HTMLInputElement>("input");

  if (inputForPlayButton.checked) {
    videoManager.play();
  } else {
    videoManager.pause();
  }
});

signal.on<{ element: HTMLElement; value: number }>(
  "video-volume-change",
  (detail) => {
    const { element: volumeRange, value } = detail;

    videoManager.setVolume(value);
  }
);
