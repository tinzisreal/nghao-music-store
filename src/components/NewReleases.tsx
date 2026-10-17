import React from "react";
import { PauseIcon, PlayIcon, SparklesIcon, CheckIcon, ShoppingBagIcon } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useCart } from "../contexts/CartContext";
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
  const { isInCart, addToCart, removeFromCart } = useCart();

  return (
    <section aria-labelledby="new-releases-title" className="progressive-card-glass rounded-[26px] p-2.5 sm:rounded-[32px] sm:p-4 md:p-5">
      <div className="flex items-baseline justify-between px-2.5 pb-2.5 pt-1 sm:px-3 sm:pb-3">
        <h2 id="new-releases-title" className="text-lg font-semibold text-white sm:text-xl">
          {pick(title)}
        </h2>
        <span className="text-xs text-white/50 sm:text-sm">{t("songCount", { n: tracks.length })}</span>
      </div>

      <ul className="flex flex-col gap-1">
        {tracks.map((track, i) => {
          const active = track.id === currentId;
          const playing = active && isPlaying;
          return (
            <li
              key={track.id}
              className={`group grid grid-cols-[1fr_auto] items-center gap-2.5 rounded-2xl px-2.5 py-2 transition-colors duration-150 sm:grid-cols-[2rem_1fr_auto] sm:gap-3 sm:px-3 sm:py-2.5 md:grid-cols-[2rem_1fr_7rem_4rem_auto] md:gap-4 ${
                active ? "bg-white/[0.13] ring-1 ring-inset ring-white/15" : "hover:bg-white/[0.06]"
              }`}>
              
              <button
                type="button"
                onClick={() => track.isPreorder ? onBuy(track) : onPlay(track.id)}
                aria-label={track.isPreorder ? `Pre-order ${track.title}` : (playing ? t("pauseTitle", { title: track.title }) : t("playTitle", { title: track.title }))}
                className="hidden h-8 w-8 items-center justify-center text-sm tabular-nums text-white/50 sm:flex">
                
                {track.isPreorder ? (
                  <SparklesIcon className="h-4 w-4 fill-amber-300 text-amber-300" aria-hidden />
                ) : playing ? (
                  <PauseIcon className="h-4 w-4 fill-ember text-ember" aria-hidden />
                ) : (
                  <>
                    <span className={`group-hover:hidden ${active ? "text-ember font-semibold" : ""}`}>{i + 1}</span>
                    <PlayIcon className="hidden h-4 w-4 fill-white text-white group-hover:block" aria-hidden />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => track.isPreorder ? onBuy(track) : onPlay(track.id)}
                className="flex min-w-0 items-center gap-3 text-left">
                
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl sm:h-11 sm:w-11 sm:rounded-lg">
                  <img src={track.cover} alt="" className="h-full w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/40 sm:hidden">
                    {track.isPreorder ? (
                      <SparklesIcon className="h-4 w-4 fill-amber-300 text-amber-300" aria-hidden />
                    ) : playing ? (
                      <PauseIcon className="h-4 w-4 fill-ember text-ember" aria-hidden />
                    ) : (
                      <PlayIcon className="ml-0.5 h-4 w-4 fill-white text-white" aria-hidden />
                    )}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className={`truncate text-sm font-semibold sm:text-base sm:font-medium ${active ? "text-ember" : "text-white"}`}>
                    {track.title}
                  </p>
                  <p className="truncate text-xs text-white/55 sm:text-sm">
                    {track.album} <span className="md:hidden">· {track.isPreorder ? (track.duration > 0 ? formatTime(track.duration) : "Pre-order") : formatTime(track.duration)}</span>
                  </p>
                </div>
              </button>

              <span className="hidden text-sm text-white/55 md:block">{track.genre}</span>
              <span className="hidden text-right text-sm tabular-nums text-white/55 md:block">
                {track.isPreorder ? (track.duration > 0 ? formatTime(track.duration) : "Pre-order") : formatTime(track.duration)}
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onBuy(track)}
                  aria-label={track.isPreorder ? `Pre-order ${track.title}` : t("buyAria", { title: track.title, price: formatPrice(track.price) })}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-95 sm:px-3.5 sm:text-sm ${
                    track.isPreorder
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold shadow-md shadow-amber-500/20 hover:brightness-110"
                      : "bg-white/12 text-white ring-1 ring-inset ring-white/20 hover:bg-white hover:text-black sm:font-medium"
                  }`}>
                  {track.isPreorder ? `Pre-order · ${formatPrice(track.price)}` : formatPrice(track.price)}
                </button>

                {!track.isPreorder && Math.max(0, Math.floor(Number(track.price) || 0)) > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      isInCart(track.id) ? removeFromCart(track.id) : addToCart(track);
                    }}
                    title={isInCart(track.id) ? "Đã trong giỏ hàng (Bấm để xóa)" : "Thêm vào giỏ hàng"}
                    aria-label={isInCart(track.id) ? "Đã trong giỏ hàng" : "Thêm vào giỏ hàng"}
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all duration-150 active:scale-90 ${
                      isInCart(track.id)
                        ? "bg-ember text-black shadow-md shadow-amber-500/30 ring-1 ring-amber-400 font-bold"
                        : "bg-white/10 text-white/80 ring-1 ring-white/15 hover:bg-white/20 hover:text-white"
                    }`}
                  >
                    {isInCart(track.id) ? (
                      <CheckIcon className="h-4 w-4 stroke-[2.5]" />
                    ) : (
                      <ShoppingBagIcon className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            </li>);

        })}
      </ul>
    </section>);

}