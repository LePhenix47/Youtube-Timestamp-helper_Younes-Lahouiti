import UserPointer, { PointerDragEventMap } from "./user-pointer.class";

type ScrubCallbacks = Partial<{
  onScrubStart: (time: number) => void;
  onScrubMove: (time: number) => void;
  onScrubEnd: (time: number) => void;
  onClick: (time: number) => void;
}>;

class ProgressBarManager {
  private readonly container: HTMLElement;
  private readonly userPointer: UserPointer;
  private callbacks: ScrubCallbacks = {};

  // Scrubbing state
  private isScrubbing: boolean = false;
  private wasPlaying: boolean = false;

  // Video duration (needed for mapping offset → time)
  private duration: number = 0;

  constructor(
    container: HTMLElement,
    duration: number,
    userPointer?: UserPointer
  ) {
    this.container = container;
    this.duration = duration;
    this.userPointer = userPointer || new UserPointer(container);

    this.attachEvents();
  }

  public setCallbacks = (callbacks: ScrubCallbacks): void => {
    this.callbacks = { ...this.callbacks, ...callbacks };
  };

  private attachEvents = (): void => {
    this.userPointer.on("custom:pointer-drag-click", this.handleClick);
    this.userPointer.on("custom:pointer-drag-start", this.handleDragStart);
    this.userPointer.on("custom:pointer-drag-move", this.handleDragMove);
    this.userPointer.on("custom:pointer-drag-end", this.handleDragEnd);
  };

  private handleClick = (
    e: CustomEvent<PointerDragEventMap["custom:pointer-drag-click"]>
  ): void => {
    const time = this.computeTimeFromClick(
      this.userPointer.lastRecordedPositions.containerX
    );

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
    if (!this.isScrubbing) return;

    const time = this.computeTimeFromOffset(e.detail.adjustedX);
    this.callbacks.onScrubMove?.(time);
  };

  private handleDragEnd = (
    e: CustomEvent<PointerDragEventMap["custom:pointer-drag-end"]>
  ): void => {
    this.isScrubbing = false;
    this.callbacks.onScrubEnd?.(this.computeTimeFromOffset(e.detail.pageX));
  };

  private computeTimeFromOffset = (x: number): number => {
    return (x / this.container.offsetWidth) * this.duration;
  };

  private computeTimeFromClick = (clickX: number): number => {
    const rect = this.container.getBoundingClientRect();
    const offsetX = clickX - rect.left;
    return (offsetX / this.container.offsetWidth) * this.duration;
  };
}

export default ProgressBarManager;
