import React from "react";
import { MailIcon, PhoneIcon } from "lucide-react";
import { SocialIcon } from "./SocialIcon";
import { useLanguage } from "../contexts/LanguageContext";
import { StoreInfo } from "../types/store";

interface ContactFooterProps {
  name: string;
  info: StoreInfo;
}

export function ContactFooter({ name, info }: ContactFooterProps) {
  const { t, pick } = useLanguage();
  const { contact, socials } = info;

  return (
    <footer aria-labelledby="contact-title" className="liquid-glass-strong rounded-[32px] p-6 md:p-10">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <img
            src="/logo-white.png"
            alt="NGHAO Music Producer"
            className="h-16 w-auto shrink-0 object-contain opacity-95"
          />
          <div>
            <h2 id="contact-title" className="text-2xl font-semibold text-white">
              {t("contact")}
            </h2>
            <p className="mt-1 text-sm text-white/55">{pick(contact.hours)}</p>
          </div>
        </div>

        <ul className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
          <li>
            <a href={contact.phoneHref} className="group flex items-center gap-3 text-white">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors duration-150 group-hover:bg-white group-hover:text-black">
                <PhoneIcon className="h-4 w-4" aria-hidden />
              </span>
              <span className="text-lg font-medium tabular-nums">{contact.phone}</span>
            </a>
          </li>
          <li>
            <a href={`mailto:${contact.email}`} className="group flex items-center gap-3 text-white">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors duration-150 group-hover:bg-white group-hover:text-black">
                <MailIcon className="h-4 w-4" aria-hidden />
              </span>
              <span className="truncate">{contact.email}</span>
            </a>
          </li>
        </ul>

        <ul className="flex flex-wrap gap-2" aria-label={t("socials")}>
          {socials.map((s) =>
          <li key={s.kind}>
              <a
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className="liquid-glass flex items-center gap-2 rounded-full px-4 py-2 text-sm text-white transition-colors duration-150 hover:bg-white hover:text-black">
              
                <SocialIcon kind={s.kind} />
                {s.label}
              </a>
            </li>
          )}
        </ul>
      </div>

      <div className="mt-8 flex flex-col gap-2 border-t border-white/10 pt-6 text-sm text-white/45 sm:flex-row sm:justify-between">
        <span>
          © {new Date().getFullYear()} {name}. {t("rights")}
        </span>
        <span>{t("license")}</span>
      </div>
    </footer>);

}