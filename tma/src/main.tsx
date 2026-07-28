import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";
import "./store/theme"; // <html data-theme> ni birinchi paintdan oldin o'rnatadi
import { getCoords } from "./api/client";
import { ensureLocationManager, initTelegram } from "./telegram";

initTelegram();
// Eng erta: LocationManager init + birinchi joylashuv so'rovi (ruxsat 1 marta).
void ensureLocationManager().then(() => {
  void getCoords();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
