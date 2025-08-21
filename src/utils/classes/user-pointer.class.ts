// Helper type for listener function signature
export type PointerDragEventMap = {
  "custom:pointer-drag-start": {
    adjustedX: number;
    adjustedY: number;
  };
  "custom:pointer-drag-hold": null;
  "custom:pointer-drag-move": Pick<
    PointerEvent,
    "pageX" | "pageY" | "movementX" | "movementY"
  > &
    PointerDragEventMap["custom:pointer-drag-start"];
  "custom:pointer-drag-leave": null;
  "custom:pointer-drag-cancel": null;
  "custom:pointer-drag-end": Pick<
    PointerEvent,
    "pageX" | "pageY" | "movementX" | "movementY"
  >;
  "custom:pointer-drag-click": {
    clickedElement: HTMLElement;
  };
};

// Define a utility type to make all properties mutable
type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export type LastPointerPositions = Mutable<
  Pick<PointerEvent, "pageX" | "pageY" | "clientX" | "clientY">
> &
  Partial<{
    containerX: number;
    containerY: number;
  }>;

class UserPointer {
  public static computeDistance = (
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): number => {
    const dx: number = x2 - x1;
    const dy: number = y2 - y1;

    return Math.sqrt(dx ** 2 + dy ** 2);
  };

  public static computeOffsetFromContainer = (
    pageX: number,
    pageY: number,
    containerOrRect: HTMLElement | DOMRect
  ): { x: number; y: number } => {
    let rect: DOMRect;

    if (containerOrRect instanceof HTMLElement) {
      rect = containerOrRect.getBoundingClientRect();
    } else if (containerOrRect instanceof DOMRect) {
      rect = containerOrRect;
    } else {
      throw new TypeError("Argument must be an HTMLElement or DOMRect");
    }

    const x = pageX - rect.x;
    const y = pageY - rect.y;

    return { x, y };
  };

  public static rotateAroundContainerCenter = (
    localX: number,
    localY: number,
    container: HTMLElement,
    angleInDegrees: number
  ): { rotatedX: number; rotatedY: number } => {
    // ? Get the center of the container
    const centerX: number = container.offsetWidth / 2;
    const centerY: number = container.offsetHeight / 2;

    // ? Translate point to origin (center)
    const dx: number = localX - centerX;
    const dy: number = localY - centerY;

    // ? Convert angle to radians

    const { x: rotatedXFromMiddle, y: rotatedYFromMiddle } =
      UserPointer.rotateVector(dx, dy, angleInDegrees);

    // ? Translate back to top-left origin (undo the center shift)
    return {
      rotatedX: rotatedXFromMiddle + centerX,
      rotatedY: rotatedYFromMiddle + centerY,
    };
  };

  public static rotateVector = (
    dx: number, // ? Coord from the center of the container
    dy: number, // ? Coord from the center of the container
    angleInDegrees: number
  ): { x: number; y: number } => {
    const angleRad = (angleInDegrees * Math.PI) / 180;

    /*
    ? Apply rotation from the middle of the container
    ? See this video to understand how it works: https://youtu.be/h9OWnuarYuc?si=bb0mmXS2vvbuG_kY    
    */
    const rotatedX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
    const rotatedY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);

    return { x: rotatedX, y: rotatedY };
  };

  public static computeInitialPointerOffset = (
    pageX: number,
    pageY: number,
    pressedElement: HTMLElement,
    container: HTMLElement,
    rotationAngle: number
  ): { offsetX: number; offsetY: number } => {
    const elementRect = pressedElement.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Pointer relative to container, then unrotate
    const { x: pointerX, y: pointerY } = UserPointer.computeOffsetFromContainer(
      pageX,
      pageY,
      containerRect
    );

    const pointerUnrotated = UserPointer.rotateAroundContainerCenter(
      pointerX,
      pointerY,
      container,
      -rotationAngle
    );

    // Piece relative to container, then unrotate
    const pieceX = elementRect.x - containerRect.x;
    const pieceY = elementRect.y - containerRect.y;

    const pieceUnrotated = UserPointer.rotateAroundContainerCenter(
      pieceX,
      pieceY,
      container,
      -rotationAngle
    );

    // Offset vector in unrotated space
    const offsetXUnrotated =
      pointerUnrotated.rotatedX - pieceUnrotated.rotatedX;

    const offsetYUnrotated =
      pointerUnrotated.rotatedY - pieceUnrotated.rotatedY;

    // Rotate offset vector *forward* by rotationAngle to get rotated offset
    const rotatedOffset = UserPointer.rotateVector(
      offsetXUnrotated,
      offsetYUnrotated,
      rotationAngle
    );

    const w = pressedElement.offsetWidth;
    const h = pressedElement.offsetHeight;

    // Normalize rotationAngle between 0-359
    const angle = ((Math.round(rotationAngle) % 360) + 360) % 360;

    let offsetX: number;
    let offsetY: number;

    switch (angle) {
      case 0: {
        offsetX = rotatedOffset.x;
        offsetY = rotatedOffset.y;
        break;
      }
      case 180: {
        offsetX = w - rotatedOffset.x;
        offsetY = h - rotatedOffset.y;
        break;
      }
      default:
        throw new Error("Invalid rotation angle, must be 0 or 180");
    }

    console.log(
      `offsetX: ${offsetX}, offsetY: ${offsetY}, rotationAngle: ${rotationAngle}`
    );

    return { offsetX, offsetY };
  };

  private rotationAngle: number = 0; // Default rotation angle for the container
  public isPressing: boolean = false;
  public pressedElement: HTMLElement | null = null;

  public initXOffset: number = NaN;
  public initYOffset: number = NaN;

  private dragStartTimeout: NodeJS.Timeout;
  private dragStarted: any;

  public lastRecordedPositions: LastPointerPositions = {
    pageX: NaN,
    pageY: NaN,
    clientX: NaN,
    clientY: NaN,
    containerX: NaN,
    containerY: NaN,
  };

  private readonly controller = new AbortController();
  private readonly listenersMap = new Map<
    keyof PointerDragEventMap,
    Function
  >();
  private animationFrameId: number = NaN;
  private container: HTMLElement;

  private pointerDownTime: number = NaN;
  private readonly DRAG_TIME_THRESHOLD_MS = 85;

  constructor(container?: HTMLElement) {
    const containerIsNotHTMLElement =
      Boolean(container) && !(container instanceof HTMLElement);
    if (containerIsNotHTMLElement) {
      throw new TypeError("Container must be an HTMLElement");
    }

    this.container = container || document.body;

    this.initializeEventListeners();
  }

  private initializeEventListeners = () => {
    const eventsArray = [
      {
        eventName: "pointerup",
        callback: this.handlePointerUp,
      },
      {
        eventName: "pointerdown",
        callback: this.handlePointerDown,
      },
      {
        eventName: "pointermove",
        callback: this.handlePointerMove,
      },
      {
        eventName: "pointercancel",
        callback: this.handlePointerCancel,
      },
      {
        eventName: "pointerleave",
        callback: this.handlePointerLeave,
      },
    ] as const;

    for (const { eventName, callback } of eventsArray) {
      this.container.addEventListener(eventName, callback, {
        signal: this.controller.signal,
      });
    }
  };

  public setRotationAngle = (angle: number): this => {
    if (typeof angle !== "number") {
      throw new TypeError("Rotation angle must be a number");
    }

    this.rotationAngle = angle;

    return this;
  };

  // Add one listener for each event
  public on = <K extends keyof PointerDragEventMap>(
    eventName: K,
    callback: (event: CustomEvent<PointerDragEventMap[K]>) => void,
    signal?: AbortSignal
  ): this => {
    // If there's already a listener, replace it
    this.listenersMap.set(eventName, callback);

    // Register the listener on the container
    this.container.addEventListener(
      eventName,
      (event) => {
        callback(event as CustomEvent<PointerDragEventMap[K]>);
      },
      { signal: signal || this.controller.signal }
    );

    return this;
  };

  // Add a basic off method to remove the event listener
  public off = <K extends keyof PointerDragEventMap>(eventName: K): this => {
    const callback = this.listenersMap.get(eventName);
    if (!callback) {
      console.warn("Event listener not found for", eventName, ", skipping");

      return this;
    }

    this.container.removeEventListener(eventName, callback as EventListener);
    this.listenersMap.delete(eventName);

    return this;
  };

  public destroyAll = (): this => {
    this.controller.abort();

    return this;
  };

  public dispatchEvent = <K extends keyof PointerDragEventMap>(
    eventName: K,
    options?: PointerDragEventMap[K]
  ): this => {
    const customEvent = new CustomEvent(eventName, { detail: options });
    this.container.dispatchEvent(customEvent);

    return this;
  };

  public static computeRelativeViewportYOffset = (clientY: number): number => {
    const viewportHeight: number =
      window.visualViewport?.height || window.innerHeight;

    const viewportBrowserNavBarOffset: number =
      window.visualViewport?.offsetTop || 0;

    const relativeToViewport: number =
      (clientY - viewportBrowserNavBarOffset) / viewportHeight;

    return Math.round(100 * relativeToViewport);
  };

  public static normalizeYOffsetFromCenter = (
    yOffsetRelativeToViewport: number
  ): number => {
    // ? Value between [-100, 100], from the center
    const yOffsetFromScreenCenter: number =
      (yOffsetRelativeToViewport - 50) * 2;

    return yOffsetFromScreenCenter;
  };

  private cancelAnimationFrame = () => {
    cancelAnimationFrame(this.animationFrameId);
  };

  private handlePointerDown = (event: PointerEvent) => {
    event.preventDefault();

    this.pointerDownTime = performance.now(); // Store the time the pointer is down

    const isPressing =
      (event.pointerType === "mouse" && event.button === 0) ||
      event.pointerType === "touch";
    this.isPressing = isPressing;
    this.pressedElement = event.target! as HTMLElement;

    const { offsetX, offsetY } = UserPointer.computeInitialPointerOffset(
      event.pageX,
      event.pageY,
      this.pressedElement,
      this.container,
      this.rotationAngle
    );

    this.initXOffset = offsetX;
    this.initYOffset = offsetY;

    const lastRecordedValuesKeys = Object.keys(
      this.lastRecordedPositions
    ).filter(
      (key) => key !== "adjustedX" && key !== "adjustedY"
    ) as (keyof PointerEvent)[];

    const lastRecordedValues = this.getCustomEventDetails(
      event,
      lastRecordedValuesKeys
    );
    this.lastRecordedPositions = {
      ...lastRecordedValues,
      ...this.lastRecordedPositions,
    };

    // Start the drag hold loop immediately to track dragging state
    if (this.listenersMap.has("custom:pointer-drag-hold")) {
      this.startDragHoldLoop(); // Start tracking drag movement
    }
  };

  // TODO: Refactor code as it looks like a mess
  private handlePointerMove = (event: PointerEvent) => {
    if (!this.isPressing) return; // Ignore if no element is pressed

    const pointerMoveTime = performance.now();
    const dragDuration = pointerMoveTime - this.pointerDownTime;

    // Only dispatch drag start once when the threshold is met
    const containerRect = this.container.getBoundingClientRect?.();

    const { x: localX, y: localY } = UserPointer.computeOffsetFromContainer(
      event.pageX,
      event.pageY,
      // this.container,
      containerRect
    );

    const { rotatedX: adjustedX, rotatedY: adjustedY } =
      UserPointer.rotateAroundContainerCenter(
        localX,
        localY,
        this.container,
        this.rotationAngle
      );

    if (dragDuration >= this.DRAG_TIME_THRESHOLD_MS && !this.dragStarted) {
      this.lastRecordedPositions.containerX = adjustedX;
      this.lastRecordedPositions.containerY = adjustedY;

      this.dispatchEvent("custom:pointer-drag-start", {
        adjustedX,
        adjustedY,
      });

      this.dragStarted = true; // Ensure drag start is only dispatched once
    }

    // Dispatch drag move event (continuously as long as dragging is happening)
    if (this.dragStarted) {
      this.dispatchEvent("custom:pointer-drag-move", {
        pageX: event.pageX,
        pageY: event.pageY,
        movementX: event.movementX,
        movementY: event.movementY,
        adjustedX,
        adjustedY,
      });
    }
  };

  private getCustomEventDetails = <
    TEvent extends PointerEvent,
    TKeys extends readonly (keyof TEvent)[]
  >(
    event: TEvent,
    propertiesForCustomEvent: TKeys
  ): { [K in TKeys[number]]: TEvent[K] } => {
    const customEventDetailsObject = {} as { [K in TKeys[number]]: TEvent[K] };

    for (const key of propertiesForCustomEvent) {
      if (!event[key]) {
        continue;
      }

      customEventDetailsObject[key] = event[key];
    }

    return customEventDetailsObject;
  };

  // private handlePointerUp = (event: PointerEvent) => {
  //   this.resetPointerState(event);
  // };

  private handlePointerUp = (event: PointerEvent) => {
    const pointerUpTime = performance.now();
    const dragDuration = pointerUpTime - this.pointerDownTime; // Calculate how long the pointer was down

    clearTimeout(this.dragStartTimeout); // Clear the timeout if the pointer is up

    if (dragDuration < this.DRAG_TIME_THRESHOLD_MS) {
      // Short duration means it's a click, not a drag
      this.dispatchEvent("custom:pointer-drag-click", {
        clickedElement: event.target as HTMLElement,
      });
    } else {
      // Long duration means it's a drag
      const containerRect = this.container.getBoundingClientRect?.();

      const { x: localX, y: localY } = UserPointer.computeOffsetFromContainer(
        event.pageX,
        event.pageY,
        // this.container,
        containerRect
      );

      const { rotatedX: adjustedX, rotatedY: adjustedY } =
        UserPointer.rotateAroundContainerCenter(
          localX,
          localY,
          this.container,
          this.rotationAngle
        );
      // const adjustedX = event.pageX - containerRect.x;
      // const adjustedY = event.pageY - containerRect.y;

      this.lastRecordedPositions.containerX = adjustedX;
      this.lastRecordedPositions.containerY = adjustedY;

      this.dispatchEvent("custom:pointer-drag-end", {
        pageY: event.pageY,
        pageX: event.pageX,
        movementY: event.movementY,
        movementX: event.movementX,
      });
    }

    // Reset all state after pointer up
    this.resetAllState();
  };

  private handlePointerLeave = (event: PointerEvent) => {
    // this.resetPointerState(event);
    this.dispatchEvent("custom:pointer-drag-leave");
  };

  private handlePointerCancel = (event: PointerEvent) => {
    // this.resetPointerState(event);
    this.dispatchEvent("custom:pointer-drag-cancel");
  };

  public resetPointerState = (event: PointerEvent) => {
    event.preventDefault();

    this.resetAllState();
  };

  private resetAllState = () => {
    this.isPressing = false;
    this.pressedElement = null;
    this.cancelAnimationFrame();
    this.animationFrameId = NaN;
    this.dragStarted = false;
  };

  // Start the continuous drag hold loop
  private startDragHoldLoop = () => {
    if (this.animationFrameId) {
      console.warn("loop already started", this.animationFrameId);
      return; // Avoid multiple frames running
    }

    const loop = () => {
      if (!this.isPressing) {
        this.cancelAnimationFrame();
        return;
      }

      this.animationFrameId = requestAnimationFrame(loop); // Request next frame
      this.dispatchEvent("custom:pointer-drag-hold"); // Dispatch continuously
    };

    this.animationFrameId = requestAnimationFrame(loop);
  };
}

export default UserPointer;
