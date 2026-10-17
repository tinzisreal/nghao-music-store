import React from "react";
import { ShoppingBagIcon } from "lucide-react";
import { useCart } from "../contexts/CartContext";
import { motion, AnimatePresence } from "framer-motion";

export function CartButton() {
  const { totalItems, toggleCart } = useCart();

  return (
    <button
      type="button"
      onClick={toggleCart}
      aria-label="Giỏ hàng"
      className="liquid-glass relative flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white/90 transition-all duration-200 hover:scale-105 hover:text-white"
    >
      <ShoppingBagIcon className="h-4 w-4 text-ember" />
      <span className="hidden sm:inline">Giỏ hàng</span>
      <AnimatePresence>
        {totalItems > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-ember px-1.5 text-[11px] font-black text-black shadow-md shadow-amber-500/30"
          >
            {totalItems}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
