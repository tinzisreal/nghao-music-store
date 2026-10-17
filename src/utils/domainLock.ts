/**
 * DOMAIN LOCK & ANTI-TAMPER INTEGRITY GUARD
 * 
 * Khóa chặt bản quyền mã nguồn vào tên miền nghaoproducer.shop.
 * Nếu bất kỳ ai tải toàn bộ file frontend về chạy trên domain khác, hosting khác
 * hoặc sao chép mã nguồn, module này sẽ phát hiện và lập tức tự hủy (xóa trắng giao diện
 * và chuyển hướng về https://nghaoproducer.shop).
 */

const ENCODED_DOMAINS = [
  "bmdoYW9wcm9kdWNlci5zaG9w", // nghaoproducer.shop
  "d3d3Lm5naGFvcHJvZHVjZXIuc2hvcA==", // www.nghaoproducer.shop
  "dmVyY2VsLmFwcA==", // vercel.app
  "bG9jYWxob3N0", // localhost
  "MTI3LjAuMC4x" // 127.0.0.1
];

function decode(b64: string): string {
  try {
    return atob(b64);
  } catch {
    return "";
  }
}

export function enforceDomainLock(): boolean {
  if (typeof window === "undefined" || !window.location) {
    return true;
  }

  const currentHost = window.location.hostname.toLowerCase();
  const allowed = ENCODED_DOMAINS.map(decode);

  const isAuthorized = allowed.some((domain) => {
    if (!domain) return false;
    return currentHost === domain || currentHost.endsWith("." + domain);
  });

  if (!isAuthorized) {
    // 1. Dừng tải tài nguyên trang web
    try {
      window.stop();
    } catch {
      /* ignore */
    }

    // 2. Xóa trắng toàn bộ giao diện và cấu trúc DOM chống sao chép
    if (document.documentElement) {
      document.documentElement.innerHTML = `
        <div style="min-height:100vh;background:#0b0b0c;color:#fff;display:flex;align-items:center;justify-content:center;font-family:sans-serif;text-align:center;padding:24px;">
          <div style="max-width:480px;border:1px solid rgba(255,255,255,0.15);border-radius:24px;padding:32px;background:#141418;">
            <h1 style="color:#ff5a1f;font-size:20px;margin-bottom:12px;">Bản quyền NGHAO — Music Producer</h1>
            <p style="font-size:14px;color:#a1a1aa;line-height:1.6;margin-bottom:20px;">
              Trang web này được bảo vệ bởi bản quyền và chỉ hoạt động chính thức tại <strong>nghaoproducer.shop</strong>.
            </p>
            <a href="https://nghaoproducer.shop" style="display:inline-block;background:#ff5a1f;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:999px;font-size:13px;">
              Truy cập trang chính thức: nghaoproducer.shop
            </a>
          </div>
        </div>
      `;
    }

    // 3. Tự động chuyển hướng về trang chính chủ sau 1.5 giây
    window.setTimeout(() => {
      window.location.replace("https://nghaoproducer.shop");
    }, 1500);

    throw new Error("[SECURITY_VIOLATION] Unauthorized host detected. Application halted.");
  }

  return true;
}
