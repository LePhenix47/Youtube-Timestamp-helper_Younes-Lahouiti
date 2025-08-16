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

  playButton.addEventListener("click", () =>
    signal.emit("video-play-toggle", { element: playButton })
  );

  volumeSlider.addEventListener("input", (e: InputEvent) => {
    const input = e.target as HTMLInputElement;

    signal.emit("video-volume-change", {
      value: input.valueAsNumber,
      element: volumeSlider,
    });
  });

  muteButton?.addEventListener("click", () =>
    signal.emit("video-mute-toggle", { element: muteButton })
  );

  fullscreenButton?.addEventListener("click", () =>
    signal.emit("video-fullscreen-toggle", { element: fullscreenButton })
  );
}
