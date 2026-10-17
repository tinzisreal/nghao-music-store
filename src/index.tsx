import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { enforceDomainLock } from "./utils/domainLock";

// Khóa tên miền: Nếu phát hiện chạy trên domain/host lạ, dừng toàn bộ ứng dụng ngay lập tức
enforceDomainLock();

const rootEl = document.getElementById("root");
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(<App />);
}