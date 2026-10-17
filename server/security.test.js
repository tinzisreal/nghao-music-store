import test from "node:test";
import assert from "node:assert/strict";
import request from "http";
import { app } from "./index.js";

test("Security 1. Strict HTTP security headers are sent on responses", async () => {
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
