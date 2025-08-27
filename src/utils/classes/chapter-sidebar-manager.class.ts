import { formatVideoTimeStamp } from "@utils/helpers/format.utils";
import Signal from "./signal.class";
import TimestampInputGroup from "./timestamp-group.class";

export type Chapter = {
  id: string;
  title: string;
  start: number;
  end: number;
  element: HTMLElement; // DOM node reference
  startInputGroup?: TimestampInputGroup;
};

class ChapterSideBarManager {
  public static readonly CHAPTER_MIN_LENGTH = 10;
  public static readonly MIN_CHAPTER_AMOUNT = 3;

  static get MIN_VIDEO_DURATION(): number {
    return (
      ChapterSideBarManager.MIN_CHAPTER_AMOUNT *
      ChapterSideBarManager.CHAPTER_MIN_LENGTH
    );
  }

  private chapters: Chapter[] = [];

  private container: HTMLElement;
  private template: HTMLTemplateElement;

  private videoDuration: number = NaN;

  public readonly signal = new Signal();

  constructor(container: HTMLElement) {
    this.container = container;

    // Create the template
    this.initializeTemplate();

    this.signal.on<{
      chapters: {
        id: string;
        start: number;
        end: number;
      }[];
    }>("chunk-chapters-updated", ({ chapters }) => {
      this.selectiveUpdateChapters(chapters);
    });

    this.signal.on<{ time: number }>("frame-preview-updated", ({ time }) => {
      const chapter: Chapter = this.getChapterFromDuration(time);
      this.signal.emit("chapter-for-frame", { chapter: chapter || null });
    });
  }

  get MAX_VIDEO_CHAPTERS(): number {
    return Math.floor(
      this.videoDuration / ChapterSideBarManager.CHAPTER_MIN_LENGTH
    );
  }

  get canHaveChapters(): boolean {
    return this.videoDuration >= ChapterSideBarManager.MIN_VIDEO_DURATION;
  }

  get sidebarClone(): HTMLElement {
    return this.template.content.firstElementChild!.cloneNode(
      true
    ) as HTMLElement;
  }

  private initializeTemplate = () => {
    this.template = document.createElement("template");

    this.template.innerHTML = /* html */ `
       <li class="video-timestamps__item" data-element="chapter">
      <h3 class="video-timestamps__item-title" data-element="chapter-heading">Intro</h3>
      <img src="" 
      class="video-timestamps__img"
      alt=""
      data-element="chapter-start-thumbnail"
      />

      <form class="video-timestamps__labels-container">
        <label class="video-timestamps__label">
          Title:
          <input 
            type="text" 
            class="video-timestamps__input video-timestamps__input--title" 
            data-element="chapter-title-input"
          />
        </label>

        <label class="video-timestamps__label">
          Start:
          <div data-element="chapter-start-input-container" class="video-timestamps__input-container"></div>
        </label>

        <label class="video-timestamps__label">
          End:
          <input 
            type="text" 
            class="video-timestamps__input video-timestamps__input--end" 
            data-element="chapter-end-input"
            readonly
          />
        </label>
      </form>

      <button 
        type="button" 
        class="video-timestamps__remove" 
        data-element="chapter-delete"
      >
        <i class="fa-solid fa-xmark video-timestamps__remove-icon"></i>
        <span class="video-timestamps__remove-text">Remove</span>
      </button>
    </li>
    `;
  };

  public getChapterFromDuration = (duration: number): Chapter | null => {
    const chapterWithinDuration: Chapter | null =
      this.chapters.find((chapter) => {
        const isWithinChapterBounds: boolean =
          duration >= chapter.start && duration <= chapter.end;
        return isWithinChapterBounds;
      }) || null;

    return chapterWithinDuration;
  };

  public getYoutubeTimestamps = () => {
    const titleTimestampsArray = this.chapters.map((chapter) => {
      const { start, title } = chapter;
      return {
        start,
        title,
      };
    });

    let youtubeTimestamps: string = "";

    const ONE_HOUR_IN_SECONDS: number = 3_600;
    const isVideoLongerThanAnHour: boolean =
      this.videoDuration >= ONE_HOUR_IN_SECONDS;

    for (const titleTimestamp of titleTimestampsArray) {
      const { start, title } = titleTimestamp;
      // ? We must force the hours padding IF the video duration is over an hour, otherwise the chapters ain't gonna work properly
      const formattedChapterStart: string = formatVideoTimeStamp(
        start,
        isVideoLongerThanAnHour
      );

      youtubeTimestamps += `${formattedChapterStart} ${title}\n`;
    }

    return youtubeTimestamps;
  };

  public setVideoDuration = (duration: number) => {
    if (duration < ChapterSideBarManager.MIN_VIDEO_DURATION) {
      console.warn(
        `Video duration ${duration}s is less than minimum required ${ChapterSideBarManager.MIN_VIDEO_DURATION}s`
      );
      return;
    }

    this.videoDuration = Math.floor(duration);
  };

  /** Creates a DOM node for a chapter from the template */
  private createChapterElement = (
    title: string,
    start: number,
    end: number
  ): HTMLElement => {
    const clone: HTMLElement = this.sidebarClone;

    const titleHeading = clone.querySelector<HTMLHeadingElement>(
      '[data-element="chapter-heading"]'
    );
    const titleInput = clone.querySelector<HTMLInputElement>(
      '[data-element="chapter-title-input"]'
    );
    const startInputContainer = clone.querySelector<HTMLDivElement>(
      '[data-element="chapter-start-input-container"]'
    );
    const endInput = clone.querySelector<HTMLInputElement>(
      '[data-element="chapter-end-input"]'
    );

    if (titleHeading) titleHeading.textContent = title;
    if (titleInput) titleInput.value = title;
    if (endInput) {
      const formattedInput: string = formatVideoTimeStamp(end);
      endInput.value = formattedInput;
    }

    // Create and insert the timestamp input group
    if (startInputContainer) {
      const ONE_HOUR_IN_SECONDS = 3_600;
      const showHours = this.videoDuration >= ONE_HOUR_IN_SECONDS;
      const timestampGroup = new TimestampInputGroup(showHours);
      timestampGroup.setFromSeconds(start);
      startInputContainer.appendChild(timestampGroup.element);

      // Store reference for later use
      (clone as any)._timestampGroup = timestampGroup;
    }

    return clone;
  };

  /** Creates the first chapter spanning the whole video */
  public createInitialChapter = () => {
    const title = "Intro";
    const element = this.createChapterElement(title, 0, this.videoDuration);
    const timestampGroup = (element as any)._timestampGroup;

    const chapter: Chapter = {
      id: crypto.randomUUID(),
      title,
      start: 0,
      end: this.videoDuration,
      element,
      startInputGroup: timestampGroup,
    };

    this.chapters.push(chapter);
    this.container.appendChild(chapter.element!);
    this.attachEventListeners(chapter);
    this.normalizeChapterInputs();

    this.signal.emit("chapter-added", {
      chapter,
      chapters: this.chapters,
    });
    this.signal.emit("timestamp-output-update");
  };

  private getChapterDuration = (chapter: Chapter): number => {
    return chapter.end - chapter.start;
  };

  public addChapter = () => {
    if (this.chapters.length >= this.MAX_VIDEO_CHAPTERS) {
      console.warn("Max chapter limit reached");
      return;
    }

    const newTitle = `Chapter ${this.chapters.length + 1}`;

    // * Find the last chapter that's long enough to split
    let chapterToShrink = null;
    for (let i = this.chapters.length - 1; i >= 0; i--) {
      const chapter = this.chapters[i];
      const currentLength = chapter.end - chapter.start;

      if (currentLength >= ChapterSideBarManager.CHAPTER_MIN_LENGTH * 2) {
        chapterToShrink = chapter;
        break;
      }
    }

    // * Create the new chapter
    const newChapter = this.createNewChapter(newTitle);

    if (chapterToShrink) {
      // * Shrink the donor chapter
      chapterToShrink.end -= ChapterSideBarManager.CHAPTER_MIN_LENGTH;

      // * Shift all chapters after the donor to make room
      const donorIndex = this.chapters.indexOf(chapterToShrink);
      for (let i = donorIndex + 1; i < this.chapters.length; i++) {
        const chapter: Chapter = this.chapters[i];
        chapter.start -= ChapterSideBarManager.CHAPTER_MIN_LENGTH;
        chapter.end -= ChapterSideBarManager.CHAPTER_MIN_LENGTH;
        this.updateChapterDOM(chapter);
      }

      // * Place new chapter at the end
      newChapter.start =
        this.videoDuration - ChapterSideBarManager.CHAPTER_MIN_LENGTH;
      newChapter.end = this.videoDuration;

      this.updateChapterDOM(chapterToShrink);
    } else {
      // * No room to shrink - just append at the end
      const lastChapter = this.chapters.at(-1);
      const start = lastChapter ? lastChapter.end : 0;
      newChapter.start = start;
      newChapter.end = Math.min(
        this.videoDuration,
        start + ChapterSideBarManager.CHAPTER_MIN_LENGTH
      );
    }

    // * Add the new chapter
    this.chapters.push(newChapter);
    this.container.appendChild(newChapter.element);
    this.updateChapterDOM(newChapter);
    this.attachEventListeners(newChapter);
    this.normalizeChapterInputs();

    this.signal.emit("chapter-added", {
      chapter: newChapter,
      chapters: this.chapters,
    });
    this.signal.emit("timestamp-output-update");
  };

  private updateChapterDOM = (chapter: Chapter): void => {
    const { title, element, start, end } = chapter;
    const titleHeading = element.querySelector<HTMLElement>(
      '[data-element="chapter-heading"]'
    );
    const titleInput = element.querySelector<HTMLInputElement>(
      '[data-element="chapter-title-input"]'
    );
    const endInput = element.querySelector<HTMLInputElement>(
      '[data-element="chapter-end-input"]'
    );

    if (titleHeading) titleHeading.textContent = title;
    if (titleInput) titleInput.value = title;
    if (endInput) {
      const formattedInput: string = formatVideoTimeStamp(end);
      endInput.value = formattedInput;
    }

    // Update timestamp input group
    if (chapter.startInputGroup) {
      chapter.startInputGroup.setFromSeconds(start);
    }
  };

  private attachEventListeners = (chapter: Chapter): void => {
    const titleInput = chapter.element.querySelector<HTMLInputElement>(
      '[data-element="chapter-title-input"]'
    );
    const deleteButton = chapter.element.querySelector<HTMLButtonElement>(
      '[data-element="chapter-delete"]'
    );

    if (titleInput) {
      titleInput.addEventListener("input", (event) =>
        this.onTitleInput(chapter, event)
      );
    }

    // Set up timestamp input group change handler
    if (chapter.startInputGroup) {
      chapter.startInputGroup.onChange((totalSeconds) => {
        this.onStartInputChange(chapter, totalSeconds);
      });
    }

    if (deleteButton) {
      deleteButton.addEventListener("click", () => this.onDeleteClick(chapter));
    }
  };

  // Handlers

  private onTitleInput = (chapter: Chapter, event: Event): void => {
    const input = event.target as HTMLInputElement;
    chapter.title = input.value;
    const heading = chapter.element.querySelector<HTMLHeadingElement>(
      ".video-timestamps__item-title"
    );
    if (heading) {
      heading.textContent = chapter.title;
      this.signal.emit("timestamp-output-update");
    }
  };

  private onStartInputChange = (chapter: Chapter, newStart: number): void => {
    if (
      !this.validateStartChange(chapter.id, newStart) ||
      Number.isNaN(newStart)
    ) {
      // Reset to previous value
      if (chapter.startInputGroup) {
        chapter.startInputGroup.setFromSeconds(chapter.start);
      }
      return;
    }

    const index = this.findChapterIndex(chapter.id);
    const prev = this.chapters[index - 1];
    const next = this.chapters[index + 1];

    // Update the current chapter's start
    chapter.start = newStart;

    // Update neighbors if they exist
    if (prev) {
      prev.end = newStart;
      this.updateChapterDOM(prev);
      this.signal.emit("chapter-updated", { chapter: prev });
    }

    if (next) {
      // Optional: you might want to enforce something for next.start if needed
      this.updateChapterDOM(next);
      this.signal.emit("chapter-updated", { chapter: next });
    }

    // Update current chapter
    this.updateChapterDOM(chapter);
    this.signal.emit("chapter-updated", { chapter });

    // Update timestamp output
    this.signal.emit("timestamp-output-update");
  };

  private onDeleteClick = (chapter: Chapter): void => {
    console.log("click on chapter to delete", chapter);
    this.removeChapter(chapter.id);
  };

  private validateStartChange = (
    chapterId: string,
    newStart: number
  ): boolean => {
    const index = this.findChapterIndex(chapterId);

    const chapter = this.chapters[index];
    const prev = this.chapters[index - 1];
    const next = this.chapters[index + 1];

    // * Must be within video bounds
    if (newStart < 0 || newStart > this.videoDuration) {
      console.error("Invalid start time:", newStart);
      return false;
    }

    // * Must keep current chapter >= 10s
    if (chapter.end - newStart < ChapterSideBarManager.CHAPTER_MIN_LENGTH) {
      console.error("Current chapter is too short:", chapter);
      return false;
    }

    // * Must keep previous chapter >= 10s
    if (
      prev &&
      newStart - prev.start < ChapterSideBarManager.CHAPTER_MIN_LENGTH
    ) {
      console.error("Previous chapter is too short:", prev);
      return false;
    }

    // * Must keep next chapter >= 10s
    if (
      next &&
      next.end - newStart < ChapterSideBarManager.CHAPTER_MIN_LENGTH
    ) {
      console.error("Next chapter is too short:", next);
      return false;
    }

    return true;
  };

  private normalizeChapterInputs = (): void => {
    for (let i = 0; i < this.chapters.length; i++) {
      const chapter = this.chapters[i];

      if (chapter.startInputGroup) {
        if (i === 0) {
          chapter.startInputGroup.setReadonly(true);
          chapter.startInputGroup.setFromSeconds(0);
        } else {
          chapter.startInputGroup.setReadonly(false);
        }
      }
    }
  };

  public removeChapter = (chapterId: string): void => {
    const index = this.findChapterIndex(chapterId);
    if (this.chapters.length <= 1) {
      console.warn("Cannot delete the only chapter.");
      return;
    }

    const chapter = this.chapters[index];
    const prev = this.chapters[index - 1];
    const next = this.chapters[index + 1];

    this.adjustNeighborsOnDelete(prev, next);

    // * Remove from DOM and array
    chapter.element.remove();
    this.chapters.splice(index, 1);
    this.normalizeChapterInputs();

    this.signal.emit("chapter-deleted", {
      id: chapter.id,
      chapters: this.chapters,
    });
    this.signal.emit("timestamp-output-update");
    console.log("Remaining chapters:", this.chapters);
  };

  private adjustNeighborsOnDelete = (prev?: Chapter, next?: Chapter): void => {
    if (prev && next) {
      // * deleting middle → bridge gap
      prev.end = next.start;
      this.updateChapterDOM(prev);
    } else if (!prev && next) {
      // * deleting first → next start = 0
      next.start = 0;
      this.updateChapterDOM(next);
    } else if (prev && !next) {
      // * deleting last → prev end = videoDuration
      prev.end = this.videoDuration;
      this.updateChapterDOM(prev);
    }
  };

  private findChapterIndex = (id: string): number => {
    return this.chapters.findIndex((c) => c.id === id);
  };

  private createNewChapter = (
    title: string,
    start: number = NaN,
    end: number = NaN
  ): Chapter => {
    const chapterElement: HTMLElement = this.createChapterElement(
      title,
      start,
      end
    );
    const timestampGroup = (chapterElement as any)._timestampGroup;

    return {
      id: crypto.randomUUID(),
      title,
      start: 0,
      end: 0,
      element: chapterElement,
      startInputGroup: timestampGroup,
    };
  };

  public getChapters() {
    return this.chapters;
  }

  public syncWithChunks = (
    chaptersFromChunks: { id: string; start: number; end: number }[]
  ) => {
    // Keep a quick lookup of titles from the current list
    const titleMap = new Map(this.chapters.map((c) => [c.id, c.title]));

    // Clear current DOM + internal list
    this.container.innerHTML = "";
    this.chapters = [];

    // Rebuild based on chunks
    for (let i = 0; i < chaptersFromChunks.length; i++) {
      const { id, start, end } = chaptersFromChunks[i];
      const title =
        titleMap.get(id) || (i === 0 ? "Intro" : `Chapter ${i + 1}`);

      const element = this.createChapterElement(title, start, end);
      const timestampGroup = (element as any)._timestampGroup;

      const chapter: Chapter = {
        id,
        title,
        start,
        end,
        element,
        startInputGroup: timestampGroup,
      };

      this.chapters.push(chapter);
      this.container.appendChild(chapter.element);
      this.attachEventListeners(chapter);
    }

    this.normalizeChapterInputs();

    this.signal.emit("chapters-synced", { chapters: this.chapters });
    this.signal.emit("timestamp-output-update");
  };

  public selectiveUpdateChapters = (
    chaptersFromChunks: { id: string; start: number; end: number }[]
  ) => {
    let hasChanges = false;

    // Only update chapters that have actually changed
    for (let i = 0; i < chaptersFromChunks.length; i++) {
      const { id, start, end } = chaptersFromChunks[i];
      const existingChapter = this.chapters.find((c) => c.id === id);

      if (existingChapter) {
        // Check if values have actually changed to avoid unnecessary updates
        const startChanged = Math.abs(existingChapter.start - start) > 0.01;
        const endChanged = Math.abs(existingChapter.end - end) > 0.01;

        if (startChanged || endChanged) {
          existingChapter.start = start;
          existingChapter.end = end;
          this.updateChapterDOM(existingChapter);
          hasChanges = true;
        }
      }
    }

    // Only emit if there were actual changes
    if (hasChanges) {
      this.signal.emit("timestamp-output-update");
    }
  };
}

export default ChapterSideBarManager;
