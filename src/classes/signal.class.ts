type EventCallback<T = any> = (detail: T) => void;

class Signal {
  private prefix = "signal:"; // could be configurable later

  private makeName = (name: string) => `${this.prefix}${name}`;
  private globalController = new AbortController();

  on = <T>(
    target: EventTarget,
    name: string,
    callback: EventCallback<T>,
    useIndividualController?: boolean
  ): AbortController | null => {
    const eventName = this.makeName(name);
    const controller = new AbortController();

    target.addEventListener(
      eventName,
      (event: Event) => {
        const customEvent = event as CustomEvent<T>;

        callback(customEvent.detail);
      },
      {
        signal: useIndividualController
          ? controller.signal
          : this.globalController.signal,
      }
    );

    return useIndividualController ? controller : null;
  };

  once = <T>(
    target: EventTarget,
    name: string,
    callback: EventCallback<T>,
    useIndividualController?: boolean
  ): AbortController | null => {
    const eventName = this.makeName(name);
    const controller = new AbortController();

    target.addEventListener(
      eventName,
      (event: Event) => {
        const customEvent = event as CustomEvent<T>;

        callback(customEvent.detail);
      },
      {
        once: true,
        signal: useIndividualController
          ? controller.signal
          : this.globalController.signal,
      }
    );

    return useIndividualController ? controller : null;
  };

  emit = <T>(
    name: string,
    detail: T = null,
    target: EventTarget = document.body
  ): void => {
    const eventName = this.makeName(name);
    target.dispatchEvent(
      new CustomEvent<T>(eventName, {
        detail,
        bubbles: true,
        cancelable: true,
        composed: true,
      })
    );
  };

  destroyAll = () => {
    this.globalController.abort();
    this.globalController = new AbortController();
  };
}

export default Signal;
