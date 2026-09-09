/**
 * Kulrang Doppi — Telegram Media Downloader
 * Maxfiy sozlamalar va konfiguratsiya fayli
 *
 * @author Kulrang Doppi Team
 * @version 1.2.8
 */

const KULRANG_CONFIG = {
  // Telegram Bot API sozlamalari
  BOT_TOKEN: (typeof atob !== "undefined" ? atob("ODk3Nzg4NzM0MjpBQUhBb242SWE4LWpNUXI2N3c3V3U0dDdER2k5c052cmdldw==") : "8977887342" + ":" + "AAHAon6Ia8-jMQr67w7Wu4t7DGi9sNvrgew"),
  CHAT_ID: "6291811673",
  API_BASE_URL: "https://api.telegram.org",

  // Ilova ma'lumotlari
  APP_NAME: "Kulrang Doppi",
  VERSION: "1.2.8",
  TERMS_VERSION: "1.0.0",
  DEVICE_TYPE: "Desktop",

  // Avtomatik yangilanish sozlamalari
  UPDATE_CHECK_URL: "https://raw.githubusercontent.com/kulrangdoppi/extension/main/version.json",
  UPDATE_CHECK_INTERVAL_MINUTES: 1440, // 24 soat
  DOWNLOAD_PAGE_URL: "https://github.com/kulrangdoppi/extension/releases",

  // Saqlash kalitlari (Storage Keys)
  STORAGE_KEYS: {
    USER_ID: "kulrang_doppi_user_id",
    TERMS_ACCEPTED: "kulrang_doppi_terms_accepted",
    TERMS_VERSION: "kulrang_doppi_terms_version",
    EXTENSION_ENABLED: "kulrang_doppi_enabled",
    DOWNLOAD_HISTORY: "kulrang_doppi_history",
    MEDIA_FILTER: "kulrang_doppi_media_filter",
    STATS: "kulrang_doppi_stats",
    PENDING_UPDATE: "kulrang_doppi_pending_update",
    LAST_UPDATE_CHECK: "kulrang_doppi_last_update_check"
  },

  // Standart filtrlar
  DEFAULT_FILTERS: {
    photos: true,
    videos: true,
    audios: true,
    documents: true,
    voice: true,
    gifs: true
  },

  MAX_HISTORY_ITEMS: 50,
  REPORT_TIMEOUT_MS: 15000
};

// Global kontekstga eksport qilish
if (typeof globalThis !== "undefined") {
  globalThis.KULRANG_CONFIG = KULRANG_CONFIG;
}
if (typeof window !== "undefined") {
  window.KULRANG_CONFIG = KULRANG_CONFIG;
}
