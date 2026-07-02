import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifyVacciCheckToken } from "@/lib/vaccicheck-gate.functions";

const CONSEILSV_URL = "https://conseilsv.lovable.app";
const SESSION_KEY = "vc_gate_session";
const SESSION_MS = 4 * 60 * 60 * 1000;

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: Gate,
});

function Gate() {
  const verify = useServerFn(verifyVacciCheckToken);
  const [state, setState] = useState<"checking" | "ok">("checking");

  useEffect(() => {
    (async () => {
      const url = new URL(window.location.href);
      const token = url.searchParams.get("vct");
      if (token) {
        const res = await verify({ data: { token } });
        if (res.ok) {
          sessionStorage.setItem(
            SESSION_KEY,
            JSON.stringify({ exp: Date.now() + SESSION_MS }),
          );
          url.searchParams.delete("vct");
          window.history.replaceState({}, "", url.toString());
          setState("ok");
          return;
        }
      }
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        try {
          const { exp } = JSON.parse(raw) as { exp: number };
          if (Date.now() < exp) {
            setState("ok");
            return;
          }
        } catch {
          /* ignore */
        }
      }
      window.location.replace(CONSEILSV_URL);
    })();
  }, [verify]);

  if (state !== "ok") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Vérification de l'accès…</p>
      </div>
    );
  }
  return <Outlet />;
}
