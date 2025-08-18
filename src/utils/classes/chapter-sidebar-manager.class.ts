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

  constructor(container: HTMLElement) {
    this.container = container;

    // Create the template
    this.initializeTemplate();
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

  get sidebarClone() {
    return this.template.content.firstElementChild!.cloneNode(
      true
    ) as HTMLElement;
  }

  get NEW_CHAPTER_LENGTH() {
    return 1;
  }

  public setVideoDuration = (duration: number) => {
    this.videoDuration = duration;
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

    // TODO: emit event to ProgressBarManager to update the progress bar
  };

  private getChapterDuration = (chapter: Chapter): number => {
    return chapter.end - chapter.start;
  };

  public addChapter = () => {
    const newTitle: string = `Chapter ${this.chapters.length + 1}`;
    const newChapter: Chapter = this.createNewChapter(
      newTitle,
      this.NEW_CHAPTER_LENGTH
    );

    this.chapters.push(newChapter);

    let cumulativeStartTime = 0;
    for (let i = 0; i < this.chapters.length; i++) {
      const chap = this.chapters[i];

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

    this.container.appendChild(newChapter.element!);
    console.log(this.chapters);
  };

  /** Helper to get total length of all chapters after index i */
  private getRemainingChaptersLength = (
    index: number,
    newChapter: Chapter
  ): number => {
    let sum = 0;
    for (let j = index + 1; j < this.chapters.length; j++) {
      const c = this.chapters[j];
      sum +=
        c === newChapter ? this.NEW_CHAPTER_LENGTH : this.getChapterDuration(c);
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
