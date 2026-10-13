import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { Track } from "../types/track";

interface CoverFlowProps {
  tracks: Track[];
  activeIndex: number;
  isPlaying: boolean;
  onSelect: (i: number) => void;
  onPlay: (i: number) => void;
}

const EASE = [0.23, 1, 0.32, 1] as const;

export function CoverFlow({ tracks, activeIndex, isPlaying, onSelect, onPlay }: CoverFlowProps) {
  const { t } = useLanguage();
  const spacing = useSpacing();
  const n = tracks.length;
  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || n <= 1) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const diff = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(diff) > 40) {
      if (diff < 0) onSelect((activeIndex + 1) % n);
      else onSelect((activeIndex - 1 + n) % n);
    }
  };

  return (
    <div className="relative overflow-hidden py-2">
      <div
        className="relative mx-auto h-[290px] w-full sm:h-[340px] md:h-[400px]"
        style={{ perspective: 1200 }}
        role="listbox"
        aria-label={t("featured")}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}>
        
        {tracks.map((track, i) => {
          let offset = i - activeIndex;
          if (offset > n / 2) offset -= n;
          if (offset < -n / 2) offset += n;
          const abs = Math.abs(offset);
          const isActive = offset === 0;
          const hidden = abs > 2;

          return (
            <motion.div
              key={track.id}
              role="option"
              aria-selected={isActive}
              initial={false}
              animate={{
                x: offset * spacing,
                scale: isActive ? 1 : 1 - abs * 0.14,
                rotateY: offset * -8,
                opacity: hidden ? 0 : 1 - abs * 0.18
              }}
              transition={{ duration: 0.28, ease: EASE }}
              style={{ zIndex: 10 - abs, pointerEvents: hidden ? "none" : "auto" }}
              className="absolute left-1/2 top-0 -ml-[92px] w-[184px] sm:-ml-[105px] sm:w-[210px] md:-ml-[125px] md:w-[250px]">
              
              <button
                type="button"
                tabIndex={hidden ? -1 : 0}
                aria-label={isActive && isPlaying ? t("pauseTitle", { title: track.title }) : t("playTitle", { title: track.title })}
                onClick={() => {
                  onSelect(i);
                  onPlay(i);
                }}
                className={`block w-full rounded-[24px] p-2 text-left transition-all duration-200 active:scale-[0.98] sm:rounded-[28px] sm:p-2.5 ${
                  isActive
                    ? "liquid-glass-strong ring-1 ring-white/30 shadow-2xl"
                    : "liquid-glass hover:bg-neutral-900/80"
                }`}>
                
                <div className="relative aspect-square overflow-hidden rounded-[18px] sm:rounded-[20px]">
                  <img src={track.cover} alt="" className="h-full w-full object-cover" />
                  {isActive && (
                    <span className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-white ring-1 ring-white/25 backdrop-blur-md">
                      {isPlaying ? (
                        <PauseIcon className="h-4 w-4 fill-ember text-ember" aria-hidden />
                      ) : (
                        <PlayIcon className="ml-0.5 h-4 w-4 fill-white text-white" aria-hidden />
                      )}
                    </span>
                  )}
                </div>
                <div className="px-1.5 pb-1 pt-2.5 text-center sm:px-2 sm:pb-1.5 sm:pt-3">
                  <p className={`truncate text-base font-semibold sm:text-lg ${isActive && isPlaying ? "text-ember" : "text-white"}`}>
                    {track.title}
                  </p>
                  <p className="truncate text-xs text-white/60 sm:text-sm">{track.album}</p>
                </div>
              </button>
            </motion.div>);

        })}
      </div>

      {n > 1 && (
        <div className="mt-1 flex justify-center gap-3 sm:mt-2">
          <button
            type="button"
            aria-label={t("prevTrack")}
            onClick={() => onSelect((activeIndex - 1 + n) % n)}
            className="liquid-glass flex h-9 w-9 items-center justify-center rounded-full text-white transition-transform duration-150 active:scale-95 sm:h-10 sm:w-10">
            
            <ChevronLeftIcon className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t("nextTrack")}
            onClick={() => onSelect((activeIndex + 1) % n)}
            className="liquid-glass flex h-9 w-9 items-center justify-center rounded-full text-white transition-transform duration-150 active:scale-95 sm:h-10 sm:w-10">
            
            <ChevronRightIcon className="h-5 w-5" aria-hidden />
          </button>
        </div>
      )}
    </div>);

}

function useSpacing() {
  const get = () => {
    if (typeof window === "undefined") return 200;
    const w = window.innerWidth;
    return w < 640 ? 96 : w < 768 ? 130 : w < 1280 ? 200 : 260;
  };
  const [spacing, setSpacing] = useState(get);
  useEffect(() => {
    const onResize = () => setSpacing(get());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return spacing;
}