import { Track } from "./track";
import { Album } from "./album";

export type SocialKind = "instagram" | "facebook" | "tiktok";

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

export interface Order {
  id: string;
  trackId: string;
  amount: number;
  transferNote: string;
  qrUrl: string;
  payUrl?: string;
  apipayPublicId?: string;
  status?: OrderStatus;
  paymentResolution?: PaymentResolution;
  downloadUrl?: string;
  email?: string;
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
  bank: BankAccount;
}

export interface OrderConfirmation {
  orderId: string;
  status: OrderStatus;
  paidAmount?: number;
  shortfallAmount?: number;
  overpaidAmount?: number;
  paymentResolution?: PaymentResolution;
  message?: string;
  downloadUrl?: string; // Link tải file Full bàn giao cho khách
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