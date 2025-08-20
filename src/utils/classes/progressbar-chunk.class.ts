class ProgressBarChunk {
  startTime: number;
  endTime: number;
  element: HTMLElement;

  constructor(element: HTMLElement, startTime: number, endTime: number) {}

  // Update visual progress for this chunk
  updateProgress = (currentTime: number): void => {};

  // Update hover indicator
  updateHover = (hoverTime: number): void => {};

  // Update buffered progress
  updateBuffered = (bufferEnd: number): void => {};
}

export default ProgressBarChunk;
