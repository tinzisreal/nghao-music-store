# Báo cáo Triển khai: Hệ thống Giỏ hàng Đa bài hát (Multi-Item Shopping Cart)

- **Dự án**: Nghao Producer Music Store
- **Tên miền**: `https://nghaoproducer.shop`
- **Thời gian hoàn tất**: 2026-10-17 23:10 (Giờ địa phương)
- **Trạng thái**: Đã kiểm thử thành công 100% & Đẩy lên Production

---

## 1. Tóm tắt tính năng mới

1. **Nút Giỏ hàng trên Header & Badge động (`src/components/CartButton.tsx`)**:
   - Nằm cạnh bộ chuyển ngôn ngữ ở góc trên bên phải.
   - Hiển thị badge số lượng màu tím/hồng với hiệu ứng pop-in khi có bài hát trong giỏ.
   - Nhấn vào sẽ trượt mở ngăn kéo giỏ hàng (Cart Drawer).

2. **Ngăn kéo Giỏ hàng (`src/components/CartDrawer.tsx`)**:
   - Trượt êm ái từ bên phải (`framer-motion`), giao diện kính tối (Dark Glass).
   - Danh sách bài hát: Ảnh bìa, tên bài, thể loại/BPM, giá VND, nút thùng rác xóa từng bài.
   - Hiển thị tổng tiền tự động cộng dồn chính xác.
   - Nút **"Tiến hành thanh toán"** mở popup quét 1 mã VietQR duy nhất.

3. **Nút thêm vào giỏ trên bài hát (`src/components/AllTracks.tsx`, `src/components/NewReleases.tsx`, `src/components/PlayerBar.tsx`)**:
   - Giữ nguyên nút **"Mua ngay"** để khách mua lẻ 1 bài trong 1 click.
   - Bổ sung nút icon chiếc túi `🛒` bên cạnh:
     - Chưa có trong giỏ: bấm vào -> thêm vào giỏ, icon đổi sang dấu tích xanh `✓`, thông báo toast.
     - Đã có trong giỏ: bấm vào -> xóa khỏi giỏ.
   - Giỏ hàng được lưu bền vững vào `localStorage` (`nghao_cart_items`).

4. **Nâng cấp Xử lý Đơn hàng & Tải nhạc (`server/index.js`, `server/apipay.js`, `server/mailer.js`)**:
   - `POST /orders` nhận `trackIds: [...]`, tự cộng dồn tổng tiền `amount`, tạo 1 mã QR VietQR duy nhất qua cổng ApiPay.
   - Giữ tương thích ngược 100% với đơn lẻ (`trackId`).
   - `GET /orders/:id/download?token=...&trackId=...`: Xác thực token HMAC-SHA256 và kiểm tra quyền tải từng bài hát trong đơn.
   - Màn hình thanh toán thành công tự động làm sạch giỏ hàng và liệt kê toàn bộ các bài hát đã mở khóa.

---

## 2. Kết quả Kiểm thử (Test Results)

### 2.1. Kiểm thử Đơn vị Backend (`node --test server/*.test.js`)
```
TAP version 13
ok 1 - 1. createPaymentRequest sends Bearer base64 auth and returns payment data
ok 2 - 2. createPaymentRequest handles non-2xx API error without leaking credentials
ok 3 - 3. handleApiPayWebhook rejects missing or invalid ApiPay-Signature with 401
ok 4 - 4. handleApiPayWebhook verifies signature, updates order to paid, and deduplicates duplicate transactionId
ok 5 - 5. verifyRedirectPayload validates signed base64url redirect data and rejects tampered signature
ok 6 - 6. reconcileDbWithApiPay matches unpaid orders by transferNote and COMPLETED payment requests
ok 7 - 7. handleApiPayWebhook handles underpayment (chuyển thiếu) and cumulative top-up transfer to full payment
ok 8 - 8. handleApiPayWebhook handles overpayment (chuyển thừa), unlocks MP3, and records overpaidAmount
ok 9 - Multi-Order 1. sanitizeOrderForClient preserves items and includes downloadUrl for paid orders
ok 10 - Multi-Order 2. buildSignedDownloadUrl supports optional trackId parameter
ok 11 - sendNtfyOrderAlert publishes urgent alert to ntfy topic
ok 12 - formatVnd formats number in Vietnamese Dong correctly
ok 13 - buildCustomerComposeMailUrl generates proper mail.google.com compose link
ok 14 - sendTelegramOrderAlert warns gracefully when bot token or chatId is missing
ok 15 - sendTelegramOrderAlert posts payload to Telegram Bot API when configured
ok 16 - notifyAdminNewPaidOrder skips duplicate notifications if already notified
ok 17 - sendNtfyOrderAlert and sendTelegramOrderAlert include phone number and Zalo link
ok 18 - vndToUsd converts VND to rounded USD correctly
ok 19 - isPayPalConfigured checks credentials correctly
ok 20 - getPayPalAccessToken retrieves OAuth token
ok 21 - createPayPalCheckoutOrder creates order with intent CAPTURE
ok 22 - capturePayPalCheckoutOrder captures payment and extracts details
ok 23 - reorderTracks reorders tracks according to specified trackIds sequence
ok 24 - reorderTracks retains unmentioned tracks at the end without data loss
ok 25 - reorderTracks ignores non-existent ids gracefully
ok 26 - Security 1. Strict HTTP security headers are sent on responses
ok 27 - Security 2. CORS blocks unauthorized origins for sensitive requests
ok 28 - Security 3. Admin endpoints reject invalid or missing Bearer tokens with 401
ok 29 - Security 4. Admin login rejects non-6-digit OTP codes immediately
# tests 29, pass 29, fail 0
```

### 2.2. Kiểm thử Biên dịch Frontend (`npm run build`)
```
vite v5.4.21 building for production...
transforming...
✓ 2050 modules transformed.
rendering chunks...
dist/index.html                   1.06 kB │ gzip:   0.57 kB
dist/assets/index-DxIcrQT6.css   63.40 kB │ gzip:  11.35 kB
dist/assets/index-CaFP244n.js   586.06 kB │ gzip: 168.14 kB
✓ built in 3.05s
```

---

## 3. Danh sách File đã Chỉnh sửa & Thêm mới

| File | Tác vụ | Mô tả |
| :--- | :--- | :--- |
| `src/contexts/CartContext.tsx` | Tạo mới | Context quản lý giỏ hàng và đồng bộ `localStorage` |
| `src/components/CartButton.tsx` | Tạo mới | Nút giỏ hàng trên Header kèm badge số lượng |
| `src/components/CartDrawer.tsx` | Tạo mới | Ngăn kéo giỏ hàng trượt từ phải sang |
| `server/multi-orders.test.js` | Tạo mới | Unit test cho đơn hàng đa bài hát |
| `docs/superpowers/specs/2026-10-17-shopping-cart-design.md` | Tạo mới | Tài liệu thiết kế hệ thống giỏ hàng |
| `docs/superpowers/plans/2026-10-17-shopping-cart.md` | Tạo mới | Kế hoạch triển khai chi tiết |
| `src/App.tsx` | Sửa đổi | Bọc `CartProvider` toàn ứng dụng |
| `src/pages/Store.tsx` | Sửa đổi | Đặt `CartButton` cạnh `LanguageSwitch` |
| `src/components/AllTracks.tsx` | Sửa đổi | Thêm nút toggle giỏ hàng cạnh nút Mua |
| `src/components/NewReleases.tsx` | Sửa đổi | Thêm nút toggle giỏ hàng cạnh nút Mua |
| `src/components/PlayerBar.tsx` | Sửa đổi | Thêm nút toggle giỏ hàng trên thanh nghe nhạc |
| `src/components/StoreView.tsx` | Sửa đổi | Kết nối `CartDrawer` và `PaymentModal` |
| `src/components/PaymentModal.tsx` | Sửa đổi | Hỗ trợ thanh toán giỏ hàng, dọn giỏ sau khi mua |
| `src/components/admin/ReconciliationManager.tsx` | Sửa đổi | Hiển thị tóm tắt đơn nhiều bài hát |
| `src/types/store.ts` | Sửa đổi | Khai báo `OrderItem` và `trackIds` trong `Order` |
| `src/utils/api.ts` | Sửa đổi | Nâng cấp `createOrder` nhận `trackIdOrIds` |
| `server/index.js` | Sửa đổi | Nâng cấp `/orders` và `/orders/:id/download` |
| `server/apipay.js` | Sửa đổi | Hỗ trợ `items` trong `sanitizeOrderForClient` |
| `server/mailer.js` | Sửa đổi | Hỗ trợ `trackId` trong `buildSignedDownloadUrl` |
