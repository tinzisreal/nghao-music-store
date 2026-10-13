import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownIcon, ArrowUpIcon, Loader2Icon, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Field, inputClass } from "./Field";
import { Track } from "../../types/track";
import { StoreSections, TrackSection } from "../../types/store";
import { formatPrice } from "../../utils/format";
import { errorMessage } from "../../utils/api";

interface NewReleasesManagerProps {
  tracks: Track[];
  sections: StoreSections;
  onSave: (sections: StoreSections) => Promise<void>;
}

const MAX_ITEMS = 5;

export function NewReleasesManager({ tracks, sections, onSave }: NewReleasesManagerProps) {
  const initial = sections.newReleases;
  const [form, setForm] = useState<TrackSection>({
    ...initial,
    trackIds: initial.trackIds.slice(0, MAX_ITEMS)
  });
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const byId = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);
  const selected = form.trackIds.slice(0, MAX_ITEMS).map((id) => byId.get(id)).filter((t): t is Track => Boolean(t));
  const full = selected.length >= MAX_ITEMS;

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tracks.filter(
      (t) => !form.trackIds.includes(t.id) && (!q || `${t.title} ${t.album} ${t.genre}`.toLowerCase().includes(q))
    );
  }, [tracks, form.trackIds, query]);

  const setIds = (fn: (ids: string[]) => string[]) => setForm((f) => ({ ...f, trackIds: fn(f.trackIds).slice(0, MAX_ITEMS) }));
  const add = (id: string) => !full && setIds((ids) => [...ids, id]);
  const remove = (id: string) => setIds((ids) => ids.filter((x) => x !== id));
  const move = (index: number, dir: -1 | 1) =>
  setIds((ids) => {
    const next = [...ids];
    const target = index + dir;
    if (target < 0 || target >= next.length) return ids;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  const submit = async () => {
    if (!form.title.vi.trim()) {
      toast.error("Nhập tiêu đề mục (tiếng Việt).");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...sections,
        newReleases: {
          title: { vi: form.title.vi.trim(), en: form.title.en.trim() },
          trackIds: selected.slice(0, MAX_ITEMS).map((t) => t.id)
        }
      });
      toast.success("Đã lưu mục Mới phát hành");
    } catch (err) {
      toast.error(errorMessage(err, "Lưu thất bại."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="nr-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="nr-title" className="text-2xl font-semibold">
            Mới phát hành
          </h2>
          <p className="mt-1 text-sm text-white/55">Chọn bài và sắp xếp thứ tự hiển thị trên cửa hàng.</p>
        </div>
        <div className="flex gap-3">
          {dirty &&
          <button type="button" onClick={() => setForm(initial)} className="rounded-full px-5 py-2.5 text-sm text-white/70 hover:text-white">
              Hoàn tác
            </button>
          }
          <button
            type="button"
            onClick={submit}
            disabled={!dirty || saving}
            className="flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition-opacity duration-150 disabled:opacity-40">
            
            {saving && <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />}
            Lưu
          </button>
        </div>
      </div>

      <div className="mt-6 grid max-w-2xl gap-4 sm:grid-cols-2">
        <Field label="Tiêu đề · Tiếng Việt" htmlFor="nr-heading-vi" hint="Tiêu đề danh sách trên cửa hàng.">
          <input
            id="nr-heading-vi"
            value={form.title.vi}
            onChange={(e) => setForm((f) => ({ ...f, title: { ...f.title, vi: e.target.value } }))}
            className={inputClass} />
          
        </Field>
        <Field label="Tiêu đề · English" htmlFor="nr-heading-en">
          <input
            id="nr-heading-en"
            value={form.title.en}
            onChange={(e) => setForm((f) => ({ ...f, title: { ...f.title, en: e.target.value } }))}
            className={inputClass} />
          
        </Field>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* Selected, ordered */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.02]">
          <div className="flex items-baseline justify-between border-b border-white/10 px-5 py-4">
            <h3 className="font-medium">Đang hiển thị</h3>
            <span className={`text-sm tabular-nums ${full ? "text-ember" : "text-white/50"}`}>
              {selected.length}/{MAX_ITEMS}
            </span>
          </div>
          {selected.length === 0 ?
          <p className="px-5 py-14 text-center text-sm text-white/55">
              Chưa có bài nào. Mục này sẽ bị ẩn trên cửa hàng cho tới khi bạn thêm bài.
            </p> :

          <ol className="divide-y divide-white/[0.06]">
              {selected.map((t, i) =>
            <motion.li
              key={t.id}
              layout
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="flex items-center gap-3 px-4 py-3">
              
                  <span className="w-5 shrink-0 text-center text-sm tabular-nums text-white/45">{i + 1}</span>
                  <img src={t.cover} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="truncate text-xs text-white/50">
                      {t.album} · {formatPrice(t.price)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <IconAction label={`Đưa ${t.title} lên`} disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUpIcon className="h-4 w-4" aria-hidden />
                    </IconAction>
                    <IconAction label={`Đưa ${t.title} xuống`} disabled={i === selected.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDownIcon className="h-4 w-4" aria-hidden />
                    </IconAction>
                    <IconAction label={`Bỏ ${t.title} khỏi mục`} onClick={() => remove(t.id)} danger>
                      <XIcon className="h-4 w-4" aria-hidden />
                    </IconAction>
                  </div>
                </motion.li>
            )}
            </ol>
          }
        </div>

        {/* Available */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.02]">
          <div className="border-b border-white/10 px-5 py-4">
            <h3 className="font-medium">Thêm bài</h3>
            <label className="mt-3 flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 ring-1 ring-inset ring-white/10">
              <SearchIcon className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
              <span className="sr-only">Tìm bài để thêm</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm bài, album…"
                className="w-full min-w-0 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none" />
              
            </label>
          </div>
          {available.length === 0 ?
          <p className="px-5 py-10 text-center text-sm text-white/55">
              {tracks.length === form.trackIds.length ? "Tất cả bài đã nằm trong mục." : "Không tìm thấy bài phù hợp."}
            </p> :

          <ul className="max-h-[28rem] divide-y divide-white/[0.06] overflow-y-auto">
              {available.map((t) =>
            <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                  <img src={t.cover} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{t.title}</p>
                    <p className="truncate text-xs text-white/50">{t.album}</p>
                  </div>
                  <button
                type="button"
                onClick={() => add(t.id)}
                disabled={full}
                aria-label={`Thêm ${t.title}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-150 hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white/10 disabled:hover:text-white">
                
                    <PlusIcon className="h-4 w-4" aria-hidden />
                  </button>
                </li>
            )}
            </ul>
          }
          {full && <p className="border-t border-white/10 px-5 py-3 text-xs text-white/50">Đã đủ {MAX_ITEMS} bài. Bỏ bớt để thêm bài khác.</p>}
        </div>
      </div>
    </section>);

}

function IconAction({
  label,
  onClick,
  disabled,
  danger,
  children






}: {label: string;onClick: () => void;disabled?: boolean;danger?: boolean;children: React.ReactNode;}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition-colors duration-150 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent ${
      danger ? "hover:text-ember" : "hover:text-white"}`
      }>
      
      {children}
    </button>);

}