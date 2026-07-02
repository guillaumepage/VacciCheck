import { createServerFn } from "@tanstack/react-start";
import { createHmac, timingSafeEqual } from "crypto";

function b64urlToBuf(s: string): Buffer {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

export const verifyVacciCheckToken = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const secret = process.env.VACCICHECK_GATE_SECRET;
    if (!secret) throw new Error("VACCICHECK_GATE_SECRET not configured");
    const [payloadB64, sigB64] = data.token.split(".");
    if (!payloadB64 || !sigB64) return { ok: false as const };

    const expected = createHmac("sha256", secret).update(payloadB64).digest();
    const provided = b64urlToBuf(sigB64);
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      return { ok: false as const };
    }
    const payload = JSON.parse(b64urlToBuf(payloadB64).toString("utf8")) as {
      sub: string; email: string | null; iat: number; exp: number;
    };
    if (Math.floor(Date.now() / 1000) > payload.exp) return { ok: false as const };
    return { ok: true as const, sub: payload.sub, email: payload.email, exp: payload.exp };
  });
