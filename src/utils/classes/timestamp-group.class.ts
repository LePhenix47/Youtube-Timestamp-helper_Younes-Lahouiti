import TimestampUnitInput from "./timestamp-unit-input.class";

class TimestampInputGroup {
  private container: HTMLElement;
  private hoursInput?: TimestampUnitInput;
  private minutesInput: TimestampUnitInput;
  private secondsInput: TimestampUnitInput;
  public showHours: boolean;

  constructor(showHours: boolean) {
    this.showHours = showHours;
    this.container = document.createElement("div");
    this.container.classList.add("timestamp-group");

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
  }

  public get element(): HTMLElement {
    return this.container;
  }

  private makeSeparator = (): HTMLElement => {
    const span = document.createElement("span");
    span.className = "timestamp-separator";
    span.textContent = ":";
    return span;
  };

  private setupNavigation = () => {
    const inputs =
      this.container.querySelectorAll<HTMLInputElement>(".timestamp-input");

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const previousInput = i > 0 ? inputs[i - 1] : null;
      const nextInput = i < inputs.length - 1 ? inputs[i + 1] : null;

      input.addEventListener("keydown", (ev) => {
        if (ev.key === "ArrowRight" && nextInput) {
          nextInput.focus();
        } else if (ev.key === "ArrowLeft" && previousInput) {
          previousInput.focus();
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
    const s = total % 60;

    if (this.hoursInput) {
      this.hoursInput.setValue(h);
    }
    this.minutesInput.setValue(m);
    this.secondsInput.setValue(s);
  };
}

export default TimestampInputGroup;
