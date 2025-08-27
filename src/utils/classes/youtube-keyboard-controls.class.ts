import VideoPlayerManager from "./video-player.class";

class YouTubeKeyboardControls {
  private videoManager: VideoPlayerManager;
  private abortController = new AbortController();

  constructor(videoManager: VideoPlayerManager) {
    this.videoManager = videoManager;
    this.setupKeyboardListeners();
  }

  private setupKeyboardListeners = (): void => {
    const { signal } = this.abortController;

    document.addEventListener("keydown", this.handleKeydown, { signal });
  };

  private handleKeydown = (event: KeyboardEvent): void => {
    // Skip if user is typing in an input field
    const target = event.target as HTMLElement;
    if (target.matches("input, textarea, select, [contenteditable]")) {
      return;
    }

    const key = event.key.toLowerCase();
    const code = event.code;

    // Prevent default for handled keys
    const handledKeys = [
      "space",
      "k",
      "j",
      "l",
      "arrowleft",
      "arrowright",
      "period",
      "comma",
      "digit0",
      "home",
      "arrowup",
      "arrowdown",
      "m",
      "digit1",
      "digit2",
      "digit3",
      "digit4",
      "digit5",
      "digit6",
      "digit7",
      "digit8",
      "digit9",
    ];

    if (handledKeys.includes(code.toLowerCase()) || handledKeys.includes(key)) {
      event.preventDefault();
    }

    switch (key) {
      case " ": // Space
      case "k":
        this.togglePlayPause();
        break;

      case "j":
        this.seekBackward(10);
        break;

      case "l":
        this.seekForward(10);
        break;

      case "arrowleft":
        this.seekBackward(5);
        break;

      case "arrowright":
        this.seekForward(5);
        break;

      case ";":
        this.stepFrame(1); // Forward one frame
        break;

      case ",":
        this.stepFrame(-1); // Backward one frame
        break;

      case "0":
        this.jumpToStart();
        break;

      case "home":
        this.jumpToStart();
        break;

      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        this.jumpToPercentage(parseInt(key) * 10);
        break;

      case "arrowup":
        this.adjustVolume(0.05); // +5%
        break;

      case "arrowdown":
        this.adjustVolume(-0.05); // -5%
        break;

      case "m":
        this.toggleMute();
        break;
    }
  };

  private togglePlayPause = async (): Promise<void> => {
    if (this.videoManager.isPaused) {
      await this.videoManager.play();
    } else {
      this.videoManager.pause();
    }
  };

  private seekBackward = (seconds: number): void => {
    const currentTime = this.videoManager.currentTime;
    const newTime = Math.max(0, currentTime - seconds);
    this.videoManager.seek(newTime);
  };

  private seekForward = (seconds: number): void => {
    const currentTime = this.videoManager.currentTime;
    const duration = this.videoManager.duration;
    const newTime = Math.min(duration, currentTime + seconds);
    this.videoManager.seek(newTime);
  };

  private stepFrame = (direction: 1 | -1): void => {
    // Frame stepping only works when paused
    if (!this.videoManager.isPaused) {
      return;
    }

    // Approximate frame duration at 30fps (1/30 = 0.033s)
    const frameDuration = 1 / 30;
    const currentTime = this.videoManager.currentTime;
    const duration = this.videoManager.duration;

    let newTime: number;
    if (direction === 1) {
      newTime = Math.min(duration, currentTime + frameDuration);
    } else {
      newTime = Math.max(0, currentTime - frameDuration);
    }

    this.videoManager.seek(newTime);
  };

  private jumpToStart = (): void => {
    this.videoManager.seek(0);
  };

  private jumpToPercentage = (percentage: number): void => {
    const duration = this.videoManager.duration;
    const targetTime = (duration * percentage) / 100;
    this.videoManager.seek(targetTime);
  };

  private adjustVolume = (delta: number): void => {
    const currentVolume = this.videoManager.volume;
    const newVolume = Math.max(0, Math.min(1, currentVolume + delta));

    // Unmute if volume is being increased from 0
    if (currentVolume === 0 && delta > 0) {
      this.videoManager.unmute();
    }

    this.videoManager.setVolume(newVolume);
  };

  private toggleMute = (): void => {
    if (this.videoManager.isMuted) {
      this.videoManager.unmute();
    } else {
      this.videoManager.mute();
    }
  };

  public destroy = (): void => {
    this.abortController.abort();
    this.abortController = new AbortController();
  };
}

export default YouTubeKeyboardControls;
