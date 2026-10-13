import React, { useEffect, useMemo, useState } from "react";
import { ProducerHero } from "./ProducerHero";
import { CoverFlow } from "./CoverFlow";
import { NewReleases } from "./NewReleases";
import { AllTracks } from "./AllTracks";
import { ContactFooter } from "./ContactFooter";
import { PlayerBar } from "./PlayerBar";
import { PaymentModal } from "./PaymentModal";
import { usePlayer } from "../hooks/usePlayer";
import { MAX_FEATURED } from "../data/sections";
import { Track } from "../types/track";
import { StoreData } from "../types/store";

export function StoreView({ data }: {data: StoreData;}) {
  const { producer, tracks, info } = data;
  const player = usePlayer(tracks);
  const [buying, setBuying] = useState<Track | null>(null);

  const indexOf = (id: string) => tracks.findIndex((t) => t.id === id);
  const newReleases = useMemo(
    () =>
    data.sections.newReleases.trackIds.
    map((id) => tracks.find((t) => t.id === id)).
    filter((t): t is Track => Boolean(t)).
    slice(0, 5),
    [data.sections, tracks]
  );
  const featured = useMemo(() => {
    const f = tracks.filter((t) => t.featured);
    return (f.length > 0 ? f : tracks).slice(0, MAX_FEATURED);
  }, [tracks]);
  const albumCount = useMemo(() => new Set(tracks.map((t) => t.album)).size, [tracks]);

  const [flowIndex, setFlowIndex] = useState(0);
  useEffect(() => {
    const i = featured.findIndex((t) => t.id === player.current.id);
    if (i !== -1) setFlowIndex(i);
  }, [featured, player.current.id]);
  const flowIsCurrent = featured[flowIndex]?.id === player.current.id;

  return (
    <>
      <main className="mx-auto max-w-[1440px] px-3.5 pb-32 pt-3 sm:px-6 md:px-10 md:pb-36 md:pt-6">
        <header className="mb-4 flex items-center justify-between pr-20 sm:mb-6 sm:pr-24">
          <a href="/" className="group inline-flex items-center gap-2.5 rounded-full bg-black/40 px-3 py-1.5 ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-black/55 sm:gap-3.5 sm:px-4 sm:py-2">
            <img
              src="/logo-mark-white.png"
              alt="NGHAO Music Producer Logo"
              className="h-8 w-8 object-contain transition-transform duration-200 group-hover:scale-105 sm:h-10 sm:w-10"
            />
            <div className="leading-tight">
              <span className="block text-sm font-bold tracking-[0.14em] text-white sm:text-base">NGHAO</span>
              <span className="block text-[9px] font-semibold tracking-[0.18em] text-white/65 sm:text-[10px] sm:tracking-[0.2em]">
                MUSIC PRODUCER
              </span>
            </div>
          </a>
        </header>

        <ProducerHero
          producer={producer}
          socials={info.socials}
          trackCount={tracks.length}
          albumCount={albumCount}
          onPlay={() => player.playAt(indexOf(featured[flowIndex].id))} />
        

        <div className="mt-8 sm:mt-12 md:mt-14">
          <CoverFlow
            tracks={featured}
            activeIndex={flowIndex}
            isPlaying={player.isPlaying && flowIsCurrent}
            onSelect={setFlowIndex}
            onPlay={(i) => player.playAt(indexOf(featured[i].id))} />
          
        </div>

        {newReleases.length > 0 &&
        <div className="mt-8 sm:mt-12 md:mt-14">
            <NewReleases
            title={data.sections.newReleases.title}
            tracks={newReleases}
            currentId={player.current.id}
            isPlaying={player.isPlaying}
            onPlay={(id) => player.playAt(indexOf(id))}
            onBuy={setBuying} />
          
          </div>
        }

        <div className="mt-10 sm:mt-14 md:mt-16">
          <AllTracks
            tracks={tracks}
            currentId={player.current.id}
            isPlaying={player.isPlaying}
            onPlay={(id) => player.playAt(indexOf(id))}
            onBuy={setBuying} />
          
        </div>

        <div className="mt-12 sm:mt-16 md:mt-20">
          <ContactFooter name={producer.name} info={info} />
        </div>
      </main>

      <PlayerBar
        track={player.current}
        isPlaying={player.isPlaying}
        progress={player.progress}
        duration={player.duration}
        volume={player.volume}
        muted={player.muted}
        onToggle={player.toggle}
        onNext={player.next}
        onPrev={player.prev}
        onSeek={player.seek}
        onVolumeChange={player.changeVolume}
        onToggleMute={player.toggleMute}
        onBuy={() => setBuying(player.current)} />
      

      <PaymentModal track={buying} onClose={() => setBuying(null)} />
    </>);

}