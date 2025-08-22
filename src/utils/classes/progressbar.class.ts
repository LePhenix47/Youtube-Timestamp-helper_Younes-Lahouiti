import { formatVideoTimeStamp } from "@utils/helpers/format.utils";
import ProgressBarChunk from "./progressbar-chunk.class";
import ProgressBarManager from "./progressbar-manager.class";
import VideoPlayerManager from "./video-player.class";
import ThumbnailExtractor from "./thumbnail-extractor.class";
import Signal from "./signal.class";
import { Chapter } from "./chapter-sidebar-manager.class";

class ProgressBar {
  private readonly videoManager: VideoPlayerManager;
  private readonly videoContainer: HTMLElement;

  private framePreview: HTMLElement;
  private progressContainer: HTMLLIElement;

  private chunks: ProgressBarChunk[] = [];
  private progressBarManager: ProgressBarManager;

  private wasPaused: boolean;

  private thumbnailExtractor: ThumbnailExtractor;
  private thumbnailUpdateTimeout: number | null = null;

  public readonly signal = new Signal();

  constructor(videoManager: VideoPlayerManager, videoContainer: HTMLElement) {
    this.videoManager = videoManager;
    this.videoContainer = videoContainer;

    this.thumbnailExtractor = new ThumbnailExtractor(
      this.videoManager, // or pass via manager accessor
      200, // preview width
      110 // preview height
    );

    this.signal.on("chapter-added", (chapter: Chapter) =>
      this.addChunk(chapter)
    );
    this.signal.on("chapter-updated", (chapter: Chapter) =>
      this.updateChunk(chapter)
    );
    this.signal.on("chapter-deleted", (chapter: Chapter) =>
      this.removeChunk(chapter)
    );
  }

  private addChunk = (chapter: Chapter) => {
    const chunk = new ProgressBarChunk(chapter.id, chapter.start, chapter.end);
    this.chunks.push(chunk);
    this.progressContainer.querySelector("ul").appendChild(chunk.element);
  };

  private updateChunk = (chapter: Chapter) => {
    const chunk = this.chunks.find((c) => c.id === chapter.id);
    if (!chunk) return;

    chunk.updateStartTime(chapter.start);
    chunk.updateEndTime(chapter.end);
  };

  private removeChunk = (chapter: Chapter) => {
    const index = this.chunks.findIndex((c) => c.id === chapter.id);
    if (index === -1) return;
    const chunk = this.chunks[index];

    chunk.element.remove();
    this.chunks.splice(index, 1);
  };

  public instantiateListeners = () => {
    // Grab container & elements
    this.framePreview = this.videoContainer.querySelector<HTMLElement>(
      "[data-element=video-progress-frame]"
    );

    this.progressContainer = this.videoContainer.querySelector<HTMLLIElement>(
      "[data-element=video-progress]"
    );

    this.progressBarManager = new ProgressBarManager(
      this.videoContainer,
      this.videoManager.duration
    );

    this.progressBarManager.setCallbacks({
      // ? Scrubbing
      onClick: this.onClick,
      onScrubStart: this.onDragStart,
      onScrubMove: this.onDragMove,
      onScrubEnd: this.onDragEnd,

      // ? Hover
      onHoverEnter: this.onHoverEnter,
      onHoverMove: this.onHoverMove,
      onHoverLeave: this.onHoverLeave,
    });
  };

  public destroyListeners = () => {
    this.progressBarManager.destroy();
  };

  // --- Hover handling (optional, can be extended later) ---
  public onHoverEnter = (time: number): void => {
    this.framePreview.classList.add("scrubbing");
  };

  public onHoverMove = (time: number): void => {
    if (this.progressBarManager.isScrubbing) {
      return;
    }

    this.progressContainer.style.setProperty(
      "--_current-video-hover-secs",
      `${time}`
    );
  };

  public onHoverLeave = (): void => {
    this.framePreview.classList.remove("scrubbing");

    this.updateHoverProgress(0);
  };

  public onClick = (time: number): void => {
    this.updateThumbPosition(time);
    this.videoManager.seek(time);
  };

  // --- Dragging thumb (driven by ProgressBarManager) ---
  public onDragStart = (time: number): void => {
    this.updateHoverProgress(0);

    this.wasPaused = this.videoManager.isPaused;
    this.videoManager.pause();

    this.videoManager.seek(time);

    this.updateThumbPosition(time);
    this.updateFramePreview(time);
  };

  public onDragMove = (time: number): void => {
    console.log("drag move");

    this.videoManager.seek(time);
    this.updateThumbPosition(time);

    this.updateFramePreview(time);
  };

  public onDragEnd = (time: number): void => {
    this.videoManager.seek(time);

    this.updateThumbPosition(time);
    this.updateFramePreview(time);

    this.framePreview.classList.remove("scrubbing");

    if (this.wasPaused) {
      return;
    }

    // ? If video was playing before, resume playback
    this.videoManager.play();
  };

  // --- UI updates ---
  public updateHoverProgress = (currentTime: number): void => {
    this.progressContainer.style.setProperty(
      "--_current-video-hover-secs",
      `${currentTime}`
    );
  };

  public updateThumbPosition = (time: number): void => {
    // Store the actual current time (seconds) as CSS var
    this.progressContainer.style.setProperty(
      "--_current-video-progress-secs",
      `${time}`
    );
  };

  public updateFramePreview = async (time: number): Promise<void> => {
    const formatted = formatVideoTimeStamp(time);

    const timestamp = this.framePreview.querySelector<HTMLElement>(
      "[data-element=video-progress-frame-timestamp]"
    );
    timestamp.textContent = formatted;

    const img = this.framePreview.querySelector<HTMLImageElement>(
      "[data-element=video-progress-frame-img]"
    );
    if (!img) return;

    const bg = document.querySelector<HTMLImageElement>(
      "[data-element=video-progress-bg-img]"
    );
    if (!bg) return;

    try {
      const dataUrl = await this.thumbnailExtractor.getFrameAt(time);
      console.log(dataUrl);

      img.src = dataUrl;
      bg.src = dataUrl;
    } catch (err) {
      console.error("Thumbnail extraction failed:", err);
    }
  };

  // --- Chunks (chapters) ---
  public setChunks = (chunks: ProgressBarChunk[]): void => {
    this.chunks = chunks;
  };

  public getChunks = (): ProgressBarChunk[] => {
    return this.chunks;
  };
}

export default ProgressBar;
