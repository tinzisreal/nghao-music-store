export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Parses "3:45" or "225" into seconds. Returns null when invalid. */
export function parseTime(value: string): number | null {
  const v = value.trim();
  if (/^\d+$/.test(v)) return Number(v);
  const match = v.match(/^(\d{1,3}):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatPrice(vnd: number): string {
  if (!vnd || vnd <= 0) return "Miễn phí";
  return `${vnd.toLocaleString("vi-VN")}₫`;
}

export function vndToUsdEstimate(vnd: number): string {
  const v = Math.max(0, Math.floor(Number(vnd) || 0));
  if (v <= 0) return "1.00";
  const usd = Math.max(1, Math.ceil(v / 25000));
  return usd.toFixed(2);
}