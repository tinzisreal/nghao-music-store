/**
 * Module thông báo tức thì khi có đơn hàng thanh toán thành công:
 * 1. ntfy (ntfy.sh) — Báo chuông điện thoại tức thì (không cần tài khoản, cài app 5MB, cả 2 bạn cùng nhận đồng thời).
 * 2. Telegram Bot — Báo qua Telegram (nếu cấu hình).
 * 3. Gmail Alert — Gửi email thông báo về Gmail chủ shop (nghaoproducer@gmail.com).
 */

export const DEFAULT_NTFY_TOPIC = "nghao-orders-2026";

export function formatVnd(amount) {
  return `${Number(amount || 0).toLocaleString("vi-VN")} ₫`;
}

export function buildCustomerComposeMailUrl({ customerEmail, trackTitle, transferNote }) {
  const to = encodeURIComponent(String(customerEmail || "").trim());
  const subject = encodeURIComponent(`[NGHAO Music Producer] File MP3 Full: ${trackTitle || "Track"} (${transferNote || ""})`);
  const body = encodeURIComponent(
    `Chào bạn,\n\nCảm ơn bạn đã ủng hộ tác phẩm âm nhạc của NGHAO Producer!\n\n` +
    `Đơn hàng: ${transferNote || ""}\n` +
    `Bài hát: ${trackTitle || ""}\n\n` +
    `NGHAO gửi kèm file MP3 chất lượng cao đính kèm trong email này nhé.\n\n` +
    `Chúc bạn nghe nhạc thật vui vẻ!\n---\nNGHAO Music Producer\nZalo: 0333 025 864`
  );
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;
}

/**
 * 1. Gửi thông báo đến app ntfy trên điện thoại (iPhone / Android)
 * Hoạt động ngay tức thì, không cần tài khoản hay API key!
 */
export async function sendNtfyOrderAlert({ order, track, transaction = null, fetchImpl = globalThis.fetch }) {
  const topic = (process.env.NTFY_TOPIC || DEFAULT_NTFY_TOPIC).replace(/^["']|["']$/g, "").trim();
  if (!topic) {
    return { sent: false, reason: "ntfy_not_configured" };
  }

  const trackTitle = track?.title || "Bản nhạc";
  const amountStr = formatVnd(order.amount);
  const customerEmail = order.email || "Khách chưa để lại email";
  const customerPhone = order.phone || "";
  const transferNote = order.transferNote || "N/A";
  const transId = transaction?.transactionId || order.reconciledVia || "N/A";
  const siteUrl = (process.env.PUBLIC_SITE_URL || "https://nghaoproducer.shop").replace(/\/+$/, "");
  const adminUrl = `${siteUrl}/admin`;

  const hasEmail = Boolean(customerEmail && customerEmail.includes("@"));
  const composeUrl = hasEmail
    ? buildCustomerComposeMailUrl({ customerEmail, trackTitle, transferNote })
    : adminUrl;

  const bodyLines = [
    `🎵 Bài hát: ${trackTitle}`,
    `💰 Số tiền: ${amountStr}`,
    `📧 Gmail khách: ${customerEmail}`
  ];
  if (customerPhone) {
    bodyLines.push(`📱 SĐT/Zalo: ${customerPhone}`);
  }
  bodyLines.push(`📝 Nội dung CK: ${transferNote}`);
  bodyLines.push(`🏦 Mã GD: ${transId}`);
  const body = bodyLines.join("\n");

  const ntfyActions = [];
  if (hasEmail) {
    ntfyActions.push({
      action: "view",
      label: "Mở Gmail gửi nhạc",
      url: composeUrl,
      clear: true
    });
  }
  if (customerPhone) {
    const cleanDigits = customerPhone.replace(/[^0-9]/g, "");
    if (cleanDigits.length >= 9) {
      ntfyActions.push({
        action: "view",
        label: "Nhắn Zalo",
        url: `https://zalo.me/${cleanDigits}`
      });
    }
  }
  ntfyActions.push({
    action: "view",
    label: "Bảng Quản trị",
    url: adminUrl
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const ntfyPayload = {
      topic,
      title: `🔔 Đơn mới: ${trackTitle} (${amountStr})`,
      message: body,
      priority: 5, // urgent (phát chuông to + rung mạnh trên điện thoại)
      tags: ["musical_note", "moneybag", "bell"],
      click: composeUrl,
      actions: ntfyActions
    };

    const res = await fetchImpl("https://ntfy.sh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ntfyPayload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[ntfy] Publish error:", res.status, errBody);
      return { sent: false, reason: `http_${res.status}_${errBody.slice(0, 100)}` };
    }

    console.log(`[ntfy] Alert published successfully to topic "${topic}" for order ${order.id}`);
    return { sent: true, topic, appUrl: `https://ntfy.sh/${topic}` };
  } catch (err) {
    console.error("[ntfy] Network error:", err.message);
    return { sent: false, reason: err.message };
  }
}

/**
 * 2. Gửi thông báo đến Telegram Bot (tùy chọn nếu cấu hình)
 */
export async function sendTelegramOrderAlert({ order, track, transaction = null, fetchImpl = globalThis.fetch }) {
  const botToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim();

  if (!botToken || !chatId) {
    return {
      sent: false,
      reason: "telegram_not_configured",
      message: "Chưa cấu hình TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID."
    };
  }

  const trackTitle = track?.title || "Bản nhạc";
  const amountStr = formatVnd(order.amount);
  const customerEmail = order.email || "Khách không để lại email";
  const customerPhone = order.phone || "";
  const transferNote = order.transferNote || "N/A";
  const transId = transaction?.transactionId || order.reconciledVia || "N/A";
  const timeStr = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

  const composeUrl = customerEmail.includes("@")
    ? buildCustomerComposeMailUrl({ customerEmail, trackTitle, transferNote })
    : null;

  const textLines = [
    `🔔 <b>ĐƠN HÀNG MỚI ĐÃ THANH TOÁN THÀNH CÔNG!</b>`,
    ``,
    `🎵 <b>Bài hát:</b> ${escapeHtml(trackTitle)}`,
    `💰 <b>Số tiền:</b> <code>${amountStr}</code>`,
    `📧 <b>Gmail của khách:</b> <code>${escapeHtml(customerEmail)}</code>`
  ];
  if (customerPhone) {
    textLines.push(`📱 <b>SĐT / Zalo:</b> <code>${escapeHtml(customerPhone)}</code>`);
  }
  textLines.push(`📝 <b>Nội dung CK:</b> <code>${escapeHtml(transferNote)}</code>`);
  textLines.push(`🏦 <b>Mã giao dịch:</b> <code>${escapeHtml(transId)}</code>`);
  textLines.push(`⏰ <b>Thời gian:</b> ${timeStr}`);
  textLines.push(``);
  textLines.push(
    customerEmail.includes("@")
      ? `👉 <i>Bấm nút bên dưới để mở Gmail đính kèm MP3 gửi khách ngay!</i>`
      : `⚠️ <i>Khách chưa điền email. Kiểm tra trang Quản trị.</i>`
  );
  const text = textLines.join("\n");

  const inlineKeyboard = [];
  const actionRow = [];
  if (composeUrl) {
    actionRow.push({ text: "📧 Mở Gmail gửi nhạc", url: composeUrl });
  }
  if (customerPhone) {
    const cleanDigits = customerPhone.replace(/[^0-9]/g, "");
    if (cleanDigits.length >= 9) {
      actionRow.push({ text: "💬 Nhắn Zalo", url: `https://zalo.me/${cleanDigits}` });
    }
  }
  if (actionRow.length > 0) {
    inlineKeyboard.push(actionRow);
  }
  inlineKeyboard.push([
    {
      text: "📊 Quản trị đơn hàng",
      url: `${(process.env.PUBLIC_SITE_URL || "https://nghaoproducer.shop").replace(/\/+$/, "")}/admin`
    }
  ]);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetchImpl(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const resData = await res.json().catch(() => ({}));
    if (!res.ok || !resData?.ok) {
      console.error("[Telegram] Send alert error:", resData);
      return { sent: false, reason: resData?.description || `HTTP ${res.status}` };
    }

    console.log(`[Telegram] Alert sent successfully for order ${order.id}`);
    return { sent: true };
  } catch (err) {
    console.error("[Telegram] Network error:", err.message);
    return { sent: false, reason: err.message };
  }
}

/**
 * 3. Gửi email thông báo đơn mới đến Gmail của chủ shop (nghaoproducer@gmail.com)
 */
export async function sendGmailOrderAlert({ order, track, transaction = null, fetchImpl = globalThis.fetch }) {
  const adminEmail = (process.env.ADMIN_ALERT_EMAIL || "nghaoproducer@gmail.com").trim();
  const scriptUrl = (process.env.GMAIL_SCRIPT_URL || "").trim();
  const resendApiKey = (process.env.RESEND_API_KEY || "").trim();

  if (!scriptUrl && !resendApiKey) {
    return {
      sent: false,
      reason: "email_sender_not_configured",
      message: "Chưa cấu hình GMAIL_SCRIPT_URL (Google Apps Script) hoặc RESEND_API_KEY."
    };
  }

  const trackTitle = track?.title || "Bản nhạc";
  const amountStr = formatVnd(order.amount);
  const customerEmail = order.email || "Chưa cung cấp";
  const customerPhone = order.phone || "";
  const transferNote = order.transferNote || "N/A";
  const transId = transaction?.transactionId || order.reconciledVia || "N/A";
  const composeUrl = customerEmail.includes("@")
    ? buildCustomerComposeMailUrl({ customerEmail, trackTitle, transferNote })
    : null;

  const subject = `🔔 [NGHAO MUSIC] Có đơn thanh toán mới: ${trackTitle} (${amountStr}) - Khách: ${customerEmail}`;
  const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
</head>
<body style="margin:0;padding:20px;background-color:#0b0b0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#ffffff;">
  <div style="max-width:560px;margin:0 auto;background-color:#141418;border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:28px;">
    <p style="margin:0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#ff5a1f;font-weight:700;">
      NGHAO — MUSIC PRODUCER
    </p>
    <h2 style="margin:10px 0 16px;color:#ffffff;font-size:20px;">
      🔔 Đơn hàng mới đã thanh toán thành công!
    </h2>
    <div style="background-color:#1c1c24;border-radius:14px;padding:18px;margin-bottom:20px;border:1px solid rgba(255,255,255,0.08);">
      <p style="margin:6px 0;font-size:14px;"><strong>🎵 Bài hát:</strong> ${escapeHtml(trackTitle)}</p>
      <p style="margin:6px 0;font-size:14px;"><strong>💰 Số tiền:</strong> <span style="color:#22c55e;font-weight:700;">${amountStr}</span></p>
      <p style="margin:6px 0;font-size:14px;"><strong>📧 Gmail khách hàng:</strong> <code style="color:#ff5a1f;background:rgba(255,90,31,0.12);padding:2px 6px;border-radius:4px;">${escapeHtml(customerEmail)}</code></p>
      ${customerPhone ? `<p style="margin:6px 0;font-size:14px;"><strong>📱 SĐT / Zalo:</strong> <code style="color:#38bdf8;background:rgba(56,189,248,0.12);padding:2px 6px;border-radius:4px;">${escapeHtml(customerPhone)}</code></p>` : ""}
      <p style="margin:6px 0;font-size:14px;"><strong>📝 Nội dung CK:</strong> <code>${escapeHtml(transferNote)}</code></p>
      <p style="margin:6px 0;font-size:14px;"><strong>🏦 Mã GD:</strong> <code>${escapeHtml(transId)}</code></p>
    </div>
    ${
      composeUrl
        ? `<div style="text-align:center;margin:24px 0;">
            <a href="${composeUrl}" target="_blank" style="display:inline-block;background-color:#ff5a1f;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:999px;">
              📧 Mở Gmail gửi file MP3 cho khách ngay
            </a>
          </div>`
        : `<p style="color:#eab308;font-size:13px;">Khách hàng chưa điền Gmail khi đặt đơn. Vui lòng kiểm tra mã đơn trên trang Admin.</p>`
    }
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:20px 0;" />
    <p style="margin:0;font-size:12px;color:#8e8e99;text-align:center;">
      Thông báo tự động từ hệ thống bán nhạc NGHAO Music Store.
    </p>
  </div>
</body>
</html>
  `.trim();

  // 1. Google Apps Script Webhook
  if (scriptUrl) {
    try {
      const res = await fetchImpl(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: adminEmail,
          subject,
          html,
          orderId: order.id
        }),
        redirect: "follow"
      });
      if (res.ok) {
        console.log(`[Gmail] Alert sent to ${adminEmail} via Google Apps Script`);
        return { sent: true, to: adminEmail };
      }
      const errText = await res.text().catch(() => "");
      console.error("[Gmail] Google Apps Script error:", res.status, errText);
      return { sent: false, reason: `http_${res.status}` };
    } catch (err) {
      console.error("[Gmail] Network error:", err.message);
      return { sent: false, reason: err.message };
    }
  }

  // 2. Resend API Key
  if (resendApiKey) {
    try {
      const res = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: (process.env.RESEND_FROM_EMAIL || "NGHAO Producer <release@nghaoproducer.shop>").trim(),
          to: [adminEmail],
          subject,
          html
        })
      });
      if (res.ok) {
        console.log(`[Gmail] Alert sent to ${adminEmail} via Resend`);
        return { sent: true, to: adminEmail };
      }
      return { sent: false, reason: `resend_status_${res.status}` };
    } catch (err) {
      console.error("[Gmail via Resend] Network error:", err.message);
      return { sent: false, reason: err.message };
    }
  }

  return { sent: false, reason: "no_provider" };
}

/**
 * Gửi đồng thời ntfy, Telegram và Gmail khi đơn hàng được xác nhận thanh toán
 */
export async function notifyAdminNewPaidOrder({ order, track, transaction = null, writeDb = null, db = null }) {
  if (!order || order.status !== "paid") {
    return { notified: false, reason: "order_not_paid" };
  }

  // Tránh gửi lặp nếu đơn này đã được thông báo trước đó
  const alreadyNotifiedNtfy = Boolean(order.ntfyNotifiedAt);
  const alreadyNotifiedTelegram = Boolean(order.telegramNotifiedAt);
  const alreadyNotifiedEmail = Boolean(order.adminEmailNotifiedAt);

  if (alreadyNotifiedNtfy && alreadyNotifiedTelegram && alreadyNotifiedEmail) {
    return { notified: true, skipped: true, reason: "already_notified" };
  }

  console.log(`[Notifier] Triggering alerts for order ${order.id} (${order.transferNote})...`);

  const [ntfyResult, teleResult, mailResult] = await Promise.allSettled([
    !alreadyNotifiedNtfy
      ? sendNtfyOrderAlert({ order, track, transaction })
      : Promise.resolve({ sent: true, skipped: true }),
    !alreadyNotifiedTelegram
      ? sendTelegramOrderAlert({ order, track, transaction })
      : Promise.resolve({ sent: true, skipped: true }),
    !alreadyNotifiedEmail
      ? sendGmailOrderAlert({ order, track, transaction })
      : Promise.resolve({ sent: true, skipped: true })
  ]);

  const ntfySuccess = ntfyResult.status === "fulfilled" && ntfyResult.value?.sent;
  const teleSuccess = teleResult.status === "fulfilled" && teleResult.value?.sent;
  const mailSuccess = mailResult.status === "fulfilled" && mailResult.value?.sent;

  if (ntfySuccess) {
    order.ntfyNotifiedAt = new Date().toISOString();
  }
  if (teleSuccess) {
    order.telegramNotifiedAt = new Date().toISOString();
  }
  if (mailSuccess) {
    order.adminEmailNotifiedAt = new Date().toISOString();
  }

  if ((ntfySuccess || teleSuccess || mailSuccess) && typeof writeDb === "function" && db) {
    writeDb(db);
  }

  return {
    notified: true,
    ntfy: ntfyResult.status === "fulfilled" ? ntfyResult.value : { sent: false, error: ntfyResult.reason?.message },
    telegram: teleResult.status === "fulfilled" ? teleResult.value : { sent: false, error: teleResult.reason?.message },
    gmail: mailResult.status === "fulfilled" ? mailResult.value : { sent: false, error: mailResult.reason?.message }
  };
}

/**
 * 5. Gửi email tự động hàng loạt qua Resend API khi Nghao Producer ra mắt bài nhạc mới
 */
export async function sendTrackReleaseNewsletter({
  track,
  subscribers,
  customSubject,
  customMessage,
  fetchImpl = globalThis.fetch
}) {
  const resendApiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!resendApiKey) {
    return {
      success: false,
      error: "Chưa cấu hình RESEND_API_KEY. Vui lòng thêm RESEND_API_KEY vào biến môi trường (.env)."
    };
  }

  const activeSubs = (subscribers || []).filter((s) => s.active !== false && s.email);
  if (activeSubs.length === 0) {
    return {
      success: false,
      error: "Chưa có người đăng ký nhận thông báo nào trong danh sách."
    };
  }

  const senderEmail = (process.env.RESEND_FROM_EMAIL || "NGHAO Producer <release@nghaoproducer.shop>").trim();
  const siteUrl = (process.env.PUBLIC_SITE_URL || "https://nghaoproducer.shop").replace(/\/+$/, "");
  const trackUrl = `${siteUrl}/#track-${track.id}`;

  let coverUrl = track.cover || "";
  if (coverUrl && coverUrl.startsWith("/")) {
    coverUrl = `${siteUrl}${coverUrl}`;
  }

  const subject = customSubject?.trim() || `🔥 [NGHAO Producer] Ra mắt bài nhạc mới: "${track.title}"`;
  const priceText = Number(track.price) > 0
    ? `${Number(track.price).toLocaleString("vi-VN")} ₫`
    : "MIỄN PHÍ (Free Download)";

  const emailHtml = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:24px 12px;background-color:#0b0b0e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:580px;margin:0 auto;background:#141419;border-radius:24px;border:1px solid rgba(255,255,255,0.1);overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
    <!-- Header Banner -->
    <tr>
      <td style="padding:28px 28px 16px;text-align:center;">
        <span style="display:inline-block;padding:4px 14px;border-radius:999px;background:rgba(255,90,31,0.15);border:1px solid rgba(255,90,31,0.3);color:#ff5a1f;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">
          Bản phát hành mới
        </span>
        <h1 style="margin:14px 0 6px;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.02em;">
          NGHAO PRODUCER
        </h1>
        <p style="margin:0;color:#9ca3af;font-size:13px;">
          Bài nhạc mới vừa chính thức phát hành trên website!
        </p>
      </td>
    </tr>

    <!-- Track Card -->
    <tr>
      <td style="padding:12px 28px 24px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#1a1a22;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;">
          ${coverUrl ? `
          <tr>
            <td style="padding:0;text-align:center;">
              <img src="${coverUrl}" alt="${escapeHtml(track.title)}" style="width:100%;max-height:340px;object-fit:cover;display:block;" />
            </td>
          </tr>
          ` : ""}
          <tr>
            <td style="padding:22px;">
              <div style="font-size:11px;font-weight:600;color:#ff5a1f;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">
                ${escapeHtml(track.album || "Single Release")} · ${escapeHtml(track.genre || "Music")}
              </div>
              <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;">
                ${escapeHtml(track.title)}
              </h2>
              <p style="margin:0 0 14px;color:#9ca3af;font-size:13px;line-height:1.5;">
                Nghệ sĩ: <strong style="color:#ffffff;">${escapeHtml(track.artist || "Nghao Producer")}</strong>
                &nbsp;·&nbsp;
                Giá: <strong style="color:#22c55e;">${priceText}</strong>
              </p>
              ${customMessage?.trim() ? `
              <div style="margin:14px 0 20px;padding:12px 14px;background:rgba(255,255,255,0.04);border-left:3px solid #ff5a1f;border-radius:6px;color:#e5e7eb;font-size:13px;line-height:1.6;">
                ${escapeHtml(customMessage.trim()).replace(/\n/g, "<br />")}
              </div>
              ` : `
              <p style="margin:0 0 20px;color:#d1d5db;font-size:13px;line-height:1.6;">
                Bạn nhận được email này vì đã đăng ký nhận thông báo bài nhạc mới từ <strong>Nghao Producer</strong>. Bấm nút dưới đây để nghe thử hoặc tải ngay bản nhạc nhé!
              </p>
              `}
              <div style="text-align:center;padding:4px 0 8px;">
                <a href="${trackUrl}" target="_blank" style="display:inline-block;background:#ff5a1f;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 34px;border-radius:999px;box-shadow:0 8px 20px rgba(255,90,31,0.35);">
                  🎧 Nghe bài hát ngay trên website ↗
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding:20px 28px 28px;text-align:center;border-top:1px solid rgba(255,255,255,0.08);">
        <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">
          Liên hệ & Hỗ trợ: Zalo 0333 025 864 · <a href="https://www.facebook.com/prodnghao" style="color:#9ca3af;text-decoration:underline;">Facebook</a> · <a href="https://www.tiktok.com/@prod.nghao" style="color:#9ca3af;text-decoration:underline;">TikTok</a>
        </p>
        <p style="margin:0;font-size:11px;color:#4b5563;">
          © ${new Date().getFullYear()} Nghao Producer · <a href="${siteUrl}" style="color:#ff5a1f;text-decoration:none;">nghaoproducer.shop</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const uniqueEmails = Array.from(new Set(activeSubs.map((s) => s.email.trim().toLowerCase())));

  let sentCount = 0;
  let failedCount = 0;
  const errors = [];

  const BATCH_SIZE = 50;
  for (let i = 0; i < uniqueEmails.length; i += BATCH_SIZE) {
    const chunk = uniqueEmails.slice(i, i + BATCH_SIZE);
    const batchPayload = chunk.map((toEmail) => ({
      from: senderEmail,
      to: [toEmail],
      subject,
      html: emailHtml
    }));

    try {
      const res = await fetchImpl("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(batchPayload)
      });

      if (res.ok) {
        sentCount += chunk.length;
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error("[Resend batch error]", res.status, errorData);
        failedCount += chunk.length;
        errors.push(errorData.message || `HTTP ${res.status}`);
      }
    } catch (err) {
      console.error("[Resend batch network error]", err);
      failedCount += chunk.length;
      errors.push(err.message);
    }
  }

  return {
    success: sentCount > 0,
    sentCount,
    failedCount,
    totalTargeted: uniqueEmails.length,
    errors: errors.length > 0 ? errors : undefined
  };
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
