/**
 * Kulrang Doppi — Terms JavaScript Logic
 */
document.addEventListener("DOMContentLoaded", () => {
  const browserAPI = typeof browser !== "undefined" ? browser : chrome;
  const checkbox = document.getElementById("termsCheckbox");
  const btnAccept = document.getElementById("btnAccept");
  const successMsg = document.getElementById("termsSuccess");

  const termsVersion = (typeof KULRANG_CONFIG !== "undefined" && KULRANG_CONFIG.TERMS_VERSION) ? KULRANG_CONFIG.TERMS_VERSION : "1.0.0";
  const storageKeys = (typeof KULRANG_CONFIG !== "undefined" && KULRANG_CONFIG.STORAGE_KEYS) ? KULRANG_CONFIG.STORAGE_KEYS : {
    TERMS_ACCEPTED: "kulrang_doppi_terms_accepted",
    TERMS_VERSION: "kulrang_doppi_terms_version"
  };

  // Avval qabul qilinganmi tekshirish
  browserAPI.storage.local.get([storageKeys.TERMS_ACCEPTED, storageKeys.TERMS_VERSION], (res) => {
    if (res && res[storageKeys.TERMS_ACCEPTED] && res[storageKeys.TERMS_VERSION] === termsVersion) {
      checkbox.checked = true;
      btnAccept.disabled = false;
      btnAccept.textContent = "Shartlar qabul qilingan (Yopish)";
    }
  });

  // Checkbox holatiga qarab tugmani faollashtirish
  checkbox.addEventListener("change", () => {
    btnAccept.disabled = !checkbox.checked;
  });

  // Qabul qilish tugmasi bosilganda
  btnAccept.addEventListener("click", () => {
    if (!checkbox.checked) return;

    const data = {
      [storageKeys.TERMS_ACCEPTED]: true,
      [storageKeys.TERMS_VERSION]: termsVersion,
      [storageKeys.TERMS_ACCEPTED_AT]: new Date().toISOString()
    };

    // localStorage va chrome.storage.local ga yozish
    try {
      localStorage.setItem(storageKeys.TERMS_ACCEPTED, "true");
      localStorage.setItem(storageKeys.TERMS_VERSION, termsVersion);
    } catch (e) {}

    browserAPI.storage.local.set(data, () => {
      btnAccept.disabled = true;
      successMsg.style.display = "block";

      setTimeout(() => {
        // Agar yangi ochilgan tab bo'lsa, uni yopish yoki Telegram ga yo'naltirish
        if (window.opener) {
          window.close();
        } else {
          window.location.href = "https://web.telegram.org";
        }
      }, 1200);
    });
  });
});
