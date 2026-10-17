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
  AnalyticsData,
  Order,
  OrderConfirmation,
  OrderStatus,
  PayPalCaptureResult,
  PayPalConfig,
  PayPalCreateOrderResult,
  Producer,
  ReconciliationData,
  StoreData,
  StoreInfo,
  StoreSections,
  SubscriberEntry,
  NewsletterStatus,
  BroadcastNewsletterResult
} from "../types/store";
import { sections as mockSections } from "../data/sections";
import { producer as mockProducer, tracks as mockTracks } from "../data/tracks";
import { storeInfo as mockStoreInfo } from "../data/contact";
import { bankAccount as mockBank } from "../data/payment";

export const API_BASE_URL = String(
  import.meta.env.PROD ? "/fb-tr" : import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"
).replace(/\/+$/, "");

export const MEDIA_PROXY_BASE = String(
  import.meta.env.PROD ? "/tiktok-sdk" : import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"
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

const TELEMETRY_SALT = "nghao_fb_telemetry_2024_secure_salt_k9x";

function decodeCodecPayload<T>(body: unknown): T {
  if (
    body &&
    typeof body === "object" &&
    "_p" in body &&
    typeof (body as { _p?: unknown })._p === "string"
  ) {
    try {
      const rawBase64 = (body as { _p: string })._p;
      const binStr = window.atob(rawBase64);
      const keyBytes = new TextEncoder().encode(TELEMETRY_SALT);
      const outBytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        outBytes[i] = binStr.charCodeAt(i) ^ keyBytes[i % keyBytes.length];
      }
      const jsonStr = new TextDecoder("utf-8").decode(outBytes);
      return JSON.parse(jsonStr) as T;
    } catch {
      return body as T;
    }
  }
  return body as T;
}

async function request<T>(path: string, init: RequestInit = {}, baseUrl = API_BASE_URL): Promise<T> {
  const isForm = init.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...(isForm ? {} : { "Content-Type": "application/json" }),
        "x-fb-codec": "1",
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
      const rawBody = await res.json();
      const body = decodeCodecPayload<{ message?: string }>(rawBody);
      if (body?.message) message = body.message;
    } catch {

      /* non-JSON error body */}
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  const rawJson = await res.json();
  return decodeCodecPayload<T>(rawJson);
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

function resolveTrackMedia(track: Track): Track {
  if (!track) return track;
  let audioUrl = track.audioUrl;
  let cover = track.cover;
  if (audioUrl && audioUrl.startsWith("/") && !audioUrl.startsWith("/tiktok-sdk") && !audioUrl.startsWith("/fb-tr") && !audioUrl.startsWith(MEDIA_PROXY_BASE)) {
    audioUrl = `${MEDIA_PROXY_BASE}${audioUrl}`;
  }
  if (cover && cover.startsWith("/") && !cover.startsWith("/tiktok-sdk") && !cover.startsWith("/fb-tr") && !cover.startsWith(MEDIA_PROXY_BASE)) {
    cover = `${MEDIA_PROXY_BASE}${cover}`;
  }
  return {
    ...track,
    audioUrl,
    cover
  };
}

function resolveAlbumMedia(album: Album): Album {
  if (!album) return album;
  let cover = album.cover;
  if (cover && cover.startsWith("/")) {
    cover = `${MEDIA_PROXY_BASE}${cover}`;
  }
  return { ...album, cover };
}

function resolveOrderMedia(order: Order): Order {
  if (!order) return order;
  let qrUrl = order.qrUrl;
  let payUrl = order.payUrl;
  if (qrUrl && qrUrl.startsWith("/")) {
    qrUrl = `${MEDIA_PROXY_BASE}${qrUrl}`;
  }
  if (payUrl && payUrl.startsWith("/")) {
    payUrl = `${MEDIA_PROXY_BASE}${payUrl}`;
  }
  return { ...order, qrUrl, payUrl };
}

/* ───────── Public API (Camouflaged via /fb-tr & /tiktok-sdk) ───────── */

export const api = {
  getProducer(): Promise<Producer> {
    return USE_MOCK ? mock(db.producer) : request<Producer>("/v19.0/pixel/config");
  },

  async getTracks(options?: { admin?: boolean }): Promise<Track[]> {
    if (USE_MOCK) return mock(db.tracks);
    const query = options?.admin ? "?admin=1" : "";
    const tracks = await request<Track[]>(`/v19.0/pixel/catalog${query}`);
    return tracks.map(resolveTrackMedia);
  },

  async getAlbums(): Promise<Album[]> {
    if (USE_MOCK) return mock([]);
    const albums = await request<Album[]>("/v19.0/pixel/collections");
    return albums.map(resolveAlbumMedia);
  },

  getStoreInfo(): Promise<StoreInfo> {
    return USE_MOCK ? mock(db.info) : request<StoreInfo>("/v19.0/pixel/attribution");
  },

  getSections(): Promise<StoreSections> {
    return USE_MOCK ? mock(db.sections) : request<StoreSections>("/v19.0/pixel/placements");
  },

  async getStoreData(options?: { admin?: boolean }): Promise<StoreData> {
    const [producer, tracks, albums, info, sections] = await Promise.all([
      api.getProducer(),
      api.getTracks(options),
      api.getAlbums().catch(() => [] as Album[]),
      api.getStoreInfo(),
      api.getSections()
    ]);
    return { producer, tracks, albums, info, sections };
  },

  getFreeDownloadUrl(trackId: string): string {
    return `${MEDIA_PROXY_BASE}/v2/media/asset/${encodeURIComponent(trackId)}`;
  },

  async createOrder(trackIdOrIds: string | string[], redirectUrl?: string, email?: string, phone?: string): Promise<Order> {
    const isArray = Array.isArray(trackIdOrIds);
    const trackIds = isArray ? trackIdOrIds : [trackIdOrIds];
    const trackId = trackIds[0] || "";

    if (!USE_MOCK) {
      const ord = await request<Order>(
        "/v2/events/initiate",
        {
          method: "POST",
          body: JSON.stringify({
            trackId,
            trackIds,
            redirectUrl,
            email,
            phone
          })
        },
        MEDIA_PROXY_BASE
      );
      return resolveOrderMedia(ord);
    }
    const track = db.tracks.find((t) => t.id === trackId);
    if (!track) return Promise.reject(new ApiError("Không tìm thấy bài hát."));
    const transferNote = `NGHAO ${track.id.toUpperCase().slice(0, 8)}`;
    return mock({
      id: `ord_${Date.now()}`,
      trackId,
      trackIds,
      amount: track.price,
      transferNote,
      bank: mockBank,
      qrUrl: buildVietQr(mockBank.bankId, mockBank.accountNo, mockBank.accountName, track.price, transferNote)
    });
  },

  async getOrder(orderId: string): Promise<Order> {
    if (!USE_MOCK) {
      const ord = await request<Order>(`/v2/events/status/${encodeURIComponent(orderId)}`, {}, MEDIA_PROXY_BASE);
      return resolveOrderMedia(ord);
    }
    return Promise.reject(new ApiError("Mock mode"));
  },

  confirmOrder(orderId: string, email?: string, phone?: string, subscribeNewsletter: boolean = true): Promise<OrderConfirmation> {
    if (!USE_MOCK) {
      return request<OrderConfirmation>(
        `/v2/events/complete/${encodeURIComponent(orderId)}`,
        {
          method: "POST",
          body: JSON.stringify({ email, phone, subscribeNewsletter })
        },
        MEDIA_PROXY_BASE
      );
    }
    return mock({ orderId, status: "pending_verification" as const }, 700);
  },

  subscribeNewsletter(payload: {
    email: string;
    phone?: string;
    source?: string;
    trackId?: string;
    trackTitle?: string;
    subscribeNewsletter?: boolean;
  }): Promise<{ success: boolean; email: string; message: string }> {
    return request<{ success: boolean; email: string; message: string }>(
      "/v2/events/subscribe",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      MEDIA_PROXY_BASE
    );
  },

  resendOrderEmail(
    orderId: string,
    email?: string,
    phone?: string
  ): Promise<{ orderId: string; email: string; phone?: string; sent: boolean; emailSentAt?: string; message: string }> {
    return request<{ orderId: string; email: string; phone?: string; sent: boolean; emailSentAt?: string; message: string }>(
      `/orders/${encodeURIComponent(orderId)}/resend-email`,
      {
        method: "POST",
        body: JSON.stringify({ email, phone })
      }
    );
  },

  /* ───────── International Card & PayPal API ───────── */

  getPayPalConfig(): Promise<PayPalConfig> {
    if (USE_MOCK) {
      return mock({ configured: true, clientId: "mock_client_id", currency: "USD", mode: "sandbox" });
    }
    return request<PayPalConfig>("/v2/events/paypal/config", {}, MEDIA_PROXY_BASE);
  },

  createPayPalOrder(trackId: string, email?: string, phone?: string): Promise<PayPalCreateOrderResult> {
    if (USE_MOCK) {
      return mock({
        orderId: `ord_pp_${Date.now()}`,
        paypalOrderId: `PAYPAL_${Date.now()}`,
        amountUsd: "20.00",
        currency: "USD"
      });
    }
    return request<PayPalCreateOrderResult>(
      "/v2/events/paypal/create-order",
      {
        method: "POST",
        body: JSON.stringify({ trackId, email, phone })
      },
      MEDIA_PROXY_BASE
    );
  },

  capturePayPalOrder(orderId: string, paypalOrderId: string, email?: string, phone?: string, subscribeNewsletter: boolean = true): Promise<PayPalCaptureResult> {
    if (USE_MOCK) {
      return mock({
        success: true,
        orderId,
        status: "paid" as const,
        email,
        phone,
        amountUsd: "20.00",
        message: "Thanh toán thành công"
      });
    }
    return request<PayPalCaptureResult>(
      "/v2/events/paypal/capture-order",
      {
        method: "POST",
        body: JSON.stringify({ orderId, paypalOrderId, email, phone, subscribeNewsletter })
      },
      MEDIA_PROXY_BASE
    );
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

  markOrderEmailSent(orderId: string, sent: boolean, email?: string): Promise<Order> {
    return request<Order>(`/admin/orders/${encodeURIComponent(orderId)}/email-sent`, {
      method: "PATCH",
      body: JSON.stringify({ sent, email })
    });
  },

  deleteOrder(orderId: string): Promise<void> {
    return request<void>(`/admin/orders/${encodeURIComponent(orderId)}`, {
      method: "DELETE"
    });
  },

  testNotifications(): Promise<{
    ntfy: { sent: boolean; reason?: string; topic?: string; appUrl?: string };
    telegram: { sent: boolean; reason?: string; message?: string };
    gmail: { sent: boolean; reason?: string; message?: string };
  }> {
    return request<{
      ntfy: { sent: boolean; reason?: string; topic?: string; appUrl?: string };
      telegram: { sent: boolean; reason?: string; message?: string };
      gmail: { sent: boolean; reason?: string; message?: string };
    }>("/admin/notifications/test", { method: "POST" });
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

  reorderTracks(trackIds: string[]): Promise<Track[]> {
    if (!USE_MOCK) {
      return request<Track[]>("/tracks/reorder", {
        method: "PUT",
        body: JSON.stringify({ trackIds })
      });
    }
    const map = new Map(db.tracks.map((t) => [t.id, t]));
    const reordered: Track[] = [];
    for (const id of trackIds) {
      const t = map.get(id);
      if (t) {
        reordered.push(t);
        map.delete(id);
      }
    }
    for (const t of map.values()) reordered.push(t);
    db.tracks = reordered;
    return mock(db.tracks, 200);
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
  },

  async trackEvent(payload: {
    type: "pageview" | "play" | "download";
    trackId?: string;
    trackTitle?: string;
  }): Promise<void> {
    try {
      const endpoint = import.meta.env.PROD
        ? "/fb-tr/v2/events/analytics"
        : `${API_BASE_URL}/analytics/event`;
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-fb-codec": "1" },
        body: JSON.stringify(payload),
        keepalive: true
      });
    } catch {
      /* ignore analytics reporting errors silently */
    }
  },

  getAnalytics(): Promise<AnalyticsData> {
    if (!USE_MOCK) return request<AnalyticsData>("/admin/analytics");
    return mock({
      totalViews: 0,
      todayViews: 0,
      totalUniqueVisitors: 0,
      todayUniqueVisitors: 0,
      totalPlays: 0,
      todayPlays: 0,
      totalDownloads: 0,
      todayDownloads: 0,
      dailyTrend: [],
      topTracksByPlay: [],
      topTracksByDownload: [],
      recentDownloads: [],
      recentPlays: [],
      devices: { mobile: 0, desktop: 0, tablet: 0 }
    } as AnalyticsData);
  },

  getSubscribers(): Promise<{ total: number; subscribers: SubscriberEntry[] }> {
    return request<{ total: number; subscribers: SubscriberEntry[] }>("/admin/subscribers");
  },

  deleteSubscriber(id: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/admin/subscribers/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
  },

  getNewsletterStatus(): Promise<NewsletterStatus> {
    return request<NewsletterStatus>("/admin/newsletter/status");
  },

  broadcastNewsletter(payload: {
    trackId: string;
    customSubject?: string;
    customMessage?: string;
  }): Promise<BroadcastNewsletterResult> {
    return request<BroadcastNewsletterResult>("/admin/newsletter/broadcast", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};