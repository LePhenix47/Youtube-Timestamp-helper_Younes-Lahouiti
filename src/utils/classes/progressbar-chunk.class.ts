import Signal from "./signal.class";

// Throttle utility for performance optimization
function throttle<T extends (...args: any[]) => void>(func: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastExecTime = 0;
  return ((...args: any[]) => {
    const currentTime = Date.now();
    if (currentTime - lastExecTime > delay) {
      func(...args);
      lastExecTime = currentTime;
    } else {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func(...args);
        lastExecTime = Date.now();
        timeoutId = null;
      }, delay - (currentTime - lastExecTime));
    }
  }) as T;
}

class ProgressBarChunk {
  public element: HTMLLIElement;
  public readonly signal = new Signal();
  public readonly id: string;

  public startTime: number;
  public endTime: number;
  private template: HTMLTemplateElement;
  private readonly abortController = new AbortController();
  private videoDuration: number;
  private isFirst: boolean;
  private isLast: boolean;
  private cachedRect: DOMRect | null = null;
  private rectCacheTime = 0;
  private readonly RECT_CACHE_DURATION = 100; // Cache for 100ms
  private isDragging = false;
  private animationFrameId: number | null = null;
  private isStartLocked = false;
  private isEndLocked = false;

  constructor(
    id: string,
    startTime: number,
    endTime: number,
    videoDuration: number,
    isFirst: boolean,
    isLast: boolean
  ) {
    this.id = id;
    this.startTime = startTime;
    this.endTime = endTime;
    this.videoDuration = videoDuration; // new
    this.isFirst = isFirst; // new
    this.isLast = isLast; // new

    this.initializeTemplate();
    this.element = this.chunkClone;
    this.setupDragHandles();
    this.updateChunkDOM();
  }

  get duration(): number {
    return this.endTime - this.startTime;
  }

  /** ------------------------
   * TEMPLATE / DOM
   * ------------------------ */
  private initializeTemplate = () => {
    this.template = document.createElement("template");
    this.template.innerHTML = /*html*/ `
      <li class="video__progress-bar-chunk" style="--_chunk-start-secs: 0; --_chunk-end-secs: 0;">
        <button class="video__progress-drag-slide video__progress-drag-slide--start" data-element="drag-slide-start"></button>
        <button class="video__progress-drag-slide video__progress-drag-slide--end" data-element="drag-slide-end"></button>
        <div class="video__progress-chunk-progress"></div>
        <div class="video__progress-chunk-progress video__progress-chunk-progress--hover-progress"></div>
        <div class="video__progress-chunk-progress video__progress-chunk-progress--buffer-progress"></div>
      </li>
    `;
  };

  get chunkClone(): HTMLLIElement {
    return this.template.content.firstElementChild!.cloneNode(
      true
    ) as HTMLLIElement;
  }

  private updateChunkDOM = () => {
    // During drag operations, batch DOM updates using requestAnimationFrame
    if (this.isDragging) {
      if (this.animationFrameId) return; // Already scheduled
      
      this.animationFrameId = requestAnimationFrame(() => {
        this.element.style.setProperty("--_chunk-start-secs", `${this.startTime}`);
        this.element.style.setProperty("--_chunk-end-secs", `${this.endTime}`);
        this.animationFrameId = null;
      });
    } else {
      // Immediate update when not dragging
      this.element.style.setProperty("--_chunk-start-secs", `${this.startTime}`);
      this.element.style.setProperty("--_chunk-end-secs", `${this.endTime}`);
    }
  };

  /** ------------------------
   * DRAG SETUP (no individual listeners - using event delegation)
   * ------------------------ */
  private setupDragHandles = () => {
    const startHandle = this.element.querySelector<HTMLButtonElement>(
      "[data-element=drag-slide-start]"
    )!;
    const endHandle = this.element.querySelector<HTMLButtonElement>(
      "[data-element=drag-slide-end]"
    )!;

    // Set disabled state and data attributes for event delegation
    this.updateDragHandleStates();
    
    // Add data attributes to identify chunk and handle type
    startHandle.dataset.chunkId = this.id;
    startHandle.dataset.dragType = "start";
    endHandle.dataset.chunkId = this.id;
    endHandle.dataset.dragType = "end";
  };

  private updateDragHandleStates = () => {
    const startHandle = this.element.querySelector<HTMLButtonElement>(
      "[data-element=drag-slide-start]"
    )!;
    const endHandle = this.element.querySelector<HTMLButtonElement>(
      "[data-element=drag-slide-end]"
    )!;

    // Default disabled state based on position
    startHandle.disabled = this.isFirst || this.isStartLocked;
    endHandle.disabled = this.isLast || this.isEndLocked;
  };

  // Public methods to update lock states
  public setStartLocked = (locked: boolean): void => {
    this.isStartLocked = locked;
    this.updateDragHandleStates();
  };

  public setEndLocked = (locked: boolean): void => {
    this.isEndLocked = locked;
    this.updateDragHandleStates();
  };

  public beginDrag = (e: PointerEvent, type: "start" | "end") => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    // Set dragging state to enable batched DOM updates
    this.isDragging = true;

    // Cache the rect at the start of drag to avoid repeated getBoundingClientRect calls
    this.updateCachedRect();

    // Throttle the drag events to 60fps (16ms)
    const throttledOnMove = throttle((ev: PointerEvent) => {
      const proposedTime = this.computeTimeFromPointer(ev.pageX);
      this.signal.emit("chunk-drag", {
        id: this.id,
        type,
        proposedTime,
      });
    }, 16);

    const onUp = (ev: PointerEvent) => {
      (e.target as HTMLElement).releasePointerCapture(ev.pointerId);
      document.removeEventListener("pointermove", throttledOnMove);
      document.removeEventListener("pointerup", onUp);

      // End dragging state
      this.isDragging = false;
      
      // Final position update
      const finalTime = this.computeTimeFromPointer(ev.pageX);
      this.signal.emit("chunk-drag-end", { id: this.id, type, finalTime });
      
      // Clear the cached rect after drag ends
      this.cachedRect = null;
      
      // Force immediate DOM update after drag
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      this.updateChunkDOM();
    };

    document.addEventListener("pointermove", throttledOnMove);
    document.addEventListener("pointerup", onUp);
  };

  private updateCachedRect = (): void => {
    const now = Date.now();
    if (!this.cachedRect || (now - this.rectCacheTime) > this.RECT_CACHE_DURATION) {
      this.cachedRect = this.element.parentElement!.getBoundingClientRect();
      this.rectCacheTime = now;
    }
  };

  private computeTimeFromPointer = (pageX: number): number => {
    // Use cached rect if available, otherwise get fresh rect
    let rect = this.cachedRect;
    if (!rect) {
      this.updateCachedRect();
      rect = this.cachedRect!;
    }
    
    const offsetX = pageX - rect.left;
    const clamped = Math.max(0, Math.min(offsetX, rect.width));
    return (clamped / rect.width) * this.videoDuration;
  };

  /** ------------------------
   * UPDATE METHODS (called by ProgressBar)
   * ------------------------ */
  public updateStartTime = (time: number) => {
    this.startTime = time;
    this.updateChunkDOM();
  };

  public updateEndTime = (time: number) => {
    this.endTime = time;
    this.updateChunkDOM();
  };

  public setDragState = (isDragging: boolean) => {
    this.isDragging = isDragging;
    // Force immediate update when drag ends
    if (!isDragging && this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      this.updateChunkDOM();
    }
  };

  private lastHoverState: boolean | null = null;

  public updateHover = (hoverTime: number) => {
    const isHovered = hoverTime >= this.startTime && hoverTime <= this.endTime;
    
    // Only update DOM if hover state actually changed
    if (this.lastHoverState !== isHovered) {
      this.element.classList.toggle("hover-overlap", isHovered);
      this.lastHoverState = isHovered;
    }
  };

  public destroy = () => {
    // No longer need to abort individual listeners since we use event delegation
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  };
}

export default ProgressBarChunk;
