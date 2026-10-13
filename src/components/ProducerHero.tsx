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
      className="liquid-glass-strong grid items-center gap-6 rounded-[36px] p-3 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10 md:p-4 xl:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] xl:gap-14">
      
      <div className="aspect-[4/5] overflow-hidden rounded-[28px]">
        <img src={photo} alt={t("portraitOf", { name })} className="h-full w-full object-cover object-[50%_65%]" />
      </div>

      <div className="px-3 pb-4 md:px-0 md:pb-0 md:pr-8">
        <p className="text-sm text-white/60">{pick(producer.tagline)}</p>
        <h1 id="producer-name" className="mt-2 break-all text-4xl font-semibold tracking-tight text-white md:text-6xl xl:text-7xl">
          {name}
        </h1>
        <p className="mt-5 max-w-prose text-base leading-relaxed text-white/75">{pick(producer.bio)}</p>

        <dl className="mt-6 flex gap-8">
          <div>
            <dt className="text-sm text-white/55">{t("tracks")}</dt>
            <dd className="text-2xl font-semibold tabular-nums text-white">{trackCount}</dd>
          </div>
          <div>
            <dt className="text-sm text-white/55">{t("albums")}</dt>
            <dd className="text-2xl font-semibold tabular-nums text-white">{albumCount}</dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onPlay}
            className="flex items-center gap-2 whitespace-nowrap rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-transform duration-150 hover:scale-[1.02] active:scale-95">
            
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