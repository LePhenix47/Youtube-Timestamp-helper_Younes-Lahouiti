type FileValidationResult = string | undefined;
type FileValidationFn = (file: File) => Promise<FileValidationResult>;
type FileUploadCallback = (file: File, eventType: Event["type"]) => void;
type FileUploadErrorCallback = (
  file: File,
  errorMessage: string,
  eventType: Event["type"]
) => void;
type DragCallback = (event: Event) => void;
type DropCallback = (file: File, event: DragEvent) => void;
type UrlUploadCallback = (url: string, eventType: Event["type"]) => void;

class FileDropManager {
  private dropZone: HTMLElement;
  private fileInput: HTMLInputElement;
  private urlInput?: HTMLInputElement;
  private fileValidation?: FileValidationFn;
  private onFileUploadCallback?: FileUploadCallback;
  private onUrlUploadCallback?: UrlUploadCallback;
  private onFileUploadErrorCallback?: FileUploadErrorCallback;
  private onDragEnterCallback?: DragCallback;
  private onDragLeaveCallback?: DragCallback;
  private onDropCallback?: DropCallback;
  private onDragOverCallback?: DragCallback; // New property for onDragOver callback
  private abortController: AbortController = new AbortController();
  private urlButton: HTMLButtonElement;

  constructor(dropZone: HTMLElement, fileInput: HTMLInputElement) {
    if (!(dropZone instanceof HTMLElement)) {
      throw new Error("Invalid drop zone element");
    }
    if (!(fileInput instanceof HTMLInputElement)) {
      throw new Error("Invalid file input element");
    }
    if (fileInput.type !== "file") {
      throw new Error("Invalid file input type");
    }
    this.dropZone = dropZone;
    this.fileInput = fileInput;

    // Find URL input and button in the same parent container as dropZone
    const container = dropZone.parentElement;
    this.urlInput = container?.querySelector<HTMLInputElement>(
      '[data-element="upload-video-url-input"]'
    )!;
    this.urlButton = container?.querySelector<HTMLButtonElement>(
      '[data-element="upload-video-url-button"]'
    )!;

    this.setupEvents();
  }

  public setFileValidation = (fn: FileValidationFn): this => {
    this.fileValidation = fn;
    return this;
  };

  public onFileUpload = (fn: FileUploadCallback): this => {
    this.onFileUploadCallback = fn;
    return this;
  };

  public onUrlUpload = (fn: UrlUploadCallback): this => {
    this.onUrlUploadCallback = fn;
    return this;
  };

  public onFileUploadError = (fn: FileUploadErrorCallback): this => {
    this.onFileUploadErrorCallback = fn;
    return this;
  };

  public onDragEnter = (fn: DragCallback): this => {
    this.onDragEnterCallback = fn;
    return this;
  };

  public onDragLeave = (fn: DragCallback): this => {
    this.onDragLeaveCallback = fn;
    return this;
  };

  public onDrop = (fn: DropCallback): this => {
    this.onDropCallback = fn;
    return this;
  };

  // New method to set the onDragOver callback
  public onDragOver = (fn: DragCallback): this => {
    this.onDragOverCallback = fn;
    return this;
  };

  private setupEvents = (): void => {
    const { signal } = this.abortController;

    this.fileInput.addEventListener(
      "change",
      (event: Event) => {
        const input = event.target as HTMLInputElement;
        if (!input.files?.length) return;
        this.handleFile(input.files[0], event.type);
      },
      { signal }
    );

    document.addEventListener(
      "paste",
      (event: ClipboardEvent) => {
        const { activeElement } = document;
        const isFocusedOnDifferentInput: boolean =
          activeElement !== this.fileInput &&
          activeElement !== this.urlInput &&
          ["input", "textarea"].includes(activeElement?.tagName.toLowerCase());
        if (isFocusedOnDifferentInput) return;

        const items: DataTransferItemList = event.clipboardData?.items;
        if (!items) return;

        // Check for files first
        const file: File = items[0]?.getAsFile();
        if (file) {
          this.handleFile(file, event.type);
          return;
        }

        // Allow normal paste behavior for URL input without auto-execution
      },
      { signal }
    );

    // Handle URL button click
    if (this.urlButton) {
      this.urlButton.addEventListener(
        "click",
        () => {
          this.handleUrlInput("click");
        },
        { signal }
      );
    }

    // Handle Enter key on URL input as shortcut
    if (this.urlInput) {
      this.urlInput.addEventListener(
        "keydown",
        (event: KeyboardEvent) => {
          if (event.key === "Enter") {
            event.preventDefault();
            this.handleUrlInput("keydown");
          }
        },
        { signal }
      );
    }

    this.dropZone.addEventListener(
      "dragenter",
      (event) => {
        event.preventDefault();
        this.onDragEnterCallback?.(event);
      },
      { signal }
    );

    this.dropZone.addEventListener(
      "dragleave",
      (event) => {
        this.onDragLeaveCallback?.(event);
      },
      { signal }
    );

    this.dropZone.addEventListener(
      "dragover",
      (event) => {
        event.preventDefault();
        this.onDragOverCallback?.(event); // Call the onDragOver callback
      },
      { signal }
    );

    this.dropZone.addEventListener(
      "drop",
      (event: DragEvent) => {
        event.preventDefault();
        if (!event.dataTransfer?.files?.length) return;
        const file: File = event.dataTransfer.files[0];
        this.onDropCallback?.(file, event);
        this.handleFile(file, event.type);
      },
      { signal }
    );
  };

  private handleFile = async (file: File, eventType: string): Promise<void> => {
    if (!this.fileValidation) {
      this.onFileUploadCallback?.(file, eventType);
      return;
    }
    try {
      const validationResult: FileValidationResult = await this.fileValidation(
        file
      );
      if (validationResult) {
        console.error("File validation error:", validationResult);
        this.onFileUploadErrorCallback?.(file, validationResult, eventType);
        return;
      }
      this.onFileUploadCallback?.(file, eventType);
    } catch (error) {
      console.error("File validation error:", error);
      this.onFileUploadErrorCallback?.(file, "Validation failed", eventType);
    }
  };

  private handleUrlInput = (eventType: string): void => {
    if (!this.urlInput || !this.urlInput.value.trim()) return;

    const url = this.urlInput.value.trim();

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return; // Invalid URL, don't process
    }

    // Clear the input after processing
    this.urlInput.value = "";

    // Call the URL upload callback
    this.onUrlUploadCallback?.(url, eventType);
  };

  public destroy = (): void => {
    this.abortController.abort();
    this.abortController = new AbortController();
    this.fileInput.value = "";
  };
}

export default FileDropManager;
