import { formatVideoTimeStamp } from "@utils/helpers/format.utils";
import ProgressBarChunk from "./progressbar-chunk.class";
import ProgressBarManager from "./progressbar-manager.class";
import VideoPlayerManager from "./video-player.class";
import ThumbnailExtractor from "./thumbnail-extractor.class";
import Signal from "./signal.class";
import ChapterSideBarManager, {
  Chapter,
} from "./chapter-sidebar-manager.class";

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

    this.signal.on(
      "chapter-added",
      ({ chapter, chapters }: { chapter: Chapter; chapters: Chapter[] }) => {
        // Addition can shift others → rebuild from source of truth
        this.syncChunks(chapters);
      }
    );

    this.signal.on("chapter-updated", ({ chapter }: { chapter: Chapter }) => {
      // Only the changed chapter is provided → patch that one
      this.updateChunk(chapter);
    });

    this.signal.on(
      "chapter-deleted",
      ({ id, chapters }: { id: string; chapters: Chapter[] }) => {
        // Deletion reflows neighbors → rebuild from list
        this.syncChunks(chapters);
      }
    );
  }

  private handleChunkDrag = (
    id: string,
    type: "start" | "end",
    time: number
  ) => {
    const chunkIndex = this.chunks.findIndex((c) => c.id === id);
    if (chunkIndex === -1) return;

    const currentChunk = this.chunks[chunkIndex];
    const previousChunk = this.chunks[chunkIndex - 1];
    const nextChunk = this.chunks[chunkIndex + 1];
    const minLength = ChapterSideBarManager.CHAPTER_MIN_LENGTH;

    let clampedTime = this.calculateClampedTime(
      time,
      type,
      chunkIndex,
      currentChunk,
      previousChunk,
      nextChunk,
      minLength
    );

    clampedTime = Math.floor(clampedTime);

    this.updateChunkBoundaries(
      type,
      currentChunk,
      previousChunk,
      nextChunk,
      clampedTime
    );

    this.signal.emit("chunk-chapters-updated", {
      chapters: this.chunks.map((c) => ({
        id: c.id,
        start: c.startTime,
        end: c.endTime,
      })),
    });
  };

  private calculateClampedTime = (
    time: number,
    type: "start" | "end",
    chunkIndex: number,
    currentChunk: ProgressBarChunk | null,
    previousChunk: ProgressBarChunk | null,
    nextChunk: ProgressBarChunk | null,
    minLength: number
  ): number => {
    // Force boundary chunks to stay at video edges
    if (type === "start" && chunkIndex === 0) return 0;
    if (type === "end" && chunkIndex === this.chunks.length - 1) {
      return this.videoManager.duration;
    }

    if (type === "start") {
      const earliestStart = previousChunk
        ? previousChunk.startTime + minLength
        : 0;
      const latestStart = currentChunk.endTime - minLength;
      return Math.max(earliestStart, Math.min(time, latestStart));
    } else {
      const earliestEnd = currentChunk.startTime + minLength;
      const latestEnd = nextChunk
        ? nextChunk.endTime - minLength
        : this.videoManager.duration;
      return Math.max(earliestEnd, Math.min(time, latestEnd));
    }
  };

  private updateChunkBoundaries = (
    type: "start" | "end",
    currentChunk: ProgressBarChunk | null,
    previousChunk: ProgressBarChunk | null,
    nextChunk: ProgressBarChunk | null,
    clampedTime: number
  ): void => {
    if (type === "start") {
      currentChunk.updateStartTime(clampedTime);
      if (previousChunk) previousChunk.updateEndTime(clampedTime);
    } else {
      currentChunk.updateEndTime(clampedTime);
      if (nextChunk) nextChunk.updateStartTime(clampedTime);
    }
  };

  private syncChunks = (chapters: Chapter[]) => {
    this.chunks.forEach((c) => c.element.remove());
    this.chunks = [];

    const list = this.videoContainer.querySelector<HTMLUListElement>(
      '[data-element="video-progress-chunk-list"]'
    );
    if (!list) return;

    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      const isFirst = i === 0;
      const isLast = i === chapters.length - 1;
      const chunk = new ProgressBarChunk(
        chapter.id,
        chapter.start,
        chapter.end,
        this.videoManager.duration,
        isFirst,
        isLast
      );

      // attach drag signals
      chunk.signal.on<{
        id: string;
        type: "start" | "end";
        proposedTime: number;
      }>("chunk-drag", ({ id, type, proposedTime }) => {
        this.handleChunkDrag(id, type, proposedTime);
      });

      this.chunks.push(chunk);
      list.appendChild(chunk.element);
    }
  };

  private updateChunk = (chapter: Chapter) => {
    const chunk = this.chunks.find((c) => c.id === chapter.id);
    if (!chunk) return;
    chunk.updateStartTime(chapter.start);
    chunk.updateEndTime(chapter.end);
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
