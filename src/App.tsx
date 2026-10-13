import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Store } from "./pages/Store";
import { Admin } from "./pages/Admin";
import { InitialRedirect } from "./components/InitialRedirect";
import { LanguageProvider } from "./contexts/LanguageContext";

interface AppProps {
  previewPage?: "store" | "admin";
}

export function App({ previewPage = "store" }: AppProps) {
  return (
    <LanguageProvider>
      <BrowserRouter>
        {previewPage === "admin" && <InitialRedirect to="/admin" />}
        <Routes>
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Store />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>);

}