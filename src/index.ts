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

// ! WARNING: These events should NEVER trigger if a video was already uploaded (need to bear that in mind)
// TODO: Create a class to abstract the dropzone stuff
videoDropZoneInput.addEventListener("change", (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input?.files?.length) {
    return;
  }

  const file = input.files[0];
  console.log(file);

  if (!file.type.startsWith("video/")) {
    console.error("Invalid file type");
    // TODO: Add signals that updates the UI
    return;
  }

  signal.emit("video:upload", {
    file: file,
    eventType: event.type,
  });
});

document.addEventListener("paste", (event: ClipboardEvent) => {
  const { activeElement } = document;
  const isFocusedOnADifferentInput =
    activeElement !== videoDropZoneInput &&
    activeElement.tagName.toLocaleLowerCase() !== "input";

  if (isFocusedOnADifferentInput) {
    return;
  }

  const items = event.clipboardData?.items;
  if (!items) return;

  const file = items[0].getAsFile();

  signal.emit("video:upload", {
    file: file,
    eventType: event.type,
  });
});

videoDropZone.addEventListener("drop", (event: DragEvent) => {
  event.preventDefault();

  if (!event.dataTransfer?.files.length) {
    return;
  }

  const file = event.dataTransfer.files[0];
  console.log(file); // File object

  signal.emit("video:upload", {
    file: file,
    eventType: event.type,
  });
});

videoDropZone.addEventListener("dragover", (event: DragEvent) => {
  event.preventDefault();
});

videoDropZone.addEventListener("dragleave", (event) => {
  signal.emit("remove-dropzone-highlight");
});

videoDropZone.addEventListener("dragenter", (event) => {
  event.preventDefault();

  console.log(event.type);

  signal.emit("add-dropzone-highlight");
});

videoDropZone.addEventListener("dragleave", (event: DragEvent) => {
  event.preventDefault();

  console.log(event.type);

  signal.emit("remove-dropzone-highlight");
});
