import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Toaster, toast } from "sonner";
import {
  AlertCircleIcon,
  ArrowUpRightIcon,
  CheckIcon,
  CopyIcon,
  Loader2Icon,
  LogOutIcon,
  QrCodeIcon,
  RefreshCwIcon,
  XIcon
} from "lucide-react";
import { TrackManager } from "../components/admin/TrackManager";
import { AlbumManager } from "../components/admin/AlbumManager";
import { ProducerForm } from "../components/admin/ProducerForm";
import { NewReleasesManager } from "../components/admin/NewReleasesManager";
import { ContactForm } from "../components/admin/ContactForm";
import { ReconciliationManager } from "../components/admin/ReconciliationManager";
import { AdminLogin } from "../components/admin/AdminLogin";
import { useAdminStore } from "../hooks/useAdminStore";
import { TotpSetupInfo } from "../types/store";
import { api, clearAdminToken, errorMessage, setAdminToken } from "../utils/api";

type Tab = "tracks" | "albums" | "reconciliation" | "newReleases" | "producer" | "contact";

export function Admin() {
  const [authChecking, setAuthChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [totpConfigured, setTotpConfigured] = useState(false);
  const [totpSetup, setTotpSetup] = useState<TotpSetupInfo | null>(null);

  const checkAuth = useCallback(() => {
    setAuthChecking(true);
    api
      .checkAdminAuth()
      .then((res) => {
        setAuthenticated(res.authenticated);
        setTotpConfigured(res.totpConfigured);
        setTotpSetup(res.totpSetup);
      })
      .catch(() => {
        setAuthenticated(false);
      })
      .finally(() => {
        setAuthChecking(false);
      });
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogout = () => {
    clearAdminToken();
    setAuthenticated(false);
    toast.success("Đã khóa trang Quản trị.");
    checkAuth();
  };

  if (authChecking) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#0b0b0c] text-white/60">
        <Toaster theme="dark" position="top-center" richColors />
        <Loader2Icon className="h-6 w-6 animate-spin" aria-hidden />
        <span className="ml-3 text-sm">Đang kiểm tra xác thực Google Authenticator…</span>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <>
        <Toaster theme="dark" position="top-center" richColors />
        <AdminLogin
          totpConfigured={totpConfigured}
          totpSetup={totpSetup}
          onSuccess={() => checkAuth()}
        />
      </>
    );
  }

  return (
    <AdminDashboard
      totpSetup={totpSetup}
      onUpdateTotpSetup={setTotpSetup}
      onLogout={handleLogout}
    />
  );
}

function AdminDashboard({
  totpSetup,
  onUpdateTotpSetup,
  onLogout
}: {
  totpSetup: TotpSetupInfo | null;
  onUpdateTotpSetup: (setup: TotpSetupInfo | null) => void;
  onLogout: () => void;
}) {
  const admin = useAdminStore();
  const [tab, setTab] = useState<Tab>("tracks");
  const [showQrModal, setShowQrModal] = useState(false);
  const [resettingQr, setResettingQr] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const { state } = admin;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "tracks", label: "Bài hát", count: state.status === "ready" ? state.data.tracks.length : undefined },
    { id: "albums", label: "Album", count: state.status === "ready" ? state.data.albums?.length || 0 : undefined },
    { id: "reconciliation", label: "Đối soát giao dịch" },
    {
      id: "newReleases",
      label: "Mới phát hành",
      count: state.status === "ready" ? state.data.sections.newReleases.trackIds.length : undefined
    },
    { id: "producer", label: "Producer" },
    { id: "contact", label: "Liên hệ" }
  ];

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

  const handleResetQr = async () => {
    if (!window.confirm("Tạo mã QR Google Authenticator mới? Mã cũ trên điện thoại sẽ không còn hiệu lực.")) return;
    setResettingQr(true);
    try {
      const res = await api.resetTotpSecret();
      setAdminToken(res.token);
      onUpdateTotpSetup(res.totpSetup);
      toast.success("Đã tạo mã QR Google Authenticator mới! Hãy quét lại trên điện thoại.");
    } catch (err) {
      toast.error(errorMessage(err, "Không thể tạo lại mã QR."));
    } finally {
      setResettingQr(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0b0b0c] font-sans text-white">
      <Toaster theme="dark" position="top-center" richColors />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b0b0c]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pt-4 md:px-8">
          <div className="flex items-center gap-3">
            <img src="/logo-mark-white.png" alt="NGHAO Logo" className="h-10 w-10 object-contain" />
            <div>
              <p className="text-xs text-white/50">Quản trị cửa hàng · Google Authenticator</p>
              <h1 className="text-lg font-semibold">{state.status === "ready" ? state.data.producer.name : "…"}</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3.5 py-2 text-xs font-medium text-white/85 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10">
              <QrCodeIcon className="h-3.5 w-3.5 text-ember" aria-hidden />
              <span>Mã QR Google Authenticator</span>
            </button>

            <Link
              to="/"
              className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-4 py-2 text-sm text-white ring-1 ring-inset ring-white/10 transition-colors duration-150 hover:bg-white/10">
              Xem cửa hàng
              <ArrowUpRightIcon className="h-4 w-4" aria-hidden />
            </Link>

            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3.5 py-2 text-sm text-white/75 ring-1 ring-inset ring-white/10 transition-colors hover:bg-red-500/20 hover:text-red-300"
              title="Khóa trang quản trị">
              <LogOutIcon className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Khóa</span>
            </button>
          </div>
        </div>

        <nav aria-label="Mục quản trị" className="mx-auto mt-3 flex max-w-6xl gap-1 overflow-x-auto px-4 md:px-8" role="tablist">
          {tabs.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`relative whitespace-nowrap px-3 pb-3 pt-1 text-sm transition-colors duration-150 ${
                  active ? "text-white" : "text-white/50 hover:text-white/80"
                }`}>
                {t.label}
                {t.count !== undefined && <span className="ml-1.5 tabular-nums text-white/40">{t.count}</span>}
                {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-white" />}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
        {state.status === "loading" && (
          <div className="flex items-center justify-center py-24 text-white/60" role="status">
            <Loader2Icon className="h-6 w-6 animate-spin" aria-hidden />
            <span className="ml-3 text-sm">Đang tải…</span>
          </div>
        )}

        {state.status === "error" && (
          <div className="mx-auto max-w-md rounded-3xl border border-white/10 p-8 text-center" role="alert">
            <AlertCircleIcon className="mx-auto h-8 w-8 text-ember" aria-hidden />
            <p className="mt-3 text-white/75">{state.error}</p>
            <button type="button" onClick={admin.retry} className="mt-5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">
              Thử lại
            </button>
          </div>
        )}

        {state.status === "ready" && (
          <>
            {tab === "tracks" && (
              <TrackManager
                tracks={state.data.tracks}
                albums={state.data.albums || []}
                onSave={admin.saveTrack}
                onPatch={admin.patchTrack}
                onDelete={admin.deleteTrack}
              />
            )}
            {tab === "albums" && (
              <AlbumManager
                albums={state.data.albums || []}
                tracks={state.data.tracks}
                onSave={admin.saveAlbum}
                onDelete={admin.deleteAlbum}
              />
            )}
            {tab === "reconciliation" && <ReconciliationManager />}
            {tab === "newReleases" && (
              <NewReleasesManager tracks={state.data.tracks} sections={state.data.sections} onSave={admin.saveSections} />
            )}
            {tab === "producer" && <ProducerForm producer={state.data.producer} onSave={admin.saveProducer} />}
            {tab === "contact" && <ContactForm info={state.data.info} onSave={admin.saveInfo} />}
          </>
        )}
      </main>

      {/* Modal xem lại / đổi mã QR Google Authenticator */}
      {showQrModal && totpSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowQrModal(false)} aria-hidden />
          <div className="liquid-glass-strong relative z-10 w-full max-w-md rounded-[32px] p-6 text-white">
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
              <XIcon className="h-4 w-4" />
            </button>

            <h3 className="text-lg font-semibold">Cấu hình Google Authenticator</h3>
            <p className="mt-1 text-xs text-white/60">
              Quét mã QR này trên ứng dụng <strong>Google Authenticator</strong> để lấy mã 6 số đăng nhập Admin.
            </p>

            <div className="mt-5 flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="rounded-2xl bg-white p-2.5">
                <img src={totpSetup.qrUrl} alt="Google Authenticator QR" className="h-44 w-44 object-contain" />
              </div>

              <div className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl bg-black/40 px-3 py-2 text-xs ring-1 ring-inset ring-white/10">
                <div className="min-w-0">
                  <span className="block text-[10px] uppercase tracking-wider text-white/45">Khóa Base32:</span>
                  <code className="block truncate font-mono text-xs font-semibold text-ember">{totpSetup.secret}</code>
                </div>
                <button
                  type="button"
                  onClick={handleCopySecret}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20">
                  {copiedSecret ? <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> : <CopyIcon className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={resettingQr}
                onClick={handleResetQr}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white/80 hover:bg-white/20 disabled:opacity-50">
                <RefreshCwIcon className={`h-3.5 w-3.5 ${resettingQr ? "animate-spin" : ""}`} />
                <span>Tạo khóa QR mới</span>
              </button>

              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="rounded-full bg-ember px-5 py-2 text-xs font-semibold text-white">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}