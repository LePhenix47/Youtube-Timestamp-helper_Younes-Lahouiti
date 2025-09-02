import Signal from "./signal.class";
import VideoPlayerManager from "./video-player.class";

type CarouselSection = "main" | "speed";

interface CarouselElements {
  carousel: HTMLDivElement;
  mainSection: HTMLUListElement;
  speedSection: HTMLFormElement;
  speedButton: HTMLLIElement;
  popover: HTMLMenuElement;
}

interface SpeedControls {
  display: HTMLSpanElement;
  minusButton: HTMLButtonElement;
  plusButton: HTMLButtonElement;
  rangeSlider: HTMLInputElement;
  presetInputs: NodeListOf<HTMLInputElement>;
}

class VideoSettingsCarousel {
  private elements: CarouselElements;
  private speedControls: SpeedControls | null = null;
  private currentSection: CarouselSection = "main";
  private currentSpeed: number = 1.0;
  public signal: Signal;
  private videoManager: VideoPlayerManager | null = null;
  private isHoveringSpeedSlider: boolean = false;

  // Speed control constants
  private static readonly MIN_SPEED = 0.25;
  private static readonly MAX_SPEED = 2.0;
  private static readonly SPEED_RANGE =
    VideoSettingsCarousel.MAX_SPEED - VideoSettingsCarousel.MIN_SPEED; // 1.75
  private static readonly SLIDER_MIN = 0;
  private static readonly SLIDER_MAX = 100;
  private static readonly SCROLL_SPEED_DELTA = 0.01;

  constructor(
    carousel: HTMLDivElement,
    mainSection: HTMLUListElement,
    speedSection: HTMLFormElement,
    speedButton: HTMLLIElement,
    videoManager?: VideoPlayerManager
  ) {
    const popover = carousel.closest("[popover]") as HTMLMenuElement;

    this.elements = {
      carousel,
      mainSection,
      speedSection,
      speedButton,
      popover,
    };

    this.videoManager = videoManager || null;
    this.signal = new Signal();
    this.initSpeedControls();
    this.init();
  }

  private init = (): void => {
    this.setupEventListeners();
    this.setupSpeedControlListeners();
    this.setInitialState();
  };

  private initSpeedControls = (): void => {
    const display = this.elements.speedSection.querySelector<HTMLSpanElement>(
      "[data-element=speed-current-display]"
    );
    const minusButton =
      this.elements.speedSection.querySelector<HTMLButtonElement>(
        "[data-element=speed-minus]"
      );
    const plusButton =
      this.elements.speedSection.querySelector<HTMLButtonElement>(
        "[data-element=speed-plus]"
      );
    const rangeSlider =
      this.elements.speedSection.querySelector<HTMLInputElement>(
        "[data-element=speed-range-slider]"
      );
    const presetInputs =
      this.elements.speedSection.querySelectorAll<HTMLInputElement>(
        'input[name="speed-preset"]'
      );

    if (
      display &&
      minusButton &&
      plusButton &&
      rangeSlider &&
      presetInputs.length > 0
    ) {
      this.speedControls = {
        display,
        minusButton,
        plusButton,
        rangeSlider,
        presetInputs,
      };
    }
  };

  private setupSpeedControlListeners = (): void => {
    if (!this.speedControls) return;

    // Minus button - decrease by 0.05
    this.speedControls.minusButton.addEventListener("click", () => {
      this.adjustSpeed(-0.05);
    });

    // Plus button - increase by 0.05
    this.speedControls.plusButton.addEventListener("click", () => {
      this.adjustSpeed(0.05);
    });

    // Range slider - use flag to prevent infinite loop
    this.speedControls.rangeSlider.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      const sliderValue = Number(target.value);
      const speed = this.convertSliderToSpeed(sliderValue);
      this.setSpeedFromSlider(speed);
    });

    // Preset radio buttons
    for (let i = 0; i < this.speedControls.presetInputs.length; i++) {
      const input = this.speedControls.presetInputs[i];
      input.addEventListener("change", () => {
        if (!input.checked) return;

        const speed = Number(input.value) / 100;
        this.setSpeed(speed);
      });
    }

    // Track hover state for scroll wheel functionality
    this.speedControls.rangeSlider.addEventListener("mouseenter", () => {
      this.isHoveringSpeedSlider = true;
    });

    this.speedControls.rangeSlider.addEventListener("mouseleave", () => {
      this.isHoveringSpeedSlider = false;
    });

    // Scroll wheel support on desktop - adjust speed per scroll (only when hovering)
    this.speedControls.rangeSlider.addEventListener("wheel", (e) => {
      if (!this.isHoveringSpeedSlider) return;
      
      e.preventDefault(); // Prevent page scrolling

      // Normalize wheel direction and apply speed delta
      const { SCROLL_SPEED_DELTA } = VideoSettingsCarousel;
      const scrollDirection = Math.sign(e.deltaY); // -1 for up, 1 for down, 0 for no movement
      const delta = -scrollDirection * SCROLL_SPEED_DELTA; // Invert: scroll up = increase speed
      
      this.adjustSpeed(delta);
    }, { passive: false });
  };

  private setupEventListeners = (): void => {
    // Speed button click handler
    this.elements.speedButton.addEventListener("click", () => {
      this.navigateToSection("speed");
    });

    // Back button click handler
    const backButton =
      this.elements.speedSection.querySelector<HTMLButtonElement>(
        "[data-element=speed-back-button]"
      );
    backButton?.addEventListener("click", () => {
      this.navigateToSection("main");
    });

    // Popover dismiss handler - reset to main section
    this.elements.popover?.addEventListener("toggle", (event) => {
      const toggleEvent = event as ToggleEvent;
      if (toggleEvent.newState === "closed") {
        this.resetToMain();
      }
    });

    // Listen for back navigation
    this.signal.on("navigate-back", () => {
      this.navigateToSection("main");
    });

    // Auto replay toggle handler
    const autoReplayToggle = document.querySelector<HTMLInputElement>(
      "[data-element=auto-replay-toggle]"
    );
    autoReplayToggle?.addEventListener("change", this.handleAutoReplayToggle);

    // Hide controls toggle handler
    const hideControlsToggle = document.querySelector<HTMLInputElement>(
      "[data-element=hide-controls-toggle]"
    );
    hideControlsToggle?.addEventListener("change", this.handleHideControlsToggle);
  };

  private setInitialState = (): void => {
    // Set initial height
    this.updateCarouselHeight();
    
    // Update speed display in main section
    this.updateMainSpeedDisplay();
  };

  private updateMainSpeedDisplay = (): void => {
    const mainSpeedDisplay = this.elements.mainSection.querySelector<HTMLSpanElement>(
      "[data-element=speed-display]"
    );
    if (!mainSpeedDisplay) return;
    
    // Show speed as "Normal" for 1x, otherwise show actual value
    mainSpeedDisplay.textContent = this.currentSpeed === 1.0 ? "Normal" : `${this.currentSpeed.toFixed(2)}x`;
  };

  public navigateToSection = (section: CarouselSection): void => {
    if (this.currentSection === section) return;

    const previousSection = this.currentSection;
    this.currentSection = section;

    // Update section visibility using CSS classes
    this.updateSectionVisibility();

    // Update carousel height
    this.updateCarouselHeight();

    // Emit navigation event
    this.signal.emit("section-changed", {
      from: previousSection,
      to: section,
    });
  };

  private updateSectionVisibility = (): void => {
    // Remove active class from all sections
    this.elements.mainSection.classList.remove("video-settings-section--active");
    this.elements.speedSection.classList.remove("video-settings-section--active");
    
    // Add active class to current section
    const activeSection = this.getSectionElement(this.currentSection);
    activeSection.classList.add("video-settings-section--active");
  };

  private resetToMain = (): void => {
    this.currentSection = "main";
    this.updateSectionVisibility();
    this.updateCarouselHeight();
  };

  private getSectionElement = (
    section: CarouselSection
  ): HTMLUListElement | HTMLFormElement => {
    return section === "main"
      ? this.elements.mainSection
      : this.elements.speedSection;
  };

  // FIXME: Expensive DOM cloning on every section switch
  // Current: Creates full DOM clone, appends to body, measures, removes
  // Better: Pre-calculate section heights on init, or use ResizeObserver
  private updateCarouselHeight = (): void => {
    const activeSection = this.getSectionElement(this.currentSection);

    // Use existing cloning pattern from codebase
    const template = document.createElement("template");
    template.innerHTML = activeSection.outerHTML;

    const clone = template.content.firstElementChild!.cloneNode(
      true
    ) as HTMLUListElement;

    // Style clone for accurate measurement following existing pattern
    clone.style.position = "absolute";
    clone.style.visibility = "hidden";
    clone.style.translate = "0 0";
    clone.style.width = `${activeSection.offsetWidth || 320}px`;

    document.body.appendChild(clone);
    const height = clone.offsetHeight;
    document.body.removeChild(clone);

    // Use local CSS variable convention: --_
    this.elements.carousel.style.setProperty(
      "--_carousel-height",
      `${height}px`
    );

    console.log(
      `Carousel height set to: ${height}px for section: ${this.currentSection}`
    );
  };

  private adjustSpeed = (delta: number): void => {
    const { MIN_SPEED, MAX_SPEED, SLIDER_MAX } = VideoSettingsCarousel;
    const newSpeed = Math.max(
      MIN_SPEED,
      Math.min(MAX_SPEED, this.currentSpeed + delta)
    );

    this.setSpeed(newSpeed);
  };

  private convertSliderToSpeed = (sliderValue: number): number => {
    const { MIN_SPEED, SPEED_RANGE, SLIDER_MAX } = VideoSettingsCarousel;
    // Convert slider range (0-100) to speed range (0.25-2.0)
    const normalizedValue = sliderValue / SLIDER_MAX; // 0-1
    return MIN_SPEED + normalizedValue * SPEED_RANGE;
  };

  private convertSpeedToSlider = (speed: number): number => {
    // Convert speed range (0.25-2.0) to slider range (0-100)
    const { MIN_SPEED, SPEED_RANGE, SLIDER_MAX } = VideoSettingsCarousel;
    const normalizedSpeed: number = (speed - MIN_SPEED) / SPEED_RANGE;

    return normalizedSpeed * SLIDER_MAX;
  };

  private setSpeed = (speed: number): void => {
    const { MIN_SPEED, MAX_SPEED } = VideoSettingsCarousel;
    // Clamp speed between min and max
    this.currentSpeed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed));

    // Update video playback rate
    if (!this.videoManager) return;
    this.videoManager.setPlaybackRate(this.currentSpeed);

    // Update UI
    this.updateSpeedDisplay();
    this.updateMainSpeedDisplay();
    this.updateRangeSlider();
    this.updatePresetSelection();

    // Emit speed change event
    this.signal.emit("speed-changed", { speed: this.currentSpeed });
  };

  private setSpeedFromSlider = (speed: number): void => {
    const { MIN_SPEED, MAX_SPEED } = VideoSettingsCarousel;
    // Clamp speed between min and max
    this.currentSpeed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed));

    // Update video playback rate
    if (!this.videoManager) return;
    this.videoManager.setPlaybackRate(this.currentSpeed);

    // Update UI (but NOT the range slider to prevent infinite loop)
    this.updateSpeedDisplay();
    this.updateMainSpeedDisplay();
    this.updatePresetSelection();

    // Emit speed change event
    this.signal.emit("speed-changed", { speed: this.currentSpeed });
  };

  private updateSpeedDisplay = (): void => {
    if (!this.speedControls) return;
    this.speedControls.display.textContent = `${this.currentSpeed.toFixed(2)}x`;
  };

  private updateRangeSlider = (): void => {
    if (!this.speedControls) return;

    const sliderValue = this.convertSpeedToSlider(this.currentSpeed);
    this.speedControls.rangeSlider.value = sliderValue.toString();

    // Update CSS custom property directly without triggering events
    this.speedControls.rangeSlider.style.setProperty(
      "--_slider-progress",
      `${sliderValue}%`
    );

    // Fix for Chromium: Update --_webkit-progression-width for overflowing-thumb style
    if (this.speedControls.rangeSlider.dataset.rangeStyle === "overflowing-thumb") {
      const { min, max, valueAsNumber } = this.speedControls.rangeSlider;
      const percentage = Math.floor((valueAsNumber / Number(max)) * 100);
      this.speedControls.rangeSlider.style.setProperty(
        "--_webkit-progression-width", 
        `${percentage}%`
      );
    }
  };

  private updatePresetSelection = (): void => {
    if (!this.speedControls) return;

    // Find closest preset value
    const presetValue = Math.round(this.currentSpeed * 100);

    for (let i = 0; i < this.speedControls.presetInputs.length; i++) {
      const input = this.speedControls.presetInputs[i];
      const inputValue = Number(input.value);
      input.checked = inputValue === presetValue;
    }
  };

  // Toggle handler methods
  private handleAutoReplayToggle = (e: Event): void => {
    const checkbox = e.target as HTMLInputElement;
    const isEnabled = checkbox.checked;
    
    if (!this.videoManager) return;
    
    if (isEnabled) {
      // Set auto replay callback on video end
      this.videoManager.onEnded(this.handleVideoEnded);
    } else {
      // Remove auto replay callback
      this.videoManager.onEnded(() => {});
    }
    
    // Emit event for other components
    this.signal.emit("auto-replay-changed", { enabled: isEnabled });
  };

  private handleHideControlsToggle = (e: Event): void => {
    const checkbox = e.target as HTMLInputElement;
    const isEnabled = checkbox.checked;
    
    // Find the video container
    const videoContainer = document.querySelector<HTMLElement>(".video__container");
    if (!videoContainer) return;
    
    if (isEnabled) {
      // Add CSS class to enable hide-on-play behavior
      videoContainer.classList.add("hide-controls-on-play");
    } else {
      // Remove CSS class to disable hide-on-play behavior
      videoContainer.classList.remove("hide-controls-on-play");
    }
    
    // Emit event for other components
    this.signal.emit("hide-controls-changed", { enabled: isEnabled });
  };

  private handleVideoEnded = (): void => {
    // Auto replay functionality - restart the video
    if (this.videoManager) {
      this.videoManager.seek(0);
      this.videoManager.play();
    }
  };

  public setVideoManager = (videoManager: VideoPlayerManager): void => {
    this.videoManager = videoManager;
  };

  public getCurrentSection = (): CarouselSection => {
    return this.currentSection;
  };

  public destroy = (): void => {
    this.signal.destroyAll();
  };
}

export default VideoSettingsCarousel;
