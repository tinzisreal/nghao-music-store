import React, { useMemo, useRef, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronsUpIcon,
  MusicIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  Trash2Icon
} from "lucide-react";
import { toast } from "sonner";
import { TrackEditor } from "./TrackEditor";
import { Track, TrackInput } from "../../types/track";
import { Album } from "../../types/album";
import { formatPrice, formatTime } from "../../utils/format";
import { errorMessage, MEDIA_PROXY_BASE } from "../../utils/api";
import { MAX_FEATURED } from "../../data/sections";
import { NewsletterBroadcastModal } from "./NewsletterBroadcastModal";

interface TrackManagerProps {
  tracks: Track[];
  albums?: Album[];
  onSave: (input: TrackInput, id?: string) => Promise<unknown>;
  onPatch: (id: string, patch: Partial<TrackInput>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder?: (trackIds: string[]) => Promise<unknown>;
}

export function TrackManager({ tracks, albums = [], onSave, onPatch, onDelete, onReorder }: TrackManagerProps) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Track | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [broadcastTrack, setBroadcastTrack] = useState<Track | null>(null);
  const listAudioRef = useRef<HTMLAudioElement | null>(null);

  const genres = useMemo(() => Array.from(new Set(tracks.map((t) => t.genre))), [tracks]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? tracks.filter((t) => `${t.title} ${t.album} ${t.genre}`.toLowerCase().includes(q)) : tracks;
  }, [tracks, query]);

  const [reordering, setReordering] = useState(false);

  const stopPreview = () => {
    if (listAudioRef.current) {
      listAudioRef.current.pause();
    }
    setPlayingId(null);
  };

  const moveTrack = async (fromIndex: number, dir: -1 | 1) => {
    if (query) {
      toast.info("Xóa ô tìm kiếm trước khi sắp xếp thứ tự để thấy đầy đủ danh sách.");
      return;
    }
    const toIndex = fromIndex + dir;
    if (toIndex < 0 || toIndex >= tracks.length || !onReorder) return;
    const nextTracks = [...tracks];
    const [moved] = nextTracks.splice(fromIndex, 1);
    nextTracks.splice(toIndex, 0, moved);
    const newIds = nextTracks.map((t) => t.id);
    setReordering(true);
    try {
      await onReorder(newIds);
      toast.success(`Đã chuyển “${moved.title}” sang vị trí #${toIndex + 1}`);
    } catch (err) {
      toast.error(errorMessage(err, "Không thể sắp xếp bài hát."));
    } finally {
      setReordering(false);
    }
  };

  const moveToTop = async (fromIndex: number) => {
    if (query) {
      toast.info("Xóa ô tìm kiếm trước khi sắp xếp thứ tự để thấy đầy đủ danh sách.");
      return;
    }
    if (fromIndex === 0 || !onReorder) return;
    const nextTracks = [...tracks];
    const [moved] = nextTracks.splice(fromIndex, 1);
    nextTracks.unshift(moved);
    const newIds = nextTracks.map((t) => t.id);
    setReordering(true);
    try {
      await onReorder(newIds);
      toast.success(`Đã đưa “${moved.title}” lên vị trí đầu tiên (#1)`);
    } catch (err) {
      toast.error(errorMessage(err, "Không thể sắp xếp bài hát."));
    } finally {
      setReordering(false);
    }
  };

  const applyQuickSort = async (type: "price-desc" | "price-asc" | "title") => {
    if (!onReorder) return;
    const nextTracks = [...tracks];
    if (type === "price-desc") {
      nextTracks.sort((a, b) => b.price - a.price);
    } else if (type === "price-asc") {
      nextTracks.sort((a, b) => a.price - b.price);
    } else if (type === "title") {
      nextTracks.sort((a, b) => a.title.localeCompare(b.title));
    }
    const newIds = nextTracks.map((t) => t.id);
    setReordering(true);
    try {
      await onReorder(newIds);
      toast.success("Đã cập nhật thứ tự danh sách hiển thị trên Cửa hàng!");
    } catch (err) {
      toast.error(errorMessage(err, "Không thể lưu thứ tự bài hát."));
    } finally {
      setReordering(false);
    }
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
    const src = rawAudio.startsWith("http")
      ? rawAudio
      : rawAudio.startsWith("/tiktok-sdk") || rawAudio.startsWith("/fb-tr")
      ? rawAudio
      : `${MEDIA_PROXY_BASE}${rawAudio}`;

    audio.pause();
    audio.src = src;
    const start = t.demoStart || 0;

    const applySeek = () => {
      if (start > 0 && Number.isFinite(audio.duration) && audio.duration > start) {
        audio.currentTime = start;
      }
    };

    if (start > 0) {
      audio.addEventListener("loadedmetadata", applySeek, { once: true });
    }

    // Call play() immediately within the user's click handler for mobile compatibility
    audio
      .play()
      .then(() => {
        setPlayingId(t.id);
        applySeek();
      })
      .catch((err) => {
        console.warn("Mobile preview play prevented:", err);
        toast.error("Không thể phát nhạc nghe thử trên trình duyệt này.");
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

  const toggleFlag = async (t: Track, key: "featured" | "isPreorder") => {
    if (key === "featured" && !t[key] && featuredFull) {
      toast.error(`Chỉ được tối đa ${MAX_FEATURED} bài nổi bật. Tắt bớt một bài trước nhé.`);
      return;
    }
    setBusyId(t.id);
    try {
      await onPatch(t.id, { [key]: !t[key] });
      if (key === "isPreorder") {
        toast.success(
          !t.isPreorder
            ? `Đã bật Pre-order cho bài "${t.title}"`
            : `Đã tắt Pre-order cho bài "${t.title}"`
        );
      }
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

      {/* Thanh công cụ sắp xếp thứ tự hiển thị */}
      {tracks.length > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-white/90">
              <ArrowUpDownIcon className="h-3.5 w-3.5 text-ember" aria-hidden />
              Sắp xếp nhanh:
            </span>
            <button
              type="button"
              disabled={reordering || !!query}
              onClick={() => applyQuickSort("price-desc")}
              className="rounded-full bg-white/[0.06] px-3 py-1 font-medium text-white/80 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/15 hover:text-white disabled:opacity-40"
            >
              Giá cao ➔ thấp
            </button>
            <button
              type="button"
              disabled={reordering || !!query}
              onClick={() => applyQuickSort("price-asc")}
              className="rounded-full bg-white/[0.06] px-3 py-1 font-medium text-white/80 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/15 hover:text-white disabled:opacity-40"
            >
              Giá thấp ➔ cao
            </button>
            <button
              type="button"
              disabled={reordering || !!query}
              onClick={() => applyQuickSort("title")}
              className="rounded-full bg-white/[0.06] px-3 py-1 font-medium text-white/80 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/15 hover:text-white disabled:opacity-40"
            >
              Tên A ➔ Z
            </button>
          </div>
          <p className="text-[11px] text-white/45">
            💡 Dùng nút mũi tên <span className="font-mono text-ember font-semibold">↑ ↓ 🔝</span> ở từng bài để xếp thứ tự theo ý muốn. Cửa hàng sẽ hiển thị đúng theo thứ tự này.
          </p>
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
        <div className="hidden grid-cols-[6rem_3.5rem_minmax(0,1fr)_6.5rem_5.5rem_4rem_10.5rem_5.5rem] items-center gap-4 border-b border-white/10 px-4 py-3 text-xs text-white/45 lg:grid">
          <span># Thứ tự</span>
          <span />
          <span>Bài hát</span>
          <span>Thể loại</span>
          <span className="text-right">Giá</span>
          <span className="text-right">Dài</span>
          <span>Hiển thị</span>
          <span />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <MusicIcon className="h-8 w-8 text-white/40" aria-hidden />
            <p className="mt-3 text-white/70">{tracks.length === 0 ? "Chưa có bài hát nào." : "Không tìm thấy bài phù hợp."}</p>
            {tracks.length === 0 && (
              <button type="button" onClick={openNew} className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black">
                Thêm bài đầu tiên
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {filtered.map((t) => {
              const busy = busyId === t.id;
              const confirming = confirmId === t.id;
              const realIndex = tracks.findIndex((item) => item.id === t.id);
              const isFirst = realIndex === 0;
              const isLast = realIndex === tracks.length - 1;

              return (
                <li
                  key={t.id}
                  className={`grid grid-cols-[auto_3.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 transition-opacity duration-150 lg:grid-cols-[6rem_3.5rem_minmax(0,1fr)_6.5rem_5.5rem_4rem_10.5rem_5.5rem] lg:gap-4 lg:px-4 ${
                    busy ? "opacity-60" : ""
                  }`}
                >
                  {/* Cột Thứ tự & Nút di chuyển */}
                  <div className="flex items-center gap-1">
                    <span className="w-6 shrink-0 text-center font-mono text-xs font-semibold text-white/50">
                      #{realIndex + 1}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        disabled={isFirst || reordering || !!query}
                        onClick={() => moveTrack(realIndex, -1)}
                        title={query ? "Xoá ô tìm kiếm để di chuyển" : "Đẩy bài lên trên 1 bậc"}
                        aria-label={`Đẩy bài ${t.title} lên trên`}
                        className="flex h-5 w-5 items-center justify-center rounded bg-white/[0.04] text-white/70 hover:bg-white/15 hover:text-white disabled:pointer-events-none disabled:opacity-20 transition-colors"
                      >
                        <ArrowUpIcon className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        disabled={isLast || reordering || !!query}
                        onClick={() => moveTrack(realIndex, 1)}
                        title={query ? "Xoá ô tìm kiếm để di chuyển" : "Đẩy bài xuống dưới 1 bậc"}
                        aria-label={`Đẩy bài ${t.title} xuống dưới`}
                        className="flex h-5 w-5 items-center justify-center rounded bg-white/[0.04] text-white/70 hover:bg-white/15 hover:text-white disabled:pointer-events-none disabled:opacity-20 transition-colors"
                      >
                        <ArrowDownIcon className="h-3 w-3" />
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={isFirst || reordering || !!query}
                      onClick={() => moveToTop(realIndex)}
                      title={query ? "Xoá ô tìm kiếm để di chuyển" : "Đưa thẳng lên đầu bảng (#1)"}
                      aria-label={`Đưa bài ${t.title} lên vị trí số 1`}
                      className="ml-0.5 hidden h-7 w-7 items-center justify-center rounded-md bg-white/[0.04] text-white/60 hover:bg-white/15 hover:text-ember disabled:pointer-events-none disabled:opacity-20 transition-colors sm:flex"
                    >
                      <ChevronsUpIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>

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
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-medium">{t.title}</p>
                      {t.isPreorder && (
                        <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-500/30">
                          Pre-order
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm text-white/55">
                      {t.album}
                      <span className="lg:hidden">
                        {" "}
                        · {formatPrice(t.price)}
                      </span>
                    </p>
                    {t.isPreorder ? (
                      <p className="mt-0.5 text-xs text-amber-300/80">⚡ Chế độ Pre-order (Liên hệ Zalo, không chạy nhạc)</p>
                    ) : !t.audioUrl && !t.fullAudioUrl ? (
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
                  <div className="col-span-2 col-start-3 row-start-2 flex flex-wrap gap-1.5 lg:col-span-1 lg:col-start-auto lg:row-start-auto">
                    <FlagChip active={!!t.featured} disabled={busy} onClick={() => toggleFlag(t, "featured")}>
                      Nổi bật
                    </FlagChip>
                    <FlagChip active={!!t.isPreorder} disabled={busy} onClick={() => toggleFlag(t, "isPreorder")}>
                      Pre-order
                    </FlagChip>
                  </div>
                  <div className="flex justify-end gap-1">
                    {confirming ? (
                      <>
                        <button
                          type="button"
                          onClick={() => remove(t)}
                          disabled={busy}
                          className="whitespace-nowrap rounded-full bg-ember px-3 py-1.5 text-xs font-semibold text-black"
                        >
                          Xoá
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                          className="whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs text-white/70 hover:text-white"
                        >
                          Huỷ
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setBroadcastTrack(t)}
                          aria-label={`Gửi thông báo bài hát ${t.title}`}
                          title={`Gửi email thông báo phát hành bài "${t.title}" qua Resend`}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors duration-150 hover:bg-rose-500/20 hover:text-rose-300"
                        >
                          <SendIcon className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          aria-label={`Sửa ${t.title}`}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-white"
                        >
                          <PencilIcon className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(t.id)}
                          aria-label={`Xoá ${t.title}`}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-ember"
                        >
                          <Trash2Icon className="h-4 w-4" aria-hidden />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Audio element phát nhạc nghe thử trong danh sách Admin */}
      <audio
        ref={listAudioRef}
        preload="auto"
        playsInline
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

      <NewsletterBroadcastModal
        isOpen={Boolean(broadcastTrack)}
        onClose={() => setBroadcastTrack(null)}
        tracks={tracks}
        initialTrackId={broadcastTrack?.id}
      />
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