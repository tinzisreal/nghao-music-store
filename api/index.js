import app, { initSupabaseStore } from "../server/index.js";

let initPromise = null;

function ensureSupabase() {
  if (!initPromise) {
    initPromise = initSupabaseStore().catch((err) => {
      console.error("Supabase initialization error in Vercel handler:", err.message);
    });
  }
  return initPromise;
}

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  await ensureSupabase();

  // Normalize incoming path for Express router
  if (req.query && req.query._p) {
    const pathPart = Array.isArray(req.query._p) ? req.query._p.join("/") : req.query._p;
    delete req.query._p;
    const normalizedPath = pathPart.startsWith("/") ? pathPart : "/" + pathPart;
    const remainingParams = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (Array.isArray(v)) {
        v.forEach((val) => remainingParams.append(k, val));
      } else if (v !== undefined) {
        remainingParams.append(k, v);
      }
    }
    const qs = remainingParams.toString();
    req.url = normalizedPath + (qs ? "?" + qs : "");
  } else if (req.url) {
    for (const prefix of ["/fb-tr", "/tiktok-sdk", "/api-proxy"]) {
      if (req.url.startsWith(prefix)) {
        req.url = req.url.slice(prefix.length) || "/";
        break;
      }
    }
  }

  return app(req, res);
}
