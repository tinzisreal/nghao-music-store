import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Field, inputClass } from "./Field";
import { FileUpload } from "./FileUpload";
import { Track, TrackInput } from "../../types/track";
import { Album } from "../../types/album";
import { formatTime, parseTime } from "../../utils/format";
import { errorMessage } from "../../utils/api";
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
    const priceNum = Number(price.replace(/\D/g, ""));
    const seconds = parseTime(duration);
    const next: Errors = {};
    if (!cover) next.cover = "Cần ảnh bìa.";
    if (!title.trim()) next.title = "Nhập tên bài.";
    // Album không bắt buộc, nếu trống sẽ hiển thị là Single / Bài lẻ
    if (!genre.trim()) next.genre = "Nhập thể loại.";
    if (!priceNum || priceNum <= 0) next.price = "Giá phải lớn hơn 0.";
    if (!seconds || seconds <= 0) next.duration = "Định dạng phút:giây, ví dụ 3:45.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const selectedAlbum = albums.find((a) => a.id === albumId);
      const finalAlbumTitle = selectedAlbum ? selectedAlbum.title : (album.trim() || "Single");

      await onSave(
        {
          cover: cover!,
          audioUrl,
          fullAudioUrl: fullAudioUrl || audioUrl,
          demoStart,
          demoEnd: demoEnd > demoStart ? demoEnd : seconds!,
          title: title.trim(),
          albumId: albumId || undefined,
          album: finalAlbumTitle,
          genre: genre.trim(),
          price: priceNum,
          duration: seconds!,
          featured
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
        
        {/* Chỉ cần tải 1 file MP3 duy nhất */}
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

          {/* Thanh kéo tuỳ chỉnh đoạn Demo nghe thử */}
          {audioUrl && (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-white/80">
                <span className="font-semibold text-ember">Khoảng thời gian Demo phát trên Store:</span>
                <span className="tabular-nums font-mono text-white/80 bg-white/10 px-2 py-0.5 rounded-md">
                  {formatTime(demoStart)} ➔ {formatTime(demoEnd)} ({demoEnd - demoStart} giây)
                </span>
              </div>

              <div className="space-y-2.5 pt-1">
                <div className="flex items-center gap-3">
                  <span className="w-16 text-xs text-white/50">Phát từ:</span>
                  <input
                    type="range"
                    min={0}
                    max={durationSec}
                    value={demoStart}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setDemoStart(Math.min(v, demoEnd - 5));
                    }}
                    className="w-full accent-ember cursor-pointer"
                  />
                  <span className="w-12 text-right text-xs font-mono tabular-nums text-white/80 font-medium">{formatTime(demoStart)}</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-16 text-xs text-white/50">Dừng ở:</span>
                  <input
                    type="range"
                    min={0}
                    max={durationSec}
                    value={demoEnd}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setDemoEnd(Math.max(v, demoStart + 5));
                    }}
                    className="w-full accent-ember cursor-pointer"
                  />
                  <span className="w-12 text-right text-xs font-mono tabular-nums text-white/80 font-medium">{formatTime(demoEnd)}</span>
                </div>
              </div>

              <p className="text-[11px] text-white/50 leading-relaxed border-t border-white/5 pt-2">
                🎧 Khi khách nghe trên Store, nhạc sẽ chỉ chạy từ <span className="text-white font-medium">{formatTime(demoStart)}</span> đến <span className="text-white font-medium">{formatTime(demoEnd)}</span> rồi tự lặp lại. Sau khi mua hàng, khách sẽ nhận được trọn vẹn toàn bộ file MP3 gốc ({duration || formatTime(durationSec)}).
              </p>
            </div>
          )}
        </div>

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
          <Field label="Giá (₫)" htmlFor="f-price" error={errors.price}>
            <input
              id="f-price"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
              className={`${inputClass} tabular-nums`}
              placeholder="29000" />
            
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
          <div className="space-y-2">
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