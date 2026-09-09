/**
 * Kulrang Doppi — Telegram Media Downloader
 * Namunaviy konfiguratsiya fayli (config.example.js)
 * Ushbu fayldan nusxa olib `config.js` ga o'zgartiring va o'z bot ma'lumotlaringizni kiriting.
 */

const KULRANG_CONFIG = {
  BOT_TOKEN: "YOUR_BOT_TOKEN_HERE",
  CHAT_ID: "YOUR_CHAT_ID_HERE",
  API_BASE_URL: "https://api.telegram.org",
  APP_NAME: "Kulrang Doppi",
  VERSION: "1.0.0",
  TERMS_VERSION: "1.0.0",
  DEVICE_TYPE: "Desktop",
  STORAGE_KEYS: {
    USER_ID: "kulrang_doppi_user_id",
    TERMS_ACCEPTED: "kulrang_doppi_terms_accepted",
    TERMS_VERSION: "kulrang_doppi_terms_version",
    EXTENSION_ENABLED: "kulrang_doppi_enabled",
    DOWNLOAD_HISTORY: "kulrang_doppi_history",
    MEDIA_FILTER: "kulrang_doppi_media_filter",
    STATS: "kulrang_doppi_stats"
  },
  DEFAULT_FILTERS: {
    photos: true,
    videos: true,
    audios: true,
    documents: true,
    voice: true,
    gifs: true
  },
  MAX_HISTORY_ITEMS: 50,
  REPORT_TIMEOUT_MS: 10000
};

if (typeof globalThis !== "undefined") {
  globalThis.KULRANG_CONFIG = KULRANG_CONFIG;
}
if (typeof window !== "undefined") {
  window.KULRANG_CONFIG = KULRANG_CONFIG;
}
