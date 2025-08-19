type Chapter = {
  id: string;
  title: string;
  start: number;
  end: number;
  element: HTMLElement; // DOM node reference
};

class ChapterSideBarManager {
  private chapters: Chapter[] = [];

  private container: HTMLElement;
  private template: HTMLTemplateElement;

  private videoDuration: number = NaN;

  public readonly CHAPTER_MIN_LENGTH = 10;
  public readonly MIN_CHAPTER_AMOUNT = 3;

  constructor(container: HTMLElement) {
    this.container = container;

    // Create the template
    this.initializeTemplate();
  }

  get MIN_VIDEO_DURATION(): number {
    return this.MIN_CHAPTER_AMOUNT * this.CHAPTER_MIN_LENGTH;
  }

  get MAX_VIDEO_CHAPTERS(): number {
    return Math.floor(this.videoDuration / this.CHAPTER_MIN_LENGTH);
  }

  get canHaveChapters(): boolean {
    return this.videoDuration >= this.MIN_VIDEO_DURATION;
  }

  private initializeTemplate = () => {
    this.template = document.createElement("template");

    this.template.innerHTML = /* html */ `
      <li class="video-timestamps__item" data-timestamp-id="">
        <h3 class="video-timestamps__item-title">Intro</h3>
        <img src="https://younes-portfolio-dev.vercel.app/_next/image?url=%2F_next%2Fstatic%2Fmedia%2FP4-DW-image.a91dea01.png&w=640&q=75" alt="" class="video-timestamps__img" />
        <form class="video-timestamps__labels-container">
          <label class="video-timestamps__label">Title:
            <input type="text" class="video-timestamps__input video-timestamps__input--title" />
          </label>
          <label class="video-timestamps__label">Start:
            <input type="text" class="video-timestamps__input video-timestamps__input--start" />
          </label>
          <label class="video-timestamps__label">End:
            <input type="text" class="video-timestamps__input video-timestamps__input--end" readonly />
          </label>
        </form>
        <button type="button" class="video-timestamps__remove">
          <i class="fa-solid fa-xmark video-timestamps__remove-icon"></i>
          <span class="video-timestamps__remove-text">Remove</span>
        </button>
      </li>
    `;
  };

  get sidebarClone(): HTMLElement {
    return this.template.content.firstElementChild!.cloneNode(
      true
    ) as HTMLElement;
  }

  public setVideoDuration = (duration: number) => {
    if (duration < this.MIN_VIDEO_DURATION) {
      console.warn(
        `Video duration ${duration}s is less than minimum required ${this.MIN_VIDEO_DURATION}s`
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
      ".video-timestamps__item-title"
    );
    const titleInput = clone.querySelector<HTMLInputElement>(
      ".video-timestamps__input--title"
    );
    const startInput = clone.querySelector<HTMLInputElement>(
      ".video-timestamps__input--start"
    );
    const endInput = clone.querySelector<HTMLInputElement>(
      ".video-timestamps__input--end"
    );

    if (titleHeading) titleHeading.textContent = title;
    if (titleInput) titleInput.value = title;
    if (startInput) startInput.value = `${start}`;
    if (endInput) endInput.value = `${end}`;

    return clone;
  };

  /** Creates the first chapter spanning the whole video */
  public createInitialChapter = () => {
    const title = "Intro";
    const chapter: Chapter = {
      id: crypto.randomUUID(),
      title,
      start: 0,
      end: this.videoDuration,
      element: this.createChapterElement(title, 0, this.videoDuration),
    };

    this.chapters.push(chapter);
    this.container.appendChild(chapter.element!);
    this.attachEventListeners(chapter);

    // TODO: emit event to ProgressBarManager to update the progress bar
  };

  private getChapterDuration = (chapter: Chapter): number => {
    return chapter.end - chapter.start;
  };

  public addChapter = () => {
    if (this.chapters.length >= this.MAX_VIDEO_CHAPTERS) {
      console.warn("Max chapter limit reached");
      return;
    }

    const newTitle: string = `Chapter ${this.chapters.length + 1}`;
    const newChapter: Chapter = this.createNewChapter(
      newTitle,
      this.CHAPTER_MIN_LENGTH
    );

    this.chapters.push(newChapter);

    let cumulativeStartTime = 0;
    for (let i = 0; i < this.chapters.length; i++) {
      const chap: Chapter = this.chapters[i];

      const isNotLastChapter = i < this.chapters.length - 1;
      if (isNotLastChapter) {
        // All chapters except last
        const remainingLength: number = this.getRemainingChaptersLength(
          i,
          newChapter
        );

        chap.start = cumulativeStartTime;
        chap.end = this.videoDuration - remainingLength;
        cumulativeStartTime = chap.end;
      } else {
        // Last chapter always ends at videoDuration
        chap.start = cumulativeStartTime;
        chap.end = this.videoDuration;
      }

      this.updateChapterDOM(chap);
    }

    this.attachEventListeners(newChapter);

    this.container.appendChild(newChapter.element!);
    console.log(this.chapters);

    // TODO: emit event to ProgressBarManager to add the progress bar
  };

  /** Helper to get total length of all chapters after index i */
  private getRemainingChaptersLength = (
    index: number,
    newChapter: Chapter
  ): number => {
    let sum: number = 0;
    for (let j = index + 1; j < this.chapters.length; j++) {
      const currentIteratedChapter: Chapter = this.chapters[j];
      sum +=
        currentIteratedChapter === newChapter
          ? this.CHAPTER_MIN_LENGTH
          : this.getChapterDuration(currentIteratedChapter);
    }
    return sum;
  };

  private updateChapterDOM = (chapter: Chapter): void => {
    const { title, element, start, end } = chapter;
    const titleHeading = element.querySelector<HTMLHeadingElement>(
      ".video-timestamps__item-title"
    );
    const titleInput = element.querySelector<HTMLInputElement>(
      ".video-timestamps__input--title"
    );
    const startInput = element.querySelector<HTMLInputElement>(
      ".video-timestamps__input--start"
    );
    const endInput = element.querySelector<HTMLInputElement>(
      ".video-timestamps__input--end"
    );

    if (titleHeading) titleHeading.textContent = title;
    if (titleInput) titleInput.value = title;
    if (startInput) startInput.value = `${start}`;
    if (endInput) endInput.value = `${end}`;
  };

  private attachEventListeners = (chapter: Chapter): void => {
    const titleInput = chapter.element.querySelector<HTMLInputElement>(
      ".video-timestamps__input--title"
    );
    const startInput = chapter.element.querySelector<HTMLInputElement>(
      ".video-timestamps__input--start"
    );
    const deleteButton = chapter.element.querySelector<HTMLButtonElement>(
      ".video-timestamps__remove"
    );

    if (titleInput) {
      titleInput.addEventListener("input", (event) =>
        this.onTitleInput(chapter, event)
      );
    }

    if (startInput) {
      startInput.addEventListener("input", (event) =>
        this.onStartInput(chapter, event)
      );
    }

    if (this.chapters.length <= 1) {
      startInput.readOnly = true;
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
    if (heading) heading.textContent = chapter.title;
  };

  private onStartInput = (chapter: Chapter, event: Event): void => {
    const input = event.target as HTMLInputElement;
    const newStart = Number(input.value);

    if (
      !this.validateStartChange(chapter.id, newStart) ||
      Number.isNaN(newStart)
    ) {
      input.value = `${chapter.start}`;
      return;
    }

    const index = this.findChapterIndex(chapter.id);
    chapter.start = newStart;

    if (index > 0) {
      this.chapters[index - 1].end = newStart;
      this.updateChapterDOM(this.chapters[index - 1]);
    }

    this.updateChapterDOM(chapter);
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
    if (newStart < 0 || newStart >= this.videoDuration) {
      console.error("Invalid start time:", newStart);
      return false;
    }

    // * Must keep current chapter >= 10s
    if (chapter.end - newStart < this.CHAPTER_MIN_LENGTH) {
      console.error("Current chapter is too short:", chapter);
      return false;
    }

    // * Must keep previous chapter >= 10s
    if (prev && newStart - prev.start < this.CHAPTER_MIN_LENGTH) {
      console.error("Previous chapter is too short:", prev);
      return false;
    }

    // * Must keep next chapter >= 10s
    if (next && next.end - newStart < this.CHAPTER_MIN_LENGTH) {
      console.error("Next chapter is too short:", next);
      return false;
    }

    return true;
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

    return {
      id: crypto.randomUUID(),
      title,
      start: 0,
      end: 0,
      element: chapterElement,
    };
  };

  public getChapters() {
    return this.chapters;
  }
}

export default ChapterSideBarManager;
