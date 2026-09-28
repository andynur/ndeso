# ADR-0009: Masehi calendar first, with the Javanese and Hijri dates as a subtitle
- Status: Accepted
- Date: 2026-09-28
- Supersedes: [ADR-0007](0007-three-calendars.md) (items 1, 3 and 4; the single `day` counter stays)

## Context
ADR-0007 put the **pranata mangsa** at the centre of the year: 12 unequal mangsa over a
120-day year, the HUD reading `Mangsa Kapat · hari 3/8 · Kliwon`, and the Hijri date as
compressed 9–10-day months.

After playing the M1 demo, the owner decided (2026-09-28) that this reads as foreign even to an
Indonesian player. Nobody in Purworejo tells the date by mangsa. Day to day, people use the
**Masehi** calendar. Next to it they use the **Javanese** date, for weton, Sura and hajatan,
and the **Hijri** date, for Ramadan, Lebaran and Idul Adha. That is the combination a printed
Indonesian wall calendar shows. The owner asked for exactly that: Masehi as the headline, and the
Javanese and Hijri dates as a subtitle. All three should stay in their real proportions, even
though a game year is only 120 days.

## Decision
**`day` stays the only stored time value; day 0 is the arrival.** Everything below is a pure
projection of it. There is still no host date, no timezone and no astronomy library
(ADR-0003).

1. **Masehi leads, scaled.**
   - A game year is 120 days, so every month is **10 game days**, whatever its real length.
   - The date shown is scaled from the real month: `1 + ⌊k · length / 10⌋`. For a 31-day
     month that gives 1, 4, 7 … 28; for February 1, 3, 6 … 26 (27 in a leap year).
   - The 1st always shows, and 1 Januari always follows the last December game day.
   - The arrival is data (`clock.json5`, today **1 Juli 2026**). It must be a date the scaling
     shows, and the schema checks that.
2. **Hijri and Jawa are read off the real date the game day shows.**
   - Each shown Masehi date is converted to a Julian day number, and from that to the
     **tabular** Hijri date: the same 30-year arithmetic as before, with no hisab and no rukyat.
   - The **Javanese** (Sultan Agungan) date is that date under Javanese month names, with
     year = Hijri year + 512. The windu year name is anchored in data: 1956 was Alip.
   - So the subtitle agrees with a printed calendar for the date shown, within the tabular
     method's ±1 day.
3. **Weekday and pasaran are real on day 0, then advance one per game day.**
   - JDN mod 7 gives the weekday and JDN mod 5 the pasaran (17 Agustus 1945, Jumat Legi, is
     the check).
   - Both then count game days, not the skipped real dates, so the week and the 35-day weton
     cycle stay whole.
   - 120 is divisible by 5, so the pasaran grid is still stable against the year.
4. **Musim comes from the Masehi month** (`months.json5`): hujan Nov–Mar, pancaroba Apr and
   Oct, kemarau May–Sep, which is 50 / 20 / 50 game days. Crops keep their coarse musim tags.
5. **Prayer bands** are a fixed table per Masehi month, still display only.
6. **The pranata mangsa leaves the systems.** It survives as lore: Mbah Hita and the older
   farmers may still read the pertanda in dialog, but no rule, event or HUD line depends on it.

The HUD reads:

```
15:40 · Ashar
Rabu Wage, 1 Juli 2026
15 Sura 1960 Dal · 15 Muharam 1448 H
```

## Consequences
**Good**
- Every player reads the headline date without explanation. The subtitle carries the
  Javanese and Islamic texture the way a real wall calendar does.
- The Hijri and Javanese dates are *real* for the date shown. Ramadan and Lebaran still drift
  ~11 real days (≈ 3–4 game days) earlier each year against the seasons, as in life.
- Months are a fixed 10 days, so a player can predict when the musim turns. Unequal mangsa
  could not offer that.
- The mangsa table was `verified: false` against a reference nobody had found, and that open
  item goes away.

**Bad / accepted costs**
- **Dates skip.** A game day stands for ~3 real days, so about two in three dates never show.
  A Hijri or Masehi *festival* date can fall on a skipped day: 1 Ramadan, 1 Syawal,
  10 Zulhijah, 17 Agustus. `dayOnOrAfterJdn` / `hijriToDay` place a festival on the first game
  day on or after it. That day's subtitle can then read `2 Ramadan` or `12 Zulhijah`.
  **Follow-up for the festival tasks:** on a festival day the HUD names the festival and not
  just the shifted date, so Idul Adha never reads as 12 Zulhijah.
- **The weekday is not the real weekday of the date shown** after day 0: 4 Juli 2026 shows
  as Kamis, but in life it is a Sabtu. This is accepted, because a whole week and weton cycle
  matter more for NPC schedules and the pasar than matching a date the player cannot check.
- The Javanese date is taken to equal the tabular Hijri date. The Javanese calendar's own
  (Asapon) arithmetic can differ by a day. `verified: false` in `clock.json5` until an almanac
  is checked.
- Mangsa-flavoured weather (GDD §3.3: "Kapitu is the heavy one") becomes month-flavoured:
  Januari, which covers most of the old Kapitu, is the heavy-rain month.

**Follow-ups**
- M2-01 validates `months.json5` and no longer asserts mangsa lengths.
- M2-05 seeds the weather per month, not per mangsa.
- The festival task makes the HUD name the festival on the day it lands (above).

## Alternatives considered
- **Keep the pranata mangsa, hide it in the sim.** This is the smallest change. It was rejected
  because two solar calendars would run at once, and the one the player never sees would
  decide their crops.
- **Compressed months (`Juli hari 3/10`) with no real dates.** Nothing skips, but no date on
  screen would ever be a real one, and the Javanese and Hijri subtitle would have to be
  compressed too.
- **A 365-day year with real dates.** Everything would be exact, but the year would be three
  times longer, and GDD §4 crops and §7 economy would need rebalancing from scratch.
