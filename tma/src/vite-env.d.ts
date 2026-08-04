/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name?: string; language_code?: string } };
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  /** android | ios | tdesktop | macos | web | weba | ... */
  platform?: string;
  ready(): void;
  expand(): void;
  close(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  MainButton: {
    setText(t: string): void;
    show(): void;
    hide(): void;
    enable(): void;
    disable(): void;
    showProgress(): void;
    hideProgress(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
  };
  BackButton: {
    isVisible?: boolean;
    show(): void;
    hide(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
  };
  HapticFeedback: { impactOccurred(s: string): void; notificationOccurred(s: string): void };
  LocationManager?: TelegramLocationManager;
}

interface TelegramLocationData {
  latitude: number;
  longitude: number;
  /** metr (ixtiyoriy, Telegram versiyasiga bog'liq) */
  horizontal_accuracy?: number;
  altitude?: number;
  course?: number;
  speed?: number;
}

// Bot API 8.0+ — Telegram mijozining o'z joylashuv ruxsat oqimi. Brauzer
// Geolocation'dan farqli, ba'zi Telegram WebView'larda ruxsat prompt'i
// ko'rsatilmasdan darhol xato qaytaradigan holatlarda ham ishonchli ishlaydi,
// va foydalanuvchi avval rad etgan bo'lsa qayta so'rash (openSettings) imkonini beradi.
interface TelegramLocationManager {
  isInited: boolean;
  isLocationAvailable: boolean;
  isAccessRequested: boolean;
  isAccessGranted: boolean;
  init(callback?: () => void): void;
  getLocation(callback: (location: TelegramLocationData | null) => void): void;
  openSettings(): void;
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp;
    WebView?: { initParams?: { tgWebAppData?: string; [key: string]: unknown } };
  };
}
