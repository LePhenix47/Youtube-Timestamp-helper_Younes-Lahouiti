type FileValidationResult = string | undefined;
type FileValidationFn = (file: File) => FileValidationResult;
type FileUploadCallback = (file: File, eventType: Event["type"]) => void;
type FileUploadErrorCallback = (
  file: File,
  errorMessage: string,
  eventType: Event["type"]
) => void;

type DragCallback = (event: Event) => void;

class FileDropManager {
  private dropZone: HTMLElement;
  private fileInput: HTMLInputElement;
  private fileValidation?: FileValidationFn;
  private onFileUploadCallback?: FileUploadCallback;
  private onFileUploadErrorCallback?: FileUploadErrorCallback;
  private onDragEnterCallback?: DragCallback;
  private onDragLeaveCallback?: DragCallback;
  private abortController: AbortController = new AbortController();

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

  private setupEvents = (): void => {
    const { signal } = this.abortController;
    // ? Input change
    this.fileInput.addEventListener(
      "change",
      (event: Event) => {
        const input = event.target as HTMLInputElement;
        if (!input.files?.length) return;

        this.handleFile(input.files[0], event.type);
      },
      { signal }
    );

    // ? Paste event on document
    document.addEventListener(
      "paste",
      (event: ClipboardEvent) => {
        const { activeElement } = document;
        const isFocusedOnDifferentInput: boolean =
          activeElement !== this.fileInput &&
          ["input", "textarea"].includes(activeElement?.tagName.toLowerCase());

        if (isFocusedOnDifferentInput) return;

        const items: DataTransferItemList = event.clipboardData?.items;
        if (!items) return;

        const file: File = items[0].getAsFile();
        if (!file) {
          return;
        }

        this.handleFile(file, event.type);
      },
      { signal }
    );

    // ? Dropzone drag events
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
      },
      { signal }
    );

    this.dropZone.addEventListener(
      "drop",
      (event: DragEvent) => {
        event.preventDefault();
        if (!event.dataTransfer?.files?.length) return;

        const file: File = event.dataTransfer.files[0];
        this.handleFile(file, event.type);
      },
      { signal }
    );
  };

  private handleFile = (file: File, eventType: string): void => {
    if (!this.fileValidation) {
      this.onFileUploadCallback?.(file, eventType);
      return;
    }

    const validationResult: FileValidationResult = this.fileValidation(file);
    if (validationResult) {
      console.error("File validation error:", validationResult);
      this.onFileUploadErrorCallback?.(file, validationResult, eventType);
      return;
    }

    this.onFileUploadCallback?.(file, eventType);
  };

  public destroy = (): void => {
    this.abortController.abort();
    this.abortController = new AbortController();

    this.fileInput.value = "";
  };
}

export default FileDropManager;
