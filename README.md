# Auto-Reels ⚡

**Auto-Reels** TikTok, Instagram Reels ve YouTube Shorts videolarını filigransız indiren ve üzerlerine özelleştirilebilir yazılar eklemenizi sağlayan web uygulamasıdır.

Uygulama hem **GitHub Pages** üzerinde (istemci tarafı web modu) hem de bilgisayarınızda **Python + FastAPI + yt-dlp + FFmpeg** ile yüksek performanslı yerel mod olarak çalışır!

---

## 🚀 GitHub Pages Üzerinden Yayınlama (Canlı Web Sitesi)

Uygulamayı doğrudan GitHub üzerinde canlı site olarak çalıştırmak için:

1. Bu projeyi bir GitHub reposuna yükleyin:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Auto-Reels"
   git branch -M main
   git remote add origin https://github.com/KULLANICI_ADI/auto-reels.git
   git push -u origin main
   ```
2. GitHub Reponuzda **Settings > Pages** sekmesine gidin.
3. **Source** kısmını **GitHub Actions** veya `main` branch olarak seçin.
4. Birkaç saniye içinde siteniz canlıya alınacaktır:
   👉 `https://KULLANICI_ADI.github.io/auto-reels`

---

## 💻 Bilgisayarınızda Yerel Çalıştırma (Python Backend)

1. `auto-reels` klasöründe yer alan **`start.bat`** dosyasına çift tıklayın.
2. Veya terminalde şu komutu çalıştırın:
   ```bash
   python run.py
   ```
3. Uygulama otomatik olarak bağımlılıkları yükleyecek ve tarayıcınızda `http://localhost:8000` adresini açacaktır.

---

## 🌟 Özellikler

- 🎵 **TikTok Filigransız HD İndirme**
- 📸 **Instagram Reels & Gönderiler**
- ▶️ **YouTube Shorts & Videolar**
- ✏️ **Video Üstü Yazı Düzenleyici**:
  - Canlı önizleme
  - Özelleştirilebilir yazı boyutu (20px - 80px)
  - Renk ve arka plan kutusu stilleri (Yarı siyah, Sarı, Beyaz, Şeffaf)
  - Üst, Orta, Alt konumlandırma
- 📁 **Tek Tıkla Klasör Açma** (Yerel modda Windows Dosya Gezgini entegrasyonu)
- 💾 **Dahili Medya Galerisi & Oynatıcı**
