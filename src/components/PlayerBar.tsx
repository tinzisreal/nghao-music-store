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
    <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-4 md:px-8">
      <div
        role="region"
        aria-label={t("player")}
        className="liquid-glass mx-auto flex max-w-6xl items-center gap-2 rounded-full p-2 md:gap-4 md:px-4">
        
        <div className="flex items-center">
          <IconBtn label={t("prevTrack")} onClick={onPrev} className="hidden sm:flex">
            <RewindIcon className="h-5 w-5 fill-white" aria-hidden />
          </IconBtn>
          <IconBtn label={isPlaying ? t("pause") : t("play")} onClick={onToggle}>
            {isPlaying ? <PauseIcon className="h-5 w-5 fill-white" aria-hidden /> : <PlayIcon className="h-5 w-5 fill-white" aria-hidden />}
          </IconBtn>
          <IconBtn label={t("nextTrack")} onClick={onNext}>
            <FastForwardIcon className="h-5 w-5 fill-white" aria-hidden />
          </IconBtn>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-black/45 px-2 py-1.5">
          <img src={track.cover} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-center gap-1.5 truncate">
                <p className="truncate text-sm font-medium text-white">{track.title}</p>
                {track.demoEnd && track.demoEnd > (track.demoStart || 0) && (
                  <span className="shrink-0 rounded-md bg-ember/20 px-1.5 py-0.2 text-[10px] font-semibold uppercase tracking-wider text-ember">
                    Demo
                  </span>
                )}
              </div>
              <span className="hidden shrink-0 text-xs tabular-nums text-white/50 sm:inline">
                {formatTime(progress)} / {formatTime(duration)}
              </span>
            </div>
            <p className="truncate text-xs text-white/55">{track.artist}</p>
            <label className="relative mt-1 block h-1 w-full">
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

        <VolumeControl volume={volume} muted={muted} onVolumeChange={onVolumeChange} onToggleMute={onToggleMute} />

        <button
          type="button"
          onClick={onBuy}
          aria-label={t("buyAria", { title: track.title, price: formatPrice(track.price) })}
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-4 py-2.5 text-sm font-medium text-black transition-colors duration-150 hover:bg-white/90">
          
          <ShoppingBagIcon className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{t("buyPrice", { price: formatPrice(track.price) })}</span>
        </button>
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
      className={`flex h-11 w-11 items-center justify-center rounded-full text-white transition-[background-color,transform] duration-150 hover:bg-white/10 active:scale-95 ${className}`}>
      
      {children}
    </button>);

}