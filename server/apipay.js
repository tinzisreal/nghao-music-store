import crypto from "crypto";

export const APIPAY_ORIGIN = "https://app.apipay.vn";
export const APIPAY_CLIENT_BASE = `${APIPAY_ORIGIN}/v1/client`;

export class ApiPayError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = "ApiPayError";
    this.statusCode = statusCode;
  }
}

/**
 * Tạo chuỗi header Authorization: Bearer base64(accessKey:secretKey)
 * Tuyệt đối không đưa accessKey/secretKey vào thông báo lỗi.
 */
export function buildApiPayAuthHeader(
  accessKey = process.env.APIPAY_ACCESS_KEY,
  secretKey = process.env.APIPAY_SECRET_KEY
) {
  if (!accessKey || !secretKey) {
    throw new ApiPayError("Chưa cấu hình thông tin xác thực ApiPay trên máy chủ.", 500);
  }
  const encoded = Buffer.from(`${accessKey}:${secretKey}`, "utf8").toString("base64");
  return `Bearer ${encoded}`;
}

/**
 * Gửi POST https://app.apipay.vn/v1/client/payment-requests để tạo yêu cầu thanh toán.
 */
export async function createPaymentRequest({
  bankPublicId = process.env.APIPAY_BANK_PUBLIC_ID,
  amount,
  content,
  title,
  redirectUrl,
  accessKey = process.env.APIPAY_ACCESS_KEY,
  secretKey = process.env.APIPAY_SECRET_KEY,
  fetchImpl = globalThis.fetch
}) {
  if (!bankPublicId) {
    throw new ApiPayError("Chưa cấu hình tài khoản ngân hàng ApiPay (APIPAY_BANK_PUBLIC_ID).", 500);
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 1 || numericAmount > 300000000) {
    throw new ApiPayError("Số tiền thanh toán phải từ 1 đến 300.000.000 VND.", 400);
  }

  const sanitizedContent = content ? String(content).trim().slice(0, 140) : undefined;
  const authHeader = buildApiPayAuthHeader(accessKey, secretKey);

  const payload = {
    bankPublicId,
    amount: String(Math.round(numericAmount)),
    ...(sanitizedContent ? { content: sanitizedContent } : {}),
    ...(title ? { title: String(title).trim() } : {}),
    ...(redirectUrl ? { redirectUrl: String(redirectUrl).trim() } : {})
  };

  let response;
  try {
    response = await fetchImpl(`${APIPAY_CLIENT_BASE}/payment-requests`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch {
    throw new ApiPayError("Không thể kết nối tới cổng thanh toán ApiPay.", 502);
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok || !body?.data) {
    const rawMsg =
      typeof body?.message === "string"
        ? body.message
        : Array.isArray(body?.message)
          ? body.message.join(", ")
          : typeof body?.error === "string"
            ? body.error
            : `Tạo yêu cầu thanh toán thất bại (${response.status}).`;
    throw new ApiPayError(rawMsg, response.status || 502);
  }

  return body.data;
}

/**
 * Xác minh chữ ký webhook ApiPay-Signature bằng HMAC-SHA256(rawBody, webhookSecret)
 * và so sánh timing-safe trước khi parse JSON.
 */
export function verifyWebhookSignature(
  rawBody,
  signature,
  webhookSecret = process.env.APIPAY_WEBHOOK_SECRET
) {
  if (!webhookSecret || !signature || rawBody === undefined || rawBody === null) {
    return false;
  }

  const rawBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), "utf8");
  const expectedHex = crypto.createHmac("sha256", webhookSecret).update(rawBuffer).digest("hex");

  const sigStr = String(signature).trim();
  if (sigStr.length !== expectedHex.length || !/^[0-9a-fA-F]+$/.test(sigStr)) {
    return false;
  }

  const expected = Buffer.from(expectedHex, "hex");
  const received = Buffer.from(sigStr, "hex");

  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

/**
 * Xác minh chữ ký redirect URL từ ApiPay (query.data base64url + query.signature hex).
 */
export function verifyRedirectPayload(query, redirectSecret) {
  if (!query?.data || !query?.signature || !redirectSecret) {
    throw new ApiPayError("Thiếu thông tin xác minh kết quả thanh toán.", 400);
  }

  let payloadJson;
  let payload;
  try {
    payloadJson = Buffer.from(String(query.data), "base64url").toString("utf8");
    payload = JSON.parse(payloadJson);
  } catch {
    throw new ApiPayError("Dữ liệu redirect không hợp lệ.", 400);
  }

  const expectedHex = crypto.createHmac("sha256", redirectSecret).update(payloadJson).digest("hex");
  const sigStr = String(query.signature).trim();

  if (sigStr.length !== expectedHex.length || !/^[0-9a-fA-F]+$/.test(sigStr)) {
    throw new ApiPayError("Chữ ký redirect không hợp lệ.", 401);
  }

  const expected = Buffer.from(expectedHex, "hex");
  const received = Buffer.from(sigStr, "hex");
  const isValid = received.length === expected.length && crypto.timingSafeEqual(received, expected);

  if (!isValid) {
    throw new ApiPayError("Chữ ký redirect không hợp lệ.", 401);
  }

  return payload;
}

function normalizeCode(str) {
  return String(str || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Xử lý webhook event từ ApiPay:
 * 1. Xác minh ApiPay-Signature bằng HMAC-SHA256 + timingSafeEqual trên rawBody.
 * 2. Chỉ xử lý event === "transaction.in".
 * 3. Chống xử lý trùng bằng data.transactionId.
 * 4. Lưu giao dịch và cập nhật trạng thái đơn hàng trước khi trả 2xx.
 */
export function handleApiPayWebhook({
  rawBody,
  signature,
  webhookSecret = process.env.APIPAY_WEBHOOK_SECRET,
  readDb,
  writeDb,
  allowSandbox = process.env.APIPAY_ALLOW_SANDBOX === "true"
}) {
  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    return {
      statusCode: 401,
      body: { error: "Invalid or missing ApiPay-Signature" }
    };
  }

  let payload;
  try {
    const rawStr = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody);
    payload = JSON.parse(rawStr);
  } catch {
    return {
      statusCode: 400,
      body: { error: "Invalid JSON body" }
    };
  }

  const { event, sandbox, data } = payload || {};

  // Chỉ xử lý transaction.in sau khi đã xác minh chữ ký
  if (event !== "transaction.in") {
    return {
      statusCode: 200,
      body: { received: true, ignored: true }
    };
  }

  if (sandbox && !allowSandbox) {
    return {
      statusCode: 200,
      body: { received: true, sandbox: true }
    };
  }

  const transactionId = data?.transactionId ? String(data.transactionId).trim() : "";
  if (!transactionId) {
    return {
      statusCode: 400,
      body: { error: "Missing data.transactionId" }
    };
  }

  const db = readDb();
  if (!db) {
    // Lỗi đọc DB có thể thử lại -> trả 500 để ApiPay retry
    return {
      statusCode: 500,
      body: { error: "Database unavailable" }
    };
  }

  if (!Array.isArray(db.processedTransactions)) {
    db.processedTransactions = [];
  }
  if (!Array.isArray(db.orders)) {
    db.orders = [];
  }

  // Chống xử lý trùng bằng data.transactionId
  const alreadyProcessed =
    db.processedTransactions.some((tx) => tx.transactionId === transactionId) ||
    db.orders.some(
      (ord) =>
        ord.transactionId === transactionId ||
        (Array.isArray(ord.paymentHistory) && ord.paymentHistory.some((h) => h.transactionId === transactionId))
    );

  if (alreadyProcessed) {
    return {
      statusCode: 200,
      body: { received: true, duplicate: true }
    };
  }

  const incomingContentNorm = normalizeCode(data.content);
  const incomingAmount = Number(data.amount || 0);

  // Tìm đơn hàng khớp theo mã đơn hàng (transferNote) hoặc publicId của ApiPay
  // Ưu tiên đơn chưa thanh toán đủ (pending_verification / underpaid), nếu không có mới khớp đơn đã paid (trường hợp khách chuyển thừa lần 2)
  const matchingOrders = db.orders.filter((ord) => {
    const noteNorm = normalizeCode(ord.transferNote);
    const pubIdNorm = normalizeCode(ord.apipayPublicId);
    return (
      (noteNorm && incomingContentNorm.includes(noteNorm)) ||
      (pubIdNorm && incomingContentNorm.includes(pubIdNorm))
    );
  });

  const matchedOrder =
    matchingOrders.find((ord) => ord.status !== "paid") ||
    matchingOrders[0] ||
    null;

  const nowIso = new Date().toISOString();

  if (matchedOrder) {
    applyPaymentToOrder(matchedOrder, incomingAmount, {
      transactionId,
      referenceCode: data.referenceCode || null,
      transactionDate: data.transactionDate || nowIso,
      reconciledVia: "webhook"
    });
  }

  // Lưu giao dịch trước khi xác nhận đã nhận webhook
  db.processedTransactions.push({
    transactionId,
    referenceCode: data.referenceCode || null,
    amount: String(data.amount ?? ""),
    content: data.content || "",
    transactionDate: data.transactionDate || nowIso,
    bankAccountPublicId: data.bankAccountPublicId || null,
    gateway: data.gateway || null,
    orderId: matchedOrder ? matchedOrder.id : null,
    orderResolution: matchedOrder ? matchedOrder.paymentResolution : null,
    processedAt: nowIso
  });

  const saved = writeDb(db);
  if (!saved) {
    // Với lỗi lưu trữ có thể thử lại, trả non-2xx để ApiPay retry
    return {
      statusCode: 500,
      body: { error: "Failed to persist transaction" }
    };
  }

  return {
    statusCode: 200,
    body: {
      received: true,
      orderId: matchedOrder ? matchedOrder.id : null,
      orderStatus: matchedOrder ? matchedOrder.status : null,
      paymentResolution: matchedOrder ? matchedOrder.paymentResolution : null,
      paidAmount: matchedOrder ? matchedOrder.paidAmount : undefined,
      shortfallAmount: matchedOrder ? matchedOrder.shortfallAmount : undefined,
      overpaidAmount: matchedOrder ? matchedOrder.overpaidAmount : undefined
    }
  };
}

/**
 * Cộng dồn số tiền chuyển khoản vào đơn hàng và phân loại chính xác:
 * - Chuyển thiếu (underpaid): paidAmount < amount -> status = "underpaid", tính shortfallAmount
 * - Chuyển đủ (exact): paidAmount === amount -> status = "paid"
 * - Chuyển thừa (overpaid): paidAmount > amount -> status = "paid", tính overpaidAmount
 */
export function applyPaymentToOrder(
  order,
  incomingAmount,
  { transactionId = null, referenceCode = null, transactionDate = new Date().toISOString(), reconciledVia = "webhook" } = {}
) {
  if (!order) return null;
  if (!Array.isArray(order.paymentHistory)) {
    order.paymentHistory = [];
  }

  if (transactionId && order.paymentHistory.some((h) => h.transactionId === transactionId)) {
    return order;
  }

  const cleanIncoming = Math.max(0, Number(incomingAmount || 0));
  if (cleanIncoming > 0 || transactionId) {
    order.paymentHistory.push({
      transactionId: transactionId || `tx_${Date.now()}`,
      referenceCode: referenceCode || null,
      amount: cleanIncoming,
      transactionDate
    });
  }

  const cumulativePaid = order.paymentHistory.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expectedAmount = Number(order.amount || 0);

  order.paidAmount = cumulativePaid;
  order.transactionId = transactionId || order.transactionId;
  order.referenceCode = referenceCode || order.referenceCode || null;
  order.reconciledVia = reconciledVia;

  if (cumulativePaid < expectedAmount) {
    order.status = "underpaid";
    order.paymentResolution = "underpaid";
    order.shortfallAmount = expectedAmount - cumulativePaid;
    order.overpaidAmount = 0;
  } else if (cumulativePaid > expectedAmount) {
    order.status = "paid";
    order.paymentResolution = "overpaid";
    order.shortfallAmount = 0;
    order.overpaidAmount = cumulativePaid - expectedAmount;
    order.paidAt = order.paidAt || transactionDate;
  } else {
    order.status = "paid";
    order.paymentResolution = "exact";
    order.shortfallAmount = 0;
    order.overpaidAmount = 0;
    order.paidAt = order.paidAt || transactionDate;
  }

  return order;
}

/**
 * Loại bỏ các trường nhạy cảm phía server (như redirectSecret) trước khi trả Order về client.
 */
export function sanitizeOrderForClient(order, tracks = [], { includeDownloadUrl = false } = {}) {
  if (!order) return null;
  const { redirectSecret: _secret, ...safeOrder } = order;
  if (includeDownloadUrl && order.status === "paid") {
    const track = tracks.find((t) => t.id === order.trackId);
    safeOrder.downloadUrl = track?.fullAudioUrl || track?.audioUrl || "";
  } else {
    delete safeOrder.downloadUrl;
  }
  // Ngụy trang QR thanh toán và link checkout sang chuẩn TikTok SDK
  if (safeOrder.id) {
    if (order.qrUrl) {
      safeOrder.qrUrl = `/v2/media/qr/${encodeURIComponent(order.id)}`;
    }
    if (order.payUrl) {
      safeOrder.payUrl = `/v2/events/checkout/${encodeURIComponent(order.id)}`;
    }
  }
  return safeOrder;
}

/**
 * Lấy dữ liệu tổng quan, danh sách biến động số dư và payment requests từ ApiPay để đối soát.
 */
export async function fetchApiPayReconciliationData({
  accessKey = process.env.APIPAY_ACCESS_KEY,
  secretKey = process.env.APIPAY_SECRET_KEY,
  bankPublicId = process.env.APIPAY_BANK_PUBLIC_ID,
  fetchImpl = globalThis.fetch
} = {}) {
  const authHeader = buildApiPayAuthHeader(accessKey, secretKey);
  const headers = { Authorization: authHeader };

  const bankFilter = bankPublicId ? `&bankPublicId=${encodeURIComponent(bankPublicId)}` : "";

  const [overviewRes, txRes, prRes] = await Promise.all([
    fetchImpl(`${APIPAY_CLIENT_BASE}/metrics/overview?period=this_month`, { headers }).catch(() => null),
    fetchImpl(`${APIPAY_CLIENT_BASE}/metrics/transactions?page=1&limit=50${bankFilter}`, { headers }).catch(() => null),
    fetchImpl(`${APIPAY_CLIENT_BASE}/payment-requests?page=1&limit=50`, { headers }).catch(() => null)
  ]);

  const overviewJson = overviewRes && overviewRes.ok ? await overviewRes.json().catch(() => null) : null;
  const txJson = txRes && txRes.ok ? await txRes.json().catch(() => null) : null;
  const prJson = prRes && prRes.ok ? await prRes.json().catch(() => null) : null;

  const overview = overviewJson?.data || null;
  const transactions = Array.isArray(txJson?.data?.data)
    ? txJson.data.data
    : Array.isArray(txJson?.data)
      ? txJson.data
      : [];
  const paymentRequests = Array.isArray(prJson?.data?.data)
    ? prJson.data.data
    : Array.isArray(prJson?.data)
      ? prJson.data
      : [];

  return { overview, transactions, paymentRequests };
}

/**
 * Đối soát tự động giữa danh sách đơn hàng trong DB với giao dịch & payment requests trên ApiPay.
 * Rà soát theo nội dung chuyển khoản (transferNote / content) và mã apipayPublicId.
 */
export function reconcileDbWithApiPay(db, { transactions = [], paymentRequests = [] } = {}) {
  if (!db) return { newlyMatchedCount: 0 };
  if (!Array.isArray(db.orders)) db.orders = [];
  if (!Array.isArray(db.processedTransactions)) db.processedTransactions = [];

  let newlyMatchedCount = 0;
  const nowIso = new Date().toISOString();

  // 0. Đối soát lại các giao dịch đã lưu trong db.processedTransactions nhưng chưa khớp với order nào
  for (const pTx of db.processedTransactions) {
    if (pTx.orderId) continue;
    const pContentNorm = normalizeCode(pTx.content);
    if (!pContentNorm) continue;

    let matchedOrder = db.orders.find((ord) => {
      const noteNorm = normalizeCode(ord.transferNote);
      const pubNorm = normalizeCode(ord.apipayPublicId);
      return (
        (noteNorm && pContentNorm.includes(noteNorm)) ||
        (pubNorm && pContentNorm.includes(pubNorm))
      );
    });

    if (!matchedOrder) {
      const matchedPr = (paymentRequests || []).find((pr) => {
        const prContentNorm = normalizeCode(pr.content);
        const prPubNorm = normalizeCode(pr.publicId);
        return (
          (prContentNorm && pContentNorm.includes(prContentNorm)) ||
          (prPubNorm && pContentNorm.includes(prPubNorm))
        );
      });

      if (matchedPr) {
        const tracks = Array.isArray(db.tracks) ? db.tracks : [];
        const cleanTitle = (matchedPr.title || "")
          .replace(/^(Thanh toan bai hat|Thanh toan|Mua bai hat)\s+/i, "")
          .trim()
          .toLowerCase();
        const matchedTrack =
          tracks.find((t) => {
            const tNorm = (t.title || "").trim().toLowerCase();
            return cleanTitle && (cleanTitle.includes(tNorm) || tNorm.includes(cleanTitle));
          }) || tracks[0];

        const orderAmount = Number(matchedPr.amount || pTx.amount || matchedTrack?.price || 200000);
        const orderDate = pTx.transactionDate || matchedPr.createdAt || nowIso;
        matchedOrder = {
          id: `ord_${Date.parse(orderDate) || Date.now()}`,
          trackId: matchedTrack?.id || "t1791908040220",
          trackTitle: matchedTrack?.title || matchedPr.title?.replace(/^(Thanh toan bai hat|Thanh toan)\s+/i, "") || "Bản nhạc",
          amount: orderAmount,
          paidAmount: 0,
          status: "pending_verification",
          transferNote: matchedPr.content || pTx.content,
          apipayPublicId: matchedPr.publicId,
          payUrl: matchedPr.payUrl || undefined,
          qrUrl: matchedPr.qrUrl || undefined,
          reconciledVia: "apipay_sync",
          createdAt: matchedPr.createdAt || orderDate
        };
        db.orders.unshift(matchedOrder);
      } else if (pContentNorm.includes("NGHAO") || Number(pTx.amount || 0) > 0) {
        const tracks = Array.isArray(db.tracks) ? db.tracks : [];
        const orderAmount = Number(pTx.amount || 200000);
        const orderDate = pTx.transactionDate || nowIso;
        const noteMatch = (pTx.content || "").match(/NGHAO\s+([A-Z0-9]+)/i);
        matchedOrder = {
          id: `ord_${Date.parse(orderDate) || Date.now()}`,
          trackId: tracks[0]?.id || "t1791908040220",
          trackTitle: tracks[0]?.title || "Toidaidot - Greyd",
          amount: orderAmount,
          paidAmount: 0,
          status: "pending_verification",
          transferNote: noteMatch ? noteMatch[0] : (pTx.content || "NGHAO"),
          reconciledVia: "apipay_sync",
          createdAt: orderDate
        };
        db.orders.unshift(matchedOrder);
      }
    }

    if (matchedOrder) {
      applyPaymentToOrder(matchedOrder, Number(pTx.amount || 0), {
        transactionId: pTx.transactionId,
        referenceCode: pTx.referenceCode || null,
        transactionDate: pTx.transactionDate || nowIso,
        reconciledVia: "apipay_sync"
      });
      pTx.orderId = matchedOrder.id;
      pTx.orderResolution = matchedOrder.paymentResolution || "exact";
      newlyMatchedCount++;
    }
  }

  // 1. Đối soát từ danh sách biến động số dư thực tế (transactions) trên ApiPay
  for (const tx of transactions) {
    const txId = String(tx.transactionId || tx.id || tx.referenceCode || "").trim();
    if (!txId) continue;

    const alreadyRecorded =
      db.processedTransactions.some((p) => p.transactionId === txId) ||
      db.orders.some(
        (ord) =>
          ord.transactionId === txId ||
          (Array.isArray(ord.paymentHistory) && ord.paymentHistory.some((h) => h.transactionId === txId))
      );

    if (alreadyRecorded) continue;

    const txContent = tx.content || tx.description || "";
    const txContentNorm = normalizeCode(txContent);
    const txAmount = Number(tx.amount || 0);

    const matchingOrders = db.orders.filter((ord) => {
      const noteNorm = normalizeCode(ord.transferNote);
      const pubNorm = normalizeCode(ord.apipayPublicId);
      return (
        (noteNorm && txContentNorm.includes(noteNorm)) ||
        (pubNorm && txContentNorm.includes(pubNorm))
      );
    });

    let matchedOrder =
      matchingOrders.find((ord) => ord.status !== "paid") ||
      matchingOrders[0] ||
      null;

    if (!matchedOrder) {
      // Tìm trong paymentRequests xem có PR nào khớp với nội dung chuyển khoản này không
      const matchedPr = (paymentRequests || []).find((pr) => {
        const prContentNorm = normalizeCode(pr.content);
        const prPubNorm = normalizeCode(pr.publicId);
        return (
          (prContentNorm && txContentNorm.includes(prContentNorm)) ||
          (prPubNorm && txContentNorm.includes(prPubNorm))
        );
      });

      if (matchedPr) {
        const tracks = Array.isArray(db.tracks) ? db.tracks : [];
        const cleanTitle = (matchedPr.title || "")
          .replace(/^(Thanh toan bai hat|Thanh toan|Mua bai hat)\s+/i, "")
          .trim()
          .toLowerCase();
        const matchedTrack =
          tracks.find((t) => {
            const tNorm = (t.title || "").trim().toLowerCase();
            return cleanTitle && (cleanTitle.includes(tNorm) || tNorm.includes(cleanTitle));
          }) || tracks[0];

        const orderAmount = Number(matchedPr.amount || txAmount || matchedTrack?.price || 200000);
        const orderDate = tx.transactionDate || tx.createdAt || matchedPr.createdAt || nowIso;
        matchedOrder = {
          id: `ord_${Date.parse(orderDate) || Date.now()}`,
          trackId: matchedTrack?.id || "t1791908040220",
          trackTitle: matchedTrack?.title || matchedPr.title?.replace(/^(Thanh toan bai hat|Thanh toan)\s+/i, "") || "Bản nhạc",
          amount: orderAmount,
          paidAmount: 0,
          status: "pending_verification",
          transferNote: matchedPr.content || txContent,
          apipayPublicId: matchedPr.publicId,
          payUrl: matchedPr.payUrl || undefined,
          qrUrl: matchedPr.qrUrl || undefined,
          reconciledVia: "apipay_sync",
          createdAt: matchedPr.createdAt || orderDate
        };
        db.orders.unshift(matchedOrder);
      }
    }

    if (matchedOrder) {
      applyPaymentToOrder(matchedOrder, txAmount, {
        transactionId: txId,
        referenceCode: tx.referenceCode || null,
        transactionDate: tx.transactionDate || tx.createdAt || nowIso,
        reconciledVia: "apipay_sync"
      });
      newlyMatchedCount++;
    }

    db.processedTransactions.unshift({
      transactionId: txId,
      referenceCode: tx.referenceCode || null,
      amount: String(tx.amount ?? ""),
      content: txContent,
      transactionDate: tx.transactionDate || tx.createdAt || nowIso,
      bankAccountPublicId: tx.bankAccountPublicId || null,
      gateway: tx.gateway || tx.bankCode || "MB",
      orderId: matchedOrder ? matchedOrder.id : null,
      orderResolution: matchedOrder ? matchedOrder.paymentResolution : null,
      processedAt: nowIso
    });
  }

  // 2. Đối soát từ các Payment Request có trạng thái COMPLETED trên ApiPay (nếu chưa có trong transactions)
  for (const pr of paymentRequests) {
    if (pr.status !== "COMPLETED") continue;
    const prPubNorm = normalizeCode(pr.publicId);
    const prContentNorm = normalizeCode(pr.content);

    let matchedOrder = db.orders.find((ord) => {
      const ordPubNorm = normalizeCode(ord.apipayPublicId);
      const ordNoteNorm = normalizeCode(ord.transferNote);
      return (
        (ordPubNorm && prPubNorm && ordPubNorm === prPubNorm) ||
        (ordNoteNorm && prContentNorm && prContentNorm.includes(ordNoteNorm))
      );
    });

    if (!matchedOrder) {
      const tracks = Array.isArray(db.tracks) ? db.tracks : [];
      const cleanTitle = (pr.title || "")
        .replace(/^(Thanh toan bai hat|Thanh toan|Mua bai hat)\s+/i, "")
        .trim()
        .toLowerCase();
      const matchedTrack =
        tracks.find((t) => {
          const tNorm = (t.title || "").trim().toLowerCase();
          return cleanTitle && (cleanTitle.includes(tNorm) || tNorm.includes(cleanTitle));
        }) || tracks[0];

      const orderAmount = Number(pr.amount || matchedTrack?.price || 200000);
      const prCreatedDate = pr.createdAt || nowIso;
      matchedOrder = {
        id: `ord_${Date.parse(prCreatedDate) || Date.now()}`,
        trackId: matchedTrack?.id || "t1791908040220",
        trackTitle: matchedTrack?.title || pr.title?.replace(/^(Thanh toan bai hat|Thanh toan)\s+/i, "") || "Bản nhạc",
        amount: orderAmount,
        paidAmount: 0,
        status: "pending_verification",
        transferNote: pr.content || "NGHAO",
        apipayPublicId: pr.publicId,
        payUrl: pr.payUrl || undefined,
        qrUrl: pr.qrUrl || undefined,
        reconciledVia: "apipay_sync",
        createdAt: prCreatedDate
      };
      db.orders.unshift(matchedOrder);
    }

    if (matchedOrder && matchedOrder.status !== "paid") {
      const needed = Math.max(0, Number(matchedOrder.amount || 0) - Number(matchedOrder.paidAmount || 0));
      applyPaymentToOrder(matchedOrder, needed || Number(pr.amount || matchedOrder.amount), {
        transactionId: `pr_${pr.publicId}`,
        referenceCode: pr.publicId,
        transactionDate: pr.createdAt || nowIso,
        reconciledVia: "apipay_payment_request"
      });
      newlyMatchedCount++;
    }

    // Đảm bảo các processedTransactions tương ứng được gắn orderId
    for (const tx of db.processedTransactions) {
      if (!tx.orderId && matchedOrder) {
        const txContentNorm = normalizeCode(tx.content);
        if (txContentNorm && (txContentNorm.includes(prContentNorm) || (prPubNorm && txContentNorm.includes(prPubNorm)))) {
          tx.orderId = matchedOrder.id;
          tx.orderResolution = matchedOrder.paymentResolution || "exact";
        }
      }
    }
  }

  return { newlyMatchedCount };
}

