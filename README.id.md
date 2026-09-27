# 🌾 Ndeso*

**Game simulasi bertani bergaya HD-2D berlatar sebuah pulau di Indonesia. Open source, langsung main di browser, di laptop maupun HP Android kelas menengah ke bawah.**

*English: [README.md](README.md)*

> Status: **pra-alfa, tahap perencanaan dan bootstrap** (lihat [docs/STATUS.md](docs/STATUS.md)).

## Kenapa game ini?
Terinspirasi *Harvest Moon: Back to Nature* dan *Coral Island*, dengan kehidupan desa Indonesia sebagai intinya: sawah terasering, berbagi air ala subak, hari pasar mengikuti *pasaran* Jawa, gotong royong, dan festival seperti Tujuhbelasan. Tanpa instalasi: buka link, main, dan tetap bisa main saat offline.

## Rencana fitur
- Tampilan HD-2D: dunia 3D low-poly dengan karakter sprite pixel-art (Three.js, WebGL2)
- 30 fps di HP Android murah, unduhan awal ≤ 10 MB, bisa offline (PWA)
- Bahasa Inggris 🇬🇧 dan Bahasa Indonesia 🇮🇩 sejak awal; bahasa daerah menyusul lewat kontribusi
- Konten berbasis data yang mudah dimodifikasi (tanaman, NPC, festival, dialog Ink)

## Mulai
```bash
bun install
bun run dev      # buka URL LAN yang muncul, juga dari HP
bun run check    # cek tipe, lint, i18n, konten, dan test
```
*(Script dibuat di milestone M0, lihat [ROADMAP](docs/ROADMAP.md).)*

## Pakai AI agent (Claude Code)?
Ikuti [docs/id/SETUP_AI_AGENT.md](docs/id/SETUP_AI_AGENT.md), lalu pakai prompt dari [MASTER_PROMPT.md](MASTER_PROMPT.md).

## Kontribusi
Kode, gambar, musik, terjemahan, dan **pengetahuan budaya daerahmu** semuanya disambut. Baca [CONTRIBUTING.md](CONTRIBUTING.md) (tersedia dalam dua bahasa).

## Lisensi
Kode: [MIT](LICENSE). Art, audio, dan tulisan orisinal: [CC BY-SA 4.0](LICENSE-ASSETS.md).
