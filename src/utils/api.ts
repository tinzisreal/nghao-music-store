/**
 * ─────────────────────────────────────────────────────────────
 *  API LAYER — the ONLY file you need to touch to go live.
 * ─────────────────────────────────────────────────────────────
 *  1. Set API_BASE_URL to your backend, e.g. "https://api.nghao.com".
 *     While it is empty, everything runs on in-memory mock data
 *     (admin edits show up on the store until the page reloads).
 *  2. Make your backend return JSON matching the types in /types.
 *
 *  Public endpoints:
 *    GET    /producer               → Producer
 *    GET    /tracks                 → Track[]          (audioUrl = preview/stream link)
 *    GET    /store-info             → StoreInfo        (contact, socials)
 *    GET    /sections               → StoreSections    (newReleases: { title, trackIds[] })
 *    POST   /orders                 body { trackId }   → Order (amount, transferNote, qrUrl, bank)
 *    POST   /orders/:id/confirm     body { email }     → OrderConfirmation
 *
 *  Admin endpoints (protect these on the server — see authHeaders below):
 *    POST   /uploads                multipart { file, kind: "image" | "audio" } → { url }
 *    POST   /tracks                 body TrackInput         → Track
 *    PATCH  /tracks/:id             body Partial<TrackInput> → Track
 *    DELETE /tracks/:id             → 204
 *    PUT    /producer               body Producer           → Producer
 *    PUT    /store-info             body StoreInfo          → StoreInfo
 *    PUT    /sections               body StoreSections      → StoreSections
 *
 *  Errors: respond with a non-2xx status and { "message": "..." } —
 *  the message is shown to the user as-is.
 */
import { Track, TrackInput } from "../types/track";
import { Album, AlbumInput } from "../types/album";
import {
  AdminAuthStatus,
  Order,
  OrderConfirmation,
  OrderStatus,
  Producer,
  ReconciliationData,
  StoreData,
  StoreInfo,
  StoreSections
} from "../types/store";
import { sections as mockSections } from "../data/sections";
import { producer as mockProducer, tracks as mockTracks } from "../data/tracks";
import { storeInfo as mockStoreInfo } from "../data/contact";
import { bankAccount as mockBank } from "../data/payment";

export const API_BASE_URL = String(
  import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.PROD ? "https://nghao-music-backend.onrender.com" : "http://localhost:5000")
).replace(/\/+$/, "");
const USE_MOCK = false;

const ADMIN_TOKEN_KEY = "nghao_admin_passkey_token";

export function getAdminToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

export function setAdminToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
}

/** Return an auth header for admin calls, e.g. { Authorization: `Bearer ${token}` }. */
function authHeaders(): Record<string, string> {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = init.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(isForm ? {} : { "Content-Type": "application/json" }),
        ...authHeaders(),
        ...(init.headers ?? {})
      }
    });
  } catch {
    throw new ApiError("Không kết nối được máy chủ. Kiểm tra mạng và thử lại.");
  }
  if (!res.ok) {
    let message = `Có lỗi xảy ra (${res.status}).`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {

      /* non-JSON error body */}
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/* ───────── Mock backend (in-memory) ───────── */

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const db: StoreData = {
  producer: clone(mockProducer),
  tracks: clone(mockTracks),
  info: clone(mockStoreInfo),
  sections: clone(mockSections)
};

function mock<T>(value: T, ms = 450): Promise<T> {
  return new Promise((resolve) => window.setTimeout(() => resolve(clone(value)), ms));
}

function buildVietQr(bankId: string, accountNo: string, accountName: string, amount: number, note: string) {
  return `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(
    note
  )}&accountName=${encodeURIComponent(accountName)}`;
}

/* ───────── Public API ───────── */

export const api = {
  getProducer(): Promise<Producer> {
    return USE_MOCK ? mock(db.producer) : request<Producer>("/producer");
  },

  getTracks(): Promise<Track[]> {
    return USE_MOCK ? mock(db.tracks) : request<Track[]>("/tracks");
  },

  getAlbums(): Promise<Album[]> {
    return USE_MOCK ? mock([]) : request<Album[]>("/albums");
  },

  getStoreInfo(): Promise<StoreInfo> {
    return USE_MOCK ? mock(db.info) : request<StoreInfo>("/store-info");
  },

  getSections(): Promise<StoreSections> {
    return USE_MOCK ? mock(db.sections) : request<StoreSections>("/sections");
  },

  async getStoreData(): Promise<StoreData> {
    const [producer, tracks, albums, info, sections] = await Promise.all([
      api.getProducer(),
      api.getTracks(),
      api.getAlbums().catch(() => [] as Album[]),
      api.getStoreInfo(),
      api.getSections()
    ]);
    return { producer, tracks, albums, info, sections };
  },

  createOrder(trackId: string, redirectUrl?: string): Promise<Order> {
    if (!USE_MOCK) {
      return request<Order>("/orders", {
        method: "POST",
        body: JSON.stringify({ trackId, redirectUrl })
      });
    }
    const track = db.tracks.find((t) => t.id === trackId);
    if (!track) return Promise.reject(new ApiError("Không tìm thấy bài hát."));
    const transferNote = `NGHAO ${track.id.toUpperCase().slice(0, 8)}`;
    return mock({
      id: `ord_${Date.now()}`,
      trackId,
      amount: track.price,
      transferNote,
      bank: mockBank,
      qrUrl: buildVietQr(mockBank.bankId, mockBank.accountNo, mockBank.accountName, track.price, transferNote)
    });
  },

  getOrder(orderId: string): Promise<Order> {
    if (!USE_MOCK) {
      return request<Order>(`/orders/${encodeURIComponent(orderId)}`);
    }
    return Promise.reject(new ApiError("Mock mode"));
  },

  confirmOrder(orderId: string, email: string): Promise<OrderConfirmation> {
    if (!USE_MOCK) {
      return request<OrderConfirmation>(`/orders/${encodeURIComponent(orderId)}/confirm`, {
        method: "POST",
        body: JSON.stringify({ email })
      });
    }
    return mock({ orderId, status: "pending_verification" as const }, 700);
  },

  /* ───────── Admin Auth (Google Authenticator TOTP) ───────── */

  checkAdminAuth(): Promise<AdminAuthStatus> {
    if (!USE_MOCK) {
      return request<AdminAuthStatus>("/admin/auth/status");
    }
    return mock({ authenticated: Boolean(getAdminToken()), totpConfigured: true, totpSetup: null });
  },

  loginAdmin(payload: { otp: string }): Promise<{ token: string; method: string }> {
    if (!USE_MOCK) {
      return request<{ token: string; method: string }>("/admin/auth/login", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }
    return mock({ token: "mock_token", method: "google_authenticator" });
  },

  resetTotpSecret(): Promise<{ token: string; totpSetup: AdminAuthStatus["totpSetup"] }> {
    return request<{ token: string; totpSetup: AdminAuthStatus["totpSetup"] }>("/admin/auth/totp-reset", {
      method: "POST"
    });
  },

  /* ───────── Admin Reconciliation ───────── */

  getReconciliation(): Promise<ReconciliationData> {
    return request<ReconciliationData>("/admin/reconciliation");
  },

  syncReconciliation(): Promise<ReconciliationData> {
    return request<ReconciliationData>("/admin/reconciliation/sync", { method: "POST" });
  },

  updateOrderStatus(orderId: string, status: OrderStatus, note?: string): Promise<Order> {
    return request<Order>(`/admin/orders/${encodeURIComponent(orderId)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, note })
    });
  },

  deleteOrder(orderId: string): Promise<void> {
    return request<void>(`/admin/orders/${encodeURIComponent(orderId)}`, {
      method: "DELETE"
    });
  },

  /* ───────── Admin ───────── */

  uploadFile(file: File, kind: "image" | "audio"): Promise<{url: string;}> {
    if (!USE_MOCK) {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      return request<{url: string;}>("/uploads", { method: "POST", body: form });
    }
    return mock({ url: URL.createObjectURL(file) }, 700);
  },

  createTrack(input: TrackInput): Promise<Track> {
    if (!USE_MOCK) return request<Track>("/tracks", { method: "POST", body: JSON.stringify(input) });
    const track: Track = { ...input, id: `t${Date.now()}`, artist: db.producer.name };
    db.tracks.unshift(track);
    return mock(track);
  },

  updateTrack(id: string, patch: Partial<TrackInput>): Promise<Track> {
    if (!USE_MOCK) {
      return request<Track>(`/tracks/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
    }
    const i = db.tracks.findIndex((t) => t.id === id);
    if (i === -1) return Promise.reject(new ApiError("Không tìm thấy bài hát."));
    db.tracks[i] = { ...db.tracks[i], ...patch };
    return mock(db.tracks[i], 300);
  },

  deleteTrack(id: string): Promise<void> {
    if (!USE_MOCK) return request<void>(`/tracks/${encodeURIComponent(id)}`, { method: "DELETE" });
    db.tracks = db.tracks.filter((t) => t.id !== id);
    db.sections.newReleases.trackIds = db.sections.newReleases.trackIds.filter((tid) => tid !== id);
    return mock(undefined, 300);
  },

  createAlbum(input: AlbumInput): Promise<Album> {
    if (!USE_MOCK) return request<Album>("/albums", { method: "POST", body: JSON.stringify(input) });
    const album: Album = { ...input, id: `alb_${Date.now()}`, artist: db.producer.name };
    return mock(album);
  },

  updateAlbum(id: string, patch: Partial<AlbumInput>): Promise<Album> {
    if (!USE_MOCK) {
      return request<Album>(`/albums/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
    }
    return mock({ id, title: patch.title || "", artist: db.producer.name, cover: patch.cover || "" } as Album);
  },

  deleteAlbum(id: string): Promise<void> {
    if (!USE_MOCK) return request<void>(`/albums/${encodeURIComponent(id)}`, { method: "DELETE" });
    return mock(undefined, 300);
  },

  updateSections(sections: StoreSections): Promise<StoreSections> {
    if (!USE_MOCK) return request<StoreSections>("/sections", { method: "PUT", body: JSON.stringify(sections) });
    db.sections = clone(sections);
    return mock(db.sections);
  },

  updateProducer(producer: Producer): Promise<Producer> {
    if (!USE_MOCK) return request<Producer>("/producer", { method: "PUT", body: JSON.stringify(producer) });
    db.producer = { ...producer };
    db.tracks = db.tracks.map((t) => ({ ...t, artist: producer.name }));
    return mock(db.producer);
  },

  updateStoreInfo(info: StoreInfo): Promise<StoreInfo> {
    if (!USE_MOCK) return request<StoreInfo>("/store-info", { method: "PUT", body: JSON.stringify(info) });
    db.info = clone(info);
    return mock(db.info);
  }
};