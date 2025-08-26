import TimestampUnitInput from "./timestamp-unit-input.class";

class TimestampInputGroup {
  private container: HTMLElement;
  private hoursInput?: TimestampUnitInput;
  private minutesInput: TimestampUnitInput;
  private secondsInput: TimestampUnitInput;
  public showHours: boolean;
  private changeCallback?: (totalSeconds: number) => void;

  constructor(showHours: boolean) {
    this.showHours = showHours;
    this.container = document.createElement("div");
    this.container.classList.add("timestamp-group");
    this.container.style.display = "contents";

    if (showHours) {
      this.hoursInput = new TimestampUnitInput("hours");
      this.container.append(this.hoursInput.element);
      this.container.append(this.makeSeparator());
    }

    this.minutesInput = new TimestampUnitInput("minutes");
    this.secondsInput = new TimestampUnitInput("seconds");

    this.container.append(this.minutesInput.element);
    this.container.append(this.makeSeparator());
    this.container.append(this.secondsInput.element);

    this.setupNavigation();
    this.setupChangeDetection();
    this.setupCascading();
  }

  public get element(): HTMLElement {
    return this.container;
  }

  public onChange = (callback: (totalSeconds: number) => void) => {
    this.changeCallback = callback;
  };

  private setupCascading = (): void => {
    const handleCascade = (
      unit: "hours" | "minutes" | "seconds",
      direction: 1 | -1
    ) => {
      if (unit === "minutes") {
        const current = this.minutesInput.value;
        const newValue = current + direction;

        if (newValue > 59) {
          this.minutesInput.setValue(0);
          if (this.hoursInput) {
            this.hoursInput.setValue(this.hoursInput.value + 1);
          }
        } else if (newValue < 0) {
          this.minutesInput.setValue(59);
          if (this.hoursInput) {
            const newHours = this.hoursInput.value - 1;
            this.hoursInput.setValue(Math.max(0, newHours));
          }
        } else {
          this.minutesInput.setValue(newValue);
        }
      } else if (unit === "hours" && this.hoursInput) {
        const current = this.hoursInput.value;
        const newValue = Math.max(0, Math.min(23, current + direction));
        this.hoursInput.setValue(newValue);
      }

      // Trigger change callback after cascading
      if (this.changeCallback) {
        this.changeCallback(this.getTotalSeconds());
      }
    };

    // Set up cascading callbacks for each input
    this.minutesInput.setCascadeCallback(handleCascade);
    this.secondsInput.setCascadeCallback(handleCascade);
    if (this.hoursInput) {
      this.hoursInput.setCascadeCallback(handleCascade);
    }
  };

  private setupChangeDetection = (): void => {
    const inputs = this.container.querySelectorAll<HTMLInputElement>(
      "[data-element=chapter-start-input]"
    );

    for (const input of inputs) {
      // Only trigger change on blur now, not on every input
      input.addEventListener("blur", () => {
        this.normalizeInputs();
        if (this.changeCallback) {
          this.changeCallback(this.getTotalSeconds());
        }
      });

      // Also trigger on Enter key
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          this.normalizeInputs();
          if (this.changeCallback) {
            this.changeCallback(this.getTotalSeconds());
          }
        }
      });
    }
  };

  private normalizeInputs = () => {
    if (this.hoursInput) this.hoursInput.normalize();
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

  private makeSeparator = (): HTMLElement => {
    const span = document.createElement("span");
    span.className = "timestamp-separator";
    span.textContent = ":";
    span.style.cssText = "font-weight: bold; color: #666; margin: 0 2px;";
    return span;
  };

  private setupNavigation = () => {
    const inputs = this.container.querySelectorAll<HTMLInputElement>(
      "[data-element=chapter-start-input]"
    );

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const previousInput = i > 0 ? inputs[i - 1] : null;
      const nextInput = i < inputs.length - 1 ? inputs[i + 1] : null;

      input.addEventListener("keydown", (ev) => {
        if (ev.key === "ArrowRight" && nextInput) {
          ev.preventDefault();
          nextInput.focus();
          nextInput.select();
        } else if (ev.key === "ArrowLeft" && previousInput) {
          ev.preventDefault();
          previousInput.focus();
          previousInput.select();
        } else if (ev.key === "Tab") {
          // Allow normal tab behavior, but normalize on tab out
          setTimeout(() => {
            this.normalizeInputs();
            if (this.changeCallback) {
              this.changeCallback(this.getTotalSeconds());
            }
          }, 0);
        }
      });

      // Remove auto-advance on input - let users type freely
      // Navigation is now only via arrow keys, tab, or manual clicking
    }
  };

  public getTotalSeconds = (): number => {
    const h = this.hoursInput ? this.hoursInput.value : 0;
    const m = this.minutesInput.value;
    const s = this.secondsInput.value;
    return h * 3_600 + m * 60 + s;
  };

  public setFromSeconds = (total: number) => {
    const h = Math.floor(total / 3_600);
    const m = Math.floor((total % 3_600) / 60);
    const s = Math.floor(total % 60);

    if (this.hoursInput) {
      this.hoursInput.setValue(h);
    }
    this.minutesInput.setValue(m);
    this.secondsInput.setValue(s);
  };

  public focus = (): void => {
    if (this.hoursInput) {
      this.hoursInput.focus();
    } else {
      this.minutesInput.focus();
    }
  };
}

export default TimestampInputGroup;
