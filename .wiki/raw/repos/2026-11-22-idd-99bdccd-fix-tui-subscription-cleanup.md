---
title: "Collection: archivado de fix-tui-subscription-cleanup (idd@99bdccd)"
source: "."
type: repos
ingested: 2026-11-22
tags: [collection, collection-manifest, git, fix-tui-subscription-cleanup]
summary: "Manifest for a collection ingest of the intent-driven template repository: 20 files touched by fix-tui-subscription-cleanup (the TUI parts of the openspec-autopilot and session-bootstrap OpenCode plugins, ADR-0010, the suite's OpenCode simulators and steps, core tests, the acceptance README, the synced openspec-autopilot and session-bootstrap specs and the archived change) pinned by path and blob SHA at commit 99bdccde7c38654647060aaea050381309647a5c. No file bodies are copied."
collection: "idd"
adapter: git
revision: "99bdccde7c38654647060aaea050381309647a5c"
canonical_url: "https://github.com/hiebra/idd/tree/99bdccde7c38654647060aaea050381309647a5c"
license: "unknown"
manifest_only: true
---

# Collection: archivado de fix-tui-subscription-cleanup (idd@99bdccd)

Fija, en el commit del archivado, lo que tocó el change `fix-tui-subscription-cleanup`: las partes de TUI de los plugins `openspec-autopilot` y `session-bootstrap`, que ahora liberan sus suscripciones con la limpieza que devuelve `setup`; ADR-0010, que lo fija para todos los plugins de OpenCode del proyecto y matiza ADR-0008; los simuladores de OpenCode de la suite, que modelan esa limpieza, la recarga y el cierre con `--standalone`; los pasos y las pruebas del núcleo; el README de la suite, y las specs `openspec-autopilot` y `session-bootstrap` ya sincronizadas. Cita como `idd@99bdccde7c38654647060aaea050381309647a5c:<ruta>`.

| Path | Blob SHA |
|---|---|
| `.opencode/plugins/openspec-autopilot/tui.js` | `ce1bcd62c0c54218b02a71f5ae2d621b7423058d` |
| `.opencode/plugins/session-bootstrap/tui.js` | `5e91d51f838a8eeb981ee970a650e8025f233872` |
| `acceptance-tests/README.md` | `bf7ca1b7fab85ae77522d714667d598d2f921bab` |
| `acceptance-tests/core-tests/autopilot-plugin.test.js` | `6812df5d292fa822e614f1c5c8fbdb4c1df84ba7` |
| `acceptance-tests/step-definitions/autopilot.steps.js` | `cb96d33616486fe555a71627918d0f524f710766` |
| `acceptance-tests/step-definitions/session-bootstrap.steps.js` | `7bc253af334c8deebe768e41fea0c523148b8b7e` |
| `acceptance-tests/support/agents/opencode-host.mjs` | `c7b6872ebfc7b6b2172050769459d207c06bc395` |
| `acceptance-tests/support/agents/opencode-sim-process.mjs` | `87db67e4cdc33bdc0cd69cf083ff9405cd377f3e` |
| `acceptance-tests/support/agents/opencode-sim.mjs` | `77e4a4463f141eeb6c2f95736f1f5896a9ffdf1c` |
| `acceptance-tests/support/agents/opencode.js` | `ed9fe21642997f452188b63d44c37aa413d0fcb4` |
| `adr/0010-opencode-plugins-release-what-they-register.md` | `44fb376b3704acda4f921e94f472cd06025b3f2f` |
| `openspec/changes/archive/2026-11-22-fix-tui-subscription-cleanup/.openspec.yaml` | `1a9f87e2cc46559e30c348b19780820b33a722c7` |
| `openspec/changes/archive/2026-11-22-fix-tui-subscription-cleanup/adr.md` | `3bb800aaa3585fb63c01bd1d9a1ce9df47f4ecf9` |
| `openspec/changes/archive/2026-11-22-fix-tui-subscription-cleanup/design.md` | `65da0005c05f217c41a55e3befdd65006dec20a1` |
| `openspec/changes/archive/2026-11-22-fix-tui-subscription-cleanup/proposal.md` | `cf42de79d6518b03251bcd4a1296ce970783dad7` |
| `openspec/changes/archive/2026-11-22-fix-tui-subscription-cleanup/specs/openspec-autopilot/spec.md` | `600ec6b8d0106512344d1374ede229c28fa0c095` |
| `openspec/changes/archive/2026-11-22-fix-tui-subscription-cleanup/specs/session-bootstrap/spec.md` | `b47d72b8e07c8e73688a568744ee4c47a7deb7d0` |
| `openspec/changes/archive/2026-11-22-fix-tui-subscription-cleanup/tasks.md` | `d6229f8c27a62199193441d6f60880b4e8f2dd6b` |
| `openspec/specs/openspec-autopilot/spec.md` | `a58aee232c02275ad8099c0bcce69186e7829bf7` |
| `openspec/specs/session-bootstrap/spec.md` | `30bccbe0ca615283c473851fc46a6c3bdd997c9a` |

## Procedencia

Comprobado el 2026-11-22:

- **Rutas**: las del diff entre el merge-base de la rama con `main` (`6199cdc`) y el commit del archivado (`99bdccd`), según las indicaciones de archivado. ADR-0010 está en el diff porque se escribió en la rama. Se excluyen `.wiki/` y lo generado.
- **Specs sincronizadas**: cada una de `openspec/specs/openspec-autopilot/spec.md` y `openspec/specs/session-bootstrap/spec.md` recibe un requisito nuevo (solo ADDED). La suite pasa contra ellas (118 escenarios, 623 pasos) y `npm run test:core` da 34 pruebas en verde.
- **Comprobaciones con OpenCode 2.3.2 real**: están anotadas en la task 5.2 del `tasks.md` archivado. Las trazas `ECONNRESET` al cerrar con `--standalone` bajan de 9 y 27 (sin recargas y tras dos) a 0 y 0. Tras dos recargas, el autopilot sigue atendiendo `select` y `navigate` en la última carga, con `alibaba/qwen3.8-flash`.
- **Blob ya fijado en otro manifiesto**: `.openspec.yaml` coincide con el de [add-openspec-autopilot](2026-11-21-idd-772d0f0-add-openspec-autopilot.md), con el mismo contenido mínimo. Se fija igual porque su ruta es otra.
