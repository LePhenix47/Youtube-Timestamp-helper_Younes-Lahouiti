class ProgressBarChunk {
  private startTime: number;
  private endTime: number;
  private element: HTMLLIElement;
  private template: HTMLTemplateElement;

  constructor(startTime: number, endTime: number) {
    this.startTime = startTime;
    this.endTime = endTime;

    this.initializeTemplate();
    this.element = this.chunkClone; // Assign the cloned element
    this.updateChunkDOM(); // Safe to call now
  }

  private initializeTemplate = () => {
    this.template = document.createElement("template");

    this.template.innerHTML = /*html*/ `
      <li class="video__progress-bar-chunk" style="--_chunk-start-secs: 0; --_chunk-end-secs: 0;">
        <button class="video__progress-drag-slide video__progress-drag-slide--start" disabled></button>
        <button class="video__progress-drag-slide video__progress-drag-slide--end" disabled></button>
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

  public updateStartTime = (time: number): void => {
    this.startTime = time;
    this.updateChunkDOM();
  };

  public updateEndTime = (time: number): void => {
    this.endTime = time;
    this.updateChunkDOM();
  };

  public updateHover = (hoverTime: number): void => {
    const hoverTimeIsWithinChunk: boolean =
      hoverTime >= this.startTime && hoverTime <= this.endTime;

    this.element.classList.toggle("hover-overlap", hoverTimeIsWithinChunk);
  };
}

export default ProgressBarChunk;
