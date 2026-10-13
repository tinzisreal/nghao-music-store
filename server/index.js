import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
app.disable("x-powered-by");
const PORT = process.env.PORT || 5000;

// Cloudinary setup
const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET &&
  process.env.CLOUDINARY_CLOUD_NAME !== "your_cloud_name"
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log("Cloudinary is enabled for audio & image storage.");
} else {
  console.log("Cloudinary not configured yet, using local storage fallback (/uploads).");
}

app.use(cors());

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

// Ngụy trang đường dẫn API sang chuẩn Facebook Pixel / TikTok SDK & mã hóa payload phản hồi
app.use((req, res, next) => {
  const originalUrl = req.url;
  const rawPath = originalUrl.split("?")[0];

  // Bỏ tiền tố proxy nếu gọi trực tiếp hoặc qua Vercel proxy (/fb-tr, /tiktok-sdk, /api-proxy)
  req.url = req.url.replace(/^\/(fb-tr|tiktok-sdk|api-proxy)(?=\/|$)/, "") || "/";

  const [pathname, search = ""] = req.url.split("?");
  const qs = search ? `?${search}` : "";

  const isFbDisguised = rawPath.startsWith("/fb-tr/") || pathname.startsWith("/v19.0/");
  const isTtDisguised = rawPath.startsWith("/tiktok-sdk/") || pathname.startsWith("/v2/events/");
  const isMediaStream = pathname.startsWith("/v2/media/stream/");
  const isMediaAsset = pathname.startsWith("/v2/media/asset/");
  const isMediaCover = pathname.startsWith("/v2/media/cover/") || pathname.startsWith("/v2/media/album-cover/");
  const isMediaQr = pathname.startsWith("/v2/media/qr/");
  const isMediaCheckout = pathname.startsWith("/v2/events/checkout/");
  const isMediaRoute = isMediaStream || isMediaAsset || isMediaCover || isMediaQr || isMediaCheckout;
  const hasClientCodec = req.headers["x-fb-codec"] === "1";
  const acceptHeader = req.headers["accept"] || "";
  const isBrowserNav =
    acceptHeader.includes("text/html") ||
    req.headers["sec-fetch-dest"] === "document" ||
    req.headers["sec-fetch-mode"] === "navigate";

  // 1. Nếu mở trực tiếp link ngụy trang trên trình duyệt hoặc không có client handshake hợp lệ
  if (!isMediaRoute) {
    if (isFbDisguised && !hasClientCodec) {
      if (isBrowserNav) {
        return res.redirect(302, "https://www.facebook.com/tr/");
      }
      return res.status(400).json({
        error: {
          message:
            "Unsupported get request. Object with ID 'v19.0' does not exist, cannot be loaded due to missing permissions, or does not support this operation. Please read the Graph API documentation at https://developers.facebook.com/docs/graph-api",
          type: "GraphMethodException",
          code: 100,
          error_subcode: 33,
          fbtrace_id: "F" + Math.random().toString(36).slice(2, 10)
        }
      });
    }

    if (isTtDisguised && !hasClientCodec) {
      if (isBrowserNav) {
        return res.redirect(302, "https://analytics.tiktok.com/");
      }
      return res.status(401).json({
        code: 40101,
        message: "Access token is invalid or expired.",
        data: null
      });
    }

    // Nếu cố tình gọi trực tiếp các route nội bộ (không qua proxy và không phải webhook / health / download)
    const isDirectInternal = ["/tracks", "/producer", "/albums", "/store-info", "/sections", "/orders"].some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
    const hasAdminToken = (req.headers["authorization"] || "").startsWith("Bearer ");
    if (isDirectInternal && !hasClientCodec && !hasAdminToken && !pathname.includes("/download")) {
      if (isBrowserNav) {
        return res.redirect(302, "https://nghaoproducer.duckdns.org/");
      }
      return res.status(404).json({ error: "Not found" });
    }
  }

  // Ánh xạ các đường dẫn ngụy trang Facebook/TikTok về route nội bộ
  if (pathname === "/v19.0/pixel/config") req.url = `/producer${qs}`;
  else if (pathname === "/v19.0/pixel/catalog") req.url = `/tracks${qs}`;
  else if (pathname === "/v19.0/pixel/collections") req.url = `/albums${qs}`;
  else if (pathname === "/v19.0/pixel/attribution") req.url = `/store-info${qs}`;
  else if (pathname === "/v19.0/pixel/placements") req.url = `/sections${qs}`;
  else if (pathname === "/v2/events/initiate") req.url = `/orders${qs}`;
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

  // Nếu client gửi header x-fb-codec: 1, mã hóa payload phản hồi dạng nhị phân XOR giả lập Facebook Telemetry
  if (hasClientCodec) {
    const origJson = res.json.bind(res);
    res.json = (body) => {
      if (body && typeof body === "object" && !body._p) {
        const encoded = encryptTelemetry(body);
        return origJson({
          fb_trace_id: `fb.1.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`,
          tt_sdk_ver: "2.4.1",
          _p: encoded
        });
      }
      return origJson(body);
    };
  }

  next();
});

// Database file helpers + Supabase Cloud Sync (for Render stateless deployments)
const DB_FILE = path.join(__dirname, "db.json");
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
    const data = fs.readFileSync(DB_FILE, "utf-8");
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
      fs.writeFileSync(DB_FILE, JSON.stringify(memoryDb, null, 2), "utf-8");
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
    rawUrl.includes("/upload/") &&
    end > start
  ) {
    return rawUrl.replace("/upload/", `/upload/so_${start},eo_${end}/`);
  }
  return rawUrl;
}

function sanitizeTrackForPublic(track) {
  if (!track) return null;
  const { fullAudioUrl: _fullAudioUrl, ...rest } = track;
  const rawStart = Math.max(0, Math.floor(Number(track.demoStart) || 0));
  const rawEnd = Math.max(0, Math.floor(Number(track.demoEnd) || 0));
  const hasDemoSlice = rawEnd > rawStart;
  const demoDuration = hasDemoSlice ? rawEnd - rawStart : Number(track.duration) || 30;

  return {
    ...rest,
    cover: track.cover ? `/v2/media/cover/${encodeURIComponent(track.id)}` : "",
    audioUrl: track.audioUrl ? `/v2/media/stream/${encodeURIComponent(track.id)}` : "",
    demoStart: 0,
    demoEnd: demoDuration
  };
}

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    supabase: isSupabaseConfigured,
    cloudinary: isCloudinaryConfigured,
    gmailConfigured: Boolean(process.env.GMAIL_SCRIPT_URL)
  });
});

// POST /api/apipay/webhook — Phải giữ nguyên raw body trước khi qua express.json()
app.post("/api/apipay/webhook", express.raw({ type: "*/*" }), (req, res) => {
  const signature = req.headers["apipay-signature"];
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : typeof req.body === "string"
      ? Buffer.from(req.body, "utf8")
      : Buffer.from("");

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
    if (matchedOrder && matchedOrder.email) {
      triggerEmailIfPaid(matchedOrder, db).catch((err) => {
        console.error("Webhook auto-email error:", err.message);
      });
    }
  }

  return res.status(result.statusCode).json(result.body);
});

app.use(express.json());

// Serve uploaded files statically (fallback)
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
app.use("/uploads", express.static(UPLOAD_DIR));

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

/* ──────── Public Endpoints ──────── */

// GET /producer
app.get("/producer", (req, res) => {
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });
  res.json(db.producer);
});

// GET /tracks — Ẩn hoàn toàn link Cloudinary & fullAudioUrl đối với khách truy cập
app.get("/tracks", (req, res) => {
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

// GET /tracks/:id/demo-stream — Proxy phát bản nhạc Demo đã cắt phía server (ẩn hoàn toàn link Cloudinary gốc)
app.get("/tracks/:id/demo-stream", async (req, res) => {
  const { id } = req.params;
  const db = readDb();
  if (!db) return res.status(500).end();

  const track = (db.tracks || []).find((t) => t.id === id);
  if (!track || !track.audioUrl) return res.status(404).end();

  const targetUrl = buildCloudinaryDemoUrl(track.audioUrl, track.demoStart, track.demoEnd);
  try {
    const upstreamHeaders = {};
    if (req.headers.range) {
      upstreamHeaders.Range = req.headers.range;
    }
    const upstream = await fetch(targetUrl, { headers: upstreamHeaders });
    if (!upstream.ok && upstream.status !== 206) {
      return res.status(upstream.status).end();
    }

    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "audio/mpeg");
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) res.setHeader("Content-Length", contentLength);
    const contentRange = upstream.headers.get("content-range");
    if (contentRange) res.setHeader("Content-Range", contentRange);
    res.setHeader("Accept-Ranges", upstream.headers.get("accept-ranges") || "bytes");
    res.setHeader("Cache-Control", "public, max-age=3600");

    const arrayBuffer = await upstream.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error("Demo stream proxy error:", err.message);
    return res.status(502).end();
  }
});

// GET /tracks/:id/free-download — Tự động tải file MP3 Full đối với các bài nhạc Miễn phí (price <= 0)
app.get("/tracks/:id/free-download", async (req, res) => {
  const { id } = req.params;
  const db = readDb();
  if (!db) return res.status(500).send("Lỗi máy chủ.");

  const track = (db.tracks || []).find((t) => t.id === id);
  if (!track) return res.status(404).send("Không tìm thấy bài hát.");

  if (Number(track.price || 0) > 0) {
    return res.status(403).send("Bài hát này có phí. Vui lòng thanh toán để nhận file qua Gmail.");
  }

  const fullUrl = track.fullAudioUrl || track.audioUrl;
  if (!fullUrl) {
    return res.status(404).send("Chưa có file âm thanh cho bài hát này.");
  }

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
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    const arrayBuffer = await upstream.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch {
    return res.status(502).end();
  }
});

// GET /albums — Ẩn hoàn toàn link Cloudinary ảnh bìa album
app.get("/albums", (req, res) => {
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });
  const safeAlbums = (db.albums || []).map((alb) => ({
    ...alb,
    cover: alb.cover ? `/v2/media/album-cover/${encodeURIComponent(alb.id)}` : ""
  }));
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
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
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
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });
  res.json(db.info);
});

// GET /sections
app.get("/sections", (req, res) => {
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });
  res.json(db.sections);
});

// POST /orders — Tạo yêu cầu thanh toán qua ApiPay
app.post("/orders", async (req, res) => {
  const { trackId, redirectUrl, email } = req.body || {};
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  const track = db.tracks.find((t) => t.id === trackId);
  if (!track) return res.status(404).json({ message: "Không tìm thấy bài hát." });

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

  let apipayData = null;
  if (isApiPayConfigured) {
    try {
      apipayData = await createPaymentRequest({
        bankPublicId: process.env.APIPAY_BANK_PUBLIC_ID,
        amount: String(track.price),
        content: transferNote,
        title: `Thanh toan bai hat ${track.title}`.slice(0, 100),
        redirectUrl
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

  const cleanEmail = email ? String(email).trim() : undefined;

  const order = {
    id: orderId,
    trackId,
    amount: Number(apipayData?.amount ?? track.price),
    transferNote: apipayData?.content || transferNote,
    bank,
    qrUrl: apipayData?.qrUrl || defaultBank.qrImage || "/bank-qr.png",
    payUrl: apipayData?.payUrl || undefined,
    apipayPublicId: apipayData?.publicId || undefined,
    redirectSecret: apipayData?.redirectSecret || undefined,
    email: cleanEmail || undefined,
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

// GET /orders/:id/download?token=... — Link tải MP3 Full bảo mật (chỉ gửi qua Gmail cho đơn đã thanh toán)
app.get("/orders/:id/download", async (req, res) => {
  const { id } = req.params;
  const { token } = req.query;
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

  const track = (db.tracks || []).find((t) => t.id === order.trackId);
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

// POST /orders/:id/confirm — Lưu Gmail khách hàng, kiểm tra thanh toán và tự động gửi file MP3 Full qua Gmail
app.post("/orders/:id/confirm", async (req, res) => {
  const { id } = req.params;
  const { email } = req.body || {};
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  const order = (db.orders || []).find((o) => o.id === id);
  if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });

  if (email) {
    order.email = String(email).trim();
  }
  if (!order.status) {
    order.status = "pending_verification";
  }
  writeDb(db);

  const isPaid = order.status === "paid";
  const isUnderpaid = order.status === "underpaid";
  let emailSent = Boolean(order.emailSentAt);
  let emailDeliveryReason = undefined;

  if (isPaid && order.email) {
    const mailResult = await triggerEmailIfPaid(order, db);
    emailSent = Boolean(mailResult.sent || order.emailSentAt);
    emailDeliveryReason = mailResult.reason;
  }

  let message = "Hệ thống đã ghi nhận Gmail của bạn. Nghao Producer sẽ gửi trực tiếp bản MP3 Full qua Gmail cho bạn sau khi xác nhận thanh toán!";
  if (isPaid) {
    const emailNotice = order.email
      ? `Đã ghi nhận Gmail (${order.email}). Nghao Producer sẽ gửi trực tiếp bản MP3 Full chất lượng cao qua Gmail cho bạn!`
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

// POST /orders/:id/resend-email — Gửi lại hoặc cập nhật Gmail nhận file MP3 Full cho đơn hàng đã thanh toán
app.post("/orders/:id/resend-email", async (req, res) => {
  const { id } = req.params;
  const { email } = req.body || {};
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
  const account = "nhai74314@gmail.com";
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

// POST /admin/auth/login — Đăng nhập bằng mã 6 số Google Authenticator (TOTP)
app.post("/admin/auth/login", (req, res) => {
  const clientIp = String(req.headers["x-forwarded-for"] || req.ip || "unknown")
    .split(",")[0]
    .trim();
  const now = Date.now();
  const attemptRecord = loginAttempts.get(clientIp);
  if (attemptRecord && attemptRecord.count >= 5 && now - attemptRecord.firstAt < 5 * 60 * 1000) {
    return res.status(429).json({
      message: "Bạn đã nhập sai quá 5 lần. Vui lòng đợi 5 phút trước khi thử lại."
    });
  }

  const { otp, passkey } = req.body || {};
  const code = String(otp || passkey || "").replace(/\s+/g, "");
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
          if (ord.status === "paid" && ord.email && !ord.emailSentAt) {
            triggerEmailIfPaid(ord, db).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.error("Reconciliation ApiPay sync warning:", err.message);
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
    newlyMatchedCount
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

  if (status === "paid" && order.email && !order.emailSentAt) {
    await triggerEmailIfPaid(order, db);
  }

  res.json(sanitizeOrderForClient(order, db.tracks, { includeDownloadUrl: true }));
});

// PATCH /admin/orders/:id/email-sent — Đánh dấu Admin đã gửi file qua Gmail thủ công cho khách
app.patch("/admin/orders/:id/email-sent", requireAdmin, (req, res) => {
  const { id } = req.params;
  const { sent = true, email } = req.body || {};
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  const order = (db.orders || []).find((o) => o.id === id);
  if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });

  if (email) {
    order.email = String(email).trim();
  }
  order.emailSentAt = sent ? new Date().toISOString() : undefined;
  writeDb(db);

  res.json(sanitizeOrderForClient(order, db.tracks, { includeDownloadUrl: true }));
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

/* ──────── Admin Endpoints ──────── */

// POST /uploads
app.post("/uploads", requireAdmin, upload.single("file"), async (req, res) => {
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

  const newTrack = {
    ...input,
    id: `t${Date.now()}`,
    artist: db.producer.name
  };

  db.tracks.unshift(newTrack);
  writeDb(db);

  res.status(201).json(newTrack);
});

// PATCH /tracks/:id
app.patch("/tracks/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const patch = req.body;
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  const idx = db.tracks.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ message: "Không tìm thấy bài hát." });

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

initSupabaseStore().finally(() => {
  app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
  });
});

