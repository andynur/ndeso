# ADR-0007: Three overlapping calendars, all derived from one day counter
- Status: Accepted
- Date: 2026-09-27

## Context

Balé is set in Baledono, Purworejo — a real Javanese kelurahan. Daily life
there runs on three calendars at once, and all three drive gameplay:

| Calendar | Kind | Drives |
|---|---|---|
| **Pranata mangsa** — 12 *mangsa* of unequal length | solar | planting, weather, pests |
| **Pasaran** — Legi, Pahing, Pon, Wage, Kliwon | 5-day cycle | which day the pasar is busy |
| **Hijriah** | lunar, ~354 days | Ramadan, Lebaran, Idul Adha |

The first draft of the GDD used four Harvest-Moon seasons, then two
(*hujan* / *kemarau*). Neither is how a Javanese farmer reads the year, and
neither can express Ramadan, which moves ~11 days earlier against the solar
year and therefore drifts through the growing season over a multi-year save.

The sim must stay deterministic and pure (ADR-0003), so every calendar has to
be a pure function of the day counter — no host date, no timezone, no
astronomy library.

## Decision

**One authoritative counter: `day`, an integer, day 0 = the arrival.**
Everything else is a pure projection of it.

1. **Solar year = 120 days**, divided into the 12 real mangsa with their real
   *proportions* preserved (Kasa and Kanem stay the long ones; Karo and Dhesta
   stay the short ones). Lengths live in
   `packages/content/data/calendar/mangsa.json5`, not in code.
2. **Pasaran** = `day % 5`. 120 is divisible by 5, so the pasaran grid is
   stable against the year.
3. **Hijriah** = the standard **tabular** (arithmetic) Islamic calendar — the
   30-year cycle with 11 leap years — scaled to the same 120-day year, giving
   a lunar year of 116 days and a drift of 4 days per year.
   **No astronomical hisab, and no rukyat.**
4. **`musim`** (*hujan* / *kemarau* / *pancaroba*) is a derived label over
   groups of mangsa, kept so that crop data can stay tagged coarsely.

## Consequences

**Good**
- Ramadan and Lebaran drift against the seasons exactly as they do in life,
  so a long save gets real variety for free — no extra content.
- 12 mangsa give twelve flavours of weather and planting where four seasons
  gave four, and the flavour is drawn from a real farming calendar rather than
  invented.
- Every calendar is a pure function of one integer, so a golden test can
  snapshot three whole years cheaply, and saves only need to store `day`.
- Correcting a mangsa length later is a data edit, not a code change.

**Bad / accepted costs**
- Unequal mangsa are harder for a player to predict than uniform 28-day
  seasons. Mitigation: the HUD always shows `Mangsa Kapat · hari 3/8`.
- A tabular Hijri date can differ by ±1 day from the date Indonesia actually
  announces. Accepted: Indonesian Lebaran itself is often announced a day
  apart between organisations, so ±1 is inside the real-world spread.
- The full 30-year lunar drift cycle is longer than anyone will play.
  That is fine; the visible effect is the 4-days-per-year walk.

**Follow-ups**
- M1-01 implements the counter and all three projections.
- The mangsa length table is transcribed from secondary sources and is marked
  `verified: false` in the data file until a Javanese-calendar reference is
  checked. It is data, so correcting it cannot break the build.

## Alternatives considered

- **Four seasons × 28 days (Stardew/Harvest Moon).** Rejected: not how Java
  works, and it cannot host a lunar festival at all.
- **Two seasons, hujan and kemarau.** Accurate but coarse — it gives the year
  two flavours, and the farming loop needs more texture than that.
- **Real 365-day pranata mangsa.** Authentic but far too long for a game year;
  a single mangsa would outlast most play sessions' patience.
- **Astronomical Hijri (moon-phase computation).** Rejected: it drags in
  floating-point astronomy and a location, breaking sim purity and
  determinism, to buy an accuracy the game cannot use.
- **Hardcoding festival days to fixed day-of-year numbers.** Simplest, but it
  throws away the drift, which is the single most distinctive thing the
  calendar offers.
