import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
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
