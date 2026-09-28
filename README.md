# 🌾 Balé

**An open-source HD-2D farming and life sim set in a real Javanese town.**

Balé is a browser-first game set in **Baledono, Purworejo, Central Java**. You leave Jakarta to take over a patch of ground from your grandfather, **Mbah Hita** — still alive, no longer strong enough to work it, and carrying an unfinished ambition: to make the place *asri, nyaman, tenang*. Everyone just calls it **the balé**, after the pavilion he began on it.

Farming pays for the work. The goal is not the size of your bank balance but **the quality of the place** — how green it is, how comfortable to be in, how quiet. A low-poly 3D world with 2D sprite characters, a cozy daily rhythm, and systems drawn from how the year actually runs there: the twelve *mangsa* of the Javanese farming calendar, the five-day *pasaran* market cycle, and the lunar calendar that walks Ramadan and Lebaran through the seasons.

> 🚧 **Early development:** Balé is in the M1 tech spike. Every merge to `main` publishes the build to **<https://andynur.github.io/ndeso/>** — right now a rotating placeholder, not a game. Walking around arrives at M1-09; an actually playable slice at M2. Follow the [roadmap](docs/ROADMAP.md).
>
> *Publishing is pending a one-time repository setting — see [TESTING §1](docs/TESTING.md).*

English · [Bahasa Indonesia](README.id.md) · [Issues](https://github.com/andynur/ndeso/issues)

## Vision

Open a link and, in under 15 seconds, be standing on Mbah Hita's ground at maghrib — grass to the knee, a joglo with no roof, a dry channel across the dirt, and the adzan from the musholla next door. Balé is designed to be:

- **Cozy and grounded:** a relaxing daily rhythm. No combat, no villain, no fail state.
- **Measured by the place, not the profit:** *asri, nyaman, tenang* is the scoreboard, and it is computed from what you actually put on the ground.
- **Authentically Indonesian, and specifically Javanese:** culture expressed through systems — the *pranata mangsa*, the market day, the water schedule — not decorative stereotypes. A real town, handled by a [naming policy](docs/PLACES.md) and a [culture guide](docs/CULTURE_GUIDE.md).
- **Instant and lightweight:** playable in a browser, offline after the first visit, and designed for low-to-mid-range Android phones.
- **Open and moddable:** data-driven content and welcoming contribution paths for code, art, music, translation, and cultural knowledge.

## Planned features

- HD-2D rendering with Three.js and WebGL2
- Farming, animals, NPC schedules, friendship, shops, and festivals
- English and Bahasa Indonesia at launch, with room for additional locales
- Touch, keyboard, and gamepad input
- Offline PWA support and versioned local saves
- Data-driven crops, items, NPCs, festivals, and Ink dialog
- Performance targets for budget mobile hardware: 30 FPS and a small first playable download

## Project status

The project is being built milestone by milestone:

1. **M0 — Bootstrap:** workspace, tooling, CI, and an empty Three.js scene
2. **M1 — Tech spike:** terrain, player movement, sprites, lighting, and performance baseline
3. **M2 — Vertical slice:** farming, NPCs, dialog, saving, PWA support, and localization
4. **M3/M4 — Alpha and beta:** expanded world, festivals, irrigation, accessibility, and community review

See the [full roadmap](docs/ROADMAP.md) and the current [session status](docs/STATUS.md).

## Technology

- [Bun](https://bun.sh/) 1.4 — runtime, package manager, scripts, bundling, and tests
- [TypeScript](https://www.typescriptlang.org/) — strict typed codebase
- [Three.js](https://threejs.org/) — WebGL2 rendering
- [Preact](https://preactjs.com/) — lightweight UI overlay
- [Zod](https://zod.dev/) — schemas and validation
- [inkjs](https://github.com/y-lohse/inkjs) — branching dialog

Read [docs/TECH_STACK.md](docs/TECH_STACK.md) for dependency and platform details.

## Development setup

### Requirements

- [Bun](https://bun.sh/) matching the version in [`.bun-version`](.bun-version)
- A modern browser with WebGL2 support
- Git

### Install and run

The application workspace is being delivered in milestone M0. Once the bootstrap task is available, the expected local workflow is:

```bash
bun install
bun run dev
bun run check
```

`bun run dev` will expose the development server on the printed LAN URL for phone testing. `bun run check` runs type checking, linting, dependency-boundary checks, localization/content validation, and tests.

For the current implementation state, start with [docs/STATUS.md](docs/STATUS.md) and [docs/ROADMAP.md](docs/ROADMAP.md).

## Repository structure

```text
apps/          Browser client and the optional future server
packages/      Shared types, pure simulation, and game content
tools/         Validation, asset, build, and smoke-test tooling
assets-src/    Source art files (planned)
docs/          Product, design, architecture, culture, and testing docs
```

The simulation package is intentionally framework-independent and deterministic. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for import boundaries and runtime design.

## Documentation

| Area | Documents |
| --- | --- |
| Product | [PRD](docs/PRD.md) · [GDD](docs/GDD.md) · [Roadmap](docs/ROADMAP.md) |
| Design and culture | [Design](docs/DESIGN.md) · [Culture guide](docs/CULTURE_GUIDE.md) · [Glossary](docs/GLOSSARY.md) |
| Engineering | [Architecture](docs/ARCHITECTURE.md) · [Tech stack](docs/TECH_STACK.md) · [Testing](docs/TESTING.md) |
| Content and assets | [Localization](docs/I18N.md) · [Asset pipeline](docs/ASSET_PIPELINE.md) · [Credits](assets/CREDITS.md) |
| Project decisions | [ADRs](docs/adr/) · [AI workflow](docs/AI_WORKFLOW.md) |

## Contributing

Contributions are welcome, including code, original art, music, translations, testing, and regional cultural knowledge.

Before starting:

1. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the relevant project documentation.
2. Check the next available task in the [roadmap](docs/ROADMAP.md), or open an issue for a new idea.
3. For architecture changes or new dependencies, discuss the change first and follow the ADR process.
4. Run `bun run check` before opening a pull request.

Label cultural questions for community review when opening an issue. AI-assisted contributions are allowed, but contributors are responsible for reviewing, testing, and understanding the submitted work.

## Security

Please report vulnerabilities privately through [GitHub Security Advisories](https://github.com/andynur/ndeso/security/advisories/new). Do not disclose security issues in a public issue. See [SECURITY.md](SECURITY.md) for the support policy.

## License

- Source code: [MIT](LICENSE)
- Original art, audio, and writing: [CC BY-SA 4.0](LICENSE-ASSETS.md)
- Third-party assets: see [assets/CREDITS.md](assets/CREDITS.md) and each asset's license

## Acknowledgements

Balé is inspired by the farming and life-sim genre, including *Harvest Moon: Back to Nature* and *Coral Island*. It is an independent project and is not affiliated with or endorsed by those titles or their rights holders.
