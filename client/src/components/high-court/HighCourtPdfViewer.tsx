import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { AlertCircle, Loader2 } from "lucide-react";

type HighCourtPdfViewerProps = {
  source: string;
  zoom: number;
};

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export function HighCourtPdfViewer({ source, zoom }: HighCourtPdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nativeFallback, setNativeFallback] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => setContainerWidth(container.clientWidth);
    updateWidth();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateWidth);
      observer.observe(container);
      return () => observer.disconnect();
    }

    // ResizeObserver is missing in older Windows 7 browsers. A window
    // listener is sufficient for this fixed test workspace.
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: any = null;

    setPdfDocument(null);
    setLoading(true);
    setError("");
    setNativeFallback(false);

    const loadDocument = async () => {
      try {
        const response = await fetch(source, { credentials: "include" });
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("No PDF has been uploaded for this paper.");
          }
          throw new Error(`PDF request failed (${response.status})`);
        }

        const bytes = new Uint8Array(await response.arrayBuffer());
        if (!bytes.length) {
          throw new Error("The PDF response was empty.");
        }

        // Render pages with PDF.js instead of relying on the browser's
        // embedded PDF plugin, which rejects some valid older PDFs.
        loadingTask = pdfjsLib.getDocument({ data: bytes });
        let document;
        try {
          document = await loadingTask.promise;
        } catch (workerError) {
          // Some older browsers cannot start the module worker shipped by
          // newer PDF.js releases. Rendering on the main thread keeps the
          // paper usable instead of leaving an empty question panel.
          console.warn("High Court PDF worker unavailable; retrying without worker.", workerError);
          loadingTask = pdfjsLib.getDocument({ data: bytes, disableWorker: true } as any);
          document = await loadingTask.promise;
        }
        if (cancelled) {
          await document.destroy();
          return;
        }

        setPdfDocument(document);
        setLoading(false);
      } catch (reason) {
        if (cancelled) return;
        console.error(
          "Unable to render High Court Pitman PDF:",
          reason instanceof Error ? reason.message : reason,
        );
        setLoading(false);
        setError(reason instanceof Error ? reason.message : "The PDF could not be rendered. Please ask the administrator to upload it again.");
        setNativeFallback(true);
      }
    };

    void loadDocument();

    return () => {
      cancelled = true;
      if (loadingTask) void loadingTask.destroy();
    };
  }, [source]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !pdfDocument || !containerWidth) return;

    let cancelled = false;
    container.replaceChildren();

    const renderPages = async () => {
      try {
        for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
          if (cancelled) return;

          const page = await pdfDocument.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const fitScale = Math.max(0.5, (containerWidth - 24) / baseViewport.width);
          const viewport = page.getViewport({ scale: fitScale * (zoom / 100) });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas rendering is unavailable.");

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.className = "mx-auto mb-4 block h-auto max-w-none bg-white shadow-sm";
          container.appendChild(canvas);

          await page.render({ canvasContext: context, viewport }).promise;
        }
      } catch (reason) {
        if (!cancelled) {
          console.error("Unable to draw High Court Pitman PDF pages:", reason);
          setError("The PDF could not be rendered. Please ask the administrator to upload it again.");
        }
      }
    };

    void renderPages();
    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [containerWidth, pdfDocument, zoom]);

  return (
    <div className="relative h-full min-h-0 overflow-auto bg-slate-100 p-3">
      <div ref={containerRef} className="min-h-full min-w-0">
        {loading && (
          <div className="flex min-h-[460px] flex-col items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-7 w-7 animate-spin text-rose-600" />
            Loading question paper…
          </div>
        )}
        {!loading && error && (
          <>
            <div className="flex min-h-[460px] flex-col items-center justify-center gap-2 text-center text-sm text-slate-500">
              <AlertCircle className="h-10 w-10 text-red-400" />
              <span>{error}</span>
              {nativeFallback && (
                <object
                  data={source}
                  type="application/pdf"
                  aria-label="High Court question paper"
                  className="mt-3 h-[520px] w-full border border-slate-300 bg-white"
                >
                  <a href={source} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
                    Open the question paper in a new window
                  </a>
                </object>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}