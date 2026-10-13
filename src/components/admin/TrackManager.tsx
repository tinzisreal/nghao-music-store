import React, { useMemo, useRef, useState } from "react";
import { MusicIcon, PauseIcon, PencilIcon, PlayIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { TrackEditor } from "./TrackEditor";
import { Track, TrackInput } from "../../types/track";
import { Album } from "../../types/album";
import { formatPrice, formatTime } from "../../utils/format";
import { errorMessage, MEDIA_PROXY_BASE } from "../../utils/api";
import { MAX_FEATURED } from "../../data/sections";

interface TrackManagerProps {
  tracks: Track[];
  albums?: Album[];
  onSave: (input: TrackInput, id?: string) => Promise<unknown>;
  onPatch: (id: string, patch: Partial<TrackInput>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function TrackManager({ tracks, albums = [], onSave, onPatch, onDelete }: TrackManagerProps) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Track | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const listAudioRef = useRef<HTMLAudioElement | null>(null);

  const genres = useMemo(() => Array.from(new Set(tracks.map((t) => t.genre))), [tracks]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? tracks.filter((t) => `${t.title} ${t.album} ${t.genre}`.toLowerCase().includes(q)) : tracks;
  }, [tracks, query]);

  const stopPreview = () => {
    if (listAudioRef.current) {
      listAudioRef.current.pause();
    }
    setPlayingId(null);
  };

  const openNew = () => {
    stopPreview();
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (t: Track) => {
    stopPreview();
    setEditing(t);
    setEditorOpen(true);
  };

  const handleTogglePlay = (t: Track) => {
    const audio = listAudioRef.current;
    if (!audio) return;
    if (playingId === t.id) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    const rawAudio = t.audioUrl || t.fullAudioUrl;
    if (!rawAudio) {
      toast.error("Bài hát này chưa có file nhạc.");
      return;
    }
    const src = rawAudio.startsWith("http") ? rawAudio : `${MEDIA_PROXY_BASE}${rawAudio}`;
    audio.src = src;
    const start = t.demoStart || 0;
    audio.currentTime = start;
    audio
      .play()
      .then(() => setPlayingId(t.id))
      .catch(() => {
        toast.error("Không thể phát nhạc nghe thử.");
        setPlayingId(null);
      });
  };

  const handleAudioTimeUpdate = () => {
    const audio = listAudioRef.current;
    if (!audio || !playingId) return;
    const t = tracks.find((tr) => tr.id === playingId);
    if (!t) return;
    const end = t.demoEnd || Math.min(t.duration || 90, 90);
    const start = t.demoStart || 0;
    if (audio.currentTime >= end) {
      audio.currentTime = start;
      audio.play().catch(() => setPlayingId(null));
    }
  };

  const featuredCount = tracks.filter((t) => t.featured).length;
  const featuredFull = featuredCount >= MAX_FEATURED;

  const toggleFlag = async (t: Track, key: "featured") => {
    if (!t[key] && featuredFull) {
      toast.error(`Chỉ được tối đa ${MAX_FEATURED} bài nổi bật. Tắt bớt một bài trước nhé.`);
      return;
    }
    setBusyId(t.id);
    try {
      await onPatch(t.id, { [key]: !t[key] });
    } catch (err) {
      toast.error(errorMessage(err, "Không cập nhật được."));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (t: Track) => {
    setBusyId(t.id);
    try {
      await onDelete(t.id);
      toast.success(`Đã xoá “${t.title}”`);
    } catch (err) {
      toast.error(errorMessage(err, "Không xoá được."));
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  };

  return (
    <section aria-labelledby="tracks-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="tracks-title" className="text-2xl font-semibold">
            Bài hát
          </h2>
          <p className="mt-1 text-sm text-white/55">
            {tracks.length} bài trên cửa hàng ·{" "}
            <span className={featuredFull ? "text-ember" : ""}>
              Nổi bật {featuredCount}/{MAX_FEATURED}
            </span>
          </p>
        </div>
        <div className="flex gap-3">
          <label className="flex flex-1 items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2.5 ring-1 ring-inset ring-white/10 sm:w-64 sm:flex-none">
            <SearchIcon className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
            <span className="sr-only">Tìm bài hát</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm bài, album…"
              className="w-full min-w-0 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none" />
            
          </label>
          <button
            type="button"
            onClick={openNew}
            className="flex shrink-0 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-transform duration-150 active:scale-95">
            
            <PlusIcon className="h-4 w-4" aria-hidden />
            Thêm bài
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
        <div className="hidden grid-cols-[3.5rem_minmax(0,1fr)_7rem_6rem_4rem_10rem_6rem] items-center gap-4 border-b border-white/10 px-4 py-3 text-xs text-white/45 lg:grid">
          <span />
          <span>Bài hát</span>
          <span>Thể loại</span>
          <span className="text-right">Giá</span>
          <span className="text-right">Dài</span>
          <span>Hiển thị</span>
          <span />
        </div>

        {filtered.length === 0 ?
        <div className="flex flex-col items-center px-6 py-16 text-center">
            <MusicIcon className="h-8 w-8 text-white/40" aria-hidden />
            <p className="mt-3 text-white/70">{tracks.length === 0 ? "Chưa có bài hát nào." : "Không tìm thấy bài phù hợp."}</p>
            {tracks.length === 0 &&
          <button type="button" onClick={openNew} className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black">
                Thêm bài đầu tiên
              </button>
          }
          </div> :

        <ul className="divide-y divide-white/[0.06]">
            {filtered.map((t) => {
            const busy = busyId === t.id;
            const confirming = confirmId === t.id;
            return (
              <li
                key={t.id}
                className={`grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 transition-opacity duration-150 lg:grid-cols-[3.5rem_minmax(0,1fr)_7rem_6rem_4rem_10rem_6rem] ${
                busy ? "opacity-60" : ""}`
                }>
                
                <div className="relative group h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-black/40">
                  <img src={t.cover} alt="" className="h-full w-full object-cover" />
                  {(t.audioUrl || t.fullAudioUrl) && (
                    <button
                      type="button"
                      onClick={() => handleTogglePlay(t)}
                      title={playingId === t.id ? "Tạm dừng nghe thử" : "Nghe thử đoạn Demo đã căn"}
                      className={`absolute inset-0 flex items-center justify-center bg-black/60 transition-opacity duration-150 ${
                        playingId === t.id ? "opacity-100 ring-2 ring-ember" : "opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {playingId === t.id ? (
                        <PauseIcon className="h-5 w-5 fill-ember text-ember" />
                      ) : (
                        <PlayIcon className="h-5 w-5 fill-white text-white ml-0.5" />
                      )}
                    </button>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.title}</p>
                  <p className="truncate text-sm text-white/55">
                    {t.album}
                    <span className="lg:hidden">
                      {" "}
                      · {formatPrice(t.price)}
                    </span>
                  </p>
                  {!t.audioUrl && !t.fullAudioUrl ? (
                    <p className="mt-0.5 text-xs text-white/40">Chưa có file nhạc</p>
                  ) : (
                    <div className="mt-1 flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono tabular-nums ${
                          playingId === t.id
                            ? "bg-ember/25 text-ember font-semibold border border-ember/40 animate-pulse"
                            : "bg-white/10 text-white/70"
                        }`}
                      >
                        Demo: {formatTime(t.demoStart || 0)} ➔ {formatTime(t.demoEnd || Math.min(t.duration || 90, 90))}
                        {playingId === t.id && " (Đang phát)"}
                      </span>
                    </div>
                  )}
                </div>
                  <span className="hidden truncate text-sm text-white/70 lg:block">{t.genre}</span>
                  <span className="hidden text-right text-sm tabular-nums text-white/70 lg:block">{formatPrice(t.price)}</span>
                  <span className="hidden text-right text-sm tabular-nums text-white/70 lg:block">{formatTime(t.duration)}</span>
                  <div className="col-span-2 col-start-2 row-start-2 flex gap-1.5 lg:col-span-1 lg:col-start-auto lg:row-start-auto">
                    <FlagChip active={!!t.featured} disabled={busy} onClick={() => toggleFlag(t, "featured")}>
                      Nổi bật
                    </FlagChip>
                  </div>
                  <div className="flex justify-end gap-1">
                    {confirming ?
                  <>
                        <button
                      type="button"
                      onClick={() => remove(t)}
                      disabled={busy}
                      className="whitespace-nowrap rounded-full bg-ember px-3 py-1.5 text-xs font-semibold text-black">
                      
                          Xoá
                        </button>
                        <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs text-white/70 hover:text-white">
                      
                          Huỷ
                        </button>
                      </> :

                  <>
                        <button
                      type="button"
                      onClick={() => openEdit(t)}
                      aria-label={`Sửa ${t.title}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-white">
                      
                          <PencilIcon className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                      type="button"
                      onClick={() => setConfirmId(t.id)}
                      aria-label={`Xoá ${t.title}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-ember">
                      
                          <Trash2Icon className="h-4 w-4" aria-hidden />
                        </button>
                      </>
                  }
                  </div>
                </li>);

          })}
          </ul>
        }
      </div>

      {/* Audio element phát nhạc nghe thử trong danh sách Admin */}
      <audio
        ref={listAudioRef}
        preload="none"
        onTimeUpdate={handleAudioTimeUpdate}
        onEnded={() => {
          if (listAudioRef.current && playingId) {
            const t = tracks.find((tr) => tr.id === playingId);
            if (t) {
              listAudioRef.current.currentTime = t.demoStart || 0;
              listAudioRef.current.play().catch(() => setPlayingId(null));
            }
          }
        }}
      />

      {/* Thanh thông báo khi đang phát nghe thử một bài */}
      {playingId && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full bg-[#1b1c20]/95 border border-ember/40 px-4 py-2 shadow-2xl backdrop-blur-md">
          <span className="flex h-2.5 w-2.5 rounded-full bg-ember animate-pulse" />
          <span className="text-xs text-white/90">
            Đang nghe thử: <strong className="text-white">{tracks.find((t) => t.id === playingId)?.title}</strong>
          </span>
          <button
            type="button"
            onClick={stopPreview}
            className="rounded-full bg-ember px-2.5 py-1 text-xs font-semibold text-black hover:bg-ember/90 transition-colors"
          >
            Dừng
          </button>
        </div>
      )}

      <TrackEditor open={editorOpen} track={editing}
      genres={genres}
      albums={albums}
      featuredFull={featuredCount - (editing?.featured ? 1 : 0) >= MAX_FEATURED}
      onClose={() => setEditorOpen(false)} onSave={onSave} />
    </section>);

}

function FlagChip({ active, disabled, onClick, children }: {active: boolean;disabled: boolean;onClick: () => void;children: React.ReactNode;}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs transition-colors duration-150 ${
      active ? "bg-ember/90 font-medium text-black" : "bg-white/[0.06] text-white/55 ring-1 ring-inset ring-white/10 hover:text-white"}`
      }>
      
      {children}
    </button>);

}