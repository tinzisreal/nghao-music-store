import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Track } from "../types/track";
import { toast } from "sonner";

interface CartContextValue {
  items: Track[];
  addToCart: (track: Track) => void;
  removeFromCart: (trackId: string) => void;
  clearCart: () => void;
  isInCart: (trackId: string) => boolean;
  totalItems: number;
  totalPrice: number;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
}

const STORAGE_KEY = "nghao_cart_items";
const CartContext = createContext<CartContextValue | null>(null);

function loadInitialCart(): Track[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((t) => t && typeof t.id === "string");
    }
  } catch {
    /* storage unavailable or parse error */
  }
  return [];
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Track[]>(loadInitialCart);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const toggleCart = useCallback(() => setIsCartOpen((prev) => !prev), []);

  const addToCart = useCallback((track: Track) => {
    if (!track || !track.id) return;
    setItems((prev) => {
      if (prev.some((t) => t.id === track.id)) {
        toast.info(`"${track.title}" đã có trong giỏ hàng.`);
        return prev;
      }
      const next = [...prev, track];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      toast.success(`Đã thêm "${track.title}" vào giỏ hàng!`);
      return next;
    });
  }, []);

  const removeFromCart = useCallback((trackId: string) => {
    setItems((prev) => {
      const removedTrack = prev.find((t) => t.id === trackId);
      const next = prev.filter((t) => t.id !== trackId);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      if (removedTrack) {
        toast.info(`Đã xóa "${removedTrack.title}" khỏi giỏ hàng.`);
      }
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const isInCart = useCallback(
    (trackId: string) => {
      return items.some((t) => t.id === trackId);
    },
    [items]
  );

  const totalItems = items.length;
  const totalPrice = useMemo(() => {
    return items.reduce((sum, t) => sum + Math.max(0, Math.floor(Number(t.price) || 0)), 0);
  }, [items]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      addToCart,
      removeFromCart,
      clearCart,
      isInCart,
      totalItems,
      totalPrice,
      isCartOpen,
      openCart,
      closeCart,
      toggleCart
    }),
    [
      items,
      addToCart,
      removeFromCart,
      clearCart,
      isInCart,
      totalItems,
      totalPrice,
      isCartOpen,
      openCart,
      closeCart,
      toggleCart
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
