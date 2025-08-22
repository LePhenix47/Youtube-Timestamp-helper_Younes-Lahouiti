import VideoPlayerManager from "./video-player.class";

class ThumbnailExtractor {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cache = new Map<number, string>();
  private readonly MAX_CACHE_SIZE = 100;
  private width: number;
  private height: number;
  private interval: number = 10;

  constructor(videoManager: VideoPlayerManager, width = 200, height = 110) {
    this.video = videoManager.video; // Use the actual video element
    this.width = width;
    this.height = height;

    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;

    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create canvas context");
    this.ctx = ctx;
  }

  private roundToInterval = (time: number): number => {
    return Math.floor(time / this.interval) * this.interval;
  };

  public getFrameAt = async (time: number): Promise<string> => {
    const rounded = this.roundToInterval(time);

    // Wait for the video to actually update (small timeout)
    await new Promise((resolve) => setTimeout(resolve, 50));

    this.ctx.drawImage(this.video, 0, 0, this.width, this.height);
    const dataUrl = this.canvas.toDataURL("image/jpeg", 0.5);
    this.addToCache(rounded, dataUrl);

    return dataUrl;
  };

  private addToCache = (time: number, dataUrl: string) => {
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(time, dataUrl);
  };

  public clearCache = () => {
    this.cache.clear();
  };
}

export default ThumbnailExtractor;
