# Ada

Windows için Dynamic Island — ekranın üstünde kompakt bir ada.

Fareyle üzerine gelince açılır; müzik, hava, takvim, hızlı notlar ve hesap makinesi gösterir. Fare çekilince küçülür (veya üstte pencere varken ince “slime” olur).

![Ada](https://img.shields.io/badge/Windows-10%2F11-blue) ![Tauri](https://img.shields.io/badge/Tauri-v2-orange) ![License](https://img.shields.io/badge/license-MIT-green)

## Özellikler

- Hover ada + tıklama geçirme (altındaki pencereye tıklanır)
- Slime / çentik / açık modlar
- Müzik (Windows SMTC) — tekerlekle sayfa değiştir
- Hava, saat, pil
- Google Takvim (kendi OAuth istemcin)
- Hızlı notlar (animasyonlu)
- Hesap makinesi (numpad destekli)
- Ses / parlaklık HUD
- Sistem tepsisi + ayarlar
- PC açılışında otomatik başlama

## Kurulum (kullanıcı)

1. [Releases](../../releases) sayfasından `Ada_0.1.0_x64-setup.exe` indir
2. Kur — masaüstü ve Başlat menüsü kısayolu oluşur
3. İlk açılışta tepsi ikonundan **Ayarlar → Açılışta başlat** açık gelsin

Geliştirici sürümü: `src-tauri/target/release/ada.exe`

## Geliştirme

```bash
npm install
npm run tauri dev
```

Release build:

```bash
npm run tauri build
```

Çıktı:

- `src-tauri/target/release/ada.exe`
- `src-tauri/target/release/bundle/nsis/Ada_0.1.0_x64-setup.exe`

## Google Takvim

1. `.env.example` → `.env`
2. [Google Cloud](https://console.cloud.google.com/) → Calendar API + OAuth **Desktop** client
3. Consent: **Testing** + kendi Gmail’ini **Test users**’a ekle
4. `ADA_GOOGLE_CLIENT_ID` / `ADA_GOOGLE_CLIENT_SECRET`
5. Ada → Bugün → Google’a bağlan

`.env` asla commit edilmez.

## Stack

| Katman | Teknoloji |
|---|---|
| Kabuk | Tauri v2 |
| UI | React + TypeScript + Vite + Tailwind + Framer Motion |
| Sistem | Rust (`windows` crate) |

## Katkı

PR ve issue açabilirsin. Direkt `main`’e push yetkisi yalnızca repo sahibinde — çatalla (fork) çalış, PR gönder.

## Lisans

MIT — dilediğin gibi kullan, incele, çatalla.

Detaylı ürün notları: [ADA-PROJE.md](./ADA-PROJE.md)
