// Gate d'accès pour VacciCheck déployé sur Netlify.
// - Accepte ?vct=<token HMAC> émis par ConseilSV (même secret que verifyVacciCheckToken)
// - Sinon vérifie le cookie de session vc_session (valide 4h)
// - Sinon redirige vers https://conseilsv.lovable.app
//
// Variable d'environnement Netlify requise : VACCICHECK_GATE_SECRET
// (identique à celle du projet VacciCheck côté Lovable Cloud).

import type { Context } from "https://edge.netlify.com";

const PORTAL_URL = "https://conseilsv.lovable.app";
const COOKIE_NAME = "vc_session";
const SESSION_SECONDS = 4 * 60 * 60;

function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

async function verifyVct(token: string, secret: string): Promise<boolean> {
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return false;
  const expected = await hmac(secret, payloadB64);
  const provided = b64urlToBytes(sigB64);
  if (!timingSafeEqual(expected, provided)) return false;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64))) as {
      exp: number;
    };
    return Math.floor(Date.now() / 1000) <= payload.exp;
  } catch {
    return false;
  }
}

async function makeSessionCookie(secret: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = String(exp);
  const sig = bytesToB64url(await hmac(secret, payload));
  return `${payload}.${sig}`;
}

async function verifySessionCookie(value: string, secret: string): Promise<boolean> {
  const [payload, sigB64] = value.split(".");
  if (!payload || !sigB64) return false;
  const expected = await hmac(secret, payload);
  const provided = b64urlToBytes(sigB64);
  if (!timingSafeEqual(expected, provided)) return false;
  const exp = Number(payload);
  return Number.isFinite(exp) && Math.floor(Date.now() / 1000) <= exp;
}

function redirect(url: string): Response {
  return new Response(null, { status: 302, headers: { location: url } });
}

export default async (request: Request, context: Context): Promise<Response | void> => {
  const secret = Deno.env.get("VACCICHECK_GATE_SECRET");
  if (!secret) {
    return new Response(
      "VACCICHECK_GATE_SECRET non configuré sur Netlify (Site settings → Environment variables).",
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const vct = url.searchParams.get("vct");

  if (vct && (await verifyVct(vct, secret))) {
    const cookie = await makeSessionCookie(secret);
    url.searchParams.delete("vct");
    const clean = url.pathname + (url.search ? url.search : "") + url.hash;
    return new Response(null, {
      status: 302,
      headers: {
        location: clean,
        "set-cookie": `${COOKIE_NAME}=${cookie}; Path=/; Max-Age=${SESSION_SECONDS}; Secure; HttpOnly; SameSite=Lax`,
      },
    });
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (match && (await verifySessionCookie(decodeURIComponent(match[1]), secret))) {
    return context.next();
  }

  return redirect(PORTAL_URL);
};

export const config = {
  path: "/*",
  // On laisse passer les assets techniques Netlify.
  excludedPath: ["/.netlify/*"],
};
