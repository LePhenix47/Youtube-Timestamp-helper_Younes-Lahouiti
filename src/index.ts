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

const fileDropManager = new FileDropManager(videoDropZone, videoDropZoneInput);

fileDropManager.setFileValidation((file) => {
  if (!file.type.startsWith("video/")) {
    return "Invalid file type. Please upload a video file.";
  }
});

fileDropManager
  .onFileUpload((file, eventType) => {
    console.log("File uploaded:", file);
    console.log("Event type:", eventType);
  })
  .onFileUploadError((file, errorMessage, eventType) => {
    console.error("File upload error:", errorMessage);
  });

fileDropManager
  .onDragEnter(() => {
    console.log("Drag enter");
  })
  .onDragLeave(() => {
    console.log("Drag leave");
  });
