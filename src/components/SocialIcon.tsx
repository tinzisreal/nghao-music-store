import React from "react";
import { SocialKind } from "../types/store";

export function SocialIcon({ kind, className = "h-4 w-4" }: {kind: SocialKind;className?: string;}) {
  if (kind === "instagram") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
      </svg>);

  }
  if (kind === "facebook") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
        <path d="M14 8.5V6.8c0-.8.5-1.3 1.4-1.3H17V2.2C16.6 2.1 15.4 2 14.1 2 11.3 2 9.6 3.7 9.6 6.6v1.9H7v3.4h2.6V22H14V11.9h2.7l.4-3.4H14z" />
      </svg>);

  }
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M16.6 2h-3.3v13.4a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9.2a6.3 6.3 0 1 0 5.3 6.2V8.7a8 8 0 0 0 4.6 1.5V6.9A4.7 4.7 0 0 1 16.6 2z" />
    </svg>);

}