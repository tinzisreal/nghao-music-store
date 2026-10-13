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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
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

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    supabase: isSupabaseConfigured,
    cloudinary: isCloudinaryConfigured
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

// GET /tracks
app.get("/tracks", (req, res) => {
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });
  res.json(db.tracks);
});

// GET /albums
app.get("/albums", (req, res) => {
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });
  res.json(db.albums || []);
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
  const { trackId, redirectUrl } = req.body || {};
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
    const isPaid = order.status === "paid";
    const track = db.tracks.find((t) => t.id === order.trackId);

    return res.json({
      verified: true,
      redirectStatus: payload.status,
      orderId: order.id,
      status: order.status,
      downloadUrl: isPaid ? track?.fullAudioUrl || track?.audioUrl || "" : undefined
    });
  } catch (err) {
    const status = err instanceof ApiPayError ? err.statusCode : 400;
    const message = err instanceof ApiPayError ? err.message : "Chữ ký redirect không hợp lệ.";
    return res.status(status).json({ verified: false, message });
  }
});

// POST /orders/:id/confirm — Lưu email khách hàng và kiểm tra trạng thái thanh toán từ webhook
app.post("/orders/:id/confirm", (req, res) => {
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
  const track = db.tracks.find((t) => t.id === order.trackId);
  const downloadUrl = isPaid ? track?.fullAudioUrl || track?.audioUrl || "" : "";

  let message = "Hệ thống đang chờ xác nhận giao dịch từ ngân hàng (tự động cập nhật trong vài giây sau khi chuyển khoản).";
  if (isPaid) {
    message =
      order.overpaidAmount > 0
        ? `Thanh toán đã xác nhận thành công (Hệ thống ghi nhận bạn chuyển dư +${Number(order.overpaidAmount).toLocaleString("vi-VN")} ₫).`
        : "Thanh toán đã được xác nhận thành công.";
  } else if (isUnderpaid) {
    message = `Hệ thống đã nhận ${Number(order.paidAmount || 0).toLocaleString("vi-VN")} ₫ nhưng đơn hàng còn thiếu ${Number(order.shortfallAmount || 0).toLocaleString("vi-VN")} ₫. Vui lòng chuyển thêm phần còn thiếu với cùng nội dung "${order.transferNote}" hoặc liên hệ Zalo 0333 025 864.`;
  }

  res.json({
    orderId: id,
    status: order.status,
    paidAmount: order.paidAmount,
    shortfallAmount: order.shortfallAmount,
    overpaidAmount: order.overpaidAmount,
    paymentResolution: order.paymentResolution,
    downloadUrl: downloadUrl || undefined,
    message
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

// POST /admin/auth/login — Đăng nhập bằng mã 6 số Google Authenticator (TOTP)
app.post("/admin/auth/login", (req, res) => {
  const { otp, passkey } = req.body || {};
  const code = String(otp || passkey || "").replace(/\s+/g, "");
  const db = readDb();
  if (!db) return res.status(500).json({ message: "Lỗi đọc dữ liệu." });

  const secret = ensureAdminTotpSecret(db);
  if (!verifyTotpCode(code, secret, 1)) {
    return res.status(401).json({
      message: "Mã 6 số Google Authenticator không chính xác hoặc đã hết hạn (mã đổi mới mỗi 30 giây)."
    });
  }

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
      }
    } catch (err) {
      console.error("Reconciliation ApiPay sync warning:", err.message);
    }
  }

  const tracks = db.tracks || [];
  const orders = (db.orders || [])
    .map((ord) => {
      const track = tracks.find((t) => t.id === ord.trackId);
      const safe = sanitizeOrderForClient(ord, tracks);
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
app.patch("/admin/orders/:id/status", requireAdmin, (req, res) => {
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
  res.json(sanitizeOrderForClient(order, db.tracks));
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

