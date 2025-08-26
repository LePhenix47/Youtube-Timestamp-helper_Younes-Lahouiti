class TimestampUnitInput {
  private input: HTMLInputElement;
  private readonly unit: "hours" | "minutes" | "seconds";
  private readonly maxValue: number;
  private cascadeCallback?: (
    unit: "hours" | "minutes" | "seconds",
    direction: 1 | -1
  ) => void;

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

    const placeholderValue: string = unitToPlaceholderMap.get(this.unit)!;

    const template = document.createElement("template");
    template.innerHTML = /* html */ `
      <input 
        type="number"
        min="0"
        max="${this.maxValue}"
        inputMode="numeric"
        maxLength="2"
        class="video-timestamps__input video-timestamps__input--start"
        data-unit="${this.unit}"
        data-element="chapter-start-input"
        placeholder="${placeholderValue}"
      />
    `;

    this.input = template.content.firstElementChild!.cloneNode(
      true
    ) as HTMLInputElement;
  };

  private setupEvents = (): void => {
    this.input.addEventListener("keydown", (e) => this.handleKeyDown(e));
    this.input.addEventListener("blur", () => this.normalize());
    // Remove immediate input normalization - only normalize on blur or arrow keys
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      this.increment(e.key === "ArrowUp" ? 1 : -1);
      this.normalize(); // Normalize after arrow key usage
      // Trigger input event to notify parent of change
      this.input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  private increment = (step: number): void => {
    const current = this.input.valueAsNumber || 0;
    let newVal = current + step;

    // Handle cascading overflow/underflow
    if (newVal > this.maxValue) {
      newVal = this.maxValue;
      // Cascade up to the next higher unit
      if (this.cascadeCallback && this.unit !== "hours") {
        const nextUnit = this.unit === "seconds" ? "minutes" : "hours";
        this.cascadeCallback(nextUnit, 1);
      }
    } else if (newVal < 0) {
      newVal = 0;
      // Cascade down from the next higher unit
      if (this.cascadeCallback && this.unit !== "hours") {
        const nextUnit = this.unit === "seconds" ? "minutes" : "hours";
        this.cascadeCallback(nextUnit, -1);
      }
    }

    this.input.valueAsNumber = newVal;
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

  public focus = (): void => {
    this.input.focus();
  };

  public setCascadeCallback = (
    callback: (unit: "hours" | "minutes" | "seconds", direction: 1 | -1) => void
  ) => {
    this.cascadeCallback = callback;
  };
}

export default TimestampUnitInput;
