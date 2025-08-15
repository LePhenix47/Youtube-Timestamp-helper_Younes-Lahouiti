import FileDropManager from "./classes/file-drop-manager.class";
import Signal from "./classes/signal.class";
import "./sass/main.scss";

import { fixInputRangeBackground } from "@utils/fix.utils";
fixInputRangeBackground();

console.log("Hello world!");

const signal = new Signal();

const videoDropZone = document.querySelector<HTMLLabelElement>(
  "[data-element=upload-video-container]"
);

const videoDropZoneInput = document.querySelector<HTMLInputElement>(
  "[data-element=upload-video-input]"
);

signal.on<{ isHovering: boolean }>("dropzone-drag", (detail) => {
  console.log("Dropzone drag detail:", detail);

  const { isHovering } = detail;

  videoDropZone.classList.toggle("drag-hover", isHovering);
});

signal.on<{ file: File; eventType: string }>("video-upload", (detail) => {
  console.log("Video upload detail:", detail);
});

signal.on<{ file: File; errorMessage: string; eventType: string }>(
  "video-upload-error",
  (detail) => {
    videoDropZone.classList.remove("drag-hover");
  }
);

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
