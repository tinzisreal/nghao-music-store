export interface Track {
  id: string;
  title: string;
  artist: string;
  albumId?: string; // ID của Album quan hệ
  album: string; // Tên hiển thị của Album (hoặc Single nếu không thuộc album)
  genre: string;
  cover: string;
  duration: number; // seconds (fallback until audio metadata loads)
  price: number; // VND
  audioUrl?: string; // preview/stream URL — when present the player plays real audio
  fullAudioUrl?: string; // link file full gốc bàn giao cho khách sau khi mua
  demoStart?: number; // giây bắt đầu đoạn demo (mặc định 0)
  featured?: boolean; // shown in the cover flow
  isPreorder?: boolean; // Chế độ đặt trước (Pre-order): không chạy nhạc, nút Pre-order, liên hệ Zalo
}

/** Payload for creating / editing a track from the admin page. */
export type TrackInput = Omit<Track, "id" | "artist">;