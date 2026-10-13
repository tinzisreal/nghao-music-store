import React from "react";
import { PauseIcon, PlayIcon } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { Track } from "../types/track";
import { LocalizedText } from "../types/store";
import { formatPrice, formatTime } from "../utils/format";

interface NewReleasesProps {
  title: LocalizedText;
  tracks: Track[];
  currentId: string;
  isPlaying: boolean;
  onPlay: (id: string) => void;
  onBuy: (track: Track) => void;
}

export function NewReleases({ title, tracks, currentId, isPlaying, onPlay, onBuy }: NewReleasesProps) {
  const { t, pick } = useLanguage();

  return (
    <section aria-labelledby="new-releases-title" className="liquid-glass-strong rounded-[32px] p-3 md:p-5">
      <div className="flex items-baseline justify-between px-3 pb-3 pt-1">
        <h2 id="new-releases-title" className="text-xl font-semibold text-white">
          {pick(title)}
        </h2>
        <span className="text-sm text-white/50">{t("songCount", { n: tracks.length })}</span>
      </div>

      <ul className="flex flex-col">
        {tracks.map((track, i) => {
          const active = track.id === currentId;
          return (
            <li
              key={track.id}
              className={`group grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors duration-150 md:grid-cols-[2rem_1fr_7rem_4rem_auto] md:gap-4 ${
              active ? "bg-white/[0.12]" : "hover:bg-white/[0.06]"}`
              }>
              
              <button
                type="button"
                onClick={() => onPlay(track.id)}
                aria-label={active && isPlaying ? t("pauseTitle", { title: track.title }) : t("playTitle", { title: track.title })}
                className="flex h-8 w-8 items-center justify-center text-sm tabular-nums text-white/50">
                
                {active && isPlaying ?
                <PauseIcon className="h-4 w-4 fill-ember text-ember" aria-hidden /> :

                <>
                    <span className={`group-hover:hidden ${active ? "text-ember" : ""}`}>{i + 1}</span>
                    <PlayIcon className="hidden h-4 w-4 fill-white text-white group-hover:block" aria-hidden />
                  </>
                }
              </button>

              <button type="button" tabIndex={-1} onClick={() => onPlay(track.id)} className="flex min-w-0 items-center gap-3 text-left">
                <img src={track.cover} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0">
                  <p className={`truncate font-medium ${active ? "text-ember" : "text-white"}`}>{track.title}</p>
                  <p className="truncate text-sm text-white/55">{track.album}</p>
                </div>
              </button>

              <span className="hidden text-sm text-white/55 md:block">{track.genre}</span>
              <span className="hidden text-right text-sm tabular-nums text-white/55 md:block">{formatTime(track.duration)}</span>

              <button
                type="button"
                onClick={() => onBuy(track)}
                aria-label={t("buyAria", { title: track.title, price: formatPrice(track.price) })}
                className="whitespace-nowrap rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white ring-1 ring-inset ring-white/20 transition-colors duration-150 hover:bg-white hover:text-black">
                
                {formatPrice(track.price)}
              </button>
            </li>);

        })}
      </ul>
    </section>);

}