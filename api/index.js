import app, { initSupabaseStore } from "../server/index.js";

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  // Luôn đảm bảo dữ liệu mới nhất từ Supabase:
  // - Nếu là yêu cầu sửa/thêm/xoá dữ liệu (POST, PUT, PATCH, DELETE), buộc tải bản mới nhất từ Supabase trước khi ghi đè
  // - Nếu là yêu cầu đọc (GET), chỉ tải lại nếu bộ nhớ đệm đã quá 2.5 giây hoặc chưa có dữ liệu
  const method = (req.method || "GET").toUpperCase();
  const isMutation = !["GET", "HEAD", "OPTIONS"].includes(method);
  try {
    await initSupabaseStore(isMutation);
  } catch (err) {
    console.error("Supabase sync error in Vercel handler:", err.message);
  }

  // Normalize incoming path for Express router
  if (req.query && req.query._p) {
    const pathPart = Array.isArray(req.query._p) ? req.query._p.join("/") : req.query._p;
    delete req.query._p;
    const normalizedPath = pathPart.startsWith("/") ? pathPart : "/" + pathPart;
    const remainingParams = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (Array.isArray(v)) {
        v.forEach((val) => remainingParams.append(k, val));
      } else if (v !== undefined) {
        remainingParams.append(k, v);
      }
    }
    const qs = remainingParams.toString();
    req.url = normalizedPath + (qs ? "?" + qs : "");
  } else if (req.url) {
    for (const prefix of ["/fb-tr", "/tiktok-sdk", "/api-proxy"]) {
      if (req.url.startsWith(prefix)) {
        req.url = req.url.slice(prefix.length) || "/";
        break;
      }
    }
  }

  // Đảm bảo Vercel Serverless Function đợi Express xử lý và gửi phản hồi hoàn tất trước khi đóng lambda
  return new Promise((resolve, reject) => {
    res.on("finish", resolve);
    res.on("close", resolve);
    res.on("error", reject);
    app(req, res);
  });
}
