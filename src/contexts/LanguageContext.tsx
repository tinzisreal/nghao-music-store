import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { dictionaries, DictKey, Lang } from "../data/i18n";
import { LocalizedText } from "../types/store";

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: DictKey, vars?: Record<string, string | number>) => string;
  pick: (text: LocalizedText) => string;
}

const STORAGE_KEY = "nghao-lang";
const LanguageContext = createContext<LanguageContextValue | null>(null);

function initialLang(): Lang {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "vi" || saved === "en") return saved;
  } catch {

    /* storage unavailable */}
  return navigator.language?.toLowerCase().startsWith("vi") ? "vi" : "en";
}

export function LanguageProvider({ children }: {children: React.ReactNode;}) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {

      /* ignore */}
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => {
        let s = dictionaries[lang][key];
        if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
        return s;
      },
      pick: (text) => text[lang] || text.vi || text.en
    }),
    [lang, setLang]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}