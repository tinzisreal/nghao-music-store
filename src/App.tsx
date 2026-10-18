import React, { useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Store } from "./pages/Store";
import { WarrantyPolicy } from "./pages/WarrantyPolicy";
import { InitialRedirect } from "./components/InitialRedirect";
import { LanguageProvider } from "./contexts/LanguageContext";
import { CartProvider } from "./contexts/CartContext";
import { api } from "./utils/api";

// Code splitting: Tách toàn bộ trang Admin ra chunk riêng, không bundle vào file JS của khách xem beat
const Admin = lazy(() => import("./pages/Admin").then((m) => ({ default: m.Admin })));

interface AppProps {
  previewPage?: "store" | "admin";
}

function PageViewTracker() {
  const location = useLocation();

  useEffect(() => {
    // Không tính lượt xem trang khi Admin vào quản trị
    if (!location.pathname.startsWith("/admin")) {
      api.trackEvent({ type: "pageview" });
    }
  }, [location.pathname]);

  return null;
}

export function App({ previewPage = "store" }: AppProps) {
  return (
    <LanguageProvider>
      <CartProvider>
        <BrowserRouter>
          <PageViewTracker />
          {previewPage === "admin" && <InitialRedirect to="/admin" />}
          <Routes>
            <Route
              path="/admin"
              element={
                <Suspense fallback={<div className="min-h-screen bg-[#0c1824] flex items-center justify-center text-white/50 text-sm">Đang tải Admin...</div>}>
                  <Admin />
                </Suspense>
              }
            />
            <Route path="/chinh-sach-bao-hanh" element={<WarrantyPolicy />} />
            <Route path="/policy" element={<WarrantyPolicy />} />
            <Route path="*" element={<Store />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </LanguageProvider>
  );
}