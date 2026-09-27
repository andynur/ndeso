# MASTER PROMPT — Ndeso

> Cara pakai: salin salah satu prompt di bawah ke sesi Claude Code (cloud: claude.ai/code → pilih repo ini).
> Aturan proyek sudah dimuat otomatis dari `CLAUDE.md` + `AGENTS.md`, jadi **prompt harian cukup pendek**. Prompt panjang = token terbuang di setiap sesi.
> Prompt ditulis dalam bahasa Inggris karena lebih hemat token dan konsisten dengan dokumen teknis. Kamu tetap boleh chat dalam bahasa Indonesia.

---

## 1. Prompt pertama (sekali saja, untuk bootstrap M0)

```text
You are the lead engineer for Ndeso, an open-source HD-2D farming sim
(Harvest Moon: Back to Nature-like, Indonesian culture) for desktop and low-end
Android browsers. Rules are in CLAUDE.md/AGENTS.md; follow them strictly.

Context to read now (only these):
1. docs/STATUS.md (Now block)
2. docs/ROADMAP.md → milestone M0
3. docs/TECH_STACK.md and docs/ARCHITECTURE.md §1–2
4. docs/TESTING.md §1

Goal of this session: complete M0-01 and M0-02 only.
- Bun 1.4.1 workspaces, strict TS, Biome, scripts named exactly as in TESTING.md §1
  (scripts that have no implementation yet print "TODO <task-id>" and exit 0).
- Keep the existing files (docs, .claude/, locales, scripts/) untouched unless needed.
- Verify with `bun install` and `bun run check`.
- Finish with the session-handoff skill (ROADMAP ticks, STATUS update, commit).

Constraints: no dependencies outside TECH_STACK.md §2; show me the plan in ≤ 10
lines first, then implement without waiting unless something is ambiguous.
```

## 2. Prompt harian standar (paling hemat)

```text
/next-task
```
atau, jika ingin task tertentu:
```text
/next-task M1-03
```
Jika slash command tidak muncul di antarmukamu, tulis saja: `Use the next-task skill (M1-03).`
Skill `next-task` sudah berisi seluruh alur: orientasi, rencana, implementasi, `bun run check`, review subagent, handoff. Tidak perlu mengulang aturan di prompt.

## 3. Variasi prompt

**Bug dari playtest**
```text
Bug: <what happens> on <device/browser>. Expected: <…>. Steps: <…>.
Find the root cause first (use the scout agent if the area is unclear), write a failing
test that reproduces it, then fix. One bug only. Handoff when done.
```

**Tambah konten**
```text
Use the add-game-content skill: add crop "jagung" per GDD §4.3 (EN + ID strings,
placeholder sprite ids, content test). Don't touch other crops.
```

**Review sebelum merge**
```text
Run the reviewer agent on this branch vs main and the perf-auditor if render code
changed. List blockers only; fix them; re-run bun run check.
```

**Terjemahan**
```text
Use the i18n-translator agent to resolve every [TODO-ID] string. Report unsure ones.
```

**Keputusan arsitektur**
```text
I want to <change>. Don't implement yet. Compare 2–3 options against ADRs and
PERFORMANCE_BUDGET, recommend one, and draft a new ADR file. Wait for my OK.
```

**Beberapa sesi cloud paralel** (hanya untuk task yang tidak saling menyentuh file yang sama)
```text
Session A: /next-task M2-02      Session B: /next-task M2-14
```
Satu sesi = satu task = satu branch/PR. Gabungkan PR satu per satu, lalu mulai sesi baru dari `main` terbaru.

## 4. Kebiasaan hemat token

| Lakukan | Hindari |
|---|---|
| Satu task per sesi, lalu tutup | Satu sesi maraton berjam-jam |
| `/next-task` atau prompt ≤ 5 baris | Menempelkan ulang isi PRD/GDD ke prompt |
| Sebut section dokumen: "per GDD §4.3" | "Baca semua docs dulu" |
| `/compact keep <hal penting>` saat konteks > 60% | Menunggu auto-compact di tengah task |
| Minta hasil ringkas ("blockers only") | Minta ringkasan panjang setiap langkah |
| Ketik `terse` atau `hemat token` untuk chat super singkat | Mode singkat untuk docs/dialog (kualitas turun) |
| Simpan keputusan di STATUS.md/ADR | Mengandalkan riwayat chat lama |

## 5. Checklist manusia (yang tidak bisa dikerjakan agent)

- [ ] Uji di HP Android murah + in-app browser WhatsApp setiap akhir milestone (TESTING §4)
- [ ] Review budaya oleh orang dari daerah terkait (CULTURE_GUIDE §1.5)
- [ ] Aset final (art/musik) atau kurasi aset berlisensi CC
- [ ] Merge PR setelah CI hijau + cek visual
- [ ] Menentukan judul final game (PRD §12)
