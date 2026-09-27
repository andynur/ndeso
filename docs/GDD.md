# GDD — Game Design Document

> **Source of truth for gameplay numbers.** When code and this doc disagree, raise it. Do not silently change either.
> Tunable values live in `packages/content/data/**`. This doc gives the **intent and starting values**.
> Setting and locations: [PLACES](PLACES.md). Cultural rules: [CULTURE_GUIDE](CULTURE_GUIDE.md).

## 1. Core loop

```
Bangun subuh → lihat mangsa/cuaca/pasaran → garap kebun (siram, panen, ternak)
  → waktu luang: ke pasar / ngobrol / jalan-jalan / cari bahan
  → sore–maghrib: bangun kawasan, festival, ngobrol → tidur (autosave)
  → semalam: tanaman tumbuh, setoran dibayar
```

- **Session target:** one in-game day is about 12–15 real minutes at default speed, and it is safe to stop at any time (autosave on tab hide).
- **The player's time is free.** There is no enforced schedule and no fail state. Stamina is the only limiter.

### 1.1 Two scales — this is the game's shape

The player's job is *petani*. The player's project is a *kawasan*. Those are
different scales, and the distinction is the whole design:

| Scale | What you do | Measured by |
|---|---|---|
| **Petak** (tile) | hoe, plant, water, harvest, sell | money, stamina |
| **Kawasan** (area) | plant trees, restore the water channel, lay paths, raise a joglo | **asri · nyaman · tenang** (§5) |

Farming is the *means*. The kawasan is the *goal*. In most farm sims the
prettiest farm and the most profitable farm are different things and only
profit is rewarded; here the reward is the place itself.

## 2. Setting

- **Place:** **Kelurahan Baledono, Purworejo, Jawa Tengah** — a real Javanese
  kelurahan, compressed and fictionalised where needed. See
  [PLACES](PLACES.md) for the area list and the naming policy.
- **Premise:** The player leaves Jakarta and comes back to Purworejo to take
  over a patch of ground from their grandfather, **Mbah Hita** — who is
  **still alive**, elderly, and no longer strong enough to work it. Mbah Hita
  has an unfinished ambition: to make the ground *asri, nyaman, tenang* — a
  place that calls to mind the garden described in scripture. That is why he
  named it **Balé Al Jannah**.
- **`jannah` means garden.** The Qur'anic picture of paradise is a concrete
  landscape: gardens with water flowing beneath them, shade, fruit, and peace.
  For a farming game that is not a metaphor, it is a design brief.
  ⚠️ **Frame it as a person's aspiration, never as a claim.** Mbah Hita hopes
  to build something that *reminds* people of that garden. The game never
  suggests a human can build paradise. See CULTURE_GUIDE §3.
- **The player does not start from zero — they continue someone's work.**
  Mbah Hita's plans are physically present on the land: a sketch of the water
  channel, a list of trees he never planted, a joglo whose posts are up but
  which has no roof. These are the quest system, and they never appear as a
  quest log.
- **Tone:** Warm, unhurried, affectionate about an ordinary town. Humour is
  gentle and observational. **No villain.**
- **Friction** comes from two directions, neither of them a boss:
  1. **Entropy.** Neglected ground goes back to scrub. The rainy season floods
     the channel. Young people leave the kampung for Jogja and Jakarta.
  2. **An offer.** Someone wants to buy the land for a ruko or a housing plot.
     He is polite, his offer is reasonable, and it goes up every year. Some
     neighbours have already sold. Refusing is the player's statement, not a
     rule the game enforces. This is what is actually happening to peri-urban
     Java; play it straight, never as caricature.
- **Ending (Act 3):** Mbah Hita moves back. Not a cutscene — a state of the
  world: the water runs, the joglo has a roof, there is shade over the paths
  and somewhere to sit. The game opens with the player coming home and closes
  with Mbah Hita coming home.
  **Mbah Hita does not die in the game**, in any version. This is a cozy game
  and that promise is not negotiable. Changing it requires a new ADR.

## 3. Time & calendar

Three real calendars run at once, all derived from a single integer `day`
counter. See **[ADR-0007](adr/0007-three-calendars.md)** for the decision and
its constraints.

| Unit | Value |
|---|---|
| Day | 05:00 → 01:00. Default 1 game-minute = 0.7 real s, so a day is ~14 real min |
| Week | 7 days (Senin–Minggu) plus the 5-day *pasaran* cycle (Legi, Pahing, Pon, Wage, Kliwon) |
| Year | **120 days**, divided into the **12 mangsa** of the pranata mangsa |
| Musim | Derived label over groups of mangsa: *hujan* 54 d, *kemarau* 50 d, *pancaroba* 16 d |
| Hijriah | Tabular (arithmetic) Islamic calendar, lunar year 116 days → **drifts 4 days per game year** |

### 3.1 Pranata mangsa

Lengths live in `packages/content/data/calendar/mangsa.json5` and must sum to
120. The real proportions are preserved, so Kasa and Kanem are the long mangsa
and Karo and Dhesta the short ones.

The **pertanda** column below is design intent, recorded here because this
document may hold prose and the data file may not. Each becomes
`calendar:mangsa.<id>.sign` in **both** locales in the task that first surfaces
it (M1-01) — see `.claude/rules/content-i18n.md` and AGENTS rule 3.

| # | Mangsa | Game days | Musim | Pertanda |
|---|---|---|---|---|
| 1 | Kasa | 13 | kemarau | daun berguguran, tanah retak |
| 2 | Karo | 8 | kemarau | puncak kemarau, tanah paling kering |
| 3 | Katelu | 8 | kemarau | umbi tumbuh, rebung muncul |
| 4 | Kapat | 8 | pancaroba | burung mulai bersarang |
| 5 | Kalima | 9 | hujan | hujan pertama |
| 6 | Kanem | 14 | hujan | hujan menguat, musim buah |
| 7 | Kapitu | 14 | hujan | hujan terberat, kali meluap |
| 8 | Kawolu | 9 | hujan | padi menghijau, hama banyak |
| 9 | Kasanga | 8 | hujan | padi berbuah, jangkrik bersuara |
| 10 | Kasadasa | 8 | pancaroba | hujan mereda, panen |
| 11 | Dhesta | 8 | kemarau | udara panas dan kering |
| 12 | Sadha | 13 | kemarau | air menyusut, angin kering |

Crops stay tagged coarsely by `musim`, not by mangsa, so the crop table in §4.3
needs no rebalancing: *musim hujan* is 54 days, comfortably longer than the
28-day season the numbers were first tuned for.

`musim` on a crop is one of `hujan` · `kemarau` · `pancaroba` · **`semua`**
(grows in all twelve mangsa). The old `both` tag is gone: with pancaroba now a
first-class musim rather than a sub-phase, "both" no longer says whether the
16 pancaroba days are included.

### 3.2 The clock reads in prayer times

The HUD shows both the clock and the prayer-time band it falls in, because that
is how people there actually tell the time:

```
  15:40 · Ashar          Mangsa Kapat · hari 3/8 · Kliwon
```

Prayer times come from a **fixed table that varies only by mangsa**, not from a latitude
and a date. Computing them is astronomy, and it would cost `packages/sim` its purity and
determinism to buy precision the game never uses — the same reasoning ADR-0007 applied to
the Hijri calendar. The clock lands in M1-01; the HUD that shows it, in M1-08.

⚠️ **This is a time display and nothing else.** Prayer times never gate an
action, never score anything, and are never required. The player character is
Muslim and Javanese as *characterisation*; the game does not check whether they
pray. See CULTURE_GUIDE §3.

### 3.3 Weather (per day, seeded from save seed + day index)

| Musim | Clear | Cloudy | Rain | Storm |
|---|---|---|---|---|
| Kemarau | 65% | 25% | 10% | 0% |
| Pancaroba | 35% | 30% | 30% | 5% |
| Hujan | 20% | 25% | 45% | 10% |
| Hujan, mangsa **Kapitu** | 10% | 20% | 50% | 20% |

Kapitu is the heaviest rain of the year: storms, an overflowing *kalen*, debris
on the ground the next morning, and a chance of crop damage.

## 4. Farming

### 4.1 Plot types
- **Tegalan (dry field):** most crops. Needs daily watering unless it rains.
- **Sawah (wet paddy):** rice only (and *mina padi* later). Must be **flooded**: water level 0–3, fed by the channel. A paddy dries by 1 level per clear day. Rice needs level ≥ 2 during growth.
- **Kebun (orchard):** trees planted once, which produce each year from year 2 onward. Trees also count toward **asri** (§5).

### 4.2 Tile states
`untilled → tilled → seeded(stage 0..n) → mature → harvested(→ regrow or untilled)`, plus `watered: boolean` and `withered` (3 consecutive dry days on tegalan, or the wrong musim).

### 4.3 Crops (starting values; ★ = vertical slice)

| id | Name (ID) | Plot | Musim | Grow days | Regrow | Seed Rp | Sell Rp | Notes |
|---|---|---|---|---|---|---|---|---|
| `padi` ★ | Padi | sawah | Hujan | 12 | — | 1.500 | 4.200 (gabah) | Can be milled into *beras* (+40%) |
| `cabai` ★ | Cabai rawit | tegalan | Kemarau | 8 | 3 | 800 | 700 ×3/harvest | Market price is volatile |
| `singkong` ★ | Singkong | tegalan | semua | 10 | — | 500 | 1.600 | Drought tolerant (5 dry days to wither) |
| `jagung` | Jagung | tegalan | Kemarau | 9 | — | 700 | 1.900 | |
| `kacang_panjang` | Kacang panjang | tegalan | Hujan | 7 | 3 | 600 | 500 ×3 | |
| `kangkung` | Kangkung | sawah | Hujan | 4 | 2 | 300 | 450 | Fast early money |
| `terong` | Terong | tegalan | Kemarau | 8 | 4 | 700 | 650 ×2 | |
| `tomat` | Tomat | tegalan | Kemarau | 9 | 3 | 800 | 600 ×3 | |
| `ubi` | Ubi jalar | tegalan | Hujan | 8 | — | 600 | 1.500 | |
| `bawang_merah` | Bawang merah | tegalan | Kemarau | 10 | — | 1.200 | 3.400 | |
| `kopi` | Kopi | kebun | semua | 28 (tree) | 7 | 8.000 | 2.500 | Roast at home: +100% |
| `cengkeh` | Cengkeh | kebun | Kemarau | 28 (tree) | 14 | 10.000 | 6.000 | |
| `durian` | Durian | kebun | Hujan | 56 (tree) | 14 | 25.000 | 22.000 | Prestige crop; festival entry (§10) |

Balancing rule: **gold per day per tile** should rise gently with crop cost and effort. Keep a `bun run balance` script that prints this table from the data (M3).

### 4.4 Water — the kalen (P1)

**This is the spine of the game, not a side system.** The Qur'anic garden is
one with water running through it, and Mbah Hita's channel is dead.

- The **kalen** (irrigation channel) crosses the ground and stops halfway.
  Restoring it, segment by segment, is the long-term build project: it unlocks
  sawah, removes the walk to the well, and feeds the ponds and planting that
  raise **asri**.
- Water is shared with the neighbours. The **ulu-ulu** — the village official
  responsible for irrigation, a real role in Javanese village administration —
  sets which days each plot gets water. Helping maintain the channels improves
  your slots.
- Taking water out of turn is possible (open a gate at night). It raises your
  paddy level and lowers standing with every farming NPC. A soft social system,
  never a hard fail.

> Earlier drafts used Balinese *subak* here. That was wrong for Purworejo.
> Javanese village irrigation is organised around the **ulu-ulu**. Subak stays
> in the glossary as a distinct Balinese institution, not as our model.

## 5. Kawasan — asri, nyaman, tenang

The three qualities Mbah Hita named are the game's real scoreboard. They are
**computed from the ground itself**, per area, not accumulated in a counter —
so the player cannot game a number, they have to actually make the place good.

| Quality | Computed from | Shows up as |
|---|---|---|
| **Asri** (lush) | tree canopy coverage, length of flowing kalen, water surface, flowering and ornamental planting, share of ground that is not bare | birds return, ambient audio thickens, the colour grade warms |
| **Nyaman** (comfortable) | shade over walkable paths, a place to sit within reach of anywhere, path connectivity, absence of mud and clutter | people linger instead of passing through |
| **Tenang** (peaceful) | distance from the road, noise sources, presence of running water, clutter density | NPCs come by unprompted; Mbah Hita stays longer |

Design rules:

1. **No quality is ever a currency.** They unlock nothing that can be bought.
2. **They are spatial.** Two trees in the right place beat ten in a row.
3. **They decay.** Ground left alone reverts; that is the entropy in §2.
4. **Mbah Hita is the readout.** Before any UI meter exists, he is the one who
   tells the player how the place is doing, in his own words.

### 5.1 Building the kawasan (M3)

A **closed, authored list of about ten structures — Mbah Hita's plan.** Not a
free-form editor and not a city builder; that is a different genre and it is
how this project would die.

Order of unlock, roughly: kalen segments → gudang → joglo → jalan setapak →
kolam → pendopo → musholla → and the rest by story.

⚠️ **Every public building is a content multiplier, not an asset.** A school
needs pupils, a teacher, a timetable, a reason to go in. An empty building is
worse than no building. Nothing on this list ships until it has people in it.
The larger structures need a **permit** from the kelurahan (PLACES §3, ring 3).

## 6. Animals

| Animal | Building | Product | Price Rp | Notes |
|---|---|---|---|---|
| Ayam kampung ★ | Kandang ayam | Telur | 1.200 | Affection → chance of a *telur bagus* (+50%) |
| Kambing Etawa | Kandang | Susu kambing | 4.000 | The Kaligesing breed; the regional signature animal. Milk → kefir, soap (artisan chain) |
| Bebek | Kandang bebek | Telur bebek | 1.800 | Can be herded to paddies to eat pests (P2) |
| Sapi | Kandang besar | Susu | 3.500 | |
| Kerbau | Kandang besar | — | — | Plows a 3×3 sawah area per use |

Daily care: feed (*dedak*), pet (affection +), let out on clear days. Neglect lowers affection. **Animals never die from neglect** (cozy game); they get sad and stop producing.

## 7. Economy

- Currency is **Rupiah**, with values scaled roughly 1:10 below real prices for readability.
- **Setoran (shipping box):** pays 100% of base price overnight.
- **Pasar Baledono:** cheaper to buy from, buys your harvest, haggling works,
  best on its *pasaran* day (default *Legi* and *Kliwon*: 110–140% of base,
  ±15% per-item daily variance, seeded). **Shuts by late morning.**
- **Swalayan (fictionalised name):** fixed prices, higher, open 08:30–20:30,
  does not buy produce. Convenient and never punished for being used.
- The pasar/swalayan choice is a **time-and-relationship** trade, not a moral
  one. There is no evil corporation. See PLACES §3.
- **Tengkulak:** buys any day at 70% of base and pays instantly. A story arc
  lets the player help farmers form a *koperasi* for a fair-price channel.
- **Money sinks:** seeds, tool upgrades at the *pandai besi*, kawasan
  structures, permits, festival contributions, gifts.

## 8. Player stats

- **Stamina** (*tenaga*): 100 base, +10 per heart event with specific NPCs, max 160. Tool use costs 2–6 by tool level. At 0 the player faints and wakes next day with −10% money (max Rp 5.000).
- **Food restores stamina.** Local dishes (*nasi goreng*, *pecel*, *kupat tahu*, *dawet ireng*) are cooked at home after the house upgrade (P1).
- The public **kolam** (PLACES ring 3) restores stamina for a small fee; cheaper on weekdays, crowded and pricier on Sunday.

## 9. NPCs (initial cast)

The cast is predominantly **Javanese**, because Baledono is. That is not a
narrowing: a Javanese market town has its own diversity, and the
Chinese-Indonesian trading presence around a pasar is part of the real fabric,
not a token. See CULTURE_GUIDE §4.

| id | Name | Role | Notes | Slice |
|---|---|---|---|---|
| `mbah_hita` | **Mbah Hita** | The grandfather | Sepuh, lives with a relative in the kampung. The anchor of the whole game — **budget him three NPCs' worth of writing**. Speaks ngoko to the player; the player answers in krama | ★ |
| `pak_harjo` | Pak Harjo | Ketua RT | Elder, wise, stubborn; the route to permits and gotong royong | ★ |
| `bu_ratna` | Bu Ratna | Bakul sayur at Pasar Baledono | Cheerful, knows everything about everyone, sets your seed prices by how well she knows you | ★ |
| `pak_slamet` | Pak Slamet | **Ulu-ulu** (irrigation) | Quiet, exact, keeps the water schedule in his head | |
| `mbah_sri` | Mbah Sri | Jamu seller, keeper of stories | Folklore, remedies, the old names for things | |
| `koh_hendra` | Koh Hendra | Shop by the market | Chinese-Indonesian, generous, local-history buff, community figure. **Never "just the shopkeeper"** | |
| `pak_bejo` | Pak Bejo | *Pandai besi* | Tool upgrades; slow, precise, proud of his work | |
| `pak_darma` | Pak Darma | Land agent | Wants to buy the ground. Polite, reasonable, persistent. **Not a villain** | |

**Schedule format** (data): per NPC, a list of `{ days?, weather?, musim?, entries: [{ time, area, x, z, anim }] }`, first match wins. See `packages/content/data/npcs/*.json5`.

**Friendship:** 0–1000 points (10 hearts). Talk once a day +20, liked gift +80, loved +150, disliked −40. Birthday (and *weton*) gifts ×3. Decays −2 per day if not talked to for 7+ days.

Marriage candidates are **M4**, not v1. Do not add them to the slice cast.

## 10. Festivals

| When | Festival | Mechanic |
|---|---|---|
| Kasadasa (after harvest) | **Sedekah Bumi** ★ | Village thanksgiving for the harvest. Contribute to the shared *tumpeng*. **The flagship festival** — it grows directly out of the core loop, and it happens at the balé the player built |
| Hijri: Ramadan (10 game days; 30 in life) | **Ramadan** | **The world changes, not the player.** Pasar opens ~03:00 for sahur; midday is empty and hot; takjil stalls appear before maghrib; ngabuburit crowds; tarawih at the musholla. A whole month of a different town |
| Hijri: 1 Syawal | **Lebaran** | **Mudik** — the kampung empties, then fills. NPCs who left come home. Sungkeman, ketupat, halal bihalal. After a year of building relationships, this is the payoff |
| Kanem (durian season) | **Festival Durian** | Grow one over years, enter your best fruit. Comedy and competition |
| Kemarau | **Dolalak** | Purworejo's own dance. Visual set piece; a rhythm minigame is P2 |
| Kemarau | **Tujuhbelasan** | *Balap karung*, *makan kerupuk*, *panjat pinang*. Apolitical (CULTURE_GUIDE §6) |

⚠️ **Ramadan and Lebaran are world-state, never scored.** The game must not
model the player's fasting, must not reward or penalise observance, and must
not turn worship into a minigame. It changes opening hours, crowds, light and
sound — nothing else. See CULTURE_GUIDE §3.

## 11. World map (areas)

Full list, mechanics and the naming policy: **[PLACES](PLACES.md)**.

Tile size is **1 world unit = 1 farm tile**. Areas are separate scenes with loading edges (fade transition ≤ 1 s). The map is **compressed by feel, not surveyed** — see PLACES §2.

## 12. Controls

| Action | Touch | Keyboard | Gamepad |
|---|---|---|---|
| Move | Virtual joystick (left half) | WASD / arrows | Left stick |
| Use tool / interact | Context button (right) | Space / E / click | A |
| Switch tool | Tool bar tap | 1–9, scroll | LB/RB |
| Menu / inventory | Menu button | Esc / I | Start |
| Rotate camera 90° | Two-finger swipe / buttons | Q / R | Right stick flick |

Auto-target: the interaction target is the tile or object in front of the player, highlighted. This keeps touch play forgiving.

## 13. Vertical slice (M2) — exact content

- **Areas:** `bale` (small) and `pasar`. `kampung` as a façade with 2 buildings.
- **Crops:** `padi` (sawah pre-flooded, no water schedule yet), `cabai`, `singkong`.
- **Animals:** 1 chicken.
- **NPCs:** Mbah Hita, Pak Harjo, Bu Ratna — schedules and 3 dialog scripts each.
- **Systems:** the three calendars, weather, stamina, setoran, the pasar with
  its pasaran day, save/load, EN/ID.
- **Kawasan:** **asri only**, read out by Mbah Hita in dialog. No UI meter, no
  building system yet — those are M3.
- **Done when:** a tester plays 7 in-game days on a reference phone without
  guidance, earns ≥ Rp 50.000, and can say what Mbah Hita wants.

## 14. First ten minutes

If this is good, the game is good. It is the acceptance test for the whole concept.

1. **The southern line.** A train window, sawah going past. The title appears here.
2. **Stasiun Kutoarjo.** Ojek to Baledono. The main road, midday, hot.
3. **The gate.** Grass to the knee. A wide field. A joglo with no roof. **A dry kalen** cutting across the ground.
4. Under a stone in the saung: **Mbah Hita's note.** One sketch, one sentence.
5. Clear one patch. Plant one seed. Fetch water from the well — because the channel is dead. It is far, and it is tiring. *That is the problem the whole game is about.*
6. **Maghrib.** Adzan from the musholla next door. Orange sky. Sleep.

No tutorial pop-ups. One problem introduced (water), one goal planted (the plan), one mood locked (maghrib in a kampung).
