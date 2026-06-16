import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { extractCarnetLines } from "@/lib/vaccine-extract.functions";

export const Route = createFileRoute("/_authenticated/vaccicheck")({
  component: VacciCheckPage,
});

type ExtractRequest = {
  type: "vc:extract";
  id: string;
  filename: string;
  images: string[];
};

function VacciCheckPage() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const extract = useServerFn(extractCarnetLines);

  useEffect(() => {
    const handler = async (ev: MessageEvent) => {
      const data = ev.data as ExtractRequest | undefined;
      if (!data || data.type !== "vc:extract") return;
      const iframe = iframeRef.current;
      if (!iframe || ev.source !== iframe.contentWindow) return;
      console.log("[VacciCheck] demande extraction reçue", {
        id: data.id,
        filename: data.filename,
        pages: data.images.length,
      });

      const reply = (payload: Record<string, unknown>) => {
        iframe.contentWindow?.postMessage(
          { type: "vc:extract:result", id: data.id, ...payload },
          "*",
        );
      };

      try {
        const result = await extract({
          data: { filename: data.filename, pageImages: data.images },
        });
        console.log("[VacciCheck] extraction IA terminée", { id: data.id, lines: result.lines.length });
        reply({ ok: true, lines: result.lines });
      } catch (err) {
        console.error("[VacciCheck] extraction IA échouée", err);
        reply({ ok: false, error: err instanceof Error ? err.message : "Erreur inconnue" });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [extract]);

  return (
    <iframe
      ref={iframeRef}
      src="/vaccicheck-app.html"
      title="VacciCheck"
      className="w-screen border-0 -mx-4"
      style={{ height: "calc(100vh - 3.5rem - 4rem)", width: "calc(100% + 2rem)" }}
    />
  );
}
