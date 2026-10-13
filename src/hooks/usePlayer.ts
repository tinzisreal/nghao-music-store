import { useCallback, useEffect, useRef, useState } from "react";
import { Track } from "../types/track";

/**
 * Mobile-friendly audio player hook with direct user-gesture unlocking
 * for iOS Safari, Android Chrome, and modern web browsers.
 */
export function usePlayer(list: Track[]) {
  const [index, setIndex] = useState(0);
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

  // Khởi tạo audio element một lần duy nhất với cấu hình tối ưu cho Mobile
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    // Đảm bảo phát inline trên iOS WebKit / Safari
    (audio as unknown as { playsInline: boolean }).playsInline = true;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, []);

  // Lắng nghe sự kiện audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      const cur = audio.currentTime;
      setProgress(cur);
      const curTrack = listRef.current[indexRef.current];
      // Tự động lặp lại khi nghe hết đoạn demo
      if (curTrack?.demoEnd && curTrack.demoEnd > 0 && cur >= curTrack.demoEnd) {
        audio.currentTime = curTrack.demoStart || 0;
        setProgress(audio.currentTime);
      }
    };

    const onMeta = () => {
      if (Number.isFinite(audio.duration)) {
        setAudioDuration(audio.duration);
      }
    };

    const onEnded = () => {
      const nextIdx = (indexRef.current + 1) % listRef.current.length;
      setIndex(nextIdx);
      setProgress(0);
      const nextTrack = listRef.current[nextIdx];
      if (nextTrack?.audioUrl) {
        audio.src = nextTrack.audioUrl;
        const start = nextTrack.demoStart || 0;
        if (start > 0) audio.currentTime = start;
        audio.play().catch(() => setIsPlaying(false));
      }
    };

    const onPlayEvent = () => setIsPlaying(true);
    const onPauseEvent = () => setIsPlaying(false);
    const onError = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlayEvent);
    audio.addEventListener("pause", onPauseEvent);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlayEvent);
      audio.removeEventListener("pause", onPauseEvent);
      audio.removeEventListener("error", onError);
    };
  }, []);

  // Âm lượng
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume / 100;
    }
  }, [volume, muted]);

  // Đồng bộ src khi current track thay đổi nhưng không ngắt quãng tương tác
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audioUrl) {
      if (audio.src !== audioUrl && !audio.src.endsWith(audioUrl)) {
        // Chỉ gán src khi chưa phát
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

  // Trình phát mô phỏng cho bài chưa có file nhạc
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
   * Phát hoặc tạm dừng bài hát trực tiếp trong call stack của click event
   * (bắt buộc đối với iOS Safari & Android Chrome để tránh bị chặn autoplay)
   */
  const playAt = useCallback(
    (i: number) => {
      if (i < 0 || i >= list.length) return;
      const audio = audioRef.current;
      const target = list[i];

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
            audio.play().catch((err) => {
              console.warn("Mobile autoplay restriction:", err);
              setIsPlaying(false);
            });
          }
        }
        return;
      }

      // Đổi bài mới: thiết lập ngay trong sự kiện chạm/bấm của người dùng
      setIndex(i);
      setProgress(0);
      setIsPlaying(true);

      if (audio && target?.audioUrl) {
        audio.src = target.audioUrl;
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
    const nextIdx = (index + 1) % count;
    playAt(nextIdx);
  }, [count, index, playAt]);

  const prev = useCallback(() => {
    if (relativeProgress > 3) {
      seek(0);
      return;
    }
    const prevIdx = (index - 1 + count) % count;
    playAt(prevIdx);
  }, [count, index, relativeProgress, playAt]);

  const seek = useCallback(
    (s: number) => {
      const audio = audioRef.current;
      const targetTime = hasDemo ? demoStart + s : s;
      if (audioUrl && audio) {
        try {
          audio.currentTime = targetTime;
        } catch {
          /* ignore seeking error before loaded */
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