/**
 * Module tích hợp thanh toán Thẻ Quốc tế (Visa / Mastercard) & PayPal
 * Sử dụng PayPal Checkout REST API v2 (Hỗ trợ khách thanh toán trực tiếp bằng thẻ Visa/Mastercard không cần ví PayPal)
 */

export const PAYPAL_API_BASE =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

export function isPayPalConfigured() {
  return Boolean(
    process.env.PAYPAL_CLIENT_ID &&
    process.env.PAYPAL_CLIENT_SECRET &&
    process.env.PAYPAL_CLIENT_ID !== "your_paypal_client_id"
  );
}

export function vndToUsd(vndAmount) {
  const vnd = Math.max(0, Math.floor(Number(vndAmount) || 0));
  if (vnd <= 0) return "1.00";
  // Quy đổi tròn số sang USD (tỷ giá ~25.000 ₫ = $1.00, tối thiểu $1.00)
  const usd = Math.max(1, Math.ceil(vnd / 25000));
  return usd.toFixed(2);
}

/**
 * Lấy Access Token từ PayPal OAuth 2.0
 */
export async function getPayPalAccessToken({
  clientId = process.env.PAYPAL_CLIENT_ID,
  clientSecret = process.env.PAYPAL_CLIENT_SECRET,
  fetchImpl = globalThis.fetch
} = {}) {
  if (!clientId || !clientSecret) {
    throw new Error("Chưa cấu hình PAYPAL_CLIENT_ID hoặc PAYPAL_CLIENT_SECRET.");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetchImpl(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Xác thực PayPal thất bại (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Tạo PayPal Order (v2/checkout/orders) để hiển thị form quẹt thẻ Visa/Mastercard
 */
export async function createPayPalCheckoutOrder({
  orderId,
  trackTitle,
  amountVnd,
  customerEmail,
  fetchImpl = globalThis.fetch
}) {
  const amountUsd = vndToUsd(amountVnd);
  const accessToken = await getPayPalAccessToken({ fetchImpl });

  const payload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: String(orderId),
        description: `NGHAO Music Producer - ${String(trackTitle || "Track").slice(0, 100)}`,
        custom_id: String(orderId),
        amount: {
          currency_code: "USD",
          value: amountUsd
        }
      }
    ],
    application_context: {
      brand_name: "NGHAO Music Producer",
      landing_page: "BILLING",
      shipping_preference: "NO_SHIPPING",
      user_action: "PAY_NOW"
    }
  };

  if (customerEmail && customerEmail.includes("@")) {
    payload.payer = {
      email_address: customerEmail.trim()
    };
  }

  const res = await fetchImpl(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `Tạo đơn PayPal thất bại (${res.status})`);
  }

  return {
    paypalOrderId: data.id,
    status: data.status,
    amountUsd,
    currency: "USD"
  };
}

/**
 * Capture thanh toán sau khi khách đã nhập thẻ Visa/Mastercard hoặc bấm duyệt trên PayPal
 */
export async function capturePayPalCheckoutOrder({
  paypalOrderId,
  fetchImpl = globalThis.fetch
}) {
  const accessToken = await getPayPalAccessToken({ fetchImpl });

  const res = await fetchImpl(`${PAYPAL_API_BASE}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `Xác nhận thanh toán thẻ PayPal thất bại (${res.status})`);
  }

  const purchaseUnit = data.purchase_units?.[0] || {};
  const capture = purchaseUnit.payments?.captures?.[0] || {};
  const payer = data.payer || {};

  return {
    success: data.status === "COMPLETED",
    status: data.status,
    paypalOrderId: data.id,
    captureId: capture.id,
    paidAmountUsd: capture.amount?.value,
    currency: capture.amount?.currency_code || "USD",
    payerEmail: payer.email_address,
    payerName: payer.name ? `${payer.name.given_name || ""} ${payer.name.surname || ""}`.trim() : "",
    referenceOrderId: purchaseUnit.reference_id || purchaseUnit.custom_id
  };
}
