import test from "node:test";
import assert from "node:assert/strict";
import request from "http";
import { app, readDb, writeDb, createAdminToken } from "./index.js";

test("Security 1. Strict HTTP security headers and CSP are sent on responses", async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/health`);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-frame-options"), "SAMEORIGIN");
    assert.equal(res.headers.get("x-xss-protection"), "1; mode=block");
    assert.equal(res.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
    assert.ok(res.headers.get("permissions-policy"));
    assert.equal(res.headers.get("x-powered-by"), null);

    // Kiểm tra Content Security Policy (CSP Header)
    const csp = res.headers.get("content-security-policy");
    assert.ok(csp, "Header Content-Security-Policy phải tồn tại");
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /https:\/\/www\.paypal\.com/);
    assert.match(csp, /https:\/\/static\.cloudflareinsights\.com/);
    assert.match(csp, /https:\/\/app\.apipay\.vn/);
    assert.match(csp, /https:\/\/ntfy\.sh/);
    assert.match(csp, /https:\/\/res\.cloudinary\.com/);
    assert.match(csp, /https:\/\/api\.cloudinary\.com/);
  } finally {
    server.close();
  }
});

test("Security 2. CORS blocks unauthorized origins for sensitive requests", async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/admin/analytics`, {
      method: "GET",
      headers: {
        Origin: "https://malicious-attacker-site.com"
      }
    });
    // With CORS origin blocked, Access-Control-Allow-Origin header is NOT returned
    assert.notEqual(res.headers.get("access-control-allow-origin"), "https://malicious-attacker-site.com");
  } finally {
    server.close();
  }
});

test("Security 3. Admin endpoints reject invalid or missing Bearer tokens with 401", async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/admin/analytics`, {
      method: "GET",
      headers: {
        Authorization: "Bearer fake_invalid_token.123"
      }
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test("Security 4. Admin login rejects non-6-digit OTP codes immediately", async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otp: "abc" })
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.match(json.message, /6 chữ số/);
  } finally {
    server.close();
  }
});

test("Security 5. Admin endpoints accept valid HttpOnly Cookie admin_token", async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const db = readDb();
    const token = createAdminToken(db);

    const res = await fetch(`http://localhost:${port}/admin/analytics`, {
      method: "GET",
      headers: {
        Cookie: `admin_token=${token}`
      }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(typeof data.totalPlays === "number");
  } finally {
    server.close();
  }
});

test("Security 6. POST /admin/auth/logout clears HttpOnly Cookie", async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/admin/auth/logout`, {
      method: "POST"
    });
    assert.equal(res.status, 200);
    const setCookie = res.headers.get("set-cookie") || "";
    assert.match(setCookie, /admin_token=/);
    assert.match(setCookie, /Max-Age=0/i);
  } finally {
    server.close();
  }
});

test("Security 7. Rate limiter blocks rapid spam on /subscribe after 5 requests", async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    let lastStatus = 200;
    for (let i = 0; i < 7; i++) {
      const res = await fetch(`http://localhost:${port}/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": "203.0.113.195" // Isolated test IP
        },
        body: JSON.stringify({ email: `rate_test_${i}@gmail.com` })
      });
      lastStatus = res.status;
    }
    assert.equal(lastStatus, 429, "Request thứ 6+ phải bị chặn với mã 429 Too Many Requests");
  } finally {
    const db = readDb();
    if (db && Array.isArray(db.subscribers)) {
      db.subscribers = db.subscribers.filter((s) => !s.email?.startsWith("rate_test_"));
      writeDb(db);
    }
    server.close();
  }
});


test("Security 8. GET /admin/cloudinary-sign requires admin auth and returns valid upload signature", async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    // 1. Yêu cầu không có quyền admin phải trả về 401
    const unauthRes = await fetch(`http://localhost:${port}/admin/cloudinary-sign?kind=audio`);
    assert.equal(unauthRes.status, 401, "Yêu cầu không có quyền admin phải bị từ chối 401");

    // 2. Yêu cầu có quyền admin hợp lệ
    const db = readDb();
    const token = createAdminToken(db);
    const authRes = await fetch(`http://localhost:${port}/admin/cloudinary-sign?kind=audio`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (authRes.status === 200) {
      const data = await authRes.json();
      assert.ok(data.signature, "Phải có chữ ký signature");
      assert.ok(data.timestamp, "Phải có timestamp");
      assert.ok(data.apiKey, "Phải có apiKey");
      assert.ok(data.cloudName, "Phải có cloudName");
      assert.equal(data.folder, "music_store/audios");
      assert.equal(data.resourceType, "auto");
    } else {
      assert.equal(authRes.status, 503, "Nếu chưa cấu hình Cloudinary thì phải trả về 503");
    }
  } finally {
    server.close();
  }
});
