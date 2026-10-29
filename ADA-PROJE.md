# Ada — Windows için Dynamic Island

> Bu dosya projenin tek kaynak dokümanıdır. Cursor agent'a her fazda bu dosyayı referans ver ve **fazları sırayla** yaptır; bir faz bitmeden sonrakine geçme.

## 1. Amaç

Mac'teki çentik uygulamalarının (NotchNook, DynamicLake vb.) Windows karşılığını kendimiz yazıyoruz. Ekranın üst ortasında küçük, siyah, hap şeklinde bir **ada** duracak. Fare üzerine gelince genişleyip müzik, hava durumu, takvim gibi bilgileri gösterecek; fare gidince tekrar küçülecek.

Neden kendimiz yapıyoruz:
- Hazır uygulamalarda (DynamicWin, Notchify) ya istediğimiz özellik yok ya da kaynak kodu kapalı.
- DynamicWin'in Google Takvim bağlantısı, uygulama Google tarafından doğrulanmadığı için engelleniyor. Kendi OAuth istemcimizle bu sorun olmayacak.
- Sürekli açık duracağı için hafif olmalı; kontrol tamamen bizde olacak.

## 2. Teknoloji

| Katman | Seçim |
|---|---|
| Uygulama çatısı | **Tauri v2** |
| Arayüz | React + TypeScript + Vite |
| Stil / animasyon | Tailwind CSS + Framer Motion |
| Sistem tarafı | Rust (`windows` crate) |
| Ayarlar | `tauri-plugin-store` |
| Açılışta başlatma | `tauri-plugin-autostart` |
| Sistem tepsisi | Tauri tray-icon özelliği |
| Gizli bilgiler (token) | `keyring` crate (Windows Credential Manager) |

Hedef platform: Windows 10 ve 11.

## 3. Performans hedefleri

Ada sürekli açık kalacağı için bunlar zorunlu:
- Boştayken RAM **< 80 MB**, CPU **< %1**.
- Ada kapalıyken gereksiz render yok; şarkı ilerleme çubuğu sadece ada açıkken saniyede bir güncellenir.
- Polling yerine mümkün olan her yerde **event** kullanılır (medya değişiklikleri gibi).
- Hava durumu 15 dakikada bir, takvim 5 dakikada bir çekilir.

## 4. Pencere ve etkileşim

### Pencere ayarları (`tauri.conf.json`)
- `decorations: false`, `transparent: true`, `alwaysOnTop: true`, `skipTaskbar: true`, `shadow: false`, `resizable: false`, `focus: false`
- Pencere, adanın **en geniş hali** boyutunda sabit (ör. 420×220 px) ve seçili monitörün üst ortasına yerleştirilir.

### Tıklamanın arkaya geçmesi (en kritik nokta)
Pencere şeffaf ama sabit boyutlu olduğu için, adanın dışındaki boş alanlar altındaki pencerelere tıklamayı engellememeli.

Yöntem:
1. Varsayılan olarak `window.set_ignore_cursor_events(true)`.
2. Rust tarafında ~50 ms aralıkla `GetCursorPos` ile imleç konumu okunur.
3. İmleç adanın o anki dikdörtgeninin içine girince `set_ignore_cursor_events(false)` yapılır ve frontend'e `island:hover` event'i gönderilir.
4. İmleç çıkınca, ~300 ms gecikmeyle tekrar `true` yapılır ve `island:leave` gönderilir.
5. Frontend, adanın güncel boyutunu (kompakt/açık) her değiştiğinde Rust'a bildirir ki hit-test doğru olsun.

Not: Pencereyi her hover'da yeniden boyutlandırma yaklaşımı **kullanılmayacak**; Windows'ta animasyon sırasında titreme yapıyor.

### Durumlar
- **Kompakt:** ~200×32 px hap. Müzik çalıyorsa solda albüm kapağı, sağda animasyonlu ses dalgası. Çalmıyorsa saat ve hava durumu ikonu.
- **Açık:** ~400×200 px, köşeleri yuvarlak. İçinde sekmeler/kartlar.
- Geçişler Framer Motion ile yaylı (spring) animasyon; Apple Dynamic Island hissi.
- Tam ekran uygulama (oyun, video) açıkken ada gizlenir.

### Çoklu monitör
Ayarlardan adanın hangi monitörde duracağı seçilir. Varsayılan: birincil monitör. Çözünürlük veya monitör değişince konum yeniden hesaplanır.

## 5. Özellikler ve fazlar

### Faz 1 — İskelet
- [x] Tauri v2 + React + TS projesi kurulumu
- [x] Şeffaf, çerçevesiz, her zaman üstte pencere; üst ortaya sabitlenmiş
- [x] Bölüm 4'teki tıklama geçirme ve hover algılama
- [x] Kompakt ↔ açık animasyonu (içerik olarak sadece saat)
- [x] Sistem tepsisi ikonu: Ayarlar, Çıkış

**Kabul kriteri:** Ada üst ortada duruyor, üstüne gelince açılıyor, ayrılınca kapanıyor; adanın dışındaki alanlara tıklamak altındaki pencereye gidiyor.

### Faz 2 — Müzik (asıl özellik)
- [x] Rust'ta Windows medya oturumu API'si: `GlobalSystemMediaTransportControlsSessionManager`
  - `windows` crate özellikleri: `Media_Control`, `Foundation`, `Storage_Streams`
- [x] Çalan şarkı: başlık, sanatçı, albüm kapağı (thumbnail stream → base64), oynatma durumu, süre/konum
- [x] Event'ler: polling tabanlı `media:update` (session/özellik değişiminde emit)
- [x] Kontroller: oynat/durdur, önceki, sonraki
- [x] Kompakt halde kapak + ses dalgası animasyonu; açık halde tam oynatıcı ve ilerleme çubuğu
- [ ] Spotify, tarayıcıdaki YouTube ve Windows Media Player ile test (manuel)

**Kabul kriteri:** Spotify veya YouTube'da şarkı açınca adada kapak ve bilgiler 1 saniye içinde görünüyor, butonlar çalışıyor.

### Faz 3 — Hava durumu, saat, pil
- [x] Open-Meteo API (ücretsiz, anahtar gerektirmez)
- [x] `weather_code` → ikon eşlemesi
- [x] Konum ayarlardan değiştirilebilir (varsayılan İstanbul)
- [x] Pil yüzdesi ve şarj durumu (`GetSystemPowerStatus`), masaüstünde pil yoksa gizlenir
- [x] Saat ve tarih (Türkçe)
- [x] Tam ekranda gizle

### Faz 4 — Ayarlar penceresi
- [x] Ayrı, normal bir pencere (tepsi ikonundan açılır)
- [x] Ayarlar: monitör seçimi, açılışta başlat, hangi widget'lar görünsün, hava durumu konumu, tam ekranda gizle
- [x] `tauri-plugin-store` ile JSON olarak kaydedilir
- [x] `tauri-plugin-autostart` entegrasyonu

### Faz 5 — Google Takvim
- [ ] Google Cloud Console'da proje aç, Calendar API'yi etkinleştir *(kullanıcı)*
- [ ] OAuth onay ekranı: **External**, yayın durumu **Testing**, kendi Gmail adresini **Test users**'a ekle *(kullanıcı)*
- [ ] OAuth istemcisi türü: **Desktop app** *(kullanıcı)*
- [x] Akış: PKCE + loopback redirect (`http://127.0.0.1:<rastgele port>`), varsayılan tarayıcıda giriş
- [x] Kapsam sadece `https://www.googleapis.com/auth/calendar.readonly`
- [x] Refresh token `keyring` ile Windows Credential Manager'da saklanır, **asla düz dosyada değil**
- [x] Bugünün ve yarının etkinlikleri; yaklaşan etkinliğe 10 dk kala kompakt adada uyarı
- [x] Token geçersizse "Yeniden bağlan" butonu
- [x] Client secret/ID: `.env` (repoya commit edilmez); bkz. `.env.example`

### Faz 6 — Ekstralar (isteğe bağlı)
- [x] Dosya tepsisi: adaya sürükle-bırak, AppData `drop-tray`, aç / gezginde göster / sil
- [x] Pano geçmişi (son 10 metin)
- [x] Zamanlayıcı / pomodoro
- [x] Ses HUD (IAudioEndpointVolume) + parlaklık HUD (WMI WmiMonitorBrightness; masaüstünde panel yoksa sessizce atlanır)

## 6. Klasör yapısı

```
ada/
├── src/                      # React frontend
│   ├── components/
│   │   ├── Island.tsx        # Kompakt/açık durum, animasyonlar
│   │   ├── MediaPlayer.tsx
│   │   ├── Weather.tsx
│   │   ├── Calendar.tsx
│   │   └── Clock.tsx
│   ├── hooks/                # useMedia, useWeather, useIslandState
│   ├── settings/             # Ayarlar penceresi
│   └── lib/tauri.ts          # invoke/event sarmalayıcıları, tipler
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── window.rs         # Konumlama, hit-test, cursor polling
│   │   ├── media.rs          # SMTC
│   │   ├── system.rs         # Pil, tam ekran algılama
│   │   ├── calendar.rs       # OAuth + Calendar API
│   │   └── tray.rs
│   └── tauri.conf.json
└── ADA-PROJE.md
```

## 7. Rust ↔ Frontend sözleşmesi

**Komutlar (`invoke`):**
- `media_play_pause()`, `media_next()`, `media_previous()`
- `set_island_bounds(width, height)` — hit-test için
- `get_settings()`, `save_settings(settings)`
- `calendar_connect()`, `calendar_disconnect()`, `calendar_events()`

**Event'ler (`listen`):**
- `media:update` → `{ title, artist, album, thumbnail_base64, is_playing, position_ms, duration_ms, source_app }` veya `null`
- `island:hover`, `island:leave`
- `system:battery` → `{ percent, charging }`
- `system:fullscreen` → `boolean`

Tüm tipler `src/lib/tauri.ts` içinde TypeScript olarak tanımlanır ve Rust struct'larıyla (serde) birebir eşleşir.

## 8. Tasarım

- Ada her zaman **saf siyah** (#000), ekran temasından bağımsız; Apple hissi bunu gerektiriyor.
- Yazılar beyaz, ikincil bilgiler %60 opaklık.
- Font: Segoe UI Variable (Windows'un kendi fontu).
- Köşe yarıçapı: kompakt 16 px, açık 28 px.
- Animasyon: spring, `stiffness ~400`, `damping ~30`; hızlı ama yumuşak.
- Arayüz metinleri Türkçe.

## 9. Cursor için çalışma kuralları

- Her faz ayrı bir oturum/istek; faz bitince kabul kriterini test et, sonra commit.
- Rust'ta `unwrap()` yok; hatalar loglanır, ada asla çökmez (medya oturumu yoksa sadece boş durum gösterilir).
- Yeni bağımlılık eklemeden önce gerekçesini yaz.
- Gizli bilgi (client secret, token) asla koda veya repoya girmez.
- Release build'de RAM/CPU'yu Görev Yöneticisi'nden kontrol et; Bölüm 3 hedefleri aşılıyorsa önce onu düzelt.
