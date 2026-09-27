# GDD — Game Design Document

> **Source of truth for gameplay numbers.** When code and this doc disagree, raise it. Do not silently change either.
> Tunable values live in `packages/content/data/*.json5`. This doc gives the **intent and starting values**.

## 1. Core loop

```
Wake 06:00 → check weather/calendar → farm chores (water, harvest, animals)
  → free time: sell at market / meet NPCs / explore / fish / gather
  → evening: festival, gifts, cooking → sleep (autosave) → overnight: growth, shipping payout
```
- **Session target:** one in-game day is about 12–15 real minutes at default speed, and it is safe to stop at any time (autosave on tab hide).
- **Long loop:** upgrade the farm and house, befriend villagers, restore the village irrigation (*subak*) system, marry, and host festivals.

## 2. Setting

- **Island:** *Pulau Lestari* (working name), a fictional island mixing Javanese, Sundanese, Balinese, and coastal Malay/Bugis influences. It is fictional so that we don't misrepresent any single real place.
- **Premise:** The player inherits their grandmother's (*Nenek*) neglected farm at the edge of *Desa Sukamaju*. The village's old irrigation dam is broken and young people have left for the city. Restoring the farm and the dam brings the village back to life.
- **Tone:** Warm, humorous, respectful. No villain. The antagonistic force is neglect and a greedy *tengkulak*, who can be redeemed.

## 3. Time & calendar

| Unit | Value |
|---|---|
| Day | 06:00 → 02:00 (20 h). Default 1 game-minute = 0.7 real s, so a day is ~14 real min |
| Week | 7 days (Senin–Minggu) plus a 5-day *pasaran* cycle (Legi, Pahing, Pon, Wage, Kliwon) |
| Season | 28 days: **Musim Hujan** (wet), **Musim Kemarau** (dry) |
| Pancaroba | Days 22–28 of each season: transitional weather, some crops of both seasons survive |
| Year | 56 days |

**Weather probabilities (per day):**

| Season | Clear | Cloudy | Rain | Storm |
|---|---|---|---|---|
| Hujan (days 1–21) | 20% | 25% | 45% | 10% |
| Kemarau (days 1–21) | 65% | 25% | 10% | 0% |
| Pancaroba | 35% | 30% | 30% | 5% |

A storm the night before means debris on the farm, and a chance of damaged crops if they are not protected. Weather is generated from the save seed and the day index (deterministic).

## 4. Farming

### 4.1 Plot types
- **Tegalan (dry field):** most crops. Needs daily watering unless it rains.
- **Sawah (wet paddy):** rice only (and *mina padi* later). Must be **flooded**: water level 0–3, fed by irrigation channels. A paddy dries by 1 level per clear day. Rice needs level ≥ 2 during growth.
- **Kebun (orchard):** trees planted once, which produce each season from year 2 onward.

### 4.2 Tile states
`untilled → tilled → seeded(stage 0..n) → mature → harvested(→ regrow or untilled)`, plus `watered: boolean` and `withered` (3 consecutive dry days on tegalan, or the wrong season after pancaroba ends).

### 4.3 Crops (starting values; ★ = vertical slice)

| id | Name (ID) | Plot | Season | Grow days | Regrow | Seed Rp | Sell Rp | Notes |
|---|---|---|---|---|---|---|---|---|
| `padi` ★ | Padi | sawah | Hujan | 12 | — | 1.500 | 4.200 (gabah) | Can be milled into *beras* (+40%) |
| `cabai` ★ | Cabai rawit | tegalan | Kemarau | 8 | 3 | 800 | 700 ×3/harvest | Market price is volatile |
| `singkong` ★ | Singkong | tegalan | both | 10 | — | 500 | 1.600 | Drought tolerant (5 dry days to wither) |
| `jagung` | Jagung | tegalan | Kemarau | 9 | — | 700 | 1.900 | |
| `kacang_panjang` | Kacang panjang | tegalan | Hujan | 7 | 3 | 600 | 500 ×3 | |
| `kangkung` | Kangkung | sawah | Hujan | 4 | 2 | 300 | 450 | Fast early money |
| `terong` | Terong | tegalan | Kemarau | 8 | 4 | 700 | 650 ×2 | |
| `tomat` | Tomat | tegalan | Kemarau | 9 | 3 | 800 | 600 ×3 | |
| `ubi` | Ubi jalar | tegalan | Hujan | 8 | — | 600 | 1.500 | |
| `bawang_merah` | Bawang merah | tegalan | Kemarau | 10 | — | 1.200 | 3.400 | |
| `kopi` | Kopi | kebun | both | 28 (tree) | 7 | 8.000 | 2.500 | Roast at home: +100% |
| `cengkeh` | Cengkeh | kebun | Kemarau | 28 (tree) | 14 | 10.000 | 6.000 | |
| `durian` | Durian | kebun | Hujan | 56 (tree) | 14 | 25.000 | 22.000 | Prestige crop |

Balancing rule: **gold per day per tile** should rise gently with crop cost and effort. Keep a `bun run balance` script that prints this table from the data (M3).

### 4.4 Irrigation & subak (P1)
- The village has a canal network with **gates** (*pintu air*). The main dam starts broken; repairing it (materials + a *gotong royong* event) unlocks sawah on the farm.
- **Water schedule:** in Musim Kemarau, water is scarce. Each week the *kelian subak* (irrigation head NPC) holds a meeting (Senin evening) that sets which *pasaran* days each farm gets water. Reputation and contributions (helping repair canals) improve your slots.
- Taking water out of turn is possible (open a gate at night). It raises your paddy level but lowers reputation with every farmer NPC. A soft moral system, never a hard fail.

## 5. Animals

| Animal | Building | Product | Price Rp | Notes |
|---|---|---|---|---|
| Ayam kampung ★ | Kandang ayam | Telur (egg) | 1.200 | Affection → chance of a "telur bagus" (+50%) |
| Bebek | Kandang bebek | Telur bebek | 1.800 | Can be herded to paddies to eat pests (P2) |
| Kambing | Kandang | Susu kambing | 4.000 | |
| Sapi | Kandang besar | Susu | 3.500 | |
| Kerbau | Kandang besar | — | — | Plows a 3×3 sawah area per use; a festival participant |

Daily care: feed (hay/*dedak*), pet (affection +), let out on clear days. Neglect lowers affection. Animals never die from neglect (cozy game); they get sad and stop producing.

## 6. Economy

- Currency is **Rupiah**, with values scaled roughly 1:10 below real prices for readability.
- **Shipping box:** pays 100% of base price overnight.
- **Pasar (market) on its pasaran day** (default: *Legi* and *Kliwon*): 110–140% of base price, with per-item daily variance ±15%, seeded. Market prices are visible only at the market (or via a radio broadcast P2).
- **Tengkulak:** buys any day at 70% of base price and pays instantly. A story arc lets the player help farmers form a cooperative (*koperasi*) that unlocks a fair-price channel.
- **Money sinks:** seeds, tool upgrades, buildings, house upgrades, festival entry fees, gifts, dam repair donation.

## 7. Player stats

- **Stamina** (*tenaga*): 100 base, +10 per heart event with specific NPCs, max 160. Tool use costs 2–6 by tool level. At 0 the player faints and wakes next day with -10% money (max Rp 5.000).
- **Food restores stamina.** Local dishes (*nasi goreng*, *pecel*, *gado-gado*, *es dawet*) are cooked in the kitchen after the house upgrade (P1).

## 8. NPCs (initial cast)

Diverse regional and religious backgrounds, shown respectfully (see CULTURE_GUIDE).

| id | Name | Role | Background | Marriageable | Slice |
|---|---|---|---|---|---|
| `pak_harjo` | Pak Harjo | Village head (*kepala desa*) | Javanese, elder, wise but stubborn | no | ★ |
| `bu_ratna` | Bu Ratna | Seed shop owner (*toko tani*) | Sundanese, cheerful, gossip | no | ★ |
| `wayan` | Wayan | Irrigation head (*kelian subak*) | Balinese, calm, deeply knows water | no | |
| `sari` | Sari | Warung owner's daughter, cook | Javanese, ambitious, wants a café | yes | |
| `andi` | Andi | Fisherman | Bugis, adventurous, sails | yes | |
| `nadia` | Nadia | Village doctor (*bidan*/*dokter*) | Minang, returned from Jakarta, pragmatic | yes | |
| `rizky` | Rizky | Blacksmith's apprentice | Betawi, joker, secretly writes poems | yes | |
| `koh_hendra` | Koh Hendra | General store owner | Chinese-Indonesian, generous, history buff | no | |
| `mbah_sri` | Mbah Sri | Herbalist (*jamu*) | Javanese, keeper of folklore | no | |
| `pak_bondan` | Pak Bondan | *Tengkulak* | Outsider trader, redeemable | no | |

**Schedule format** (data): per NPC, a list of `{ days?, weather?, season?, entries: [{ time, area, x, z, anim }] }`, first match wins. See `packages/content/data/npcs/*.json5`.

**Friendship:** 0–1000 points (10 hearts). Talk once a day +20, liked gift +80, loved +150, disliked −40. Birthday gifts ×3. Decays −2 per day if not talked to for 7+ days.

## 9. Festivals

| Day | Festival | Mechanic |
|---|---|---|
| Hujan 27 | **Sedekah Bumi** (harvest thanksgiving) | Contribute a harvest to the shared *tumpeng* feast; gain village reputation. Respectful, non-denominational framing |
| Kemarau 10 | **Tujuhbelasan** (Independence Day, 17 Aug analog) | Minigames: *balap karung*, *makan kerupuk*, *panjat pinang* (P1 order of implementation) |
| Kemarau 20 | **Lomba Layang-layang** (kite festival) | Kite-flying rhythm minigame (P2) |
| Hujan 14 | **Pasar Malam** (night market) | Food stalls, ferris wheel date event, shooting-gallery minigame |

Religious holidays are **not** turned into gameplay mechanics. NPCs may mention them in dialog (e.g. going *mudik*), with care (CULTURE_GUIDE §3).

## 10. World map (areas)

| Area | Content | Slice |
|---|---|---|
| `farm` | House, fields (tegalan 12×10 tiles), sawah terraces (unlocked after the dam), coop, shipping box | ★ (small) |
| `village` | Kepala desa's *joglo* house, warung, toko tani, *balai desa* (hall), mosque, church, and temple in the distance | ★ (2 buildings) |
| `market` | Pasar area, used on pasaran days and festivals | |
| `hills` | Terraces, dam, *subak* temple shrine, waterfall | |
| `beach` | Fishing, Andi's boat, coconut trees | |
| `forest` | Foraging (*jamur*, *rebung*), bamboo, secret spots | |

Tile size is **1 world unit = 1 farm tile**. Areas are separate scenes with loading edges (fade transition ≤ 1 s).

## 11. Controls

| Action | Touch | Keyboard | Gamepad |
|---|---|---|---|
| Move | Virtual joystick (left half) | WASD / arrows | Left stick |
| Use tool / interact | Context button (right) | Space / E / click | A |
| Switch tool | Tool bar tap | 1–9, scroll | LB/RB |
| Menu / inventory | Menu button | Esc / I | Start |
| Rotate camera 90° | Two-finger swipe / buttons | Q / R | Right stick flick |

Auto-target: the interaction target is the tile or object in front of the player, highlighted. This keeps touch play forgiving.

## 12. Vertical slice (M2) — exact content
- Areas: `farm` (small) and `village` (2 buildings).
- Crops: `padi` (sawah pre-flooded, no subak yet), `cabai`, `singkong`.
- Animals: 1 chicken.
- NPCs: Pak Harjo, Bu Ratna, with schedules and 3 dialog scripts each.
- Systems: clock, 1 season (Hujan), weather (clear/rain), shipping box, seed shop, save/load, EN/ID.
- **Done when:** a tester plays 7 in-game days on a reference phone without guidance and earns ≥ Rp 50.000.
