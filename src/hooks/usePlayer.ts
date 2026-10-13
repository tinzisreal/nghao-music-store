import { useCallback, useEffect, useRef, useState } from "react";
import { Track } from "../types/track";

/**
 * Plays real audio when a track has `audioUrl`, otherwise simulates
 * playback so the UI still works with placeholder data.
 */
export function usePlayer(list: Track[]) {
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [volume, setVolume] = useState(70);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const current = list[Math.min(index, list.length - 1)];
  const audioUrl = current?.audioUrl;
  const count = list.length;

  const hasDemo = Boolean(current && current.demoEnd && current.demoEnd > (current.demoStart || 0));
  const demoStart = hasDemo ? (current?.demoStart || 0) : 0;
  const demoEnd = hasDemo ? (current?.demoEnd || 0) : (audioDuration ?? current?.duration ?? 0);
  const demoDuration = Math.max(1, demoEnd - demoStart);

  // Audio duration represents the demo length on store
  const duration = hasDemo ? demoDuration : (audioDuration ?? current?.duration ?? 0);
  const relativeProgress = hasDemo ? Math.max(0, Math.min(demoDuration, progress - demoStart)) : progress;

  // Create the audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, []);

  // Audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      const cur = audio.currentTime;
      setProgress(cur);
      // Auto loop or stop when reaching demoEnd
      if (current?.demoEnd && current.demoEnd > 0 && cur >= current.demoEnd) {
        audio.currentTime = current.demoStart || 0;
        setProgress(audio.currentTime);
      }
    };
    const onMeta = () => Number.isFinite(audio.duration) && setAudioDuration(audio.duration);
    const onEnded = () => {
      setIndex((i) => (i + 1) % count);
      setProgress(0);
    };
    const onError = () => setIsPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [count, current?.demoStart, current?.demoEnd]);

  // Swap source when the track changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setAudioDuration(null);
    if (audioUrl) {
      audio.src = audioUrl;
      const start = current?.demoStart || 0;
      audio.currentTime = start;
      setProgress(start);
    } else {
      audio.pause();
      audio.removeAttribute("src");
    }
  }, [audioUrl, current?.id, current?.demoStart]);

  // Play / pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    if (isPlaying) audio.play().catch(() => setIsPlaying(false));else
    audio.pause();
  }, [isPlaying, audioUrl, current?.id]);

  // Volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume / 100;
  }, [volume, muted]);

  // Simulated playback when there is no audio file
  useEffect(() => {
    if (!isPlaying || audioUrl || !current) return;
    const id = window.setInterval(() => {
      setProgress((p) => {
        if (p + 1 >= current.duration) {
          setIndex((i) => (i + 1) % count);
          return 0;
        }
        return p + 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [isPlaying, audioUrl, current, count]);

  const select = useCallback((i: number) => {
    setIndex(i);
    setProgress(0);
  }, []);

  const playAt = useCallback(
    (i: number) => {
      if (i < 0) return;
      if (i === index) {
        setIsPlaying((p) => !p);
        return;
      }
      setIndex(i);
      setProgress(0);
      setIsPlaying(true);
    },
    [index]
  );

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % count);
    setProgress(0);
  }, [count]);

  const seek = useCallback(
    (s: number) => {
      const targetTime = hasDemo ? demoStart + s : s;
      if (audioUrl && audioRef.current) audioRef.current.currentTime = targetTime;
      setProgress(targetTime);
    },
    [audioUrl, hasDemo, demoStart]
  );

  const prev = useCallback(() => {
    if (relativeProgress > 3) {
      seek(0);
      return;
    }
    setIndex((i) => (i - 1 + count) % count);
    setProgress(0);
  }, [count, relativeProgress, seek]);

  const toggle = useCallback(() => setIsPlaying((p) => !p), []);

  const changeVolume = useCallback((v: number) => {
    setVolume(v);
    setMuted(v === 0);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => volume === 0 ? false : !m);
  }, [volume]);

  return {
    index,
    current,
    isPlaying,
    progress: relativeProgress,
    duration,
    volume,
    muted,
    select,
    playAt,
    next,
    prev,
    toggle,
    seek,
    changeVolume,
    toggleMute
  };
}