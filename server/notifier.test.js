import test from "node:test";
import assert from "node:assert/strict";
import {
  formatVnd,
  buildCustomerComposeMailUrl,
  sendTelegramOrderAlert,
  sendGmailOrderAlert,
  notifyAdminNewPaidOrder
} from "./notifier.js";

test("formatVnd formats number in Vietnamese Dong correctly", () => {
  assert.equal(formatVnd(1000), "1.000 ₫");
  assert.equal(formatVnd(150000), "150.000 ₫");
});

test("buildCustomerComposeMailUrl generates proper mail.google.com compose link", () => {
  const url = buildCustomerComposeMailUrl({
    customerEmail: "khach@gmail.com",
    trackTitle: "Ai ngoài anh",
    transferNote: "NGHAO ABC"
  });
  assert.ok(url.startsWith("https://mail.google.com/mail/?view=cm&fs=1"));
  assert.ok(url.includes("to=khach%40gmail.com"));
  assert.ok(url.includes("Ai%20ngo%C3%A0i%20anh"));
});

test("sendTelegramOrderAlert warns gracefully when bot token or chatId is missing", async () => {
  const prevToken = process.env.TELEGRAM_BOT_TOKEN;
  const prevChat = process.env.TELEGRAM_CHAT_ID;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;

  const result = await sendTelegramOrderAlert({
    order: { id: "ord_1", amount: 1000, transferNote: "NGHAO TEST" },
    track: { title: "Test Track" }
  });

  assert.equal(result.sent, false);
  assert.equal(result.reason, "telegram_not_configured");

  process.env.TELEGRAM_BOT_TOKEN = prevToken;
  process.env.TELEGRAM_CHAT_ID = prevChat;
});

test("sendTelegramOrderAlert posts payload to Telegram Bot API when configured", async () => {
  process.env.TELEGRAM_BOT_TOKEN = "test_bot_token";
  process.env.TELEGRAM_CHAT_ID = "123456789";

  let capturedUrl = "";
  let capturedBody = null;

  const mockFetch = async (url, options) => {
    capturedUrl = url;
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 100 } })
    };
  };

  const result = await sendTelegramOrderAlert({
    order: { id: "ord_1", amount: 1000, transferNote: "NGHAO TEST", email: "fan@gmail.com" },
    track: { title: "Ai ngoài anh" },
    fetchImpl: mockFetch
  });

  assert.equal(result.sent, true);
  assert.equal(capturedUrl, "https://api.telegram.org/bottest_bot_token/sendMessage");
  assert.equal(capturedBody.chat_id, "123456789");
  assert.ok(capturedBody.text.includes("Ai ngoài anh"));
  assert.ok(capturedBody.reply_markup.inline_keyboard.length > 0);
});

test("notifyAdminNewPaidOrder skips duplicate notifications if already notified", async () => {
  const order = {
    id: "ord_1",
    status: "paid",
    telegramNotifiedAt: "2026-10-13T05:00:00Z",
    adminEmailNotifiedAt: "2026-10-13T05:00:00Z"
  };

  const result = await notifyAdminNewPaidOrder({ order });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "already_notified");
});
