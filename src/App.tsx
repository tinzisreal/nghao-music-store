import React, { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Store } from "./pages/Store";
import { Admin } from "./pages/Admin";
import { WarrantyPolicy } from "./pages/WarrantyPolicy";
import { InitialRedirect } from "./components/InitialRedirect";
import { LanguageProvider } from "./contexts/LanguageContext";
import { api } from "./utils/api";

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
      <BrowserRouter>
        <PageViewTracker />
        {previewPage === "admin" && <InitialRedirect to="/admin" />}
        <Routes>
          <Route path="/admin" element={<Admin />} />
          <Route path="/chinh-sach-bao-hanh" element={<WarrantyPolicy />} />
          <Route path="/policy" element={<WarrantyPolicy />} />
          <Route path="*" element={<Store />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}