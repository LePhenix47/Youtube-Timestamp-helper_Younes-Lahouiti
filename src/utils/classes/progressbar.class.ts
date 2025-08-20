import ProgressBarChunk from "./progressbar-chunk.class";

class ProgressBar {
  videoElement: HTMLVideoElement;
  controlsMenu: HTMLElement;
  thumb: HTMLElement;
  framePreview: HTMLElement;
  chunks: ProgressBarChunk[];

  constructor(videoElement: HTMLVideoElement, controlsMenu: HTMLElement) {}

  // Handle hover entering the progress bar
  onHoverEnter = (event: MouseEvent): void => {};

  // Handle hover leaving the progress bar
  onHoverLeave = (event: MouseEvent): void => {};

  // Handle drag start on thumb
  onDragStart = (event: MouseEvent | TouchEvent): void => {};

  // Handle dragging the thumb
  onDragMove = (event: MouseEvent | TouchEvent): void => {};

  // Handle drag end on thumb
  onDragEnd = (event: MouseEvent | TouchEvent): void => {};

  // Update the thumb position visually
  updateThumbPosition = (time: number): void => {};

  // Update frame preview and timestamp
  updateFramePreview = (time: number): void => {};
}

export default ProgressBar;
