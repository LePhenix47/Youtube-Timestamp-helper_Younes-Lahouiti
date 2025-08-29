import Signal from "./signal.class";

type TimestampUnit = "hours" | "minutes" | "seconds";
type CascadeDirection = 1 | -1;

interface CascadeCallback {
  (unit: TimestampUnit, direction: CascadeDirection): void;
}

class TimestampUnitInput {
  private static readonly MAX_TIME_VALUE = 59;
  private static readonly MAX_HOURS_DIGITS = 3;
  private static readonly MAX_TIME_DIGITS = 2;

  private input: HTMLInputElement;
  private readonly unit: TimestampUnit;
  private readonly maxValue: number;
  private readonly groupId: string;
  private readonly signal: Signal = new Signal();
  private cascadeCallback?: CascadeCallback;

  constructor(
    unit: TimestampUnit,
    groupId: string = `input-${Date.now()}-${Math.random()}`
  ) {
    this.unit = unit;
    this.groupId = groupId;
    this.maxValue = this.getMaxValueForUnit(unit);

    this.createInputElement();
    this.setupEvents();
  }

  private getMaxValueForUnit(unit: TimestampUnit): number {
    switch (unit) {
      case "hours":
        return Number.MAX_SAFE_INTEGER; // Unlimited hours for long videos
      case "minutes":
      case "seconds":
        return TimestampUnitInput.MAX_TIME_VALUE;
      default:
        throw new Error(`Unknown timestamp unit: ${unit}`);
    }
  }

  private createInputElement = (): void => {
    const placeholderValue = this.getPlaceholderForUnit(this.unit);
    const maxLength = this.getMaxLengthForUnit(this.unit);

    const template = document.createElement("template");
    template.innerHTML = /* html */ `
      <input 
        type="number"
        min="0"
        inputMode="numeric"
        maxLength="${maxLength}"
        class="video-timestamps__input video-timestamps__input--start"
        data-unit="${this.unit}"
        data-group-id="${this.groupId}"
        data-element="chapter-start-input"
        placeholder="${placeholderValue}"
      />
    `;

    this.input = template.content.firstElementChild!.cloneNode(
      true
    ) as HTMLInputElement;
  };

  private getPlaceholderForUnit(unit: TimestampUnit): string {
    switch (unit) {
      case "hours":
        return "hh";
      case "minutes":
        return "mm";
      case "seconds":
        return "ss";
      default:
        throw new Error(`Unknown timestamp unit: ${unit}`);
    }
  }

  private getMaxLengthForUnit(unit: TimestampUnit): string {
    switch (unit) {
      case "hours":
        return TimestampUnitInput.MAX_HOURS_DIGITS.toString();
      case "minutes":
      case "seconds":
        return TimestampUnitInput.MAX_TIME_DIGITS.toString();
      default:
        throw new Error(`Unknown timestamp unit: ${unit}`);
    }
  }

  private setupEvents = (): void => {
    this.input.addEventListener("keydown", (e) => this.handleKeyDown(e));
    this.input.addEventListener("focus", (e) => this.handleFocus(e));
    this.input.addEventListener("blur", (e) => this.handleBlur(e));
    this.input.addEventListener("input", (e) => this.handleInput(e));
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        this.increment(1);
        break;
      case "ArrowDown":
        e.preventDefault();
        this.increment(-1);
        break;
      default:
        // Allow other keys to pass through
        break;
    }
  };

  private handleFocus = (e: FocusEvent): void => {
    // Select all text on focus for easy replacement
    this.input.select();
  };

  private handleBlur = (e: FocusEvent): void => {
    // Emit blur signal with timing info
    this.signal.emit("timestamp-input-blur", {
      inputType: this.unit,
      groupId: this.groupId,
      timestamp: Date.now(),
    });
  };

  private handleInput = (e: Event): void => {
    // Don't cascade on normal typing - only on arrow keys or when value exceeds limits
    // Cascading will happen on blur via the group validation
  };

  private increment = (step: CascadeDirection): void => {
    const currentValue = this.input.valueAsNumber || 0;
    const newValue = currentValue + step;

    // Don't clamp yet - let cascading handle negative values
    this.input.valueAsNumber = newValue;
    this.applyCascadingMath();
    
    // After cascading, ensure we don't have negative values
    if (this.input.valueAsNumber < 0) {
      this.input.valueAsNumber = 0;
    }
  };

  public applyCascadingMath = (): void => {
    const value = this.input.valueAsNumber || 0;

    switch (this.unit) {
      case "seconds":
      case "minutes":
        this.handleTimeUnitCascading(value);
        break;
      case "hours":
        this.handleHoursCascading(value);
        break;
      default:
        throw new Error(`Unknown timestamp unit: ${this.unit}`);
    }
  };

  private handleTimeUnitCascading(value: number): void {
    const maxValue = TimestampUnitInput.MAX_TIME_VALUE;

    // Only cascade when actually over the limit, not on normal values
    if (value > maxValue) {
      this.handleOverflow(value, maxValue);
    } else if (value < 0) {
      this.handleUnderflow();
    }
    // Don't modify values that are within normal range (0-59)
  }

  private handleHoursCascading(value: number): void {
    if (value < 0) {
      this.input.valueAsNumber = 0;
    }
  }

  private handleOverflow(value: number, maxValue: number): void {
    this.input.valueAsNumber = value % (maxValue + 1);
    const cascades = Math.floor(value / (maxValue + 1));

    if (this.cascadeCallback && cascades > 0) {
      const nextUnit = this.getNextHigherUnit();
      const direction = Math.sign(cascades) as CascadeDirection;
      this.cascadeCallback(nextUnit, direction);
    }
  }

  private handleUnderflow(): void {
    if (this.cascadeCallback) {
      const nextUnit = this.getNextHigherUnit();
      this.cascadeCallback(nextUnit, -1);
      this.input.valueAsNumber = TimestampUnitInput.MAX_TIME_VALUE;
    }
  }

  private getNextHigherUnit(): TimestampUnit {
    switch (this.unit) {
      case "seconds":
        return "minutes";
      case "minutes":
        return "hours";
      case "hours":
        throw new Error("Hours is the highest unit, cannot cascade higher");
      default:
        throw new Error(`Unknown timestamp unit: ${this.unit}`);
    }
  }

  public normalize = (): void => {
    const value = this.input.valueAsNumber || 0;
    const normalizedValue = this.getNormalizedValue(value);
    const paddedValue = this.getPaddedValue(normalizedValue);

    this.input.value = paddedValue;
  };

  private getNormalizedValue(value: number): number {
    switch (this.unit) {
      case "hours":
        return Math.max(0, value);
      case "minutes":
      case "seconds":
        return Math.max(0, Math.min(TimestampUnitInput.MAX_TIME_VALUE, value));
      default:
        throw new Error(`Unknown timestamp unit: ${this.unit}`);
    }
  }

  private getPaddedValue(value: number): string {
    const padLength =
      this.unit === "hours"
        ? TimestampUnitInput.MAX_TIME_DIGITS
        : TimestampUnitInput.MAX_TIME_DIGITS;

    return value.toString().padStart(padLength, "0");
  }

  public get value(): number {
    return this.input.valueAsNumber || 0;
  }

  public setValue = (value: number): void => {
    const normalizedValue = this.getNormalizedValue(value);
    const paddedValue = this.getPaddedValue(normalizedValue);

    this.input.value = paddedValue;
  };

  public get element(): HTMLInputElement {
    return this.input;
  }

  public focus = (): void => {
    this.input.focus();
  };

  public setCascadeCallback = (callback: CascadeCallback): void => {
    this.cascadeCallback = callback;
  };
}

export default TimestampUnitInput;
