# PRD — Balé

| Field | Value |
|---|---|
| Status | Draft v0.1 |
| Last updated | 2026-09-26 |
| Owner | Project maintainer |
| Related | [GDD](GDD.md) · [DESIGN](DESIGN.md) · [ARCHITECTURE](ARCHITECTURE.md) · [ROADMAP](ROADMAP.md) |

## 1. Summary

Balé is an open-source, browser-based farming and life sim in the spirit of *Harvest Moon: Back to Nature* and *Coral Island*, set on a fictional Indonesian island. It uses an **HD-2D** look (low-poly 3D world + 2D sprite characters) and runs instantly from a link on desktop and **low-to-mid-range Android phones**, with no store install required. It is playable offline as a PWA and ships in **English and Bahasa Indonesia** from day one.

## 2. Problem & opportunity

- Popular farming sims are Western- or Japanese-themed. There are few games in which Indonesian players see their own village life: *sawah* terraces, *gotong royong*, *pasar* on *pasaran* days, monsoon seasons.
- Most Indonesian players are on Android phones with 3–4 GB RAM and limited mobile data. Big store downloads (Steam or Play Store builds of 500 MB+) are a barrier.
- Shareable web links (WhatsApp groups, TikTok bios) are a strong distribution channel in Indonesia, but most web games are shallow. A deep, cozy sim that loads in seconds would fill that gap.

## 3. Vision

> "Open a link and in under 15 seconds you are standing in your *sawah* at dawn, with rain clouds on the hills and the *kentongan* sounding from the village."

Pillars (every feature must serve at least one):

1. **Cozy & grounded.** Relaxing daily rhythm, no fail states, seasons that matter.
2. **Authentically Indonesian.** Culture expressed through *systems* (irrigation sharing, market cycles, festivals), not just skins. See [CULTURE_GUIDE](CULTURE_GUIDE.md).
3. **Instant & light.** Link to play, small downloads, runs on a cheap phone, works offline.
4. **Open.** Open source, moddable data, community contributions, including cultural review.

## 4. Target users

| Persona | Description | Needs |
|---|---|---|
| **Rina, 22, student, Surabaya** | Redmi phone with 4 GB RAM and a monthly data quota. Plays casual games in breaks. Found the link in a WA group. | Fast load, low data use, short sessions (5–15 min), save that never gets lost. |
| **Budi, 34, office worker, Jakarta** | Played Harvest Moon as a kid. Laptop plus a mid-range phone. | Depth (relationships, upgrades), nostalgia, cross-device progress (later). |
| **Sarah, 28, Netherlands** | Cozy-game fan, curious about Indonesia. Desktop browser. | English UI, cultural context explained in-game (glossary), keyboard or gamepad. |
| **Contributor Dimas, 25** | Indonesian dev or artist who wants to add crops, dialogs, or a regional festival. | Clear data formats, contribution guide, fast local setup. |

## 5. Goals & non-goals

### Goals (v1.0)
- G1: A complete one-year (two-season) farming loop with crops, animals, market, 8+ NPCs, and 4 festivals.
- G2: Runs at 30 fps on reference low-end Android devices ([PERFORMANCE_BUDGET](PERFORMANCE_BUDGET.md)).
- G3: First playable frame reached with ≤ 10 MB downloaded; fully playable offline after the first visit.
- G4: Full EN and ID localization, with the architecture ready for more locales (jv, su, ms).
- G5: Open-source repo that a newcomer can run with `bun install && bun run dev` in < 5 minutes.

### Non-goals (v1.0)
- Multiplayer or co-op (reconsider after v1).
- Native app store builds. A TWA wrapper for Play Store is post-v1 and optional.
- Real-money monetization. Any future monetization must be cosmetic-only (see §11).
- Photorealism, full 3D characters, and voice acting.
- Supporting iOS < 16 or browsers without WebGL2.

## 6. Scope by release

| Release | Scope | Exit criteria |
|---|---|---|
| **M0 Bootstrap** | Monorepo, tooling, CI, harness, empty scene | `bun run check` green in CI; dev server shows a Three.js scene on a phone |
| **M1 Tech spike** | Terrain plot, billboard sprite walking, day/night cycle, touch + keyboard input | 30 fps on a reference device; initial download ≤ 5 MB |
| **M2 Vertical slice** | 3 crops, clock and seasons, 2 NPCs, save/load, PWA offline, EN/ID | A tester plays 7 in-game days on a phone without help |
| **M3 Alpha** | Full farm and village map, 10 crops, chickens and cows, market with pasaran, 6 NPCs, 1 festival | Closed test with 30 players; crash-free sessions ≥ 99% |
| **M4 Beta** | All v1 content, irrigation/subak system, 4 festivals, accessibility options, cloud save (optional) | Public link; D1 retention ≥ 30% |
| **v1.0** | Polish, performance, community-reviewed cultural content | All NFRs met on reference devices |

Details and task IDs: [ROADMAP](ROADMAP.md).

## 7. Functional requirements

Priority: **P0** = required for the vertical slice, **P1** = v1.0, **P2** = nice to have.

### 7.1 Core & world
| ID | Requirement | Pri |
|---|---|---|
| FR-001 | Game loads from a URL and shows an interactive title screen without any install step. | P0 |
| FR-002 | The player moves in a 3D world with a follow camera (fixed pitch, limited yaw rotation in 90° steps). | P0 |
| FR-003 | The world is split into areas (Farm, Village, Market, Beach, Forest, Hills) that stream in on demand. | P1 |
| FR-004 | Day/night cycle with dynamic sun and moon lighting and ambient color grading per time of day. | P0 |
| FR-005 | Weather: clear, cloudy, rain, heavy rain (storm). Rain waters crops automatically. | P0/P1 |

### 7.2 Time & calendar
| ID | Requirement | Pri |
|---|---|---|
| FR-010 | Game clock runs 06:00–02:00. One in-game minute equals ~0.7 s real time (tunable). Passing out at 02:00 costs money and stamina. | P0 |
| FR-011 | Two seasons, *Musim Hujan* and *Musim Kemarau*, of 28 days each. The last 7 days of each form a *pancaroba* transition with mixed weather. | P0 |
| FR-012 | Seven-day week combined with the Javanese five-day *pasaran* cycle (Legi, Pahing, Pon, Wage, Kliwon). The market opens on its *pasaran* day. | P1 |
| FR-013 | Calendar UI shows festivals, NPC birthdays, and market days. | P1 |

### 7.3 Farming
| ID | Requirement | Pri |
|---|---|---|
| FR-020 | Tile-based farm plots: hoe → plant → water → grow → harvest. | P0 |
| FR-021 | Crops have season, growth days, regrowth, sell price, and water need (see [GDD §4](GDD.md#4-farming)). | P0 |
| FR-022 | Wet-rice paddy (*sawah*) plots need flooding via irrigation channels, a separate plot type. | P1 |
| FR-023 | Irrigation sharing (*subak*-inspired): water allocation schedule negotiated at village meetings affects which days your paddies get water. | P1 |
| FR-024 | Pests (e.g. *wereng*) and crop disease, prevented by crop rotation and natural remedies. | P2 |
| FR-025 | Tool upgrades (hoe, watering can, sickle, axe) at the *pandai besi* (blacksmith). | P1 |

### 7.4 Animals
| ID | Requirement | Pri |
|---|---|---|
| FR-030 | Chickens (*ayam kampung*): feed, eggs, affection. | P0 (1 chicken) / P1 |
| FR-031 | Cows or *kerbau*: milk (cows); *kerbau* can plow paddies faster. | P1 |
| FR-032 | Ducks herded to paddies (*bebek angon*) eat pests and produce eggs. | P2 |
| FR-033 | Fish pond / *mina padi* (fish in paddy water). | P2 |

### 7.5 Economy & market
| ID | Requirement | Pri |
|---|---|---|
| FR-040 | Shipping box (*keranjang setoran*) pays overnight at base price. | P0 |
| FR-041 | Market (*pasar*) on its *pasaran* day pays more, with daily price fluctuation per item. | P1 |
| FR-042 | Shops: seeds (*toko tani*), general store (*warung*), blacksmith, carpenter. | P0 (seed shop) / P1 |
| FR-043 | Currency is Rupiah (Rp) with realistic-feeling but gamified values (see GDD §6). | P0 |
| FR-044 | Middleman (*tengkulak*) story arc: pays instantly at low prices, which creates a moral/economic choice. | P2 |

### 7.6 NPCs & social
| ID | Requirement | Pri |
|---|---|---|
| FR-050 | NPCs follow daily schedules that depend on weekday, weather, and season. | P0 (2 NPCs) |
| FR-051 | Dialog via Ink scripts, with branching based on friendship and flags. | P0 |
| FR-052 | Friendship levels (0–10 hearts). Gifts, with liked/disliked items per NPC. | P1 |
| FR-053 | Marriage candidates (4+) with heart events. Culturally appropriate courtship (*lamaran*). | P1 |
| FR-054 | *Gotong royong* community events (village clean-up, repairing an irrigation dam) raise the reputation of the whole village. | P1 |

### 7.7 Festivals & minigames
| ID | Requirement | Pri |
|---|---|---|
| FR-060 | *Sedekah Bumi* (harvest thanksgiving) at the end of Musim Hujan. | P1 |
| FR-061 | *Tujuhbelasan* (Independence Day) with minigames: *balap karung*, *makan kerupuk*, *panjat pinang*. | P1 |
| FR-062 | *Pasar Malam* night market with food stalls and a ferris wheel. | P1 |
| FR-063 | *Lomba Layang-layang* (kite festival) in Musim Kemarau. | P2 |

### 7.8 Persistence
| ID | Requirement | Pri |
|---|---|---|
| FR-070 | Autosave at the end of each day and whenever the tab is hidden (`visibilitychange`). | P0 |
| FR-071 | Three save slots, stored in IndexedDB with a versioned schema and migrations. | P0 |
| FR-072 | Export/import a save as a file (and as a short code in P2) for device transfer. | P1 |
| FR-073 | Optional cloud save with Google login or a guest code. The server validates saves. | P2 |

### 7.9 Localization
| ID | Requirement | Pri |
|---|---|---|
| FR-080 | All player-facing text comes from locale files. EN is the source; ID must reach 100% key parity. | P0 |
| FR-081 | Language switch at runtime without reload. The default follows the browser language (`id*` → ID, otherwise EN). | P0 |
| FR-082 | Numbers, dates, and currency formatted per locale (`Rp 12.500` in ID, `Rp 12,500` in EN). | P0 |
| FR-083 | In-game glossary (*Kamus*) explains cultural terms, shown to EN players on first encounter. | P1 |
| FR-084 | The architecture supports adding locales (e.g. `jv`, `su`) with no code changes. | P1 |

Details: [I18N](I18N.md).

### 7.10 Settings & accessibility
| ID | Requirement | Pri |
|---|---|---|
| FR-090 | Graphics presets (Low/Medium/High), auto-selected from a first-run benchmark. | P0 |
| FR-091 | Battery saver: 30 fps cap, reduced effects. | P1 |
| FR-092 | Text size (100/125/150%), reduce motion, colorblind-safe crop indicators. | P1 |
| FR-093 | Input: touch (virtual joystick + context button), keyboard/mouse, gamepad. | P0 (touch + keyboard) |
| FR-094 | Audio: separate volume for music, SFX, and ambience; mute when the tab is hidden. | P0 |

## 8. Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-01 | Initial download to first interactive frame | ≤ 10 MB (gzip/brotli), ≤ 8 s on 4G mid-range |
| NFR-02 | Frame rate on reference low-end device | ≥ 30 fps p95 in farm area |
| NFR-03 | JS heap + GPU memory | ≤ 350 MB total on reference device |
| NFR-04 | Offline | Fully playable offline after first full load |
| NFR-05 | Browser support | Chrome Android 110+, Samsung Internet 22+, Safari iOS 16.4+, desktop evergreen, **WhatsApp/Instagram/TikTok in-app browsers** |
| NFR-06 | Save integrity | Zero save-loss bugs; saves are versioned and migrated, with a backup of the last good save |
| NFR-07 | Determinism | Sim is deterministic given seed + inputs (enables tests and server validation) |
| NFR-08 | Accessibility | UI touch targets ≥ 48 dp; WCAG AA contrast for UI text |
| NFR-09 | Privacy | No tracking without consent. Analytics are anonymous and aggregate. No PII stored without login. |
| NFR-10 | Code quality | `bun run check` (types, lint, tests, i18n parity, size budget) green on every PR |

Full budget: [PERFORMANCE_BUDGET](PERFORMANCE_BUDGET.md).

## 9. Success metrics

| Metric | Vertical slice | v1.0 |
|---|---|---|
| Time to first interaction (p75, Android) | < 10 s | < 8 s |
| Sessions reaching day 2 | 60% of testers | 50% of all players |
| D1 / D7 retention | n/a | 30% / 12% |
| Crash-free sessions | 98% | 99.5% |
| Avg fps (p50, low tier) | 30 | 30+ |
| Community contributions merged | — | 20+ PRs from non-core contributors |
| Cultural review | — | Every festival/NPC reviewed by at least 1 community reviewer from that region |

## 10. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Low-end GPU performance with 3D world | High | HD-2D with aggressive budgets, instancing, Low preset, test on real devices from M1 |
| In-app browsers (WA/IG) kill WebGL or storage | High | Detect in-app browser and show an "Open in Chrome" hint; autosave often; test each release |
| iOS Safari quirks (audio unlock, storage eviction) | Medium | Audio unlock on first touch; request persistent storage; export-save feature |
| Cultural misrepresentation | High (reputation) | [CULTURE_GUIDE](CULTURE_GUIDE.md), community reviewers, "culture feedback" issue template |
| Scope creep | High | Strict milestone exit criteria; P2 items stay out until v1 |
| Bun 1.4 regressions (new Rust rewrite) | Medium | Pin version in `.bun-version`; upgrade only via PR with green CI |
| Asset production bottleneck | Medium | Low-poly style, reusable kits, CC-licensed contributions, placeholder-first workflow |

## 11. Business model & licensing

- Code: MIT. Original art, audio, and writing: CC BY-SA 4.0 ([ADR-0005](adr/0005-licensing.md)).
- Free to play on the web. Optional donations (Saweria, Trakteer, GitHub Sponsors).
- Any future paid content must be cosmetic and must never block progression.

## 12. Open questions

1. Final game title and island name (check trademark and domain availability).
2. Is cloud save worth the operational cost for v1, or should we ship export/import only?
3. Which regional festivals beyond the Javanese/Balinese core? Needs community input.
4. Keep the Play Store TWA as a post-v1 experiment?
