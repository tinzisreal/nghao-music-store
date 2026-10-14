import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2Icon, PauseIcon, PlayIcon, RepeatIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Field, inputClass } from "./Field";
import { FileUpload } from "./FileUpload";
import { Track, TrackInput } from "../../types/track";
import { Album } from "../../types/album";
import { formatTime, parseTime } from "../../utils/format";
import { errorMessage, MEDIA_PROXY_BASE } from "../../utils/api";
import { MAX_FEATURED } from "../../data/sections";

interface TrackEditorProps {
  open: boolean;
  track: Track | null; // null = new track
  genres: string[];
  albums?: Album[];
  featuredFull: boolean; // featured limit reached by other tracks
  onClose: () => void;
  onSave: (input: TrackInput, id?: string) => Promise<unknown>;
}

const EASE = [0.23, 1, 0.32, 1] as const;

export function TrackEditor({ open, track, genres, albums = [], featuredFull, onClose, onSave }: TrackEditorProps) {
  return (
    <AnimatePresence>
      {open &&
      <motion.div
        className="fixed inset-0 z-50 flex justify-end"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: EASE }}>
        
          <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
          <motion.aside
          role="dialog"
          aria-modal="true"
          aria-labelledby="track-editor-title"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ duration: 0.26, ease: EASE }}
          className="relative flex h-full w-full max-w-xl flex-col border-l border-white/10 bg-[#121214] text-white">
          
            <EditorForm key={track?.id ?? "new"} track={track} genres={genres} albums={albums} featuredFull={featuredFull} onClose={onClose} onSave={onSave} />
          </motion.aside>
        </motion.div>
      }
    </AnimatePresence>);

}

type Errors = Partial<Record<"cover" | "title" | "album" | "genre" | "price" | "duration", string>>;

function EditorForm({ track, genres, albums = [], featuredFull, onClose, onSave }: Omit<TrackEditorProps, "open">) {
  const [cover, setCover] = useState<string | undefined>(track?.cover);
  const [audioUrl, setAudioUrl] = useState<string | undefined>(track?.audioUrl);
  const [fullAudioUrl, setFullAudioUrl] = useState<string | undefined>(track?.fullAudioUrl);
  const [title, setTitle] = useState(track?.title ?? "");
  const [albumId, setAlbumId] = useState<string>(track?.albumId ?? "");
  const [album, setAlbum] = useState(track?.album ?? "");
  const [genre, setGenre] = useState(track?.genre ?? "");
  const [price, setPrice] = useState(track ? String(track.price) : "");
  const [duration, setDuration] = useState(track ? formatTime(track.duration) : "");
  const [demoStart, setDemoStart] = useState<number>(track?.demoStart ?? 0);
  const [demoEnd, setDemoEnd] = useState<number>(track?.demoEnd ?? (track?.duration ?? 60));
  const [featured, setFeatured] = useState(!!track?.featured);
  const [isPreorder, setIsPreorder] = useState(!!track?.isPreorder);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const durationSec = parseTime(duration) || 180;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPriceDigits = price.replace(/\D/g, "");
    const priceNum = cleanPriceDigits === "" ? NaN : Number(cleanPriceDigits);
    const seconds = parseTime(duration) || (isPreorder ? 300 : 0);
    const next: Errors = {};
    if (!cover) next.cover = "Cần ảnh bìa.";
    if (!title.trim()) next.title = "Nhập tên bài.";
    // Album không bắt buộc, nếu trống sẽ hiển thị là Single / Bài lẻ
    if (!genre.trim()) next.genre = "Nhập thể loại.";
    if (Number.isNaN(priceNum) || priceNum < 0) next.price = "Nhập giá hợp lệ (nhập 0 nếu là bài Miễn phí).";
    if (!isPreorder && (!seconds || seconds <= 0)) next.duration = "Định dạng phút:giây, ví dụ 3:45.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const selectedAlbum = albums.find((a) => a.id === albumId);
      const finalAlbumTitle = selectedAlbum ? selectedAlbum.title : (album.trim() || "Single");

      await onSave(
        {
          cover: cover!,
          audioUrl: isPreorder ? undefined : audioUrl,
          fullAudioUrl: isPreorder ? undefined : (fullAudioUrl || audioUrl),
          demoStart: isPreorder ? 0 : demoStart,
          demoEnd: isPreorder ? (seconds || 300) : (demoEnd > demoStart ? demoEnd : seconds!),
          title: title.trim(),
          albumId: albumId || undefined,
          album: finalAlbumTitle,
          genre: genre.trim(),
          price: priceNum,
          duration: seconds || 300,
          featured,
          isPreorder
        },
        track?.id
      );
      toast.success(track ? "Đã lưu thay đổi" : "Đã thêm bài hát");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "Lưu thất bại. Thử lại nhé."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex h-full flex-col" noValidate>
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <h2 id="track-editor-title" className="text-lg font-semibold">
          {track ? "Sửa bài hát" : "Thêm bài hát"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-white">
          
          <XIcon className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
        <FileUpload kind="image" label="Ảnh bìa" value={cover} onChange={setCover} error={errors.cover} hint="Ảnh vuông, tối thiểu 800×800px." />
        
        {/* Chỉ cần tải 1 file MP3 duy nhất (không bắt buộc nếu là Pre-order) */}
        {!isPreorder ? (
          <div className="space-y-4 rounded-2xl bg-white/[0.02] p-4 ring-1 ring-inset ring-white/10">
            <FileUpload
              kind="audio"
              label="File nhạc MP3 gốc (Dùng cho cả nghe Demo và Bàn giao khi mua)"
              value={audioUrl}
              onChange={(url) => {
                setAudioUrl(url);
                setFullAudioUrl(url);
              }}
              onAudioDuration={(s) => {
                setDuration(formatTime(s));
                setDemoStart(0);
                setDemoEnd(s > 45 ? 45 : s); // Mặc định cắt thử 45s đầu hoặc hết bài
              }}
              hint="Chỉ cần tải 1 file MP3 gốc duy nhất. Khách nghe thử sẽ chỉ nghe được đoạn bạn chọn dưới đây." />

            {/* Bộ điều khiển & Nghe thử trực tiếp đoạn Demo */}
            {audioUrl && (
              <DemoPreviewPlayer
                audioSrc={
                  (fullAudioUrl || audioUrl)?.startsWith("http")
                    ? (fullAudioUrl || audioUrl)!
                    : `${MEDIA_PROXY_BASE}${fullAudioUrl || audioUrl}`
                }
                demoStart={demoStart}
                demoEnd={demoEnd}
                durationSec={durationSec}
                durationFormatted={duration || formatTime(durationSec)}
                onSetDemoStart={setDemoStart}
                onSetDemoEnd={setDemoEnd}
              />
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.05] p-4 text-xs leading-relaxed text-amber-200/90 ring-1 ring-amber-500/20">
            <p className="font-semibold text-amber-300">⚡ Chế độ Pre-order đang được bật</p>
            <p className="mt-1 text-white/70">
              Bài hát này không cần tải file MP3. Cửa hàng sẽ không chạy nhạc và hiển thị nút Pre-order để khách liên hệ Zalo bàn bạc trực tiếp.
            </p>
          </div>
        )}

        <Field label="Tên bài" htmlFor="f-title" error={errors.title}>
          <input id="f-title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Midnight Ember" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Thuộc Album (Chọn từ danh sách)" htmlFor="f-album">
            {albums.length > 0 ? (
              <select
                id="f-album"
                value={albumId}
                onChange={(e) => {
                  const val = e.target.value;
                  setAlbumId(val);
                  const found = albums.find((a) => a.id === val);
                  if (found) {
                    setAlbum(found.title);
                    if (!cover && found.cover) setCover(found.cover); // Tự lấy cover album nếu bài chưa có ảnh
                  } else {
                    setAlbum("Single");
                  }
                }}
                className={`${inputClass} cursor-pointer`}>
                <option value="" className="bg-[#18181b] text-white">-- Không thuộc album (Bài lẻ / Single) --</option>
                {albums.map((a) => (
                  <option key={a.id} value={a.id} className="bg-[#18181b] text-white">
                    {a.title} ({a.releaseYear || "Album"})
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="f-album"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                className={inputClass}
                placeholder="Single (Chưa tạo album nào)"
              />
            )}
            <p className="mt-1 text-[11px] text-white/40">
              {albums.length > 0
                ? "Chọn album đã tạo ở mục Album (tự đồng bộ ảnh bìa & tên)."
                : "Bạn có thể vào tab Album để tạo album trước."}
            </p>
          </Field>
          <Field label="Thể loại" htmlFor="f-genre" error={errors.genre}>
            <input id="f-genre" list="genre-options" value={genre} onChange={(e) => setGenre(e.target.value)} className={inputClass} placeholder="R&B" />
            <datalist id="genre-options">
              {genres.map((g) =>
              <option key={g} value={g} />
              )}
            </datalist>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Giá (₫) — Nhập 0 để Tải miễn phí" htmlFor="f-price" error={errors.price}>
            <div className="flex gap-2">
              <input
                id="f-price"
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
                className={`${inputClass} tabular-nums`}
                placeholder="29000 (hoặc 0 = Miễn phí)" />
              <button
                type="button"
                onClick={() => setPrice("0")}
                className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                  price === "0"
                    ? "bg-emerald-500 text-black"
                    : "bg-white/10 text-white/80 hover:bg-white/20"
                }`}>
                Free (0₫)
              </button>
            </div>
            <p className="mt-1 text-[11px] text-white/45">
              Nếu đặt <strong>0₫ (Miễn phí)</strong>: khách bấm vào sẽ tự động tải luôn file MP3 gốc. Nếu <strong>có giá (&gt; 0₫)</strong>: khách thanh toán QR và nhận nhạc qua Gmail thủ công.
            </p>
          </Field>
          <Field label="Thời lượng (Tự nhận diện)" htmlFor="f-duration" error={errors.duration}>
            <input
              id="f-duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className={`${inputClass} tabular-nums`}
              placeholder="Tự điền khi tải MP3 (ví dụ 3:45)"
            />
            <p className="mt-1 text-[11px] text-white/40">Tự động lấy theo độ dài thật của file MP3 bạn tải lên (hoặc sửa tay nếu muốn).</p>
          </Field>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-white/80">Hiển thị trên cửa hàng</legend>
          <div className="space-y-3">
            <Toggle
              checked={featured}
              onChange={setFeatured}
              disabled={featuredFull && !featured}
              label="Nổi bật"
              description={
              featuredFull && !featured ?
              `Đã đủ ${MAX_FEATURED} bài nổi bật. Tắt bớt ở danh sách bài hát để chọn bài này.` :
              `Xuất hiện trên băng chuyền đầu trang (tối đa ${MAX_FEATURED} bài)`
              } />

            <Toggle
              checked={isPreorder}
              onChange={setIsPreorder}
              label="Chế độ Đặt trước (Pre-order)"
              description="Bật chế độ này: Cửa hàng sẽ không chạy nhạc, nút hiển thị 'Pre-order · [giá]', khi khách bấm vào sẽ mở thông tin liên hệ Zalo 0333 025 864 để bàn bạc thay vì mua qua cổng thanh toán tự động."
            />
          </div>
        </fieldset>
      </div>

      <div className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
        <button type="button" onClick={onClose} className="rounded-full px-5 py-2.5 text-sm text-white/70 transition-colors duration-150 hover:text-white">
          Huỷ
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition-[opacity,transform] duration-150 active:scale-[0.98] disabled:opacity-60">
          
          {saving && <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />}
          {track ? "Lưu thay đổi" : "Thêm bài"}
        </button>
      </div>
    </form>);

}

function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled






}: {checked: boolean;onChange: (v: boolean) => void;label: string;description: string;disabled?: boolean;}) {
  return (
    <label
      className={`flex items-center justify-between gap-4 rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-inset ring-white/10 ${
      disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`
      }>
      
      <span>
        <span className="block text-sm text-white">{label}</span>
        <span className="block text-xs text-white/50">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only" />
      
      <span
        aria-hidden
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-white/60 ${
        checked ? "bg-ember" : "bg-white/15"}`
        }>
        
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform duration-150 ${checked ? "translate-x-5" : "translate-x-1"}`} />
        
      </span>
    </label>);

}

interface DemoPreviewPlayerProps {
  audioSrc: string;
  demoStart: number;
  demoEnd: number;
  durationSec: number;
  durationFormatted: string;
  onSetDemoStart: (sec: number) => void;
  onSetDemoEnd: (sec: number) => void;
}

function DemoPreviewPlayer({
  audioSrc,
  demoStart,
  demoEnd,
  durationSec,
  durationFormatted,
  onSetDemoStart,
  onSetDemoEnd
}: DemoPreviewPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(demoStart);
  const [isLooping, setIsLooping] = useState(true);

  // Stop playback when audio source changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = demoStart;
    }
    setIsPlaying(false);
    setCurrentTime(demoStart);
  }, [audioSrc]);

  // Keep playback within bounds if demoStart changes while paused
  useEffect(() => {
    if (!isPlaying) {
      setCurrentTime(demoStart);
      if (audioRef.current) {
        audioRef.current.currentTime = demoStart;
      }
    }
  }, [demoStart]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (audio.currentTime < demoStart || audio.currentTime >= demoEnd) {
        audio.currentTime = demoStart;
        setCurrentTime(demoStart);
      }
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const handleRestart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = demoStart;
    setCurrentTime(demoStart);
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  };

  const handlePreviewLast5s = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const target = Math.max(demoStart, demoEnd - 5);
    audio.currentTime = target;
    setCurrentTime(target);
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const cur = audio.currentTime;
    setCurrentTime(cur);

    if (cur >= demoEnd) {
      if (isLooping) {
        audio.currentTime = demoStart;
        audio.play().catch(() => setIsPlaying(false));
      } else {
        audio.pause();
        audio.currentTime = demoStart;
        setCurrentTime(demoStart);
        setIsPlaying(false);
      }
    }
  };

  // Timeline percentages
  const total = Math.max(durationSec, 1);
  const startPercent = Math.min(100, Math.max(0, (demoStart / total) * 100));
  const endPercent = Math.min(100, Math.max(0, (demoEnd / total) * 100));
  const widthPercent = Math.max(0, endPercent - startPercent);
  const currentPercent = Math.min(100, Math.max(0, (currentTime / total) * 100));

  // Micro tuning adjustments
  const adjustStart = (delta: number) => {
    const next = Math.max(0, Math.min(demoEnd - 3, demoStart + delta));
    onSetDemoStart(next);
    if (audioRef.current) {
      audioRef.current.currentTime = next;
      setCurrentTime(next);
    }
  };

  const adjustEnd = (delta: number) => {
    const next = Math.min(durationSec, Math.max(demoStart + 3, demoEnd + delta));
    onSetDemoEnd(next);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetSec = clickRatio * total;
    const clamped = Math.max(demoStart, Math.min(demoEnd, targetSec));
    if (audioRef.current) {
      audioRef.current.currentTime = clamped;
    }
    setCurrentTime(clamped);
  };

  return (
    <div className="mt-3 rounded-2xl border border-ember/35 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-4 space-y-4 shadow-xl shadow-black/50">
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="auto"
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => {
          if (isLooping && audioRef.current) {
            audioRef.current.currentTime = demoStart;
            audioRef.current.play().catch(() => setIsPlaying(false));
          } else {
            setIsPlaying(false);
            setCurrentTime(demoStart);
          }
        }}
      />

      {/* Header with Title and Current Slice Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-ember animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider text-white">
            Căn chỉnh & Nghe thử đoạn Demo
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="tabular-nums font-mono text-xs font-semibold text-ember bg-ember/15 border border-ember/30 px-2.5 py-1 rounded-full shadow-inner">
            {formatTime(demoStart)} ➔ {formatTime(demoEnd)} ({demoEnd - demoStart} giây)
          </span>
        </div>
      </div>

      {/* Interactive Visual Timeline Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] font-mono tabular-nums text-white/50">
          <span>0:00 (Đầu bài)</span>
          <span className="text-ember font-medium">
            Đang phát: {formatTime(Math.min(demoEnd, Math.max(demoStart, currentTime)))}
          </span>
          <span>{durationFormatted}</span>
        </div>

        <div
          ref={timelineRef}
          onClick={handleTimelineClick}
          title="Nhấp để chuyển đoạn phát trong vùng Demo"
          className="relative h-7 w-full rounded-lg bg-black/60 border border-white/10 overflow-hidden cursor-pointer select-none"
        >
          {/* Highlighted active demo slice */}
          <div
            className="absolute top-0 bottom-0 bg-gradient-to-r from-ember/40 to-ember/60 border-x-2 border-ember shadow-[0_0_12px_rgba(249,115,22,0.35)]"
            style={{
              left: `${startPercent}%`,
              width: `${widthPercent}%`
            }}
          />

          {/* Current playhead indicator */}
          {isPlaying && (
            <div
              className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_8px_#ffffff] z-10 transition-[left] duration-75"
              style={{ left: `${currentPercent}%` }}
            />
          )}

          {/* Range label inside the bar */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[10px] font-medium text-white/90 drop-shadow">
              Vùng khách sẽ nghe: {demoEnd - demoStart}s
            </span>
          </div>
        </div>
      </div>

      {/* Playback Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-black/40 border border-white/10 p-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-150 active:scale-95 shadow-md ${
              isPlaying
                ? "bg-ember text-black shadow-ember/30"
                : "bg-white text-black hover:bg-white/90"
            }`}
          >
            {isPlaying ? (
              <>
                <PauseIcon className="h-4 w-4 fill-black" />
                <span>Tạm dừng</span>
              </>
            ) : (
              <>
                <PlayIcon className="h-4 w-4 fill-black ml-0.5" />
                <span>Nghe thử Demo</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleRestart}
            title="Nghe lại từ đầu đoạn cắt"
            className="flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 px-3 py-2 text-xs text-white/90 transition-colors"
          >
            <RotateCcwIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Về đầu</span>
          </button>

          <button
            type="button"
            onClick={handlePreviewLast5s}
            title="Nghe 5 giây cuối trước khi đoạn demo kết thúc"
            className="rounded-full bg-white/10 hover:bg-white/15 px-2.5 py-2 text-xs text-white/80 transition-colors"
          >
            <span>5s cuối</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsLooping(!isLooping)}
            title="Bật/tắt tự động lặp lại đoạn Demo"
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${
              isLooping
                ? "bg-ember/20 text-ember border border-ember/40 font-medium"
                : "bg-white/5 text-white/50 border border-white/10 hover:text-white/80"
            }`}
          >
            <RepeatIcon className="h-3.5 w-3.5" />
            <span>Lặp lại: {isLooping ? "Bật" : "Tắt"}</span>
          </button>
        </div>
      </div>

      {/* Range Sliders with Micro-tuning buttons */}
      <div className="space-y-3 pt-1">
        {/* Start Point */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60 font-medium">Bắt đầu phát từ:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => adjustStart(-5)}
                className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/10 hover:bg-white/20 text-white/70"
              >
                -5s
              </button>
              <button
                type="button"
                onClick={() => adjustStart(-1)}
                className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/10 hover:bg-white/20 text-white/70"
              >
                -1s
              </button>
              <span className="w-14 text-center font-mono tabular-nums text-ember font-bold bg-black/40 px-1 py-0.5 rounded border border-white/10">
                {formatTime(demoStart)}
              </span>
              <button
                type="button"
                onClick={() => adjustStart(1)}
                className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/10 hover:bg-white/20 text-white/70"
              >
                +1s
              </button>
              <button
                type="button"
                onClick={() => adjustStart(5)}
                className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/10 hover:bg-white/20 text-white/70"
              >
                +5s
              </button>
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={durationSec}
            value={demoStart}
            onChange={(e) => {
              const v = Number(e.target.value);
              const next = Math.min(v, demoEnd - 3);
              onSetDemoStart(next);
              if (audioRef.current) {
                audioRef.current.currentTime = next;
                setCurrentTime(next);
              }
            }}
            className="w-full accent-ember cursor-pointer"
          />
        </div>

        {/* End Point */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60 font-medium">Dừng lại ở:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => adjustEnd(-5)}
                className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/10 hover:bg-white/20 text-white/70"
              >
                -5s
              </button>
              <button
                type="button"
                onClick={() => adjustEnd(-1)}
                className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/10 hover:bg-white/20 text-white/70"
              >
                -1s
              </button>
              <span className="w-14 text-center font-mono tabular-nums text-ember font-bold bg-black/40 px-1 py-0.5 rounded border border-white/10">
                {formatTime(demoEnd)}
              </span>
              <button
                type="button"
                onClick={() => adjustEnd(1)}
                className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/10 hover:bg-white/20 text-white/70"
              >
                +1s
              </button>
              <button
                type="button"
                onClick={() => adjustEnd(5)}
                className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/10 hover:bg-white/20 text-white/70"
              >
                +5s
              </button>
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={durationSec}
            value={demoEnd}
            onChange={(e) => {
              const v = Number(e.target.value);
              onSetDemoEnd(Math.max(v, demoStart + 3));
            }}
            className="w-full accent-ember cursor-pointer"
          />
        </div>
      </div>

      <p className="text-[11px] text-white/50 leading-relaxed border-t border-white/10 pt-2.5">
        🎧 <strong className="text-white/80">Khách trên Store:</strong> Sẽ nghe đúng đoạn từ <span className="text-white font-medium">{formatTime(demoStart)}</span> đến <span className="text-white font-medium">{formatTime(demoEnd)}</span> rồi tự động lặp lại. Sau khi mua hàng, khách nhận được trọn vẹn toàn bộ file MP3 gốc ({durationFormatted}).
      </p>
    </div>
  );
}