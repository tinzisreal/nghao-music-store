import React from "react";
import { PlayIcon } from "lucide-react";
import { SocialIcon } from "./SocialIcon";
import { useLanguage } from "../contexts/LanguageContext";
import { Producer, Social } from "../types/store";

interface ProducerHeroProps {
  producer: Producer;
  socials: Social[];
  trackCount: number;
  albumCount: number;
  onPlay: () => void;
}

export function ProducerHero({ producer, socials, trackCount, albumCount, onPlay }: ProducerHeroProps) {
  const { t, pick } = useLanguage();
  const { name, photo } = producer;

  return (
    <section
      aria-labelledby="producer-name"
      className="progressive-card-glass grid items-center gap-4 overflow-hidden rounded-[28px] p-2.5 sm:rounded-[36px] sm:p-3.5 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10 md:p-4 xl:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] xl:gap-14">
      
      <div className="relative aspect-[16/11] overflow-hidden rounded-[22px] sm:aspect-[16/10] sm:rounded-[28px] md:aspect-[4/5]">
        <img src={photo} alt={t("portraitOf", { name })} className="h-full w-full object-cover object-[50%_58%] md:object-[50%_65%]" />
        <div
          aria-hidden
          className="progressive-hero-fade md:hidden"
        />
        <div className="absolute inset-x-4 bottom-3.5 flex items-end justify-between md:hidden">
          <div>
            <span className="inline-block rounded-full progressive-glass-pill px-3 py-1 text-[11px] font-medium tracking-wide text-white/95">
              {pick(producer.tagline)}
            </span>
            <h1 id="producer-name" className="mt-1.5 text-3xl font-bold tracking-tight text-white drop-shadow">
              {name}
            </h1>
          </div>
          <div className="flex gap-2">
            <div className="progressive-glass-pill rounded-2xl px-3 py-1.5 text-center">
              <span className="block text-base font-bold tabular-nums text-white">{trackCount}</span>
              <span className="block text-[10px] uppercase tracking-wider text-white/70">{t("tracks")}</span>
            </div>
            <div className="progressive-glass-pill rounded-2xl px-3 py-1.5 text-center">
              <span className="block text-base font-bold tabular-nums text-white">{albumCount}</span>
              <span className="block text-[10px] uppercase tracking-wider text-white/70">{t("albums")}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-2 pb-2 md:px-0 md:pb-0 md:pr-8">
        <p className="hidden text-sm text-white/60 md:block">{pick(producer.tagline)}</p>
        <p className="mt-2 hidden break-words text-4xl font-semibold tracking-tight text-white md:block md:text-6xl xl:text-7xl" aria-hidden>
          {name}
        </p>
        <p className="text-sm leading-relaxed text-white/80 sm:text-base md:mt-5 md:max-w-prose md:text-white/75">
          {pick(producer.bio)}
        </p>

        <dl className="mt-6 hidden gap-8 md:flex">
          <div>
            <dt className="text-sm text-white/55">{t("tracks")}</dt>
            <dd className="text-2xl font-semibold tabular-nums text-white">{trackCount}</dd>
          </div>
          <div>
            <dt className="text-sm text-white/55">{t("albums")}</dt>
            <dd className="text-2xl font-semibold tabular-nums text-white">{albumCount}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 sm:justify-start md:mt-8">
          <button
            type="button"
            onClick={onPlay}
            className="flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-lg shadow-white/10 transition-transform duration-150 hover:scale-[1.02] active:scale-95 sm:flex-initial">
            
            <PlayIcon className="h-4 w-4 fill-black" aria-hidden />
            {t("listenNow")}
          </button>
          <ul className="flex items-center gap-2" aria-label={t("socials")}>
            {socials.map((s) =>
            <li key={s.kind}>
                <a
                href={s.href}
                target="_blank"
                rel="noreferrer"
                aria-label={`${s.label} ${s.handle}`}
                className="liquid-glass flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors duration-150 hover:bg-white hover:text-black">
                
                  <SocialIcon kind={s.kind} />
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>);

}