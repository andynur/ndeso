# 🌾 Ndeso *(working title)*

**A cozy HD-2D farming life sim set on an Indonesian island. Open source, plays instantly in your browser, on desktop and on low-end Android phones.**

*Bahasa Indonesia: [README.id.md](README.id.md)*

> Status: **pre-alpha, planning & bootstrap** (see [docs/STATUS.md](docs/STATUS.md)).

## Why
Inspired by *Harvest Moon: Back to Nature* and *Coral Island*, with Indonesian village life at its core: *sawah* terraces, subak-inspired water sharing, market days on the Javanese *pasaran* cycle, *gotong royong*, and festivals like *Tujuhbelasan*. No install: open a link, play, and keep playing offline.

## Highlights (planned)
- HD-2D look: a low-poly 3D world with pixel-art sprite characters (Three.js, WebGL2)
- Runs at 30 fps on budget Android phones; ≤ 10 MB to first playable frame; offline PWA
- English 🇬🇧 and Bahasa Indonesia 🇮🇩 from day one; more languages welcome
- Data-driven, moddable content (crops, NPCs, festivals, Ink dialog)

## Tech
Bun 1.4 · TypeScript · Three.js · Preact · Zod · inkjs. Details: [docs/TECH_STACK.md](docs/TECH_STACK.md).

```bash
bun install
bun run dev      # open the printed LAN URL on your phone too
bun run check    # types, lint, i18n, content, tests
```
*(Scripts land in milestone M0; see [ROADMAP](docs/ROADMAP.md).)*

## Docs
| | |
|---|---|
| Product | [PRD](docs/PRD.md) · [GDD](docs/GDD.md) · [ROADMAP](docs/ROADMAP.md) |
| Design | [DESIGN](docs/DESIGN.md) · [CULTURE_GUIDE](docs/CULTURE_GUIDE.md) |
| Engineering | [ARCHITECTURE](docs/ARCHITECTURE.md) · [I18N](docs/I18N.md) · [PERFORMANCE_BUDGET](docs/PERFORMANCE_BUDGET.md) · [ASSET_PIPELINE](docs/ASSET_PIPELINE.md) · [TESTING](docs/TESTING.md) · [ADRs](docs/adr/) |
| AI agents | [AGENTS.md](AGENTS.md) · [CLAUDE.md](CLAUDE.md) · [MASTER_PROMPT](MASTER_PROMPT.md) · [AI_WORKFLOW](docs/AI_WORKFLOW.md) |

## Contributing
Code, art, music, translations, and **cultural knowledge** are all welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md). This project is built with the help of AI coding agents; human review and community cultural review decide what ships.

## License
Code: [MIT](LICENSE). Original art, audio, and writing: [CC BY-SA 4.0](LICENSE-ASSETS.md).
# ndeso
