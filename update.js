/**
 * Kulrang Doppi — Update Page Controller
 */
document.addEventListener("DOMContentLoaded", async () => {
  const browserAPI = typeof browser !== "undefined" ? browser : chrome;

  const currentVerText = document.getElementById("currentVerText");
  const newVerText = document.getElementById("newVerText");
  const updateStatusBadge = document.getElementById("updateStatusBadge");
  const changelogList = document.getElementById("changelogList");
  const btnCheckAgain = document.getElementById("btnCheckAgain");
  const btnDownloadLink = document.getElementById("btnDownloadLink");

  const manifest = browserAPI.runtime.getManifest();
  const currentVer = manifest.version || "1.1.0";
  currentVerText.textContent = "v" + currentVer;

  function renderChangelog(items) {
    if (!items || items.length === 0) return;
    changelogList.innerHTML = "";
    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      changelogList.appendChild(li);
    });
  }

  async function checkUpdate() {
    updateStatusBadge.textContent = "Tekshirilmoqda...";
    updateStatusBadge.className = "status-badge";

    browserAPI.runtime.sendMessage({ action: "CHECK_FOR_UPDATES" }, (res) => {
      if (res && res.success) {
        if (res.hasUpdate && res.updateInfo) {
          const info = res.updateInfo;
          newVerText.textContent = "v" + info.newVersion;
          updateStatusBadge.textContent = "Yangi versiya mavjud!";
          updateStatusBadge.className = "status-badge";
          if (info.downloadUrl) {
            btnDownloadLink.href = info.downloadUrl;
          }
          if (info.changelog) {
            renderChangelog(info.changelog);
          }
        } else {
          newVerText.textContent = "v" + currentVer;
          updateStatusBadge.textContent = "✓ Sizda eng so'nggi versiya";
          updateStatusBadge.className = "status-badge up-to-date";
        }
      } else {
        updateStatusBadge.textContent = "✓ Sizda so'nggi versiya o'rnatilgan";
        updateStatusBadge.className = "status-badge up-to-date";
      }
    });
  }

  btnCheckAgain.addEventListener("click", () => {
    checkUpdate();
  });

  // Dastlabki tekshiruv
  checkUpdate();
});
