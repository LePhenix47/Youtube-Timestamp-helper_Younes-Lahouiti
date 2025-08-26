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
  }

  public get element(): HTMLElement {
    return this.container;
  }

  // Fixed method name to match ChapterSideBarManager usage
  public onChange = (callback: (totalSeconds: number) => void) => {
    this.changeCallback = callback;
  };

  private setupChangeDetection = (): void => {
    const inputs = this.container.querySelectorAll<HTMLInputElement>(
      "[data-element=chapter-start-input]"
    );

    for (const input of inputs) {
      input.addEventListener("input", () => {
        this.normalizeInputs();
        this.changeCallback?.(this.getTotalSeconds());
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

    return span;
  };

  private setupNavigation = () => {
    const inputs = this.container.querySelectorAll<HTMLInputElement>(
      "[data-element=chapter-start-input]"
    );

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const previousInput = inputs?.[i - 1];
      const nextInput = inputs?.[i + 1];

      input.addEventListener("keydown", (e: KeyboardEvent) => {
        switch (e.key) {
          case "ArrowLeft": {
            if (!previousInput) {
              break;
            }
            e.preventDefault();

            previousInput.focus();
            previousInput.select();
            break;
          }
          case "ArrowRight": {
            if (!nextInput) {
              break;
            }
            e.preventDefault();

            nextInput.focus();
            nextInput.select();
            break;
          }

          default:
            break;
        }
      });

      // TODO: Update this shitty logic, this is just shit
      input.addEventListener("input", (e) => {
        const target = e.target as HTMLInputElement;
        if (target.value.length === 2 && nextInput && !target.readOnly) {
          nextInput.focus();
          nextInput.select();
        }
      });
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
    const s = Math.floor(total % 60); // Fixed: added Math.floor for consistency

    if (this.hoursInput) {
      this.hoursInput.setValue(h);
    }
    this.minutesInput.setValue(m);
    this.secondsInput.setValue(s);
  };

  public focus = (): void => {
    // Focus the first available input
    if (this.hoursInput) {
      this.hoursInput.focus();
    } else {
      this.minutesInput.focus();
    }
  };
}

export default TimestampInputGroup;
