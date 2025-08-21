import UserPointer, { PointerDragEventMap } from "./user-pointer.class";

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
  private readonly container: HTMLElement;
  private readonly progressContainer: HTMLLIElement;
  private readonly userPointer: UserPointer;
  private callbacks: ScrubCallbacks = {};

  // Scrubbing state
  private isScrubbing: boolean = false;

  // Video duration (needed for mapping offset → time)
  private duration: number = 0;
  private readonly abortController = new AbortController();

  constructor(
    container: HTMLElement,
    duration: number,
    userPointer?: UserPointer
  ) {
    this.container = container;
    this.progressContainer = this.container.querySelector<HTMLLIElement>(
      "[data-element=video-progress]"
    );

    this.duration = duration;
    this.userPointer = userPointer || new UserPointer(container);

    this.attachEvents();
    this.attachGlobalPointerUp();
  }

  public setCallbacks = (callbacks: ScrubCallbacks): void => {
    this.callbacks = { ...this.callbacks, ...callbacks };
  };

  private attachGlobalPointerUp = (): void => {
    document.addEventListener("pointerup", (e: PointerEvent) => {
      if (!this.isScrubbing) {
        return;
      }

      const { pageX, pageY, movementX, movementY } = e;

      this.handleDragEnd({
        detail: { pageX, pageY, movementX, movementY },
      } as CustomEvent<PointerDragEventMap["custom:pointer-drag-end"]>);
    });
  };

  private attachEvents = (): void => {
    this.userPointer.on("custom:pointer-drag-start", this.handleDragStart);
    this.userPointer.on("custom:pointer-drag-move", this.handleDragMove);
    this.userPointer.on("custom:pointer-drag-end", this.handleDragEnd);

    const { signal } = this.abortController;
    this.progressContainer.addEventListener("click", this.handleClick, {
      signal,
    });
    this.progressContainer.addEventListener(
      "pointerenter",
      this.handleHoverEnter,
      {
        signal,
      }
    );

    this.progressContainer.addEventListener(
      "pointermove",
      this.handleHoverMove,
      {
        signal,
      }
    );

    this.progressContainer.addEventListener(
      "pointerleave",
      this.handleHoverLeave,
      {
        signal,
      }
    );
  };

  public destroy = () => {
    this.abortController.abort();

    this.userPointer.destroyAll();
  };

  private handleHoverEnter = (e: PointerEvent): void => {
    const time = this.computeTimeFromClick(e.pageX);

    this.callbacks.onHoverEnter?.(time);
  };

  private handleHoverMove = (e: PointerEvent): void => {
    const time = this.computeTimeFromClick(e.pageX);

    this.callbacks.onHoverMove?.(time);
  };

  private handleHoverLeave = (_e: PointerEvent): void => {
    this.callbacks.onHoverLeave?.();
  };

  private handleClick = (e: PointerEvent): void => {
    if (this.isScrubbing) {
      return;
    }

    const time = this.computeTimeFromClick(e.pageX);

    this.callbacks.onClick?.(time);
  };

  private handleDragStart = (
    e: CustomEvent<PointerDragEventMap["custom:pointer-drag-start"]>
  ): void => {
    this.isScrubbing = true;
  };

  private handleDragMove = (
    e: CustomEvent<PointerDragEventMap["custom:pointer-drag-move"]>
  ): void => {
    const time = this.computeTimeFromOffset(e.detail.pageX);
    this.callbacks.onScrubMove?.(time);
  };

  private handleDragEnd = (
    e: CustomEvent<PointerDragEventMap["custom:pointer-drag-end"]>
  ): void => {
    this.isScrubbing = false;

    const time = this.computeTimeFromOffset(e.detail.pageX);
    this.callbacks.onScrubEnd?.(time);
  };

  private computeTimeFromOffset = (x: number): number => {
    return (x / this.progressContainer.offsetWidth) * this.duration;
  };

  private computeTimeFromClick = (clickX: number): number => {
    const rect: DOMRect = this.progressContainer.getBoundingClientRect();
    const offsetX: number = clickX - rect.left;

    return (offsetX / this.progressContainer.offsetWidth) * this.duration;
  };
}

export default ProgressBarManager;
