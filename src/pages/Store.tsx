import React from "react";
import { StoreView } from "../components/StoreView";
import { StoreStatus } from "../components/StoreStatus";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { CartButton } from "../components/CartButton";
import { useStoreData } from "../hooks/useStoreData";
import { useCart } from "../contexts/CartContext";

const BG_IMAGE = "/bg-custom.png?v=2";

export function Store() {
  const { state, retry } = useStoreData();
  const { isCartOpen } = useCart();

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#0c1824] font-sans text-white">
      <div aria-hidden className="fixed inset-0 z-0">
        <img src={BG_IMAGE} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-black/15" />
      </div>

      <div
        className={`fixed right-4 top-4 z-40 flex items-center gap-2.5 md:right-8 transition-opacity duration-200 ${
          isCartOpen ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <CartButton />
        <LanguageSwitch className="relative !top-0 !right-0" />
      </div>

      <div className="relative">
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