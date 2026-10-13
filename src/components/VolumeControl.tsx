import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Volume1Icon, Volume2Icon, VolumeXIcon } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";

interface VolumeControlProps {
  volume: number;
  muted: boolean;
  onVolumeChange: (v: number) => void;
  onToggleMute: () => void;
}

export function VolumeControl({ volume, muted, onVolumeChange, onToggleMute }: VolumeControlProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const level = muted ? 0 : volume;
  const Icon = level === 0 ? VolumeXIcon : level < 50 ? Volume1Icon : Volume2Icon;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative flex shrink-0 items-center gap-2">
      <button
        type="button"
        aria-label={t("volume")}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors duration-150 hover:bg-white/10 md:hidden">
        
        <Icon className="h-5 w-5" aria-hidden />
      </button>

      <button
        type="button"
        aria-label={muted ? t("unmute") : t("mute")}
        onClick={onToggleMute}
        className="hidden h-11 w-11 items-center justify-center rounded-full text-white transition-colors duration-150 hover:bg-white/10 md:flex">
        
        <Icon className="h-5 w-5" aria-hidden />
      </button>
      <div className="hidden w-24 md:block">
        <Slider value={level} onChange={onVolumeChange} label={t("volume")} />
      </div>

      <AnimatePresence>
        {open &&
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.96 }}
          transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
          className="liquid-glass-strong absolute bottom-full right-0 mb-4 flex w-56 items-center gap-3 rounded-full px-4 py-3 md:hidden">
          
            <button type="button" aria-label={muted ? t("unmute") : t("mute")} onClick={onToggleMute} className="text-white">
              <Icon className="h-4 w-4" aria-hidden />
            </button>
            <div className="flex-1">
              <Slider value={level} onChange={onVolumeChange} label={t("volume")} />
            </div>
            <span className="w-7 text-right text-xs tabular-nums text-white/60">{level}</span>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}

function Slider({ value, onChange, label }: {value: number;onChange: (v: number) => void;label: string;}) {
  return (
    <label className="group relative flex h-4 w-full items-center">
      <span className="sr-only">{label}</span>
      <span className="absolute inset-x-0 h-1 rounded-full bg-white/15" />
      <span className="absolute left-0 h-1 rounded-full bg-white" style={{ width: `${value}%` }} />
      <span
        className="absolute h-3 w-3 -translate-x-1/2 rounded-full bg-white opacity-0 shadow transition-opacity duration-150 group-hover:opacity-100"
        style={{ left: `${value}%` }} />
      
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      
    </label>);

}