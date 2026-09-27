# Panduan Setup AI Agent (Claude Code Cloud via GitHub)

Panduan langkah demi langkah dari zip ini sampai sesi Claude pertama yang produktif. Penjelasan teknis lengkapnya ada di [../AI_WORKFLOW.md](../AI_WORKFLOW.md).

## Langkah 1: Siapkan repo GitHub

```bash
unzip ndeso.zip && cd ndeso
git init -b main
git lfs install            # untuk aset sumber (assets-src/) nanti
git add -A
git commit -m "chore: project docs and AI agent harness"
# buat repo kosong di GitHub (public, karena proyek open source), lalu:
git remote add origin https://github.com/andynur/ndeso.git
git push -u origin main
```

## Langkah 2: Hubungkan Claude ke GitHub

1. Buka **claude.ai/code**, lalu login.
2. Hubungkan akun GitHub dan **install Claude GitHub App** di repo `ndeso`. App ini dibutuhkan untuk akses repo dan fitur Auto-fix PR.

## Langkah 3: Buat cloud environment khusus proyek ini

Di claude.ai/code, klik ikon awan di atas kotak pesan, lalu pilih **Add cloud environment**.

| Field | Isi |
|---|---|
| Name | `ndeso` |
| Network access | **Trusted**. Pilih **Custom** + centang "include default list" jika ingin menambah domain dokumentasi, misalnya `threejs.org`, `bun.com`, `mcp.context7.com` |
| Environment variables | Lihat blok di bawah |
| Setup script | Salin **seluruh isi** `scripts/cloud-env-setup.sh` |

```text
BASH_DEFAULT_TIMEOUT_MS=300000
BASH_MAX_TIMEOUT_MS=600000
```

Tentang setup script ini:
- Script memasang **Bun 1.4.1** (VM cloud bawaannya masih Bun 1.3.x). Itu saja — proyek ini tidak memakai MCP server ([ADR-0008](../adr/0008-drop-serena-context-mode.md)).
- Script **gagal keras** kalau instalasi tidak berhasil. Versi sebelumnya menelan semua error, dan itu sebabnya dua MCP server sempat terdaftar tapi tidak pernah benar-benar terpasang selama dua milestone.
- Hasilnya di-cache sekitar 7 hari, jadi sesi berikutnya langsung siap.
- `bun install` untuk repo dijalankan otomatis oleh hook SessionStart (`scripts/hooks/session-start.sh`).
- Pemasangan Bun lewat npm sudah diuji berjalan di balik proxy cloud.

Jangan simpan secret atau API key di environment variables, karena siapa pun yang memakai environment ini bisa membacanya. Proyek ini tidak membutuhkan secret di fase awal.

## Langkah 4: Sesi pertama

1. Mulai sesi baru, pilih repo `ndeso` dan environment `ndeso`.
2. Tempel **Prompt #1** dari [`MASTER_PROMPT.md`](../../MASTER_PROMPT.md).
3. Setelah sesi berjalan, ketik `/context` untuk melihat pemakaian konteks. Idealnya konteks awal kecil.
4. Di akhir sesi, agent akan meng-update `docs/STATUS.md`, mencentang ROADMAP, lalu commit. Buat PR dari tombol di claude.ai/code, lalu merge setelah CI hijau.

## Langkah 5: Ritme harian

```text
/next-task            ← satu sesi = satu task = satu PR
```
- Review PR, cek visual jika perlu, lalu merge. Mulai sesi berikutnya dari `main` terbaru.
- Butuh paralel? Jalankan 2–3 sesi untuk task yang tidak menyentuh file yang sama.
- Aktifkan **Auto-fix** pada PR agar Claude otomatis menangani CI gagal dan komentar review.

## Langkah 6 (opsional): Setup lokal untuk maintainer

```bash
# Bun versi terkunci — ini satu-satunya yang wajib
npm i -g bun@1.4.1            # atau: curl -fsSL https://bun.sh/install | bash -s "bun-v1.4.1"
```
Tidak ada MCP server atau plugin yang perlu dipasang. Kalau nanti Anda ingin menambah satu,
baca dulu [AI_WORKFLOW §4](../AI_WORKFLOW.md) — syaratnya: setup script harus gagal keras
kalau instalasinya tidak mendarat, dan statusnya diverifikasi di sesi cloud sungguhan.

## Kenapa plugin berbeda di cloud?

Sesi cloud **tidak memasang plugin** yang dideklarasikan di repo, dan tidak membaca
`~/.claude` pribadi Anda. Jadi tool yang ada di laptop maintainer belum tentu ada di cloud.
Untuk ringkas di chat, pakai skill proyek **`terse`** — ketik `terse` atau `hemat token`.

## Troubleshooting

| Gejala | Solusi |
|---|---|
| `/mcp` kosong | Memang benar — proyek ini tidak memakai MCP server (ADR-0008) |
| Versi Bun salah (1.3.x) | Hook SessionStart akan memperbaikinya. Cek `/tmp/ndeso-session-setup.log` |
| `bun install` gagal di cloud | Minta Claude menjalankan `bash scripts/cloud-env-setup.sh`, lalu `bun install` |
| Sesi lama terasa lambat dan mahal | Tutup sesi, lalu mulai baru dengan `/next-task`. STATUS.md menjaga kesinambungan |
| Agent mengubah hal di luar task | Tolak PR dan minta "one task only". Aturan ini sudah ada di AGENTS.md #1 |
