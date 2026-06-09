/** Source of truth for CORS helpers — inline into each function index.ts for Dashboard deploy (single file). */

const DEFAULT_ALLOWED = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8080",
  "https://sanadd.co",
  "https://www.sanadd.co",
  "https://sanaddd.netlify.app",
];

const BASE_ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type";

export function getAllowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS");
  const fromEnv = raw?.trim()
    ? raw.split(",").map((origin) => origin.trim()).filter(Boolean)
    : [];
  return [...new Set([...DEFAULT_ALLOWED, ...fromEnv])];
}

/** Production custom domain + Netlify branch/preview deploys for SANAD. */
export function isNetlifySanadOrigin(origin: string): boolean {
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== "https:") return false;
    const host = hostname.toLowerCase();
    if (host === "sanadd.co" || host === "www.sanadd.co") return true;
    if (host === "sanaddd.netlify.app") return true;
    return /^[\w-]+--sanaddd\.netlify\.app$/.test(host);
  } catch {
    return false;
  }
}

function resolveAllowedOrigin(req: Request): string | null {
  const origin = req.headers.get("Origin");
  if (!origin) return null;
  if (getAllowedOrigins().includes(origin) || isNetlifySanadOrigin(origin)) return origin;
  return null;
}

export function corsHeadersForRequest(
  req: Request,
  allowHeaders: string = BASE_ALLOW_HEADERS,
): Record<string, string> | null {
  const origin = req.headers.get("Origin");
  if (!origin) {
    return { "Access-Control-Allow-Headers": allowHeaders };
  }

  const allowed = resolveAllowedOrigin(req);
  if (!allowed) return null;

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": allowHeaders,
    Vary: "Origin",
  };
}

export function handleCorsPreflight(
  req: Request,
  allowHeaders: string = BASE_ALLOW_HEADERS,
): Response | null {
  if (req.method !== "OPTIONS") return null;
  const headers = corsHeadersForRequest(req, allowHeaders);
  if (!headers) return new Response("Forbidden", { status: 403 });
  return new Response("ok", {
    headers: { ...headers, "Access-Control-Allow-Methods": "POST, OPTIONS" },
  });
}

export function jsonWithCors(
  req: Request,
  body: Record<string, unknown>,
  status: number,
  allowHeaders: string = BASE_ALLOW_HEADERS,
): Response {
  const headers = corsHeadersForRequest(req, allowHeaders);
  if (!headers) return new Response("Forbidden", { status: 403 });
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
