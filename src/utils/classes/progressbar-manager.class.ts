type ScrubCallbacks = Partial<{
  onScrubStart: (time: number) => void;
  onScrubMove: (time: number) => void;
  onScrubEnd: (time: number) => void;
  onClick: (time: number) => void;
  onHoverEnter: (time: number) => void;
  onHoverMove: (time: number) => void;
  onHoverLeave: () => void;
}>;

class ProgressBarManager {
  private readonly progressContainer: HTMLLIElement;
  private callbacks: ScrubCallbacks = {};

  public isScrubbing: boolean = false;
  private duration: number;
  private readonly abortController = new AbortController();

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

    // Hover
    this.progressContainer.addEventListener(
      "pointerenter",
      this.handleHoverEnter,
      { signal }
    );
    this.progressContainer.addEventListener(
      "pointermove",
      this.handleHoverMove,
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

    document.addEventListener("pointermove", this.handlePointerMove, {
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
    if (this.progressContainer.contains(target)) {
      const time = this.computeTimeFromClick(e.pageX);
      this.callbacks.onClick?.(time);
    }
  };

  // --- Helpers ---
  private computeTimeFromClick = (pageX: number): number => {
    const rect = this.progressContainer.getBoundingClientRect();
    const offsetX = pageX - rect.left;
    const clamped = Math.max(0, Math.min(offsetX, rect.width));
    return (clamped / rect.width) * this.duration;
  };
}

export default ProgressBarManager;
