import Signal from "./signal.class";

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
    this.attachDragEvents();
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
    this.element.style.setProperty("--_chunk-start-secs", `${this.startTime}`);
    this.element.style.setProperty("--_chunk-end-secs", `${this.endTime}`);
  };

  /** ------------------------
   * DRAG EVENTS
   * ------------------------ */
  private attachDragEvents = () => {
    const { signal } = this.abortController;
    const startHandle = this.element.querySelector<HTMLButtonElement>(
      "[data-element=drag-slide-start]"
    )!;
    const endHandle = this.element.querySelector<HTMLButtonElement>(
      "[data-element=drag-slide-end]"
    )!;

    startHandle.disabled = this.isFirst;
    endHandle.disabled = this.isLast;

    startHandle.addEventListener(
      "pointerdown",
      (e) => this.beginDrag(e, "start"),
      { signal }
    );
    endHandle.addEventListener("pointerdown", (e) => this.beginDrag(e, "end"), {
      signal,
    });
  };

  private beginDrag = (e: PointerEvent, type: "start" | "end") => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const proposedTime = this.computeTimeFromPointer(ev.pageX);
      this.signal.emit("chunk-drag", {
        id: this.id,
        type,
        proposedTime,
      });
    };

    const onUp = (ev: PointerEvent) => {
      (e.target as HTMLElement).releasePointerCapture(ev.pointerId);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);

      const finalTime = this.computeTimeFromPointer(ev.pageX);
      this.signal.emit("chunk-drag-end", { id: this.id, type, finalTime });
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  private computeTimeFromPointer = (pageX: number): number => {
    const rect = this.element.parentElement!.getBoundingClientRect();
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

  public updateHover = (hoverTime: number) => {
    const isHovered = hoverTime >= this.startTime && hoverTime <= this.endTime;
    this.element.classList.toggle("hover-overlap", isHovered);
  };

  public destroy = () => {
    this.abortController.abort();
  };
}

export default ProgressBarChunk;
