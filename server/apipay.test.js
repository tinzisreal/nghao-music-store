import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  ApiPayError,
  buildApiPayAuthHeader,
  createPaymentRequest,
  handleApiPayWebhook,
  reconcileDbWithApiPay,
  sanitizeOrderForClient,
  verifyRedirectPayload,
  verifyWebhookSignature
} from "./apipay.js";

test("1. createPaymentRequest sends Bearer base64 auth and returns payment data", async () => {
  const accessKey = "test_access_key_123";
  const secretKey = "test_secret_key_456";
  const bankPublicId = "cmv615pke0c4001sxipdu87dw";

  let capturedUrl = "";
  let capturedInit = null;

  const mockFetch = async (url, init) => {
    capturedUrl = url;
    capturedInit = init;
    return {
      ok: true,
      status: 201,
      async json() {
        return {
          data: {
            publicId: "APIPAYJSC_ORDER_01",
            payUrl: "https://pay.apipay.vn/APIPAYJSC_ORDER_01",
            qrUrl: "https://app.apipay.vn/v1/payment-requests/APIPAYJSC_ORDER_01/qr-image",
            bankCode: "MB",
            accountNumber: "0392590124",
            accountName: "NGUYEN DUC ANH HAO",
            amount: "100000",
            content: "NGHAO ORD001",
            redirectSecret: "redir_secret_xyz"
          },
          statusCode: 200,
          timestamp: "2026-10-13T02:00:00.000Z"
        };
      }
    };
  };

  const data = await createPaymentRequest({
    bankPublicId,
    amount: 100000,
    content: "NGHAO ORD001",
    title: "Thanh toán đơn hàng #001",
    redirectUrl: "https://example.com/payment/result",
    accessKey,
    secretKey,
    fetchImpl: mockFetch
  });

  assert.equal(capturedUrl, "https://app.apipay.vn/v1/client/payment-requests");
  assert.equal(capturedInit.method, "POST");

  const expectedBase64 = Buffer.from(`${accessKey}:${secretKey}`, "utf8").toString("base64");
  assert.equal(capturedInit.headers.Authorization, `Bearer ${expectedBase64}`);
  assert.equal(capturedInit.headers["Content-Type"], "application/json");

  const sentBody = JSON.parse(capturedInit.body);
  assert.deepEqual(sentBody, {
    bankPublicId: "cmv615pke0c4001sxipdu87dw",
    amount: "100000",
    content: "NGHAO ORD001",
    title: "Thanh toán đơn hàng #001",
    redirectUrl: "https://example.com/payment/result"
  });

  assert.equal(data.publicId, "APIPAYJSC_ORDER_01");
  assert.equal(data.payUrl, "https://pay.apipay.vn/APIPAYJSC_ORDER_01");
  assert.equal(data.redirectSecret, "redir_secret_xyz");
});

test("2. createPaymentRequest handles non-2xx API error without leaking credentials", async () => {
  const accessKey = "super_secret_access_key";
  const secretKey = "super_secret_private_key";

  const mockFetch = async () => ({
    ok: false,
    status: 422,
    async json() {
      return {
        statusCode: 422,
        message: "Bank account is not active",
        error: "Unprocessable Entity"
      };
    }
  });

  await assert.rejects(
    async () => {
      await createPaymentRequest({
        bankPublicId: "cmv615pke0c4001sxipdu87dw",
        amount: "50000",
        content: "ORDER-ERR",
        accessKey,
        secretKey,
        fetchImpl: mockFetch
      });
    },
    (err) => {
      assert.ok(err instanceof ApiPayError);
      assert.equal(err.statusCode, 422);
      assert.equal(err.message, "Bank account is not active");
      assert.equal(err.message.includes(accessKey), false);
      assert.equal(err.message.includes(secretKey), false);
      assert.equal(
        err.message.includes(Buffer.from(`${accessKey}:${secretKey}`).toString("base64")),
        false
      );
      return true;
    }
  );
});

test("3. handleApiPayWebhook rejects missing or invalid ApiPay-Signature with 401", () => {
  const webhookSecret = "whsec_test_secret_key";
  const rawBody = Buffer.from(
    JSON.stringify({
      event: "transaction.in",
      sandbox: false,
      data: {
        transactionId: "tx-001",
        amount: "10000",
        content: "NGHAO ORD001"
      }
    }),
    "utf8"
  );

  let dbWrites = 0;
  const mockDb = {
    orders: [{ id: "ord_1", amount: 10000, transferNote: "NGHAO ORD001", status: "pending_verification" }],
    processedTransactions: []
  };

  // Missing signature
  const resMissing = handleApiPayWebhook({
    rawBody,
    signature: undefined,
    webhookSecret,
    readDb: () => mockDb,
    writeDb: () => {
      dbWrites++;
      return true;
    }
  });
  assert.equal(resMissing.statusCode, 401);
  assert.equal(dbWrites, 0);

  // Wrong signature
  const wrongSig = crypto.createHmac("sha256", "wrong_secret").update(rawBody).digest("hex");
  const resWrong = handleApiPayWebhook({
    rawBody,
    signature: wrongSig,
    webhookSecret,
    readDb: () => mockDb,
    writeDb: () => {
      dbWrites++;
      return true;
    }
  });
  assert.equal(resWrong.statusCode, 401);
  assert.equal(dbWrites, 0);
  assert.equal(mockDb.orders[0].status, "pending_verification");
});

test("4. handleApiPayWebhook verifies signature, updates order to paid, and deduplicates duplicate transactionId", () => {
  const webhookSecret = "whsec_live_secret_999";
  const dbState = {
    tracks: [
      {
        id: "t1",
        title: "Demo Beat",
        price: 10000,
        fullAudioUrl: "https://res.cloudinary.com/demo/full.mp3"
      }
    ],
    orders: [
      {
        id: "ord_100",
        trackId: "t1",
        amount: 10000,
        transferNote: "NGHAO M9K8J7",
        redirectSecret: "secret_not_for_client",
        status: "pending_verification"
      }
    ],
    processedTransactions: []
  };

  let writeCalls = 0;
  const readDb = () => dbState;
  const writeDb = () => {
    writeCalls++;
    return true;
  };

  const rawPayload = Buffer.from(
    JSON.stringify({
      event: "transaction.in",
      sandbox: false,
      data: {
        transactionId: "550e8400-e29b-41d4-a716-446655440000",
        referenceCode: "FT2628612345",
        amount: "10000",
        content: "MBVCB.12345.NGHAO M9K8J7.CT tu 0123456789",
        transactionDate: "2026-10-13T02:20:00.000Z",
        bankAccountPublicId: "cmv615pke0c4001sxipdu87dw",
        gateway: "MB"
      }
    }),
    "utf8"
  );

  const validSignature = crypto.createHmac("sha256", webhookSecret).update(rawPayload).digest("hex");

  // First webhook delivery -> marks order as paid and persists transaction
  const firstResult = handleApiPayWebhook({
    rawBody: rawPayload,
    signature: validSignature,
    webhookSecret,
    readDb,
    writeDb
  });

  assert.equal(firstResult.statusCode, 200);
  assert.equal(firstResult.body.received, true);
  assert.equal(firstResult.body.orderId, "ord_100");
  assert.equal(writeCalls, 1);
  assert.equal(dbState.orders[0].status, "paid");
  assert.equal(dbState.orders[0].transactionId, "550e8400-e29b-41d4-a716-446655440000");
  assert.equal(dbState.processedTransactions.length, 1);

  // Sanitized client order includes downloadUrl and hides redirectSecret
  const clientOrder = sanitizeOrderForClient(dbState.orders[0], dbState.tracks);
  assert.equal(clientOrder.redirectSecret, undefined);
  assert.equal(clientOrder.downloadUrl, "https://res.cloudinary.com/demo/full.mp3");

  // Second webhook delivery with identical transactionId -> deduplicated without writing again
  const duplicateResult = handleApiPayWebhook({
    rawBody: rawPayload,
    signature: validSignature,
    webhookSecret,
    readDb,
    writeDb
  });

  assert.equal(duplicateResult.statusCode, 200);
  assert.equal(duplicateResult.body.received, true);
  assert.equal(duplicateResult.body.duplicate, true);
  assert.equal(writeCalls, 1);
  assert.equal(dbState.processedTransactions.length, 1);
});

test("5. verifyRedirectPayload validates signed base64url redirect data and rejects tampered signature", () => {
  const redirectSecret = "redir_secret_abc123";
  const payloadObj = {
    status: "success",
    transactionId: "tx_999",
    amount: "10000"
  };
  const payloadJson = JSON.stringify(payloadObj);
  const dataParam = Buffer.from(payloadJson, "utf8").toString("base64url");
  const validSig = crypto.createHmac("sha256", redirectSecret).update(payloadJson).digest("hex");

  const verified = verifyRedirectPayload({ data: dataParam, signature: validSig }, redirectSecret);
  assert.deepEqual(verified, payloadObj);

  assert.throws(
    () => verifyRedirectPayload({ data: dataParam, signature: "00".repeat(32) }, redirectSecret),
    (err) => err instanceof ApiPayError && err.statusCode === 401
  );
});

test("6. reconcileDbWithApiPay matches unpaid orders by transferNote and COMPLETED payment requests", () => {
  const db = {
    orders: [
      {
        id: "ord_a",
        amount: 10000,
        transferNote: "NGHAO RECON01",
        status: "pending_verification"
      },
      {
        id: "ord_b",
        amount: 20000,
        transferNote: "NGHAO RECON02",
        apipayPublicId: "APIPAY_PR_02",
        status: "pending_verification"
      }
    ],
    processedTransactions: []
  };

  const result = reconcileDbWithApiPay(db, {
    transactions: [
      {
        transactionId: "tx_recon_01",
        referenceCode: "FT_RECON_01",
        amount: "10000",
        content: "CHUYEN TIEN NGHAO RECON01",
        transactionDate: "2026-10-13T02:30:00.000Z"
      }
    ],
    paymentRequests: [
      {
        publicId: "APIPAY_PR_02",
        amount: "20000",
        content: "NGHAO RECON02",
        status: "COMPLETED"
      }
    ]
  });

  assert.equal(result.newlyMatchedCount, 2);
  assert.equal(db.orders[0].status, "paid");
  assert.equal(db.orders[0].referenceCode, "FT_RECON_01");
  assert.equal(db.orders[1].status, "paid");
  assert.equal(db.processedTransactions.length, 1);
});

test("7. handleApiPayWebhook handles underpayment (chuyển thiếu) and cumulative top-up transfer to full payment", () => {
  const webhookSecret = "whsec_edge_case_secret";
  const dbState = {
    tracks: [
      {
        id: "t_edge",
        title: "Beat HipHop",
        price: 10000,
        fullAudioUrl: "https://res.cloudinary.com/demo/beat_full.mp3"
      }
    ],
    orders: [
      {
        id: "ord_under",
        trackId: "t_edge",
        amount: 10000,
        transferNote: "NGHAO UNDER01",
        status: "pending_verification"
      }
    ],
    processedTransactions: []
  };

  const readDb = () => dbState;
  const writeDb = () => true;

  // Transfer 1: Customer transfers 6,000 VND (short by 4,000 VND)
  const payload1 = Buffer.from(
    JSON.stringify({
      event: "transaction.in",
      sandbox: false,
      data: {
        transactionId: "tx_under_part1",
        referenceCode: "FT_PART_1",
        amount: "6000",
        content: "MBVCB.111.NGHAO UNDER01.CT tu KHACH",
        transactionDate: "2026-10-13T03:00:00.000Z"
      }
    }),
    "utf8"
  );
  const sig1 = crypto.createHmac("sha256", webhookSecret).update(payload1).digest("hex");

  const res1 = handleApiPayWebhook({
    rawBody: payload1,
    signature: sig1,
    webhookSecret,
    readDb,
    writeDb
  });

  assert.equal(res1.statusCode, 200);
  assert.equal(res1.body.orderStatus, "underpaid");
  assert.equal(dbState.orders[0].status, "underpaid");
  assert.equal(dbState.orders[0].paidAmount, 6000);
  assert.equal(dbState.orders[0].shortfallAmount, 4000);
  assert.equal(dbState.orders[0].overpaidAmount, 0);
  assert.equal(dbState.orders[0].paymentResolution, "underpaid");

  // Verify MP3 downloadUrl is NOT unlocked yet when underpaid
  const clientOrderUnderpaid = sanitizeOrderForClient(dbState.orders[0], dbState.tracks);
  assert.equal(clientOrderUnderpaid.downloadUrl, undefined);

  // Transfer 2: Customer transfers the remaining 4,000 VND with the same transferNote
  const payload2 = Buffer.from(
    JSON.stringify({
      event: "transaction.in",
      sandbox: false,
      data: {
        transactionId: "tx_under_part2",
        referenceCode: "FT_PART_2",
        amount: "4000",
        content: "MBVCB.222.NGHAO UNDER01.CT them phan thieu",
        transactionDate: "2026-10-13T03:02:00.000Z"
      }
    }),
    "utf8"
  );
  const sig2 = crypto.createHmac("sha256", webhookSecret).update(payload2).digest("hex");

  const res2 = handleApiPayWebhook({
    rawBody: payload2,
    signature: sig2,
    webhookSecret,
    readDb,
    writeDb
  });

  assert.equal(res2.statusCode, 200);
  assert.equal(res2.body.orderStatus, "paid");
  assert.equal(dbState.orders[0].status, "paid");
  assert.equal(dbState.orders[0].paidAmount, 10000);
  assert.equal(dbState.orders[0].shortfallAmount, 0);
  assert.equal(dbState.orders[0].overpaidAmount, 0);
  assert.equal(dbState.orders[0].paymentResolution, "exact");
  assert.equal(dbState.orders[0].paymentHistory.length, 2);

  // Verify MP3 downloadUrl IS unlocked now
  const clientOrderPaid = sanitizeOrderForClient(dbState.orders[0], dbState.tracks);
  assert.equal(clientOrderPaid.downloadUrl, "https://res.cloudinary.com/demo/beat_full.mp3");
});

test("8. handleApiPayWebhook handles overpayment (chuyển thừa), unlocks MP3, and records overpaidAmount", () => {
  const webhookSecret = "whsec_overpay_secret";
  const dbState = {
    tracks: [
      {
        id: "t_over",
        title: "Beat Overpay",
        price: 10000,
        fullAudioUrl: "https://res.cloudinary.com/demo/over_full.mp3"
      }
    ],
    orders: [
      {
        id: "ord_over",
        trackId: "t_over",
        amount: 10000,
        transferNote: "NGHAO OVER01",
        status: "pending_verification"
      }
    ],
    processedTransactions: []
  };

  const rawPayload = Buffer.from(
    JSON.stringify({
      event: "transaction.in",
      sandbox: false,
      data: {
        transactionId: "tx_over_01",
        referenceCode: "FT_OVER_01",
        amount: "15000",
        content: "NGHAO OVER01",
        transactionDate: "2026-10-13T03:05:00.000Z"
      }
    }),
    "utf8"
  );
  const sig = crypto.createHmac("sha256", webhookSecret).update(rawPayload).digest("hex");

  const res = handleApiPayWebhook({
    rawBody: rawPayload,
    signature: sig,
    webhookSecret,
    readDb: () => dbState,
    writeDb: () => true
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.orderStatus, "paid");
  assert.equal(dbState.orders[0].status, "paid");
  assert.equal(dbState.orders[0].paidAmount, 15000);
  assert.equal(dbState.orders[0].shortfallAmount, 0);
  assert.equal(dbState.orders[0].overpaidAmount, 5000);
  assert.equal(dbState.orders[0].paymentResolution, "overpaid");

  const clientOrder = sanitizeOrderForClient(dbState.orders[0], dbState.tracks);
  assert.equal(clientOrder.downloadUrl, "https://res.cloudinary.com/demo/over_full.mp3");
  assert.equal(clientOrder.overpaidAmount, 5000);
});


