import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDownIcon, SearchIcon } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { Track } from "../types/track";
import { formatPrice, formatTime } from "../utils/format";

interface AllTracksProps {
  tracks: Track[];
  currentId: string;
  isPlaying: boolean;
  onPlay: (id: string) => void;
  onBuy: (track: Track) => void;
}

const PAGE_SIZE = 12;
const ALL = "__all__";

export function AllTracks({ tracks, currentId, isPlaying, onPlay, onBuy }: AllTracksProps) {
  const { t } = useLanguage();
  const [genre, setGenre] = useState(ALL);
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const genres = useMemo(() => [ALL, ...Array.from(new Set(tracks.map((tr) => tr.genre)))], [tracks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tracks.filter(
      (tr) => (genre === ALL || tr.genre === genre) && (!q || `${tr.title} ${tr.album} ${tr.genre}`.toLowerCase().includes(q))
    );
  }, [tracks, genre, query]);

  useEffect(() => setVisible(PAGE_SIZE), [genre, query]);

  const shown = filtered.slice(0, visible);
  const remaining = filtered.length - shown.length;

  return (
    <section aria-labelledby="all-tracks-title">
      <div className="mb-4 flex flex-col gap-3 px-1 md:flex-row md:items-center md:justify-between">
        <div className="flex items-baseline gap-3">
          <h2 id="all-tracks-title" className="text-xl font-semibold text-white">
            {t("allTracks")}
          </h2>
          <span className="text-sm text-white/55">{t("songCount", { n: filtered.length })}</span>
        </div>
        <label className="liquid-glass flex items-center gap-2 rounded-full px-4 py-2.5 md:w-72">
          <SearchIcon className="h-4 w-4 shrink-0 text-white/60" aria-hidden />
          <span className="sr-only">{t("searchTracks")}</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full min-w-0 bg-transparent text-sm text-white placeholder:text-white/45 focus:outline-none" />
          
        </label>
      </div>

      <div role="tablist" aria-label={t("filterGenre")} className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-1">
        {genres.map((g) => {
          const active = g === genre;
          return (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setGenre(g)}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition-colors duration-150 ${
              active ? "bg-white font-medium text-black" : "liquid-glass text-white/80 hover:text-white"}`
              }>
              
              {g === ALL ? t("all") : g}
            </button>);

        })}
      </div>

      {filtered.length === 0 ?
      <div className="liquid-glass-strong rounded-[28px] px-6 py-14 text-center">
          <p className="text-white/70">{t("noResults")}</p>
          <button
          type="button"
          onClick={() => {
            setQuery("");
            setGenre(ALL);
          }}
          className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-medium text-black">
          
            {t("clearFilters")}
          </button>
        </div> :

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
          {shown.map((track, i) => {
          const active = track.id === currentId;
          const playing = active && isPlaying;
          const isNewBatch = visible > PAGE_SIZE && i >= visible - PAGE_SIZE;
          return (
            <motion.li
              key={track.id}
              initial={isNewBatch ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: isNewBatch ? i % PAGE_SIZE * 0.03 : 0, ease: [0.23, 1, 0.32, 1] }}
              className={`liquid-glass flex flex-col rounded-[24px] p-2.5 ${active ? "ring-1 ring-ember/70" : ""}`}>
              
                <button
                type="button"
                onClick={() => onPlay(track.id)}
                aria-label={playing ? t("pauseTitle", { title: track.title }) : t("playTitle", { title: track.title })}
                className="group block text-left">
                
                  <div className="relative aspect-square overflow-hidden rounded-[16px]">
                    <img src={track.cover} alt="" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" />
                    <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white/90 backdrop-blur">
                      {track.genre}
                    </span>
                  </div>
                  <div className="px-1.5 pb-3 pt-3">
                    <p className={`truncate font-medium ${active ? "text-ember" : "text-white"}`}>{track.title}</p>
                    <p className="truncate text-sm text-white/55">
                      {track.album} · {formatTime(track.duration)}
                    </p>
                  </div>
                </button>

                <button
                type="button"
                onClick={() => onBuy(track)}
                aria-label={t("buyAria", { title: track.title, price: formatPrice(track.price) })}
                className="mt-auto whitespace-nowrap rounded-full bg-white/10 px-3 py-2 text-sm font-medium text-white ring-1 ring-inset ring-white/20 transition-colors duration-150 hover:bg-white hover:text-black">
                
                  {t("buy")} · {formatPrice(track.price)}
                </button>
              </motion.li>);

        })}
        </ul>
      }

      {(remaining > 0 || visible > PAGE_SIZE) && filtered.length > 0 &&
      <div className="mt-6 flex justify-center">
          <button
          type="button"
          onClick={() => remaining > 0 ? setVisible((v) => v + PAGE_SIZE) : setVisible(PAGE_SIZE)}
          className="liquid-glass flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium text-white transition-transform duration-150 active:scale-95">
          
            {remaining > 0 ? t("showMore", { n: Math.min(remaining, PAGE_SIZE) }) : t("showLess")}
            <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${remaining > 0 ? "" : "rotate-180"}`} aria-hidden />
          </button>
        </div>
      }
    </section>);

}