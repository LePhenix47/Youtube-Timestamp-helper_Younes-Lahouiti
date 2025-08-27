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
import YouTubeKeyboardControls from "@utils/classes/youtube-keyboard-controls.class";

fixInputRangeBackground();

console.log("Hello world!");

// Helper function to get video duration from file
const getVideoDuration = (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };

    video.onerror = () => {
      window.URL.revokeObjectURL(video.src);
      reject(new Error("Failed to load video metadata"));
    };

    video.src = window.URL.createObjectURL(file);
  });
};

const videoDropZone = document.querySelector<HTMLLabelElement>(
  "[data-element=upload-video-container]"
);

const videoDropZoneInput = document.querySelector<HTMLInputElement>(
  "[data-element=upload-video-input]"
);

const uploadVideoSpinner = document.querySelector<HTMLSpanElement>(
  "[data-element=upload-video-spinner]"
);

const uploadVideoIcon = document.querySelector<HTMLElement>(
  "[data-element=upload-video-icon]"
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

const deleteVideoButton = document.querySelector<HTMLButtonElement>(
  ".video-timestamps__remove"
);

const notEnoughChaptersAmount = document.querySelector<HTMLSpanElement>(
  "[data-element=not-enough-chapters-amount]"
);

const tooManyChaptersAmount = document.querySelector<HTMLSpanElement>(
  "[data-element=too-many-chapters-amount]"
);

const signal = new Signal();

// Track if we have an active video to prevent accidental tab close
let hasActiveVideo = false;

// Beforeunload protection function
const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
  if (hasActiveVideo) {
    e.preventDefault();
    return (e.returnValue =
      "You have an active video with chapters. Are you sure you want to leave?");
  }
};

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

fileDropManager.setFileValidation(async (file: File) => {
  // * Show spinner and hide icon when validation starts
  uploadVideoSpinner?.classList.remove("hide");
  uploadVideoIcon?.classList.add("hide");

  // * First check: file type
  if (!file.type.startsWith("video/")) {
    return "Invalid file type. Please upload a video file.";
  }

  // * Second check: video duration
  try {
    const duration = await getVideoDuration(file);
    if (duration < ChapterSideBarManager.MIN_VIDEO_DURATION) {
      return "Video duration is too short, YouTube chapters do not work for videos that short.";
    }
  } catch (error) {
    return "Unable to read video file. Please try a different video.";
  }
});

fileDropManager
  .onFileUploadError((file: File, errorMessage: string, eventType: string) => {
    // Hide spinner and show icon on validation/upload error
    uploadVideoSpinner?.classList.add("hide");
    uploadVideoIcon?.classList.remove("hide");
    signal.emit("video-upload-error", { file, errorMessage, eventType });
  })
  .onFileUpload((file: File, eventType: string) => {
    // Hide spinner and show icon on successful upload
    uploadVideoSpinner?.classList.add("hide");
    uploadVideoIcon?.classList.remove("hide");
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

let keyboardControls: YouTubeKeyboardControls | null = null;

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

  // Add beforeunload protection now that we have an active video
  hasActiveVideo = true;
  window.addEventListener("beforeunload", beforeUnloadHandler);

  // Show delete button when video is active
  deleteVideoButton?.classList.remove("hide");
  
  // Initialize keyboard controls when video is active
  keyboardControls = new YouTubeKeyboardControls(videoManager);
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

  // Hide delete button when showing dropzone
  deleteVideoButton?.classList.add("hide");
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

// Video reset/removal functionality
const resetVideo = () => {
  // Remove beforeunload protection
  hasActiveVideo = false;
  window.removeEventListener("beforeunload", beforeUnloadHandler);

  // Stop and clear video properly (without destroying event listeners)
  videoManager.pause();

  // Manually clear video source without destroying event listeners
  const sourceElement = videoManager.sourceElement;
  sourceElement.src = "";

  videoPlayer.load();

  // Destroy managers and reset state
  progressBar.destroyListeners();
  progressBar.reset(); // Clear chunks and reset progress bar state
  
  // Destroy keyboard controls
  if (keyboardControls) {
    keyboardControls.destroy();
    keyboardControls = null;
  }

  // Reset chapter sidebar manager (clears all chapters and DOM)
  chapterSidebarManager.reset();

  // Clear timestamps output
  timestampsOutput.value = "";

  // Reset time displays
  const timeDisplayElements = [timeStampStart, timeStampEnd, frameTimestamp];
  for (const element of timeDisplayElements) {
    if (element) {
      element.textContent = "0:00";
    }
  }

  // Show dropzone again
  signal.emit("show-dropzone");

  console.log("Video removed and app reset");
};

// Add event listener to delete button
deleteVideoButton?.addEventListener("click", () => {
  if (confirm("Are you sure you want to remove this video and all chapters?")) {
    resetVideo();
  }
});
