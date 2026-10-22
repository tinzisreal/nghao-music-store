import { Track } from "./track";
import { Album } from "./album";

export type SocialKind = "instagram" | "facebook" | "tiktok" | "soundcloud";

export interface LocalizedText {
  vi: string;
  en: string;
}

export interface Producer {
  name: string;
  tagline: LocalizedText;
  bio: LocalizedText;
  photo: string;
}

export interface Social {
  kind: SocialKind;
  label: string;
  handle: string;
  href: string;
}

export interface Contact {
  phone: string;
  phoneHref: string;
  email: string;
  hours: LocalizedText;
}

export interface StoreInfo {
  contact: Contact;
  socials: Social[];
}

export interface TrackSection {
  title: LocalizedText;
  trackIds: string[]; // ordered
}

export interface StoreSections {
  newReleases: TrackSection;
}

export interface StoreData {
  producer: Producer;
  tracks: Track[];
  albums?: Album[];
  info: StoreInfo;
  sections: StoreSections;
}

export interface BankAccount {
  bankId: string;
  bankName: string;
  accountNo: string;
  accountName: string;
  qrImage?: string; // Link ảnh QR cố định nếu có
}

export type OrderStatus = "pending_verification" | "underpaid" | "paid";

export type PaymentResolution = "exact" | "underpaid" | "overpaid";

export interface PaymentHistoryEntry {
  transactionId: string;
  referenceCode?: string | null;
  amount: number;
  transactionDate: string;
}

export interface OrderItem {
  trackId: string;
  title: string;
  price: number;
  cover?: string;
  downloadUrl?: string;
}

export interface Order {
  id: string;
  trackId: string;
  trackIds?: string[];
  items?: OrderItem[];
  amount: number;
  transferNote: string;
  qrUrl?: string;
  payUrl?: string;
  paymentMethod?: "vietqr" | "paypal_card" | string;
  amountUsd?: string;
  currency?: string;
  paypalOrderId?: string;
  paypalCaptureId?: string;
  payerName?: string;
  apipayPublicId?: string;
  status?: OrderStatus;
  paymentResolution?: PaymentResolution;
  downloadUrl?: string;
  email?: string;
  phone?: string;
  emailSentAt?: string;
  emailDeliveryError?: string;
  createdAt?: string;
  paidAt?: string;
  lastPaymentAt?: string;
  paidAmount?: number;
  shortfallAmount?: number;
  overpaidAmount?: number;
  paymentHistory?: PaymentHistoryEntry[];
  transactionId?: string;
  referenceCode?: string;
  reconciledVia?: string;
  adminNote?: string;
  trackTitle?: string;
  trackCover?: string;
  bank?: BankAccount;
}

export interface PayPalConfig {
  configured: boolean;
  clientId: string;
  currency: string;
  mode: string;
}

export interface PayPalCreateOrderResult {
  orderId: string;
  paypalOrderId: string;
  amountUsd: string;
  currency: string;
}

export interface PayPalCaptureResult {
  success: boolean;
  orderId: string;
  status: OrderStatus;
  email?: string;
  phone?: string;
  amountUsd?: string;
  message?: string;
}

export interface OrderConfirmation {
  orderId: string;
  status: OrderStatus;
  email?: string;
  phone?: string;
  emailSent?: boolean;
  emailSentAt?: string;
  emailDeliveryReason?: string;
  paidAmount?: number;
  shortfallAmount?: number;
  overpaidAmount?: number;
  paymentResolution?: PaymentResolution;
  message?: string;
  downloadUrl?: string;
}

export interface ProcessedTransaction {
  transactionId: string;
  referenceCode?: string | null;
  amount: string;
  content: string;
  transactionDate: string;
  bankAccountPublicId?: string | null;
  gateway?: string | null;
  orderId?: string | null;
  processedAt?: string;
}

export interface ApiPayOverview {
  totalIn: number;
  totalOut: number;
  totalTransactions: number;
  averageAmount: number;
  successRate: number;
}

export interface ReconciliationData {
  orders: Order[];
  processedTransactions: ProcessedTransaction[];
  apipayOverview: ApiPayOverview | null;
  apipayTransactions: Record<string, unknown>[];
  apipayPaymentRequests: Record<string, unknown>[];
  newlyMatchedCount: number;
  ntfyTopic?: string;
}

export interface TotpSetupInfo {
  secret: string;
  otpauthUrl: string;
  qrUrl: string;
  issuer: string;
  account: string;
}

export interface AdminAuthStatus {
  authenticated: boolean;
  totpConfigured: boolean;
  totpSetup: TotpSetupInfo | null;
}

export interface DailyStatEntry {
  date: string;
  views: number;
  uniques: number;
  plays: number;
  downloads: number;
}

export interface TopTrackByPlay {
  id: string;
  title: string;
  artist: string;
  cover: string;
  playCount: number;
  percentage: number;
}

export interface TopTrackByDownload {
  id: string;
  title: string;
  artist: string;
  cover: string;
  downloadCount: number;
}

export interface RecentDownloadEntry {
  id: string;
  trackId: string;
  trackTitle: string;
  downloadedAt: string;
  ip: string;
  device: string;
  browser: string;
}

export interface RecentPlayEntry {
  id: string;
  trackId: string;
  trackTitle: string;
  playedAt: string;
  device: string;
}

export interface DeviceStats {
  mobile: number;
  desktop: number;
  tablet: number;
}

export interface SubscriberEntry {
  id: string;
  email: string;
  phone?: string;
  source?: "free_download" | "paid_order" | string;
  trackId?: string;
  trackTitle?: string;
  subscribedAt: string;
  updatedAt?: string;
  active: boolean;
}

export interface AnalyticsData {
  totalViews: number;
  todayViews: number;
  totalUniqueVisitors: number;
  todayUniqueVisitors: number;
  totalPlays: number;
  todayPlays: number;
  totalDownloads: number;
  todayDownloads: number;
  totalSubscribers?: number;
  subscribers?: SubscriberEntry[];
  dailyTrend: DailyStatEntry[];
  topTracksByPlay: TopTrackByPlay[];
  topTracksByDownload: TopTrackByDownload[];
  recentDownloads: RecentDownloadEntry[];
  recentPlays: RecentPlayEntry[];
  devices: DeviceStats;
}

export interface NewsletterStatus {
  configured: boolean;
  senderEmail: string;
  totalSubscribers: number;
}

export interface BroadcastNewsletterResult {
  success: boolean;
  sentCount: number;
  failedCount?: number;
  totalTargeted: number;
  message: string;
}