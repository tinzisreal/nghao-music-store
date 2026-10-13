import test from "node:test";
import assert from "node:assert/strict";
import {
  vndToUsd,
  isPayPalConfigured,
  getPayPalAccessToken,
  createPayPalCheckoutOrder,
  capturePayPalCheckoutOrder
} from "./paypal.js";

test("vndToUsd converts VND to rounded USD correctly", () => {
  assert.equal(vndToUsd(0), "1.00");
  assert.equal(vndToUsd(1000), "1.00");
  assert.equal(vndToUsd(200000), "8.00");
  assert.equal(vndToUsd(500000), "20.00");
  assert.equal(vndToUsd(1000000), "40.00");
});

test("isPayPalConfigured checks credentials correctly", () => {
  const prevId = process.env.PAYPAL_CLIENT_ID;
  const prevSecret = process.env.PAYPAL_CLIENT_SECRET;

  delete process.env.PAYPAL_CLIENT_ID;
  delete process.env.PAYPAL_CLIENT_SECRET;
  assert.equal(isPayPalConfigured(), false);

  process.env.PAYPAL_CLIENT_ID = "valid_client_id";
  process.env.PAYPAL_CLIENT_SECRET = "valid_client_secret";
  assert.equal(isPayPalConfigured(), true);

  process.env.PAYPAL_CLIENT_ID = prevId;
  process.env.PAYPAL_CLIENT_SECRET = prevSecret;
});

test("getPayPalAccessToken retrieves OAuth token", async () => {
  const mockFetch = async (url, options) => {
    assert.ok(url.includes("/v1/oauth2/token"));
    return {
      ok: true,
      json: async () => ({ access_token: "mock_paypal_token_123" })
    };
  };

  const token = await getPayPalAccessToken({
    clientId: "mock_id",
    clientSecret: "mock_sec",
    fetchImpl: mockFetch
  });

  assert.equal(token, "mock_paypal_token_123");
});

test("createPayPalCheckoutOrder creates order with intent CAPTURE", async () => {
  let orderPayload = null;

  const mockFetch = async (url, options) => {
    if (url.includes("/oauth2/token")) {
      return { ok: true, json: async () => ({ access_token: "mock_token" }) };
    }
    orderPayload = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ id: "PAYPAL_ORD_999", status: "CREATED" })
    };
  };

  const res = await createPayPalCheckoutOrder({
    orderId: "ord_local_1",
    trackTitle: "Ai ngoài anh",
    amountVnd: 500000,
    customerEmail: "khach@gmail.com",
    fetchImpl: mockFetch
  });

  assert.equal(res.paypalOrderId, "PAYPAL_ORD_999");
  assert.equal(res.amountUsd, "20.00");
  assert.equal(orderPayload.intent, "CAPTURE");
  assert.equal(orderPayload.purchase_units[0].amount.value, "20.00");
  assert.equal(orderPayload.payer.email_address, "khach@gmail.com");
});

test("capturePayPalCheckoutOrder captures payment and extracts details", async () => {
  const mockFetch = async (url) => {
    if (url.includes("/oauth2/token")) {
      return { ok: true, json: async () => ({ access_token: "mock_token" }) };
    }
    return {
      ok: true,
      json: async () => ({
        id: "PAYPAL_ORD_999",
        status: "COMPLETED",
        payer: {
          email_address: "buyer@gmail.com",
          name: { given_name: "John", surname: "Doe" }
        },
        purchase_units: [
          {
            reference_id: "ord_local_1",
            payments: {
              captures: [
                {
                  id: "CAP_123",
                  amount: { value: "20.00", currency_code: "USD" }
                }
              ]
            }
          }
        ]
      })
    };
  };

  const res = await capturePayPalCheckoutOrder({
    paypalOrderId: "PAYPAL_ORD_999",
    fetchImpl: mockFetch
  });

  assert.equal(res.success, true);
  assert.equal(res.captureId, "CAP_123");
  assert.equal(res.paidAmountUsd, "20.00");
  assert.equal(res.payerEmail, "buyer@gmail.com");
  assert.equal(res.payerName, "John Doe");
  assert.equal(res.referenceOrderId, "ord_local_1");
});
