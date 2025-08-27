import "./sass/main.scss";
import FileDropManager from "./utils/classes/file-drop-manager.class";
import Signal from "./utils/classes/signal.class";
import { fixInputRangeBackground } from "@utils/helpers/fix.utils";
import VideoPlayerManager from "./utils/classes/video-player.class";
import { bindVideoControls } from "./binds";
import { formatVideoTimeStamp } from "@utils/helpers/format.utils";
import ChapterSideBarManager, {
  Chapter,
} from "@utils/classes/chapter-sidebar-manager.class";
import ProgressBar from "@utils/classes/progressbar.class";

fixInputRangeBackground();

console.log("Hello world!");

const videoDropZone = document.querySelector<HTMLLabelElement>(
  "[data-element=upload-video-container]"
);

const videoDropZoneInput = document.querySelector<HTMLInputElement>(
  "[data-element=upload-video-input]"
);

const videoContainer = document.querySelector<HTMLElement>(
  "[data-element=video-container]"
);

const videoPlayer = videoContainer.querySelector<HTMLVideoElement>(
  "[data-element=video-player]"
);

const videoProgress = videoContainer.querySelector<HTMLDivElement>(
  "[data-element=video-progress]"
);

const videoIndicators = videoContainer.querySelector<HTMLDivElement>(
  "[data-element=video-indicators]"
);

const videoControls = videoContainer.querySelector<HTMLMenuElement>(
  "[data-element=video-controls]"
);

const videoBuffer = videoContainer.querySelector<HTMLParagraphElement>(
  "[data-element=video-buffer]"
);

const timestampsSideBar = document.querySelector<HTMLElement>(
  "[data-element=video-timestamps]"
);

const timestampsList = document.querySelector<HTMLUListElement>(
  "[data-element=video-timestamps-list]"
);

const timeStampStart = document.querySelector<HTMLSpanElement>(
  "[data-element=timestamp-start]"
);
const timeStampEnd = document.querySelector<HTMLSpanElement>(
  "[data-element=timestamp-end]"
);

const frameTimestamp = document.querySelector<HTMLSpanElement>(
  "[data-element=video-progress-frame-timestamp]"
);

const timeStampControlsChapter = document.querySelector<HTMLButtonElement>(
  "[data-element=timestamp-chapter]"
);

const timeStampAddChapterButton = document.querySelector<HTMLButtonElement>(
  "[data-element=video-timestamps-add-button]"
);

const timestampsOutput = document.querySelector<HTMLTextAreaElement>(
  "[data-element=timestamps-output]"
);

const copyTimestampsButton = document.querySelector<HTMLButtonElement>(
  "[data-element=copy-timestamps-button]"
);

const notEnoughChaptersAmount = document.querySelector<HTMLSpanElement>(
  "[data-element=not-enough-chapters-amount]"
);

const tooManyChaptersAmount = document.querySelector<HTMLSpanElement>(
  "[data-element=too-many-chapters-amount]"
);

const signal = new Signal();

// Set the minimum chapter amount immediately (static value)
if (notEnoughChaptersAmount) {
  notEnoughChaptersAmount.textContent =
    ChapterSideBarManager.MIN_CHAPTER_AMOUNT.toString();
}

const playButton = videoControls.querySelector<HTMLLabelElement>(
  "[data-element=video-play-button]"
);

const volumeSliderLabel = videoControls.querySelector<HTMLLabelElement>(
  "[data-element=video-volume-slider]"
);

const volumeSlider =
  volumeSliderLabel.querySelector<HTMLInputElement>("input[type=range]");

const muteButton = videoControls.querySelector<HTMLButtonElement>(
  "[data-element=video-mute-button]"
);

const chapterSidebarManager = new ChapterSideBarManager(timestampsList);

timeStampAddChapterButton.addEventListener("click", () => {
  chapterSidebarManager.addChapter();
});

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
  .onDragOver(() => {
    signal.emit("dropzone-drag", { isHovering: true });
  })
  .onDragLeave(() => {
    signal.emit("dropzone-drag", { isHovering: false });
  });

const videoManager = new VideoPlayerManager(videoPlayer);

videoManager
  .onMetadata((duration, width, height) => {
    console.log("Video metadata:", { duration, width, height });
    videoProgress.style.setProperty("--_video-duration-secs", `${duration}`);

    const formattedDuration: string = formatVideoTimeStamp(duration);
    timeStampEnd.textContent = formattedDuration;

    chapterSidebarManager.setVideoDuration(duration);

    // Set the maximum chapter amount after video duration is set
    if (tooManyChaptersAmount) {
      tooManyChaptersAmount.textContent = `${chapterSidebarManager.MAX_VIDEO_CHAPTERS}`;
    }

    progressBar.instantiateListeners();

    chapterSidebarManager.createInitialChapter();
  })
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

    const formatted = formatVideoTimeStamp(currentTime);

    frameTimestamp.textContent = formatted;
    timeStampStart.textContent = formatted;
  })
  .onWaiting(() => {
    videoBuffer.classList.remove("hide");
  })
  .onCanPlay(() => {
    videoBuffer.classList.add("hide");
  });

const progressBar = new ProgressBar(videoManager, videoContainer);

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

signal.on("video-play-toggle", async (detail) => {
  const inputForPlayButton =
    playButton.querySelector<HTMLInputElement>("input");

  if (inputForPlayButton.checked) {
    await videoManager.play();
  } else {
    videoManager.pause();
  }
});

signal.on<{ value: number }>("video-volume-change", (detail) => {
  const { value } = detail;
  console.log("Volume change:", value);

  videoManager.unmute();
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
});

signal.on<{ value: number }>("video-mute-toggle", (detail) => {
  const { value } = detail;

  const isMuted: boolean = videoManager.isMuted;
  // videoManager.

  const icon = muteButton.querySelector<HTMLLIElement>("i");
  icon.classList.remove(
    "fa-volume-xmark",
    "fa-volume-off",
    "fa-volume-low",
    "fa-volume-high"
  );

  if (isMuted) {
    signal.emit("video-volume-change", {
      value: volumeSlider.valueAsNumber,
    });
  } else {
    videoManager.mute();
    icon.classList.add("fa-volume-xmark");
  }
});

signal.on("timestamp-output-update", () => {
  const youtubeTimestamps = chapterSidebarManager.getYoutubeTimestamps();
  timestampsOutput.value = youtubeTimestamps;
});

// Copy button functionality
const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
};

// Copy button emits signal
copyTimestampsButton?.addEventListener("click", () => {
  signal.emit("copy-timestamps");
});

// Handle copy signal
signal.on("copy-timestamps", async () => {
  const originalText: string = copyTimestampsButton.innerText;
  const success = await copyToClipboard(timestampsOutput.value);

  copyTimestampsButton.textContent = success ? "✅ Copied!" : "❌ Failed";
  setTimeout(() => {
    copyTimestampsButton.textContent = originalText;
  }, 2_000);
});
