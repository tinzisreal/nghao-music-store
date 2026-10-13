import React from "react";
import { StoreView } from "../components/StoreView";
import { StoreStatus } from "../components/StoreStatus";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { useStoreData } from "../hooks/useStoreData";

const BG_IMAGE = "/bg-custom.png?v=2";

export function Store() {
  const { state, retry } = useStoreData();

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#0c1824] font-sans text-white">
      <div aria-hidden className="fixed inset-0 z-0">
        <img src={BG_IMAGE} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-black/15" />
      </div>

      <LanguageSwitch />

      <div className="relative z-10">
        {state.status === "loading" && <StoreStatus kind="loading" />}
        {state.status === "error" && <StoreStatus kind="error" message={state.error} onRetry={retry} />}
        {state.status === "ready" && (
        state.data.tracks.length === 0 ?
        <StoreStatus kind="empty" name={state.data.producer.name} /> :

        <StoreView data={state.data} />)
        }
      </div>
    </div>);

}