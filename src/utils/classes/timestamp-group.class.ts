import TimestampUnitInput from "./timestamp-unit-input.class";
import Signal from "./signal.class";

type TimestampUnit = "hours" | "minutes" | "seconds";
type CascadeDirection = 1 | -1;

interface ValidationCallback {
  (totalSeconds: number): boolean;
}

interface ChangeCallback {
  (totalSeconds: number): void;
}

interface BlurDetail {
  inputType: string;
  groupId: string;
  timestamp: number;
}

class TimestampInputGroup {
  private static readonly BLUR_DETECTION_DELAY = 10;
  private static readonly SECONDS_PER_MINUTE = 60;
  private static readonly SECONDS_PER_HOUR = 3_600;
  private static readonly RESET_ANIMATION_DURATION = 600;

  private readonly container: HTMLElement;
  private readonly hoursInput?: TimestampUnitInput;
  private readonly minutesInput: TimestampUnitInput;
  private readonly secondsInput: TimestampUnitInput;
  private readonly showHours: boolean;
  private readonly signal: Signal = new Signal();
  private readonly groupId: string;

  private changeCallback?: ChangeCallback;
  private validationCallback?: ValidationCallback;
  private blurTimeout?: number;
  private previousValidValue: number = 0;

  constructor(
    showHours: boolean,
    groupId: string = `group-${Date.now()}-${Math.random()}`
  ) {
    this.showHours = showHours;
    this.groupId = groupId;

    this.container = this.createContainer();
    this.minutesInput = new TimestampUnitInput("minutes", this.groupId);
    this.secondsInput = new TimestampUnitInput("seconds", this.groupId);

    if (showHours) {
      this.hoursInput = new TimestampUnitInput("hours", this.groupId);
      this.buildLayoutWithHours();
    } else {
      this.buildLayoutWithoutHours();
    }

    this.setupNavigation();
    this.setupGroupBlurDetection();
    this.setupCascading();
  }

  private createContainer = (): HTMLElement => {
    const container = document.createElement("div");
    container.classList.add("timestamp-group");
    container.style.display = "contents";
    container.setAttribute("data-group-id", this.groupId);
    return container;
  };

  private buildLayoutWithHours = (): void => {
    if (!this.hoursInput) return;

    const inputElements = [
      this.hoursInput.element,
      this.minutesInput.element,
      this.secondsInput.element,
    ] as const;

    const separator = this.createSeparator();
    for (let i = 0; i < inputElements.length; i++) {
      const inputElement: HTMLInputElement = inputElements[i];
      this.container.append(inputElement);

      if (i < inputElements.length - 1) {
        this.container.append(separator);
      }
    }
  };

  private buildLayoutWithoutHours = (): void => {
    this.container.append(this.minutesInput.element);
    this.container.append(this.createSeparator());
    this.container.append(this.secondsInput.element);
  };

  public get element(): HTMLElement {
    return this.container;
  }

  public onChange = (callback: ChangeCallback): void => {
    this.changeCallback = callback;
  };

  public onValidation = (callback: ValidationCallback): void => {
    this.validationCallback = callback;
  };

  private setupCascading = (): void => {
    const handleCascade = (
      unit: TimestampUnit,
      direction: CascadeDirection
    ): void => {
      switch (unit) {
        case "hours":
          this.cascadeToHours(direction);
          break;
        case "minutes":
          this.cascadeToMinutes(direction);
          break;
        case "seconds":
          // Seconds don't cascade from anywhere currently
          break;
        default:
          throw new Error(`Unknown cascade target unit: ${unit}`);
      }
    };

    // Set up cascading callbacks for each input
    // Only seconds and minutes can cascade up - hours is the top level
    this.minutesInput.setCascadeCallback(handleCascade);
    this.secondsInput.setCascadeCallback(handleCascade);
    // Hours don't cascade to anything higher
  };

  private cascadeToHours = (direction: CascadeDirection): void => {
    if (!this.hoursInput) return;

    const currentHours = this.hoursInput.value;
    const newHours = Math.max(0, currentHours + direction);
    this.hoursInput.setValue(newHours);
  };

  private cascadeToMinutes = (direction: CascadeDirection): void => {
    const currentMinutes = this.minutesInput.value;
    const newMinutes = currentMinutes + direction;

    if (newMinutes > 59) {
      this.handleMinutesOverflow(newMinutes);
    } else if (newMinutes < 0) {
      this.handleMinutesUnderflow();
    } else {
      this.minutesInput.setValue(newMinutes);
    }
  };

  private handleMinutesOverflow = (newMinutes: number): void => {
    const cascades = Math.floor(newMinutes / 60);
    this.minutesInput.setValue(newMinutes % 60);

    if (this.hoursInput) {
      const newHours = this.hoursInput.value + cascades;
      this.hoursInput.setValue(newHours);
    }
  };

  private handleMinutesUnderflow = (): void => {
    this.minutesInput.setValue(59);

    if (this.hoursInput && this.hoursInput.value > 0) {
      const newHours = this.hoursInput.value - 1;
      this.hoursInput.setValue(newHours);
    } else {
      // Can't go below 0:00:00 - revert minutes to 0
      this.minutesInput.setValue(0);
    }
  };

  private setupGroupBlurDetection = (): void => {
    this.signal.on("timestamp-input-blur", (detail: BlurDetail) => {
      if (detail.groupId !== this.groupId) return;

      this.clearExistingBlurTimeout();
      this.scheduleGroupBlurCheck();
    });
  };

  private clearExistingBlurTimeout = (): void => {
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
      this.blurTimeout = undefined;
    }
  };

  private scheduleGroupBlurCheck(): void {
    this.blurTimeout = window.setTimeout(() => {
      if (!this.isFocusStillInGroup()) {
        this.handleGroupBlur();
      }
    }, TimestampInputGroup.BLUR_DETECTION_DELAY);
  }

  private isFocusStillInGroup = (): boolean => {
    const activeElement = document.activeElement as HTMLInputElement | null;
    return activeElement?.getAttribute("data-group-id") === this.groupId;
  };

  private handleGroupBlur = (): void => {
    // * Apply cascading first, then normalize
    this.applyCascadingToAllInputs();
    this.normalizeInputs();

    const finalValue = this.getTotalSeconds();

    // Validate the final value if validation callback exists
    if (this.validationCallback) {
      const isValid = this.validationCallback(finalValue);
      if (!isValid) {
        // * Validation failed - revert to previous valid value and show feedback
        this.setFromSeconds(this.previousValidValue);
        this.normalizeInputs();
        this.showResetFeedback(finalValue);
      } else {
        // * Validation passed - update previous valid value
        this.previousValidValue = finalValue;
      }
    } else {
      // * No validation - accept the value
      this.previousValidValue = finalValue;
    }

    this.signal.emit("timestamp-group-blur", {
      groupId: this.groupId,
      totalSeconds: this.getTotalSeconds(),
    });

    this.changeCallback?.(this.getTotalSeconds());
  };

  private applyCascadingToAllInputs = (): void => {
    // Apply cascading in order: seconds -> minutes -> hours
    // TODO: create a static array, loop over it then call applyCascadingMath
    this.secondsInput.applyCascadingMath();
    this.minutesInput.applyCascadingMath();
    this.hoursInput?.applyCascadingMath();
  };

  private normalizeInputs = (): void => {
    // Normalize all inputs to proper format
    // TODO: create a static array, loop over it then call normalize
    this.hoursInput?.normalize();
    this.minutesInput.normalize();
    this.secondsInput.normalize();
  };

  public setReadonly = (isReadOnly: boolean) => {
    const inputs = this.container.querySelectorAll<HTMLInputElement>(
      "[data-element=chapter-start-input]"
    );

    for (const input of inputs) {
      input.readOnly = isReadOnly;
    }
  };

  private createSeparator = (): HTMLElement => {
    const separator = document.createElement("span");
    separator.className = "timestamp-separator";
    separator.textContent = ":";
    separator.style.cssText = "font-weight: bold; color: #666; margin: 0 2px;";
    return separator;
  };

  private setupNavigation = () => {
    const inputs = this.container.querySelectorAll<HTMLInputElement>(
      "[data-element=chapter-start-input]"
    );

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const previousInput = inputs?.[i - 1];
      const nextInput = inputs?.[i + 1];

      input.addEventListener("keydown", (e) => {
        switch (e.key) {
          case "ArrowLeft": {
            e.preventDefault();
            previousInput?.focus?.();
            previousInput?.select?.();
            break;
          }
          case "ArrowRight": {
            e.preventDefault();
            nextInput?.focus?.();
            nextInput?.select?.();
            break;
          }

          case "Enter": {
            input.blur();
            break;
          }

          default:
            break;
        }
      });
    }
  };

  public getTotalSeconds = (): number => {
    const hours = this.hoursInput?.value ?? 0;
    const minutes = this.minutesInput.value;
    const seconds = this.secondsInput.value;

    return (
      hours * TimestampInputGroup.SECONDS_PER_HOUR +
      minutes * TimestampInputGroup.SECONDS_PER_MINUTE +
      seconds
    );
  };

  public setFromSeconds = (totalSeconds: number): void => {
    this.previousValidValue = totalSeconds;

    const { hours, minutes, seconds } =
      this.convertSecondsToUnits(totalSeconds);

    this.hoursInput?.setValue(hours);
    this.minutesInput.setValue(minutes);
    this.secondsInput.setValue(seconds);
  };

  private convertSecondsToUnits = (
    totalSeconds: number
  ): {
    hours: number;
    minutes: number;
    seconds: number;
  } => {
    const hours = Math.floor(
      totalSeconds / TimestampInputGroup.SECONDS_PER_HOUR
    );
    const remainingAfterHours =
      totalSeconds % TimestampInputGroup.SECONDS_PER_HOUR;
    const minutes = Math.floor(
      remainingAfterHours / TimestampInputGroup.SECONDS_PER_MINUTE
    );
    const seconds = Math.floor(
      remainingAfterHours % TimestampInputGroup.SECONDS_PER_MINUTE
    );

    return { hours, minutes, seconds };
  };

  public focus = (): void => {
    if (this.hoursInput) {
      this.hoursInput.focus();
    } else {
      this.minutesInput.focus();
    }
  };

  private showResetFeedback = (rejectedValue: number): void => {
    // Add visual feedback classes to all inputs in the group
    const inputs = this.container.querySelectorAll<HTMLInputElement>(
      "[data-element=chapter-start-input]"
    );
    
    // Apply reset animation class
    inputs.forEach(input => {
      input.classList.add('timestamp-input--reset');
      
      // Remove the class after animation completes
      setTimeout(() => {
        input.classList.remove('timestamp-input--reset');
      }, TimestampInputGroup.RESET_ANIMATION_DURATION);
    });
    
    // Emit a signal for any external listeners
    this.signal.emit("timestamp-reset", {
      groupId: this.groupId,
      rejectedValue,
      resetToValue: this.previousValidValue
    });
  };
}

export default TimestampInputGroup;
