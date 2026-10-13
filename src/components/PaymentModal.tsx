import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircleIcon, CheckCircle2Icon, CheckIcon, CopyIcon, Loader2Icon, XIcon } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { Track } from "../types/track";
import { Order } from "../types/store";
import { api, errorMessage } from "../utils/api";
import { formatPrice } from "../utils/format";

interface PaymentModalProps {
  track: Track | null;
  onClose: () => void;
}

const EASE = [0.23, 1, 0.32, 1] as const;

export function PaymentModal({ track, onClose }: PaymentModalProps) {
  return (
    <AnimatePresence>
      {track &&
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: EASE }}>
        
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-title"
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          transition={{ duration: 0.24, ease: EASE }}
          className="liquid-glass-strong relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-[30px] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3.5 text-white sm:rounded-[32px] sm:p-6 md:p-7">
          
            <div aria-hidden className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-white/20 sm:hidden" />
            <PaymentContent key={track.id} track={track} onClose={onClose} />
          </motion.div>
        </motion.div>
      }
    </AnimatePresence>);

}

type Phase = "creating" | "ready" | "confirming" | "done" | "error";

function PaymentContent({ track, onClose }: {track: Track;onClose: () => void;}) {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<Phase>("creating");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [email, setEmail] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string>("");

  const createOrder = useCallback(() => {
    setPhase("creating");
    setError("");
    setStatusNote("");
    const redirectUrl = typeof window !== "undefined" ? window.location.origin : undefined;
    api.
    createOrder(track.id, redirectUrl).
    then((o) => {
      setOrder(o);
      if (o.status === "paid") {
        if (o.downloadUrl) setDownloadUrl(o.downloadUrl);
        setPhase("done");
      } else {
        setPhase("ready");
      }
    }).
    catch((err: unknown) => {
      setError(errorMessage(err, t("orderError")));
      setPhase("error");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.id]);

  useEffect(() => createOrder(), [createOrder]);

  // Tự động kiểm tra trạng thái đơn hàng từ webhook ApiPay (transaction.in) mỗi 3 giây
  useEffect(() => {
    if (!order || phase !== "ready") return;
    const timer = window.setInterval(() => {
      api.
      getOrder(order.id).
      then((updated) => {
        if (updated.status === "paid") {
          setOrder(updated);
          if (updated.downloadUrl) setDownloadUrl(updated.downloadUrl);
          setPhase("done");
        } else if (
          updated.status === "underpaid" &&
          (updated.paidAmount !== order.paidAmount || order.status !== "underpaid")
        ) {
          setOrder(updated);
        }
      }).
      catch(() => {
        /* ignore background polling errors */
      });
    }, 3000);

    return () => window.clearInterval(timer);
  }, [order, phase]);

  const confirm = () => {
    if (!order) return;
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Email không hợp lệ. Bạn có thể nhập đúng định dạng hoặc để trống.");
      return;
    }
    setPhase("confirming");
    setError("");
    setStatusNote("");
    api.
    confirmOrder(order.id, email.trim()).
    then((res) => {
      if (res?.downloadUrl) setDownloadUrl(res.downloadUrl);
      if (res?.status === "paid") {
        setOrder((prev) =>
          prev
            ? {
                ...prev,
                status: "paid",
                paidAmount: res.paidAmount ?? prev.paidAmount,
                overpaidAmount: res.overpaidAmount ?? prev.overpaidAmount,
                shortfallAmount: 0,
                paymentResolution: res.paymentResolution ?? prev.paymentResolution
              }
            : prev
        );
        setPhase("done");
      } else {
        if (res?.status === "underpaid") {
          setOrder((prev) =>
            prev
              ? {
                  ...prev,
                  status: "underpaid",
                  paidAmount: res.paidAmount ?? prev.paidAmount,
                  shortfallAmount: res.shortfallAmount ?? prev.shortfallAmount,
                  paymentResolution: "underpaid"
                }
              : prev
          );
        }
        setStatusNote(
          res?.message ||
          "Đang chờ ngân hàng xác nhận giao dịch qua ApiPay. Trang sẽ tự động mở khóa tải file ngay khi nhận được thanh toán."
        );
        setPhase("ready");
      }
    }).
    catch((err: unknown) => {
      setError(errorMessage(err, t("confirmError")));
      setPhase("ready");
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <>
      <button
        type="button"
        onClick={onClose}
        aria-label={t("close")}
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-150 hover:bg-white/20">
        
        <XIcon className="h-4 w-4" aria-hidden />
      </button>

      {phase === "done" ?
      <div className="flex flex-col items-center px-4 py-10 text-center">
          <CheckCircle2Icon className="h-12 w-12 text-ember" aria-hidden />
          <h2 id="payment-title" className="mt-4 text-2xl font-semibold">
            {t("thanks")}
          </h2>
          <p className="mt-2 max-w-sm text-white/70">
            Thanh toán bài hát <strong>{track.title}</strong> đã được xác nhận thành công!
          </p>

          {order && (order.overpaidAmount || 0) > 0 && (
            <div className="mt-4 max-w-md rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs leading-relaxed text-amber-200">
              Hệ thống ghi nhận bạn đã chuyển dư <strong>+{formatPrice(order.overpaidAmount || 0)}</strong> (Đã nhận{" "}
              <strong>{formatPrice(order.paidAmount || 0)}</strong> / Giá bài nhạc{" "}
              <strong>{formatPrice(order.amount)}</strong>). Nếu cần hỗ trợ hoàn tiền thừa, vui lòng nhắn Zalo{" "}
              <a href="https://zalo.me/0333025864" target="_blank" rel="noreferrer" className="font-semibold underline">
                0333 025 864
              </a>{" "}
              kèm mã <code className="font-mono font-semibold">{order.transferNote}</code>.
            </div>
          )}

          {downloadUrl ? (
            <a
              href={downloadUrl}
              download={`${track.title} - Full.mp3`}
              target="_blank"
              rel="noreferrer"
              className="mt-6 flex items-center gap-2 rounded-full bg-ember px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-ember/25 transition-transform duration-150 hover:scale-105 active:scale-95">
              <span>Tải bản MP3 Full ({track.title})</span>
            </a>
          ) : (
            <p className="mt-4 text-xs text-white/50">Hệ thống đã ghi nhận đơn hàng của bạn.</p>
          )}

          <button
          type="button"
          onClick={onClose}
          className="mt-6 rounded-full bg-white/10 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/20">
          
            {t("backToMusic")}
          </button>

          <p className="mt-4 text-xs text-white/50">
            Có thắc mắc hoặc cần hỗ trợ? Liên hệ Zalo:{" "}
            <a href="https://zalo.me/0333025864" target="_blank" rel="noreferrer" className="text-ember underline">
              0333 025 864
            </a>
          </p>
        </div> :

      <>
          <div className="flex items-center gap-3 pr-10">
            <img src={track.cover} alt="" className="h-12 w-12 rounded-xl object-cover" />
            <div className="min-w-0">
              <h2 id="payment-title" className="truncate text-lg font-semibold">
                {t("buyTitle", { title: track.title })}
              </h2>
              <p className="truncate text-sm text-white/60">
                {track.album} · {t("lossless")}
              </p>
            </div>
          </div>

          {phase === "creating" &&
        <div className="flex flex-col items-center py-20 text-white/70" role="status">
              <Loader2Icon className="h-6 w-6 animate-spin" aria-hidden />
              <p className="mt-3 text-sm">{t("creatingOrder")}</p>
            </div>
        }

          {phase === "error" &&
        <div className="flex flex-col items-center py-16 text-center" role="alert">
              <AlertCircleIcon className="h-8 w-8 text-ember" aria-hidden />
              <p className="mt-3 max-w-sm text-white/75">{error}</p>
              <button type="button" onClick={createOrder} className="mt-6 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">
                {t("retry")}
              </button>
            </div>
        }

          {order && (phase === "ready" || phase === "confirming") &&
        <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-8">
              <div className="flex flex-col items-center">
                <div className="w-full max-w-[200px] rounded-3xl bg-white p-2.5 sm:max-w-[270px] sm:p-3">
                  <img src={order.qrUrl} alt={t("qrAlt", { price: formatPrice(order.amount) })} className="aspect-square w-full object-contain" />
                </div>
                <p className="mt-2.5 text-center text-xs text-white/60 sm:mt-3 sm:text-sm">{t("scanQr")}</p>
                {order.payUrl && (
                  <a
                    href={order.payUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white/90 transition-colors hover:bg-white/20 sm:mt-3">
                    Mở trang thanh toán ApiPay ↗
                  </a>
                )}
              </div>

              <div className="flex flex-col">
                <p className="text-xs text-white/60 sm:text-sm">{t("amount")}</p>
                <p className="text-2xl font-semibold tabular-nums text-ember sm:text-3xl">{formatPrice(order.amount)}</p>

                {order.status === "underpaid" && (order.shortfallAmount || 0) > 0 && (
                  <div className="mt-3 rounded-2xl border border-amber-400/40 bg-amber-400/15 p-3.5 text-xs leading-relaxed text-amber-200" role="alert">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                      <AlertCircleIcon className="h-4 w-4 shrink-0" />
                      <span>Phát hiện chuyển khoản thiếu!</span>
                    </div>
                    <p className="mt-1">
                      Đã nhận: <strong>{formatPrice(order.paidAmount || 0)}</strong> · Còn thiếu:{" "}
                      <strong className="text-white">{formatPrice(order.shortfallAmount || 0)}</strong>
                    </p>
                    <p className="mt-1 text-white/80">
                      Vui lòng chuyển thêm đúng <strong>{formatPrice(order.shortfallAmount || 0)}</strong> với nội dung{" "}
                      <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-ember">{order.transferNote}</code>{" "}
                      để hệ thống tự động cộng dồn và mở khóa tải nhạc.
                    </p>
                  </div>
                )}

                <dl className="mt-5 divide-y divide-white/10 border-y border-white/10">
                  <InfoRow label={t("bank")} value={order.bank.bankName} />
                  <InfoRow label={t("accountNo")} value={order.bank.accountNo} copyLabel={t("copy", { label: t("accountNo") })} />
                  <InfoRow label={t("accountName")} value={order.bank.accountName} />
                  <InfoRow label={t("transferNote")} value={order.transferNote} copyLabel={t("copy", { label: t("transferNote") })} highlight />
                </dl>

                <label className="mt-4 block">
                  <span className="text-sm text-white/60">Email nhận hóa đơn & file (không bắt buộc)</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="mt-1.5 w-full rounded-2xl bg-black/30 px-4 py-2.5 text-sm text-white ring-1 ring-inset ring-white/15 placeholder:text-white/35 focus:outline-none focus:ring-white/40" />
                </label>

                {error &&
                  <p className="mt-3 text-sm text-ember" role="alert">
                    {error}
                  </p>
                }

                {statusNote && !error &&
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-ember/15 px-3 py-2 text-xs text-ember" role="status">
                    <Loader2Icon className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                    <span>{statusNote}</span>
                  </div>
                }

                <button
                  type="button"
                  disabled={phase === "confirming"}
                  onClick={confirm}
                  className="mt-4 flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-transform duration-150 hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
                  {phase === "confirming" && <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />}
                  {phase === "confirming" ? "Đang kiểm tra..." : "Tôi đã chuyển khoản — Tải nhạc ngay"}
                </button>

                <div className="mt-3 rounded-2xl bg-white/[0.04] p-3 text-center ring-1 ring-inset ring-white/10">
                  <p className="text-xs text-white/70">
                    Gặp vấn đề khi thanh toán hoặc tải nhạc?
                  </p>
                  <p className="mt-1 text-xs font-medium text-ember">
                    Vui lòng liên hệ Zalo: <a href="https://zalo.me/0333025864" target="_blank" rel="noreferrer" className="underline hover:text-white">0333 025 864</a>
                  </p>
                </div>
              </div>
            </div>
        }
        </>
      }
    </>);

}

function InfoRow({ label, value, copyLabel, highlight }: {label: string;value: string;copyLabel?: string;highlight?: boolean;}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-sm text-white/60">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2">
        <span className={`truncate text-sm font-medium tabular-nums ${highlight ? "text-ember" : "text-white"}`}>{value}</span>
        {copyLabel &&
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copyLabel}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-150 hover:bg-white/20">
          
            {copied ? <CheckIcon className="h-3.5 w-3.5 text-ember" aria-hidden /> : <CopyIcon className="h-3.5 w-3.5" aria-hidden />}
          </button>
        }
      </dd>
    </div>);

}