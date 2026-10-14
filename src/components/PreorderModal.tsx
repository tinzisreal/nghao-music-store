import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckIcon, CopyIcon, MessageCircleIcon, PhoneIcon, SparklesIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Track } from "../types/track";
import { formatPrice } from "../utils/format";

interface PreorderModalProps {
  track: Track | null;
  onClose: () => void;
}

const EASE = [0.23, 1, 0.32, 1] as const;
const ZALO_PHONE = "0333025864";
const ZALO_DISPLAY = "0333 025 864";
const ZALO_LINK = `https://zalo.me/${ZALO_PHONE}`;

export function PreorderModal({ track, onClose }: PreorderModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ZALO_PHONE);
      setCopied(true);
      toast.success(`Đã sao chép số Zalo: ${ZALO_DISPLAY}`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.info(`Số Zalo: ${ZALO_DISPLAY}`);
    }
  };

  return (
    <AnimatePresence>
      {track && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
            onClick={onClose}
            aria-hidden
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="preorder-modal-title"
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="progressive-card-glass relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[30px] p-5 text-white shadow-2xl sm:rounded-[32px] sm:p-7"
          >
            {/* Mobile drag handle bar */}
            <div aria-hidden className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-white/20 sm:hidden" />

            {/* Header with Close Button */}
            <div className="flex items-center justify-between pb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-3 py-1 text-xs font-semibold text-amber-300 ring-1 ring-inset ring-amber-400/30">
                <SparklesIcon className="h-3.5 w-3.5 fill-amber-300 text-amber-300" aria-hidden />
                Đặt trước · Pre-order
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng"
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <XIcon className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {/* Track Info */}
            <div className="mt-3 flex items-center gap-4 rounded-2xl bg-white/[0.04] p-3.5 ring-1 ring-white/10">
              <img
                src={track.cover}
                alt=""
                className="h-20 w-20 shrink-0 rounded-xl object-cover ring-1 ring-white/15 sm:h-22 sm:w-22"
              />
              <div className="min-w-0 flex-1">
                <h3 id="preorder-modal-title" className="truncate text-base font-bold text-white sm:text-lg">
                  {track.title}
                </h3>
                <p className="mt-0.5 truncate text-xs text-white/60 sm:text-sm">
                  {track.artist} · {track.album}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80">
                    {track.genre}
                  </span>
                  <span className="text-sm font-bold text-ember sm:text-base">
                    {track.price > 0 ? formatPrice(track.price) : "Thương lượng"}
                  </span>
                </div>
              </div>
            </div>

            {/* Detail explanation text */}
            <div className="mt-5 space-y-2 rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4 text-xs leading-relaxed text-white/85 sm:text-sm">
              <p className="font-semibold text-amber-300">
                💬 Trao đổi & Đặt trước qua Zalo
              </p>
              <p className="text-white/75">
                Bài hát này hiện chưa mở bán file nhạc tự động mà đang trong giai đoạn mở đặt trước (<strong>Pre-order</strong>).
              </p>
              <p className="text-white/75">
                Bạn vui lòng liên hệ trực tiếp với <strong>Nghao Producer</strong> qua Zalo để trao đổi chi tiết về bản quyền độc quyền, nghe bản demo hoặc chốt lịch bàn giao nhạc nhé!
              </p>
            </div>

            {/* Action buttons */}
            <div className="mt-6 space-y-3">
              <a
                href={ZALO_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2.5 rounded-full bg-[#0068FF] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-all duration-150 hover:bg-[#0057d8] hover:shadow-blue-500/40 active:scale-[0.98] sm:text-base"
              >
                <MessageCircleIcon className="h-5 w-5 fill-white text-white" aria-hidden />
                <span>Liên hệ qua Zalo ({ZALO_DISPLAY})</span>
              </a>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center justify-center gap-1.5 rounded-full bg-white/[0.08] px-4 py-2.5 text-xs font-semibold text-white/90 ring-1 ring-white/15 transition-colors hover:bg-white/[0.14] hover:text-white"
                >
                  {copied ? (
                    <>
                      <CheckIcon className="h-4 w-4 text-emerald-400" aria-hidden />
                      <span className="text-emerald-400">Đã sao chép!</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon className="h-4 w-4 text-white/70" aria-hidden />
                      <span>Sao chép SĐT</span>
                    </>
                  )}
                </button>

                <a
                  href={`tel:${ZALO_PHONE}`}
                  className="flex items-center justify-center gap-1.5 rounded-full bg-white/[0.08] px-4 py-2.5 text-xs font-semibold text-white/90 ring-1 ring-white/15 transition-colors hover:bg-white/[0.14] hover:text-white"
                >
                  <PhoneIcon className="h-4 w-4 text-white/70" aria-hidden />
                  <span>Gọi điện thoại</span>
                </a>
              </div>
            </div>

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-white/50 transition-colors hover:text-white/80"
              >
                Đóng lại
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
