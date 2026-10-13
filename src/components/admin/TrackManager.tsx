import React, { useMemo, useState } from "react";
import { MusicIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { TrackEditor } from "./TrackEditor";
import { Track, TrackInput } from "../../types/track";
import { Album } from "../../types/album";
import { formatPrice, formatTime } from "../../utils/format";
import { errorMessage } from "../../utils/api";
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

  const genres = useMemo(() => Array.from(new Set(tracks.map((t) => t.genre))), [tracks]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? tracks.filter((t) => `${t.title} ${t.album} ${t.genre}`.toLowerCase().includes(q)) : tracks;
  }, [tracks, query]);

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (t: Track) => {
    setEditing(t);
    setEditorOpen(true);
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
                
                  <img src={t.cover} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.title}</p>
                    <p className="truncate text-sm text-white/55">
                      {t.album}
                      <span className="lg:hidden">
                        {" "}
                        · {formatPrice(t.price)}
                      </span>
                    </p>
                    {!t.audioUrl && <p className="mt-0.5 text-xs text-white/40">Chưa có file nhạc</p>}
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