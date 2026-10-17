import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeOrderForClient } from "./apipay.js";
import { buildOrderDownloadToken, verifyOrderDownloadToken, buildSignedDownloadUrl } from "./mailer.js";

test("Multi-Order 1. sanitizeOrderForClient preserves items and includes downloadUrl for paid orders", () => {
  const mockTracks = [
    { id: "trk_1", title: "Beat 1", price: 200000, fullAudioUrl: "https://example.com/beat1.mp3" },
    { id: "trk_2", title: "Beat 2", price: 300000, audioUrl: "https://example.com/beat2.mp3" }
  ];

  const pendingOrder = {
    id: "ord_multi_1",
    trackId: "trk_1",
    trackIds: ["trk_1", "trk_2"],
    items: [
      { trackId: "trk_1", title: "Beat 1", price: 200000 },
      { trackId: "trk_2", title: "Beat 2", price: 300000 }
    ],
    amount: 500000,
    status: "pending_verification"
  };

  const sanitizedPending = sanitizeOrderForClient(pendingOrder, mockTracks, { includeDownloadUrl: false });
  assert.equal(sanitizedPending.amount, 500000);
  assert.equal(sanitizedPending.items.length, 2);
  assert.equal(sanitizedPending.downloadUrl, undefined);
  assert.equal(sanitizedPending.items[0].downloadUrl, undefined);

  const paidOrder = { ...pendingOrder, status: "paid" };
  const sanitizedPaid = sanitizeOrderForClient(paidOrder, mockTracks, { includeDownloadUrl: true });
  assert.equal(sanitizedPaid.status, "paid");
  assert.equal(sanitizedPaid.items.length, 2);
  assert.equal(sanitizedPaid.items[0].downloadUrl, "https://example.com/beat1.mp3");
  assert.equal(sanitizedPaid.items[1].downloadUrl, "https://example.com/beat2.mp3");
});

test("Multi-Order 2. buildSignedDownloadUrl supports optional trackId parameter", () => {
  const token = buildOrderDownloadToken("ord_test", "secret_123");
  assert.ok(verifyOrderDownloadToken("ord_test", token, "secret_123"));

  const singleUrl = buildSignedDownloadUrl("ord_test", "secret_123");
  assert.match(singleUrl, /\/orders\/ord_test\/download\?token=/);

  const multiUrl = buildSignedDownloadUrl("ord_test", "secret_123", "trk_2");
  assert.match(multiUrl, /trackId=trk_2/);
});
