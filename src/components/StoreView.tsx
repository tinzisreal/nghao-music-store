import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheckIcon } from "lucide-react";
import { ProducerHero } from "./ProducerHero";
import { CoverFlow } from "./CoverFlow";
import { NewReleases } from "./NewReleases";
import { AllTracks } from "./AllTracks";
import { ContactFooter } from "./ContactFooter";
import { PlayerBar } from "./PlayerBar";
import { PaymentModal } from "./PaymentModal";
import { PreorderModal } from "./PreorderModal";
import { CartDrawer } from "./CartDrawer";
import { usePlayer } from "../hooks/usePlayer";
import { MAX_FEATURED } from "../data/sections";
import { Track } from "../types/track";
import { StoreData } from "../types/store";

export function StoreView({ data }: {data: StoreData;}) {
  const { producer, tracks, info } = data;
  const player = usePlayer(tracks);
  const [buying, setBuying] = useState<Track | null>(null);
  const [cartCheckoutTracks, setCartCheckoutTracks] = useState<Track[] | null>(null);
  const [preordering, setPreordering] = useState<Track | null>(null);

  const indexOf = (id: string) => tracks.findIndex((t) => t.id === id);

  const handlePlay = (id: string) => {
    const t = tracks.find((x) => x.id === id);
    if (t?.isPreorder) {
      setPreordering(t);
      return;
    }
    player.playAt(indexOf(id));
  };

  const handleBuy = (track: Track) => {
    if (track.isPreorder) {
      setPreordering(track);
      return;
    }
    setBuying(track);
  };
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
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 pr-20 sm:mb-6 sm:pr-24">
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

          <Link
            to="/chinh-sach-bao-hanh"
            className="liquid-glass flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-white transition-colors duration-150 hover:bg-white hover:text-black sm:px-4 sm:py-2 sm:text-sm">
            <ShieldCheckIcon className="h-4 w-4 text-ember group-hover:text-black transition-colors" />
            <span>Chính sách bảo hành nhạc SLOT</span>
          </Link>
        </header>

        <ProducerHero
          producer={producer}
          socials={info.socials}
          trackCount={tracks.length}
          albumCount={albumCount}
          onPlay={() => featured[flowIndex] && handlePlay(featured[flowIndex].id)} />
        

        <div className="mt-8 sm:mt-12 md:mt-14">
          <CoverFlow
            tracks={featured}
            activeIndex={flowIndex}
            isPlaying={player.isPlaying && flowIsCurrent}
            onSelect={setFlowIndex}
            onPlay={(i) => featured[i] && handlePlay(featured[i].id)} />
          
        </div>

        {newReleases.length > 0 &&
        <div className="mt-8 sm:mt-12 md:mt-14">
            <NewReleases
            title={data.sections.newReleases.title}
            tracks={newReleases}
            currentId={player.current.id}
            isPlaying={player.isPlaying}
            onPlay={handlePlay}
            onBuy={handleBuy} />
          
          </div>
        }

        <div className="mt-10 sm:mt-14 md:mt-16">
          <AllTracks
            tracks={tracks}
            currentId={player.current.id}
            isPlaying={player.isPlaying}
            onPlay={handlePlay}
            onBuy={handleBuy} />
          
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
        onBuy={() => handleBuy(player.current)} />
      

      <PaymentModal
        track={buying}
        tracks={cartCheckoutTracks}
        onClose={() => {
          setBuying(null);
          setCartCheckoutTracks(null);
        }}
      />
      <PreorderModal track={preordering} onClose={() => setPreordering(null)} />
      <CartDrawer onCheckout={(tracks) => setCartCheckoutTracks(tracks)} />
    </>);

}