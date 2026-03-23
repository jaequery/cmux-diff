export function validateRequest(req: Request): Response | null {
  const url = new URL(req.url);

  // Only allow localhost
  const host = req.headers.get("host");
  if (host) {
    const hostname = host.split(":")[0];
    if (hostname !== "127.0.0.1" && hostname !== "localhost") {
      return new Response("Forbidden", { status: 403 });
    }
  }

  // Check origin on mutating requests
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    if (origin) {
      const originUrl = new URL(origin);
      if (
        originUrl.hostname !== "127.0.0.1" &&
        originUrl.hostname !== "localhost"
      ) {
        return new Response("Forbidden", { status: 403 });
      }
    }

    const fetchSite = req.headers.get("sec-fetch-site");
    if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site") {
      return new Response("Forbidden", { status: 403 });
    }
  }

  return null;
}

export function securityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Cache-Control": "no-store",
  };
}
