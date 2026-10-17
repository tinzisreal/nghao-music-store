# Kế hoạch Triển khai Giỏ hàng Đa bài hát (Multi-Item Shopping Cart)

- **Ngày lập**: 2026-10-17
- **Tài liệu thiết kế**: [docs/superpowers/specs/2026-10-17-shopping-cart-design.md](file:///c:/Users/lenovo/Downloads/2de47be7-6253-48cc-a540-838701bdd9f1/docs/superpowers/specs/2026-10-17-shopping-cart-design.md)
- **Tech Stack**: React 18, TypeScript, Tailwind CSS, Framer Motion, Express 5, ApiPay VietQR, HMAC-SHA256, Cloudinary.

---

## Mục tiêu Kỹ thuật
Xây dựng tính năng giỏ hàng mua cùng lúc nhiều bài beat cho Nghao Producer Store:
- Giữ nguyên nút "Mua ngay" cho khách mua lẻ 1 bài.
- Thêm nút icon `🛒+` trên từng bài hát và audio player.
- Header có badge số lượng giỏ hàng; bấm vào mở Cart Drawer trượt mượt từ cạnh phải.
- Backend hỗ trợ `trackIds: [...]`, tự cộng dồn tổng tiền `amount`, tạo 1 mã VietQR duy nhất.
- Sau khi quét mã thành công, giỏ hàng tự dọn sạch, màn hình hiện danh sách các bài đã mua kèm nút tải MP3 Full 320kbps bảo mật từng bài.

---

## Danh sách Task chi tiết

### Task 1: Backend Multi-Track Orders & HMAC Secure Download
- **Mục tiêu**: Nâng cấp `POST /orders` trong `server/index.js` nhận `trackIds: string[]`, tính tổng tiền, lưu `items` và `trackIds`, giữ `trackId: trackIds[0]` cho tương thích ngược. Hỗ trợ `GET /orders/:id/download?trackId=...&token=...`.
- **File cần sửa/tạo**:
  - `server/index.js`
  - `server/apipay.js`
  - `server/multi-orders.test.js`
- **Kiểm thử**: Viết unit test trong `server/multi-orders.test.js` kiểm tra tạo đơn nhiều bài, tính tổng tiền, và xác thực tải từng bài.
- **Lệnh chạy test**: `node --test server/multi-orders.test.js`
- **Commit**: `git commit -m "feat(backend): support multi-track orders and per-track secure downloads"`

---

### Task 2: Store Types & API Client Upgrade
- **Mục tiêu**: Cập nhật kiểu `Order` trong `src/types/store.ts` để hỗ trợ `trackIds?: string[]` và `items?: Array<{ trackId: string; title: string; price: number; cover?: string }>`. Cập nhật `createOrder` trong `src/utils/api.ts` nhận `trackIds?: string[]`.
- **File cần sửa**:
  - `src/types/store.ts`
  - `src/utils/api.ts`
- **Kiểm thử**: `npx tsc --noEmit`
- **Commit**: `git commit -m "feat(types): add multi-item fields to Order and api.createOrder"`

---

### Task 3: CartContext & LocalStorage Persistence
- **Mục tiêu**: Tạo `src/context/CartContext.tsx` cung cấp `useCart()` với các hàm `addToCart`, `removeFromCart`, `clearCart`, `isInCart`, `totalItems`, `totalPrice`. Tự động lưu và đọc từ `localStorage`. Bọc `CartProvider` trong `src/App.tsx`.
- **File cần tạo/sửa**:
  - `src/context/CartContext.tsx`
  - `src/App.tsx`
- **Kiểm thử**: `npx tsc --noEmit`
- **Commit**: `git commit -m "feat(cart): implement CartContext with localStorage persistence"`

---

### Task 4: Cart Drawer Component & Header Cart Icon
- **Mục tiêu**: 
  - Tạo `src/components/CartDrawer.tsx` trượt từ cạnh phải màn hình với hiệu ứng Framer Motion, giao diện Dark Glass sang trọng, danh sách bài hát, nút xóa, tổng tiền, nút "Tiến hành thanh toán".
  - Thêm icon `🛒` và badge số lượng trên thanh `src/components/Header.tsx`.
- **File cần tạo/sửa**:
  - `src/components/CartDrawer.tsx`
  - `src/components/Header.tsx`
  - `src/components/StoreView.tsx`
- **Kiểm thử**: `npx tsc --noEmit`
- **Commit**: `git commit -m "feat(ui): add CartDrawer and Header cart badge"`

---

### Task 5: TrackCard & Audio Player "Add to Cart" Buttons
- **Mục tiêu**: Bổ sung nút `🛒+` (hoặc tick `"Đã thêm"`) bên cạnh nút "Mua ngay" trên từng card bài hát (`src/components/TrackCard.tsx`) và trên thanh phát nhạc (`src/components/AudioPlayer.tsx`).
- **File cần sửa**:
  - `src/components/TrackCard.tsx`
  - `src/components/AudioPlayer.tsx`
- **Kiểm thử**: `npx tsc --noEmit`
- **Commit**: `git commit -m "feat(ui): add cart toggle buttons to TrackCard and AudioPlayer"`

---

### Task 6: PaymentModal Multi-Item Checkout & Success Screen
- **Mục tiêu**: Cập nhật `src/components/PaymentModal.tsx` để hỗ trợ cả 2 chế độ: mua 1 bài lẻ (`track`) hoặc mua cả giỏ hàng (`tracks: Track[]`). Màn hình thành công (`phase === 'done'`) liệt kê từng bài kèm nút tải MP3 Full và nút "Tải tất cả". Tự động gọi `clearCart()` khi thanh toán thành công.
- **File cần sửa**:
  - `src/components/PaymentModal.tsx`
  - `src/components/StoreView.tsx`
- **Kiểm thử**: `npx tsc --noEmit`
- **Commit**: `git commit -m "feat(checkout): support multi-track checkout in PaymentModal and multi-download screen"`

---

### Task 7: Full Verification & Build Validation
- **Mục tiêu**: Chạy toàn bộ 27+ unit tests backend, chạy Vite production build không lỗi, kiểm tra đối soát và admin.
- **Lệnh chạy**:
  - `node --test server/*.test.js`
  - `npm run build`
- **Commit**: `git commit -m "chore: final verification for multi-item cart system"`
