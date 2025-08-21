export type PointerDragEventMap = {
  "custom:pointer-drag-start": { adjustedX: number; adjustedY: number };
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
  "custom:pointer-drag-click": { clickedElement: HTMLElement };
};
type Mutable<T> = { -readonly [P in keyof T]: T[P] };
export type LastPointerPositions = Mutable<
  Pick<PointerEvent, "pageX" | "pageY" | "clientX" | "clientY">
> &
  Partial<{ containerX: number; containerY: number }>;
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
    const centerX: number = container.offsetWidth / 2;
    const centerY: number = container.offsetHeight / 2;
    const dx: number = localX - centerX;
    const dy: number = localY - centerY;
    const { x: rotatedXFromMiddle, y: rotatedYFromMiddle } =
      UserPointer.rotateVector(dx, dy, angleInDegrees);
    return {
      rotatedX: rotatedXFromMiddle + centerX,
      rotatedY: rotatedYFromMiddle + centerY,
    };
  };
  public static rotateVector = (
    dx: number,
    dy: number,
    angleInDegrees: number
  ): { x: number; y: number } => {
    const angleRad = (angleInDegrees * Math.PI) / 180;
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
    const pieceX = elementRect.x - containerRect.x;
    const pieceY = elementRect.y - containerRect.y;
    const pieceUnrotated = UserPointer.rotateAroundContainerCenter(
      pieceX,
      pieceY,
      container,
      -rotationAngle
    );
    const offsetXUnrotated =
      pointerUnrotated.rotatedX - pieceUnrotated.rotatedX;
    const offsetYUnrotated =
      pointerUnrotated.rotatedY - pieceUnrotated.rotatedY;
    const rotatedOffset = UserPointer.rotateVector(
      offsetXUnrotated,
      offsetYUnrotated,
      rotationAngle
    );
    const w = pressedElement.offsetWidth;
    const h = pressedElement.offsetHeight;
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
  private rotationAngle: number = 0;
  public isPressing: boolean = false;
  public pressedElement: HTMLElement | null = null;
  public initXOffset: number = NaN;
  public initYOffset: number = NaN;
  private dragStartTimeout: NodeJS.Timeout;
  private dragStarted: boolean = false;
  private initialPointerPosition: { pageX: number; pageY: number } | null =
    null;
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
  private readonly DRAG_DISTANCE_THRESHOLD_PX = 4;
  private readonly DRAG_TIME_THRESHOLD_MS = 50;

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
      { eventName: "pointerup", callback: this.handlePointerUp },
      { eventName: "pointerdown", callback: this.handlePointerDown },
      { eventName: "pointermove", callback: this.handlePointerMove },
      { eventName: "pointercancel", callback: this.handlePointerCancel },
      { eventName: "pointerleave", callback: this.handlePointerLeave },
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

  public on = <K extends keyof PointerDragEventMap>(
    eventName: K,
    callback: (event: CustomEvent<PointerDragEventMap[K]>) => void,
    signal?: AbortSignal
  ): this => {
    this.listenersMap.set(eventName, callback);
    this.container.addEventListener(
      eventName,
      (event) => {
        callback(event as CustomEvent<PointerDragEventMap[K]>);
      },
      { signal: signal || this.controller.signal }
    );
    return this;
  };

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
    const yOffsetFromScreenCenter: number =
      (yOffsetRelativeToViewport - 50) * 2;
    return yOffsetFromScreenCenter;
  };
  private cancelAnimationFrame = () => {
    cancelAnimationFrame(this.animationFrameId);
  };

  private shouldStartDrag = (
    currentPageX: number,
    currentPageY: number,
    timeSinceDown: number
  ): boolean => {
    if (!this.initialPointerPosition) return false;
    const distance = UserPointer.computeDistance(
      this.initialPointerPosition.pageX,
      this.initialPointerPosition.pageY,
      currentPageX,
      currentPageY
    );
    return (
      distance >= this.DRAG_DISTANCE_THRESHOLD_PX &&
      timeSinceDown >= this.DRAG_TIME_THRESHOLD_MS
    );
  };

  private handlePointerDown = (event: PointerEvent) => {
    event.preventDefault();
    this.pointerDownTime = performance.now();
    const isPressing =
      (event.pointerType === "mouse" && event.button === 0) ||
      event.pointerType === "touch";
    this.isPressing = isPressing;
    this.pressedElement = event.target! as HTMLElement;
    this.initialPointerPosition = { pageX: event.pageX, pageY: event.pageY };
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
    if (this.listenersMap.has("custom:pointer-drag-hold")) {
      this.startDragHoldLoop();
    }
  };

  private handlePointerMove = (event: PointerEvent) => {
    if (!this.isPressing) return;
    const pointerMoveTime = performance.now();
    const dragDuration = pointerMoveTime - this.pointerDownTime;
    const containerRect = this.container.getBoundingClientRect?.();
    const { x: localX, y: localY } = UserPointer.computeOffsetFromContainer(
      event.pageX,
      event.pageY,
      containerRect
    );
    const { rotatedX: adjustedX, rotatedY: adjustedY } =
      UserPointer.rotateAroundContainerCenter(
        localX,
        localY,
        this.container,
        this.rotationAngle
      );
    if (
      !this.dragStarted &&
      this.shouldStartDrag(event.pageX, event.pageY, dragDuration)
    ) {
      this.lastRecordedPositions.containerX = adjustedX;
      this.lastRecordedPositions.containerY = adjustedY;
      this.dispatchEvent("custom:pointer-drag-start", { adjustedX, adjustedY });
      this.dragStarted = true;
    }
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

  private handlePointerUp = (event: PointerEvent) => {
    const pointerUpTime = performance.now();
    const dragDuration = pointerUpTime - this.pointerDownTime;
    clearTimeout(this.dragStartTimeout);
    const wasDrag =
      this.initialPointerPosition &&
      this.shouldStartDrag(event.pageX, event.pageY, dragDuration);
    if (!wasDrag) {
      this.dispatchEvent("custom:pointer-drag-click", {
        clickedElement: event.target as HTMLElement,
      });
    } else {
      const containerRect = this.container.getBoundingClientRect?.();
      const { x: localX, y: localY } = UserPointer.computeOffsetFromContainer(
        event.pageX,
        event.pageY,
        containerRect
      );
      const { rotatedX: adjustedX, rotatedY: adjustedY } =
        UserPointer.rotateAroundContainerCenter(
          localX,
          localY,
          this.container,
          this.rotationAngle
        );
      this.lastRecordedPositions.containerX = adjustedX;
      this.lastRecordedPositions.containerY = adjustedY;
      this.dispatchEvent("custom:pointer-drag-end", {
        pageY: event.pageY,
        pageX: event.pageX,
        movementY: event.movementY,
        movementX: event.movementX,
      });
    }
    this.resetAllState();
  };

  private handlePointerLeave = (event: PointerEvent) => {
    this.dispatchEvent("custom:pointer-drag-leave");
  };

  private handlePointerCancel = (event: PointerEvent) => {
    this.dispatchEvent("custom:pointer-drag-cancel");
  };

  public resetPointerState = (event: PointerEvent) => {
    event.preventDefault();
    this.resetAllState();
  };

  private resetAllState = () => {
    this.isPressing = false;
    this.pressedElement = null;
    this.initialPointerPosition = null;
    this.cancelAnimationFrame();
    this.animationFrameId = NaN;
    this.dragStarted = false;
  };

  private startDragHoldLoop = () => {
    if (this.animationFrameId) {
      console.warn("loop already started", this.animationFrameId);
      return;
    }
    const loop = () => {
      if (!this.isPressing) {
        this.cancelAnimationFrame();
        return;
      }
      this.animationFrameId = requestAnimationFrame(loop);
      this.dispatchEvent("custom:pointer-drag-hold");
    };
    this.animationFrameId = requestAnimationFrame(loop);
  };
}
export default UserPointer;
