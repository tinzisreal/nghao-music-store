import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBagIcon, Trash2Icon, XIcon, ArrowRightIcon, MusicIcon } from "lucide-react";
import { useCart } from "../contexts/CartContext";
import { formatPrice } from "../utils/format";
import { Track } from "../types/track";

interface CartDrawerProps {
  onCheckout: (tracks: Track[]) => void;
}

export function CartDrawer({ onCheckout }: CartDrawerProps) {
  const { items, isCartOpen, closeCart, removeFromCart, clearCart, totalItems, totalPrice } = useCart();

  const handleCheckout = () => {
    if (items.length === 0) return;
    const checkoutItems = [...items];
    closeCart();
    onCheckout(checkoutItems);
  };

  return (
    <AnimatePresence>
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop mờ */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeCart}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Drawer trượt từ bên phải */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-white/10 bg-[#0e1622]/95 shadow-2xl backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
                  <ShoppingBagIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Giỏ hàng của bạn</h2>
                  <p className="text-xs text-white/50">{totalItems} bài hát đã chọn</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeCart}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Đóng"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            {/* List items */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-white/30">
                    <ShoppingBagIcon className="h-8 w-8" />
                  </div>
                  <h3 className="mb-1 text-sm font-semibold text-white">Giỏ hàng đang trống</h3>
                  <p className="mb-6 max-w-xs text-xs leading-relaxed text-white/50">
                    Bạn chưa chọn bản beat nào. Hãy thêm các bài hát yêu thích vào giỏ để thanh toán cùng lúc!
                  </p>
                  <button
                    type="button"
                    onClick={closeCart}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-white/20"
                  >
                    Khám phá Beat ngay
                    <ArrowRightIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((track) => (
                    <div
                      key={track.id}
                      className="group flex items-center gap-3.5 rounded-2xl border border-white/5 bg-white/[0.03] p-3 transition-colors hover:border-white/15 hover:bg-white/[0.06]"
                    >
                      {/* Bìa bài hát */}
                      <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-black/40">
                        {track.cover ? (
                          <img
                            src={track.cover}
                            alt={track.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-white/30">
                            <MusicIcon className="h-6 w-6" />
                          </div>
                        )}
                      </div>

                      {/* Chi tiết bài */}
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm font-semibold text-white">{track.title}</h4>
                        <p className="truncate text-xs text-white/50">
                          {track.genre || "Instrumental"} {track.bpm ? `· ${track.bpm} BPM` : ""}
                        </p>
                        <p className="mt-0.5 text-xs font-bold text-purple-400">
                          {formatPrice(track.price)}
                        </p>
                      </div>

                      {/* Nút xóa */}
                      <button
                        type="button"
                        onClick={() => removeFromCart(track.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-red-500/20 hover:text-red-400"
                        title="Xóa khỏi giỏ"
                      >
                        <Trash2Icon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-white/10 bg-[#091018]/90 p-6 backdrop-blur-md">
                <div className="mb-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>Số lượng</span>
                    <span>{totalItems} bài hát</span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-bold text-white">
                    <span>Tổng thanh toán</span>
                    <span className="text-base text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                      {formatPrice(totalPrice)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCheckout}
                  className="relative flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-500/25 transition-all duration-200 hover:scale-[1.02] hover:shadow-purple-500/40 active:scale-[0.98]"
                >
                  <ShoppingBagIcon className="h-4 w-4" />
                  Tiến hành thanh toán ({totalItems} bài)
                </button>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-white/40">
                    Quét 1 mã VietQR duy nhất · Tải file 320kbps ngay
                  </span>
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-[11px] text-white/40 underline-offset-2 hover:text-red-400 hover:underline"
                  >
                    Xóa giỏ hàng
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
