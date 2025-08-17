import Signal from "@utils/classes/signal.class";

type VideoControlElements = {
  playButton: HTMLElement;
  volumeSlider: HTMLInputElement;
  muteButton?: HTMLElement;
  fullscreenButton?: HTMLElement;
};

/**
 * Binds the given video controls to the specified signal.
 *
 * @param signal - The signal to emit events on.
 * @param elements - The video control elements to bind.
 * @param elements.playButton - The play button element to bind.
 * @param elements.volumeSlider - The volume slider element to bind.
 * @param elements.muteButton - The mute button element (optional).
 * @param elements.fullscreenButton - The fullscreen button element (optional).
 */
export function bindVideoControls(
  signal: Signal,
  elements: VideoControlElements
) {
  const { playButton, volumeSlider, muteButton, fullscreenButton } = elements;

  playButton.addEventListener("click", (e) => {
    e.stopPropagation();

    signal.emit("video-play-toggle");
  });

  const inputPLayButton = playButton.querySelector("input[type=checkbox]");
  inputPLayButton.addEventListener("change", (e) => {
    e.stopPropagation();

    signal.emit("video-play-toggle");
  });

  volumeSlider.addEventListener("input", (e: InputEvent) => {
    signal.emit("video-volume-change", {
      value: volumeSlider.valueAsNumber,
    });
  });

  muteButton?.addEventListener("click", (e) => {
    e.stopPropagation();

    signal.emit("video-mute-toggle", {
      value: volumeSlider.valueAsNumber,
    });
  });

  fullscreenButton?.addEventListener("click", (e) => {
    signal.emit("video-fullscreen-toggle");
  });
}
