import React from "react";
import { AlertCircleIcon, MusicIcon } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";

type StoreStatusProps =
{kind: "loading";} |
{kind: "error";message: string;onRetry: () => void;} |
{kind: "empty";name: string;};

export function StoreStatus(props: StoreStatusProps) {
  const { t } = useLanguage();

  if (props.kind === "loading") {
    return (
      <div className="mx-auto max-w-[1440px] px-4 pt-6 md:px-10 md:pt-10" role="status" aria-label={t("loading")}>
        <div className="liquid-glass-strong grid gap-6 rounded-[36px] p-3 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] md:gap-14 md:p-4">
          <div className="aspect-[4/5] animate-pulse rounded-[28px] bg-white/10" />
          <div className="flex flex-col justify-center gap-4 px-3 pb-4 md:px-0">
            <div className="h-4 w-32 animate-pulse rounded-full bg-white/10" />
            <div className="h-14 w-2/3 animate-pulse rounded-2xl bg-white/15" />
            <div className="h-4 w-full max-w-lg animate-pulse rounded-full bg-white/10" />
            <div className="h-4 w-4/5 max-w-md animate-pulse rounded-full bg-white/10" />
            <div className="mt-4 h-11 w-36 animate-pulse rounded-full bg-white/15" />
          </div>
        </div>
        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) =>
          <div key={i} className="liquid-glass aspect-[3/4] animate-pulse rounded-[24px]" />
          )}
        </div>
      </div>);

  }

  if (props.kind === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="liquid-glass-strong max-w-md rounded-[32px] p-8 text-center" role="alert">
          <AlertCircleIcon className="mx-auto h-10 w-10 text-ember" aria-hidden />
          <h1 className="mt-4 text-xl font-semibold text-white">{t("loadError")}</h1>
          <p className="mt-2 text-white/70">{props.message}</p>
          <button
            type="button"
            onClick={props.onRetry}
            className="mt-6 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-transform duration-150 active:scale-95">
            
            {t("retry")}
          </button>
        </div>
      </div>);

  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="liquid-glass-strong max-w-md rounded-[32px] p-8 text-center">
        <MusicIcon className="mx-auto h-10 w-10 text-white/70" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold text-white">{props.name}</h1>
        <p className="mt-2 text-white/70">{t("empty")}</p>
      </div>
    </div>);

}