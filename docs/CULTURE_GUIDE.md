# CULTURE GUIDE — Representing Indonesia with respect

> Read before writing any NPC, dialog, festival, clothing, food, building, or religious reference.
> Principle: **celebrate, don't caricature.** Culture lives in the *systems* and the *people*, not in exotic decoration.

## 1. Principles

1. **Fictional composite, real respect.** Pulau Lestari blends several regions so we don't misrepresent one real village. Each element still comes from a real tradition. Know its source and credit the region.
2. **People are people first.** An NPC's regional or religious identity is a background detail, not a punchline or their whole personality.
3. **No sacred things as loot.** Sacred objects, prayers, and rituals are never items to sell, farm, or grind.
4. **Diversity is normal.** Indonesia has a Muslim majority, and Hindu Bali, Christian and Catholic communities, Buddhist and Confucian communities, and indigenous beliefs (*kepercayaan*) all exist. The village reflects this quietly: a mosque, a church, and a temple coexist.
5. **Ask the community.** Anything regional gets reviewed by at least one person from that region before v1. Use the *Culture feedback* issue template.

## 2. Glossary seeds (keep terms consistent; also used by the in-game *Kamus*)

| Term | Meaning (EN) | Notes |
|---|---|---|
| *sawah* | wet rice field / paddy | Never translate in dialog; glossary explains |
| *tegalan* | dry field | |
| *subak* | Balinese cooperative irrigation system, UNESCO World Heritage (2012) | The game uses a *subak-inspired* system. Don't claim it is exact |
| *kelian subak* | head of a subak organization | |
| *gotong royong* | mutual cooperation, communal work | Core social mechanic |
| *pasaran* | 5-day Javanese market week: Legi, Pahing, Pon, Wage, Kliwon | Combined with the 7-day week it forms *weton*. Keep *weton* as lore only, no fortune-telling mechanics |
| *pancaroba* | transitional season | |
| *tengkulak* | middleman who buys harvests cheaply | A real economic issue for farmers. Treat it seriously, give the character redemption |
| *Dewi Sri* | Javanese/Sundanese/Balinese goddess of rice and fertility | See §3 |
| *tumpeng* | cone-shaped rice dish for thanksgiving | |
| *warung* | small family shop or eatery | |
| *jamu* | traditional herbal medicine | No medical claims in game text |
| *kentongan* | wooden/bamboo slit drum used as a village signal | |
| *joglo* | traditional Javanese house | |

## 3. Religion & spirituality

- **Dewi Sri:** revered in Javanese, Sundanese, and Balinese agrarian traditions, and still sacred to many people. Represent her as a gentle, dignified presence in lore (a shrine in the sawah, a story told by Mbah Sri). **Do not** make her a quest-giver who trades items for power ups, a romance option, or a comic figure. The "Harvest Goddess" gameplay role (blessings, mysteries) goes to a **fictional spirit of the island's spring** (*Penunggu Mata Air*, working name) that is clearly our own invention.
- **Religious holidays** (Idul Fitri, Nyepi, Natal, Waisak, Imlek): NPCs may reference them in dialog (*mudik*, *ketupat*, family visits, silence on Nyepi) with accurate, warm framing. No gameplay rewards tied to worship. No mandatory participation.
- **Places of worship:** visible, respectful, non-interactive (or with a simple "the building is quiet" description). No items or events inside.
- **Call to prayer ambience:** optional, off by default for new players outside Indonesia (locale ≠ `id`), low volume, never used as a gameplay timer.
- **Food & animals:** no pork items and no alcohol in MVP content, which keeps the village inclusive. Regional diversity (e.g. Balinese or Batak cuisine) can come later with community review and careful framing.
- **Mystical content:** light folklore (a *kuntilanak* rumor, *tuyul* jokes) only as NPC stories and never mocking believers. No black magic mechanics.

## 4. Regional identity of NPCs

- Avoid stereotypes: Batak = loud, Padang = stingy, Chinese-Indonesian = only a shopkeeper, Madurese = hot-tempered, Papuan = "primitive". **Never.**
- Koh Hendra (Chinese-Indonesian) runs a shop *and* is a local-history buff and a community leader. Give every NPC depth beyond their job.
- Keep the cast varied in gender and age. Young women are not only love interests; elders are not only wise sages.
- Names: use realistic names for their region. Check that honorifics fit: *Pak/Bu* is general; *Mas/Mbak* is Javanese; *Bli* and *Mbok* are Balinese; *Uda/Uni* is Minang; *Koh/Cik* is Chinese-Indonesian; *Daeng* is Bugis-Makassar.

## 5. Language in dialog

- The system UI is standard Indonesian (see DESIGN §9).
- NPC dialog may use regional words sparingly (*monggo*, *punten*, *nggih*, *ajo*, *bli*) and must stay understandable. Add unfamiliar words to the glossary.
- **EN translation:** keep culturally loaded nouns in Indonesian (italic), and translate everything else naturally. Don't over-exoticize.
- No profanity beyond very mild expressions (*astaga*, *aduh*, *waduh*).

## 6. History & politics

- Independence Day (*Tujuhbelasan*) is joyful and communal. Keep it apolitical: no parties, politicians, or contemporary controversies.
- Avoid real contemporary political figures, parties, regional conflicts, and ethnic tensions entirely.

## 7. Review checklist (paste into PRs that add cultural content)

- [ ] Source region identified and noted in the data file (`origin: "Jawa Tengah"` etc.)
- [ ] No sacred item or ritual used as a gameplay resource
- [ ] No stereotype; the NPC has goals and personality beyond their ethnicity or job
- [ ] Regional words added to the glossary (EN + ID)
- [ ] Community reviewer requested (issue linked) for festivals and major NPCs

## 8. References (starting points for contributors)

- UNESCO, "Cultural Landscape of Bali Province: the Subak System as a Manifestation of the Tri Hita Karana Philosophy" (2012).
- Kementerian Pendidikan dan Kebudayaan: *Warisan Budaya Takbenda Indonesia* registry.
- Local knowledge from contributors, which is the most valuable source. Record it in `docs/culture-notes/` (create when first needed).
