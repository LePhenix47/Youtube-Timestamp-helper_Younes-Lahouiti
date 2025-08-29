/**
 * Utility functions for parsing YouTube timestamp strings into chapters
 */

import ChapterSideBarManager, {
  Chapter,
} from "@utils/classes/chapter-sidebar-manager.class";
import { formatVideoTimeStamp } from "./format.utils";

export type ParsedChapter = Pick<Chapter, "title" | "start">;

export type ParseResult = {
  success: boolean;
  chapters?: ParsedChapter[];
  errors?: string[];
};

/**
 * Converts timestamp string to seconds
 * Supports: "1:23" (1m 23s → 83s) and "1:23:45" (1h 23m 45s →  5025s)
 */
function parseTimestampToSeconds(timestamp: string): number | null {
  const parts = timestamp.split(":").map((part) => Number(part));

  if (parts.some(Number.isNaN)) return null;

  const [first, second, third] = parts;

  switch (parts.length) {
    case 2: {
      const minutes = first;
      const seconds = second;
      if (seconds >= 60) return null;

      return minutes * 60 + seconds;
    }

    case 3: {
      const hours = first;
      const minutes = second;
      const seconds = third;
      if (minutes >= 60 || seconds >= 60) return null;

      return hours * 3_600 + minutes * 60 + seconds;
    }

    default:
      break;
  }

  return null;
}

/**
 * Validates and parses a YouTube timestamp string into chapters
 */
export function parseYouTubeTimestamps(
  input: string,
  videoDuration?: number
): ParseResult {
  if (!input.trim()) {
    return { success: false, errors: ["Input cannot be empty"] };
  }

  const lines = input
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) {
    return { success: false, errors: ["No valid chapters found"] };
  }

  // Parse all lines first
  const { chapters, errors } = parseLines(lines);
  if (!chapters.length) {
    return {
      success: false,
      errors: errors.length > 0 ? errors : ["No valid chapters found"],
    };
  }

  // Then validate YouTube requirements
  const validationErrors = validateChapterRequirements(chapters, videoDuration);
  const allErrors = [...errors, ...validationErrors];

  if (allErrors.length > 0) {
    return { success: false, errors: allErrors };
  }

  return { success: true, chapters };
}

/**
 * Parse individual lines into chapters
 */
function parseLines(lines: string[]) {
  const errors: string[] = [];
  const chapters: ParsedChapter[] = [];

  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];
    const result = parseLine(currentLine, i + 1);
    if (result.success) {
      chapters.push(result.chapter!);
    } else {
      errors.push(...result.errors!);
    }
  }

  return { chapters, errors };
}

/**
 * Parse a single line: "timestamp title"
 */
function parseLine(
  line: string,
  lineNumber: number
): { success: boolean; chapter?: ParsedChapter; errors?: string[] } {
  const [timestampStr, title] = line.split(/ (.+)/);

  if (!title?.trim()) {
    return {
      success: false,
      errors: [
        `Line ${lineNumber}: Missing title (format: "[timestamp] [title]")`,
      ],
    };
  }

  const seconds = parseTimestampToSeconds(timestampStr);
  if (typeof seconds !== "number") {
    return {
      success: false,
      errors: [
        `Line ${lineNumber}: Invalid timestamp "${timestampStr}" (use M:SS or H:MM:SS)`,
      ],
    };
  }

  return { success: true, chapter: { title: title.trim(), start: seconds } };
}

/**
 * Validate YouTube chapter requirements
 */
function validateChapterRequirements(
  chapters: ParsedChapter[],
  videoDuration?: number
): string[] {
  const errors: string[] = [];

  // * Rule 1: First chapter must start at 0:00
  if (chapters[0].start !== 0) {
    errors.push("First chapter must start at 0:00");
  }

  // * Rule 2: Need at least 3 chapters
  if (chapters.length < 3) {
    errors.push(
      `YouTube requires at least 3 chapters (found ${chapters.length})`
    );
  }

  // * Rule 3: Check order and duration between consecutive chapters
  for (let i = 0; i < chapters.length - 1; i++) {
    const current: ParsedChapter = chapters[i];
    const next: ParsedChapter = chapters[i + 1];

    if (current.start >= next.start) {
      errors.push(
        `Chapters must be in time order: "${
          current.title
        }" (${formatVideoTimeStamp(current.start)}) → "${
          next.title
        }" (${formatVideoTimeStamp(next.start)})`
      );
    }

    const duration: number = next.start - current.start;
    if (duration < ChapterSideBarManager.CHAPTER_MIN_LENGTH) {
      errors.push(
        `Chapter "${current.title}" is only ${duration}s long (minimum 10s required)`
      );
    }
  }

  // * Rule 4: Check if chapters fit within video duration
  if (videoDuration) {
    const lastChapter = chapters[chapters.length - 1];
    if (lastChapter.start >= videoDuration) {
      errors.push(
        `Last chapter starts at ${formatVideoTimeStamp(
          lastChapter.start
        )} but video is only ${formatVideoTimeStamp(videoDuration)} long`
      );
    }
  }

  return errors;
}
