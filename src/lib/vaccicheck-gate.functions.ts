import { createServerFn } from "@tanstack/react-start";
import { createHmac, timingSafeEqual } from "crypto";

function b64urlToBuf(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export const verifyVacciCheckToken = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => {
    if (!data || typeof data.token !== "string" || data.token.length > 4096) {
      throw new Error("Invalid token");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const secret = process.env.VACCICHECK_GATE_SECRET;
    if (!secret) throw new Error("VACCICHECK_GATE_SECRET not configured");

    const [payloadB64, sigB64] = data.token.split(".");
    if (!payloadB64 || !sigB64) return { ok: false as const, reason: "malformed" };

    const expected = createHmac("sha256", secret).update(payloadB64).digest();
    const provided = b64urlToBuf(sigB64);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      return { ok: false as const, reason: "bad_signature" };
    }

    const payload = JSON.parse(b64urlToBuf(payloadB64).toString("utf8")) as {
      sub: string; email: string | null; iat: number; exp: number;
    };
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return { ok: false as const, reason: "expired" };

    return {
      ok: true as const,
      sub: payload.sub,
      email: payload.email,
      sessionExp: now + 60 * 60 * 4,
    };
  });
