// Browser-only PDF → page images (PNG data URLs) using pdfjs-dist.
// Must only be called from event handlers / client-side code.

export async function renderPdfToImages(
  file: File,
  opts: { scale?: number } = {},
): Promise<string[]> {
  const scale = opts.scale ?? 2; // ~200dpi at default PDF resolution
  // Dynamic import keeps pdfjs out of SSR bundles.
  const pdfjs = await import("pdfjs-dist");
  // Worker setup — bundled by Vite.
  // @ts-expect-error worker module URL
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;

  const images: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context indisponible");
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    // JPEG keeps payload small for the AI Gateway.
    images.push(canvas.toDataURL("image/jpeg", 0.85));
    page.cleanup();
  }
  return images;
}
