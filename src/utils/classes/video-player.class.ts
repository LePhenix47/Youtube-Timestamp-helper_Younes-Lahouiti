type TimeUpdateCallback = (currentTime: number, duration: number) => void;
type BufferUpdateCallback = (bufferedEnd: number, duration: number) => void;
type StateChangeCallback = (isPlaying: boolean) => void;
type MetadataCallback = (
  duration: number,
  width: number,
  height: number
) => void;
type EndedCallback = () => void;
type SeekingCallback = (time: number) => void;
type VolumeCallback = (volume: number, muted: boolean) => void;
type ErrorCallback = (message: string, error: MediaError | null) => void;
type LoadingCallback = () => void; // 🔹 new

class VideoPlayerManager {
  public video: HTMLVideoElement;
  private abortController = new AbortController();
  private objectUrl?: string;

  private onTimeUpdateCallback?: TimeUpdateCallback;
  private onBufferUpdateCallback?: BufferUpdateCallback;
  private onStateChangeCallback?: StateChangeCallback;
  private onMetadataCallback?: MetadataCallback;
  private onEndedCallback?: EndedCallback;
  private onSeekingCallback?: SeekingCallback;
  private onSeekedCallback?: SeekingCallback;
  private onVolumeCallback?: VolumeCallback;
  private onErrorCallback?: ErrorCallback;
  private onWaitingCallback?: LoadingCallback; // 🔹
  private onCanPlayCallback?: LoadingCallback; // 🔹

  constructor(video: HTMLVideoElement) {
    if (!(video instanceof HTMLVideoElement)) {
      throw new Error("Invalid video element");
    }
    this.video = video;
    this.setupEvents();
  }

  get videoElement(): HTMLVideoElement {
    return this.video;
  }

  get duration(): number {
    return this.video.duration;
  }

  get currentTime(): number {
    return this.video.currentTime;
  }

  get isPaused(): boolean {
    return this.video.paused;
  }

  get isMuted(): boolean {
    return this.video.muted;
  }

  get volume(): number {
    return this.video.volume;
  }

  get source(): string {
    return this.video.src;
  }

  private setupEvents() {
    const { signal } = this.abortController;

    this.video.addEventListener(
      "timeupdate",
      () => {
        this.onTimeUpdateCallback?.(
          this.video.currentTime,
          this.video.duration
        );
      },
      { signal }
    );

    this.video.addEventListener(
      "progress",
      () => {
        const lastRangeIndex = this.video.buffered.length - 1;

        if (lastRangeIndex < 0) {
          return;
        }

        const bufferedEnd = this.video.buffered.end(lastRangeIndex);
        this.onBufferUpdateCallback?.(bufferedEnd, this.video.duration);
      },
      { signal }
    );

    this.video.addEventListener(
      "play",
      () => this.onStateChangeCallback?.(true),
      { signal }
    );

    this.video.addEventListener(
      "pause",
      () => this.onStateChangeCallback?.(false),
      { signal }
    );

    this.video.addEventListener(
      "loadedmetadata",
      () => {
        this.onMetadataCallback?.(
          this.video.duration,
          this.video.videoWidth,
          this.video.videoHeight
        );
      },
      { signal }
    );

    this.video.addEventListener("ended", () => this.onEndedCallback?.(), {
      signal,
    });

    this.video.addEventListener(
      "seeking",
      () => this.onSeekingCallback?.(this.video.currentTime),
      { signal }
    );

    this.video.addEventListener(
      "seeked",
      () => this.onSeekedCallback?.(this.video.currentTime),
      { signal }
    );

    this.video.addEventListener(
      "volumechange",
      () => this.onVolumeCallback?.(this.video.volume, this.video.muted),
      { signal }
    );

    this.video.addEventListener(
      "error",
      () => {
        const error = this.video.error;
        this.onErrorCallback?.(error?.message ?? "Unknown video error", error);
      },
      { signal }
    );

    // 🔹 Loading events
    this.video.addEventListener("waiting", () => this.onWaitingCallback?.(), {
      signal,
    });

    this.video.addEventListener("canplay", () => this.onCanPlayCallback?.(), {
      signal,
    });
  }

  get sourceElement(): HTMLSourceElement | null {
    const sourceElement = this.video.querySelector<HTMLSourceElement>("source");

    return sourceElement || null;
  }

  // 🔹 Source loading
  public loadSource = (source: File | Blob | string) => {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = undefined;
    }

    let src: string = "";
    if (source instanceof File || source instanceof Blob) {
      this.objectUrl = URL.createObjectURL(source);
      src = this.objectUrl;
    } else {
      src = source;
    }

    const sourceElement = this.video.querySelector<HTMLSourceElement>("source");
    if (sourceElement) {
      sourceElement.src = src;
    } else {
      this.video.src = src;
    }

    this.video.load();
  };

  // 🔹 Event API
  public onTimeUpdate = (fn: TimeUpdateCallback): this => {
    this.onTimeUpdateCallback = fn;
    return this;
  };
  public onBufferUpdate = (fn: BufferUpdateCallback): this => {
    this.onBufferUpdateCallback = fn;
    return this;
  };
  public onStateChange = (fn: StateChangeCallback): this => {
    this.onStateChangeCallback = fn;
    return this;
  };
  public onMetadata = (fn: MetadataCallback): this => {
    this.onMetadataCallback = fn;
    return this;
  };
  public onEnded = (fn: EndedCallback): this => {
    this.onEndedCallback = fn;
    return this;
  };
  public onSeeking = (fn: SeekingCallback): this => {
    this.onSeekingCallback = fn;
    return this;
  };
  public onSeeked = (fn: SeekingCallback): this => {
    this.onSeekedCallback = fn;
    return this;
  };
  public onVolumeChange = (fn: VolumeCallback): this => {
    this.onVolumeCallback = fn;
    return this;
  };
  public onError = (fn: ErrorCallback): this => {
    this.onErrorCallback = fn;
    return this;
  };

  public onWaiting = (fn: LoadingCallback): this => {
    this.onWaitingCallback = fn;
    return this;
  };

  public onCanPlay = (fn: LoadingCallback): this => {
    this.onCanPlayCallback = fn;
    return this;
  };

  // 🔹 Controls
  public play = async () => {
    try {
      await this.video.play();
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Video play error:", err);
      }
    }
  };

  public pause = () => {
    this.video.pause();
  };

  public toggle = async () => {
    if (this.video.paused) {
      await this.play();
    } else {
      this.pause();
    }
  };

  public seek = (seconds: number) => {
    this.video.currentTime = seconds;
  };

  public setVolume = (level: number) => {
    this.video.volume = Math.min(1, Math.max(0, level));
  };

  public mute = () => {
    this.video.muted = true;
  };

  public unmute = () => {
    this.video.muted = false;
  };

  public setPlaybackRate = (rate: number) => {
    if (rate <= 0) throw new Error("Invalid playback rate");
    this.video.playbackRate = rate;
  };

  public destroy = () => {
    this.abortController.abort();
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = undefined;
    }
    this.abortController = new AbortController();
    this.video.removeAttribute("src");
    this.video.load();
  };
}

export default VideoPlayerManager;
