import crypto from "crypto";

/**
 * Generates an HMAC-signed download token for a paid order so raw Cloudinary URLs
 * are never exposed in public APIs.
 */
export function buildOrderDownloadToken(orderId, secret) {
  const key = secret || process.env.APIPAY_WEBHOOK_SECRET || "nghao_download_secret_2026";
  return crypto.createHmac("sha256", key).update(`download:${orderId}`).digest("hex");
}

export function verifyOrderDownloadToken(orderId, token, secret) {
  if (!orderId || !token || typeof token !== "string") return false;
  const expected = buildOrderDownloadToken(orderId, secret);
  if (token.length !== expected.length || !/^[0-9a-fA-F]+$/.test(token)) return false;
  return crypto.timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"));
}

export function buildSignedDownloadUrl(orderId, secret) {
  const baseUrl = (process.env.PUBLIC_SITE_URL || "https://nghaoproducer.duckdns.org").replace(/\/+$/, "");
  const token = buildOrderDownloadToken(orderId, secret);
  return `${baseUrl}/api-proxy/orders/${encodeURIComponent(orderId)}/download?token=${token}`;
}

export function buildFulfillmentEmailHtml({ trackTitle, order, downloadUrl }) {
  const priceFormatted = `${Number(order.amount || 0).toLocaleString("vi-VN")} ₫`;
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
</head>
<body style="margin:0;padding:24px;background-color:#0b0b0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;">
  <div style="max-width:540px;margin:0 auto;background-color:#141418;border:1px solid rgba(255,255,255,0.12);border-radius:24px;padding:32px;text-align:center;">
    <p style="margin:0;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#ff5a1f;font-weight:700;">
      NGHAO — MUSIC PRODUCER
    </p>
    <h1 style="margin:12px 0 8px;font-size:22px;color:#ffffff;">
      Cảm ơn bạn đã mua nhạc!
    </h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#b8b8c2;">
      Thanh toán cho bài hát <strong style="color:#ffffff;">${trackTitle}</strong> (Mã đơn: <code style="color:#ff5a1f;">${order.transferNote}</code> · ${priceFormatted}) đã được xác nhận thành công.
    </p>

    <div style="margin:28px 0;">
      <a href="${downloadUrl}" target="_blank" style="display:inline-block;background-color:#ff5a1f;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:999px;">
        Tải bản MP3 Full (${trackTitle})
      </a>
    </div>

    <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#8e8e99;">
      Nếu nút trên không bấm được, bạn có thể sao chép đường dẫn bảo mật dưới đây vào trình duyệt:<br/>
      <a href="${downloadUrl}" style="color:#ff5a1f;word-break:break-all;">${downloadUrl}</a>
    </p>

    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0;" />

    <p style="margin:0;font-size:12px;line-height:1.6;color:#8e8e99;">
      Cần hỗ trợ? Liên hệ trực tiếp với <strong>Nghao Producer</strong>:<br/>
      Zalo: <a href="https://zalo.me/0333025864" style="color:#ff5a1f;text-decoration:none;">0333 025 864</a> ·
      Facebook: <a href="https://www.facebook.com/nghao205/" style="color:#ff5a1f;text-decoration:none;">fb.com/nghao205</a> ·
      TikTok: <a href="https://www.tiktok.com/@nghao.wav" style="color:#ff5a1f;text-decoration:none;">@nghao.wav</a>
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Sends the full MP3 download link to the buyer's Gmail via Google Apps Script Webhook (HTTPS port 443).
 */
export async function sendOrderFulfillmentEmail({ order, track, webhookSecret }) {
  const recipient = String(order?.email || "").trim();
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return { sent: false, reason: "missing_or_invalid_email" };
  }

  const scriptUrl = (process.env.GMAIL_SCRIPT_URL || "").trim();
  if (!scriptUrl) {
    return { sent: false, reason: "gmail_script_not_configured" };
  }

  const trackTitle = track?.title || "Bản nhạc Full";
  const downloadUrl = buildSignedDownloadUrl(order.id, webhookSecret);
  const subject = `[NGHAO Music Producer] File MP3 Full: ${trackTitle} (${order.transferNote})`;
  const html = buildFulfillmentEmailHtml({ trackTitle, order, downloadUrl });

  try {
    const res = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: recipient,
        subject,
        html,
        trackTitle,
        orderId: order.id,
        transferNote: order.transferNote,
        downloadUrl
      }),
      redirect: "follow"
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Gmail script error:", res.status, errText);
      return { sent: false, reason: `http_${res.status}` };
    }

    return { sent: true, to: recipient, downloadUrl };
  } catch (err) {
    console.error("Gmail send network error:", err.message);
    return { sent: false, reason: err.message };
  }
}
