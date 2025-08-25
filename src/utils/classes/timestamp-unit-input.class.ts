class TimestampUnitInput {
  private input: HTMLInputElement;
  private readonly unit: "hours" | "minutes" | "seconds";
  private readonly maxValue: number;

  constructor(unit: "hours" | "minutes" | "seconds") {
    this.unit = unit;

    if (unit === "hours") {
      this.maxValue = 23;
    } else {
      this.maxValue = 59;
    }

    this.createInputElement();
    this.setupEvents();
  }

  private createInputElement = () => {
    const unitToPlaceholderMap = new Map(
      Object.entries({
        seconds: "ss",
        minutes: "mm",
        hours: "hh",
      } as const)
    );

    const placeholderValue: string = unitToPlaceholderMap.get(this.unit);

    const template = document.createElement("template");
    template.innerHTML = /* html */ `
      <input 
        type="number"
        maxlength="2"
        inputmode="numeric"
        class="timestamp-input"
        data-unit="${this.unit}"
        placeholder="${placeholderValue}"
      />
    `;

    this.input = template.content.firstElementChild!.cloneNode(
      true
    ) as HTMLInputElement;
  };

  private setupEvents = (): void => {
    this.input.addEventListener("keydown", (ev) => this.handleKeyDown(ev));
    this.input.addEventListener("blur", () => this.normalize());
  };

  private handleKeyDown = (ev: KeyboardEvent): void => {
    if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
      ev.preventDefault();
      this.increment(ev.key === "ArrowUp" ? 1 : -1);
    }
  };

  private increment = (step: number): void => {
    const current = this.input.valueAsNumber || 0;
    let newVal = (current + step + this.maxValue + 1) % (this.maxValue + 1);
    this.input.value = newVal.toString().padStart(2, "0");
  };

  public normalize = (): void => {
    const value = this.input.valueAsNumber || 0;
    const normalizedValue = Math.max(0, Math.min(this.maxValue, value));
    this.input.value = normalizedValue.toString().padStart(2, "0");
  };

  public get value(): number {
    return this.input.valueAsNumber || 0;
  }

  public setValue = (v: number) => {
    const normalizedValue = Math.max(0, Math.min(this.maxValue, v));
    this.input.value = normalizedValue.toString().padStart(2, "0");
  };

  public get element(): HTMLInputElement {
    return this.input;
  }
}

export default TimestampUnitInput;
