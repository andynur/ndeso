# PLACES — the world of Balé

> Balé is set in a real place: **Kelurahan Baledono, Kecamatan Purworejo,
> Kabupaten Purworejo, Jawa Tengah**. This document is the source of truth for
> which locations exist, what each one is *for* mechanically, and how we are
> allowed to use their real names.
>
> Read with [GDD §11](GDD.md) (areas) and [CULTURE_GUIDE](CULTURE_GUIDE.md).

## 1. Naming policy — read this first

Using a real town is what gives Balé its authenticity. It also means we can
cause real harm by being careless. Three tiers:

| Tier | Examples | Rule |
|---|---|---|
| **Public geography** | Baledono, Purworejo, Pasar Baledono, Geger Menjangan, Kaligesing, Jalan Purworejo–Salaman, Kali Bogowonto | **Use the real name.** Public places and government facilities. This is the layer that makes the game feel true. |
| **Private business** | the four-storey supermarket by the main road, the fried-chicken place, the phone-credit counters, the tyre shop | **Fictionalise.** A real business has a real owner and a real brand. Invent a name in the same register. |
| **The starting location** | **Balé** — Mbah Hita's own ground | **Fictional, by owner decision (2026-09-28).** There is a real venue in Krajan, Baledono called *Balle Al Jannah* — an event venue with a mini zoo, kiosks and aqiqah services, and Masjid Ar Royyan inside it ([round 00](culture-review/round-00-desk-2026-09-28.md)). The game does not use its name and does not model it: the balé is just what Mbah Hita's ground is called. Either get the owners' blessing to use the name, or make the in-game one Mbah Hita's own place with a name of its own. Tracked in [PRD §12](PRD.md). |

Further rules:

- **Never** copy data, imagery, or map geometry from Google Maps or any other
  mapping service into the repo. Reference photos must be taken by a
  contributor or be clearly licensed ([LICENSE-ASSETS](../LICENSE-ASSETS.md)).
- **No real living person becomes an NPC.** Characters may be inspired by the
  kinds of people who live there. They are never portraits of individuals.
- Every area data file carries `origin: "Baledono, Purworejo, Jawa Tengah"` so
  the culture review (CULTURE_GUIDE §7) can find it.

**How strict to be (owner decision 2026-09-28):** real names and geography follow the
tiers above; everyday culture — houses, food, speech, the market's rhythm — may draw on
**Central Javanese culture in general** and needs no Baledono-specific check
(CULTURE_GUIDE §1.1).

## 2. The map is compressed, not surveyed

Baledono at 1:1 scale would be mostly asphalt and shopfronts, and dull to walk.
**The layout is arranged by feel, not by coordinates.** Distances are shortened,
the interesting things are pulled closer together, and a five-kilometre trip to
the hill becomes a short walk.

This is a deliberate decision, not an accuracy failure. Do not "fix" the map to
match the real street grid.

```
                    [ Geger Menjangan ]              ring 3
                             |
                             |
  [ Kolam Umum ] ——— [      BALÉ      ] ——— [ Kampung + Masjid ]   ring 0/1
      ring 3                 |                       |
                             |                       |
                       [ Jalan Raya ] ——————————————-+            ring 2
                             |
                     [ Pasar Baledono ]                            ring 2
                             |
                     ( keluar kota → )                             ring 4
                   Kutoarjo · Kaligesing · pantai
```

## 3. Areas

`Slice` marks what the M2 vertical slice must contain.

### Ring 0 — the base

| Area | id | Content | Mechanic | Slice |
|---|---|---|---|---|
| **Balé** | `bale` | Mbah Hita's ground: overgrown field, a half-built joglo, the **dead water channel** (*kalen*), a well, the house | The farm, and the thing the player rebuilds. All *asri / nyaman / tenang* is measured here | ★ |

The base is **communal, not isolated**. It is not a lonely farmhouse at the end
of a dirt road — it is a pavilion attached to a neighbourhood, and people walk
through it. That is the single biggest departure from the genre's usual staging
and it should be legible from the first frame.

### Ring 1 — the kampung (walking distance)

| Area | id | Content | Mechanic | Slice |
|---|---|---|---|---|
| **Kampung Baledono** | `kampung` | Neighbours' houses, a **musholla**, a warung, the lane | NPC homes, daily social loop, the adzan that marks time | ★ (2 buildings) |

### Ring 2 — the road and the market

| Area | id | Content | Mechanic | Slice |
|---|---|---|---|---|
| **Jalan Raya** | `jalan` | The through road: a supermarket (fictionalised), warung, bengkel, phone counters | Modern retail — **fixed prices, long opening hours, no haggling** | |
| **Pasar Baledono** | `pasar` | Vegetable market, *pandai besi* (blacksmith), bakul stalls | The main economy. Cheaper, haggling works, **busiest on its pasaran day** (which day: unverified). The building is open about 04:30–17:00; fresh produce peaks at dawn and is thin by late morning ([round 00](culture-review/round-00-desk-2026-09-28.md)) | ★ |

**Pasar vs. supermarket is the signature economic choice.** It is not a moral
one — there is no evil corporation. It is a trade of *time and relationship*
against *convenience*:

| | Pasar Baledono | Supermarket |
|---|---|---|
| Price | cheaper, negotiable | fixed, higher |
| Hours | produce at dawn; kiosks until the afternoon | all day into the evening |
| Day | best on its pasaran day | the same every day |
| Stock | varies with the mangsa | always there |
| Needs | knowing the sellers, waking early | only money |
| Buys your harvest | yes, price fluctuates | no |

Real note: Pasar Baledono is the largest economic centre in Kabupaten Purworejo
and dates to roughly the 1850s. It was rebuilt after a fire and holds an SNI Pasar Rakyat
certificate. Just east of it stands the **Klenteng Thong Hwie Kiong** ("Klenteng
Baledono", 1888, cagar budaya) — the real anchor of the town's Chinese-Indonesian
trading history. A landmark, visible and non-interactive like every place of worship
([round 00](culture-review/round-00-desk-2026-09-28.md)).

### Ring 3 — Purworejo town

| Area | id | Content | Mechanic |
|---|---|---|---|
| **Geger Menjangan** | `bukit` | City park at the foot (Trirejo, Loano, ~5 km out), a climb to a ~175 m summit in the Menoreh range with a lookout tower. **The makam of Kyai Imam Puro is on the hill** — a pilgrimage site: no foraging near it, no interaction beyond a quiet description ([round 00](culture-review/round-00-desk-2026-09-28.md)) | Foraging, bamboo and timber, the one **viewpoint over the whole map**. Entry costs almost nothing, which is true and which players will enjoy |
| **Kolam Umum** | `kolam` | Public swimming pool, canteens | Stamina and mood recovery. Cheap on weekdays, pricier and crowded on Sunday |
| **Alun-alun & Masjid Agung** | `alunalun` | Town square, the great mosque and its **bedug** | Festivals, the town's time signal |
| **Kantor kelurahan / kabupaten** | `kantor` | Government offices | **Perizinan** — building the bigger structures needs a permit: photocopies, stamps, "besok saja, Pak". Warm and funny, **never cynical about real institutions** (CULTURE_GUIDE §6) |

### Ring 4 — out of town

| Area | id | Content | Mechanic |
|---|---|---|---|
| **Kaligesing** | `kaligesing` | Waterfall, **Etawa goat breeders**, hills, a cave | Livestock source, foraging, durian and manggis country. One area that pays for itself three times |
| **Kutoarjo** | `stasiun` | The railway station | Where the player arrived. The way out of the valley, and the reason characters leave |
| **Pantai selatan** | `pantai` | South-coast beach | Late-game, rarely visited |

## 4. Local material worth using

Verified against published sources; anything marked ⚠️ needs a local check.

- **Dolalak** — Purworejo's signature dance, descended from imitating Dutch
  colonial soldiers (the name from the solmisation *do–la*): colonial-style
  uniform, dark glasses, *sampur*, and a trance (*ndadi*) element. The strongest
  visual identity the regency has, and unused by any game. Festival material.
- **Bedug Pendowo** at the Masjid Agung — a very large bedug cut from a single
  trunk, 18th century. Candidate for the town's audible clock.
- **Kambing Etawa**, Kaligesing — the local goat breed, and the natural
  livestock line. Goat milk is a real regional product.
- **Food:** dawet ireng (Butuh), clorot, lanting, geblek, kupat tahu.
- **Geography:** Kali Bogowonto (Baledono's eastern boundary), the Menoreh hills, the south coast, the
  colonial town plan of alun-alun + masjid agung + pendopo.
- **Merti desa** — what Baledono calls its village thanksgiving, held with a
  wayang kulit night (17 January 2025). The GDD's flagship festival takes this name;
  it stays after the harvest, as many Central Javanese villages hold it ([round 00](culture-review/round-00-desk-2026-09-28.md)).
- **Klenteng Thong Hwie Kiong**, **Kali Bogowonto**, and the dawn market — see §3.

## 5. Reference photography is the bottleneck

The art direction ([DESIGN](DESIGN.md)) cannot be derived from the internet;
almost nothing of Baledono is online at usable quality. The highest-value task
in the project that no agent can do is **walking the area and photographing it**:

- Pasar Baledono at 06:00, when it is actually busy
- The main road after rain, and at night
- The climb up Geger Menjangan, and the view from the top
- A pendopo or joglo in a kampung garden, from several angles, at different times of day
- Ordinary things: warung fronts, kalen, pagar, paving, the lane between houses

## Sources

- [Baledono, Purworejo — Wikipedia (id)](https://id.wikipedia.org/wiki/Baledono,_Purworejo,_Purworejo)
- [Sejarah Pasar Baledono — Purworejo Tempoe Doloe](http://purworejotempoedoloe.blogspot.com/2010/01/sejarah-pasar-baledono.html)
- [Taman Geger Menjangan — Visit Jawa Tengah](https://visitjawatengah.jatengprov.go.id/id/regency/kabupaten-purworejo/destinasi-wisata/taman-geger-menjangan)
- [Geger Menjangan — NativeIndonesia](https://nativeindonesia.com/geger-menjangan/)
- [Kolam Renang Artha Tirta — Sisparnas Kemenparekraf](https://sisparnas.kemenparekraf.go.id/p/2709)
