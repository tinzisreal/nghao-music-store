import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import crypto from "crypto";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import {
  ApiPayError,
  createPaymentRequest,
  fetchApiPayReconciliationData,
  handleApiPayWebhook,
  reconcileDbWithApiPay,
  sanitizeOrderForClient,
  verifyRedirectPayload
} from "./apipay.js";
import { sendOrderFulfillmentEmail, verifyOrderDownloadToken } from "./mailer.js";
import {
  DEFAULT_NTFY_TOPIC,
  notifyAdminNewPaidOrder,
  sendNtfyOrderAlert,
  sendTelegramOrderAlert,
  sendGmailOrderAlert,
  sendTrackReleaseNewsletter
} from "./notifier.js";
import {
  createPayPalCheckoutOrder,
  capturePayPalCheckoutOrder,
  isPayPalConfigured,
  vndToUsd
} from "./paypal.js";

dotenv.config();

// Default environment fallbacks for Vercel Serverless & cloud deployments
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://puthzuedydffjkljpjbg.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1dGh6dWVkeWRmZmprbGpwamJnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTI3NTExOCwiZXhwIjoyMTA2ODUxMTE4fQ.bXzo6aDGkzt42kLxcIRu3vRM43l833DPvWhYSk2FRrk";
process.env.CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "oksfct7l";
process.env.CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "258777441877266";
process.env.CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "0aBpCoVYusOtt1tAaDU6OqcEQ7o";
process.env.APIPAY_ACCESS_KEY = process.env.APIPAY_ACCESS_KEY || "c57c71bb9a548cc35ef0072b0edf1d16e3bfde7d06dcb3be9a61594c23960e5c";
process.env.APIPAY_SECRET_KEY = process.env.APIPAY_SECRET_KEY || "TFRtzNJi6lHVz7N0RHvq56TiMfSc13918LhcD7M1lBPIQkaxB4tpZ0cttF45YhK7yA6B1Iuhe0y1+Tdzxj8l+Q==";
process.env.APIPAY_BANK_PUBLIC_ID = process.env.APIPAY_BANK_PUBLIC_ID || "cmv615pke0c4001sxipdu87dw";
process.env.APIPAY_WEBHOOK_SECRET = process.env.APIPAY_WEBHOOK_SECRET || "f5cb1c6958f358b779c7f00a499f6b036fafcb7e8945fc9d341a0bf9b15f03b4";
process.env.ADMIN_ALERT_EMAIL = process.env.ADMIN_ALERT_EMAIL || "nghaoproducer@gmail.com";
process.env.NTFY_TOPIC = process.env.NTFY_TOPIC || DEFAULT_NTFY_TOPIC;
process.env.PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || "https://nghaoproducer.shop";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
app.disable("x-powered-by");
const PORT = process.env.PORT || 5000;

// Cloudinary setup
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "oksfct7l";
const CLOUD_KEY = process.env.CLOUDINARY_API_KEY || "258777441877266";
const CLOUD_SECRET = process.env.CLOUDINARY_API_SECRET || "0aBpCoVYusOtt1tAaDU6OqcEQ7o";
const isCloudinaryConfigured = Boolean(
  CLOUD_NAME &&
  CLOUD_KEY &&
  CLOUD_SECRET &&
  CLOUD_NAME !== "your_cloud_name"
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: CLOUD_KEY,
    api_secret: CLOUD_SECRET
  });
  console.log("Cloudinary is enabled for audio & image storage.");
} else {
  console.log("Cloudinary not configured yet, using local storage fallback (/uploads).");
}

/* ──────── 1. HTTP Server Hardening & Security Headers ──────── */
app.use((req, res, next) => {
  // Ngăn chặn MIME-type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Chống tấn công Clickjacking bằng iframe
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  // Bật bộ lọc XSS trên trình duyệt
  res.setHeader("X-XSS-Protection", "1; mode=block");
  // Kiểm soát Referrer Policy để không lộ URL nội bộ
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Giới hạn quyền truy cập phần cứng nhạy cảm
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(self)");
  // Bật HSTS trên kết nối HTTPS
  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  next();
});

/* ──────── 2. CORS & CSRF Protection ──────── */
const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https:\/\/([a-zA-Z0-9-]+\.)*vercel\.app$/,
  /^https:\/\/([a-zA-Z0-9-]+\.)*nghaoproducer\.shop$/,
  /^https:\/\/nghaoproducer\.shop$/
];

function isOriginAllowed(origin) {
  if (!origin) return true; // Cho phép server-to-server, curl, webhook
  const siteUrl = process.env.PUBLIC_SITE_URL ? process.env.PUBLIC_SITE_URL.replace(/\/+$/, "") : "";
  if (siteUrl && origin === siteUrl) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "x-fb-codec", "ApiPay-Signature"]
  })
);

/* ──────── 3. Chống Prototype Pollution ──────── */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      continue;
    }
    clean[key] = sanitizeObject(val);
  }
  return clean;
}

/* ──────── 4. Rate Limiter (Bộ đếm giới hạn tần suất yêu cầu) ──────── */
function createRateLimiter({ windowMs, max, message }) {
  const store = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now - record.resetAt > windowMs) {
        store.delete(key);
      }
    }
  }, 10 * 60 * 1000).unref();

  return (req, res, next) => {
    const ip = getClientIp(req);
    const now = Date.now();
    let record = store.get(ip);

    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + windowMs };
      store.set(ip, record);
      return next();
    }

    record.count++;
    if (record.count > max) {
      const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({
        message: message || "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.",
        retryAfter: retryAfterSec
      });
    }

    next();
  };
}

const orderRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 15,
  message: "Bạn đã tạo đơn quá nhanh. Vui lòng đợi 5 phút trước khi tạo đơn tiếp theo."
});

const subscribeRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: "Bạn đã gửi quá nhiều yêu cầu đăng ký. Vui lòng thử lại sau."
});

const analyticsRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 80,
  message: "Quá tải sự kiện analytics."
});

const downloadRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: "Bạn đã tải file quá nhiều lần. Vui lòng đợi 10 phút."
});

let globalLoginAttempts = [];
function globalLoginLimiter(req, res, next) {
  const now = Date.now();
  globalLoginAttempts = globalLoginAttempts.filter((t) => now - t < 60 * 1000);
  if (globalLoginAttempts.length >= 30) {
    return res.status(429).json({
      message: "Hệ thống đang ghi nhận quá nhiều lượt thử đăng nhập. Vui lòng đợi 1 phút."
    });
  }
  globalLoginAttempts.push(now);
  next();
}

// Secret salt dùng để xáo trộn (XOR) nhị phân giả lập gói tin telemetry Facebook/TikTok
const TELEMETRY_SALT = "nghao_fb_telemetry_2024_secure_salt_k9x";

function encryptTelemetry(data) {
  const jsonStr = JSON.stringify(data);
  const input = Buffer.from(jsonStr, "utf8");
  const key = Buffer.from(TELEMETRY_SALT, "utf8");
  const output = Buffer.alloc(input.length);
  for (let i = 0; i < input.length; i++) {
    output[i] = input[i] ^ key[i % key.length];
  }
  return output.toString("base64");
}

// Chuẩn hóa đường dẫn API và hỗ trợ backward compatibility cho các URL cũ
app.use((req, res, next) => {
  // Bỏ tiền tố proxy (/api, /api-proxy, /fb-tr, /tiktok-sdk)
  req.url = req.url.replace(/^\/(api|api-proxy|fb-tr|tiktok-sdk)(?=\/|$)/, "") || "/";

  const [pathname, search = ""] = req.url.split("?");
  const qs = search ? `?${search}` : "";

  // Ánh xạ các đường dẫn cũ (nếu có request từ cache) về route nội bộ chuẩn
  if (pathname === "/v19.0/pixel/config") req.url = `/producer${qs}`;
  else if (pathname === "/v19.0/pixel/catalog") req.url = `/tracks${qs}`;
  else if (pathname === "/v19.0/pixel/collections") req.url = `/albums${qs}`;
  else if (pathname === "/v19.0/pixel/attribution") req.url = `/store-info${qs}`;
  else if (pathname === "/v19.0/pixel/placements") req.url = `/sections${qs}`;
  else if (pathname === "/v2/events/initiate") req.url = `/orders${qs}`;
  else if (pathname === "/v2/events/paypal/config") req.url = `/paypal/config${qs}`;
  else if (pathname === "/v2/events/paypal/create-order") req.url = `/paypal/create-order${qs}`;
  else if (pathname === "/v2/events/paypal/capture-order") req.url = `/paypal/capture-order${qs}`;
  else if (pathname === "/v2/events/analytics") req.url = `/analytics/event${qs}`;
  else if (pathname === "/v2/events/subscribe") req.url = `/subscribe${qs}`;
  else if (pathname.startsWith("/v2/events/status/")) {
    const id = pathname.slice("/v2/events/status/".length);
    req.url = `/orders/${id}${qs}`;
  } else if (pathname.startsWith("/v2/events/complete/")) {
    const id = pathname.slice("/v2/events/complete/".length);
    req.url = `/orders/${id}/confirm${qs}`;
  } else if (pathname.startsWith("/v2/events/checkout/")) {
    const id = pathname.slice("/v2/events/checkout/".length);
    req.url = `/orders/${id}/checkout${qs}`;
  } else if (pathname.startsWith("/v2/media/stream/")) {
    const id = pathname.slice("/v2/media/stream/".length);
    req.url = `/tracks/${id}/demo-stream${qs}`;
  } else if (pathname.startsWith("/v2/media/asset/")) {
    const id = pathname.slice("/v2/media/asset/".length);
    req.url = `/tracks/${id}/free-download${qs}`;
  } else if (pathname.startsWith("/v2/media/cover/")) {
    const id = pathname.slice("/v2/media/cover/".length);
    req.url = `/tracks/${id}/cover${qs}`;
  } else if (pathname.startsWith("/v2/media/album-cover/")) {
    const id = pathname.slice("/v2/media/album-cover/".length);
    req.url = `/albums/${id}/cover${qs}`;
  } else if (pathname.startsWith("/v2/media/qr/")) {
    const id = pathname.slice("/v2/media/qr/".length);
    req.url = `/orders/${id}/qr-image${qs}`;
  }

  next();
});

// Database file helpers + Supabase Cloud Sync (supports local, Render, and Vercel Serverless)
const DB_FILE = process.env.VERCEL
  ? path.join(os.tmpdir(), "db.json")
  : path.join(__dirname, "db.json");
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_KEY &&
  !SUPABASE_URL.includes("your_project")
);

let memoryDb = null;

function readDb() {
  if (memoryDb) return memoryDb;
  try {
    const fileToRead = process.env.VERCEL && !fs.existsSync(DB_FILE)
      ? path.join(__dirname, "db.json")
      : DB_FILE;
    const data = fs.readFileSync(fileToRead, "utf-8");
    memoryDb = JSON.parse(data);
    return memoryDb;
  } catch (err) {
    console.error("Error reading db:", err);
    return null;
  }
}

async function syncToSupabase(data) {
  if (!isSupabaseConfigured) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_store?on_conflict=id`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify({
        id: "main",
        data,
        updated_at: new Date().toISOString()
      })
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`Supabase sync warning (${res.status}):`, errText);
    }
  } catch (err) {
    console.error("Supabase network sync warning:", err.message);
  }
}

async function initSupabaseStore() {
  if (!isSupabaseConfigured) {
    console.log("Supabase not configured, using local server/db.json storage.");
    return;
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_store?id=eq.main&select=data`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });
    if (!res.ok) {
      console.warn(`Supabase init check returned ${res.status}. Make sure table 'app_store' exists.`);
      return;
    }
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.data) {
      memoryDb = rows[0].data;
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(memoryDb, null, 2), "utf-8");
      } catch {
        /* ignore local cache write error on serverless */
      }
      console.log("Loaded store state from Supabase (app_store).");
    } else {
      const initialData = readDb();
      if (initialData) {
        await syncToSupabase(initialData);
        console.log("Seeded initial server/db.json state into Supabase (app_store).");
      }
    }
  } catch (err) {
    console.error("Failed to initialize Supabase store:", err.message);
  }
}

function writeDb(data) {
  memoryDb = data;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing local db.json:", err);
  }
  if (isSupabaseConfigured) {
    syncToSupabase(data);
  }
  return true;
}

/* ──────── Analytics & Visitor Tracking Helpers ──────── */

function parseUserAgent(ua = "") {
  let device = "Desktop";
  if (/iPad|Tablet/i.test(ua)) {
    device = "Tablet";
  } else if (/Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    device = "Mobile";
  }

  let browser = "Khác";
  if (/Zalo/i.test(ua)) browser = "Zalo App";
  else if (/FBAN|FBAV/i.test(ua)) browser = "Facebook App";
  else if (/Edg/i.test(ua)) browser = "Edge";
  else if (/Chrome/i.test(ua)) browser = "Chrome";
  else if (/Safari/i.test(ua)) browser = "Safari";
  else if (/Firefox/i.test(ua)) browser = "Firefox";

  return { device, browser };
}

function anonymizeIp(ip = "") {
  if (!ip || typeof ip !== "string") return "Ẩn danh";
  const clean = ip.replace(/^.*:/, "").trim();
  const parts = clean.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
  }
  return clean.slice(0, 8) + "***";
}

function getClientIp(req) {
  return String(
    req.headers["cf-connecting-ip"] ||
    req.headers["x-real-ip"] ||
    req.headers["x-forwarded-for"] ||
    req.socket?.remoteAddress ||
    req.ip ||
    "unknown"
  ).split(",")[0].trim();
}

function getAnalyticsStore(db) {
  if (!db.analytics || typeof db.analytics !== "object") {
    db.analytics = {
      totalViews: 0,
      totalPlays: 0,
      totalDownloads: 0,
      totalUniqueVisitors: 0,
      uniqueIps: {},
      daily: {},
      trackPlays: {},
      trackDownloads: {},
      recentDownloads: [],
      recentPlays: [],
      devices: { mobile: 0, desktop: 0, tablet: 0 }
    };
  }
  const a = db.analytics;
  if (!a.uniqueIps) a.uniqueIps = {};
  if (!a.daily) a.daily = {};
  if (!a.trackPlays) a.trackPlays = {};
  if (!a.trackDownloads) a.trackDownloads = {};
  if (!Array.isArray(a.recentDownloads)) a.recentDownloads = [];
  if (!Array.isArray(a.recentPlays)) a.recentPlays = [];
  if (!a.devices) a.devices = { mobile: 0, desktop: 0, tablet: 0 };
  return a;
}

function recordAnalyticsEvent({ type, trackId, trackTitle, req }) {
  try {
    const db = readDb();
    if (!db) return;

    const store = getAnalyticsStore(db);
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const rawIp = getClientIp(req);
    const ipHash = crypto.createHash("sha256").update(rawIp + "nghao_salt").digest("hex").slice(0, 16);
    const ua = req.headers["user-agent"] || "";
    const { device, browser } = parseUserAgent(ua);

    if (!store.daily[dateStr]) {
      store.daily[dateStr] = { views: 0, uniques: 0, plays: 0, downloads: 0 };
    }
    const dayStats = store.daily[dateStr];

    if (type === "pageview") {
      store.totalViews = (store.totalViews || 0) + 1;
      dayStats.views = (dayStats.views || 0) + 1;

      // Device stats
      if (device === "Mobile") store.devices.mobile = (store.devices.mobile || 0) + 1;
      else if (device === "Tablet") store.devices.tablet = (store.devices.tablet || 0) + 1;
      else store.devices.desktop = (store.devices.desktop || 0) + 1;

      // Check unique visitor for today
      const lastVisitDate = store.uniqueIps[ipHash];
      if (lastVisitDate !== dateStr) {
        store.uniqueIps[ipHash] = dateStr;
        store.totalUniqueVisitors = (store.totalUniqueVisitors || 0) + 1;
        dayStats.uniques = (dayStats.uniques || 0) + 1;
      }
    } else if (type === "play") {
      store.totalPlays = (store.totalPlays || 0) + 1;
      dayStats.plays = (dayStats.plays || 0) + 1;

      if (trackId) {
        store.trackPlays[trackId] = (store.trackPlays[trackId] || 0) + 1;
        const matchedTrack = (db.tracks || []).find((t) => t.id === trackId);
        const title = trackTitle || matchedTrack?.title || "Không rõ";

        store.recentPlays.unshift({
          id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          trackId,
          trackTitle: title,
          playedAt: now.toISOString(),
          device
        });
        if (store.recentPlays.length > 100) {
          store.recentPlays = store.recentPlays.slice(0, 100);
        }
      }
    } else if (type === "download") {
      store.totalDownloads = (store.totalDownloads || 0) + 1;
      dayStats.downloads = (dayStats.downloads || 0) + 1;

      if (trackId) {
        store.trackDownloads[trackId] = (store.trackDownloads[trackId] || 0) + 1;
        const matchedTrack = (db.tracks || []).find((t) => t.id === trackId);
        const title = trackTitle || matchedTrack?.title || "Không rõ";

        store.recentDownloads.unshift({
          id: `dl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          trackId,
          trackTitle: title,
          downloadedAt: now.toISOString(),
          ip: anonymizeIp(rawIp),
          device,
          browser
        });
        if (store.recentDownloads.length > 200) {
          store.recentDownloads = store.recentDownloads.slice(0, 200);
        }
      }
    }

    // Prune uniqueIps if table gets too big (> 2500 keys)
    const ipKeys = Object.keys(store.uniqueIps);
    if (ipKeys.length > 2500) {
      for (let i = 0; i < 500; i++) {
        delete store.uniqueIps[ipKeys[i]];
      }
    }

    writeDb(db);
  } catch (err) {
    console.error("Analytics record error:", err.message);
  }
}

function saveSubscriber(db, { email, phone, source = "free_download", trackId, trackTitle, active = true }) {
  if (!email || typeof email !== "string") return null;
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return null;

  db.subscribers = db.subscribers || [];
  const existingIndex = db.subscribers.findIndex((s) => s.email && s.email.toLowerCase() === cleanEmail);
  const now = new Date().toISOString();

  if (existingIndex >= 0) {
    const existing = db.subscribers[existingIndex];
    existing.active = Boolean(active);
    existing.updatedAt = now;
    if (phone) existing.phone = String(phone).trim();
    if (trackTitle) existing.lastTrackTitle = trackTitle;
    if (trackId) existing.lastTrackId = trackId;
    return existing;
  } else {
    const newSub = {
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      email: cleanEmail,
      phone: phone ? String(phone).trim() : undefined,
      source: source || "free_download",
      trackId: trackId || undefined,
      trackTitle: trackTitle || undefined,
      subscribedAt: now,
      active: Boolean(active)
    };
    db.subscribers.unshift(newSub);
    return newSub;
  }
}

async function triggerEmailIfPaid(order, db, { force = false } = {}) {
  // Chế độ gửi email thủ công theo yêu cầu: Khách để lại Gmail, Nghao Producer tự mở Gmail gửi file thủ công từ trang Admin
  return { sent: false, reason: "manual_mode" };
}

function buildCloudinaryDemoUrl(rawUrl, demoStart = 0, demoEnd = 0) {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  const start = Math.max(0, Math.floor(Number(demoStart) || 0));
  const end = Math.max(0, Math.floor(Number(demoEnd) || 0));
  if (
    rawUrl.includes("res.cloudinary.com") &&
    rawUrl.includes("/upload/")
  ) {
    // Đảm bảo đuôi file thành .mp3 để Cloudinary nén & cắt audio chuẩn xác, tương thích 100% với iOS Safari & Android
    let mp3Url = rawUrl.replace(/\.[a-zA-Z0-9]+(?=([?#]|$))/, ".mp3");
    if (!mp3Url.includes(".mp3")) {
      mp3Url = `${mp3Url}.mp3`;
    }
    if (end > start) {
      return mp3Url.replace("/upload/", `/upload/so_${start},eo_${end}/`);
    }
    return mp3Url;
  }
  return rawUrl;
}

function getMediaVersion(mediaUrl) {
  if (!mediaUrl || typeof mediaUrl !== "string") return "";
  const vMatch = mediaUrl.match(/\/v(\d+)\//);
  const fileMatch = mediaUrl.match(/\/([^/?#]+)(?:\.[a-zA-Z0-9]+)?$/);
  if (vMatch && fileMatch) {
    return `${vMatch[1]}-${fileMatch[1].replace(/[^a-zA-Z0-9]/g, "").slice(-6)}`;
  }
  if (fileMatch) return fileMatch[1].replace(/[^a-zA-Z0-9]/g, "").slice(-8);
  return crypto.createHash("md5").update(mediaUrl).digest("hex").slice(0, 8);
}

function sanitizeTrackForPublic(track) {
  if (!track) return null;
  const { fullAudioUrl: _fullAudioUrl, ...rest } = track;
  const rawStart = Math.max(0, Math.floor(Number(track.demoStart) || 0));
  const rawEnd = Math.max(0, Math.floor(Number(track.demoEnd) || 0));
  const hasDemoSlice = rawEnd > rawStart;
  const demoDuration = hasDemoSlice ? rawEnd - rawStart : Number(track.duration) || 30;

  const coverVer = getMediaVersion(track.cover);
  const rawAudio =
    track.audioUrl && track.audioUrl.startsWith("http")
      ? track.audioUrl
      : track.fullAudioUrl && track.fullAudioUrl.startsWith("http")
        ? track.fullAudioUrl
        : track.audioUrl;
  const audioVer = getMediaVersion(rawAudio);

  return {
    ...rest,
    cover: track.cover
      ? `/v2/media/cover/${encodeURIComponent(track.id)}${coverVer ? `?v=${coverVer}` : ""}`
      : "",
    audioUrl: track.isPreorder
      ? ""
      : (track.audioUrl || track.fullAudioUrl)
        ? `/v2/media/stream/${encodeURIComponent(track.id)}${audioVer ? `?v=${audioVer}` : ""}`
        : "",
    demoStart: 0,
    demoEnd: demoDuration
  };
}

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    supabase: isSupabaseConfigured,
    cloudinary: isCloudinaryConfigured,
    paypal: isPayPalConfigured(),
    ntfyConfigured: true,
    gmailConfigured: Boolean(process.env.GMAIL_SCRIPT_URL || process.env.RESEND_API_KEY),
    telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
  });
});

// GET /api/apipay/webhook — Endpoint kiểm tra kết nối từ cổng thanh toán hoặc trình duyệt
app.get(["/api/apipay/webhook", "/api/webhook", "/apipay/webhook"], (req, res) => {
  res.json({
    status: "ok",
    message: "ApiPay Webhook Endpoint is ready to receive POST events.",
    endpoint: `${(process.env.PUBLIC_SITE_URL || "https://nghaoproducer.shop").replace(/\/+$/, "")}/api/apipay/webhook`
  });
});

// POST /api/apipay/webhook — Phải giữ nguyên raw body trước khi qua express.json()
app.post(["/api/apipay/webhook", "/api/webhook", "/apipay/webhook"], express.raw({ type: "*/*" }), async (req, res) => {
  const signature =
    req.headers["apipay-signature"] ||
    req.headers["x-apipay-signature"] ||
    req.headers["x-signature"];

  let rawBody = req.body;
  if (!Buffer.isBuffer(rawBody)) {
    if (typeof rawBody === "string") {
      rawBody = Buffer.from(rawBody, "utf8");
    } else if (rawBody && typeof rawBody === "object") {
      try {
        rawBody = Buffer.from(JSON.stringify(rawBody), "utf8");
      } catch {
        rawBody = Buffer.from("");
      }
    } else {
      rawBody = Buffer.from("");
    }
  }

  console.log(`[ApiPay Webhook] Received event (sig: ${signature ? "yes" : "no"}, size: ${rawBody.length} bytes)`);

  const result = handleApiPayWebhook({
    rawBody,
    signature,
    webhookSecret: process.env.APIPAY_WEBHOOK_SECRET,
    readDb,
    writeDb
  });

  if (result.statusCode === 200 && result.body?.orderId && result.body?.orderStatus === "paid") {
    const db = readDb();
    const matchedOrder = (db?.orders || []).find((o) => o.id === result.body.orderId);
    if (matchedOrder) {
      const track = (db?.tracks || []).find((t) => t.id === matchedOrder.trackId);
      try {
        console.log(`[ApiPay Webhook] Bắn chuông ntfy & thông báo cho đơn ${matchedOrder.id}...`);
        await notifyAdminNewPaidOrder({
          order: matchedOrder,
          track,
          transaction: result.body.transaction,
          writeDb,
          db
        });
      } catch (err) {
        console.error("Webhook notify admin error:", err.message);
      }
    }
  }

  return res.status(result.statusCode).json(result.body);
});

app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }
  next();
});

// Serve uploaded files statically (fallback)
const UPLOAD_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), "uploads")
  : path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch {
    /* ignore directory creation error on serverless */
  }
}
app.use("/uploads", express.static(UPLOAD_DIR));

// Configure multer storage with cryptographic randomness
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomHex = crypto.randomBytes(16).toString("hex");
    cb(null, `${Date.now()}-${randomHex}${ext}`);
  }
});

const ALLOWED_MIME_TYPES = new Set([
  // Audio
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/flac",
  "audio/x-flac",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  // Images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif"
]);

const ALLOWED_EXTENSIONS = new Set([
  ".mp3", ".wav", ".flac", ".m4a", ".aac",
  ".jpg", ".jpeg", ".png", ".webp", ".avif"
]);

const upload = multer({
  storage,
  limits: { fileSize: 60 * 1024 * 1024 }, // 60MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const mime = (file.mimetype || "").toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(
        new Error(
          "Phần mở rộng file không được phép. Chỉ chấp nhận mp3, wav, flac, m4a, aac, jpg, png, webp."
        )
      );
    }
    if (mime && !ALLOWED_MIME_TYPES.has(mime) && mime !== "application/octet-stream") {
      return cb(new Error("Định dạng MIME không được hỗ trợ: " + mime));
    }
    cb(null, true);
  }
});

/* ──────── Public Endpoints ──────── */

// GET /producer
app.get("/producer", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });
  res.json(db.producer);
});

// GET /tracks — Ẩn hoàn toàn link Cloudinary & fullAudioUrl đối với khách truy cập
app.get("/tracks", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  const isAdminQuery = req.query.admin === "1";
  if (isAdminQuery) {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (verifyAdminToken(token, db)) {
      return res.json(db.tracks);
    }
  }

  res.json((db.tracks || []).map(sanitizeTrackForPublic));
});

// GET /tracks/:id/demo-stream — Trực tiếp qua Cloudinary Edge CDN với 302 redirect để triệt tiêu hoàn toàn độ trễ (latency)
app.get("/tracks/:id/demo-stream", async (req, res) => {
  const { id } = req.params;
  const db = readDb();
  if (!db) return res.status(500).end();

  const track = (db.tracks || []).find((t) => t.id === id);
  if (!track || track.isPreorder) return res.status(404).end();

  const rawAudio =
    track.audioUrl && track.audioUrl.startsWith("http")
      ? track.audioUrl
      : track.fullAudioUrl && track.fullAudioUrl.startsWith("http")
        ? track.fullAudioUrl
        : track.audioUrl;

  if (!rawAudio || !rawAudio.startsWith("http")) return res.status(404).end();

  // Ghi nhận lượt nghe vào Analytics
  recordAnalyticsEvent({
    type: "play",
    trackId: track.id,
    trackTitle: track.title,
    req
  });

  const targetUrl = buildCloudinaryDemoUrl(rawAudio, track.demoStart, track.demoEnd);

  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.redirect(302, targetUrl);
});

// GET /tracks/:id/free-download — Tự động tải file MP3 Full đối với các bài nhạc Miễn phí (price <= 0)
app.get("/tracks/:id/free-download", async (req, res) => {
  const { id } = req.params;
  const db = readDb();
  if (!db) return res.status(500).send("Lỗi máy chủ.");

  const track = (db.tracks || []).find((t) => t.id === id);
  if (!track) return res.status(404).send("Không tìm thấy bài hát.");

  if (track.isPreorder) {
    return res.status(403).send("Bài hát này ở chế độ Pre-order. Vui lòng liên hệ Zalo 0333 025 864.");
  }

  if (Number(track.price || 0) > 0) {
    return res.status(403).send("Bài hát này có phí. Vui lòng thanh toán để nhận file qua Gmail.");
  }

  const fullUrl = track.fullAudioUrl || track.audioUrl;
  if (!fullUrl) {
    return res.status(404).send("Chưa có file âm thanh cho bài hát này.");
  }

  // Ghi nhận lượt tải nhạc miễn phí vào Analytics
  recordAnalyticsEvent({
    type: "download",
    trackId: track.id,
    trackTitle: track.title,
    req
  });

  try {
    const upstream = await fetch(fullUrl);
    if (!upstream.ok) {
      return res.status(502).send("Không thể tải file nhạc từ máy chủ lưu trữ.");
    }
    const safeTitle =
      String(track.title || "Track")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
        .trim() || "Track";
    const filenameUtf8 = encodeURIComponent(`${safeTitle} - NGHAO Free.mp3`);

    res.setHeader("Content-Type", upstream.headers.get("content-type") || "audio/mpeg");
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) res.setHeader("Content-Length", contentLength);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="NGHAO-Free.mp3"; filename*=UTF-8''${filenameUtf8}`
    );

    const arrayBuffer = await upstream.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error("Free audio download error:", err.message);
    return res.status(502).send("Lỗi kết nối khi tải file nhạc miễn phí.");
  }
});

// POST /subscribe — Đăng ký nhận thông báo bài nhạc mới (kèm tải nhạc free)
app.post("/subscribe", subscribeRateLimiter, (req, res) => {
  const { email, phone, source = "free_download", trackId, trackTitle, subscribeNewsletter = true } = req.body || {};
  if (!email || typeof email !== "string") {
    return res.status(400).json({ message: "Vui lòng nhập địa chỉ Gmail hợp lệ." });
  }
  const cleanEmail = String(email).trim().toLowerCase().slice(0, 100);
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ message: "Địa chỉ Gmail không đúng định dạng." });
  }
  if (source === "free_download" && !subscribeNewsletter) {
    return res.status(400).json({ message: "Vui lòng tích nhận thông báo bài mới để tải nhạc miễn phí." });
  }

  const cleanPhone = phone ? String(phone).replace(/[^\d+]/g, "").slice(0, 20) : undefined;
  const cleanSource = String(source || "free_download").slice(0, 50);
  const cleanTrackId = trackId ? String(trackId).slice(0, 50) : undefined;
  const cleanTrackTitle = trackTitle ? String(trackTitle).slice(0, 150) : undefined;

  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  let sub = null;
  if (subscribeNewsletter) {
    sub = saveSubscriber(db, {
      email: cleanEmail,
      phone: cleanPhone,
      source: cleanSource,
      trackId: cleanTrackId,
      trackTitle: cleanTrackTitle,
      active: true
    });
    writeDb(db);
  }

  // Nếu tải nhạc free, ghi nhận thêm analytics download
  if (source === "free_download" && cleanTrackId) {
    recordAnalyticsEvent({
      type: "download",
      trackId: cleanTrackId,
      trackTitle: cleanTrackTitle || "Free Track",
      req
    });
  }

  return res.json({
    success: true,
    email: cleanEmail,
    message: "Đã đăng ký nhận thông báo bài nhạc mới thành công!"
  });
});

// GET /tracks/:id/cover — Proxy ảnh bìa bài hát (ẩn tuyệt đối link Cloudinary đối với người dùng)
app.get("/tracks/:id/cover", async (req, res) => {
  const { id } = req.params;
  const db = readDb();
  if (!db) return res.status(500).end();

  const track = (db.tracks || []).find((t) => t.id === id);
  if (!track || !track.cover) return res.status(404).end();

  if (track.cover.startsWith("/")) {
    const localPath = path.join(__dirname, "../public", track.cover);
    if (fs.existsSync(localPath)) return res.sendFile(localPath);
    return res.redirect(302, track.cover);
  }

  try {
    const upstream = await fetch(track.cover);
    if (!upstream.ok) return res.status(upstream.status).end();
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "image/png");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    const arrayBuffer = await upstream.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch {
    return res.status(502).end();
  }
});

// GET /albums — Ẩn hoàn toàn link Cloudinary ảnh bìa album
app.get("/albums", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });
  const safeAlbums = (db.albums || []).map((alb) => {
    const albVer = getMediaVersion(alb.cover);
    return {
      ...alb,
      cover: alb.cover
        ? `/v2/media/album-cover/${encodeURIComponent(alb.id)}${albVer ? `?v=${albVer}` : ""}`
        : ""
    };
  });
  res.json(safeAlbums);
});

// GET /albums/:id/cover — Proxy ảnh bìa album
app.get("/albums/:id/cover", async (req, res) => {
  const { id } = req.params;
  const db = readDb();
  if (!db) return res.status(500).end();

  const album = (db.albums || []).find((a) => a.id === id);
  if (!album || !album.cover) return res.status(404).end();

  if (album.cover.startsWith("/")) {
    const localPath = path.join(__dirname, "../public", album.cover);
    if (fs.existsSync(localPath)) return res.sendFile(localPath);
    return res.redirect(302, album.cover);
  }

  try {
    const upstream = await fetch(album.cover);
    if (!upstream.ok) return res.status(upstream.status).end();
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "image/png");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    const arrayBuffer = await upstream.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch {
    return res.status(502).end();
  }
});

// GET /orders/:id/qr-image — Proxy ảnh mã QR VietQR / ApiPay (ẩn hoàn toàn domain cổng thanh toán)
app.get("/orders/:id/qr-image", async (req, res) => {
  const { id } = req.params;
  const db = readDb();
  if (!db) return res.status(500).end();

  const order = (db.orders || []).find((o) => o.id === id);
  if (!order || !order.qrUrl) return res.status(404).end();

  if (order.qrUrl.startsWith("/")) {
    const localPath = path.join(__dirname, "../public", order.qrUrl);
    if (fs.existsSync(localPath)) return res.sendFile(localPath);
    return res.redirect(302, order.qrUrl);
  }

  try {
    const upstream = await fetch(order.qrUrl);
    if (!upstream.ok) return res.status(upstream.status).end();
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "image/png");
    res.setHeader("Cache-Control", "public, max-age=600");
    const arrayBuffer = await upstream.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch {
    return res.status(502).end();
  }
});

// GET /orders/:id/checkout — Chuyển tiếp cổng thanh toán bảo mật
app.get("/orders/:id/checkout", (req, res) => {
  const { id } = req.params;
  const db = readDb();
  if (!db) return res.status(500).end();

  const order = (db.orders || []).find((o) => o.id === id);
  if (!order || !order.payUrl) return res.status(404).send("Không tìm thấy link thanh toán.");
  return res.redirect(302, order.payUrl);
});

// GET /store-info
app.get("/store-info", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });
  res.json(db.info);
});

// GET /sections
app.get("/sections", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });
  res.json(db.sections);
});

// POST /orders — Tạo yêu cầu thanh toán qua ApiPay
app.post("/orders", orderRateLimiter, async (req, res) => {
  const { trackId, trackIds, redirectUrl, email, phone } = req.body || {};
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  const rawTrackIds = Array.isArray(trackIds) ? trackIds : trackId ? [trackId] : [];
  const selectedTrackIds = rawTrackIds.filter((id) => typeof id === "string" && id.trim().length > 0);
  if (selectedTrackIds.length === 0) {
    return res.status(400).json({ message: "Thiếu mã bài hát (trackId hoặc trackIds)." });
  }

  const selectedTracks = selectedTrackIds
    .map((id) => (db.tracks || []).find((t) => t.id === id))
    .filter(Boolean);

  if (selectedTracks.length === 0) {
    return res.status(404).json({ message: "Không tìm thấy bài hát nào trong đơn hàng." });
  }

  const paidTracks = selectedTracks.filter((t) => Math.max(0, Math.floor(Number(t.price) || 0)) > 0);
  if (paidTracks.length === 0) {
    return res.status(400).json({
      message: "Các bài hát này đều miễn phí. Bạn có thể tải file MP3 Full trực tiếp mà không cần thanh toán."
    });
  }

  const totalAmount = paidTracks.reduce((sum, t) => sum + Math.max(0, Math.floor(Number(t.price) || 0)), 0);

  // Chống tấn công Open Redirect
  let safeRedirectUrl = undefined;
  if (redirectUrl && typeof redirectUrl === "string") {
    const cleanRedir = redirectUrl.trim();
    if (
      cleanRedir.startsWith("/") ||
      cleanRedir.startsWith("https://nghaoproducer.shop") ||
      cleanRedir.startsWith("https://www.nghaoproducer.shop") ||
      cleanRedir.startsWith("http://localhost:") ||
      cleanRedir.startsWith("http://127.0.0.1:")
    ) {
      safeRedirectUrl = cleanRedir;
    }
  }

  const defaultBank = db.bankAccount || {
    bankId: "MB",
    bankName: "MBBank",
    accountNo: "0392590124",
    accountName: "NGUYEN DUC ANH HAO",
    qrImage: "/bank-qr.png"
  };

  const uniqueSuffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
  const orderId = `ord_${Date.now()}`;
  const transferNote = `NGHAO ${uniqueSuffix}`.slice(0, 140);

  const isApiPayConfigured = Boolean(
    process.env.APIPAY_ACCESS_KEY &&
    process.env.APIPAY_SECRET_KEY &&
    process.env.APIPAY_BANK_PUBLIC_ID
  );

  const orderTitle = paidTracks.length === 1
    ? `Thanh toan bai hat ${paidTracks[0].title}`.slice(0, 100)
    : `Thanh toan ${paidTracks.length} bai hat Nghao Producer`.slice(0, 100);

  let apipayData = null;
  if (isApiPayConfigured) {
    try {
      apipayData = await createPaymentRequest({
        bankPublicId: process.env.APIPAY_BANK_PUBLIC_ID,
        amount: String(totalAmount),
        content: transferNote,
        title: orderTitle,
        redirectUrl: safeRedirectUrl
      });
    } catch (err) {
      const status = err instanceof ApiPayError ? err.statusCode : 502;
      const message = err instanceof ApiPayError ? err.message : "Không thể khởi tạo thanh toán ApiPay.";
      return res.status(status).json({ message });
    }
  }

  const bank = apipayData
    ? {
        bankId: apipayData.bankCode || defaultBank.bankId,
        bankName: apipayData.bankCode === "MB" ? "MBBank" : apipayData.bankCode || defaultBank.bankName,
        accountNo: apipayData.accountNumber || defaultBank.accountNo,
        accountName: apipayData.accountName || defaultBank.accountName
      }
    : defaultBank;

  let cleanEmail = undefined;
  if (email && typeof email === "string") {
    const trimmed = email.trim().slice(0, 100);
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      cleanEmail = trimmed.toLowerCase();
    }
  }

  let cleanPhone = undefined;
  if (phone && (typeof phone === "string" || typeof phone === "number")) {
    const digits = String(phone).replace(/[^\d+]/g, "").slice(0, 20);
    if (digits.length >= 8) {
      cleanPhone = digits;
    }
  }

  const items = paidTracks.map((t) => ({
    trackId: t.id,
    title: t.title,
    price: Math.max(0, Math.floor(Number(t.price) || 0)),
    cover: t.cover || ""
  }));

  const order = {
    id: orderId,
    trackId: paidTracks[0].id,
    trackIds: paidTracks.map((t) => t.id),
    items,
    amount: Number(apipayData?.amount ?? totalAmount),
    transferNote: apipayData?.content || transferNote,
    bank,
    qrUrl: apipayData?.qrUrl || defaultBank.qrImage || "/bank-qr.png",
    payUrl: apipayData?.payUrl || undefined,
    apipayPublicId: apipayData?.publicId || undefined,
    redirectSecret: apipayData?.redirectSecret || undefined,
    email: cleanEmail || undefined,
    phone: cleanPhone || undefined,
    status: "pending_verification",
    createdAt: apipayData?.createdAt || new Date().toISOString()
  };

  if (!db.orders) db.orders = [];
  db.orders.push(order);
  writeDb(db);

  res.json(sanitizeOrderForClient(order, db.tracks));
});

// GET /orders/:id — Kiểm tra trạng thái đơn hàng (cập nhật từ webhook transaction.in)
app.get("/orders/:id", (req, res) => {
  const { id } = req.params;
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  const order = (db.orders || []).find((o) => o.id === id);
  if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });

  res.json(sanitizeOrderForClient(order, db.tracks));
});

// GET /paypal/config — Trả về cấu hình PayPal Client ID & trạng thái kích hoạt
app.get("/paypal/config", (req, res) => {
  const configured = isPayPalConfigured();
  res.json({
    configured,
    clientId: configured ? (process.env.PAYPAL_CLIENT_ID || "") : "",
    currency: "USD",
    mode: process.env.PAYPAL_MODE || "sandbox"
  });
});

// POST /paypal/create-order — Khởi tạo PayPal Checkout order để khách quẹt thẻ Visa/Mastercard
app.post("/paypal/create-order", async (req, res) => {
  const { trackId, email, phone } = req.body || {};
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  const track = (db.tracks || []).find((t) => t.id === trackId);
  if (!track) return res.status(404).json({ message: "Không tìm thấy bài hát." });

  const trackPrice = Math.max(0, Math.floor(Number(track.price) || 0));
  if (trackPrice <= 0) {
    return res.status(400).json({ message: "Bài hát miễn phí không cần thanh toán." });
  }

  if (!isPayPalConfigured()) {
    return res.status(503).json({
      message: "Cổng thanh toán thẻ Visa / Mastercard & PayPal chưa được cấu hình. Vui lòng thanh toán qua VietQR hoặc liên hệ Zalo 0333 025 864."
    });
  }

  const orderId = `ord_pp_${Date.now()}`;
  const cleanEmail = email ? String(email).trim() : undefined;
  const cleanPhone = phone ? String(phone).trim() : undefined;

  try {
    const ppOrder = await createPayPalCheckoutOrder({
      orderId,
      trackTitle: track.title,
      amountVnd: trackPrice,
      customerEmail: cleanEmail
    });

    const order = {
      id: orderId,
      trackId,
      amount: trackPrice,
      amountUsd: ppOrder.amountUsd,
      currency: "USD",
      paymentMethod: "paypal_card",
      paypalOrderId: ppOrder.paypalOrderId,
      transferNote: `NGHAO VISA ${orderId.slice(-6).toUpperCase()}`,
      bank: {
        bankId: "CARD",
        bankName: "Visa / Mastercard (PayPal)",
        accountNo: "Thẻ Quốc tế",
        accountName: "NGHAO Music Store"
      },
      email: cleanEmail,
      phone: cleanPhone,
      status: "pending_verification",
      createdAt: new Date().toISOString()
    };

    if (!db.orders) db.orders = [];
    db.orders.push(order);
    writeDb(db);

    return res.json({
      orderId: order.id,
      paypalOrderId: ppOrder.paypalOrderId,
      amountUsd: ppOrder.amountUsd,
      currency: "USD"
    });
  } catch (err) {
    console.error("PayPal create order error:", err.message);
    return res.status(502).json({
      message: `Không thể tạo giao dịch thẻ Quốc tế: ${err.message}`
    });
  }
});

// POST /paypal/capture-order — Xác nhận thanh toán thẻ từ PayPal sau khi khách nhập thẻ
app.post("/paypal/capture-order", async (req, res) => {
  const { orderId, paypalOrderId, email, phone } = req.body || {};
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  const order = (db.orders || []).find(
    (o) => o.id === orderId || (paypalOrderId && o.paypalOrderId === paypalOrderId)
  );
  if (!order) {
    return res.status(404).json({ message: "Không tìm thấy đơn hàng cần thanh toán." });
  }

  if (order.status === "paid") {
    return res.json({
      success: true,
      orderId: order.id,
      status: order.status,
      email: order.email,
      phone: order.phone,
      message: "Đơn hàng đã được thanh toán thành công trước đó."
    });
  }

  const targetPaypalId = order.paypalOrderId || paypalOrderId;
  if (!targetPaypalId) {
    return res.status(400).json({ message: "Thiếu mã PayPal Order ID." });
  }

  try {
    const captureResult = await capturePayPalCheckoutOrder({ paypalOrderId: targetPaypalId });

    order.status = "paid";
    order.paidAmount = order.amount;
    order.paidAmountUsd = captureResult.paidAmountUsd;
    order.paypalCaptureId = captureResult.captureId;
    order.reconciledVia = `paypal_${captureResult.captureId}`;
    order.reconciledAt = new Date().toISOString();
    order.paidAt = new Date().toISOString();

    if (!order.email && captureResult.payerEmail) {
      order.email = captureResult.payerEmail;
    }
    if (email && (!order.email || order.email.length === 0)) {
      order.email = String(email).trim();
    }
    if (phone && (!order.phone || order.phone.length === 0)) {
      order.phone = String(phone).trim();
    }
    if (captureResult.payerName) {
      order.payerName = captureResult.payerName;
    }

    if (order.email && req.body?.subscribeNewsletter !== false) {
      const track = (db.tracks || []).find((t) => t.id === order.trackId);
      saveSubscriber(db, {
        email: order.email,
        phone: order.phone,
        source: "paid_order",
        trackId: order.trackId,
        trackTitle: track ? track.title : undefined,
        active: true
      });
    }

    writeDb(db);

    const track = (db.tracks || []).find((t) => t.id === order.trackId);

    // Báo chuông ntfy điện thoại, Telegram và Gmail cho Nghao Producer ngay tức thì!
    try {
      await notifyAdminNewPaidOrder({
        order,
        track,
        transaction: {
          transactionId: captureResult.captureId,
          amount: order.amount,
          content: `Thẻ Visa/Mastercard: $${captureResult.paidAmountUsd} USD (${order.transferNote})`
        },
        writeDb,
        db
      });
    } catch (err) {
      console.error("PayPal notify admin error:", err.message);
    }

    return res.json({
      success: true,
      orderId: order.id,
      status: order.status,
      email: order.email,
      phone: order.phone,
      amountUsd: captureResult.paidAmountUsd,
      message: "Thanh toán thẻ Visa/Mastercard thành công!"
    });
  } catch (err) {
    console.error("PayPal capture error:", err.message);
    return res.status(502).json({
      message: `Xác nhận thanh toán thẻ thất bại: ${err.message}`
    });
  }
});

// GET /orders/:id/download?token=...&trackId=... — Link tải MP3 Full bảo mật (chỉ gửi qua Gmail cho đơn đã thanh toán)
app.get("/orders/:id/download", downloadRateLimiter, async (req, res) => {
  const { id } = req.params;
  const { token, trackId: queryTrackId } = req.query;
  const db = readDb();
  if (!db) return res.status(500).send("Lỗi máy chủ.");

  const order = (db.orders || []).find((o) => o.id === id);
  if (!order || order.status !== "paid") {
    return res.status(403).send("Đơn hàng chưa được xác nhận thanh toán hoặc không tồn tại.");
  }

  const isValidToken = verifyOrderDownloadToken(id, String(token || ""), process.env.APIPAY_WEBHOOK_SECRET);
  if (!isValidToken) {
    return res.status(403).send("Đường dẫn tải nhạc không hợp lệ hoặc đã hết hạn.");
  }

  const targetTrackId = (queryTrackId && typeof queryTrackId === "string") ? queryTrackId : order.trackId;
  const orderTrackIds = Array.isArray(order.trackIds) && order.trackIds.length > 0 ? order.trackIds : [order.trackId];
  if (!orderTrackIds.includes(targetTrackId)) {
    return res.status(403).send("Bài hát không thuộc đơn hàng này.");
  }

  const track = (db.tracks || []).find((t) => t.id === targetTrackId);
  const fullUrl = track?.fullAudioUrl || track?.audioUrl;
  if (!fullUrl) {
    return res.status(404).send("Không tìm thấy file nhạc gốc cho đơn hàng này.");
  }

  try {
    const upstream = await fetch(fullUrl);
    if (!upstream.ok) {
      return res.status(502).send("Không thể tải file nhạc từ máy chủ lưu trữ.");
    }
    const safeTitle =
      String(track?.title || "Track")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
        .trim() || "Track";
    const filenameUtf8 = encodeURIComponent(`${safeTitle} - NGHAO Full.mp3`);

    res.setHeader("Content-Type", upstream.headers.get("content-type") || "audio/mpeg");
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) res.setHeader("Content-Length", contentLength);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="NGHAO-Full.mp3"; filename*=UTF-8''${filenameUtf8}`
    );

    const arrayBuffer = await upstream.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error("Full audio download proxy error:", err.message);
    return res.status(502).send("Lỗi kết nối khi tải file nhạc.");
  }
});

// GET /api/apipay/redirect-verify — Xác minh data & signature khi khách quay lại từ redirectUrl
app.get("/api/apipay/redirect-verify", (req, res) => {
  const { orderId, data, signature } = req.query;
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  const order = (db.orders || []).find((o) => o.id === orderId);
  if (!order || !order.redirectSecret) {
    return res.status(404).json({ message: "Không tìm thấy thông tin xác minh cho đơn hàng này." });
  }

  try {
    const payload = verifyRedirectPayload({ data, signature }, order.redirectSecret);

    return res.json({
      verified: true,
      redirectStatus: payload.status,
      orderId: order.id,
      status: order.status
    });
  } catch (err) {
    const status = err instanceof ApiPayError ? err.statusCode : 400;
    const message = err instanceof ApiPayError ? err.message : "Chữ ký redirect không hợp lệ.";
    return res.status(status).json({ verified: false, message });
  }
});

// POST /orders/:id/confirm — Lưu Gmail & SĐT khách hàng, kiểm tra thanh toán và tự động gửi file MP3 Full qua Gmail
app.post("/orders/:id/confirm", async (req, res) => {
  const { id } = req.params;
  const { email, phone, subscribeNewsletter = true } = req.body || {};
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  const order = (db.orders || []).find((o) => o.id === id);
  if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });

  if (email) {
    order.email = String(email).trim();
  }
  if (phone !== undefined) {
    order.phone = String(phone).trim();
  }
  if (!order.status) {
    order.status = "pending_verification";
  }

  // Tự động lưu Gmail vào danh sách nhận thông báo bài mới nếu được tích (mặc định tích)
  if (order.email && subscribeNewsletter !== false) {
    const track = (db.tracks || []).find((t) => t.id === order.trackId);
    saveSubscriber(db, {
      email: order.email,
      phone: order.phone,
      source: "paid_order",
      trackId: order.trackId,
      trackTitle: track ? track.title : undefined,
      active: true
    });
  }

  writeDb(db);

  const isPaid = order.status === "paid";
  const isUnderpaid = order.status === "underpaid";
  let emailSent = Boolean(order.emailSentAt);
  let emailDeliveryReason = undefined;

  if (isPaid) {
    const track = (db.tracks || []).find((t) => t.id === order.trackId);
    try {
      await notifyAdminNewPaidOrder({ order, track, writeDb, db });
    } catch (err) {
      console.error("Confirm notify admin error:", err.message);
    }
    if (order.email) {
      const mailResult = await triggerEmailIfPaid(order, db);
      emailSent = Boolean(mailResult.sent || order.emailSentAt);
      emailDeliveryReason = mailResult.reason;
    }
  }

  let message = "Hệ thống đã ghi nhận Gmail và Số điện thoại của bạn. Nghao Producer sẽ gửi trực tiếp bản MP3 Full qua Gmail cho bạn sau khi xác nhận thanh toán!";
  if (isPaid) {
    const emailNotice = order.email
      ? `Đã ghi nhận Gmail (${order.email})${order.phone ? ` & SĐT (${order.phone})` : ""}. Nghao Producer sẽ gửi trực tiếp bản MP3 Full chất lượng cao qua Gmail cho bạn!`
      : "Vui lòng nhập Gmail để Nghao gửi file nhạc cho bạn.";
    message =
      order.overpaidAmount > 0
        ? `Thanh toán đã xác nhận thành công (Chuyển dư +${Number(order.overpaidAmount).toLocaleString("vi-VN")} ₫). ${emailNotice}`
        : `Thanh toán đã được xác nhận thành công. ${emailNotice}`;
  } else if (isUnderpaid) {
    message = `Hệ thống đã nhận ${Number(order.paidAmount || 0).toLocaleString("vi-VN")} ₫ nhưng đơn hàng còn thiếu ${Number(order.shortfallAmount || 0).toLocaleString("vi-VN")} ₫. Vui lòng chuyển thêm phần còn thiếu với cùng nội dung "${order.transferNote}" hoặc liên hệ Zalo 0333 025 864.`;
  }

  res.json({
    orderId: id,
    status: order.status,
    email: order.email,
    phone: order.phone,
    emailSent,
    emailSentAt: order.emailSentAt,
    emailDeliveryReason,
    paidAmount: order.paidAmount,
    shortfallAmount: order.shortfallAmount,
    overpaidAmount: order.overpaidAmount,
    paymentResolution: order.paymentResolution,
    message
  });
});

// POST /orders/:id/resend-email — Gửi lại hoặc cập nhật Gmail & SĐT nhận file MP3 Full cho đơn hàng đã thanh toán
app.post("/orders/:id/resend-email", async (req, res) => {
  const { id } = req.params;
  const { email, phone } = req.body || {};
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  const order = (db.orders || []).find((o) => o.id === id);
  if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });

  if (email) {
    const clean = String(email).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      return res.status(400).json({ message: "Địa chỉ Gmail không hợp lệ." });
    }
    order.email = clean;
    writeDb(db);
  }
  if (phone !== undefined) {
    order.phone = String(phone).trim();
    writeDb(db);
  }

  if (!order.email) {
    return res.status(400).json({ message: "Vui lòng nhập địa chỉ Gmail để nhận file nhạc." });
  }

  if (order.status !== "paid") {
    return res.status(400).json({ message: "Đơn hàng chưa hoàn tất thanh toán nên chưa thể gửi file." });
  }

  const mailResult = await triggerEmailIfPaid(order, db, { force: true });
  return res.json({
    orderId: order.id,
    email: order.email,
    phone: order.phone,
    sent: Boolean(mailResult.sent),
    emailSentAt: order.emailSentAt,
    reason: mailResult.reason,
    message: mailResult.sent
      ? `Đã gửi link tải MP3 Full tới Gmail ${order.email}! Vui lòng kiểm tra cả mục Hộp thư đến và Thư rác (Spam).`
      : "Đã ghi nhận yêu cầu gửi Gmail. Nếu sau 1-2 phút chưa nhận được, vui lòng nhắn trực tiếp qua Facebook hoặc Zalo để được gửi file ngay."
  });
});

/* ──────── Admin Google Authenticator (TOTP - RFC 6238) ──────── */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function bufferToBase32(buf) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32ToBuffer(base32Str) {
  const cleaned = String(base32Str || "")
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function generateTotpAtCounter(secretBase32, counter) {
  const key = base32ToBuffer(secretBase32);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter), 0);
  const hmac = crypto.createHmac("sha1", key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 1000000).padStart(6, "0");
}

export function verifyTotpCode(inputCode, secretBase32, windowSteps = 1) {
  const cleanCode = String(inputCode || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleanCode) || !secretBase32) return false;

  const currentStep = Math.floor(Date.now() / 1000 / 30);
  for (let w = -windowSteps; w <= windowSteps; w++) {
    const expected = generateTotpAtCounter(secretBase32, currentStep + w);
    const a = Buffer.from(cleanCode, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return true;
    }
  }
  return false;
}

function ensureAdminTotpSecret(db) {
  if (process.env.ADMIN_TOTP_SECRET) {
    return process.env.ADMIN_TOTP_SECRET.trim();
  }
  if (!db.adminTotpSecret) {
    db.adminTotpSecret = bufferToBase32(crypto.randomBytes(20));
    writeDb(db);
  }
  return db.adminTotpSecret;
}

function buildTotpSetupInfo(secret) {
  const issuer = "Nghao Producer";
  const account = "nghaoproducer@gmail.com";
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const otpauthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(otpauthUrl)}`;
  return { secret, otpauthUrl, qrUrl, issuer, account };
}

function getTokenSecret(db) {
  const secret = ensureAdminTotpSecret(db);
  return `${secret}:${process.env.APIPAY_WEBHOOK_SECRET || "nghao_admin_token_secret"}`;
}

function createAdminToken(db) {
  const payload = Buffer.from(
    JSON.stringify({
      role: "author_admin",
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000
    }),
    "utf8"
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", getTokenSecret(db)).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verifyAdminToken(token, db) {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expectedSig = crypto.createHmac("sha256", getTokenSecret(db)).update(payload).digest("hex");
  if (sig.length !== expectedSig.length || !/^[0-9a-fA-F]+$/.test(sig)) return false;
  const valid = crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expectedSig, "hex"));
  if (!valid) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return decoded?.role === "author_admin" && Number(decoded.exp) > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  const origin = req.headers.origin;
  if (origin && !isOriginAllowed(origin)) {
    return res.status(403).json({ message: "Yêu cầu bị từ chối do nguồn gốc không hợp lệ (CORS/CSRF)." });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  if (!verifyAdminToken(token, db)) {
    return res.status(401).json({ message: "Phiên đăng nhập Admin đã hết hạn hoặc chưa xác thực Google Authenticator." });
  }
  next();
}

// GET /admin/auth/status — Kiểm tra trạng thái đăng nhập & cấu hình Google Authenticator
app.get("/admin/auth/status", (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  const secret = ensureAdminTotpSecret(db);
  const authenticated = verifyAdminToken(token, db);
  const totpConfigured = Boolean(db.adminTotpConfigured);

  // Chỉ hiển thị QR cài đặt lần đầu khi chưa kích hoạt HOẶC khi đã đăng nhập Admin
  const totpSetup = !totpConfigured || authenticated ? buildTotpSetupInfo(secret) : null;

  res.json({
    authenticated,
    totpConfigured,
    totpSetup
  });
});

const loginAttempts = new Map();

// Dọn dẹp bộ nhớ đăng nhập định kỳ chống memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of loginAttempts.entries()) {
    if (now - rec.firstAt > 10 * 60 * 1000) {
      loginAttempts.delete(ip);
    }
  }
}, 10 * 60 * 1000).unref();

// POST /admin/auth/login — Đăng nhập bằng mã 6 số Google Authenticator (TOTP)
app.post("/admin/auth/login", globalLoginLimiter, (req, res) => {
  const clientIp = getClientIp(req);
  const now = Date.now();
  const attemptRecord = loginAttempts.get(clientIp);
  if (attemptRecord && attemptRecord.count >= 5 && now - attemptRecord.firstAt < 5 * 60 * 1000) {
    return res.status(429).json({
      message: "Bạn đã nhập sai quá 5 lần. Vui lòng đợi 5 phút trước khi thử lại."
    });
  }

  const { otp, passkey } = req.body || {};
  const code = String(otp || passkey || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({
      message: "Mã Google Authenticator phải là chuỗi 6 chữ số."
    });
  }

  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  const secret = ensureAdminTotpSecret(db);
  if (!verifyTotpCode(code, secret, 1)) {
    const prev = loginAttempts.get(clientIp);
    if (!prev || now - prev.firstAt >= 5 * 60 * 1000) {
      loginAttempts.set(clientIp, { count: 1, firstAt: now });
    } else {
      prev.count += 1;
    }
    return res.status(401).json({
      message: "Mã 6 số Google Authenticator không chính xác hoặc đã hết hạn (mã đổi mới mỗi 30 giây)."
    });
  }

  loginAttempts.delete(clientIp);

  if (!db.adminTotpConfigured) {
    db.adminTotpConfigured = true;
    writeDb(db);
  }

  const token = createAdminToken(db);
  return res.json({ token, method: "google_authenticator" });
});

// POST /admin/auth/totp-reset — Tạo lại mã QR Google Authenticator mới (khi đổi điện thoại)
app.post("/admin/auth/totp-reset", requireAdmin, (req, res) => {
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  db.adminTotpSecret = bufferToBase32(crypto.randomBytes(20));
  db.adminTotpConfigured = true;
  writeDb(db);

  const totpSetup = buildTotpSetupInfo(db.adminTotpSecret);
  const token = createAdminToken(db);
  res.json({ token, totpSetup });
});

/* ──────── Admin Reconciliation Endpoints ──────── */

async function buildReconciliationResponse(db, syncWithApiPay = true) {
  let overview = null;
  let apipayTransactions = [];
  let apipayPaymentRequests = [];
  let newlyMatchedCount = 0;

  const isApiPayConfigured = Boolean(
    process.env.APIPAY_ACCESS_KEY &&
    process.env.APIPAY_SECRET_KEY &&
    process.env.APIPAY_BANK_PUBLIC_ID
  );

  if (syncWithApiPay && isApiPayConfigured) {
    try {
      const liveData = await fetchApiPayReconciliationData();
      overview = liveData.overview;
      apipayTransactions = liveData.transactions;
      apipayPaymentRequests = liveData.paymentRequests;

      const syncResult = reconcileDbWithApiPay(db, {
        transactions: apipayTransactions,
        paymentRequests: apipayPaymentRequests
      });
      newlyMatchedCount = syncResult.newlyMatchedCount;
      if (newlyMatchedCount > 0) {
        writeDb(db);
        for (const ord of db.orders || []) {
          if (ord.status === "paid" && (!ord.ntfyNotifiedAt || !ord.telegramNotifiedAt || !ord.adminEmailNotifiedAt)) {
            const track = (db.tracks || []).find((t) => t.id === ord.trackId);
            try {
              await notifyAdminNewPaidOrder({ order: ord, track, writeDb, db });
            } catch (err) {
              console.error("Sync notify admin error:", err.message);
            }
          }
        }
      }
    } catch (err) {
      console.error("Reconciliation ApiPay sync warning:", err.message);
    }
  } else {
    try {
      const syncResult = reconcileDbWithApiPay(db);
      newlyMatchedCount = syncResult.newlyMatchedCount;
      if (newlyMatchedCount > 0) {
        writeDb(db);
      }
    } catch (err) {
      console.error("Local reconciliation warning:", err.message);
    }
  }

  const tracks = db.tracks || [];
  const orders = (db.orders || [])
    .map((ord) => {
      const track = tracks.find((t) => t.id === ord.trackId);
      const safe = sanitizeOrderForClient(ord, tracks, { includeDownloadUrl: true });
      return {
        ...safe,
        status: safe.status || "pending_verification",
        trackTitle: track?.title || "Bài hát đã xoá",
        trackCover: track?.cover || ""
      };
    })
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const processedTransactions = (db.processedTransactions || []).slice().sort(
    (a, b) => new Date(b.transactionDate || b.processedAt || 0).getTime() - new Date(a.transactionDate || a.processedAt || 0).getTime()
  );

  return {
    orders,
    processedTransactions,
    apipayOverview: overview,
    apipayTransactions,
    apipayPaymentRequests,
    newlyMatchedCount,
    ntfyTopic: (process.env.NTFY_TOPIC || DEFAULT_NTFY_TOPIC).trim()
  };
}

// GET /admin/reconciliation — Lấy dữ liệu đối soát đơn hàng & giao dịch ngân hàng
app.get("/admin/reconciliation", requireAdmin, async (req, res) => {
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  const data = await buildReconciliationResponse(db, true);
  res.json(data);
});

// POST /admin/reconciliation/sync — Chủ động đồng bộ & rà soát lại toàn bộ đơn với ApiPay
app.post("/admin/reconciliation/sync", requireAdmin, async (req, res) => {
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  const data = await buildReconciliationResponse(db, true);
  res.json(data);
});

// POST /analytics/event — Nhận sự kiện pageview / play / download từ client
app.post("/analytics/event", analyticsRateLimiter, (req, res) => {
  const { type, trackId, trackTitle } = req.body || {};
  if (type === "pageview" || type === "play" || type === "download") {
    const cleanTrackId = trackId ? String(trackId).slice(0, 50) : undefined;
    const cleanTrackTitle = trackTitle ? String(trackTitle).slice(0, 150) : undefined;
    recordAnalyticsEvent({ type, trackId: cleanTrackId, trackTitle: cleanTrackTitle, req });
  }
  res.json({ ok: true });
});

// GET /admin/analytics — Lấy số liệu thống kê truy cập, lượt nghe, lượt tải nhạc free
app.get("/admin/analytics", requireAdmin, (req, res) => {
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  const store = getAnalyticsStore(db);
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const todayStats = store.daily[todayStr] || { views: 0, uniques: 0, plays: 0, downloads: 0 };
  const tracks = db.tracks || [];

  // Top tracks by play
  const topTracksByPlay = Object.entries(store.trackPlays || {})
    .map(([id, count]) => {
      const track = tracks.find((t) => t.id === id);
      return {
        id,
        title: track?.title || "Bài hát đã xoá",
        artist: track?.artist || "Nghao",
        cover: track?.cover || "",
        playCount: count
      };
    })
    .sort((a, b) => b.playCount - a.playCount);

  const totalPlays = store.totalPlays || 0;
  const topTracksWithPercentage = topTracksByPlay.map((t) => ({
    ...t,
    percentage: totalPlays > 0 ? Math.round((t.playCount / totalPlays) * 100) : 0
  }));

  // Top tracks by free download
  const topTracksByDownload = Object.entries(store.trackDownloads || {})
    .map(([id, count]) => {
      const track = tracks.find((t) => t.id === id);
      return {
        id,
        title: track?.title || "Bài hát đã xoá",
        artist: track?.artist || "Nghao",
        cover: track?.cover || "",
        downloadCount: count
      };
    })
    .sort((a, b) => b.downloadCount - a.downloadCount);

  // Daily stats for past 14 days
  const dailyTrend = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dStr = d.toISOString().slice(0, 10);
    const stat = store.daily[dStr] || { views: 0, uniques: 0, plays: 0, downloads: 0 };
    dailyTrend.push({
      date: dStr,
      views: stat.views || 0,
      uniques: stat.uniques || 0,
      plays: stat.plays || 0,
      downloads: stat.downloads || 0
    });
  }

  const subscribers = db.subscribers || [];
  const totalSubscribers = subscribers.filter((s) => s.active !== false).length;

  res.json({
    totalViews: store.totalViews || 0,
    todayViews: todayStats.views || 0,
    totalUniqueVisitors: store.totalUniqueVisitors || 0,
    todayUniqueVisitors: todayStats.uniques || 0,
    totalPlays: store.totalPlays || 0,
    todayPlays: todayStats.plays || 0,
    totalDownloads: store.totalDownloads || 0,
    todayDownloads: todayStats.downloads || 0,
    totalSubscribers,
    subscribers,
    topTracksByPlay: topTracksWithPercentage,
    topTracksByDownload,
    dailyTrend,
    recentDownloads: store.recentDownloads || [],
    recentPlays: store.recentPlays || [],
    devices: store.devices || { mobile: 0, desktop: 0, tablet: 0 }
  });
});

// GET /admin/subscribers — Danh sách tất cả khách đăng ký nhận thông báo bài nhạc mới
app.get("/admin/subscribers", requireAdmin, (req, res) => {
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });
  const list = db.subscribers || [];
  return res.json({
    total: list.filter((s) => s.active !== false).length,
    subscribers: list
  });
});

// DELETE /admin/subscribers/:id — Xóa người đăng ký khỏi danh sách
app.delete("/admin/subscribers/:id", requireAdmin, (req, res) => {
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });
  const idOrEmail = req.params.id;
  db.subscribers = (db.subscribers || []).filter(
    (s) => s.id !== idOrEmail && s.email !== idOrEmail
  );
  writeDb(db);
  return res.json({ success: true, message: "Đã xóa khỏi danh sách đăng ký." });
});

// GET /admin/newsletter/status — Trạng thái cấu hình Resend và số lượng subscriber
app.get("/admin/newsletter/status", requireAdmin, (req, res) => {
  const resendApiKey = (process.env.RESEND_API_KEY || "").trim();
  const senderEmail = (process.env.RESEND_FROM_EMAIL || "NGHAO Producer <release@nghaoproducer.shop>").trim();
  const db = readDb();
  const totalSubscribers = (db?.subscribers || []).filter((s) => s.active !== false).length;

  return res.json({
    configured: Boolean(resendApiKey),
    senderEmail,
    totalSubscribers
  });
});

// POST /admin/newsletter/broadcast — Tự động gửi thông báo bài nhạc mới hàng loạt qua Resend API
app.post("/admin/newsletter/broadcast", requireAdmin, async (req, res) => {
  const { trackId, customSubject, customMessage } = req.body || {};
  if (!trackId) {
    return res.status(400).json({ message: "Vui lòng chọn bài hát để gửi thông báo." });
  }

  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  const track = (db.tracks || []).find((t) => t.id === trackId);
  if (!track) {
    return res.status(404).json({ message: "Không tìm thấy bài hát này." });
  }

  const subscribers = (db.subscribers || []).filter((s) => s.active !== false && s.email);
  if (subscribers.length === 0) {
    return res.status(400).json({ message: "Chưa có người đăng ký nhận thông báo nào trong danh sách." });
  }

  try {
    const result = await sendTrackReleaseNewsletter({
      track,
      subscribers,
      customSubject,
      customMessage
    });

    if (!result.success) {
      return res.status(400).json({
        message: result.error || "Gửi email thông báo thất bại.",
        errors: result.errors
      });
    }

    return res.json({
      success: true,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      totalTargeted: result.totalTargeted,
      message: `Đã gửi email thông báo thành công tới ${result.sentCount} người đăng ký qua Resend!`
    });
  } catch (err) {
    console.error("[newsletter broadcast error]", err);
    return res.status(500).json({ message: err.message || "Lỗi hệ thống khi gửi email qua Resend." });
  }
});

// PATCH /admin/orders/:id/status — Duyệt thủ công hoặc đặt lại trạng thái đơn hàng
app.patch("/admin/orders/:id/status", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body || {};
  if (status !== "paid" && status !== "pending_verification") {
    return res.status(400).json({ message: "Trạng thái không hợp lệ." });
  }

  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  const order = (db.orders || []).find((o) => o.id === id);
  if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });

  order.status = status;
  if (status === "paid") {
    order.paidAt = order.paidAt || new Date().toISOString();
    order.paidAmount = order.paidAmount || order.amount;
    order.shortfallAmount = 0;
    order.paymentResolution = (order.overpaidAmount || 0) > 0 ? "overpaid" : "exact";
    order.reconciledVia = "manual_admin";
    if (note) order.adminNote = String(note);
  } else {
    order.paidAt = undefined;
    order.reconciledVia = undefined;
    order.paymentResolution = undefined;
    order.shortfallAmount = undefined;
  }

  writeDb(db);

  if (status === "paid") {
    const track = (db.tracks || []).find((t) => t.id === order.trackId);
    try {
      await notifyAdminNewPaidOrder({ order, track, writeDb, db });
    } catch (err) {
      console.error("Manual status notify admin error:", err.message);
    }
  }

  res.json(sanitizeOrderForClient(order, db.tracks, { includeDownloadUrl: true }));
});

// PATCH /admin/orders/:id/email-sent — Đánh dấu Admin đã gửi file qua Gmail thủ công cho khách
app.patch("/admin/orders/:id/email-sent", requireAdmin, (req, res) => {
  const { id } = req.params;
  const { sent = true, email, phone } = req.body || {};
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  const order = (db.orders || []).find((o) => o.id === id);
  if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });

  if (email) {
    order.email = String(email).trim();
  }
  if (phone !== undefined) {
    order.phone = String(phone).trim();
  }
  order.emailSentAt = sent ? new Date().toISOString() : undefined;
  writeDb(db);

  res.json(sanitizeOrderForClient(order, db.tracks, { includeDownloadUrl: true }));
});

// POST /admin/notifications/test — Gửi thông báo thử nghiệm tới ntfy điện thoại, Telegram & Gmail
app.post("/admin/notifications/test", requireAdmin, async (req, res) => {
  const dummyOrder = {
    id: `test_${Date.now()}`,
    amount: 1000,
    transferNote: "NGHAO TEST999",
    email: "khachhang_test@gmail.com",
    status: "paid"
  };
  const dummyTrack = {
    id: "test_track",
    title: "Bản nhạc Thử nghiệm (Test Track)"
  };

  const [ntfyResult, teleResult, mailResult] = await Promise.allSettled([
    sendNtfyOrderAlert({
      order: dummyOrder,
      track: dummyTrack,
      transaction: { transactionId: "TEST_TX_12345" }
    }),
    sendTelegramOrderAlert({
      order: dummyOrder,
      track: dummyTrack,
      transaction: { transactionId: "TEST_TX_12345" }
    }),
    sendGmailOrderAlert({
      order: dummyOrder,
      track: dummyTrack,
      transaction: { transactionId: "TEST_TX_12345" }
    })
  ]);

  res.json({
    ntfy: ntfyResult.status === "fulfilled" ? ntfyResult.value : { sent: false, error: ntfyResult.reason?.message },
    telegram: teleResult.status === "fulfilled" ? teleResult.value : { sent: false, error: teleResult.reason?.message },
    gmail: mailResult.status === "fulfilled" ? mailResult.value : { sent: false, error: mailResult.reason?.message }
  });
});

// DELETE /admin/orders/:id — Xoá đơn hàng rác / thử nghiệm
app.delete("/admin/orders/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  db.orders = (db.orders || []).filter((o) => o.id !== id);
  writeDb(db);
  res.status(204).send();
});

// POST /uploads
app.post(
  "/uploads",
  requireAdmin,
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message || "Lỗi tải file lên." });
      }
      next();
    });
  },
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "Không có file nào được tải lên." });
    }

  const kind = req.body.kind || "auto"; // "image" | "audio"

  if (isCloudinaryConfigured) {
    try {
      // Cloudinary upload (resource_type: "video" or "auto" handles mp3/wav/flac/m4a & images)
      const resourceType = kind === "image" ? "image" : "auto";
      const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: resourceType,
        folder: `music_store/${kind}s`
      });

      // Xoá file tạm sau khi upload lên cloud thành công
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.json({ url: result.secure_url });
    } catch (uploadError) {
      console.error("Cloudinary upload failed:", uploadError);
      return res.status(500).json({ message: "Tải file lên Cloudinary thất bại: " + (uploadError.message || "") });
    }
  }

  // Fallback sang local server nếu chưa điền key Cloudinary
  const fileUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// POST /tracks
app.post("/tracks", requireAdmin, (req, res) => {
  const input = req.body;
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  if (input.price !== undefined) {
    input.price = Math.max(0, Math.floor(Number(input.price) || 0));
  }

  const newTrack = {
    ...input,
    id: `t${Date.now()}`,
    artist: db.producer.name
  };

  db.tracks.unshift(newTrack);
  writeDb(db);

  res.status(201).json(newTrack);
});

// PUT /tracks/reorder — Sắp xếp lại thứ tự bài hát hiển thị trên Store
app.put("/tracks/reorder", requireAdmin, (req, res) => {
  const { trackIds } = req.body;
  if (!Array.isArray(trackIds)) {
    return res.status(400).json({ message: "trackIds phải là mảng id bài hát." });
  }

  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  const existingMap = new Map((db.tracks || []).map((t) => [t.id, t]));
  const reordered = [];

  for (const id of trackIds) {
    if (existingMap.has(id)) {
      reordered.push(existingMap.get(id));
      existingMap.delete(id);
    }
  }

  // Bổ sung những bài còn lại nếu client chưa gửi hết (đảm bảo an toàn không bao giờ mất bài)
  for (const remaining of existingMap.values()) {
    reordered.push(remaining);
  }

  db.tracks = reordered;
  writeDb(db);

  res.json(db.tracks);
});

// PATCH /tracks/:id
app.patch("/tracks/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const patch = req.body;
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  const idx = db.tracks.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ message: "Không tìm thấy bài hát." });

  if (patch.price !== undefined) {
    patch.price = Math.max(0, Math.floor(Number(patch.price) || 0));
  }

  // Bảo vệ: Nếu client gửi lên URL proxy ngụy trang (/tiktok-sdk, /v2/media/...) thay vì link Cloudinary mới, giữ nguyên Cloudinary gốc
  const isProxyUrl = (url) =>
    typeof url === "string" &&
    (url.startsWith("/v2/media/") || url.includes("/tiktok-sdk/") || url.includes("/fb-tr/") || url.startsWith("/tracks/"));

  if (patch.audioUrl && isProxyUrl(patch.audioUrl)) {
    delete patch.audioUrl;
  }
  if (patch.fullAudioUrl && isProxyUrl(patch.fullAudioUrl)) {
    delete patch.fullAudioUrl;
  }
  if (patch.cover && isProxyUrl(patch.cover)) {
    delete patch.cover;
  }

  db.tracks[idx] = { ...db.tracks[idx], ...patch };
  writeDb(db);

  res.json(db.tracks[idx]);
});

// DELETE /tracks/:id
app.delete("/tracks/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  db.tracks = db.tracks.filter((t) => t.id !== id);
  if (db.sections?.newReleases?.trackIds) {
    db.sections.newReleases.trackIds = db.sections.newReleases.trackIds.filter((tid) => tid !== id);
  }
  writeDb(db);

  res.status(204).send();
});

// PUT /producer
app.put("/producer", requireAdmin, (req, res) => {
  const producer = req.body;
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  db.producer = { ...producer };
  db.tracks = db.tracks.map((t) => ({ ...t, artist: producer.name }));
  writeDb(db);

  res.json(db.producer);
});

// PUT /store-info
app.put("/store-info", requireAdmin, (req, res) => {
  const info = req.body;
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  db.info = { ...info };
  writeDb(db);

  res.json(db.info);
});

// PUT /sections
app.put("/sections", requireAdmin, (req, res) => {
  const sections = req.body;
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  const nextSections = { ...sections };
  if (nextSections.newReleases && Array.isArray(nextSections.newReleases.trackIds)) {
    nextSections.newReleases = {
      ...nextSections.newReleases,
      trackIds: nextSections.newReleases.trackIds.slice(0, 5)
    };
  }
  db.sections = nextSections;
  writeDb(db);

  res.json(db.sections);
});

/* ──────── Albums CRUD Endpoints ──────── */

// POST /albums
app.post("/albums", requireAdmin, (req, res) => {
  const input = req.body;
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  const newAlbum = {
    ...input,
    id: `alb_${Date.now()}`,
    artist: db.producer.name,
    createdAt: new Date().toISOString()
  };

  if (!db.albums) db.albums = [];
  db.albums.unshift(newAlbum);
  writeDb(db);

  res.status(201).json(newAlbum);
});

// PATCH /albums/:id
app.patch("/albums/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const patch = req.body;
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  if (!db.albums) db.albums = [];
  const idx = db.albums.findIndex((a) => a.id === id);
  if (idx === -1) return res.status(404).json({ message: "Không tìm thấy album." });

  db.albums[idx] = { ...db.albums[idx], ...patch };

  // Đồng bộ lại tên album trong các tracks nếu tên album thay đổi
  if (patch.title) {
    db.tracks = db.tracks.map((t) => (t.albumId === id ? { ...t, album: patch.title } : t));
  }

  writeDb(db);
  res.json(db.albums[idx]);
});

// DELETE /albums/:id
app.delete("/albums/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  if (!db.albums) db.albums = [];
  db.albums = db.albums.filter((a) => a.id !== id);

  // Chuyển các track thuộc album này về Single
  db.tracks = db.tracks.map((t) => (t.albumId === id ? { ...t, albumId: undefined, album: "Single" } : t));

  writeDb(db);
  res.status(204).send();
});

const isMainEntry = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (!process.env.VERCEL && isMainEntry) {
  initSupabaseStore().finally(() => {
    app.listen(PORT, () => {
      console.log(`Backend server is running on http://localhost:${PORT}`);
    });
  });
}

export { initSupabaseStore, readDb, writeDb };
export default app;

