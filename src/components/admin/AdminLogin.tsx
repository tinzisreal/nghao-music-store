import React, { useState } from "react";
import { Link } from "react-router-dom";
import { CheckIcon, CopyIcon, KeyRoundIcon, Loader2Icon, QrCodeIcon, ShieldCheckIcon, SmartphoneIcon } from "lucide-react";
import { toast } from "sonner";
import { TotpSetupInfo } from "../../types/store";
import { api, errorMessage, setAdminToken } from "../../utils/api";

interface AdminLoginProps {
  totpConfigured: boolean;
  totpSetup: TotpSetupInfo | null;
  onSuccess: () => void;
}

export function AdminLogin({ totpConfigured, totpSetup, onSuccess }: AdminLoginProps) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);

  const handleOtpChange = (val: string) => {
    const digitsOnly = val.replace(/\D/g, "").slice(0, 6);
    setOtp(digitsOnly);
  };

  const handleCopySecret = async () => {
    if (!totpSetup?.secret) return;
    try {
      await navigator.clipboard.writeText(totpSetup.secret);
      setCopiedSecret(true);
      window.setTimeout(() => setCopiedSecret(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.loginAdmin({ otp });
      setAdminToken(res.token);
      toast.success("Xác thực Google Authenticator thành công!");
      onSuccess();
    } catch (err) {
      setError(errorMessage(err, "Mã 6 số Google Authenticator không đúng hoặc đã hết hạn."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-[#0b0b0c] px-4 py-10 text-white">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-cover bg-center opacity-25 blur-xl"
        style={{ backgroundImage: 'url("/bg-custom.png")' }}
      />
      <div className="liquid-glass-strong relative z-10 w-full max-w-md rounded-[32px] p-6 md:p-8">
        <div className="flex flex-col items-center text-center">
          <img
            src="/logo-white.png"
            alt="NGHAO Music Producer"
            className="h-24 w-auto object-contain drop-shadow"
          />
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
            <ShieldCheckIcon className="h-3.5 w-3.5 text-ember" aria-hidden />
            Google Authenticator (2FA TOTP)
          </span>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            {totpConfigured ? "Đăng nhập Quản trị" : "Thiết lập Google Authenticator"}
          </h1>
          <p className="mt-1.5 text-sm text-white/60">
            {totpConfigured
              ? "Mở ứng dụng Google Authenticator trên điện thoại và nhập mã 6 chữ số để vào trang Admin."
              : "Quét mã QR bên dưới bằng ứng dụng Google Authenticator trên điện thoại để kích hoạt bảo mật lần đầu."}
          </p>
        </div>

        {/* Hiển thị mã QR cài đặt lần đầu nếu chưa kích hoạt */}
        {!totpConfigured && totpSetup && (
          <div className="mt-6 flex flex-col items-center rounded-3xl border border-white/15 bg-white/[0.04] p-4">
            <div className="rounded-2xl bg-white p-2.5 shadow-lg">
              <img
                src={totpSetup.qrUrl}
                alt="Mã QR Google Authenticator"
                className="h-44 w-44 object-contain"
              />
            </div>
            <p className="mt-3 text-center text-xs text-white/70">
              1. Mở app <strong>Google Authenticator</strong> &rarr; bấm dấu <strong>+</strong> &rarr; <strong>Quét mã QR</strong>
            </p>
            <div className="mt-2.5 flex w-full items-center justify-between gap-2 rounded-xl bg-black/40 px-3 py-2 text-xs ring-1 ring-inset ring-white/10">
              <div className="min-w-0">
                <span className="block text-[10px] uppercase tracking-wider text-white/45">
                  Hoặc nhập khóa thiết lập thủ công:
                </span>
                <code className="block truncate font-mono text-xs font-semibold text-ember">
                  {totpSetup.secret}
                </code>
              </div>
              <button
                type="button"
                onClick={handleCopySecret}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
                title="Sao chép khóa Base32">
                {copiedSecret ? <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> : <CopyIcon className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-amber-300/85">
              * Sau khi bạn nhập mã 6 số lần đầu thành công, mã QR này sẽ tự động ẩn đi để bảo mật.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="block text-center text-xs font-medium uppercase tracking-wider text-white/60">
              Mã 6 số từ Google Authenticator
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => handleOtpChange(e.target.value)}
              placeholder="000000"
              maxLength={6}
              autoFocus
              className="mt-2 w-full rounded-2xl bg-black/40 py-3.5 text-center font-mono text-2xl font-bold tracking-[0.5em] text-white ring-1 ring-inset ring-white/15 placeholder:tracking-[0.5em] placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-ember"
            />
          </label>

          {error && (
            <p className="rounded-xl bg-red-500/15 px-3.5 py-2.5 text-center text-xs text-red-300 ring-1 ring-red-500/30" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-ember px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-ember/25 transition-transform duration-150 hover:scale-[1.01] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden /> : <KeyRoundIcon className="h-4 w-4" aria-hidden />}
            <span>
              {loading
                ? "Đang xác thực..."
                : totpConfigured
                  ? "Xác nhận mã Google Authenticator"
                  : "Kích hoạt & Đăng nhập Admin"}
            </span>
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/50">
          <span className="inline-flex items-center gap-1">
            <QrCodeIcon className="h-3.5 w-3.5 text-ember" />
            TOTP 30s (RFC 6238)
          </span>
          <Link to="/" className="text-white/80 underline hover:text-white">
            ← Về trang cửa hàng
          </Link>
        </div>
      </div>
    </div>
  );
}
