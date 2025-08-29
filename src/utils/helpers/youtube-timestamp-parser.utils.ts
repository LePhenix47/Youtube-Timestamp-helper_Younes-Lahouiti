/**
 * Utility functions for parsing YouTube timestamp strings into chapters
 */

import { formatVideoTimeStamp } from "./format.utils";

export interface ParsedChapter {
  title: string;
  start: number; // in seconds
}

export interface ParseResult {
  success: boolean;
  chapters?: ParsedChapter[];
  errors?: string[];
}

/**
 * Converts timestamp string to seconds
 * Supports: "1:23" (1:23), "12:34" (12:34), "1:23:45" (1h 23m 45s)
 */
function parseTimestampToSeconds(timestamp: string): number | null {
  const parts = timestamp.split(":").map(part => parseInt(part, 10));
  
  // Check if all parts are valid numbers
  if (parts.some(isNaN)) return null;

  if (parts.length === 2) {
    // Format: M:SS or MM:SS
    const [minutes, seconds] = parts;
    if (seconds >= 60) return null;
    return minutes * 60 + seconds;
    
  } else if (parts.length === 3) {
    // Format: H:MM:SS
    const [hours, minutes, seconds] = parts;
    if (minutes >= 60 || seconds >= 60) return null;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return null;
}

/**
 * Validates and parses a YouTube timestamp string into chapters
 */
export function parseYouTubeTimestamps(input: string, videoDuration?: number): ParseResult {
  const errors: string[] = [];
  const chapters: ParsedChapter[] = [];

  // Basic input validation
  if (!input.trim()) {
    return { success: false, errors: ["Input cannot be empty"] };
  }

  const lines = input.trim().split("\n").map(line => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return { success: false, errors: ["No valid chapters found"] };
  }

  // Parse each line: "timestamp title"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    
    const spaceIndex = line.indexOf(" ");
    if (spaceIndex === -1) {
      errors.push(`Line ${lineNumber}: Missing title (format: "timestamp title")`);
      continue;
    }

    const timestampStr = line.substring(0, spaceIndex).trim();
    const title = line.substring(spaceIndex + 1).trim();

    if (!title) {
      errors.push(`Line ${lineNumber}: Title cannot be empty`);
      continue;
    }

    const seconds = parseTimestampToSeconds(timestampStr);
    if (seconds === null) {
      errors.push(`Line ${lineNumber}: Invalid timestamp "${timestampStr}" (use M:SS or H:MM:SS)`);
      continue;
    }

    chapters.push({ title, start: seconds });
  }

  if (chapters.length === 0) {
    return { success: false, errors: errors.length > 0 ? errors : ["No valid chapters found"] };
  }

  // Validate YouTube chapter requirements
  
  // Rule 1: First chapter must start at 0:00
  if (chapters[0].start !== 0) {
    errors.push("First chapter must start at 0:00");
  }

  // Rule 2: Need at least 3 chapters
  if (chapters.length < 3) {
    errors.push(`YouTube requires at least 3 chapters (found ${chapters.length})`);
  }

  // Rule 3: Check ascending order and minimum 10-second duration
  for (let i = 0; i < chapters.length - 1; i++) {
    const current = chapters[i];
    const next = chapters[i + 1];

    // Check ascending order
    if (current.start >= next.start) {
      errors.push(`Chapters must be in time order: "${current.title}" (${formatVideoTimeStamp(current.start)}) comes before "${next.title}" (${formatVideoTimeStamp(next.start)})`);
    }

    // Check minimum 10-second duration
    const duration = next.start - current.start;
    if (duration < 10) {
      errors.push(`Chapter "${current.title}" is only ${duration}s long (minimum 10s required)`);
    }
  }

  // Rule 4: Check if chapters fit within video duration
  if (videoDuration) {
    const lastChapter = chapters[chapters.length - 1];
    if (lastChapter.start >= videoDuration) {
      errors.push(`Last chapter starts at ${formatVideoTimeStamp(lastChapter.start)} but video is only ${formatVideoTimeStamp(videoDuration)} long`);
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, chapters };
}
