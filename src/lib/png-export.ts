export type PngDraw = (context: CanvasRenderingContext2D, width: number, height: number) => void;

/**
 * Generates a PNG entirely in the browser after a deliberate button press.
 * No report content is sent to a server or third-party service.
 */
export async function downloadCanvasPng(options: {
  filename: string;
  width: number;
  height: number;
  draw: PngDraw;
}) {
  // Always render at 2× so the image stays sharp when shared or zoomed on a
  // phone, but stay under iOS Safari's ~16.7-megapixel canvas limit.
  const maxPixels = 16_000_000;
  const pixelRatio = Math.max(1, Math.min(2, Math.sqrt(maxPixels / (options.width * options.height))));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(options.width * pixelRatio);
  canvas.height = Math.round(options.height * pixelRatio);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PNG drawing is unavailable in this browser.");

  context.scale(pixelRatio, pixelRatio);
  options.draw(context, options.width, options.height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG generation failed.")), "image/png");
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = options.filename;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
