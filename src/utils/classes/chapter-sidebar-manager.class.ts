type Chapter = {
  id: string;
  title: string;
  start: number;
  end: number;
  element?: HTMLElement; // DOM node reference
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
    const newChapterLength = 1; // New chapter length in seconds
    const newTitle = `Chapter ${this.chapters.length + 1}`;

    // Step 1: Create the new chapter element (we’ll assign start/end later)
    const chapterElement = this.createChapterElement(newTitle, 0, 0);

    const newChapter: Chapter = {
      id: crypto.randomUUID(),
      title: newTitle,
      start: 0,
      end: 0,
      element: chapterElement,
    };

    // Step 2: Append the new chapter to the chapters array
    this.chapters.push(newChapter);

    // Step 3: Recompute start & end for all chapters
    let elapsed = 0; // Cumulative start time
    for (let i = 0; i < this.chapters.length; i++) {
      const chap = this.chapters[i];

      if (i < this.chapters.length - 1) {
        // All chapters except last: end = videoDuration - sum(lengths of remaining chapters)
        const remainingLength = this.chapters
          .slice(i + 1)
          .reduce(
            (sum, c) =>
              sum +
              (c === newChapter
                ? newChapterLength
                : this.getChapterDuration(c)),
            0
          );

        chap.start = elapsed;
        chap.end = this.videoDuration - remainingLength;
        elapsed = chap.end;
      } else {
        // Last chapter always ends at videoDuration
        chap.start = elapsed;
        chap.end = this.videoDuration;
      }

      // Update DOM inputs
      const startInput = chap.element?.querySelector<HTMLInputElement>(
        ".video-timestamps__input--start"
      );
      const endInput = chap.element?.querySelector<HTMLInputElement>(
        ".video-timestamps__input--end"
      );
      if (startInput) startInput.value = `${chap.start}`;
      if (endInput) endInput.value = `${chap.end}`;
    }

    // Step 4: Append the new chapter DOM element to container
    this.container.appendChild(chapterElement);

    console.log(this.chapters); // Debug
  };

  public getChapters() {
    return this.chapters;
  }
}

export default ChapterSideBarManager;
