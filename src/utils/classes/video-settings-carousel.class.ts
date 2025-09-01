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

  // Speed control constants
  private static readonly MIN_SPEED = 0.25;
  private static readonly MAX_SPEED = 2.0;
  private static readonly SPEED_RANGE =
    VideoSettingsCarousel.MAX_SPEED - VideoSettingsCarousel.MIN_SPEED; // 1.75
  private static readonly SLIDER_MIN = 0;
  private static readonly SLIDER_MAX = 100;

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
