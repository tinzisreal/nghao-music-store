import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircleIcon,
  CreditCardIcon,
  Loader2Icon,
  LockIcon,
  MailIcon,
  PhoneIcon,
  ShieldCheckIcon
} from "lucide-react";
import { Track } from "../types/track";
import { Order, PayPalConfig } from "../types/store";
import { api, errorMessage } from "../utils/api";
import { formatPrice, vndToUsdEstimate } from "../utils/format";

interface PayPalCardCheckoutProps {
  track: Track;
  email: string;
  onEmailChange: (email: string) => void;
  phone: string;
  onPhoneChange: (phone: string) => void;
  onSuccess: (orderData: Partial<Order>) => void;
  onError: (err: string) => void;
}

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: {
        style?: {
          layout?: "vertical" | "horizontal";
          color?: "gold" | "blue" | "silver" | "white" | "black";
          shape?: "rect" | "pill";
          label?: "paypal" | "checkout" | "buynow" | "pay";
          height?: number;
        };
        createOrder: (data: unknown, actions: unknown) => Promise<string>;
        onApprove: (data: { orderID: string; payerID?: string }, actions: unknown) => Promise<void>;
        onError?: (err: unknown) => void;
        onCancel?: (data: unknown) => void;
      }) => {
        render: (container: HTMLElement | string) => Promise<void>;
      };
    };
  }
}

function loadPayPalScript(clientId: string, currency = "USD"): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.paypal) {
      resolve();
      return;
    }
    const existing = document.getElementById("paypal-sdk-script") as HTMLScriptElement | null;
    if (existing) {
      if (existing.getAttribute("data-client-id") === clientId) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("Không thể tải PayPal SDK")));
        return;
      }
      existing.remove();
    }

    const script = document.createElement("script");
    script.id = "paypal-sdk-script";
    script.setAttribute("data-client-id", clientId);
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
      clientId
    )}&currency=${currency}&components=buttons&enable-funding=card`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Lỗi kết nối máy chủ PayPal SDK. Vui lòng kiểm tra kết nối mạng."));
    document.head.appendChild(script);
  });
}

let cachedPayPalConfig: PayPalConfig | null = null;

export function PayPalCardCheckout({
  track,
  email,
  onEmailChange,
  phone,
  onPhoneChange,
  onSuccess,
  onError
}: PayPalCardCheckoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadingConfig, setLoadingConfig] = useState(!cachedPayPalConfig);
  const [config, setConfig] = useState<PayPalConfig | null>(cachedPayPalConfig);
  const [sdkReady, setSdkReady] = useState(Boolean(typeof window !== "undefined" && window.paypal));
  const [processing, setProcessing] = useState(false);
  const [localError, setLocalError] = useState("");
  const activeOrderRef = useRef<string | null>(null);
  const renderedTrackIdRef = useRef<string | null>(null);

  const priceVnd = Math.max(0, Math.floor(Number(track.price) || 0));
  const priceUsd = vndToUsdEstimate(priceVnd);

  const emailRef = useRef(email);
  emailRef.current = email;

  const phoneRef = useRef(phone);
  phoneRef.current = phone;

  const trackRef = useRef(track);
  trackRef.current = track;

  const priceVndRef = useRef(priceVnd);
  priceVndRef.current = priceVnd;

  const priceUsdRef = useRef(priceUsd);
  priceUsdRef.current = priceUsd;

  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // 1. Lấy thông tin cấu hình PayPal từ server (chỉ chạy 1 lần khi mount)
  useEffect(() => {
    let mounted = true;

    const setupConfig = (cfg: PayPalConfig) => {
      setConfig(cfg);
      if (cfg.configured && cfg.clientId) {
        loadPayPalScript(cfg.clientId, cfg.currency || "USD")
          .then(() => {
            if (mounted) setSdkReady(true);
          })
          .catch((err) => {
            if (mounted) {
              const msg = errorMessage(err, "Không thể tải cổng thanh toán PayPal.");
              setLocalError(msg);
              onErrorRef.current?.(msg);
            }
          });
      }
    };

    if (cachedPayPalConfig) {
      setupConfig(cachedPayPalConfig);
      setLoadingConfig(false);
      return;
    }

    setLoadingConfig(true);
    setLocalError("");

    api
      .getPayPalConfig()
      .then((cfg) => {
        if (!mounted) return;
        cachedPayPalConfig = cfg;
        setupConfig(cfg);
      })
      .catch((err) => {
        if (mounted) {
          const msg = errorMessage(err, "Không thể kết nối dịch vụ thanh toán.");
          setLocalError(msg);
        }
      })
      .finally(() => {
        if (mounted) setLoadingConfig(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // 2. Render nút PayPal & Visa/Mastercard buttons (chỉ chạy khi SDK ready hoặc đổi track)
  useEffect(() => {
    if (!sdkReady || !window.paypal || !containerRef.current) return;

    // Không render lại nếu đã render cho đúng bài nhạc này rồi (tránh giật lag/flicker)
    if (renderedTrackIdRef.current === track.id && containerRef.current.children.length > 0) {
      return;
    }

    containerRef.current.innerHTML = "";
    renderedTrackIdRef.current = track.id;

    try {
      const buttons = window.paypal.Buttons({
        style: {
          layout: "vertical",
          color: "gold",
          shape: "rect",
          label: "pay",
          height: 44
        },
        createOrder: async () => {
          setLocalError("");
          const cleanEmail = emailRef.current.trim();
          if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            const errText = "Vui lòng nhập đúng địa chỉ Gmail của bạn trước khi bấm thanh toán để nhận file MP3 Full.";
            setLocalError(errText);
            throw new Error(errText);
          }
          const cleanPhone = phoneRef.current.trim();
          if (!cleanPhone || cleanPhone.replace(/[^0-9]/g, "").length < 9) {
            const errText = "Vui lòng nhập đúng số điện thoại (hoặc Zalo) để Nghao Producer liên hệ hỗ trợ bạn.";
            setLocalError(errText);
            throw new Error(errText);
          }

          setProcessing(true);
          try {
            const res = await api.createPayPalOrder(trackRef.current.id, cleanEmail, cleanPhone);
            activeOrderRef.current = res.orderId;
            return res.paypalOrderId;
          } catch (err) {
            setProcessing(false);
            const msg = errorMessage(err, "Không thể khởi tạo giao dịch thẻ Quốc tế.");
            setLocalError(msg);
            throw err;
          }
        },
        onApprove: async (data) => {
          setProcessing(true);
          setLocalError("");
          try {
            const currentOrderId = activeOrderRef.current || "";
            const cleanEmail = emailRef.current.trim();
            const cleanPhone = phoneRef.current.trim();
            const captureRes = await api.capturePayPalOrder(
              currentOrderId,
              data.orderID,
              cleanEmail,
              cleanPhone
            );

            onSuccessRef.current?.({
              id: captureRes.orderId || currentOrderId,
              status: "paid",
              email: captureRes.email || cleanEmail,
              phone: captureRes.phone || cleanPhone,
              paidAmount: priceVndRef.current,
              amountUsd: captureRes.amountUsd || priceUsdRef.current,
              paymentMethod: "paypal_card",
              transferNote: `NGHAO VISA ${currentOrderId.slice(-6).toUpperCase()}`
            });
          } catch (err) {
            const msg = errorMessage(err, "Xác nhận giao dịch thẻ thất bại. Vui lòng liên hệ hỗ trợ.");
            setLocalError(msg);
            onErrorRef.current?.(msg);
          } finally {
            setProcessing(false);
          }
        },
        onError: (err) => {
          setProcessing(false);
          console.error("PayPal button error:", err);
          const msg = "Đã xảy ra lỗi trong quá trình thanh toán thẻ. Vui lòng thử lại.";
          setLocalError(msg);
        },
        onCancel: () => {
          setProcessing(false);
        }
      });

      buttons.render(containerRef.current);
    } catch (err) {
      console.error("PayPal render error:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkReady, track.id]);

  if (loadingConfig) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-white/70">
        <Loader2Icon className="h-6 w-6 animate-spin text-ember" />
        <p className="mt-3 text-xs">Đang tải cổng thanh toán Quốc tế Visa / Mastercard...</p>
      </div>
    );
  }

  // Nếu chưa cấu hình Client ID (chưa kích hoạt)
  if (!config?.configured || !config.clientId) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-300">
          <CreditCardIcon className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-sm font-semibold text-white">Cổng Thẻ Quốc tế Visa / Mastercard</h3>
        <p className="mt-2 text-xs leading-relaxed text-white/70">
          Chủ shop đang trong quá trình kích hoạt Client ID PayPal quốc tế.
          Quý khách vui lòng chọn tab <strong>VietQR / Chuyển khoản</strong> hoặc liên hệ Zalo{" "}
          <a href="https://zalo.me/0333025864" target="_blank" rel="noreferrer" className="text-ember font-semibold underline">
            0333 025 864
          </a>{" "}
          để mua bản nhạc nhanh trong 30 giây!
        </p>

        <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-black/40 px-3 py-2 text-[11px] text-white/50">
          <LockIcon className="h-3 w-3 text-white/40" />
          <span>Hỗ trợ thẻ Visa, Mastercard, JCB, American Express & PayPal</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Box giá quy đổi quốc tế */}
      <div className="rounded-2xl border border-white/10 bg-black/40 p-3.5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-white/50 font-medium">Số tiền thanh toán</span>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-400 tabular-nums">${priceUsd} USD</span>
              <span className="text-xs text-white/50">~ {formatPrice(priceVnd)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/70">
            <ShieldCheckIcon className="h-3.5 w-3.5 text-emerald-400" />
            <span>SSL 256-bit</span>
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-2 border-t border-white/10 pt-2 text-[11px] text-white/50">
          <CreditCardIcon className="h-3.5 w-3.5 text-white/60" />
          <span>Chấp nhận: Visa, Mastercard, AMEX hoặc tài khoản PayPal</span>
        </div>
      </div>

      {/* Nhập Gmail & SĐT nhận nhạc trước khi quẹt thẻ */}
      <div className="space-y-3">
        <label className="block">
          <span className="flex items-center gap-1.5 text-xs font-medium text-white/85">
            <MailIcon className="h-3.5 w-3.5 text-ember" />
            <span>
              Gmail nhận bản nhạc Full MP3 <span className="text-ember">*</span>
            </span>
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="nhapgmailcuaban@gmail.com"
            className="mt-1.5 w-full rounded-2xl bg-black/35 px-4 py-2.5 text-base sm:text-sm text-white ring-1 ring-inset ring-white/20 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-ember"
          />
          <span className="mt-1 block text-[11px] text-white/50">
            Sau khi quẹt thẻ thành công, Nghao Producer sẽ gửi trực tiếp bản MP3 Full vào Gmail này của bạn.
          </span>
        </label>

        <label className="block">
          <span className="flex items-center gap-1.5 text-xs font-medium text-white/85">
            <PhoneIcon className="h-3.5 w-3.5 text-ember" />
            <span>
              Số điện thoại liên hệ (hoặc Zalo) <span className="text-ember">*</span>
            </span>
          </span>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="0333 025 864"
            className="mt-1.5 w-full rounded-2xl bg-black/35 px-4 py-2.5 text-base sm:text-sm text-white ring-1 ring-inset ring-white/20 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-ember"
          />
          <span className="mt-1 block text-[11px] text-white/50">
            Để Nghao Producer liên hệ hỗ trợ hoặc gửi file qua Zalo nếu cần thiết.
          </span>
        </label>
      </div>

      {localError && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <AlertCircleIcon className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{localError}</span>
        </div>
      )}

      {processing && (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-white/[0.05] p-3 text-xs text-white/80">
          <Loader2Icon className="h-4 w-4 animate-spin text-ember" />
          <span>Đang xử lý giao dịch qua cổng bảo mật...</span>
        </div>
      )}

      {/* Nơi PayPal SDK vẽ nút: Nút vàng PayPal + Nút đen Quẹt thẻ Visa/Mastercard (Debit or Credit Card) */}
      <div className="min-h-[96px]">
        {!sdkReady ? (
          <div className="flex flex-col items-center justify-center py-6 text-white/60">
            <Loader2Icon className="h-5 w-5 animate-spin text-ember" />
            <span className="mt-2 text-xs">Đang tải form quẹt thẻ Visa/Mastercard...</span>
          </div>
        ) : null}
        <div ref={containerRef} className={!sdkReady ? "hidden" : "space-y-2"} />
      </div>

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-white/40">
        <LockIcon className="h-3 w-3" />
        <span>Thanh toán trực tiếp qua PayPal Card Checkout · Không lưu thẻ</span>
      </div>
    </div>
  );
}
