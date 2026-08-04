import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useNavigate } from "react-router-dom";
import App from "./App";
import PushBridge from "./components/PushBridge";
import { ToastProvider } from "./components/Toast";
import { registerServiceWorker } from "./push";
import "./index.css";

// SW erta — push ishlashi uchun muhim
void registerServiceWorker();

function Root() {
  const navigate = useNavigate();
  return (
    <ToastProvider onToastClick={(url) => navigate(url)}>
      <PushBridge />
      <App />
    </ToastProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Root />
    </BrowserRouter>
  </StrictMode>
);
