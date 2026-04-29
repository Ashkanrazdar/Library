export const config = {
  runtime: "edge"
};

const TARGET_BASE = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");

const STRIP_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port"
]);

export default async function handler(req) {
  if (!TARGET_BASE) {
    return new Response("Missing TARGET_DOMAIN", { status: 500 });
  }

  try {
    const pathStart = req.url.indexOf("/", 8);
    const targetUrl =
      pathStart === -1 ? `${TARGET_BASE}/` : TARGET_BASE + req.url.slice(pathStart);

    const headers = new Headers();
    let clientIp = null;

    for (const [key, value] of req.headers) {
      const k = key.toLowerCase();

      if (STRIP_HEADERS.has(k)) continue;
      if (k.startsWith("x-vercel-")) continue;

      if (k === "x-real-ip" || k === "x-forwarded-for") {
        if (!clientIp) clientIp = value;
        continue;
      }

      headers.set(key, value);
    }

    if (clientIp) {
      headers.set("x-forwarded-for", clientIp);
    }

    const method = req.method;
    const hasBody = method !== "GET" && method !== "HEAD";

    return fetch(targetUrl, {
      method,
      headers,
      body: hasBody ? req.body : undefined,
      duplex: "half",
      redirect: "manual"
    });
  } catch (error) {
    console.error("Request forwarding failed:", error);
    return new Response("Bad Gateway", { status: 502 });
  }
}
