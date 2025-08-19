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
    this.attachEventListeners(chapter, this.chapters.length - 1);

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

    this.attachEventListeners(newChapter, this.chapters.length - 1);

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

  private attachEventListeners = (chapter: Chapter, index: number): void => {
    const titleInput = chapter.element.querySelector<HTMLInputElement>(
      ".video-timestamps__input--title"
    );
    const startInput = chapter.element.querySelector<HTMLInputElement>(
      ".video-timestamps__input--start"
    );

    if (titleInput) {
      titleInput.addEventListener("input", () => {
        chapter.title = titleInput.value;
        const heading = chapter.element.querySelector<HTMLHeadingElement>(
          ".video-timestamps__item-title"
        );
        if (heading) heading.textContent = chapter.title;
      });
    }

    if (!startInput) {
      return;
    }

    // disable editing if only one chapter
    if (this.chapters.length === 1) {
      startInput.readOnly = true;
      return;
    }

    startInput.addEventListener("input", () => {
      const newStart = Number(startInput.value);

      // TODO: This shit is broken and annoying AF
      // When I input a new start time, IDK why but sometimes the chapter next to the first one bugs out and set the start & end to 0 0
      // Sometimes it's the first chapter that does that
      if (
        !this.validateStartChange(index, newStart) ||
        Number.isNaN(newStart)
      ) {
        // invalid → revert
        startInput.value = `${chapter.start}`;
        return;
      }

      // valid update
      chapter.start = newStart;

      // adjust previous chapter’s end
      if (index > 0) {
        this.chapters[index - 1].end = newStart;
        this.updateChapterDOM(this.chapters[index - 1]);
      }

      // re-render current
      this.updateChapterDOM(chapter);
    });
  };

  private validateStartChange = (index: number, newStart: number): boolean => {
    const chapter = this.chapters[index];
    const prev = this.chapters[index - 1];
    const next = this.chapters[index + 1];

    // Must be within video bounds
    if (newStart < 0 || newStart >= this.videoDuration) return false;

    // Must keep current chapter >= 10s
    if (chapter.end - newStart < this.CHAPTER_MIN_LENGTH) return false;

    // Must keep previous chapter >= 10s
    if (prev && newStart - prev.start < this.CHAPTER_MIN_LENGTH) return false;

    // Must keep next chapter >= 10s
    if (next && next.end - newStart < this.CHAPTER_MIN_LENGTH) return false;

    return true;
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
