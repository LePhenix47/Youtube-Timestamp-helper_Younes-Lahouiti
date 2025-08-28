import VideoPlayerManager from "./video-player.class";

type PlayPauseCallback = (isPlaying: boolean) => void;
type SeekCallback = (direction: "backward" | "forward", seconds: number) => void;
type VolumeChangeCallback = (newVolume: number) => void;
type MuteToggleCallback = (isMuted: boolean) => void;
type JumpCallback = (percentage?: number) => void;
type FrameStepCallback = (direction: "backward" | "forward") => void;

class YouTubeKeyboardControls {
  private videoManager: VideoPlayerManager;
  private abortController = new AbortController();
  private signal?: any; // Signal for emitting events

  // Callbacks
  private onPlayPauseCallback?: PlayPauseCallback;
  private onSeekCallback?: SeekCallback;
  private onVolumeChangeCallback?: VolumeChangeCallback;
  private onMuteToggleCallback?: MuteToggleCallback;
  private onJumpCallback?: JumpCallback;
  private onFrameStepCallback?: FrameStepCallback;

  constructor(videoManager: VideoPlayerManager, signal?: any) {
    this.videoManager = videoManager;
    this.signal = signal;
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
    // Use signal if available, otherwise fall back to direct control
    if (this.signal) {
      this.signal.emit("video-play-toggle");
    } else {
      const wasPlaying = !this.videoManager.isPaused;
      
      if (this.videoManager.isPaused) {
        await this.videoManager.play();
      } else {
        this.videoManager.pause();
      }
      
      // Call callback with the new playing state
      this.onPlayPauseCallback?.(!wasPlaying);
    }
  };

  private seekBackward = (seconds: number): void => {
    const currentTime = this.videoManager.currentTime;
    const newTime = Math.max(0, currentTime - seconds);
    this.videoManager.seek(newTime);
    
    // Call callback
    this.onSeekCallback?.("backward", seconds);
  };

  private seekForward = (seconds: number): void => {
    const currentTime = this.videoManager.currentTime;
    const duration = this.videoManager.duration;
    const newTime = Math.min(duration, currentTime + seconds);
    this.videoManager.seek(newTime);
    
    // Call callback
    this.onSeekCallback?.("forward", seconds);
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
    
    // Call callback
    this.onFrameStepCallback?.(direction === 1 ? "forward" : "backward");
  };

  private jumpToStart = (): void => {
    this.videoManager.seek(0);
    
    // Call callback (0 percentage for start)
    this.onJumpCallback?.(0);
  };

  private jumpToPercentage = (percentage: number): void => {
    const duration = this.videoManager.duration;
    const targetTime = (duration * percentage) / 100;
    this.videoManager.seek(targetTime);
    
    // Call callback with percentage
    this.onJumpCallback?.(percentage);
  };

  private adjustVolume = (delta: number): void => {
    const currentVolume = this.videoManager.volume;
    const newVolume = Math.max(0, Math.min(1, currentVolume + delta));

    // Unmute if volume is being increased from 0
    if (currentVolume === 0 && delta > 0) {
      this.videoManager.unmute();
    }

    this.videoManager.setVolume(newVolume);
    
    // Call callback with new volume
    this.onVolumeChangeCallback?.(newVolume);
  };

  private toggleMute = (): void => {
    const willBeMuted = !this.videoManager.isMuted;
    
    if (this.videoManager.isMuted) {
      this.videoManager.unmute();
    } else {
      this.videoManager.mute();
    }
    
    // Call callback with new muted state
    this.onMuteToggleCallback?.(willBeMuted);
  };

  // Callback setter methods
  public onPlayPause = (fn: PlayPauseCallback): this => {
    this.onPlayPauseCallback = fn;
    return this;
  };

  public onSeek = (fn: SeekCallback): this => {
    this.onSeekCallback = fn;
    return this;
  };

  public onVolumeChange = (fn: VolumeChangeCallback): this => {
    this.onVolumeChangeCallback = fn;
    return this;
  };

  public onMuteToggle = (fn: MuteToggleCallback): this => {
    this.onMuteToggleCallback = fn;
    return this;
  };

  public onJump = (fn: JumpCallback): this => {
    this.onJumpCallback = fn;
    return this;
  };

  public onFrameStep = (fn: FrameStepCallback): this => {
    this.onFrameStepCallback = fn;
    return this;
  };

  public destroy = (): void => {
    this.abortController.abort();
    this.abortController = new AbortController();
  };
}

export default YouTubeKeyboardControls;
