import React, { useEffect, useState } from "react";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  EyeIcon,
  Loader2Icon,
  MailIcon,
  MusicIcon,
  SendIcon,
  SparklesIcon,
  XIcon
} from "lucide-react";
import { toast } from "sonner";
import { Track } from "../../types/track";
import { NewsletterStatus } from "../../types/store";
import { api, errorMessage } from "../../utils/api";
import { formatPrice } from "../../utils/format";

interface NewsletterBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: Track[];
  initialTrackId?: string;
  totalSubscribersCount?: number;
  onSuccess?: () => void;
}

export function NewsletterBroadcastModal({
  isOpen,
  onClose,
  tracks,
  initialTrackId,
  totalSubscribersCount = 0,
  onSuccess
}: NewsletterBroadcastModalProps) {
  const [selectedTrackId, setSelectedTrackId] = useState<string>(initialTrackId || tracks[0]?.id || "");
  const [customSubject, setCustomSubject] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [status, setStatus] = useState<NewsletterStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sentCount: number; message: string } | null>(null);

  useEffect(() => {
    if (initialTrackId) {
      setSelectedTrackId(initialTrackId);
    } else if (tracks.length > 0 && !selectedTrackId) {
      setSelectedTrackId(tracks[0].id);
    }
  }, [initialTrackId, tracks, selectedTrackId]);

  useEffect(() => {
    if (!isOpen) return;
    setSendResult(null);
    setLoadingStatus(true);
    api
      .getNewsletterStatus()
      .then((res) => setStatus(res))
      .catch(() => setStatus(null))
      .finally(() => setLoadingStatus(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId) || tracks[0];
  const targetSubscribersCount = status?.totalSubscribers ?? totalSubscribersCount;

  const defaultSubject = selectedTrack
    ? `🔥 [NGHAO Producer] Ra mắt bài nhạc mới: "${selectedTrack.title}"`
    : "🔥 [NGHAO Producer] Ra mắt bài nhạc mới!";

  const effectiveSubject = customSubject.trim() || defaultSubject;

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrack) {
      toast.error("Vui lòng chọn bài hát để gửi thông báo.");
      return;
    }

    if (targetSubscribersCount <= 0) {
      toast.error("Chưa có người đăng ký nhận thông báo nào trong danh sách.");
      return;
    }

    const confirmMsg = `Bạn có chắc chắn muốn gửi email thông báo tự động bài hát "${selectedTrack.title}" đến toàn bộ ${targetSubscribersCount} người đăng ký qua Resend?`;
    if (!window.confirm(confirmMsg)) {
      return;
    }

    setSending(true);
    setSendResult(null);

    try {
      const res = await api.broadcastNewsletter({
        trackId: selectedTrack.id,
        customSubject: customSubject.trim() || undefined,
        customMessage: customMessage.trim() || undefined
      });

      setSendResult({
        sentCount: res.sentCount,
        message: res.message
      });
      toast.success(res.message);
      onSuccess?.();
    } catch (err) {
      toast.error(errorMessage(err, "Không thể gửi email qua Resend lúc này."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-white/15 bg-[#121216] p-6 text-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
          <XIcon className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3.5 pr-8">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ember/20 text-ember ring-1 ring-ember/30">
            <SendIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold sm:text-xl text-white">
              Gửi Email thông báo bài mới (Resend API)
            </h2>
            <p className="mt-1 text-xs text-white/60">
              Tự động gửi email thông báo phát hành nhạc kèm ảnh bìa & link nghe thử đến toàn bộ người đăng ký.
            </p>
          </div>
        </div>

        {/* Resend Status Badge */}
        <div className="mt-4">
          {loadingStatus ? (
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Loader2Icon className="h-3.5 w-3.5 animate-spin text-ember" />
              <span>Đang kiểm tra kết nối Resend API…</span>
            </div>
          ) : status?.configured ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  <strong>Resend API đã kết nối</strong> · Người gửi: <code className="font-mono text-white/90">{status.senderEmail}</code>
                </span>
              </div>
              <span className="font-semibold text-white">
                {targetSubscribersCount} người nhận
              </span>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200 leading-relaxed">
              <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                <AlertCircleIcon className="h-4 w-4 shrink-0" />
                <span>Chưa cấu hình RESEND_API_KEY</span>
              </div>
              <p className="mt-1.5">
                Để tự động gửi email, bạn hãy đăng ký tài khoản miễn phí tại{" "}
                <a
                  href="https://resend.com"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-white underline hover:text-ember">
                  resend.com
                </a>{" "}
                (miễn phí 3.000 email/tháng), copy API Key (dạng <code className="font-mono bg-black/40 px-1 py-0.5 rounded">re_...</code>) và thêm vào file <code className="font-mono bg-black/40 px-1 py-0.5 rounded">.env</code> hoặc cấu hình Environment Variables trên server:
              </p>
              <div className="mt-2 rounded-xl bg-black/50 p-2 font-mono text-[11px] text-white/80 select-all">
                RESEND_API_KEY=re_your_api_key_here
              </div>
            </div>
          )}
        </div>

        {sendResult ? (
          <div className="mt-6 flex flex-col items-center py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30">
              <CheckCircle2Icon className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-white">Gửi thông báo thành công!</h3>
            <p className="mt-2 max-w-md text-xs text-white/70">
              Đã gửi thông báo bài hát <strong>{selectedTrack?.title}</strong> thành công tới{" "}
              <strong>{sendResult.sentCount}</strong> địa chỉ Gmail qua hệ thống Resend.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 rounded-full bg-white px-6 py-2.5 text-xs font-semibold text-black hover:bg-white/90 transition-colors">
              Đóng cửa sổ
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendBroadcast} className="mt-5 space-y-4">
            {/* Chọn bài hát */}
            <div>
              <label className="block text-xs font-medium text-white/80">
                Bài hát muốn thông báo <span className="text-ember">*</span>
              </label>
              <select
                value={selectedTrackId}
                onChange={(e) => setSelectedTrackId(e.target.value)}
                className="mt-1.5 w-full rounded-2xl bg-black/50 px-4 py-2.5 text-xs text-white ring-1 ring-inset ring-white/15 focus:outline-none focus:ring-2 focus:ring-ember">
                {tracks.map((t) => (
                  <option key={t.id} value={t.id} className="bg-[#121216] text-white">
                    {t.title} {Number(t.price) > 0 ? `(${formatPrice(t.price)})` : "(Miễn phí / Free)"} · {t.album || "Single"}
                  </option>
                ))}
              </select>
            </div>

            {/* Chi tiết bài hát đã chọn */}
            {selectedTrack && (
              <div className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                  {selectedTrack.cover ? (
                    <img src={selectedTrack.cover} alt={selectedTrack.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/30">
                      <MusicIcon className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-semibold text-white">{selectedTrack.title}</h4>
                  <p className="text-xs text-white/50">
                    {selectedTrack.artist || "Nghao Producer"} · {selectedTrack.genre || "Music"}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-emerald-400">
                    {Number(selectedTrack.price) > 0 ? formatPrice(selectedTrack.price) : "Miễn phí (Free Download)"}
                  </p>
                </div>
              </div>
            )}

            {/* Tiêu đề Email */}
            <div>
              <label className="block text-xs font-medium text-white/80">
                Tiêu đề Email (Subject)
              </label>
              <input
                type="text"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder={defaultSubject}
                className="mt-1.5 w-full rounded-2xl bg-black/50 px-4 py-2.5 text-xs text-white ring-1 ring-inset ring-white/15 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-ember"
              />
              <span className="mt-1 block text-[11px] text-white/40">
                Để trống để dùng tiêu đề mặc định: <code className="text-white/60">{defaultSubject}</code>
              </span>
            </div>

            {/* Lời nhắn kèm theo */}
            <div>
              <label className="block text-xs font-medium text-white/80">
                Lời nhắn riêng gửi người nghe (Tùy chọn)
              </label>
              <textarea
                rows={3}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Ví dụ: Cảm ơn anh em đã luôn theo dõi và ủng hộ Nghao Producer! Bài nhạc này mình đã dành rất nhiều tâm huyết hoàn thiện, mọi người bấm nghe thử nhé..."
                className="mt-1.5 w-full rounded-2xl bg-black/50 p-3 text-xs text-white ring-1 ring-inset ring-white/15 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-ember"
              />
            </div>

            {/* Nút bật/tắt xem trước Preview */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition-colors">
                <EyeIcon className="h-3.5 w-3.5 text-ember" />
                <span>{showPreview ? "Ẩn xem trước giao diện Email" : "Xem trước giao diện Email gửi khách"}</span>
              </button>

              {showPreview && selectedTrack && (
                <div className="mt-3 rounded-2xl border border-white/10 bg-[#0e0e12] p-4 text-xs">
                  <div className="border-b border-white/10 pb-2 mb-3">
                    <span className="text-white/40">Tiêu đề: </span>
                    <strong className="text-white">{effectiveSubject}</strong>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#16161c] p-4 max-w-md mx-auto text-center space-y-3">
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-ember/20 text-ember text-[10px] font-bold uppercase">
                      Bản phát hành mới
                    </span>
                    <h3 className="text-base font-bold text-white">NGHAO PRODUCER</h3>
                    {selectedTrack.cover && (
                      <img
                        src={selectedTrack.cover}
                        alt=""
                        className="w-full h-40 object-cover rounded-xl"
                      />
                    )}
                    <div className="text-left bg-black/40 p-3 rounded-xl">
                      <h4 className="text-sm font-bold text-white">{selectedTrack.title}</h4>
                      <p className="text-[11px] text-white/50">{selectedTrack.artist || "Nghao Producer"}</p>
                      <p className="mt-1 text-[11px] text-emerald-400 font-semibold">
                        {Number(selectedTrack.price) > 0 ? formatPrice(selectedTrack.price) : "MIỄN PHÍ"}
                      </p>
                      {customMessage && (
                        <p className="mt-2 text-white/80 text-[11px] border-l-2 border-ember pl-2 italic">
                          {customMessage}
                        </p>
                      )}
                    </div>
                    <div className="py-1">
                      <span className="inline-block bg-ember text-white px-5 py-2 rounded-full text-xs font-bold shadow-md shadow-ember/25">
                        🎧 Nghe bài hát ngay trên website ↗
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-white/10 px-5 py-2.5 text-xs font-medium text-white hover:bg-white/15 transition-colors">
                Hủy bỏ
              </button>

              <button
                type="submit"
                disabled={sending || targetSubscribersCount <= 0}
                className="inline-flex items-center gap-2 rounded-full bg-ember px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-ember/25 hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-50">
                {sending ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                ) : (
                  <SendIcon className="h-3.5 w-3.5" />
                )}
                <span>
                  {sending
                    ? "Đang gửi hàng loạt qua Resend..."
                    : `Gửi thông báo tới ${targetSubscribersCount} người đăng ký`}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
