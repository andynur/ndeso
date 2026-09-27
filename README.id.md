# 🌾 Balé

**Game simulasi bertani bergaya HD-2D berlatar Baledono, Purworejo, Jawa Tengah. Open source, langsung main di browser, di laptop maupun HP Android kelas menengah ke bawah.**

*English: [README.md](README.md)*

> Status: **pra-alfa, tahap M1 tech spike** (lihat [docs/STATUS.md](docs/STATUS.md)).
>
> Tiap merge ke `main` menerbitkan build ke **<https://andynur.github.io/ndeso/>**. Sekarang isinya masih placeholder yang berputar, belum game. Bisa jalan-jalan mulai M1-09; bisa dimainkan mulai M2.
>
> *Penerbitan menunggu satu setelan repo sekali jalan — lihat [SETUP_AI_AGENT](docs/id/SETUP_AI_AGENT.md).*

## Ceritanya
Kamu pulang dari Jakarta ke Purworejo, mengambil alih sebidang tanah dari kakekmu, **Mbah Hita** — masih ada, sudah sepuh, sudah tidak kuat menggarap. Mbah Hita punya cita-cita yang belum selesai: menjadikan tanah itu **asri, nyaman, tenang**. Karena itu namanya **Balé Al Jannah**.

Bertani itu caranya. Tujuannya bukan seberapa banyak uangmu, tapi **seberapa enak tempatnya** — serindang apa, senyaman apa, setenang apa.

## Kenapa game ini?
Terinspirasi *Harvest Moon: Back to Nature* dan *Coral Island*, tapi berpijak pada satu tempat yang betulan ada. Waktunya jalan seperti di sana: **12 mangsa pranata mangsa**, siklus **pasaran** lima hari untuk hari pasar, dan kalender **Hijriah** yang membuat Ramadhan dan Lebaran bergeser melewati musim. Tanpa instalasi: buka link, main, dan tetap bisa main saat offline.

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
