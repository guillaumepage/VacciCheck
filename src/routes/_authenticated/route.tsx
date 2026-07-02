import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifyVacciCheckToken } from "@/lib/vaccicheck-gate.functions";

const CONSEILSV_URL = "https://conseilsv.lovable.app";
const SESSION_KEY = "vc_gate_session";

type GateSession = { sub: string; email: string | null; exp: number };

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: GateComponent,
});

function GateComponent() {
  const [status, setStatus] = useState<"checking" | "ok" | "denied">("checking");
  const verify = useServerFn(verifyVacciCheckToken);

  useEffect(() => {
    const now = Math.floor(Date.now() / 1000);
    const url = new URL(window.location.href);
    const incoming = url.searchParams.get("vct");

    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw && !incoming) {
      try {
        const s = JSON.parse(raw) as GateSession;
        if (s.exp > now) {
          setStatus("ok");
          return;
        }
      } catch {
        /* ignore */
      }
    }

    if (incoming) {
      verify({ data: { token: incoming } })
        .then((res) => {
          if (!res.ok) {
            redirectToPortal();
            return;
          }
          const session: GateSession = {
            sub: res.sub,
            email: res.email,
            exp: res.exp,
          };
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
          url.searchParams.delete("vct");
          window.history.replaceState(
            {},
            "",
            url.pathname + url.search + url.hash,
          );
          setStatus("ok");
        })
        .catch(() => redirectToPortal());
      return;
    }

    redirectToPortal();
  }, [verify]);

  if (status === "ok") return <Outlet />;
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Vérification de l'accès…</p>
    </div>
  );
}

function redirectToPortal() {
  window.location.replace(CONSEILSV_URL);
}
