import React from "react";
import { FastForwardIcon, PauseIcon, PlayIcon, RewindIcon, ShoppingBagIcon } from "lucide-react";
import { VolumeControl } from "./VolumeControl";
import { useLanguage } from "../contexts/LanguageContext";
import { Track } from "../types/track";
import { formatPrice, formatTime } from "../utils/format";

interface PlayerBarProps {
  track: Track;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  muted: boolean;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (s: number) => void;
  onVolumeChange: (v: number) => void;
  onToggleMute: () => void;
  onBuy: () => void;
}

export function PlayerBar({
  track,
  isPlaying,
  progress,
  duration,
  volume,
  muted,
  onToggle,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onBuy
}: PlayerBarProps) {
  const { t } = useLanguage();
  const pct = duration > 0 ? Math.min(100, progress / duration * 100) : 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 px-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 md:px-8 md:pb-4">
      <div
        role="region"
        aria-label={t("player")}
        className="liquid-glass-strong mx-auto max-w-6xl overflow-hidden rounded-[24px] p-2 sm:rounded-full sm:p-2 md:px-4">
        
        <div className="flex items-center gap-2 md:gap-4">
          {/* Mobile: Cover + Track Info on the left (like Apple Music / Spotify iOS) */}
          <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-1 py-0.5 sm:order-2 sm:bg-black/45 sm:px-2.5 sm:py-1.5">
            <img src={track.cover} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover sm:h-10 sm:w-10 sm:rounded-lg" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-center gap-1.5 truncate">
                  <p className="truncate text-sm font-semibold text-white sm:font-medium">{track.title}</p>
                  {track.demoEnd && track.demoEnd > (track.demoStart || 0) && (
                    <span className="shrink-0 rounded-md bg-ember/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ember">
                      Demo
                    </span>
                  )}
                </div>
                <span className="hidden shrink-0 text-xs tabular-nums text-white/50 sm:inline">
                  {formatTime(progress)} / {formatTime(duration)}
                </span>
              </div>
              <p className="truncate text-xs text-white/60">
                {track.artist}
                <span className="ml-1.5 tabular-nums text-white/45 sm:hidden">
                  · {formatTime(progress)} / {formatTime(duration)}
                </span>
              </p>

              {/* Desktop/Tablet inline seekbar */}
              <label className="relative mt-1 hidden h-1 w-full sm:block">
                <span className="sr-only">{t("seek")}</span>
                <span className="absolute inset-0 rounded-full bg-white/15" />
                <span className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${pct}%` }} />
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, Math.floor(duration))}
                  value={Math.floor(progress)}
                  onChange={(e) => onSeek(Number(e.target.value))}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
              </label>
            </div>
          </div>

          {/* Playback controls */}
          <div className="flex shrink-0 items-center sm:order-1">
            <IconBtn label={t("prevTrack")} onClick={onPrev} className="hidden sm:flex">
              <RewindIcon className="h-5 w-5 fill-white" aria-hidden />
            </IconBtn>
            <IconBtn label={isPlaying ? t("pause") : t("play")} onClick={onToggle}>
              {isPlaying ? <PauseIcon className="h-5 w-5 fill-white" aria-hidden /> : <PlayIcon className="h-5 w-5 fill-white" aria-hidden />}
            </IconBtn>
            <IconBtn label={t("nextTrack")} onClick={onNext}>
              <FastForwardIcon className="h-4 w-4 fill-white sm:h-5 sm:w-5" aria-hidden />
            </IconBtn>
          </div>

          {/* Volume control (Desktop only — mobile uses hardware volume buttons) */}
          <div className="hidden md:order-3 md:block">
            <VolumeControl volume={volume} muted={muted} onVolumeChange={onVolumeChange} onToggleMute={onToggleMute} />
          </div>

          {/* Buy button */}
          <button
            type="button"
            onClick={onBuy}
            aria-label={t("buyAria", { title: track.title, price: formatPrice(track.price) })}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-black shadow-md transition-transform duration-150 hover:bg-white/90 active:scale-95 sm:order-4 sm:px-4 sm:py-2.5 sm:text-sm sm:font-medium">
            
            <ShoppingBagIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
            <span className="sm:hidden">{formatPrice(track.price)}</span>
            <span className="hidden sm:inline">{t("buyPrice", { price: formatPrice(track.price) })}</span>
          </button>
        </div>

        {/* Mobile full-width touch seekbar */}
        <label className="relative mt-1.5 block h-1.5 w-full px-1 sm:hidden">
          <span className="sr-only">{t("seek")}</span>
          <span className="absolute inset-x-1 inset-y-0 rounded-full bg-white/15" />
          <span className="absolute inset-y-0 left-1 rounded-full bg-ember" style={{ width: `calc(${pct}% - 4px)` }} />
          <input
            type="range"
            min={0}
            max={Math.max(1, Math.floor(duration))}
            value={Math.floor(progress)}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
      </div>
    </div>);

}

function IconBtn({
  label,
  onClick,
  className = "",
  children
}: {label: string;onClick?: () => void;className?: string;children: React.ReactNode;}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-full text-white transition-[background-color,transform] duration-150 hover:bg-white/10 active:scale-90 sm:h-11 sm:w-11 ${className}`}>
      
      {children}
    </button>);

}