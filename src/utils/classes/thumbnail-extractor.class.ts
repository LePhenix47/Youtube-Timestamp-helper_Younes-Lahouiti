/*
Note: Youtube extracts thumbnails at specific intervals (e.g., every 10 seconds) using FFMPEG generating images every 10 seconds on the Backend.

But since here we are working with a video element in the browser, we need to manually extract frames at the desired intervals.
*/

class ThumbnailExtractor {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cache = new Map<number, string>();
  private readonly MAX_CACHE_SIZE = 100; // prevent memory blowups
  private videoUrl: string;
  private width: number;
  private height: number;
  private interval: number = 10;

  constructor(videoUrl: string, width: number = 200, height: number = 110) {
    this.videoUrl = videoUrl;

    this.width = width;
    this.height = height;

    this.initializeVideo();
    this.initializeCanvas();
  }

  private initializeVideo = () => {
    this.video = document.createElement("video");
    this.video.crossOrigin = "anonymous";
    this.video.preload = "auto";
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.src = this.videoUrl;
  };

  private initializeCanvas = () => {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create canvas context");
    this.ctx = ctx;
  };

  public setIntervalValue = (interval: number) => {
    this.interval = interval;
  };

  /** Extract thumbnail at given time (rounded to seconds for caching) */
  public getFrameAt = async (time: number): Promise<string> => {
    const rounded: number = this.roundToInterval(time);

    if (this.cache.has(rounded)) {
      return this.cache.get(rounded)!;
    }

    await this.seekTo(rounded);
    this.ctx.drawImage(this.video, 0, 0, this.width, this.height);

    const dataUrl: string = this.canvas.toDataURL("image/jpeg", 0.4);
    this.addToCache(rounded, dataUrl);

    return dataUrl;
  };

  private roundToInterval = (time: number): number => {
    return Math.floor(time / this.interval) * this.interval;
  };

  /** Warm up cache at regular intervals */
  public warmCache = async (): Promise<void> => {
    await this.whenMetadataReady();
    const duration = this.video.duration;
    for (let t = 0; t < duration; t += this.interval) {
      try {
        await this.getFrameAt(t); // serial to avoid race
      } catch (err) {
        console.warn("Warm cache failed at", t, err);
      }
    }
  };

  public destroy = (): void => {
    this.clearCache();
    this.video.src = "";
    this.video.load();
  };

  /** Clears cached thumbnails */
  public clearCache = (): void => {
    this.cache.clear();
  };

  private addToCache = (time: number, dataUrl: string): void => {
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      // simple FIFO eviction (could replace w/ LRU)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(time, dataUrl);
  };

  private seekTo = (time: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Seek timeout")), 5000);

      const onSeeked = () => {
        clearTimeout(timeout);
        this.video.removeEventListener("seeked", onSeeked);
        this.video.removeEventListener("error", onError);
        resolve();
      };

      const onError = () => {
        clearTimeout(timeout);
        this.video.removeEventListener("seeked", onSeeked);
        reject(new Error("Video error during seek"));
      };

      this.video.addEventListener("seeked", onSeeked, { once: true });
      this.video.addEventListener("error", onError, { once: true });

      this.video.currentTime = time;
    });
  };

  private whenMetadataReady = (): Promise<void> => {
    if (this.video.readyState >= 1) return Promise.resolve();
    return new Promise((resolve) =>
      this.video.addEventListener("loadedmetadata", () => resolve(), {
        once: true,
      })
    );
  };
}

export default ThumbnailExtractor;
