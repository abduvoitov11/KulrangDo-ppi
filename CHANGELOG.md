# 📜 O‘zgarishlar Tarixi (Changelog)

Barcha rasmiy o‘zgarishlar, yangilanishlar va tuzatishlar ushbu hujjatda qayd etib boriladi.

---

## [1.0.0] — 2026-09-09

### 🚀 Dastlabki Rasmiy Reliz (Initial Release)

#### Yangi imkoniyatlar:
- **Manifest V3 integratsiyasi:** Google Chrome, Microsoft Edge, Brave, Opera hamda Mozilla Firefox (v109+) uchun to‘liq moslik.
- **Yopiq kanallardan media yuklab olish:** Himoyalangan kanallardagi `no-forwards` va `pointer-events: none` cheklovlarini yechish tizimi.
- **Barcha media turlari:**
  - Rasmlar (JPG, PNG, WebP)
  - Videolar (MP4, WebM)
  - Ovozli xabarlar (Voice notes — OGG / Opus)
  - Musiqa va audio fayllar (MP3, WAV)
  - Hujjatlar va fayllar (PDF, ZIP, APK va boshqalar)
  - GIF animatsiyalar
- **Maxfiylik va Foydalanish shartlari (Terms Modal):**
  - Kengaytma birinchi ishga tushganda chiqadigan to‘liq ekran qorong‘u (dark) modal oyna.
  - Shartlarni qabul qilish majburiy checkbox tizimi.
  - Holatni `localStorage` va brauzer xotirasida saqlash.
- **Telegram Botga hisobot yuborish:**
  - Har bir yuklab olingan fayl haqida shifrlangan audit ma'lumotlari (`fileName`, `source`, `size`, `timestamp`, `userId`, `deviceType`).
  - Bot xatoliklarini yashirin ushlash (silent error handling).
- **Foydalanuvchi identifikatori (UUID):**
  - Har bir desktop foydalanuvchi uchun avtomatik takrorlanmas UUID yaratilishi.
- **Popup boshqaruv paneli:**
  - Kengaytmani yoqish/o‘chirish switch tugmasi.
  - Foydalanuvchi ID sini ko‘rish va nusxa olish.
  - Jami yuklab olingan fayllar va hajm statistikasi.
  - **Batch download:** Sahifadagi barcha yuklangan medialarni bitta tugma bilan yuklab olish.
  - **Media filtrlari:** Rasm, video, audio va hujjatlarni alohida yoqish/o‘chirish imkoniyati.
  - **Yuklab olish tarixi:** So‘nggi yuklab olingan fayllar ro‘yxati.
- **Dizayn va Estetika:**
  - Zamonaviy Dark Theme uslubi.
  - Milliy "Kulrang Doppi" ramzi tushirilgan yuqori sifatli pikselli ikonkalar (16px, 48px, 128px).
  - Tugmalarda spinner yuklanish animatsiyasi va Toast bildirishnomalari.
- **Xavfsizlik:**
  - `config.js` orqali maxfiy token va ID lar `.gitignore` bilan himoyalangan.
  - Ruxsatlar faqat zaruriy `web.telegram.org` va `api.telegram.org` bilan cheklangan.

---

## [1.1.0] — 2026-09-09

### 🚀 Katta Yangilanish va Xususiyatlar:
- **Videolar va GIFlar:** Videolarni Telegram Web (Web K va A) da to‘g‘ri ajratish va to‘liq sifatda MP4 formatida yuklab olish mexanizmi (`resolveVideoUrl`).
- **Botga Fayl Uzatish:** Yuklangan barcha media fayllar (rasm, video, audio, hujjat) to‘liq holda (`sendDocument` orqali) Telegram botga yuborilishi joriy etildi. Admin bot ichida faylni to‘g‘ridan-to‘g‘ri ko‘rishi va yuklab olishi mumkin.
- **🔄 Avtomatik Yangilanish va Bildirishnomalar:**
  - `chrome.alarms` orqali har 24 soatda yangi versiyani avtomatik tekshirish.
  - `chrome.notifications` orqali tizimli brauzer bildirishnomasi chiqarish.
  - Foydalanuvchi bildirishnomani bosganda maxsus `update.html` (Yangilanish Markazi) sahifasiga yo‘naltirilishi.
  - Foydalanuvchi nazoratini saqlash uchun qo‘lda 3 bosqichli xavfsiz yangilash yo‘riqnomasi.
  - Telegram Web sahifasida va Popup oynasida yangilanishlar haqida ogohlantiruvchi yaltirovchi bannerlar.
