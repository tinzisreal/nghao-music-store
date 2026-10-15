import { useCallback, useEffect, useRef, useState } from "react";
import { Track } from "../types/track";
import { api } from "../utils/api";

/**
 * Mobile-friendly audio player hook with direct user-gesture unlocking
 * for iOS Safari, Android Chrome, and modern web browsers.
 */
export function usePlayer(list: Track[]) {
  const firstPlayableIndex = list.findIndex((t) => !t.isPreorder);
  const [index, setIndex] = useState(firstPlayableIndex >= 0 ? firstPlayableIndex : 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [volume, setVolume] = useState(70);
  const [muted, setMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const indexRef = useRef(index);
  indexRef.current = index;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const listRef = useRef(list);
  listRef.current = list;
  const lastTrackedPlayIdRef = useRef<{ id: string; time: number } | null>(null);

  const current = list[Math.min(index, Math.max(0, list.length - 1))];
  const audioUrl = current?.audioUrl;
  const count = list.length;

  const hasDemo = Boolean(current && current.demoEnd && current.demoEnd > (current.demoStart || 0));
  const demoStart = hasDemo ? (current?.demoStart || 0) : 0;
  const demoEnd = hasDemo ? (current?.demoEnd || 0) : (audioDuration ?? current?.duration ?? 0);
  const demoDuration = Math.max(1, demoEnd - demoStart);

  // Audio duration represents the demo length on store
  const duration = hasDemo ? demoDuration : (audioDuration ?? current?.duration ?? 0);
  const relativeProgress = hasDemo ? Math.max(0, Math.min(demoDuration, progress - demoStart)) : progress;

  // Khởi tạo audio element gắn vào DOM với các thuộc tính tương thích cao cho iOS Safari
  useEffect(() => {
    let audio = audioRef.current;
    if (!audio && typeof document !== "undefined") {
      audio = document.createElement("audio");
      audio.preload = "auto";
      (audio as unknown as { playsInline: boolean }).playsInline = true;
      audio.setAttribute("playsinline", "true");
      audio.setAttribute("webkit-playsinline", "true");
      audio.style.display = "none";
      document.body.appendChild(audio);
      audioRef.current = audio;
    }

    return () => {
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        try {
          audio.remove();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  // Lắng nghe các sự kiện của thẻ audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      const cur = audio.currentTime;
      setProgress(cur);
      const curTrack = listRef.current[indexRef.current];
      // Tự động lặp lại khi phát hết đoạn demo
      if (curTrack?.demoEnd && curTrack.demoEnd > 0 && cur >= curTrack.demoEnd) {
        audio.currentTime = curTrack.demoStart || 0;
        setProgress(audio.currentTime);
      }
    };

    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setAudioDuration(audio.duration);
      }
    };

    const onEnded = () => {
      const nextIdx = (indexRef.current + 1) % Math.max(1, listRef.current.length);
      setIndex(nextIdx);
      setProgress(0);
      const nextTrack = listRef.current[nextIdx];
      if (nextTrack?.audioUrl && audioRef.current) {
        audioRef.current.src = nextTrack.audioUrl;
        const start = nextTrack.demoStart || 0;
        if (start > 0) audioRef.current.currentTime = start;
        audioRef.current.play().catch(() => setIsPlaying(false));
      }
    };

    const onPlayEvent = () => setIsPlaying(true);
    const onPauseEvent = () => setIsPlaying(false);
    const onError = () => {
      // Khi gặp lỗi load mạng, thử khôi phục trạng thái
      setIsPlaying(false);
    };

    const onCanPlay = () => {
      if (isPlayingRef.current && audio.paused) {
        audio.play().catch(() => {});
      }
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlayEvent);
    audio.addEventListener("pause", onPauseEvent);
    audio.addEventListener("error", onError);
    audio.addEventListener("canplay", onCanPlay);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlayEvent);
      audio.removeEventListener("pause", onPauseEvent);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("canplay", onCanPlay);
    };
  }, []);

  // Điều khiển âm lượng
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume / 100;
    }
  }, [volume, muted]);

  // Ghi nhận lượt nghe bài hát vào Analytics (debounce 15 giây)
  useEffect(() => {
    if (!isPlaying || !current?.id || current.isPreorder) return;
    const now = Date.now();
    const last = lastTrackedPlayIdRef.current;
    if (!last || last.id !== current.id || now - last.time > 15000) {
      lastTrackedPlayIdRef.current = { id: current.id, time: now };
      api.trackEvent({
        type: "play",
        trackId: current.id,
        trackTitle: current.title
      });
    }
  }, [isPlaying, current?.id, current?.title, current?.isPreorder]);

  // Đồng bộ src khi thay đổi track được chọn
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audioUrl) {
      if (!audio.src || (!audio.src.endsWith(audioUrl) && audio.src !== audioUrl)) {
        if (!isPlayingRef.current) {
          audio.src = audioUrl;
          const start = current?.demoStart || 0;
          if (start > 0 && Number.isFinite(audio.duration)) {
            audio.currentTime = start;
          }
        }
      }
    } else {
      audio.pause();
      audio.removeAttribute("src");
    }
  }, [audioUrl, current?.id, current?.demoStart]);

  // Trình phát giả lập nếu bài không có file âm thanh
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

  /**
   * Phát hoặc dừng bài hát trực tiếp trong call stack của click event
   * (Đảm bảo tương thích 100% với iOS Safari & Android Chrome)
   */
  const playAt = useCallback(
    (i: number) => {
      if (i < 0 || i >= list.length) return;
      const target = list[i];
      if (target?.isPreorder) return;
      const audio = audioRef.current;

      if (i === index) {
        if (isPlaying) {
          if (audio) audio.pause();
          setIsPlaying(false);
        } else {
          setIsPlaying(true);
          if (audio && target?.audioUrl) {
            if (!audio.src || (!audio.src.endsWith(target.audioUrl) && audio.src !== target.audioUrl)) {
              audio.src = target.audioUrl;
            }
            if (audio.ended) {
              audio.currentTime = 0;
            }
            audio.play().catch((err) => {
              console.warn("Mobile autoplay restriction:", err);
              setIsPlaying(false);
            });
          }
        }
        return;
      }

      // Đổi sang bài mới
      setIndex(i);
      setProgress(0);
      setIsPlaying(true);

      if (audio && target?.audioUrl) {
        audio.src = target.audioUrl;
        audio.currentTime = 0;

        const start = target.demoStart || 0;
        const onReady = () => {
          if (start > 0 && Number.isFinite(audio.duration) && audio.duration > start) {
            audio.currentTime = start;
          }
        };

        if (start > 0) {
          audio.addEventListener("loadedmetadata", onReady, { once: true });
        }

        audio.play().catch((err) => {
          console.warn("Mobile autoplay restriction on track change:", err);
          setIsPlaying(false);
        });
      }
    },
    [index, isPlaying, list]
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (isPlaying) {
      if (audio) audio.pause();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      if (audio && audioUrl) {
        if (!audio.src || (!audio.src.endsWith(audioUrl) && audio.src !== audioUrl)) {
          audio.src = audioUrl;
        }
        if (audio.ended) {
          audio.currentTime = 0;
        }
        audio.play().catch((err) => {
          console.warn("Mobile autoplay restriction:", err);
          setIsPlaying(false);
        });
      }
    }
  }, [isPlaying, audioUrl]);

  const select = useCallback((i: number) => {
    setIndex(i);
    setProgress(0);
  }, []);

  const next = useCallback(() => {
    if (count <= 1) return;
    let nextIdx = (index + 1) % count;
    let attempts = 0;
    while (list[nextIdx]?.isPreorder && attempts < count) {
      nextIdx = (nextIdx + 1) % count;
      attempts++;
    }
    if (attempts < count) playAt(nextIdx);
  }, [count, index, list, playAt]);

  const prev = useCallback(() => {
    if (relativeProgress > 3) {
      seek(0);
      return;
    }
    if (count <= 1) return;
    let prevIdx = (index - 1 + count) % count;
    let attempts = 0;
    while (list[prevIdx]?.isPreorder && attempts < count) {
      prevIdx = (prevIdx - 1 + count) % count;
      attempts++;
    }
    if (attempts < count) playAt(prevIdx);
  }, [count, index, list, relativeProgress, playAt]);

  const seek = useCallback(
    (s: number) => {
      const audio = audioRef.current;
      const targetTime = hasDemo ? demoStart + s : s;
      if (audioUrl && audio) {
        try {
          audio.currentTime = targetTime;
        } catch {
          /* ignore seeking error */
        }
      }
      setProgress(targetTime);
    },
    [audioUrl, hasDemo, demoStart]
  );

  const changeVolume = useCallback((v: number) => {
    setVolume(v);
    setMuted(v === 0);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => (volume === 0 ? false : !m));
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