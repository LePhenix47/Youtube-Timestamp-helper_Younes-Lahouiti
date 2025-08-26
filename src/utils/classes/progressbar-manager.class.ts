type ScrubCallbacks = Partial<{
  onScrubStart: (time: number) => void;
  onScrubMove: (time: number) => void;
  onScrubEnd: (time: number) => void;
  onClick: (time: number) => void;
  onHoverEnter: (time: number) => void;
  onHoverMove: (time: number) => void;
  onHoverLeave: () => void;
}>;

// Throttle utility for performance optimization
function throttle<T extends (...args: any[]) => void>(func: T, delay: number): T {
  let timeoutId: number | null = null;
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

class ProgressBarManager {
  private readonly progressContainer: HTMLLIElement;
  private callbacks: ScrubCallbacks = {};

  public isScrubbing: boolean = false;
  private duration: number;
  private readonly abortController = new AbortController();
  private cachedRect: DOMRect | null = null;
  private rectCacheTime = 0;
  private readonly RECT_CACHE_DURATION = 100; // Cache for 100ms
  private throttledHoverMove: ((e: PointerEvent) => void) | null = null;
  private throttledPointerMove: ((e: PointerEvent) => void) | null = null;

  constructor(container: HTMLElement, duration: number) {
    this.progressContainer = container.querySelector<HTMLLIElement>(
      "[data-element=video-progress]"
    )!;
    this.duration = duration;

    this.attachEvents();
  }

  public setCallbacks = (callbacks: ScrubCallbacks): void => {
    this.callbacks = { ...this.callbacks, ...callbacks };
  };

  private attachEvents = (): void => {
    const { signal } = this.abortController;

    // Create throttled versions of frequently called handlers
    this.throttledHoverMove = throttle(this.handleHoverMove, 16); // 60fps
    this.throttledPointerMove = throttle(this.handlePointerMove, 16); // 60fps

    // Hover
    this.progressContainer.addEventListener(
      "pointerenter",
      this.handleHoverEnter,
      { signal }
    );
    this.progressContainer.addEventListener(
      "pointermove",
      this.throttledHoverMove,
      { signal }
    );
    this.progressContainer.addEventListener(
      "pointerleave",
      this.handleHoverLeave,
      { signal }
    );

    // Scrubbing / Clicking
    this.progressContainer.addEventListener(
      "pointerdown",
      this.handlePointerDown,
      { signal }
    );

    document.addEventListener("pointermove", this.throttledPointerMove, {
      signal,
    });

    document.addEventListener("pointerup", this.handlePointerUp, { signal });
  };

  public destroy = (): void => {
    this.abortController.abort();
  };

  // --- Handlers ---

  private handleHoverEnter = (e: PointerEvent): void => {
    const time = this.computeTimeFromClick(e.pageX);
    this.callbacks.onHoverEnter?.(time);
  };

  private handleHoverMove = (e: PointerEvent): void => {
    if (this.isScrubbing) return; // scrubbing overrides hover
    const time = this.computeTimeFromClick(e.pageX);
    this.callbacks.onHoverMove?.(time);
  };

  private handleHoverLeave = (): void => {
    if (this.isScrubbing) return;
    this.callbacks.onHoverLeave?.();
  };

  private handlePointerDown = (e: PointerEvent): void => {
    const target = e.target as HTMLElement;

    // Ignore drag-handle buttons (future trimming/clip editing)
    if (target.closest(".video__progress-drag-slide")) {
      return;
    }

    this.isScrubbing = true;
    const time = this.computeTimeFromClick(e.pageX);
    this.callbacks.onScrubStart?.(time);
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.isScrubbing) return;
    const time = this.computeTimeFromClick(e.pageX);
    this.callbacks.onScrubMove?.(time);
  };

  private handlePointerUp = (e: PointerEvent): void => {
    const target = e.target as HTMLElement | null;

    // * Case 1: scrubbing → always end it, regardless of where pointer is released
    if (this.isScrubbing) {
      this.isScrubbing = false;
      const time = this.computeTimeFromClick(e.pageX);
      this.callbacks.onScrubEnd?.(time);
      return;
    }

    // * Case 2: not scrubbing → only treat as click if inside progress bar
    // ? Ignore drag-handle buttons (future trimming/clip editing)
    if (target.closest(".video__progress-drag-slide")) {
      return;
    }

    if (this.progressContainer.contains(target)) {
      const time = this.computeTimeFromClick(e.pageX);
      this.callbacks.onClick?.(time);
    }
  };

  // --- Helpers ---
  private updateCachedRect = (): void => {
    const now = Date.now();
    if (!this.cachedRect || (now - this.rectCacheTime) > this.RECT_CACHE_DURATION) {
      this.cachedRect = this.progressContainer.getBoundingClientRect();
      this.rectCacheTime = now;
    }
  };

  private computeTimeFromClick = (pageX: number): number => {
    this.updateCachedRect();
    const rect = this.cachedRect!;
    const offsetX = pageX - rect.left;
    const clamped = Math.max(0, Math.min(offsetX, rect.width));
    return (clamped / rect.width) * this.duration;
  };
}

export default ProgressBarManager;
