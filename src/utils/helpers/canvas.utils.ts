/**
 * Extracts a frame from a video URL at a specific timestamp and returns a canvas.
 * @param videoUrl - The URL of the video.
 * @param timestamp - The timestamp (in seconds) to extract the frame from.
 * @param options - Optional settings for canvas dimensions.
 * @returns A promise that resolves with a canvas containing the frame.
 */
export async function extractFrameFromVideo(
  videoUrl: string,
  timestamp: number,
  options: { width?: number; height?: number } = {}
): Promise<HTMLCanvasElement> {
  return new Promise<HTMLCanvasElement>((resolve, reject) => {
    // Create a video element
    const video: HTMLVideoElement = document.createElement("video");

    video.crossOrigin = "anonymous"; // Handle CORS if needed
    video.preload = "metadata";
    video.muted = true; // Autoplay policies require muted videos
    video.playsInline = true; // For iOS compatibility

    // Create a canvas
    const canvas: HTMLCanvasElement = document.createElement("canvas");
    const ctx: CanvasRenderingContext2D = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not create canvas context");
    }

    // Set up video event listeners
    video.addEventListener("loadedmetadata", () => {
      // Set canvas dimensions (use video's native dimensions if not provided)
      canvas.width = options.width || video.videoWidth;
      canvas.height = options.height || video.videoHeight;

      // Seek to the specified timestamp
      video.currentTime = timestamp;
    });

    video.addEventListener("seeked", () => {
      // Draw the frame to the canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      resolve(canvas);
    });

    video.addEventListener("error", () => {
      reject(new Error("Failed to load or seek the video"));
    });

    // Start loading the video
    video.src = videoUrl;
    video.load();
  });
}
