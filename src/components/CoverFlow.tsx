import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
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

  return (
    <div className="relative">
      <div
        className="relative mx-auto h-[340px] w-full md:h-[400px]"
        style={{ perspective: 1200 }}
        role="listbox"
        aria-label={t("featured")}>
        
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
                scale: isActive ? 1 : 1 - abs * 0.13,
                rotateY: offset * -8,
                opacity: hidden ? 0 : 1 - abs * 0.15
              }}
              transition={{ duration: 0.28, ease: EASE }}
              style={{ zIndex: 10 - abs, pointerEvents: hidden ? "none" : "auto" }}
              className="absolute left-1/2 top-0 -ml-[105px] w-[210px] md:-ml-[125px] md:w-[250px]">
              
              <button
                type="button"
                tabIndex={hidden ? -1 : 0}
                aria-label={isActive && isPlaying ? t("pauseTitle", { title: track.title }) : t("playTitle", { title: track.title })}
                onClick={() => {
                  onSelect(i);
                  onPlay(i);
                }}
                className={`block w-full rounded-[28px] p-2.5 text-left transition-all duration-200 active:scale-[0.98] ${
                  isActive
                    ? "liquid-glass-strong ring-1 ring-white/30 shadow-2xl"
                    : "liquid-glass hover:bg-neutral-900/80"
                }`}>
                
                <div className="aspect-square overflow-hidden rounded-[20px]">
                  <img src={track.cover} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="px-2 pb-1.5 pt-3 text-center">
                  <p className={`truncate text-lg font-medium ${isActive && isPlaying ? "text-ember" : "text-white"}`}>{track.title}</p>
                  <p className="truncate text-sm text-white/60">{track.album}</p>
                </div>
              </button>
            </motion.div>);

        })}
      </div>

      <div className="mt-2 flex justify-center gap-3">
        <button
          type="button"
          aria-label={t("prevTrack")}
          onClick={() => onSelect((activeIndex - 1 + n) % n)}
          className="liquid-glass flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform duration-150 active:scale-95">
          
          <ChevronLeftIcon className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={t("nextTrack")}
          onClick={() => onSelect((activeIndex + 1) % n)}
          className="liquid-glass flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform duration-150 active:scale-95">
          
          <ChevronRightIcon className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>);

}

function useSpacing() {
  const get = () => {
    if (typeof window === "undefined") return 200;
    const w = window.innerWidth;
    return w < 768 ? 120 : w < 1280 ? 200 : 260;
  };
  const [spacing, setSpacing] = useState(get);
  useEffect(() => {
    const onResize = () => setSpacing(get());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return spacing;
}