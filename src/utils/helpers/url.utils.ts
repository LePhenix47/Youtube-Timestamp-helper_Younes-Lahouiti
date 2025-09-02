/**
 * Utility functions for URL validation and video URL handling
 */

export type UrlValidationResult = {
  success: boolean;
  error?: string;
  duration?: number;
};

/**
 * Validates if a URL is a valid video URL by attempting to load it as a video source
 * @param url - The URL to validate
 * @returns Promise resolving to validation result with duration if successful
 */
export const validateVideoUrl = async (url: string): Promise<UrlValidationResult> => {
  return new Promise((resolve) => {
    // First, validate URL format
    try {
      new URL(url);
    } catch {
      resolve({
        success: false,
        error: "Invalid URL format. Please enter a valid URL.",
      });
      return;
    }

    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true; // Prevent audio issues during validation

    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("error", onError);
      video.removeEventListener("abort", onError);
      if (video.src) {
        URL.revokeObjectURL(video.src);
      }
      video.src = "";
    };

    const onLoadedMetadata = () => {
      const duration = video.duration;
      cleanup();
      
      if (!duration || !isFinite(duration) || duration <= 0) {
        resolve({
          success: false,
          error: "Unable to determine video duration. The URL may not contain a valid video.",
        });
        return;
      }

      resolve({
        success: true,
        duration: duration,
      });
    };

    const onError = () => {
      cleanup();
      resolve({
        success: false,
        error: "Unable to load video from URL. Please check the URL and ensure it points to a valid video file.",
      });
    };

    // Set up event listeners
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("error", onError);
    video.addEventListener("abort", onError);

    // Add timeout to prevent hanging
    const timeout = setTimeout(() => {
      cleanup();
      resolve({
        success: false,
        error: "Request timed out. The video URL may be too slow to load or invalid.",
      });
    }, 10000); // 10 second timeout

    video.addEventListener("loadedmetadata", () => clearTimeout(timeout));
    video.addEventListener("error", () => clearTimeout(timeout));

    try {
      video.src = url;
      video.load();
    } catch (error) {
      clearTimeout(timeout);
      cleanup();
      resolve({
        success: false,
        error: "Failed to load URL. Please ensure the URL is accessible and points to a video file.",
      });
    }
  });
};

/**
 * Checks if a URL appears to be a video file based on common video file extensions
 * @param url - The URL to check
 * @returns true if the URL appears to point to a video file
 */
export const isLikelyVideoUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    
    const videoExtensions = [
      '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', 
      '.m4v', '.3gp', '.ogv', '.ts', '.m3u8'
    ];
    
    return videoExtensions.some(ext => pathname.includes(ext));
  } catch {
    return false;
  }
};

/**
 * Creates a File-like object from a URL for compatibility with existing FileDropManager
 * This allows URLs to be processed using the same validation pipeline as files
 */
export class UrlFile extends File {
  public readonly url: string;
  public readonly isUrlFile = true;

  constructor(url: string, duration?: number) {
    // Create a minimal File object with the URL as name
    const urlObj = new URL(url);
    const fileName = urlObj.pathname.split('/').pop() || 'video-from-url';
    
    // Use empty Blob since we'll be setting src directly
    super([], fileName, { type: 'video/url' });
    
    this.url = url;
    
    // Store duration if provided
    if (duration !== undefined) {
      Object.defineProperty(this, '_duration', {
        value: duration,
        writable: false,
        enumerable: false,
      });
    }
  }

  get duration(): number | undefined {
    return (this as any)._duration;
  }
}