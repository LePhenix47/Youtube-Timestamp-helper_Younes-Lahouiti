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

const playButtonCheckbox = playButton?.querySelector<HTMLInputElement>(
  'input[type="checkbox"]'
);

// Video indicators DOM elements
const playIndicator = videoIndicators?.querySelector<HTMLParagraphElement>(
  "[data-element=play-indicator]"
);
const pauseIndicator = videoIndicators?.querySelector<HTMLParagraphElement>(
  "[data-element=pause-indicator]"
);
const skipBackwards10s = videoIndicators?.querySelector<HTMLParagraphElement>(
  "[data-element=skip-backwards-10s]"
);
const skipForwards10s = videoIndicators?.querySelector<HTMLParagraphElement>(
  "[data-element=skip-forwards-10s]"
);
const skipBackwards5s = videoIndicators?.querySelector<HTMLParagraphElement>(
  "[data-element=skip-backwards-5s]"
);
const skipForwards5s = videoIndicators?.querySelector<HTMLParagraphElement>(
  "[data-element=skip-forwards-5s]"
);
const volumeUpIndicator = videoIndicators?.querySelector<HTMLParagraphElement>(
  "[data-element=volume-up-indicator]"
);
const volumeDownIndicator =
  videoIndicators?.querySelector<HTMLParagraphElement>(
    "[data-element=volume-down-indicator]"
  );
const muteIndicator = videoIndicators?.querySelector<HTMLParagraphElement>(
  "[data-element=mute-indicator]"
);
const unmuteIndicator = videoIndicators?.querySelector<HTMLParagraphElement>(
  "[data-element=unmute-indicator]"
);
const frameBackwardIndicator =
  videoIndicators?.querySelector<HTMLParagraphElement>(
    "[data-element=frame-backward-indicator]"
  );
const frameForwardIndicator =
  videoIndicators?.querySelector<HTMLParagraphElement>(
    "[data-element=frame-forward-indicator]"
  );
const jumpStartIndicator = videoIndicators?.querySelector<HTMLParagraphElement>(
  "[data-element=jump-start-indicator]"
);
const indicatorPercentageText =
  videoIndicators?.querySelector<HTMLParagraphElement>(
    "[data-element=indicator-percentage-text]"
  );

// Helper functions for showing indicators
const showIndicator = (element: HTMLElement | null): void => {
  if (!element) return;

  element.classList.remove("hide");
  element.style.animation = "bezel-fade-out 500ms linear forwards";

  // Listen for animation end to hide the element
  const handleAnimationEnd = () => {
    element.classList.add("hide");
    element.removeEventListener("animationend", handleAnimationEnd);
  };

  // Remove any existing listener to prevent duplicates
  element.removeEventListener("animationend", handleAnimationEnd);
  element.addEventListener("animationend", handleAnimationEnd);
};

const showSkipIndicator = (element: HTMLElement | null): void => {
  if (!element) return;

  // Hide all other skip indicators first to prevent stacking
  for (const indicator of allSkipIndicators) {
    if (indicator === element) {
      continue;
    }

    indicator.classList.add("hide");
  }

  element.classList.remove("hide");
  // Skip indicators use their own shine-animation-mask defined in CSS

  // Listen for animation end to hide the element
  const handleAnimationEnd = () => {
    element.classList.add("hide");
    element.removeEventListener("animationend", handleAnimationEnd);
  };

  // Remove any existing listener to prevent duplicates
  element.removeEventListener("animationend", handleAnimationEnd);
  element.addEventListener("animationend", handleAnimationEnd);
};

// Track timeout for percentage text indicator
let textIndicatorTimeout: number | null = null;

const showTextIndicator = (text: string, duration = 1_000): void => {
  if (!indicatorPercentageText) return;

  // Clear existing timeout to prevent flickering
  if (textIndicatorTimeout) {
    clearTimeout(textIndicatorTimeout);
  }

  indicatorPercentageText.textContent = text;
  indicatorPercentageText.classList.remove("hide");

  // Text indicator doesn't have CSS animation, so use setTimeout
  textIndicatorTimeout = setTimeout(() => {
    indicatorPercentageText.classList.add("hide");
    textIndicatorTimeout = null;
  }, duration);
};

// Helper function to update volume slider and trigger styling update
const updateVolumeSlider = (value: number): void => {
  if (!volumeSlider) return;

  volumeSlider.valueAsNumber = value;
  // Dispatch input event to trigger the CSS custom property update
  volumeSlider.dispatchEvent(new InputEvent("input", { bubbles: true }));
};

// Array of all skip indicators for managing visibility
const allSkipIndicators = [
  skipBackwards10s,
  skipForwards10s,
  skipBackwards5s,
  skipForwards5s,
  frameBackwardIndicator,
  frameForwardIndicator,
].filter(Boolean); // Remove any null/undefined elements

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

    // TODO: Check if this is ain't gonna cause performance issues
    signal.emit("frame-preview-updated", {
      time: videoManager.currentTime,
    });
  })
  .onWaiting(() => {
    videoBuffer.classList.remove("hide");
  })
  .onCanPlay(() => {
    videoBuffer.classList.add("hide");
  })
  .onStateChange((isPlaying) => {
    // When video starts playing, remove video-ended class (handles restart from any source)
    if (!isPlaying) {
      return;
    }

    playButton?.classList?.remove?.("video-ended");
  })
  .onEnded(() => {
    // Add restart class to show restart icon instead of play/pause
    playButton?.classList.add("video-ended");

    // Uncheck the play button
    if (playButtonCheckbox) {
      playButtonCheckbox.checked = false;
    }
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

  // Add click event to video for play/pause toggle
  videoPlayer.addEventListener("click", async () => {
    await videoManager.toggle();
  });

  // Initialize keyboard controls when video is active
  keyboardControls = new YouTubeKeyboardControls(videoManager)
    .onPlayPause((isPlaying) => {
      // Show play/pause indicator
      showIndicator(isPlaying ? playIndicator : pauseIndicator);

      // Sync checkbox state via existing signal system
      if (playButtonCheckbox) {
        playButtonCheckbox.checked = isPlaying;
      }
    })
    .onSeek((direction, seconds) => {
      // Show appropriate skip indicator based on seek duration
      switch (seconds) {
        case 10:
          showSkipIndicator(
            direction === "forward" ? skipForwards10s : skipBackwards10s
          );
          break;
        case 5:
          showSkipIndicator(
            direction === "forward" ? skipForwards5s : skipBackwards5s
          );
          break;
      }
    })
    .onVolumeChange((newVolume) => {
      // Show volume indicator
      showIndicator(newVolume > 0.5 ? volumeUpIndicator : volumeDownIndicator);

      // Show percentage
      const percentage = Math.round(newVolume * 100);
      showTextIndicator(`${percentage}%`);

      // Use existing signal for volume slider and icon updates
      signal.emit("video-volume-change", { value: percentage });
    })
    .onMuteToggle((isMuted) => {
      // Show mute/unmute indicator
      showIndicator(isMuted ? muteIndicator : unmuteIndicator);

      // Update volume icon directly since mute/unmute is already handled by keyboard controls
      const icon = muteButton?.querySelector<HTMLElement>("i");
      if (icon) {
        icon.classList.remove(
          "fa-volume-xmark",
          "fa-volume-off",
          "fa-volume-low",
          "fa-volume-high"
        );

        if (isMuted) {
          icon.classList.add("fa-volume-xmark");
        } else {
          const volume = videoManager.volume;
          if (volume >= 0.5) {
            icon.classList.add("fa-volume-high");
          } else if (volume > 0) {
            icon.classList.add("fa-volume-low");
          } else {
            icon.classList.add("fa-volume-off");
          }
        }
      }
    })
    .onFrameStep((direction) => {
      // Show frame step indicator
      showSkipIndicator(
        direction === "forward" ? frameForwardIndicator : frameBackwardIndicator
      );
    })
    .onJump((percentage) => {
      // Show jump indicator
      if (percentage === 0) {
        showIndicator(jumpStartIndicator);
      } else if (percentage) {
        showTextIndicator(`${percentage}%`);
      }
    });
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

  // Check if video has ended and needs restart
  if (playButton?.classList.contains("video-ended")) {
    // Restart video from beginning
    videoManager.seek(0);
    await videoManager.play();

    // Remove restart class to show normal play/pause icons
    playButton.classList.remove("video-ended");
  } else {
    // Normal play/pause toggle
    if (inputForPlayButton.checked) {
      await videoManager.play();
    } else {
      videoManager.pause();
    }
  }
});

signal.on<{ value: number }>("video-volume-change", (detail) => {
  const { value } = detail;
  console.log("Volume change:", value);

  videoManager.unmute();
  videoManager.setVolume(value / 100);

  // Update volume slider and trigger styling update
  updateVolumeSlider(value);

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

  const icon = muteButton.querySelector<HTMLLIElement>("i");
  icon.classList.remove(
    "fa-volume-xmark",
    "fa-volume-off",
    "fa-volume-low",
    "fa-volume-high"
  );

  if (isMuted) {
    // Currently muted, so unmute and restore volume
    videoManager.unmute();
    videoManager.setVolume(value / 100);

    // Update icon based on volume level
    if (value >= 50) {
      icon.classList.add("fa-volume-high");
    } else if (value > 0) {
      icon.classList.add("fa-volume-low");
    } else {
      icon.classList.add("fa-volume-off");
    }
  } else {
    // Currently unmuted, so mute
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
  const question: string =
    "Are you sure you want to remove this video and all chapters ?";

  const acceptedAnswer: boolean = confirm(question);
  if (acceptedAnswer) {
    resetVideo();
  }
});
