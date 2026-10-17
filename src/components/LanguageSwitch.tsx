import React from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { Lang } from "../data/i18n";

const OPTIONS: {value: Lang;label: string;}[] = [
{ value: "vi", label: "VI" },
{ value: "en", label: "EN" }];


export function LanguageSwitch({ className = "fixed right-4 top-4 z-40 md:right-8" }: { className?: string }) {
  const { lang, setLang, t } = useLanguage();

  return (
    <div role="radiogroup" aria-label={t("language")} className={`liquid-glass flex rounded-full p-1 ${className}`}>
      {OPTIONS.map((o) => {
        const active = o.value === lang;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setLang(o.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
            active ? "bg-white text-black" : "text-white/70 hover:text-white"}`
            }>
            
            {o.label}
          </button>);

      })}
    </div>);

}