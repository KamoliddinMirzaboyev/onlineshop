import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

// Yangi service worker skipWaiting+clientsClaim bilan sokin ishga tushadi,
// lekin ochiq sahifa hali eski JS/HTML bilan ishlayveradi — shu sabab
// avval hard refresh kerak bo'lardi. Nazoratchi almashganda bir marta
// avtomatik reload qilamiz.
if ("serviceWorker" in navigator) {
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);

// App mount bo'lgach splash'ni yashiramiz (CSS fade), so'ng DOM'dan olib tashlaymiz.
requestAnimationFrame(() => {
  const splash = document.getElementById("splash");
  if (!splash) return;
  splash.classList.add("hide");
  splash.addEventListener("transitionend", () => splash.remove(), { once: true });
  // Fallback: transition o'tmasa ham olib tashlaymiz.
  setTimeout(() => splash.remove(), 800);
});
