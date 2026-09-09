/**
 * Kulrang Doppi — Popup Controller
 * Sozlamalar, statistika, ommaviy yuklab olish va yangilanishlar
 */

document.addEventListener("DOMContentLoaded", async () => {
  const browserAPI = typeof browser !== "undefined" ? browser : chrome;

  const storageKeys = (typeof KULRANG_CONFIG !== "undefined" && KULRANG_CONFIG.STORAGE_KEYS) ? KULRANG_CONFIG.STORAGE_KEYS : {
    USER_ID: "kulrang_doppi_user_id",
    TERMS_ACCEPTED: "kulrang_doppi_terms_accepted",
    EXTENSION_ENABLED: "kulrang_doppi_enabled",
    DOWNLOAD_HISTORY: "kulrang_doppi_history",
    MEDIA_FILTER: "kulrang_doppi_media_filter",
    STATS: "kulrang_doppi_stats",
    PENDING_UPDATE: "kulrang_doppi_pending_update"
  };

  const extensionToggle = document.getElementById("extensionToggle");
  const statusDesc = document.getElementById("statusDesc");
  const userIdText = document.getElementById("userIdText");
  const btnCopyId = document.getElementById("btnCopyId");
  const termsBadge = document.getElementById("termsBadge");
  const statDownloads = document.getElementById("statDownloads");
  const statSize = document.getElementById("statSize");
  const historyList = document.getElementById("historyList");
  const clearHistory = document.getElementById("clearHistory");
  const btnBatchDownload = document.getElementById("btnBatchDownload");
  const btnCheckUpdate = document.getElementById("btnCheckUpdate");
  const updateNoticeBanner = document.getElementById("updateNoticeBanner");
  const updateNoticeText = document.getElementById("updateNoticeText");
  const btnGoToUpdate = document.getElementById("btnGoToUpdate");
  const badgeVersion = document.getElementById("badgeVersion");

  const filterPhotos = document.getElementById("filterPhotos");
  const filterVideos = document.getElementById("filterVideos");
  const filterAudios = document.getElementById("filterAudios");
  const filterDocs = document.getElementById("filterDocs");

  // Versiyani o'rnatish
  const manifest = browserAPI.runtime.getManifest();
  if (manifest && manifest.version) {
    badgeVersion.textContent = "v" + manifest.version;
  }

  // 1. Ma'lumotlarni yuklash
  browserAPI.storage.local.get(
    [
      storageKeys.USER_ID,
      storageKeys.TERMS_ACCEPTED,
      storageKeys.EXTENSION_ENABLED,
      storageKeys.STATS,
      storageKeys.DOWNLOAD_HISTORY,
      storageKeys.MEDIA_FILTER,
      storageKeys.PENDING_UPDATE
    ],
    (data) => {
      // User ID
      if (data[storageKeys.USER_ID]) {
        userIdText.textContent = data[storageKeys.USER_ID];
      } else {
        browserAPI.runtime.sendMessage({ action: "GET_USER_ID" }, (res) => {
          if (res && res.userId) userIdText.textContent = res.userId;
        });
      }

      // Terms
      if (!data[storageKeys.TERMS_ACCEPTED]) {
        termsBadge.textContent = "⚠ Shartlar qabul qilinmagan";
        termsBadge.style.color = "#f59e0b";
      }

      // Toggle
      const isEnabled = data[storageKeys.EXTENSION_ENABLED] !== false;
      extensionToggle.checked = isEnabled;
      updateToggleText(isEnabled);

      // Statistika
      if (data[storageKeys.STATS]) {
        statDownloads.textContent = data[storageKeys.STATS].totalDownloads || 0;
        statSize.textContent = (data[storageKeys.STATS].totalSizeMB || 0) + " MB";
      }

      // Tarix
      renderHistory(data[storageKeys.DOWNLOAD_HISTORY] || []);

      // Filtrlar
      if (data[storageKeys.MEDIA_FILTER]) {
        const f = data[storageKeys.MEDIA_FILTER];
        filterPhotos.checked = f.photos !== false;
        filterVideos.checked = f.videos !== false;
        filterAudios.checked = f.audios !== false;
        filterDocs.checked = f.documents !== false;
      }

      // Yangilanish bormi?
      if (data[storageKeys.PENDING_UPDATE] && data[storageKeys.PENDING_UPDATE].hasUpdate) {
        const info = data[storageKeys.PENDING_UPDATE];
        updateNoticeBanner.style.display = "flex";
        updateNoticeText.textContent = `🔄 Yangi versiya (${info.newVersion}) chiqdi!`;
      }
    }
  );

  function updateToggleText(enabled) {
    statusDesc.textContent = enabled ? "Yuklab olish tugmalari faol" : "Kengaytma to'xtatilgan";
    statusDesc.style.color = enabled ? "#94a3b8" : "#f87171";
  }

  extensionToggle.addEventListener("change", () => {
    const isEnabled = extensionToggle.checked;
    updateToggleText(isEnabled);
    browserAPI.storage.local.set({ [storageKeys.EXTENSION_ENABLED]: isEnabled }, () => {
      browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].url && tabs[0].url.includes("web.telegram.org")) {
          browserAPI.tabs.sendMessage(tabs[0].id, {
            action: "TOGGLE_EXTENSION",
            enabled: isEnabled
          });
        }
      });
    });
  });

  btnCopyId.addEventListener("click", () => {
    const id = userIdText.textContent;
    if (id && id !== "Yuklanmoqda...") {
      navigator.clipboard.writeText(id).then(() => {
        btnCopyId.textContent = "Nusxalandi!";
        setTimeout(() => { btnCopyId.textContent = "Nusxa"; }, 1500);
      });
    }
  });

  function saveFilters() {
    const filters = {
      photos: filterPhotos.checked,
      videos: filterVideos.checked,
      audios: filterAudios.checked,
      documents: filterDocs.checked
    };
    browserAPI.storage.local.set({ [storageKeys.MEDIA_FILTER]: filters }, () => {
      browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].url && tabs[0].url.includes("web.telegram.org")) {
          browserAPI.tabs.sendMessage(tabs[0].id, {
            action: "UPDATE_FILTERS",
            filters: filters
          });
        }
      });
    });
  }

  [filterPhotos, filterVideos, filterAudios, filterDocs].forEach((el) => {
    el.addEventListener("change", saveFilters);
  });

  function renderHistory(items) {
    if (!items || items.length === 0) {
      historyList.innerHTML = '<div class="history-empty">Hali hech narsa yuklab olinmadi</div>';
      return;
    }
    historyList.innerHTML = "";
    items.slice(0, 10).forEach((item) => {
      const row = document.createElement("div");
      row.className = "history-item";

      const nameSpan = document.createElement("span");
      nameSpan.className = "history-name";
      nameSpan.title = item.fileName;
      nameSpan.textContent = item.fileName;

      const metaSpan = document.createElement("span");
      metaSpan.className = "history-meta";
      metaSpan.textContent = `${item.size} MB`;

      row.appendChild(nameSpan);
      row.appendChild(metaSpan);
      historyList.appendChild(row);
    });
  }

  clearHistory.addEventListener("click", () => {
    browserAPI.storage.local.set({ [storageKeys.DOWNLOAD_HISTORY]: [] }, () => {
      renderHistory([]);
    });
  });

  btnBatchDownload.addEventListener("click", () => {
    btnBatchDownload.textContent = "Yuklab olish boshlanmoqda...";
    btnBatchDownload.disabled = true;

    browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0] || !tabs[0].url || !tabs[0].url.includes("web.telegram.org")) {
        alert("Iltimos, avval web.telegram.org sahifasini oching!");
        btnBatchDownload.innerHTML = `<span>Sahifadagi barcha mediani yuklab olish</span>`;
        btnBatchDownload.disabled = false;
        return;
      }

      browserAPI.tabs.sendMessage(
        tabs[0].id,
        { action: "TRIGGER_BATCH_DOWNLOAD" },
        (res) => {
          if (res && res.count !== undefined) {
            btnBatchDownload.textContent = `${res.count} ta media yuklab olindi!`;
          } else {
            btnBatchDownload.textContent = "Media fayllar topildi va yuklanmoqda!";
          }
          setTimeout(() => {
            btnBatchDownload.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              <span>Sahifadagi barcha mediani yuklab olish</span>
            `;
            btnBatchDownload.disabled = false;
          }, 2000);
        }
      );
    });
  });

  // Yangilanishni tekshirish tugmasi
  btnCheckUpdate.addEventListener("click", () => {
    btnCheckUpdate.innerHTML = `<span>⏳ Tekshirilmoqda...</span>`;
    browserAPI.runtime.sendMessage({ action: "CHECK_FOR_UPDATES" }, (res) => {
      if (res && res.hasUpdate) {
        updateNoticeBanner.style.display = "flex";
        updateNoticeText.textContent = `🔄 Yangi versiya (${res.updateInfo.newVersion}) chiqdi!`;
        btnCheckUpdate.innerHTML = `<span>✓ Yangilanish topildi!</span>`;
      } else {
        btnCheckUpdate.innerHTML = `<span>✓ Sizda so'nggi versiya</span>`;
      }
      setTimeout(() => {
        btnCheckUpdate.innerHTML = `<span>🔄 Yangilanishni tekshirish</span>`;
      }, 3000);
    });
  });

  // Yangilanish sahifasiga o'tish
  const openUpdatePage = () => {
    browserAPI.tabs.create({
      url: browserAPI.runtime.getURL("update.html")
    });
  };

  btnGoToUpdate.addEventListener("click", openUpdatePage);
  badgeVersion.addEventListener("click", openUpdatePage);
});
