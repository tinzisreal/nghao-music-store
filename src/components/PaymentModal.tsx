import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CheckIcon,
  CopyIcon,
  CreditCardIcon,
  DownloadIcon,
  Loader2Icon,
  MailIcon,
  QrCodeIcon,
  SendIcon,
  XIcon
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { Track } from "../types/track";
import { Order } from "../types/store";
import { api, errorMessage } from "../utils/api";
import { formatPrice, vndToUsdEstimate } from "../utils/format";
import { PayPalCardCheckout } from "./PayPalCardCheckout";

interface PaymentModalProps {
  track: Track | null;
  onClose: () => void;
}

const EASE = [0.23, 1, 0.32, 1] as const;

export function PaymentModal({ track, onClose }: PaymentModalProps) {
  return (
    <AnimatePresence>
      {track && (
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
      )}
    </AnimatePresence>
  );
}

type Phase = "creating" | "ready" | "confirming" | "done" | "error";

function PaymentContent({ track, onClose }: { track: Track; onClose: () => void }) {
  const { t } = useLanguage();
  const trackPrice = Math.max(0, Math.floor(Number(track?.price) || 0));
  const isFreeTrack = trackPrice <= 0;
  const freeDownloadUrl = api.getFreeDownloadUrl(track.id);

  const [phase, setPhase] = useState<Phase>(isFreeTrack ? "done" : "creating");
  const [method, setMethod] = useState<"vietqr" | "card">("vietqr");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [email, setEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState("");

  // Đối với các bài nhạc Miễn phí (price <= 0), tự động tải file MP3 Full ngay khi mở
  useEffect(() => {
    if (!isFreeTrack) return;
    const timer = window.setTimeout(() => {
      const link = document.createElement("a");
      link.href = freeDownloadUrl;
      link.download = `${track.title} - NGHAO Free.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [isFreeTrack, freeDownloadUrl, track.title]);

  const createOrder = useCallback(() => {
    if (isFreeTrack) return;
    setPhase("creating");
    setError("");
    setStatusNote("");
    const redirectUrl = typeof window !== "undefined" ? window.location.origin : undefined;
    api
      .createOrder(track.id, redirectUrl)
      .then((o) => {
        setOrder(o);
        if (o.email) setEmail(o.email);
        if (o.status === "paid") {
          setPhase("done");
        } else {
          setPhase("ready");
        }
      })
      .catch((err: unknown) => {
        setError(errorMessage(err, t("orderError")));
        setPhase("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.id, isFreeTrack]);

  useEffect(() => createOrder(), [createOrder]);

  // Tự động kiểm tra trạng thái đơn hàng từ webhook ApiPay (transaction.in) mỗi 3 giây
  useEffect(() => {
    if (isFreeTrack || !order || phase !== "ready") return;
    const timer = window.setInterval(() => {
      api
        .getOrder(order.id)
        .then((updated) => {
          if (updated.status === "paid") {
            setOrder(updated);
            setPhase("done");
            const cleanMail = email.trim();
            if (cleanMail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanMail)) {
              api
                .confirmOrder(updated.id, cleanMail)
                .then((res) => {
                  setOrder((prev) => (prev ? { ...prev, email: res.email || cleanMail } : prev));
                  setEmailFeedback(
                    `Đã lưu Gmail nhận nhạc (${cleanMail}). Nghao Producer sẽ gửi bản MP3 Full qua Gmail của bạn ngay sau khi đối soát!`
                  );
                })
                .catch(() => {});
            }
          } else if (
            updated.status === "underpaid" &&
            (updated.paidAmount !== order.paidAmount || order.status !== "underpaid")
          ) {
            setOrder(updated);
          }
        })
        .catch(() => {
          /* ignore background polling errors */
        });
    }, 3000);

    return () => window.clearInterval(timer);
  }, [isFreeTrack, order, phase, email]);

  const confirm = () => {
    if (!order) return;
    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Vui lòng nhập đúng địa chỉ Gmail để Nghao Producer gửi file MP3 Full sau khi thanh toán.");
      return;
    }
    setPhase("confirming");
    setError("");
    setStatusNote("");
    api
      .confirmOrder(order.id, cleanEmail)
      .then((res) => {
        if (res?.status === "paid") {
          setOrder((prev) =>
            prev
              ? {
                  ...prev,
                  status: "paid",
                  email: res.email || cleanEmail,
                  emailSentAt: res.emailSentAt || prev.emailSentAt,
                  paidAmount: res.paidAmount ?? prev.paidAmount,
                  overpaidAmount: res.overpaidAmount ?? prev.overpaidAmount,
                  shortfallAmount: 0,
                  paymentResolution: res.paymentResolution ?? prev.paymentResolution
                }
              : prev
          );
          setEmailFeedback(
            `Đã ghi nhận Gmail nhận nhạc (${cleanEmail}). Nghao Producer sẽ kiểm tra đối soát và gửi bản nhạc Full qua Gmail của bạn!`
          );
          setPhase("done");
        } else {
          if (res?.status === "underpaid") {
            setOrder((prev) =>
              prev
                ? {
                    ...prev,
                    email: cleanEmail,
                    status: "underpaid",
                    paidAmount: res.paidAmount ?? prev.paidAmount,
                    shortfallAmount: res.shortfallAmount ?? prev.shortfallAmount,
                    paymentResolution: "underpaid"
                  }
                : prev
            );
          } else {
            setOrder((prev) => (prev ? { ...prev, email: cleanEmail } : prev));
          }
          setStatusNote(
            `Đã lưu Gmail (${cleanEmail}). Hệ thống đang chờ ngân hàng xác nhận giao dịch chuyển khoản...`
          );
          setPhase("ready");
        }
      })
      .catch((err: unknown) => {
        setError(errorMessage(err, t("confirmError")));
        setPhase("ready");
      });
  };

  const handleSaveEmailOnDone = () => {
    if (!order) return;
    const cleanEmail = email.trim() || order.email || "";
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Vui lòng nhập đúng địa chỉ Gmail để nhận file MP3 Full.");
      return;
    }
    setSendingEmail(true);
    setError("");
    api
      .confirmOrder(order.id, cleanEmail)
      .then((res) => {
        setOrder((prev) =>
          prev ? { ...prev, email: res.email || cleanEmail, emailSentAt: res.emailSentAt || prev.emailSentAt } : prev
        );
        setEmailFeedback(
          `Đã cập nhật Gmail nhận nhạc: ${cleanEmail}. Nghao Producer sẽ gửi file MP3 Full qua Gmail này cho bạn!`
        );
      })
      .catch((err: unknown) => {
        setError(errorMessage(err, "Không thể cập nhật Gmail lúc này."));
      })
      .finally(() => {
        setSendingEmail(false);
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

  if (isFreeTrack) {
    return (
      <>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-150 hover:bg-white/20">
          <XIcon className="h-4 w-4" aria-hidden />
        </button>

        <div className="flex flex-col items-center px-3 py-8 text-center sm:px-6 sm:py-10">
          <img
            src={track.cover}
            alt=""
            className="h-20 w-20 rounded-2xl object-cover shadow-lg ring-1 ring-white/15"
          />
          <span className="mt-3 inline-flex items-center rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
            Bài hát Miễn phí · Tự động nhận file
          </span>
          <h2 id="payment-title" className="mt-3 text-xl font-semibold sm:text-2xl">
            {track.title}
          </h2>
          <p className="mt-1.5 max-w-md text-xs text-white/70 sm:text-sm">
            Hệ thống đang tự động tải file MP3 Full miễn phí về thiết bị của bạn. Nếu trình duyệt chưa tự tải, hãy bấm nút bên dưới:
          </p>

          <a
            href={freeDownloadUrl}
            download={`${track.title} - NGHAO Free.mp3`}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-ember px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-ember/25 transition-transform duration-150 hover:scale-105 active:scale-95">
            <DownloadIcon className="h-4 w-4" aria-hidden />
            <span>Tải ngay bản MP3 Full ({track.title})</span>
          </a>

          <button
            type="button"
            onClick={onClose}
            className="mt-5 rounded-full bg-white/10 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/20">
            {t("backToMusic")}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={onClose}
        aria-label={t("close")}
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-150 hover:bg-white/20">
        <XIcon className="h-4 w-4" aria-hidden />
      </button>

      {phase === "done" ? (
        <div className="flex flex-col items-center px-3 py-8 text-center sm:px-6 sm:py-10">
          <CheckCircle2Icon className="h-12 w-12 text-ember" aria-hidden />
          <h2 id="payment-title" className="mt-4 text-2xl font-semibold">
            {t("thanks")}
          </h2>
          <p className="mt-2 max-w-md text-sm text-white/75">
            Thanh toán bài hát <strong>{track.title}</strong>
            {order?.paymentMethod === "paypal_card" ? (
              <>
                {" "}qua <strong>Thẻ Quốc tế (Visa / Mastercard)</strong> (Số tiền:{" "}
                <span className="font-semibold text-emerald-400">
                  ${order.amountUsd || vndToUsdEstimate(track.price)} USD
                </span>
                )
              </>
            ) : (
              <>
                {" "}(Mã đơn:{" "}
                <code className="font-mono font-semibold text-ember">{order?.transferNote}</code>)
              </>
            )}{" "}
            đã được xác nhận thành công!
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

          {/* Hộp thông báo nhận file MP3 Full qua Gmail */}
          <div className="mt-5 w-full max-w-md rounded-3xl border border-ember/35 bg-ember/[0.08] p-5 text-left">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ember/20 text-ember">
                <MailIcon className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-white">Nhận bản nhạc Full qua Gmail</h3>
                <p className="mt-1 text-xs leading-relaxed text-white/70">
                  Đối với bài nhạc có phí, <strong>Nghao Producer</strong> sẽ kiểm tra đơn hàng và gửi trực tiếp file nhạc gốc chất lượng cao qua Gmail của bạn.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-white/70">Gmail nhận file nhạc của bạn</label>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nhapgmailcuaban@gmail.com"
                  className="flex-1 rounded-2xl bg-black/40 px-4 py-2.5 text-sm text-white ring-1 ring-inset ring-white/15 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-ember"
                />
                <button
                  type="button"
                  disabled={sendingEmail}
                  onClick={handleSaveEmailOnDone}
                  className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-ember px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-ember/25 transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                  {sendingEmail ? (
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                  ) : (
                    <SendIcon className="h-3.5 w-3.5" />
                  )}
                  <span>{order?.email ? "Cập nhật Gmail" : "Xác nhận Gmail"}</span>
                </button>
              </div>
            </div>

            {emailFeedback && (
              <p className="mt-3 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs text-emerald-300">{emailFeedback}</p>
            )}
            {!emailFeedback && order?.email && (
              <p className="mt-3 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs text-emerald-300">
                ✓ Đã ghi nhận Gmail <strong>{order.email}</strong>. Nghao Producer sẽ gửi file nhạc vào Gmail này cho bạn!
              </p>
            )}

            {error && (
              <p className="mt-3 text-xs text-ember" role="alert">
                {error}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-6 rounded-full bg-white/10 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/20">
            {t("backToMusic")}
          </button>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-white/55">
            <span>Hỗ trợ nhận file nhanh:</span>
            <a
              href="https://www.facebook.com/nghao205/"
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-white/[0.06] px-3 py-1 font-medium text-white/85 hover:bg-white/15">
              Facebook
            </a>
            <a
              href="https://www.tiktok.com/@nghao.wav"
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-white/[0.06] px-3 py-1 font-medium text-white/85 hover:bg-white/15">
              TikTok
            </a>
            <a
              href="https://zalo.me/0333025864"
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-ember/20 px-3 py-1 font-medium text-ember hover:bg-ember/30">
              Zalo 0333 025 864
            </a>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 pr-10">
            <img src={track.cover} alt="" className="h-12 w-12 rounded-xl object-cover" />
            <div className="min-w-0">
              <h2 id="payment-title" className="truncate text-lg font-semibold">
                {t("buyTitle", { title: track.title })}
              </h2>
              <p className="truncate text-sm text-white/60">{track.album} · Gửi file Full qua Gmail</p>
            </div>
          </div>

          {/* Tabs chọn phương thức: VietQR vs Visa/Mastercard */}
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-black/40 p-1 ring-1 ring-inset ring-white/10">
            <button
              type="button"
              onClick={() => {
                setMethod("vietqr");
                setError("");
              }}
              className={`flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-semibold transition-all ${
                method === "vietqr"
                  ? "bg-white text-black shadow-md"
                  : "text-white/70 hover:text-white hover:bg-white/[0.06]"
              }`}>
              <QrCodeIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">VietQR / Ngân hàng (VN)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMethod("card");
                setError("");
              }}
              className={`flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-semibold transition-all ${
                method === "card"
                  ? "bg-white text-black shadow-md"
                  : "text-white/70 hover:text-white hover:bg-white/[0.06]"
              }`}>
              <CreditCardIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Visa / Mastercard (Quốc tế)</span>
            </button>
          </div>

          {method === "card" ? (
            <div className="mt-5">
              <PayPalCardCheckout
                track={track}
                email={email}
                onEmailChange={setEmail}
                onSuccess={(paidData) => {
                  setOrder((prev) => ({ ...(prev || {}), ...paidData } as Order));
                  setPhase("done");
                }}
                onError={(err) => setError(err)}
              />
            </div>
          ) : (
            <>
              {phase === "creating" && (
                <div className="flex flex-col items-center py-20 text-white/70" role="status">
                  <Loader2Icon className="h-6 w-6 animate-spin" aria-hidden />
                  <p className="mt-3 text-sm">{t("creatingOrder")}</p>
                </div>
              )}

              {phase === "error" && (
                <div className="flex flex-col items-center py-16 text-center" role="alert">
                  <AlertCircleIcon className="h-8 w-8 text-ember" aria-hidden />
                  <p className="mt-3 max-w-sm text-white/75">{error}</p>
                  <button
                    type="button"
                    onClick={createOrder}
                    className="mt-6 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">
                    {t("retry")}
                  </button>
                </div>
              )}

              {order && (phase === "ready" || phase === "confirming") && (
                <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-8">
                  <div className="flex flex-col items-center">
                    <div className="w-full max-w-[200px] rounded-3xl bg-white p-2.5 sm:max-w-[270px] sm:p-3">
                      <img
                        src={order.qrUrl}
                        alt={t("qrAlt", { price: formatPrice(order.amount) })}
                        className="aspect-square w-full object-contain"
                      />
                    </div>
                    <p className="mt-2.5 text-center text-xs text-white/60 sm:mt-3 sm:text-sm">{t("scanQr")}</p>
                    {order.payUrl && (
                      <a
                        href={order.payUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white/90 transition-colors hover:bg-white/20 sm:mt-3">
                        Mở cổng thanh toán bảo mật ↗
                      </a>
                    )}
                  </div>

                  <div className="flex flex-col">
                    <p className="text-xs text-white/60 sm:text-sm">{t("amount")}</p>
                    <p className="text-2xl font-semibold tabular-nums text-ember sm:text-3xl">
                      {formatPrice(order.amount)}
                    </p>

                    {order.status === "underpaid" && (order.shortfallAmount || 0) > 0 && (
                      <div
                        className="mt-3 rounded-2xl border border-amber-400/40 bg-amber-400/15 p-3.5 text-xs leading-relaxed text-amber-200"
                        role="alert">
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
                          <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-ember">
                            {order.transferNote}
                          </code>{" "}
                          để hệ thống tự động cộng dồn và gửi nhạc qua Gmail.
                        </p>
                      </div>
                    )}

                    <dl className="mt-5 divide-y divide-white/10 border-y border-white/10">
                      <InfoRow label={t("bank")} value={order.bank?.bankName || "MBBank"} />
                      <InfoRow
                        label={t("accountNo")}
                        value={order.bank?.accountNo || ""}
                        copyLabel={t("copy", { label: t("accountNo") })}
                      />
                      <InfoRow label={t("accountName")} value={order.bank?.accountName || ""} />
                      <InfoRow
                        label={t("transferNote")}
                        value={order.transferNote}
                        copyLabel={t("copy", { label: t("transferNote") })}
                        highlight
                      />
                    </dl>

                    <label className="mt-4 block">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-white/85 sm:text-sm">
                        <MailIcon className="h-3.5 w-3.5 text-ember" aria-hidden />
                        <span>
                          Gmail nhận bản nhạc MP3 Full <span className="text-ember">*</span>
                        </span>
                      </span>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nhapgmailcuaban@gmail.com"
                        className="mt-1.5 w-full rounded-2xl bg-black/35 px-4 py-2.5 text-sm text-white ring-1 ring-inset ring-white/20 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-ember"
                      />
                      <span className="mt-1 block text-[11px] text-white/50">
                        Sau khi chuyển khoản thành công, Nghao Producer sẽ gửi bản MP3 Full vào Gmail này của bạn.
                      </span>
                    </label>

                    {error && (
                      <p className="mt-3 text-sm text-ember" role="alert">
                        {error}
                      </p>
                    )}

                    {statusNote && !error && (
                      <div
                        className="mt-3 flex items-center gap-2 rounded-xl bg-ember/15 px-3 py-2 text-xs text-ember"
                        role="status">
                        <Loader2Icon className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                        <span>{statusNote}</span>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={phase === "confirming"}
                      onClick={confirm}
                      className="mt-4 flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-transform duration-150 hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
                      {phase === "confirming" && <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />}
                      {phase === "confirming"
                        ? "Đang kiểm tra & lưu Gmail..."
                        : "Tôi đã chuyển khoản — Đăng ký Gmail nhận nhạc"}
                    </button>

                    <div className="mt-3 rounded-2xl bg-white/[0.04] p-3 text-center ring-1 ring-inset ring-white/10">
                      <p className="text-xs text-white/70">Gặp vấn đề khi thanh toán hoặc nhận Gmail? Liên hệ ngay:</p>
                      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-3 text-xs font-medium">
                        <a
                          href="https://zalo.me/0333025864"
                          target="_blank"
                          rel="noreferrer"
                          className="text-ember underline hover:text-white">
                          Zalo: 0333 025 864
                        </a>
                        <span className="text-white/25">·</span>
                        <a
                          href="https://www.facebook.com/nghao205/"
                          target="_blank"
                          rel="noreferrer"
                          className="text-white/85 underline hover:text-ember">
                          Facebook
                        </a>
                        <span className="text-white/25">·</span>
                        <a
                          href="https://www.tiktok.com/@nghao.wav"
                          target="_blank"
                          rel="noreferrer"
                          className="text-white/85 underline hover:text-ember">
                          TikTok
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

function InfoRow({
  label,
  value,
  copyLabel,
  highlight
}: {
  label: string;
  value: string;
  copyLabel?: string;
  highlight?: boolean;
}) {
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
        <span className={`truncate text-sm font-medium tabular-nums ${highlight ? "text-ember" : "text-white"}`}>
          {value}
        </span>
        {copyLabel && (
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copyLabel}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-150 hover:bg-white/20">
            {copied ? (
              <CheckIcon className="h-3.5 w-3.5 text-ember" aria-hidden />
            ) : (
              <CopyIcon className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        )}
      </dd>
    </div>
  );
}