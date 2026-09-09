# 🧢 Kulrang Doppi — Professional Telegram Media Downloader

**Kulrang Doppi** — bu Telegram Web (`web.telegram.org`) uchun maxsus ishlab chiqilgan, zamonaviy va xavfsiz brauzer kengaytmasi (browser extension). Ushbu kengaytma yordamida foydalanuvchilar **yopiq kanallar va guruhlardan** (shu jumladan, nusxa ko‘chirish va saqlash taqiqlangan — *restricted saving content*) istalgan media fayllarni bir tugma bilan oson yuklab olishlari mumkin.

Kengaytma faqat **kompyuter va noutbuklar (Desktop)** uchun optimallashtirilgan.

---

## 🌟 Asosiy Imkoniyatlar

1. **🔒 Yopiq va Himoyalangan Kanallardan Yuklab Olish:**
   - Nusxa ko‘chirish va yo‘naltirish taqiqlangan (`no-forwards`, `pointer-events: none`) kanallardan barcha turdagi medialarni erkin yuklab olish.
   - Kontekst menyu (sichqonchaning o‘ng tugmasi) cheklovlarini avtomatik yechish.
2. **📁 Barcha Media Turlarini Qo‘llab-quvvatlash:**
   - 🖼️ **Rasmlar** (JPG, PNG, WebP, to‘liq sifatdagi albom rasmlari)
   - 🎬 **Videolar** (MP4, WebM, to‘liq hajmdagi video roliklar)
   - 🎵 **Musiqa va Audolar** (MP3, FLAC, WAV)
   - 🎙️ **Ovozli xabarlar** (Voice notes — OGG / Opus)
   - 📄 **Hujjatlar va Fayllar** (PDF, ZIP, RAR, APK, DOCX va boshqalar)
   - 🎞️ **GIF animatsiyalar**
3. **🔐 Maxfiylik va Foydalanish Shartlari (Legal & Consent Modal):**
   - Kengaytma birinchi ishga tushganda to‘liq ekran zamonaviy modal oynasi chiqadi.
   - Foydalanuvchi maxfiylik siyosati bilan tanishib, checkbox orqali rozilik bildirmaguncha yuklab olish funksiyalari faollashmaydi.
   - Rozilik holati `localStorage` va brauzer xotirasida xavfsiz saqlanadi.
4. **🤖 Telegram Botga Shifrlangan Hisobot Tizimi:**
   - Har bir muvaffaqiyatli yuklab olishda quyidagi ma'lumotlar shifrlangan HTTPS protokoli orqali Telegram Bot API ga yuboriladi:
     - 📅 Sana va vaqt (`YYYY-MM-DD HH:MM:SS`)
     - 📁 Fayl nomi
     - 📌 Manba (kanal/guruh nomi yoki havolasi)
     - 💾 Fayl hajmi (MB da)
     - 👤 Foydalanuvchi identifikatori (UUID)
     - 💻 Qurilma turi (Desktop)
   - Tarmoq xatoliklari foydalanuvchiga xalaqit bermaydi (silent logging).
5. **🆔 Foydalanuvchi Identifikatsiyasi (UUID):**
   - Har bir brauzer/qurilma uchun noyob UUID avtomatik shakllantiriladi.
6. **⚡ Qo‘shimcha Imkoniyatlar:**
   - **Batch Download** — joriy ochiq chatdagi barcha medialarni ketma-ket avtomatik yuklab olish.
   - **Media Filter** — faqat kerakli fayl turlarini (masalan, faqat rasmlar yoki faqat hujjatlar) filtrlash.
   - **Yuklab olish tarixi** — popup oynasida so‘nggi fayllar ro‘yxati va jami hajm statistikasi.
   - **Kengaytmani yoqish/o‘chirish switch tugmasi**.

---

## 📂 Fayl Tuzilmasi

```text
kulrang-doppi-extension/
├── manifest.json        # Manifest V3 sozlamalari, ruxsatlar va moslik
├── background.js       # Service worker: UUID boshqaruvi, Bot API hisobotlari
├── content.js          # Telegram Web DOM integratsiyasi, media topish va yuklash
├── config.js           # Bot tokeni, chat ID va tizim sozlamalari
├── config.example.js   # Konfiguratsiya namunasi
├── popup.html          # Sozlamalar va boshqaruv oynasi (UI)
├── popup.js            # Popup boshqaruv mantiqi va statistika
├── terms.html          # Maxfiylik va foydalanish shartlari to‘liq sahifasi
├── terms.js            # Shartlarni tasdiqlash mantiqi
├── styles.css          # Dark theme va desktop uchun optimallashtirilgan CSS
├── icons/              # Ikonkalar (16x16, 48x48, 128x128)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── .gitignore          # Maxfiy ma'lumotlarni gitga chiqarmaslik
├── README.md           # Batafsil yo‘riqnoma
└── CHANGELOG.md        # O‘zgarishlar tarixi
```

---

## 🚀 O‘rnatish Yo‘riqnomasi

### 1. Chromium Asosidagi Brauzerlar (Google Chrome, MS Edge, Brave, Opera)
1. Ushbu loyiha papkasini kompyuteringizga yuklab oling yoki ko‘chiring (`kulrang-doppi-extension`).
2. Brauzeringizni oching va manzil qatoriga quyidagini yozing:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Brave: `brave://extensions/`
3. O‘ng yuqori burchakdagi **"Developer mode"** (Dasturchi rejimi) ni yoqing.
4. **"Load unpacked"** (Yuklangan kengaytmani yuklash) tugmasini bosing.
5. `kulrang-doppi-extension` papkasini tanlang.
6. Kengaytma o‘rnatildi!

### 2. Mozilla Firefox (v109+)
1. Firefox brauzerini oching va manzil qatoriga `about:debugging#/runtime/this-firefox` deb yozing.
2. **"Load Temporary Add-on..."** tugmasini bosing.
3. `kulrang-doppi-extension/manifest.json` faylini tanlang.
4. Kengaytma o‘rnatildi!

---

## ⚙️ Sozlash (Configuration)

`config.js` faylida Telegram Bot va qabul qiluvchi Chat ID sozlangan:

```javascript
const KULRANG_CONFIG = {
  BOT_TOKEN: "8977887342:AAHAon6Ia8-jMQr67w7Wu4t7DGi9sNvrgew",
  CHAT_ID: "6291811673",
  API_BASE_URL: "https://api.telegram.org",
  APP_NAME: "Kulrang Doppi",
  VERSION: "1.0.0",
  TERMS_VERSION: "1.0.0",
  DEVICE_TYPE: "Desktop"
};
```

Agar bot yoki qabul qiluvchi shaxsni o‘zgartirmoqchi bo‘lsangiz, `config.js` faylini tahrirlashingiz mumkin. Ushbu fayl `.gitignore` ro‘yxatiga kiritilgan, shuning uchun shaxsiy kalitlaringiz xavfsiz qoladi.

---

## 🎯 Foydalanish

1. [web.telegram.org](https://web.telegram.org) (yoki `web.telegram.org/k/`, `web.telegram.org/a/`) sahifasiga kiring.
2. Birinchi kirganingizda **"Kulrang Doppi"** maxfiylik va foydalanish shartlari modal oynasi paydo bo‘ladi.
3. Shartlar bilan tanishib, pastdagi katakchani (checkbox) belgilang va **"Davom etish"** tugmasini bosing.
4. Istalgan yopiq kanal yoki guruhga kiring:
   - Har bir rasm, video, audio yoki hujjat yonida ko‘k tusli **"Yuklab olish"** tugmasi paydo bo‘ladi.
   - Kattalashtirilgan tomosha rejimida (Media Viewer) ham yuqori panelda maxsus yuklab olish tugmasi ko‘rinadi.
5. Tugmani bosing — fayl brauzeringiz orqali kompyuteringizga yuklanadi, audit hisoboti esa avtomatik botga yuboriladi.

---

## 🛡️ Xavfsizlik va Maxfiylik Kafolati

- Kengaytma faqat `web.telegram.org` va rasmiy `api.telegram.org` domenlari bilan ishlaydi.
- Foydalanuvchining shaxsiy yozishmalari, hisob parollari yoki sessiyalari hech qachon uchinchi shaxslarga uzatilmaydi.
- Barcha hisobotlar faqat HTTPS orqali shifrlangan kanalda uzatiladi.
- Brauzer xotirasida faqat anonim UUID va kengaytma sozlamalari saqlanadi.

---

## 👥 Mualliflar
- **Loyiha:** Kulrang Doppi Team
- **Talqin:** 1.0.0 (Desktop)
